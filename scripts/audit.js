/*
 * deslop audit: find AI design tells in a rendered page.
 *
 * Run it inside a page, then call: await window.__deslop.run()
 * scripts/check.mjs does this in headless Chrome at 1440x900.
 * You can also paste this file into the DevTools console and run:
 *   await __deslop.report()
 *
 * run() returns { url, title, status, viewport, rules, findings, allow }.
 * Each finding is { rule, evidence, key }. A report counts the unique keys
 * per rule and lists the rule only when the count reaches its minimum.
 *
 * Keep this file free of em dashes. Write them as \u2014 in patterns.
 */
(() => {
  'use strict';

  // [id, group, level, minimum count]
  const RULES = [
    ['tags', 'Labels nobody needs', 'tell', 1],
    ['eyebrows', 'Labels nobody needs', 'tell', 1],
    ['section-numbers', 'Labels nobody needs', 'tell', 2],
    ['code-breadcrumbs', 'Labels nobody needs', 'tell', 1],
    ['all-caps', 'Labels nobody needs', 'tell', 1],
    ['trend-serif', 'Type tricks', 'tell', 1],
    ['tight-tracking', 'Type tricks', 'tell', 1],
    ['italic-accent', 'Type tricks', 'tell', 1],
    ['mono', 'Type tricks', 'tell', 1],
    ['giant-hero', 'Type tricks', 'tell', 1],
    ['dividers', 'Lines, boxes and tints', 'tell', 3],
    ['bordered-boxes', 'Lines, boxes and tints', 'tell', 2],
    ['tints', 'Lines, boxes and tints', 'tell', 5],
    ['fake-ui', 'Too much', 'tell', 1],
    ['diagrams', 'Too much', 'tell', 1],
    ['wall-of-text', 'Too much', 'tell', 1],
    ['gradients', 'Gradients and glow', 'tell', 1],
    ['glow', 'Gradients and glow', 'tell', 1],
    ['glass', 'Gradients and glow', 'tell', 1],
    ['icon-tiles', 'Icon decoration', 'tell', 3],
    ['emoji', 'Icon decoration', 'tell', 1],
    ['two-button-hero', 'Template layouts', 'tell', 1],
    ['three-up', 'Template layouts', 'tell', 1],
    ['bento', 'Template layouts', 'tell', 1],
    ['logo-strip', 'Template layouts', 'tell', 1],
    ['made-up-stats', 'Made-up proof', 'tell', 2],
    ['placeholder-proof', 'Made-up proof', 'tell', 1],
    ['watch-font', 'Watch list', 'watch', 1],
    ['arrow-links', 'Watch list', 'watch', 2],
    ['meta-dots', 'Watch list', 'watch', 3],
    ['centred', 'Watch list', 'watch', 1],
    ['rounded-everywhere', 'Watch list', 'watch', 1],
    ['accent-rail', 'Watch list', 'watch', 1],
    ['fade-up', 'Watch list', 'watch', 2],
    ['stock-palette', 'Watch list', 'watch', 1],
    ['persona-names', 'Watch list', 'watch', 1],
  ];

  const MONTHS = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';
  const DATE_RE = new RegExp('\\b(?:\\d{1,2}\\s+' + MONTHS + '[a-z]*\\.?(?:\\s+\\d{2,4})?|' + MONTHS + '[a-z]*\\.?\\s+\\d{1,2}(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})\\b', 'i');
  const MONTH_START = new RegExp('^\\s*' + MONTHS + '\\b', 'i');
  const SEC_HEAD = /^(?:\u00A7\s*\d{1,3}|\[0\d{1,2}\]|\(0\d{1,2}\)|no\.\s*0\d|0\d{1,2})/i;
  const SEP = '[\\/.\\u00b7:|\\u2014\\u2013-]';
  const SEP_DIGIT = new RegExp('^\\s*' + SEP + '\\s*\\d');
  const SEP_START = new RegExp('^\\s*' + SEP);
  const CRUMB_RE = /^(?:~\/[\w./-]*|\.\/[\w./-]+|\/(?:[\w-]+\/)+[\w-]*|\/\/\s*\p{L}[\p{L}\p{N} _-]*|<\/?[A-Za-z][\w.-]*(?:\s[^>]*)?\/?>|\$\s+[a-z][\w-]*.*|[\w-]+\.(?:tsx?|jsx?|mjs|py|mdx?|json|css|html|astro|sh|rs|go|ya?ml|toml)|[a-z_]\w*\(\)\s*;?|\{\s*[\w.]+\s*\}|\[\s*\p{L}[\p{L} _-]*\s*\])$/u;
  const STAT_RE = /^[<>~\u2248]?\s?\d[\d,.]*(?:\s?(?:x|X|\u00D7|%)|\+|[kKMB]\+?|\/7|\/5|\u2605)$/;
  const TAG_TOKENS = /(^|[\s_-])(tag|tags|pill|pills|chip|chips|badge|badges)(?=$|[\s_-])/i;
  const EYEBROW_TOKENS = /(^|[\s_-])(eyebrow|kicker|overline|pretitle|pre-title|preheading|superhead|supertitle|label)(?=$|[\s_-])/i;
  const FAKE_TOKENS = /(^|[\s_-])(mockup|mock-up|browser-frame|browser-chrome|window-chrome|device-frame|app-preview|dashboard-preview|ui-preview|screen-mock|fake-ui)(?=$|[\s_-])/i;
  const GLOW_TOKENS = /(^|[\s_-])(glow|blob|orb|aurora|halo|spotlight)(?=$|[\s_-])/i;
  const FADE_TOKENS = /(^|[\s_-])(fade|fade-up|fade-in|fade-in-up|reveal|aos|animate-in|slide-up|scroll-reveal)(?=$|[\s_-])/i;
  const DIAGRAM_TOKENS = /(^|[\s_-])(diagram|flowchart|flow-chart)(?=$|[\s_-])/i;
  const MERMAID_ROLE = /^(flowchart|sequence|state|class|er|gantt|mindmap|journey|timeline|requirement|c4|block|architecture)/i;
  const MONO_RE = /\bmono\b|monospace|menlo|monaco|consolas|courier|sfmono|sf mono|fira code|source code pro|inconsolata|cascadia/;
  const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu;
  const LOGO_RE = /\b(?:trusted by|used by (?:teams|companies|people|the)|loved by|as seen (?:in|on)|as featured (?:in|on)|featured in|backed by|powering (?:teams|companies)|teams at|companies like|join(?:ed)? (?:over |more than )?[\d,.]+\s?[km]?\+?\s+(?:teams|companies|founders|customers|developers|people|users|businesses|creators))\b/i;
  const PLACEHOLDER_RE = /\b(?:lorem ipsum|dolor sit amet|consectetur adipiscing|john doe|jane doe|john smith|jane smith|acme(?: corp| inc| co)?|globex|initech|umbrella corp(?:oration)?|stark industries|wayne enterprises|hooli|pied piper|contoso|fabrikam|northwind traders|example (?:corp|inc|company)|techcorp)\b/gi;
  // Form-field placeholders count only in title case: "sell your company" is prose.
  const PLACEHOLDER_CASED_RE = /\b(?:Your Company|Company Name|Your Name Here)\b/g;
  const PERSONA_RE = /\b(?:sarah chen|alex rivera|marcus (?:johnson|chen)|emily (?:zhang|chen|rodriguez)|david (?:kim|chen)|priya (?:patel|sharma)|michael chen|jessica (?:lee|park)|maya (?:patel|chen)|james (?:wilson|park)|emma (?:thompson|wilson)|olivia (?:martinez|chen)|daniel (?:kim|park)|sophia (?:chen|martinez)|ryan (?:chen|park))\b/gi;
  const ARROW_END = /(?:\u2192|\u2197|\u2198|\u203A|\u00BB|\u27F6|\u279C|\u2794|->)$/;
  const META_SPLIT = /\s[\u00B7\u2022]\s/;
  const WATCH_FONTS = new Set([
    'inter', 'inter tight', 'inter display', 'space grotesk', 'geist', 'manrope', 'dm sans',
    'plus jakarta sans', 'satoshi', 'general sans', 'cal sans', 'outfit', 'sora', 'urbanist',
    'bricolage grotesque', 'syne', 'fraunces', 'playfair display', 'playfair', 'dm serif display',
    'cormorant', 'cormorant garamond', 'newsreader', 'gloock', 'young serif', 'editorial new',
    'pp editorial new', 'libre caslon display',
  ]);
  const ALLOW_RE = /deslop-allow\s+([a-z0-9][a-z0-9 ,-]*?)\s*:\s*([^\n]*?)\s*(?:-->|\*\/|$)/gim;
  const NO_BOX = /^(a|button|input|select|textarea|label|option|td|th|tr|thead|tbody|tfoot|table|caption|img|svg|video|iframe|canvas|code|pre|kbd|samp|picture|hr|br|fieldset|legend|summary)$/;

  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const style = (el, pseudo) => getComputedStyle(el, pseudo || null);
  const squash = s => String(s || '').replace(/\s+/g, ' ').trim();
  const clip = (s, n) => { s = squash(s); n = n || 40; return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; };
  const wordCount = s => (String(s || '').match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019.&-]*/gu) || []).length;
  const classOf = el => (el.getAttribute && el.getAttribute('class')) || '';
  const firstFamily = ff => squash(String(ff || '').split(',')[0]).replace(/^["']|["']$/g, '').toLowerCase();
  const inCode = el => !!el.closest('pre, code, kbd, samp, tt, var, textarea');
  const ids = new WeakMap();
  let nextId = 0;
  const idOf = el => { if (!ids.has(el)) ids.set(el, 'e' + (++nextId)); return ids.get(el); };

  function describe(el) {
    let d = el.localName;
    if (el.id) d += '#' + el.id;
    const cls = classOf(el).split(/\s+/).filter(c => c && c.length < 28 && !/^(astro-|svelte-|css-|sc-|jsx-|_)/.test(c)).slice(0, 2);
    return cls.length ? d + '.' + cls.join('.') : d;
  }
  const said = (el, n) => '"' + clip(el.innerText || el.textContent, n || 28) + '"';

  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return squash(t);
  }

  function isRendered(el) {
    if (!el.getClientRects || !el.getClientRects().length) return false;
    const s = style(el);
    if (s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    const r = el.getBoundingClientRect();
    // A 1px rule counts. A 1x1 screen-reader box does not.
    return (r.width >= 2 && r.height >= 1) || (r.height >= 2 && r.width >= 1);
  }

  // Colours: read rgb() and rgba() directly, anything else through a 1x1 canvas.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colours = new Map();
  function rgba(str) {
    if (!str) return null;
    if (colours.has(str)) return colours.get(str);
    let out = null;
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(str);
    if (m) out = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4]];
    else if (str === 'transparent') out = [0, 0, 0, 0];
    else if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#010203';
      ctx.fillStyle = str;
      if (ctx.fillStyle !== '#010203') {
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], Math.round((d[3] / 255) * 100) / 100];
      }
    }
    colours.set(str, out);
    return out;
  }

  function hsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // Width of a visible border side, or 0.
  function side(s, k) {
    const w = parseFloat(s['border' + k + 'Width']) || 0;
    const kind = s['border' + k + 'Style'];
    if (w < 0.5 || kind === 'none' || kind === 'hidden') return 0;
    const c = rgba(s['border' + k + 'Color']);
    return c && c[3] > 0.05 ? w : 0;
  }

  function splitTop(str, sep) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function shadows(str) {
    if (!str || str === 'none') return [];
    return splitTop(str, ',').map(part => {
      const cm = /(?:rgba?|hsla?|color|oklch|oklab|lab|lch)\([^)]*\)|#[0-9a-f]{3,8}\b/i.exec(part);
      const nums = (cm ? part.replace(cm[0], '') : part).match(/-?[\d.]+px/g) || [];
      const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(parseFloat);
      return { color: cm ? rgba(cm[0]) : null, x, y, blur, spread, inset: /\binset\b/.test(part) };
    });
  }
  const blurOf = f => { const m = /blur\(\s*([\d.]+)px/.exec(f || ''); return m ? parseFloat(m[1]) : 0; };

  function sectionNumber(t) {
    if (t.length > 40) return false;
    const m = SEC_HEAD.exec(t);
    if (!m) return false;
    const rest = t.slice(m[0].length);
    if (MONTH_START.test(rest) || SEP_DIGIT.test(rest)) return false;
    return /^\s*$/.test(rest) || SEP_START.test(rest) || /^\s+\p{L}/u.test(rest);
  }

  function navStatus() {
    try {
      const n = performance.getEntriesByType('navigation')[0];
      return n && n.responseStatus ? n.responseStatus : null;
    } catch (e) {
      return null;
    }
  }

  // deslop-allow markers in comments, meta tags, style blocks and same-origin stylesheets.
  async function allowMarkers() {
    const out = [];
    const scan = (text, source) => {
      for (const m of String(text).matchAll(ALLOW_RE)) {
        for (const rule of m[1].split(',').map(x => x.trim()).filter(Boolean)) out.push({ rule, reason: m[2].trim(), source });
      }
    };
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) scan(walker.currentNode.nodeValue, 'html comment');
    for (const m of $$('meta[name="deslop-allow"]')) scan('deslop-allow ' + m.content, 'meta tag');
    for (const s of $$('style')) scan(s.textContent, 'style block');
    for (const link of $$('link[rel~="stylesheet"][href]')) {
      try {
        const u = new URL(link.href, location.href);
        if (u.origin !== location.origin) continue;
        const r = await fetch(u.href);
        if (r.ok) scan(await r.text(), u.pathname);
      } catch (e) { /* unreadable sheet: skip */ }
    }
    return out;
  }

  async function run() {
    const findings = [];
    const add = (rule, evidence, key) => findings.push({ rule, evidence, key: String(key || evidence) });
    const base = { url: location.href, title: document.title, status: navStatus(), viewport: [innerWidth, innerHeight], rules: RULES, findings };
    if (!document.body) return Object.assign(base, { allow: [] });
    window.scrollTo(0, 0);
    const vh = innerHeight;

    const all = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (/^(script|style|noscript|template|link|meta|head|title)$/.test(el.localName) || el.ownerSVGElement) continue;
      if (isRendered(el)) all.push(el);
    }
    const cache = new Map();
    const st = el => { let s = cache.get(el); if (!s) { s = style(el); cache.set(el, s); } return s; };
    const holders = [];
    for (const el of all) {
      if (el.localName === 'svg') continue;
      const t = ownText(el);
      if (t && /[\p{L}\p{N}]/u.test(t)) holders.push([el, t]);
    }
    const headings = all.filter(el => /^h[1-6]$/.test(el.localName));

    // Tags: pills and chips, by class name or by shape.
    const chipShape = el => {
      const s = st(el), bg = rgba(s.backgroundColor);
      const rounded = (parseFloat(s.borderTopLeftRadius) || 0) > 0 && (parseFloat(s.paddingLeft) || 0) > 0;
      return (bg && bg[3] > 0.04) || side(s, 'Top') > 0 || side(s, 'Left') > 0 || rounded;
    };
    {
      const hits = [];
      for (const el of all) {
        if (el.localName === 'svg' || el.matches('button, input, select, textarea, label, [role=button]')) continue;
        if ((el.textContent || '').length > 80) continue;
        const text = squash(el.innerText);
        if (!text || text.length > 28 || wordCount(text) > 4) continue;
        // A class named "tag" on plain text is not a chip: it needs a fill, a border or a rounded padded shape.
        let hit = TAG_TOKENS.test(classOf(el)) && chipShape(el);
        if (!hit) {
          const r = el.getBoundingClientRect(), s = st(el);
          if (r.height >= 12 && r.height <= 34 && r.width <= 220 && parseFloat(s.fontSize) <= 13.5) {
            const radius = parseFloat(s.borderTopLeftRadius) || 0;
            const bg = rgba(s.backgroundColor);
            hit = radius >= r.height / 2 - 1.5 && ((bg && bg[3] > 0.04) || (side(s, 'Top') > 0 && side(s, 'Left') > 0));
          }
        }
        if (hit) hits.push(el);
      }
      for (const el of hits) if (!hits.some(o => o !== el && el.contains(o))) add('tags', describe(el) + ' ' + said(el, 20), idOf(el));
    }

    // Eyebrows: a short, small or shouted label right before a heading.
    for (const h of headings) {
      if (!/^h[1-4]$/.test(h.localName)) continue;
      const p = h.previousElementSibling;
      if (!p || !isRendered(p) || /^h[1-4]$/.test(p.localName) || p.closest('nav')) continue;
      if (p.matches('nav, ol, ul, dl, img, svg, picture, figure, hr, br, button, input, select, form, table, video, iframe')) continue;
      const t = squash(p.innerText);
      if (!t || t.length > 48 || wordCount(t) > 6 || /[.!?]$/.test(t)) continue;
      if (p.querySelector('time') || DATE_RE.test(t)) continue;
      const ps = st(p), psz = parseFloat(ps.fontSize) || 16, hsz = parseFloat(st(h).fontSize) || 16;
      const spacing = (parseFloat(ps.letterSpacing) || 0) / psz;
      const caps = ps.textTransform === 'uppercase' || (/\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t) && (t.match(/\p{L}/gu) || []).length >= 3);
      if (caps || spacing >= 0.05 || MONO_RE.test(firstFamily(ps.fontFamily)) || EYEBROW_TOKENS.test(classOf(p)) || (psz <= 14 && psz <= hsz * 0.5)) {
        add('eyebrows', said(p, 24) + ' over ' + h.localName + ' ' + said(h, 24), idOf(p));
      }
    }

    // One pass over every block of text.
    const fontUse = new Map();
    for (const [el, t] of holders) {
      const s = st(el), code = inCode(el);
      const fam = firstFamily(s.fontFamily), size = parseFloat(s.fontSize) || 16;
      fontUse.set(fam, (fontUse.get(fam) || 0) + 1);
      const label = describe(el) + ' "' + clip(t, 24) + '"';
      if (!code && sectionNumber(t)) add('section-numbers', label, idOf(el));
      if (t.length <= 48 && !el.closest('pre')) {
        const codeEl = el.closest('code, kbd, samp');
        const standalone = !codeEl || !ownText(codeEl.parentElement || codeEl);
        if (standalone && CRUMB_RE.test(t)) add('code-breadcrumbs', label, idOf(el));
      }
      if (!code) {
        const letters = (t.match(/\p{L}/gu) || []).length;
        const literal = wordCount(t) >= 2 && letters >= 6 && /\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t);
        if (letters >= 2 && (s.textTransform === 'uppercase' || literal)) add('all-caps', label, idOf(el));
        if (MONO_RE.test(fam)) add('mono', label + ' (' + fam + ')', idOf(el));
        const emoji = (t.match(EMOJI_RE) || []).filter(e => !/^\p{Emoji_Modifier}$/u.test(e));
        if (emoji.length) add('emoji', label + ' ' + emoji.slice(0, 3).join(' '), idOf(el));
        if (t.length <= 12 && STAT_RE.test(t) && !el.closest('table')) add('made-up-stats', '"' + t + '" (' + describe(el) + ')', 'stat:' + t);
      }
      if (/instrument serif/.test(fam)) add('trend-serif', label, idOf(el));
      const spacing = parseFloat(s.letterSpacing);
      if (spacing && spacing / size <= -0.03) add('tight-tracking', label + ' ' + (spacing / size).toFixed(3) + 'em', idOf(el));
      if (size >= 80) add('giant-hero', label + ' ' + Math.round(size) + 'px', idOf(el));
      if (t.length <= 80 && LOGO_RE.test(t)) add('logo-strip', label, idOf(el));
    }
    for (const [fam, n] of fontUse) {
      const name = fam.replace(/\s*(?:variable|var|vf)$/i, '').trim();
      if (WATCH_FONTS.has(name)) add('watch-font', fam + ' (' + n + ' text blocks)', 'font:' + name);
    }

    // Italic accent: part of a heading in italics.
    for (const h of headings) {
      if (!/^h[1-3]$/.test(h.localName) || st(h).fontStyle !== 'normal') continue;
      const it = $$('*', h).find(d => ownText(d) && style(d).fontStyle !== 'normal');
      if (it) add('italic-accent', h.localName + ' ' + said(h, 32) + ' (italic ' + said(it, 16) + ')', idOf(h));
    }

    // Dividers, bordered boxes and accent rails.
    for (const el of all) {
      const tag = el.localName, s = st(el);
      if (tag === 'hr' || el.getAttribute('role') === 'separator') { add('dividers', describe(el), idOf(el)); continue; }
      if (s.display === 'inline' || s.display === 'contents' || el.closest('table')) continue;
      const r = el.getBoundingClientRect();
      if (!el.children.length && !ownText(el)) {
        const bg = rgba(s.backgroundColor);
        if (bg && bg[3] > 0.05 && ((r.height <= 2 && r.width >= 40) || (r.width <= 2 && r.height >= 24))) { add('dividers', describe(el) + ' (line)', idOf(el)); continue; }
      }
      const cardLink = tag === 'a' && r.width >= 120 && r.height >= 60;
      if (NO_BOX.test(tag) && !cardLink) continue;
      const T = side(s, 'Top'), B = side(s, 'Bottom'), L = side(s, 'Left'), R = side(s, 'Right');
      const ring = shadows(s.boxShadow).some(x => !x.inset && !x.x && !x.y && !x.blur && x.spread >= 0.5 && x.color && x.color[3] > 0.05);
      if ((T && B && L && R) || ring) {
        // A border round a form field is normal, so skip field wrappers.
        const field = r.height <= 64 && (tag === 'form' || el.querySelector('input, select, textarea'));
        if (!field && r.width >= 60 && r.height >= 32) add('bordered-boxes', describe(el) + ' ' + Math.round(r.width) + '\u00D7' + Math.round(r.height), idOf(el));
      } else if ((T || B) && !(L || R)) {
        if (r.width >= 40) add('dividers', describe(el) + (T && B ? ' (top and bottom rules)' : T ? ' (top rule)' : ' (bottom rule)'), idOf(el));
      } else if ((L || R) && !(T || B) && tag !== 'blockquote') {
        const radius = (parseFloat(s.borderTopLeftRadius) || 0) + (parseFloat(s.borderTopRightRadius) || 0);
        if (Math.max(L, R) >= 2 && radius > 0) add('accent-rail', describe(el) + ' (' + Math.max(L, R) + 'px side bar)', idOf(el));
        else if (r.height >= 24) add('dividers', describe(el) + ' (side rule)', idOf(el));
      }
    }

    // Tints: distinct greys, alpha levels, opacities and shades of one hue.
    {
      const tints = new Map();
      const shadeMap = new Map();
      const note = (c, where) => {
        if (!c || c[3] <= 0.02) return;
        if (c[3] < 0.97) { const k = 'alpha ' + c[3].toFixed(2); if (!tints.has(k)) tints.set(k, where); return; }
        const [h, sat, l] = hsl(c);
        if (sat < 0.2) {
          if (l >= 0.12 && l <= 0.93) { const k = 'grey ' + hex(c); if (!tints.has(k)) tints.set(k, where); }
          return;
        }
        const bucket = Math.round(h / 20) % 18;
        if (!shadeMap.has(bucket)) shadeMap.set(bucket, new Map());
        shadeMap.get(bucket).set(Math.round(l * 20), hex(c));
      };
      for (const el of all) {
        const s = st(el), where = describe(el);
        if (ownText(el)) note(rgba(s.color), where);
        note(rgba(s.backgroundColor), where);
        for (const k of ['Top', 'Right', 'Bottom', 'Left']) if (side(s, k)) note(rgba(s['border' + k + 'Color']), where);
        const op = parseFloat(s.opacity);
        if (op > 0.04 && op < 0.96 && squash(el.textContent)) { const k = 'opacity ' + op.toFixed(2); if (!tints.has(k)) tints.set(k, where); }
      }
      for (const levels of shadeMap.values()) if (levels.size >= 3) for (const hx of levels.values()) tints.set('shade ' + hx, '');
      for (const [k, where] of tints) add('tints', k + (where ? ' (' + where + ')' : ''), k);
    }

    // Fake UI: mock-up classes, window dots, and boxes full of tiny labels.
    for (const el of all) {
      if (FAKE_TOKENS.test(classOf(el) + ' ' + el.id)) add('fake-ui', describe(el) + ' (mock-up class)', idOf(el));
      if (el.children.length < 3 || el.children.length > 4) continue;
      const hues = Array.from(el.children).slice(0, 3).map(k => {
        const r = k.getBoundingClientRect();
        if (r.width < 5 || r.width > 18 || Math.abs(r.width - r.height) > 2) return null;
        const s = style(k), c = rgba(s.backgroundColor);
        if ((parseFloat(s.borderTopLeftRadius) || 0) < r.width * 0.35 || !c || c[3] < 0.5) return null;
        const [h, sat] = hsl(c);
        return sat >= 0.4 ? h : null;
      });
      const [h1, h2, h3] = hues;
      if (h1 !== null && h2 !== null && h3 !== null && (h1 < 15 || h1 > 345) && h2 >= 35 && h2 <= 60 && h3 >= 90 && h3 <= 160) {
        add('fake-ui', describe(el) + ' (window dots)', idOf(el));
      }
    }
    {
      const tiny = new Map();
      for (const [el] of holders) {
        if ((parseFloat(st(el).fontSize) || 16) > 11 || el.closest('footer, table, nav, a[href]')) continue;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) tiny.set(p, (tiny.get(p) || 0) + 1);
      }
      for (const [box, n] of tiny) {
        if (n >= 15 && !Array.from(box.children).some(c => (tiny.get(c) || 0) >= 15)) add('fake-ui', describe(box) + ' (' + n + ' tiny labels)', idOf(box));
      }
    }

    // Diagrams: SVG with arrows, mermaid output, diagram blocks.
    for (const svg of all) {
      if (svg.localName !== 'svg') continue;
      const r = svg.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      const arrows = svg.querySelectorAll('marker, [marker-end], [marker-start], [marker-mid]').length;
      if (arrows || /^mermaid/.test(svg.id) || MERMAID_ROLE.test(svg.getAttribute('aria-roledescription') || '')) {
        const n = q => svg.querySelectorAll(q).length;
        add('diagrams', 'svg ' + Math.round(r.width) + '\u00D7' + Math.round(r.height) + ': ' + n('rect, circle, ellipse, polygon') + ' shapes, ' + n('line, path, polyline') + ' lines, ' + n('text') + ' labels', idOf(svg));
      }
    }
    for (const el of all) {
      const cls = classOf(el);
      if (el.localName !== 'svg' && (/(^|\s)mermaid(\s|$)/.test(cls) || DIAGRAM_TOKENS.test(cls)) && !el.querySelector('svg[id^="mermaid"]')) {
        add('diagrams', describe(el) + ' (diagram block)', idOf(el));
      }
    }

    // Wall of text: too much copy in the first screen, or lots of small print.
    // Copy means runs of 4 words or more outside links, buttons, menus and tables,
    // so a grid of products or a menu does not count.
    {
      const h1 = all.find(el => el.localName === 'h1');
      const article = h1 && h1.closest('article');
      if (!(article && wordCount(article.innerText) >= 300)) {
        let words = 0;
        for (const [el, t] of holders) {
          const n = wordCount(t);
          if (n < 4 || el.closest('nav, a, button, label, table')) continue;
          const r = el.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0) words += n;
        }
        if (words > 90) add('wall-of-text', words + ' words of copy in the first screen', 'first-screen');
      }
      let small = 0;
      for (const [el, t] of holders) if ((parseFloat(st(el).fontSize) || 16) <= 12 && wordCount(t) >= 4 && !el.closest('footer')) small++;
      if (small >= 10) add('wall-of-text', small + ' blocks of small print', 'small-print');
    }

    // Gradients, glow and glass, on elements and their ::before and ::after.
    for (const el of all) {
      const where = describe(el), parts = [[st(el), '']];
      for (const p of ['::before', '::after']) {
        const ps = style(el, p);
        if (ps.content && ps.content !== 'none' && ps.content !== 'normal') parts.push([ps, p]);
      }
      for (const [s, p] of parts) {
        // Repeating gradients draw patterns such as stripes or a dashed legend key, not colour washes.
        const bgi = (s.backgroundImage || '').replace(/repeating-(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/g, '');
        if (/gradient\(/.test(bgi) || /gradient\(/.test(s.borderImageSource || '')) {
          const textClip = s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text';
          const purple = (bgi.match(/rgba?\([^)]*\)/g) || []).map(rgba).filter(Boolean).some(c => { const [h, sat] = hsl(c); return sat > 0.3 && h >= 225 && h <= 300; });
          add('gradients', where + p + (textClip ? ' (gradient text)' : '') + (purple ? ' (purple-blue)' : ''), idOf(el) + p);
        }
        const blur = blurOf(s.filter);
        if (blur >= 20 && !/^(img|video|picture|canvas)$/.test(el.localName)) add('glow', where + p + ' blur ' + blur + 'px', idOf(el) + p + ':blur');
        const glowShadow = shadows(s.boxShadow).find(x => x.blur >= 24 && x.color && x.color[3] >= 0.15 && hsl(x.color)[1] >= 0.3);
        if (glowShadow) add('glow', where + p + ' coloured shadow ' + glowShadow.blur + 'px', idOf(el) + p + ':shadow');
        const glowText = shadows(s.textShadow).find(x => x.blur >= 6 && x.color && x.color[3] >= 0.15 && hsl(x.color)[1] >= 0.3);
        if (glowText) add('glow', where + p + ' glowing text', idOf(el) + p + ':text');
        if (/blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || '')) add('glass', where + p + ' backdrop blur', idOf(el) + p + ':glass');
      }
      if (GLOW_TOKENS.test(classOf(el))) add('glow', where + ' (glow class)', idOf(el) + ':class');
    }

    // Icon tiles: three or more same-size tinted squares that each hold one icon.
    {
      const groups = new Map();
      for (const el of all) {
        if (el.children.length !== 1 || ownText(el) || el.closest('a, button, [role=button]')) continue;
        const k = el.children[0], kr = k.getBoundingClientRect();
        const iconish = k.localName === 'svg' || (k.localName === 'img' && kr.width <= 48) ||
          (/^(i|span)$/.test(k.localName) && !squash(k.textContent) && kr.width > 0 && kr.width <= 40) ||
          (k.children.length === 1 && k.children[0].localName === 'svg' && !squash(k.textContent));
        if (!iconish) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.width > 88 || r.height < 24 || r.height > 88 || Math.abs(r.width - r.height) > r.width * 0.3) continue;
        const s = st(el), bg = rgba(s.backgroundColor), radius = parseFloat(s.borderTopLeftRadius) || 0;
        if (radius < 2 || !((bg && bg[3] > 0.04) || side(s, 'Top'))) continue;
        const sig = Math.round(r.width) + '\u00D7' + Math.round(r.height) + ', radius ' + Math.round(radius);
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(el);
      }
      for (const [sig, els] of groups) if (els.length >= 3) for (const el of els) add('icon-tiles', describe(el) + ' (' + sig + ')', idOf(el));
    }
    for (const el of all) {
      if (el.localName === 'svg' && /sparkle/i.test(classOf(el) + ' ' + (el.getAttribute('data-lucide') || ''))) add('emoji', describe(el) + ' (sparkles icon)', idOf(el));
    }

    // Two-button hero: two buttons side by side under the first heading.
    {
      const h1 = all.find(el => el.localName === 'h1' && el.getBoundingClientRect().top < vh);
      if (h1) {
        const own = h1.closest('header');
        const isCta = el => {
          if (el.closest('nav')) return false;
          const hdr = el.closest('header');
          if (hdr && hdr !== own) return false;
          if (!isRendered(el)) return false;
          const r = el.getBoundingClientRect();
          if (r.top > vh || r.height < 28 || r.height > 80 || r.width < 60) return false;
          const n = wordCount(squash(el.innerText || el.value));
          if (n < 1 || n > 5) return false;
          const s = style(el), bg = rgba(s.backgroundColor);
          return (bg && bg[3] > 0.05) || (side(s, 'Top') > 0 && side(s, 'Left') > 0) || (parseFloat(s.paddingLeft) || 0) >= 10;
        };
        let box = h1.parentElement;
        for (let up = 0; box && box !== document.body && up < 4; up++, box = box.parentElement) {
          const ctas = $$('a, button, [role=button], input[type=submit]', box).filter(isCta);
          if (ctas.length < 2) continue;
          const rows = new Map();
          for (const c of ctas) {
            const k = Math.round(c.getBoundingClientRect().top / 12);
            if (!rows.has(k)) rows.set(k, []);
            rows.get(k).push(c);
          }
          const pair = Array.from(rows.values()).find(row => row.length === 2);
          if (pair) add('two-button-hero', said(pair[0], 20) + ' + ' + said(pair[1], 20) + (/center/.test(st(h1).textAlign) ? ' (centred)' : ''), 'hero');
          break;
        }
      }
    }

    // Three-up: rows of three equal cards with a title and a little text.
    for (const el of all) {
      const kids = Array.from(el.children).filter(isRendered);
      if (kids.length !== 3 && kids.length !== 6 && kids.length !== 9) continue;
      const rects = kids.map(k => k.getBoundingClientRect());
      let rowsOk = true;
      for (let i = 0; i < rects.length && rowsOk; i += 3) {
        const [a, b, c] = rects.slice(i, i + 3);
        rowsOk = a.width >= 160 && [b, c].every(x => Math.abs(x.top - a.top) < 6 && Math.abs(x.width - a.width) <= Math.max(6, a.width * 0.05)) && a.left < b.left && b.left < c.left;
      }
      if (!rowsOk) continue;
      const cards = kids.every(k => {
        if (k.querySelector('img, picture, video, canvas')) return false;
        const n = wordCount(k.innerText);
        return n >= 6 && n <= 60 && !!k.querySelector('h2, h3, h4, h5, h6, strong, b, dt');
      });
      if (cards) add('three-up', describe(el) + ' (' + kids.length + ' equal cards)', idOf(el));
    }

    // Bento: a grid of boxy tiles in mixed sizes.
    for (const el of all) {
      const s = st(el), token = /bento/i.test(classOf(el));
      if (!token && !/grid/.test(s.display)) continue;
      const kids = Array.from(el.children).filter(isRendered);
      if (kids.length < 4 || (!token && el.getBoundingClientRect().width < 400)) continue;
      const boxy = kids.filter(k => { const ks = st(k), bg = rgba(ks.backgroundColor); return (bg && bg[3] > 0.04) || side(ks, 'Top') > 0 || (parseFloat(ks.borderTopLeftRadius) || 0) >= 8; });
      const widths = new Set(kids.map(k => Math.round(k.getBoundingClientRect().width / 8)));
      const heights = new Set(kids.map(k => Math.round(k.getBoundingClientRect().height / 8)));
      if (token || (boxy.length >= Math.max(4, kids.length * 0.75) && widths.size >= 2 && heights.size >= 2)) {
        add('bento', describe(el) + ' (' + kids.length + ' tiles, ' + widths.size + ' widths, ' + heights.size + ' heights)', idOf(el));
      }
    }

    // Logo strip: a row of four or more muted logos.
    for (const el of all) {
      const kids = Array.from(el.children).filter(isRendered);
      if (kids.length < 4) continue;
      const logos = kids.map(k => (k.localName === 'img' || k.localName === 'svg') ? k
        : (!squash(k.textContent) && k.querySelectorAll('img, svg').length === 1 ? k.querySelector('img, svg') : null));
      if (logos.some(x => !x)) continue;
      const rs = logos.map(x => x.getBoundingClientRect());
      if (rs.some(x => x.height > 72 || x.height < 8 || Math.abs(x.top - rs[0].top) > 12)) continue;
      const muted = [el, ...kids, ...logos].some(x => {
        const s = style(x);
        return /grayscale\(\s*(?!0[\s)])/.test(s.filter) || parseFloat(s.opacity) < 0.9 || (s.mixBlendMode && s.mixBlendMode !== 'normal');
      });
      if (muted) add('logo-strip', describe(el) + ' (' + logos.length + ' muted logos)', idOf(el));
    }

    // Placeholder proof and invented names, in text and image alt text.
    {
      const text = (document.body.innerText || '') + '\n' + $$('img[alt]').map(i => i.alt).join('\n');
      const placeholders = [...(text.match(PLACEHOLDER_RE) || []), ...(text.match(PLACEHOLDER_CASED_RE) || [])];
      for (const m of new Set(placeholders.map(x => x.toLowerCase()))) add('placeholder-proof', '"' + m + '"', 'ph:' + m);
      for (const m of new Set((text.match(PERSONA_RE) || []).map(x => x.toLowerCase()))) add('persona-names', '"' + m + '"', 'pn:' + m);
    }

    // Watch list.
    for (const el of all) {
      if (!el.matches('a, button, [role=button]')) continue;
      const t = squash(el.innerText), last = el.lastElementChild;
      if (ARROW_END.test(t) || (last && last.localName === 'svg' && /arrow/i.test(classOf(last)) && !/back|prev/i.test(t))) add('arrow-links', describe(el) + ' "' + clip(t, 24) + '"', idOf(el));
    }
    {
      const hits = all.filter(el => {
        if ((el.textContent || '').length > 120) return false;
        const t = squash(el.innerText);
        if (t.length > 100 || !META_SPLIT.test(t)) return false;
        const parts = t.split(META_SPLIT);
        return parts.length >= 2 && wordCount(t) <= 14 && parts.every(x => wordCount(x) <= 4);
      });
      for (const el of hits) if (!hits.some(o => o !== el && el.contains(o))) add('meta-dots', describe(el) + ' ' + said(el, 32), idOf(el));
    }
    {
      const heads = headings.filter(h => /^h[1-3]$/.test(h.localName));
      const centred = heads.filter(h => /center/.test(st(h).textAlign));
      if (heads.length >= 3 && centred.length / heads.length >= 0.6) add('centred', centred.length + ' of ' + heads.length + ' headings centred', 'centred');
    }
    {
      let boxes = 0;
      const radii = new Map();
      for (const el of all) {
        const s = st(el), r = el.getBoundingClientRect(), rad = parseFloat(s.borderTopLeftRadius) || 0;
        if (rad < 8 || r.width < 48 || r.height < 48) continue;
        const bg = rgba(s.backgroundColor);
        if (!((bg && bg[3] > 0.04) || side(s, 'Top') > 0 || (s.boxShadow && s.boxShadow !== 'none'))) continue;
        boxes++;
        radii.set(Math.round(rad), (radii.get(Math.round(rad)) || 0) + 1);
      }
      if (boxes >= 12) {
        const top = Array.from(radii).sort((a, b) => b[1] - a[1])[0];
        add('rounded-everywhere', boxes + ' rounded boxes, most at ' + top[0] + 'px', 'rounded');
      }
    }
    for (const el of all) {
      const anim = st(el).animationName || 'none';
      const attr = ['data-aos', 'data-animate', 'data-reveal', 'data-scroll'].some(a => el.hasAttribute(a));
      if (attr || FADE_TOKENS.test(classOf(el)) || (anim !== 'none' && /fade|slide|rise|reveal|up/i.test(anim))) add('fade-up', describe(el), idOf(el));
    }
    {
      let page = [255, 255, 255, 1];
      for (const e of [document.body, document.documentElement]) {
        const c = rgba(style(e).backgroundColor);
        if (c && c[3] > 0.5) { page = c; break; }
      }
      const accents = [];
      for (const el of all) {
        if (!el.matches('a, button, h1, h2, h3, [class*=accent], [class*=btn], [class*=button]')) continue;
        const s = st(el);
        for (const v of [s.color, s.backgroundColor]) { const c = rgba(v); if (c && c[3] > 0.5) accents.push(c); }
      }
      if (dist(page, [244, 241, 234]) <= 16 && accents.some(c => dist(c, [217, 119, 87]) <= 45)) add('stock-palette', 'cream ' + hex(page) + ' with a terracotta accent', 'cream');
      const acid = accents.some(c => { const [h, sat, l] = hsl(c); return sat > 0.7 && l > 0.45 && ((h >= 65 && h <= 100) || (h >= 5 && h <= 22)); });
      if (hsl(page)[2] < 0.09 && hex(page) !== '#000000' && acid) add('stock-palette', 'near-black ' + hex(page) + ' with an acid accent', 'acid');
    }

    return Object.assign(base, { allow: await allowMarkers() });
  }

  // Console helper: run the audit and print one row per rule that fires.
  async function report() {
    const r = await run();
    const keys = new Map();
    for (const f of r.findings) {
      if (!keys.has(f.rule)) keys.set(f.rule, new Set());
      keys.get(f.rule).add(f.key);
    }
    const rows = RULES.filter(([id, , , min]) => keys.has(id) && keys.get(id).size >= min).map(([id, group, level]) => ({
      id, group, level, count: keys.get(id).size, example: r.findings.find(f => f.rule === id).evidence,
    }));
    console.table(rows);
    return r;
  }

  window.__deslop = { run, report, RULES };
})();
