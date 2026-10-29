---
name: deslop
description: Keep AI design tells out of every page, site, artifact, dashboard, slide deck and mock-up, and give each design one bold move taken from its subject. Use it on every design task, in Claude Code and in chat. Also use it when the user says "deslop this", "does this look AI-made", "design review" or /deslop, or shares a screenshot or URL to review. It keeps these tells out unless the content gives a reason (tags, eyebrows, section numbers, code breadcrumbs, all caps, Instrument Serif with tight tracking, italic accent words, mono type, giant hero type, dividers, bordered boxes, many tints, fake UI mock-ups, diagrams, walls of text, gradients, glow, frosted glass, icon tiles, emoji, two-button heroes, three-card rows, bento grids, logo strips, made-up stats and placeholder people).
license: MIT
metadata:
  version: "1.1"
---

# deslop: design without the AI tells

AI design has tells. Each one makes a page look designed, but nobody made a real design decision. People now spot them at a glance, and the page reads as generic. This skill keeps the tells out and puts one real decision in.

## When this applies

- Every design task, in Claude Code and in chat: new sites and pages, UI changes, artifacts, dashboards, slide decks, mock-ups and HTML emails.
- On request: "deslop this", "does this look AI-made", "design review" or /deslop. Run the audit below.
- Not for prose. Use a writing skill for that. This skill covers how a page looks, including how much text sits on it.

## Who wins

1. The user's own words.
2. The project's design system. Its deliberate choices count as reasons.
3. This skill.
4. Generic design guidance, such as the artifact-design or frontend-design skills.

Where generic guidance conflicts with this skill, this skill wins. For example, artifact-design asks for letter-spaced uppercase labels, a utility face for captions and pills for state. Here those are tells unless the content gives a reason.

## The rule

Every tell below is off by default. Use one only when the content gives a reason.

A reason names something true about the content:

- "The steps happen in this order." (numbers)
- "The product is a code tool, and these labels are code." (mono)
- "The page copies a printed form." (ruled lines)
- "The pill shows live status." (tags)

These are not reasons: "it looks clean", "it adds polish", "it feels premium", "it fills the space", "it is on trend".

When you keep a tell, do two things:

1. Mark it in the code: `deslop-allow <id>: <reason>` in an HTML or CSS comment. A marker covers its own page. If the framework strips comments (Astro does), use `<meta name="deslop-allow" content="<id>: <reason>">`. To allow it for a whole project, put `<id>: <reason>` in a `deslop.allow` file at the project root.
2. Name it in your reply, in one line.

## The tells

The list is dated 29 Oct 2026. The ids match the checker.

### Labels nobody needs

| id | Looks like | Do instead |
| :- | :- | :- |
| `tags` | Pills and chips on cards and headings: "New", "AI", category chips | Say it in the text, or drop it |
| `eyebrows` | A small label over a heading | Write a heading that says it all |
| `section-numbers` | 01, 02, 03 or § on sections | Number only real steps, in a real list |
| `code-breadcrumbs` | `~/work`, `// about`, `<Hero />` or `$ npm` as decoration | Plain words. Show code only where the reader uses code |
| `all-caps` | Uppercase subtitles, labels and buttons | Sentence case |

### Type tricks

| id | Looks like | Do instead |
| :- | :- | :- |
| `trend-serif` | Instrument Serif as the display face | Pick type for the subject and the reader. One family is often enough |
| `tight-tracking` | Headlines squeezed to -0.03em letter-spacing or tighter | Default spacing. A small optical fix on a big sans is fine |
| `italic-accent` | One italic word in a headline: "Design that *feels* human" | Let the sentence carry the stress |
| `mono` | Mono type on labels, stats or headings | Mono only for code. Use tabular figures for numbers |
| `giant-hero` | Type at 80px or more that fills the screen | Size the headline to its words: about 40 to 64px on desktop |

### Lines, boxes and tints

| id | Looks like | Do instead |
| :- | :- | :- |
| `dividers` | A rule between every section or row | Space. Use rules only inside tables and forms |
| `bordered-boxes` | Every block in a 1px bordered card | Space and alignment. Box only a real separate object |
| `tints` | Many greys and opacity steps: text at 70, 50 and 40%, borders at 10% | One text colour, one muted colour, one background, one accent |

### Too much

| id | Looks like | Do instead |
| :- | :- | :- |
| `fake-ui` | A hero mock-up of an app: tiny cards, charts, avatars, window dots | A real screenshot, or nothing |
| `diagrams` | Box-and-arrow diagrams. More detail is worse | A sentence or a short list. Draw only when the reader needs the shape |
| `wall-of-text` | Text in every gap: a long hero, helper lines, captions, small print | Cut to what a reader needs to act |

### Gradients and glow

| id | Looks like | Do instead |
| :- | :- | :- |
| `gradients` | Purple-to-blue washes, gradient text, gradient borders | Flat colour |
| `glow` | Blurred colour blobs, coloured glows, neon shadows | No glow. A plain shadow only on things that float, such as menus |
| `glass` | Frosted-glass panels (backdrop blur) | A solid surface |

### Icon decoration

| id | Looks like | Do instead |
| :- | :- | :- |
| `icon-tiles` | An icon in a tinted square on every card | Icons only where they carry meaning, such as a pin next to an address |
| `emoji` | ✨ 🚀 ⚡ as markers, bullets or headings | Words |

### Template layouts

