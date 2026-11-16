// Insight Pest Solutions call back lead capture. QR -> / (form) -> POST /api/lead -> leads.jsonl + Insight Tracker webhook.
import { createServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { join, extname, normalize } from 'node:path';

const root = join(import.meta.dirname, 'public');
const dataDir = process.env.DATA_DIR || join(import.meta.dirname, 'data');
const leadsFile = join(dataDir, 'leads.jsonl');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp' };

export function resolvePath(url) {
  let p; try { p = decodeURIComponent(new URL(url, 'http://x').pathname); } catch { return null; } // bad % escapes would crash the process
  if (p.endsWith('/')) p += 'index.html';
  if (!extname(p)) p += '.html';
  const full = normalize(join(root, p));
  return full.startsWith(root) ? full : null;
}

const hits = new Map(); // ponytail: in-memory per-IP limiter, resets on restart; fine for one instance
export function limited(key, max, ms, now = Date.now()) {
  const h = (hits.get(key) || []).filter((t) => now - t < ms);
  h.push(now); hits.set(key, h);
  return h.length > max;
}
const ip = (req) => { const x = (req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean); return x.at(-1) || req.socket.remoteAddress; };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i;
const PESTS = ['termites', 'rats-mice', 'cockroaches', 'spiders', 'ants', 'wasps', 'silverfish', 'other'];

// AU mobile or landline: 04xx xxx xxx, +61 4xx..., 02 xxxx xxxx etc. Stored as typed, digits checked.
export function cleanLead(b) {
  const lead = { name: clip(b.name, 80), phone: clip(b.phone, 20), email: clip(b.email, 120), suburb: clip(b.suburb, 60), pests: [], source: clip(b.src || 'qr', 30), rep: clip(b.rep, 30) };
  if (!lead.name) return { error: 'Please add your name.' };
  const d = lead.phone.replace(/[\s()-]/g, '').replace(/^\+61/, '0');
  if (!/^0[2-478]\d{8}$/.test(d)) return { error: 'Please add an Australian phone number, like 0412 345 678.' };
  if (!EMAIL.test(lead.email)) return { error: 'Please add a valid email.' };
  if (!lead.suburb) return { error: 'Please add your suburb or postcode.' };
  lead.pests = (Array.isArray(b.pests) ? b.pests : []).filter((p) => PESTS.includes(p));
  return { lead };
}

// Forward to Insight Tracker. Tech team sets TRACKER_WEBHOOK_URL (+ optional TRACKER_WEBHOOK_SECRET).
// Lead is always saved locally first, so a webhook outage never loses one.
async function forward(rec) {
  const url = process.env.TRACKER_WEBHOOK_URL;
  if (!url) return 'not-configured';
  try {
    const r = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', ...(process.env.TRACKER_WEBHOOK_SECRET ? { 'X-Insight-Secret': process.env.TRACKER_WEBHOOK_SECRET } : {}) },
      body: JSON.stringify(rec),
    });
    return r.ok ? 'sent' : 'failed-' + r.status;
  } catch (e) { console.error('forward', e.message); return 'failed'; }
}

async function body(req, cap = 16384) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > cap) throw new Error('too big'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

const pwHash = (p) => createHash('sha256').update(String(p)).digest();
const authed = (req) => {
  const pw = process.env.LEADS_PASSWORD; if (!pw) return false;
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)il=([a-f0-9]{64})/);
  return !!m && timingSafeEqual(Buffer.from(m[1], 'hex'), pwHash('cookie:' + pw));
};

async function readLeads() {
  const raw = await readFile(leadsFile, 'utf8').catch(() => '');
  // A lead line is followed later by a short { id, tracker } line once the webhook answers; merge them.
  const byId = new Map();
  for (const l of raw.split('\n')) {
    let r; try { r = l && JSON.parse(l); } catch {}
    if (!r) continue;
    if (r.name === undefined && byId.has(r.id)) Object.assign(byId.get(r.id), r); else byId.set(r.id, r);
  }
  return [...byId.values()].reverse();
}

const shell = (title, inner, w = 640) => `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><link rel="stylesheet" href="/leads.css"></head><body><main class="wrap" style="max-width:${w}px">${inner}</main></body></html>`;
const loginPage = (msg = '') => shell('Insight leads', `<form class="card" method="post" action="/leads" style="margin-top:12vh"><h1 style="font-size:24px">Insight leads</h1>${msg ? `<p class="mute">${esc(msg)}</p>` : ''}<div class="field"><label for="pw">Password</label><input id="pw" name="pw" type="password" autocomplete="current-password" required autofocus></div><button class="btn">Open</button></form>`, 420);

