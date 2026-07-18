// ============================================================
// PIGGY PUSH — notification sender for the Royal Order of the Hog
// Runs on Cloudflare Workers (free tier). Subscriptions live in KV.
//
// Design: pushes are sent WITHOUT an encrypted payload (bare pushes).
// The service worker on each phone wakes up and fetches GET /latest
// from this worker to learn what to display. This avoids RFC 8291
// payload crypto entirely; VAPID JWT auth is done with WebCrypto.
//
// Endpoints:
//   POST /subscribe   { player, subscription }  -> stores sub in KV
//   POST /unsubscribe { endpoint }              -> removes sub
//   POST /notify      { key, type, title, body } -> pushes to all subs
//   GET  /latest                                -> last event (for SW)
//   GET  /health                                -> counts
// ============================================================

const CLUB_KEY = 'IMAPIGOINK123'; // speed bump, not a vault — same club password as the site
const MAX_PER_HOUR = 90;           // global send throttle (spam brake)

// SURPRISE MODE: while set, ONLY these players receive pushes. Everyone
// else may subscribe (their devices park dormant) but never gets sent to.
// Set to null to unleash notifications on the whole Order.
const ONLY_PLAYERS = ['Andrew'];
const ALLOWED_TYPES = ['danger_zone', 'tribunal', 'drinks', 'supervisor', 'oracle', 'season', 'organ', 'general'];

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

// ---------- VAPID JWT (ES256 via WebCrypto) ----------
function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function vapidJwt(audience, privateJwk, publicRaw) {
    const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = b64url(new TextEncoder().encode(JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'mailto:andrew@minnesotapb.com'
    })));
    const unsigned = header + '.' + claims;
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
    return unsigned + '.' + b64url(sig);
}

async function sendPush(sub, env) {
    const url = new URL(sub.endpoint);
    const audience = url.origin;
    const jwt = await vapidJwt(audience, JSON.parse(env.VAPID_PRIVATE_JWK), env.VAPID_PUBLIC);
    return fetch(sub.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`,
            'TTL': '3600',
            'Urgency': 'high'
        }
    });
}

// ---------- handlers ----------
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
        const url = new URL(request.url);

        if (url.pathname === '/health') {
            const list = await env.SUBS.list({ prefix: 'sub:' });
            return json({ ok: true, subscribers: list.keys.length });
        }

        // Debug: list subscriptions (player + push-service host only, key-gated)
        if (url.pathname === '/subs') {
            if (url.searchParams.get('key') !== CLUB_KEY) return json({ error: 'the Hog does not know you' }, 403);
            const list = await env.SUBS.list({ prefix: 'sub:' });
            const out = [];
            for (const k of list.keys) {
                const raw = await env.SUBS.get(k.name);
                if (!raw) continue;
                const rec = JSON.parse(raw);
                out.push({
                    player: rec.player,
                    service: new URL(rec.subscription.endpoint).host,
                    created: rec.created || null
                });
            }
            return json(out);
        }

        if (url.pathname === '/latest') {
            const latest = await env.SUBS.get('latest');
            return json(latest ? JSON.parse(latest) : { title: '🐷 THE ROYAL ORDER', body: 'Something happened. Probably.' });
        }

        if (request.method !== 'POST') return json({ error: 'nope' }, 405);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

        if (url.pathname === '/subscribe') {
            const { player, subscription } = body || {};
            if (!subscription || !subscription.endpoint) return json({ error: 'no subscription' }, 400);
            const id = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint)));
            await env.SUBS.put('sub:' + id, JSON.stringify({ player: String(player || '?').slice(0, 20), subscription }));
            return json({ ok: true, id });
        }

        if (url.pathname === '/unsubscribe') {
            const { endpoint } = body || {};
            if (!endpoint) return json({ error: 'no endpoint' }, 400);
            const id = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
            await env.SUBS.delete('sub:' + id);
            return json({ ok: true });
        }

        // Debug: rename subscriptions (fix devices that enrolled before the oath)
        // (body was already parsed by the router above — never re-read a request body)
        if (url.pathname === '/rename') {
            if (body.key !== CLUB_KEY) return json({ error: 'the Hog does not know you' }, 403);
            if (!body.from || !body.player) return json({ error: 'need from + player' }, 400);
            const list = await env.SUBS.list({ prefix: 'sub:' });
            let renamed = 0;
            for (const k of list.keys) {
                const raw = await env.SUBS.get(k.name);
                if (!raw) continue;
                const rec = JSON.parse(raw);
                if (rec.player === body.from) {
                    rec.player = body.player;
                    await env.SUBS.put(k.name, JSON.stringify(rec));
                    renamed++;
                }
            }
            return json({ ok: true, renamed });
        }

        if (url.pathname === '/notify') {
            const { key, type, title, body: msg, exclude } = body || {};
            if (key !== CLUB_KEY) return json({ error: 'the Hog does not know you' }, 403);
            if (!ALLOWED_TYPES.includes(type)) return json({ error: 'unknown event type' }, 400);

            // global hourly throttle
            const hourKey = 'rate:' + new Date().toISOString().slice(0, 13);
            const count = parseInt((await env.SUBS.get(hourKey)) || '0', 10);
            if (count >= MAX_PER_HOUR) return json({ error: 'the Hog is exhausted (rate limit)' }, 429);
            await env.SUBS.put(hourKey, String(count + 1), { expirationTtl: 7200 });

            const event = {
                type,
                title: String(title || '🐷 THE ROYAL ORDER').slice(0, 80),
                body: String(msg || '').slice(0, 160),
                at: Date.now()
            };
            await env.SUBS.put('latest', JSON.stringify(event));

            const list = await env.SUBS.list({ prefix: 'sub:' });
            let sent = 0, dead = 0, skipped = 0;
            for (const k of list.keys) {
                const raw = await env.SUBS.get(k.name);
                if (!raw) continue;
                const rec = JSON.parse(raw);
                if (ONLY_PLAYERS && !ONLY_PLAYERS.includes(rec.player)) { skipped++; continue; } // surprise mode
                if (exclude && rec.player === exclude) continue; // don't buzz the perpetrator
                try {
                    const res = await sendPush(rec.subscription, env);
                    if (res.status === 404 || res.status === 410) { await env.SUBS.delete(k.name); dead++; }
                    else sent++;
                } catch { dead++; }
            }
            return json({ ok: true, sent, dead, skipped });
        }

        return json({ error: 'lost pig' }, 404);
    }
};
