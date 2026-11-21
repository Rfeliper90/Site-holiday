import { normalizeVirusTotalUrl, scanVirusTotalUrl, VirusTotalScanError } from './virustotal.mjs';

const DEFAULT_HOLIDAY_API_URL = 'https://guildaholiday.discloud.dev/api';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const requestHistory = new Map();

function jsonResponse(payload, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

function consumeRateLimit(request) {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const clientIp = forwardedFor.split(',')[0].trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const now = Date.now();
    const recent = (requestHistory.get(clientIp) || [])
        .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.max(
            1,
            Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000)
        );
        requestHistory.set(clientIp, recent);
        return retryAfter;
    }

    recent.push(now);
    requestHistory.set(clientIp, recent);
    if (requestHistory.size > 500) {
        for (const [ip, timestamps] of requestHistory) {
            if (!timestamps.some((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)) {
                requestHistory.delete(ip);
            }
        }
    }
    return 0;
}

function parseDownloadLinks(download) {
    let links = [];
    if (Array.isArray(download?.links_json)) {
        links = download.links_json;
    } else if (typeof download?.links_json === 'string' && download.links_json.trim()) {
        try {
            const parsed = JSON.parse(download.links_json);
            if (Array.isArray(parsed)) links = parsed;
            else if (parsed) links = [parsed];
        } catch {
            throw new Error('A postagem contém uma lista de links inválida.');
        }
    }

    const normalized = links
        .map((item) => typeof item === 'string' ? item.trim() : String(item?.url || item?.link || '').trim())
        .filter(Boolean);

    if (normalized.length === 0 && typeof download?.link === 'string' && download.link.trim()) {
        normalized.push(download.link.trim());
    }
    return normalized;
}

function getHolidayApiBaseUrl() {
    const raw = String(process.env.HOLIDAY_API_URL || DEFAULT_HOLIDAY_API_URL).trim().replace(/\/+$/, '');
    const base = /\/api$/i.test(raw) ? raw : `${raw}/api`;
    const parsed = new URL(base);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        throw new Error('HOLIDAY_API_URL must use HTTPS.');
    }
    return base;
}

async function getVisibleDownload(request, downloadId) {
    const apiBase = getHolidayApiBaseUrl();
    const headers = { Accept: 'application/json' };
    const authorization = request.headers.get('authorization') || '';
    if (/^Bearer\s+\S{1,8192}$/i.test(authorization)) {
        headers.Authorization = authorization;
    }

    let response;
    try {
        response = await fetch(`${apiBase}/downloads?_virusScan=${Date.now()}`, {
            headers: {
                ...headers,
                'Cache-Control': 'no-store'
            },
            signal: AbortSignal.timeout(10_000)
        });
    } catch {
        throw new Error('Não foi possível consultar a postagem no site.');
    }

    if (!response.ok) {
        throw new Error('Não foi possível confirmar a visibilidade da postagem.');
    }

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error('A API do site retornou uma resposta inválida.');
    }

    if (!payload?.success || !Array.isArray(payload.downloads)) {
        throw new Error('Não foi possível obter a lista de postagens.');
    }

    return payload.downloads.find((download) => Number(download?.id) === downloadId) || null;
}

async function virusScanHandler(request) {
    if (request.method !== 'POST') {
        return jsonResponse({ success: false, message: 'Método não permitido.' }, 405, { Allow: 'POST' });
    }

    const apiKey = String(process.env.VIRUSTOTAL_API_KEY || '').trim();
    if (!apiKey) {
        return jsonResponse({
            success: false,
            message: 'A verificação ainda não foi configurada pelo administrador.'
        }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ success: false, message: 'Solicitação inválida.' }, 400);
    }

    if (body?.consent !== true) {
        return jsonResponse({
            success: false,
            message: 'Confirme que o link é público antes de solicitar a verificação.'
        }, 400);
    }

    const downloadId = Number(body?.downloadId);
    const linkIndex = Number(body?.linkIndex);
    if (!Number.isSafeInteger(downloadId) || downloadId < 1
        || !Number.isInteger(linkIndex) || linkIndex < 0 || linkIndex > 2) {
        return jsonResponse({ success: false, message: 'Postagem ou link inválido.' }, 400);
    }

    const retryAfter = consumeRateLimit(request);
    if (retryAfter) {
        return jsonResponse(
            { success: false, message: 'Muitas verificações. Aguarde antes de tentar novamente.' },
            429,
            { 'Retry-After': String(retryAfter) }
        );
    }

    try {
        const download = await getVisibleDownload(request, downloadId);
        if (!download || download.isAdultLocked || download.membersOnlyLocked) {
            return jsonResponse({ success: false, message: 'Postagem não encontrada ou sem acesso.' }, 404);
        }

        const suspensionStatus = String(download.suspensionStatus || '').toLowerCase();
        if (suspensionStatus === 'suspended' || suspensionStatus === 'under_review') {
            return jsonResponse({ success: false, message: 'Esta postagem não está disponível para verificação.' }, 403);
        }

        const links = parseDownloadLinks(download);
        if (!links[linkIndex]) {
            return jsonResponse({ success: false, message: 'Link não encontrado nesta postagem.' }, 404);
        }

        const apiBase = getHolidayApiBaseUrl();
        const rawLink = links[linkIndex];
        const candidateUrl = rawLink.startsWith('/') && !rawLink.startsWith('//')
            ? new URL(rawLink, apiBase).toString()
            : rawLink;
        const safeUrl = normalizeVirusTotalUrl(candidateUrl);
        const result = await scanVirusTotalUrl(safeUrl, apiKey);
        return jsonResponse({ success: true, ...result });
    } catch (error) {
        if (error instanceof VirusTotalScanError) {
            return jsonResponse({
                success: false,
                code: error.code,
                message: error.message
            }, error.httpStatus);
        }

        console.error('[VirusTotal] Erro ao verificar postagem:', error?.message || 'erro desconhecido');
        return jsonResponse({
            success: false,
            message: error?.message || 'Não foi possível verificar este link.'
        }, 502);
    }
}

export default { fetch: virusScanHandler };
