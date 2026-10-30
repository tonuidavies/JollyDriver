/**
 * Dev-only API relay for networks where the emulator can't reach the API
 * directly (e.g. an HTTPS-inspecting corporate proxy the emulator doesn't trust).
 *
 * The emulator talks plain HTTP to this relay over `adb reverse`; the relay
 * forwards to the real API from the Mac, which already trusts the proxy.
 *
 *   node --use-system-ca scripts/api-relay.mjs      # honours HTTPS_PROXY; system CAs trust the proxy
 *   adb reverse tcp:8787 tcp:8787
 *   EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 npx expo start --android
 */
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { fetch, EnvHttpProxyAgent } from 'undici';

const dispatcher = new EnvHttpProxyAgent();

// SHAPES_FILE=/path.json records each endpoint's response *shape* (keys + types,
// never values) — handy for pinning field names the API docs don't describe.
const SHAPES_FILE = process.env.SHAPES_FILE;
const shapes = {};
const shapeOf = (v, depth = 0) => {
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0], depth + 1)] : [];
  if (v && typeof v === 'object') {
    if (depth > 6) return '{…}';
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shapeOf(x, depth + 1)]));
  }
  return v === null ? 'null' : typeof v;
};
const recordShape = (path, text) => {
  if (!SHAPES_FILE) return;
  try {
    const json = JSON.parse(text);
    shapes[path] = shapeOf(json);
    // table reports: keep every column label and every cell key (still no values)
    const d = json?.data;
    if (Array.isArray(d?.columns)) shapes[path].columnLabels = d.columns.map((c) => c?.label);
    if (Array.isArray(d?.rows?.[0])) shapes[path].cellKeys = [...new Set(d.rows[0].flatMap((c) => Object.keys(c ?? {})))];
    if (Array.isArray(d?.summary)) shapes[path].summaryLabels = d.summary.map((s) => s?.label);
    writeFileSync(SHAPES_FILE, JSON.stringify(shapes, null, 1));
  } catch {
    /* non-JSON — nothing to record */
  }
};

const TARGET = (process.env.API_TARGET || 'https://api.jolly.kovacpay.com').replace(/\/$/, '');
const PORT = Number(process.env.RELAY_PORT || 8787);
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding', 'keep-alive']);

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !HOP.has(k)));
    const started = Date.now();
    try {
      const r = await fetch(TARGET + req.url, { method: req.method, headers, body, redirect: 'manual', dispatcher });
      const out = Buffer.from(await r.arrayBuffer());
      const resHeaders = {};
      r.headers.forEach((v, k) => {
        if (!HOP.has(k) && k !== 'content-encoding') resHeaders[k] = v;
      });
      res.writeHead(r.status, resHeaders);
      res.end(out);
      if (req.method === 'GET' && r.ok) recordShape(req.url.split('?')[0], out.toString('utf8'));
      // path + status only — never bodies (they carry tokens and passwords)
      console.log(`${req.method} ${req.url.split('?')[0]} → ${r.status} (${Date.now() - started}ms)`);
    } catch (e) {
      console.error(`${req.method} ${req.url.split('?')[0]} ✗ ${e.cause?.code || e.message}`);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 1, message: `Relay could not reach ${TARGET}: ${e.cause?.code || e.message}` }));
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`API relay http://127.0.0.1:${PORT} → ${TARGET}`));