| id | Looks like | Do instead |
| :- | :- | :- |
| `two-button-hero` | A hero with a primary button and a ghost button | One action |
| `three-up` | Three equal cards in a row: icon, title, two lines | Fit the layout to the content: a list, a table or one real example |
| `bento` | A bento grid of mixed tiles | Same as above |
| `logo-strip` | "Trusted by" and a row of grey logos | Real proof only: a named customer, or a number with a source |

### Made-up proof

| id | Looks like | Do instead |
| :- | :- | :- |
| `made-up-stats` | 10x, 99.9% or 500+ with no source | Real numbers with a source, or none |
| `placeholder-proof` | Lorem ipsum, Jane Doe, Acme, "CEO at TechCorp" | Real names and quotes that people agreed to, or none |

### Watch list

These are not tells yet. The checker reports them so you can ask: did the subject choose this?

- `watch-font`: faces AI picks by default, such as Inter, Space Grotesk, Geist, Manrope, DM Sans, Satoshi and Cal Sans. Also the display serifs that may replace Instrument Serif: Fraunces, Playfair Display, DM Serif Display, Cormorant and Newsreader.
- `arrow-links`: "→" at the end of links and buttons.
- `meta-dots`: short UI lines joined with middle dots, such as "5 min read · Design". Middle dots in prose are fine.
- `centred`: most headings centred.
- `rounded-everywhere`: the same large radius on every box.
- `accent-rail`: a coloured bar down the side of rounded cards.
- `fade-up`: every section fades and slides up on scroll.
- `stock-palette`: cream (#F4F1EA) with a terracotta accent, or near-black with one acid-green or vermilion accent.
- `persona-names`: names AI invents for testimonials, such as Sarah Chen.

## Default look: plain base, one bold move

### Plain base

1. Use one type family. Add a second only when it is clearly different and has a job. Make hierarchy with size, weight and space.
2. Set body text at 16 to 18px, with lines of 60 to 75 characters. Size headlines to their words.
3. Use one background, one text colour, one muted text colour and one accent. The accent marks actions and the bold move.
4. Let space do the grouping. Put related things close together. Put more space between groups. Use lines and boxes only for tables, forms and real separate objects.
5. Left-align text. Use sentence case everywhere.
6. Use real content: real words, numbers, photos and names. Never use placeholders.
7. Keep copy short. Give each block one job.

### One bold move

1. Before you build, write one line: "Bold move: <the move>, because <a fact about the subject>."
2. Take the move from the subject's own world: its tools, materials, documents, places or people. Examples:
   - A music project's site borrows the layout of music software, because the artist makes electronic music.
   - A daily report copies a printed form, because its readers already know the form.
   - A walking guide greets readers with a signed welcome, because a local wrote it.
3. Spend the move in one place. Keep everything around it plain, so it stands out.
4. The move may use a tell when the subject gives the reason. Mark it with `deslop-allow`.
5. A trend is not a bold move. A trend font, a gradient, a giant headline or a dark theme with glow comes from other sites, not from the subject.
6. Do the swap test. Hide the logo and the name. If the page could belong to any other brand, the move is too weak. Change it.

## How to work

### On every design task

1. Read the project's design system first: tokens, theme files, CLAUDE.md and `deslop.allow`.
2. Write the bold-move line.
3. Build with the plain base.
4. Run the checker on what you built. Pass a URL, an .html file or a folder of built pages:

   ```bash
   node ~/.claude/skills/deslop/scripts/check.mjs <url, file or folder>
   ```

   For a component project (Astro, React, Vue), start the dev server or build it. Then pass the URL or the build folder.
5. For each tell, remove it, or keep it with a `deslop-allow` reason.
6. Look at a screenshot at desktop and phone width. Do the swap test.
7. End your reply with one line: the bold move, plus any tells you kept and why.

### Audit ("deslop this")

1. Run the checker on the URL, file or folder. If you have only a screenshot, read it against the tables.
2. List the tells, worst first. The worst ones are in the first screen a visitor sees.
3. Give the fix for each tell. If the page has no bold move, propose one.
4. Change only what the user asks for. On a live site, follow the project's own PR and deploy rules.

### The checker

- `scripts/check.mjs` opens each page in headless Chrome at 1440×900, runs `scripts/audit.js` and prints the tells, the allowed tells and the watch list. It needs Node 22 or newer and Chrome. Set `CHROME_PATH` to use another browser, and `DESLOP_CHROME_FLAGS` to add flags (such as `--no-sandbox` in a container that runs as root).
- Options: `--json` for machine output, `--allow <file>` for an allow file, and `--max <n>` for the page limit in a folder (default 25).
- Allowed tells: a `deslop.allow` file covers every page of a target. The checker finds it next to a file or folder target, or in the current folder for a URL. A marker in a page covers that page only.
- Exit code 0 means no tells outside the allowed list. 1 means tells remain. 2 means an error.
- Without Node or Chrome, paste `scripts/audit.js` into the browser console and run `await __deslop.report()`.
- In chat, the checker cannot run. Use the tables as a checklist.
- The checker reads code, not taste. A page can pass and still look generic, so always do the swap test. `wall-of-text`, `fake-ui` and `diagrams` are rough, so confirm them by eye.

## Keep the list current

Tells change. Instrument Serif went from a tasteful pick to a tell in about a year.

- When you find a new tell, add a row with the date. If code can show it, add a rule to `scripts/audit.js` and a case to `tests/`.
- When a ban pushes AI output to a new favourite, add the new favourite to the watch list.
- When the checker flags something it should not, add the page to `tests/fixtures/false-alarms.html` before you fix the rule.
- After you change the skill, run `node tests/run.mjs`.

Source: the "design slop indicators" thread on X and its replies (28 Oct 2026), and a first run of the checker on five live sites (29 Oct 2026).
