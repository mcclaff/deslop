#!/usr/bin/env node
/*
 * deslop checker. Opens pages in headless Chrome, runs audit.js on each one
 * and reports the AI design tells it finds.
 *
 *   node check.mjs <url | file.html | folder> [more targets] [--json] [--allow FILE] [--max N]
 *
 * A folder is served on 127.0.0.1 and its .html files are checked (25 at most
 * by default). A bare domain such as example.com becomes https://example.com.
 * Allowed tells come from --allow FILE and from a deslop.allow file: the one next to
 * the target folder or file (or in a parent folder), or for a URL without --allow,
 * the one in the current folder (or a parent). These cover every page of the target.
 * A deslop-allow marker in a page covers that page only.
 *
 * Needs Node 22 or newer (built-in WebSocket) and Chrome or Chromium.
 * Set CHROME_PATH to use another browser binary, and DESLOP_CHROME_FLAGS to add
 * flags (for example --no-sandbox in a container that runs as root).
 * Exit code: 0 no tells outside the allowed list, 1 tells remain, 2 error.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = fs.readFileSync(path.join(HERE, 'audit.js'), 'utf8');
const VIEW = { width: 1440, height: 900 };
const SKIP_DIRS = new Set(['node_modules', '.git', '.astro', '.next', '.svelte-kit', '.vercel', '.wrangler', '.cache', 'coverage']);
// Keys that mean the same thing on every page of a site, so they count once.
const SITE_KEY = /^(font:|stat:|ph:|pn:|alpha |grey |shade |opacity )/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};
const USAGE = 'Usage: node check.mjs <url | file.html | folder> [more targets] [--json] [--allow FILE] [--max N]';
const SCROLL = `(async () => {
  const step = Math.max(200, innerHeight * 0.8);
  const end = Math.min(document.documentElement.scrollHeight, 40000);
  for (let y = 0; y < end; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
  scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 250));
  return true;
})()`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '\u2026' : s);

function parseArgs(argv) {
  const o = { targets: [], json: false, allowFile: null, max: 25 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--allow') o.allowFile = argv[++i];
    else if (a === '--max') o.max = parseInt(argv[++i], 10) || 25;
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) { console.error(`Unknown option: ${a}\n${USAGE}`); process.exit(2); }
    else o.targets.push(a);
  }
  return o;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  ];
  return candidates.find(p => p && fs.existsSync(p));
}

async function launchChrome(bin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deslop-chrome-'));
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', `--window-size=${VIEW.width},${VIEW.height}`,
    ...(process.env.DESLOP_CHROME_FLAGS || '').split(/\s+/).filter(Boolean), 'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start within 20 seconds')), 20000);
    proc.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('error', e => { clearTimeout(timer); reject(e); });
    proc.on('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited early (code ${code})`)); });
  });
  return { proc, wsUrl, dir };
}

// A small Chrome DevTools Protocol client over Node's built-in WebSocket.
class CDP {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('Could not connect to Chrome'));
    });
    return new CDP(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  waitFor(method, sessionId, timeout) {
    return new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); this.listeners.delete(listener); };
      const timer = setTimeout(() => { done(); reject(new Error(`timed out waiting for ${method}`)); }, timeout);
      const listener = msg => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) { done(); resolve(msg.params); }
      };
      this.listeners.add(listener);
    });
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page script failed: ' + ((d.exception && d.exception.description) || d.text));
  }
  return r.result.value;
}

async function auditPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 1, mobile: false });
    const loaded = cdp.waitFor('Page.loadEventFired', sessionId, 45000);
    const nav = await send('Page.navigate', { url });
    if (nav.errorText) throw new Error(nav.errorText);
    await loaded;
    await sleep(800);
    await evaluate(send, 'document.fonts ? document.fonts.ready.then(() => true) : true');
    await evaluate(send, SCROLL);
    return await evaluate(send, `${AUDIT}\n;window.__deslop.run()`);
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

function serveDir(root) {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    for (const f of [file, path.join(file, 'index.html'), file + '.html']) {
      try {
        if (fs.statSync(f).isFile()) {
          res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
          fs.createReadStream(f).pipe(res);
          return;
        }
      } catch { /* try the next form */ }
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function listHtml(dir, max) {
  const found = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(d, e.name)); }
      else if (/\.html?$/i.test(e.name)) found.push(path.join(d, e.name));
    }
  };
  walk(dir);
  const depth = f => path.relative(dir, f).split(path.sep).length;
  return found.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b)).slice(0, max);
}

