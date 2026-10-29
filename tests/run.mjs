#!/usr/bin/env node
// Checks the deslop checker against pages with known tells.
// Run: node tests/run.mjs (needs Node 22+ and Chrome, like the checker).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.join(HERE, '..', 'scripts', 'check.mjs');
const fixture = name => path.join(HERE, 'fixtures', name);

const TELLS = [
  'tags', 'eyebrows', 'section-numbers', 'code-breadcrumbs', 'all-caps',
  'trend-serif', 'tight-tracking', 'italic-accent', 'mono', 'giant-hero',
  'dividers', 'bordered-boxes', 'tints',
  'fake-ui', 'diagrams', 'wall-of-text',
  'gradients', 'glow', 'glass',
  'icon-tiles', 'emoji',
  'two-button-hero', 'three-up', 'bento', 'logo-strip',
  'made-up-stats', 'placeholder-proof',
];
const WATCH = ['watch-font', 'arrow-links', 'meta-dots', 'centred', 'rounded-everywhere', 'accent-rail', 'fade-up', 'persona-names'];

// tells: must be found. allowed: must be allowed and not found. allowedToo: must be allowed (and may also be found).
// exact: nothing else may be found (and, with watch, nothing else on the watch list).
const cases = [
  { file: 'slop.html', tells: TELLS, watch: WATCH },
  { file: 'plain.html', tells: [], watch: [], exact: true },
  { file: 'false-alarms.html', tells: [], watch: [], exact: true },
  { file: 'allowed.html', tells: [], allowed: ['dividers'], exact: true },
  { file: 'allow-file/index.html', tells: [], allowed: ['dividers', 'all-caps'], exact: true },
  // A marker in a.html allows its emoji; b.html has no marker, so its emoji is still a tell.
  { file: 'scoped-markers', tells: ['emoji'], allowedToo: ['emoji'], exact: true },
];

let failed = 0;
const expect = (ok, message) => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${message}`);
  if (!ok) failed++;
};

function verify(c, r) {
  const ids = list => list.map(t => t.id);
  const tells = ids(r.tells), allowed = ids(r.allowed), watch = ids(r.watch);
  expect(!r.errors.length, `${c.file}: no errors${r.errors.length ? ` (${r.errors.join('; ')})` : ''}`);
  for (const id of c.tells) expect(tells.includes(id), `${c.file}: finds ${id}`);
  for (const id of c.watch || []) expect(watch.includes(id), `${c.file}: watches ${id}`);
  for (const id of c.allowed || []) expect(allowed.includes(id) && !tells.includes(id), `${c.file}: allows ${id}`);
  for (const id of c.allowedToo || []) expect(allowed.includes(id), `${c.file}: allows ${id} where a marker says so`);
  if (c.exact) {
    const extra = tells.filter(id => !c.tells.includes(id));
    expect(!extra.length, `${c.file}: no other tells${extra.length ? ` (found ${extra.join(', ')})` : ''}`);
    if (c.watch) {
      const extraWatch = watch.filter(id => !c.watch.includes(id));
      expect(!extraWatch.length, `${c.file}: nothing else on the watch list${extraWatch.length ? ` (found ${extraWatch.join(', ')})` : ''}`);
    }
  }
}

const run = spawnSync(process.execPath, [CHECK, '--json', ...cases.map(c => fixture(c.file))], { encoding: 'utf8' });
if (run.status === 2 || !run.stdout) {
  console.error(run.stderr || 'The checker failed to run.');
  process.exit(1);
}
const { targets } = JSON.parse(run.stdout);
cases.forEach((c, i) => verify(c, targets[i]));

// A URL target reads the deslop.allow file of the folder the checker runs in.
const page = fs.readFileSync(fixture('allow-file/index.html'));
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const out = await new Promise(resolve => {
  const child = spawn(process.execPath, [CHECK, '--json', url], { cwd: fixture('allow-file') });
  let stdout = '';
  child.stdout.on('data', d => { stdout += d; });
  child.on('close', status => resolve({ status, stdout }));
});
server.close();
if (out.status === 2 || !out.stdout) {
  expect(false, 'URL target: the checker ran');
} else {
  const r = JSON.parse(out.stdout).targets[0];
  verify({ file: 'URL target with ./deslop.allow', tells: [], allowed: ['dividers', 'all-caps'], exact: true }, r);
  expect(r.allowFiles.some(f => f.endsWith(path.join('allow-file', 'deslop.allow'))), 'URL target: names the allow file it read');
}

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