function leadsPage(leads) {
  const when = (t) => new Date(t).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' });
  const rows = leads.map((l) => `<article class="card" style="gap:6px;padding:18px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong style="font-size:17px">${esc(l.name)}</strong><span class="mute" style="font-size:13px">${esc(when(l.at))}</span></div><div>${esc(l.phone)} &middot; ${esc(l.email)}</div><div class="mute">${esc(l.suburb)}${l.pests?.length ? ' &middot; ' + esc(l.pests.join(', ')) : ''}</div><div class="mute" style="font-size:12px">Source ${esc(l.source)}${l.rep ? ' &middot; Rep ' + esc(l.rep) : ''} &middot; Tracker ${esc(l.tracker)}</div><div style="display:flex;gap:8px;margin-top:4px"><a class="btn sm" href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">Call</a><a class="btn sm ghost" href="mailto:${esc(encodeURIComponent(l.email))}">Email</a></div></article>`).join('');
  return shell('Insight leads', `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h1 style="font-size:26px">Leads <span class="mute">${leads.length}</span></h1><a class="btn sm ghost" href="/leads.csv">Download CSV</a></div>${rows || '<p class="mute">No leads yet.</p>'}<script>setTimeout(()=>location.reload(),30000)</script>`);
}

const csvCell = (v) => { let s = Array.isArray(v) ? v.join(' ') : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };

async function routes(req, res, head) {
  const path = new URL(req.url, 'http://x').pathname;
  const html = { ...head, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' };
  const json = { ...head, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (path === '/api/lead' && req.method === 'POST') {
    if (limited('lead:' + ip(req), 20, 600000)) return res.writeHead(429, json).end('{"error":"Too many requests from this network. Try mobile data."}'), true;
    let b; try { b = JSON.parse(await body(req)); } catch { return res.writeHead(400, json).end('{"error":"Bad request"}'), true; }
    if (b?.website) return res.writeHead(200, json).end('{"ok":true}'), true; // honeypot
    const { lead, error } = cleanLead(b || {});
    if (error) return res.writeHead(400, json).end(JSON.stringify({ error })), true;
    const rec = { id: randomUUID(), at: new Date().toISOString(), type: 'callback', consent: 'callback-v1', ...lead };
    // Save first, answer the customer, then send to Insight Tracker. A crash mid-send leaves the lead as "pending", never lost.
    await mkdir(dataDir, { recursive: true });
    await appendFile(leadsFile, JSON.stringify({ ...rec, tracker: 'pending' }) + '\n');
    res.writeHead(200, json).end('{"ok":true}');
    const tracker = await forward(rec);
    await appendFile(leadsFile, JSON.stringify({ id: rec.id, tracker }) + '\n').catch((e) => console.error('tracker status', e.message));
    return true;
  }
  if (path === '/leads' && req.method === 'POST') {
    if (limited('login:' + ip(req), 8, 900000)) return res.writeHead(429, html).end(loginPage('Too many tries. Wait 15 minutes.')), true;
    let pw = ''; try { pw = new URLSearchParams(await body(req, 2048)).get('pw') || ''; } catch {}
    const real = process.env.LEADS_PASSWORD;
    if (!real || !timingSafeEqual(pwHash(pw), pwHash(real))) return res.writeHead(401, html).end(loginPage('Wrong password.')), true;
    return res.writeHead(303, { ...head, 'Set-Cookie': `il=${pwHash('cookie:' + real).toString('hex')}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`, Location: '/leads' }).end(), true;
  }
  if (path === '/leads') return res.writeHead(authed(req) ? 200 : 401, html).end(authed(req) ? leadsPage(await readLeads()) : loginPage()), true;
  if (path === '/leads.csv') {
    if (!authed(req)) return res.writeHead(401, html).end(loginPage()), true;
    const cols = ['at', 'name', 'phone', 'email', 'suburb', 'pests', 'source', 'rep', 'tracker'];
    const csv = [cols.join(','), ...(await readLeads()).map((l) => cols.map((c) => csvCell(l[c])).join(','))].join('\r\n');
    return res.writeHead(200, { ...head, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="insight-leads.csv"', 'Cache-Control': 'no-store' }).end(csv), true;
  }
  return false;
}

const server = createServer(async (req, res) => {
  const head = { 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
  if (req.url === '/health') { res.writeHead(200, head).end('ok'); return; }
  if (await routes(req, res, head).catch((e) => { console.error(e); res.writeHead(500, head).end('error'); return true; })) return;
  const file = resolvePath(req.url);
  try {
    if (!file) throw 0;
    const buf = await readFile(file);
    res.writeHead(200, { ...head, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(buf);
  } catch {
    res.writeHead(404, { ...head, 'Content-Type': 'text/plain' }).end('Not found');
  }
});

if (process.argv[1] === import.meta.filename) server.listen(process.env.PORT || 8093, () => console.log('insight quote on', process.env.PORT || 8093));
