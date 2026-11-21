import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeVirusTotalUrl,
    scanVirusTotalUrl,
    VirusTotalScanError
} from '../lib/virustotal.mjs';

function response(status, payload) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => payload
    };
}

test('allows public URLs with query parameters', () => {
    const url = 'https://www.mediafire.com/file/public-id/sample.zip?dkey=public-share-key';
    assert.equal(normalizeVirusTotalUrl(url), url);
});

test('rejects URLs that contain credentials or point to private hosts', () => {
    assert.throws(
        () => normalizeVirusTotalUrl('https://user:password@files.example.org/download'),
        (error) => error instanceof VirusTotalScanError && error.code === 'private_url'
    );
    assert.throws(
        () => normalizeVirusTotalUrl('http://127.0.0.1/file.zip'),
        (error) => error instanceof VirusTotalScanError && error.code === 'private_url'
    );
});

test('returns and caches an existing VirusTotal report', async () => {
    const url = 'https://public-files.example.org/report-cache-test';
    let calls = 0;
    const fetchImpl = async (requestUrl, options) => {
        calls += 1;
        assert.match(String(requestUrl), /^https:\/\/www\.virustotal\.com\/api\/v3\/urls\//);
        assert.equal(options.headers['x-apikey'], 'test-api-key');
        return response(200, {
            data: {
                attributes: {
                    last_analysis_stats: {
                        malicious: 1,
                        suspicious: 2,
                        harmless: 30,
                        undetected: 4
                    }
                }
            }
        });
    };

    const first = await scanVirusTotalUrl(url, 'test-api-key', fetchImpl);
    const second = await scanVirusTotalUrl(url, 'test-api-key', fetchImpl);
    assert.equal(first.status, 'completed');
    assert.equal(first.stats.malicious, 1);
    assert.equal(first.stats.suspicious, 2);
    assert.equal(second.reportUrl, first.reportUrl);
    assert.equal(calls, 1);
});

test('submits an unreported public URL once and returns pending status', async () => {
    const url = 'https://public-files.example.org/new-scan-test';
    const calls = [];
    const fetchImpl = async (requestUrl, options) => {
        calls.push({ requestUrl: String(requestUrl), options });
        if (calls.length === 1) return response(404, {});
        return response(200, { data: { id: 'analysis-id' } });
    };

    const first = await scanVirusTotalUrl(url, 'test-api-key', fetchImpl);
    const second = await scanVirusTotalUrl(url, 'test-api-key', fetchImpl);
    assert.equal(first.status, 'pending');
    assert.equal(second.status, 'pending');
    assert.equal(calls.length, 2);
    assert.equal(calls[1].requestUrl, 'https://www.virustotal.com/api/v3/urls');
    assert.equal(calls[1].options.body.get('url'), url);
});