function readAllowFile(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:deslop-allow\s+)?([a-z0-9][a-z0-9 ,-]*?)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    for (const rule of m[1].split(',').map(x => x.trim()).filter(Boolean)) out.push({ rule, reason: m[2], source: file });
  }
  return out;
}

function findAllowFile(start) {
  const home = os.homedir();
  for (let d = start; ; d = path.dirname(d)) {
    const f = path.join(d, 'deslop.allow');
    if (fs.existsSync(f)) return f;
    if (d === home || path.dirname(d) === d) return null;
  }
}

async function planTarget(t, opts, servers) {
  const extra = opts.allowFile ? readAllowFile(opts.allowFile) : [];
  const urlAllow = () => {
    if (opts.allowFile) return { allow: extra, allowFiles: [opts.allowFile] };
    const f = findAllowFile(process.cwd());
    return { allow: f ? readAllowFile(f) : [], allowFiles: f ? [f] : [] };
  };
  if (/^https?:\/\//i.test(t)) return { label: t, pages: [{ label: t, url: t }], ...urlAllow() };
  const p = path.resolve(t);
  if (fs.existsSync(p)) {
    const isDir = fs.statSync(p).isDirectory();
    const root = isDir ? p : path.dirname(p);
    const allowFile = findAllowFile(root);
    const allow = extra.concat(allowFile ? readAllowFile(allowFile) : []);
    const allowFiles = [opts.allowFile, allowFile].filter(Boolean);
    if (!isDir && !/\.html?$/i.test(p)) {
      return { label: t, pages: [], allow, allowFiles, error: 'Not an HTML file. Build the page or start its dev server, then pass the URL or the built .html file.' };
    }
    const files = isDir ? listHtml(p, opts.max) : [p];
    if (!files.length) return { label: t, pages: [], allow, allowFiles, error: 'No .html files found.' };
    const server = await serveDir(root);
    servers.push(server);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const pages = files.map(f => {
      const rel = path.relative(root, f);
      return { label: rel, url: `${origin}/${rel.split(path.sep).map(encodeURIComponent).join('/')}` };
    });
    return { label: t, pages, allow, allowFiles };
  }
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) {
    const url = `https://${t}`;
    return { label: url, pages: [{ label: url, url }], ...urlAllow() };
  }
  return { label: t, pages: [], allow: extra, error: 'Not a URL, an .html file or a folder.' };
}

function summarize(plan, pages) {
  const errors = plan.error ? [plan.error] : [];
  const ok = [];
  for (const p of pages) {
    if (p.error) errors.push(`${p.label}: ${p.error}`);
    else if (p.result.status && p.result.status >= 400) errors.push(`${p.label}: HTTP ${p.result.status}, skipped`);
    else ok.push(p);
  }
  const rules = ok.length ? ok[0].result.rules : [];
  // An allow file covers every page of the target. A marker in a page covers that page only.
  const targetAllow = new Map();
  for (const a of plan.allow) if (!targetAllow.has(a.rule)) targetAllow.set(a.rule, a);
  const known = new Set(rules.map(r => r[0]));
  const named = new Set([...targetAllow.keys(), ...ok.flatMap(p => p.result.allow.map(a => a.rule))]);
  for (const id of named) if (known.size && !known.has(id)) errors.push(`deslop-allow names an unknown rule: ${id}`);

  const multi = ok.length > 1;
  // Per rule: the finding keys and evidence, kept apart for found and allowed findings.
  const found = new Map(), allowed = new Map(), reasons = new Map();
  const entry = (m, id) => {
    if (!m.has(id)) m.set(id, { keys: new Set(), evidence: [] });
    return m.get(id);
  };
  for (const p of ok) {
    const pageAllow = new Map();
    for (const a of p.result.allow) if (!pageAllow.has(a.rule)) pageAllow.set(a.rule, a);
    for (const f of p.result.findings) {
      const siteWide = SITE_KEY.test(f.key);
      const by = targetAllow.get(f.rule) || pageAllow.get(f.rule);
      if (by && !reasons.has(f.rule)) reasons.set(f.rule, by);
      const e = entry(by ? allowed : found, f.rule);
      e.keys.add(siteWide ? f.key : `${p.label}|${f.key}`);
      const text = (multi && !siteWide ? `${p.label}: ` : '') + f.evidence;
      if (!e.evidence.includes(text)) e.evidence.push(text);
    }
  }

  const out = { target: plan.label, pages: ok.length, allowFiles: plan.allowFiles || [], errors, tells: [], allowed: [], watch: [] };
  for (const [id, group, level, min] of rules) {
    const f = found.get(id), a = allowed.get(id);
    const count = f ? f.keys.size : 0, allowedCount = a ? a.keys.size : 0;
    if (count + allowedCount < min) continue;
    if (allowedCount) {
      const r = reasons.get(id);
      out.allowed.push({ id, group, count: allowedCount, evidence: a.evidence.slice(0, 6), reason: r.reason, source: r.source });
    }
    if (count >= min) (level === 'tell' ? out.tells : out.watch).push({ id, group, count, evidence: f.evidence.slice(0, 6) });
  }
  return out;
}

