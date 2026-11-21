import { isIP } from 'node:net';

const API_BASE_URL = 'https://www.virustotal.com/api/v3';
const COMPLETED_CACHE_MS = 15 * 60 * 1000;
const PENDING_CACHE_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const resultCache = new Map();
const inFlightScans = new Map();

export class VirusTotalScanError extends Error {
    constructor(code, message, httpStatus = 502) {
        super(message);
        this.name = 'VirusTotalScanError';
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

export function normalizeVirusTotalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) {
        throw new VirusTotalScanError('invalid_url', 'O link está vazio ou é longo demais.', 400);
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw new VirusTotalScanError('invalid_url', 'O link não é uma URL válida.', 400);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new VirusTotalScanError('invalid_url', 'Só é possível examinar links HTTP ou HTTPS.', 400);
    }
    if (parsed.username || parsed.password) {
        throw new VirusTotalScanError('private_url', 'Esse link parece exigir acesso privado e não pode ser enviado ao VirusTotal.', 400);
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
        isIP(hostname) ||
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local')
    ) {
        throw new VirusTotalScanError('private_url', 'Esse tipo de endereço não pode ser verificado. Use um link público com domínio.', 400);
    }

    return parsed.toString();
}

function getCachedResult(url) {
    const entry = resultCache.get(url);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        resultCache.delete(url);
        return null;
    }
    return entry.result;
}

function cacheResult(url, result) {
    for (const [cachedUrl, entry] of resultCache) {
        if (entry.expiresAt <= Date.now()) resultCache.delete(cachedUrl);
    }
    while (resultCache.size >= MAX_CACHE_ENTRIES) {
        resultCache.delete(resultCache.keys().next().value);
    }
    const ttl = result.status === 'completed' ? COMPLETED_CACHE_MS : PENDING_CACHE_MS;
    resultCache.set(url, { result, expiresAt: Date.now() + ttl });
}

async function requestVirusTotal(url, apiKey, fetchImpl, options = {}) {
    let response;
    try {
        response = await fetchImpl(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'x-apikey': apiKey
            },
            signal: AbortSignal.timeout(10_000)
        });
    } catch {
        throw new VirusTotalScanError(
            'upstream_unavailable',
            'Não foi possível conectar ao VirusTotal. Tente novamente mais tarde.'
        );
    }

    if (response.status === 404 && options.allowNotFound) return null;
    if (response.status === 429) {
        throw new VirusTotalScanError(
            'rate_limited',
            'O limite de consultas do VirusTotal foi atingido. Aguarde antes de tentar novamente.',
            429
        );
    }
    if (response.status === 401 || response.status === 403) {
        throw new VirusTotalScanError(
            'invalid_api_key',
            'A chave configurada do VirusTotal não foi aceita.',
            503
        );
    }
    if (!response.ok) {
        throw new VirusTotalScanError(
            'upstream_error',
            'O VirusTotal não conseguiu processar a consulta.'
        );
    }

    try {
        return await response.json();
    } catch {
        throw new VirusTotalScanError(
            'invalid_response',
            'O VirusTotal retornou uma resposta inválida.'
        );
    }
}

function normalizeAnalysisStats(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        malicious: Number(value.malicious) || 0,
        suspicious: Number(value.suspicious) || 0,
        harmless: Number(value.harmless) || 0,
        undetected: Number(value.undetected) || 0
    };
}

async function performScan(url, apiKey, fetchImpl) {
    const urlId = Buffer.from(url).toString('base64url');
    const report = await requestVirusTotal(
        `${API_BASE_URL}/urls/${urlId}`,
        apiKey,
        fetchImpl,
        { allowNotFound: true }
    );

    if (report) {
        const stats = normalizeAnalysisStats(report?.data?.attributes?.last_analysis_stats);
        if (stats) {
            return {
                status: 'completed',
                stats,
                reportUrl: `https://www.virustotal.com/gui/url/${urlId}`
            };
        }
        return {
            status: 'pending',
            retryAfterSeconds: 60
        };
    }

    await requestVirusTotal(
        `${API_BASE_URL}/urls`,
        apiKey,
        fetchImpl,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ url })
        }
    );

    return {
        status: 'pending',
        retryAfterSeconds: 60
    };
}

export async function scanVirusTotalUrl(rawUrl, apiKey, fetchImpl = globalThis.fetch) {
    const url = normalizeVirusTotalUrl(rawUrl);
    const normalizedApiKey = String(apiKey || '').trim();
    if (!normalizedApiKey) {
        throw new VirusTotalScanError(
            'not_configured',
            'A verificação ainda não foi configurada pelo administrador.',
            503
        );
    }
    if (typeof fetchImpl !== 'function') {
        throw new VirusTotalScanError(
            'upstream_unavailable',
            'A consulta ao VirusTotal está indisponível neste momento.'
        );
    }

    const cached = getCachedResult(url);
    if (cached) return cached;

    const inFlight = inFlightScans.get(url);
    if (inFlight) return inFlight;

    const scanPromise = performScan(url, normalizedApiKey, fetchImpl)
        .then((result) => {
            cacheResult(url, result);
            return result;
        });
    inFlightScans.set(url, scanPromise);

    try {
        return await scanPromise;
    } finally {
        inFlightScans.delete(url);
    }
}
