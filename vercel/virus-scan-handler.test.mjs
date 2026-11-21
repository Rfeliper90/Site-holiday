import assert from 'node:assert/strict';
import test from 'node:test';
import virusScanHandler from '../lib/virus-scan-handler.mjs';

test('only scans a visible post link after explicit consent', async () => {
    const previousFetch = globalThis.fetch;
    const previousApiKey = process.env.VIRUSTOTAL_API_KEY;
    const previousHolidayApiUrl = process.env.HOLIDAY_API_URL;
    const publicUrl = 'https://public-files.example.org/handler-integration-test';
    const calls = [];

    process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
    process.env.HOLIDAY_API_URL = 'https://holiday-api.example/api';
    globalThis.fetch = async (input, options) => {
        const requestUrl = String(input);
        calls.push({ requestUrl, options });
        if (requestUrl.startsWith('https://holiday-api.example/api/downloads?')) {
            assert.equal(options.headers.Authorization, 'Bearer test-session-token');
            return Response.json({
                success: true,
                downloads: [{
                    id: 43210,
                    link: publicUrl,
                    links_json: JSON.stringify([{ url: publicUrl }]),
                    suspensionStatus: null
                }]
            });
        }
        assert.match(requestUrl, /^https:\/\/www\.virustotal\.com\/api\/v3\/urls\//);
        assert.equal(options.headers['x-apikey'], 'test-api-key');
        return Response.json({
            data: {
                attributes: {
                    last_analysis_stats: {
                        malicious: 0,
                        suspicious: 0,
                        harmless: 24,
                        undetected: 5
                    }
                }
            }
        });
    };

    try {
        const request = new Request('https://guildaholiday.vercel.app/api/virus-scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-forwarded-for': '203.0.113.250',
                Authorization: 'Bearer test-session-token'
            },
            body: JSON.stringify({
                downloadId: 43210,
                linkIndex: 0,
                consent: true
            })
        });
        const response = await virusScanHandler.fetch(request);
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);
        assert.equal(payload.status, 'completed');
        assert.equal(payload.stats.harmless, 24);
        assert.equal(calls.length, 2);
    } finally {
        globalThis.fetch = previousFetch;
        if (previousApiKey === undefined) delete process.env.VIRUSTOTAL_API_KEY;
        else process.env.VIRUSTOTAL_API_KEY = previousApiKey;
        if (previousHolidayApiUrl === undefined) delete process.env.HOLIDAY_API_URL;
        else process.env.HOLIDAY_API_URL = previousHolidayApiUrl;
    }
});

test('does not contact the backend without explicit consent', async () => {
    const previousApiKey = process.env.VIRUSTOTAL_API_KEY;
    process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
    try {
        const request = new Request('https://guildaholiday.vercel.app/api/virus-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId: 123, linkIndex: 0 })
        });
        const response = await virusScanHandler.fetch(request);
        const payload = await response.json();
        assert.equal(response.status, 400);
        assert.equal(payload.success, false);
    } finally {
        if (previousApiKey === undefined) delete process.env.VIRUSTOTAL_API_KEY;
        else process.env.VIRUSTOTAL_API_KEY = previousApiKey;
    }
});