function printReport(r) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const row = t => `  ${t.id.padEnd(18)} ${String(t.count).padStart(3)}  ${t.evidence.slice(0, 3).map(e => clip(e, 64)).join(' \u00B7 ')}${t.count > 3 ? ' \u00B7 \u2026' : ''}`;
  const lines = [`deslop \u00B7 ${r.target} \u00B7 ${plural(r.pages, 'page')} at ${VIEW.width}\u00D7${VIEW.height}`];
  for (const f of r.allowFiles) lines.push(`  allow file: ${f}`);
  for (const e of r.errors) lines.push(`  error: ${e}`);
  lines.push(`${plural(r.tells.length, 'tell')} \u00B7 ${r.allowed.length} allowed \u00B7 ${r.watch.length} on the watch list`);
  let group = '';
  for (const t of r.tells) {
    if (t.group !== group) { group = t.group; lines.push('', group); }
    lines.push(row(t));
  }
  if (r.allowed.length) {
    lines.push('', 'Allowed');
    for (const a of r.allowed) lines.push(`  ${a.id.padEnd(18)} ${String(a.count).padStart(3)}  ${a.reason} (${a.source})`);
  }
  if (r.watch.length) {
    lines.push('', 'Watch list');
    for (const w of r.watch) lines.push(row(w));
  }
  const verdict = !r.pages ? 'Nothing checked.' : r.tells.length ? 'Remove each tell, or keep it with a deslop-allow reason.' : 'No tells outside the allowed list.';
  lines.push('', verdict, '');
  console.log(lines.join('\n'));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.targets.length) { console.error(USAGE); process.exit(2); }
  if (typeof WebSocket !== 'function') { console.error('The checker needs Node 22 or newer (built-in WebSocket).'); process.exit(2); }
  const bin = findChrome();
  if (!bin) {
    console.error('Chrome not found. Install Chrome or set CHROME_PATH.\nOr paste scripts/audit.js into the DevTools console and run: await __deslop.report()');
    process.exit(2);
  }

  const chrome = await launchChrome(bin);
  const servers = [];
  const reports = [];
  let cdp;
  const cleanup = () => {
    if (cdp) cdp.close();
    chrome.proc.kill('SIGTERM');
    for (const s of servers) s.close();
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  try {
    cdp = await CDP.connect(chrome.wsUrl);
    for (const t of opts.targets) {
      const plan = await planTarget(t, opts, servers);
      const pages = [];
      for (const pg of plan.pages) {
        try { pages.push({ label: pg.label, result: await auditPage(cdp, pg.url) }); }
        catch (e) { pages.push({ label: pg.label, error: e.message }); }
      }
      reports.push(summarize(plan, pages));
    }
  } finally {
    cleanup();
    await sleep(300);
    try { fs.rmSync(chrome.dir, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
  }

  if (opts.json) {
    console.log(JSON.stringify({ viewport: VIEW, targets: reports }, null, 2));
  } else {
    for (const r of reports) printReport(r);
    if (reports.length > 1) {
      const w = Math.max(6, ...reports.map(r => r.target.length));
      console.log('Summary');
      console.log(`  ${'target'.padEnd(w)}  tells  allowed  watch`);
      for (const r of reports) {
        console.log(`  ${r.target.padEnd(w)}  ${String(r.tells.length).padStart(5)}  ${String(r.allowed.length).padStart(7)}  ${String(r.watch.length).padStart(5)}${r.errors.length ? '  (see errors)' : ''}`);
      }
    }
  }
  const failed = reports.some(r => r.errors.length && !r.pages);
  const code = failed ? 2 : reports.some(r => r.tells.length) ? 1 : 0;
  // Exit only after stdout drains, or a piped report gets cut off.
  process.stdout.write('', () => process.exit(code));
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
