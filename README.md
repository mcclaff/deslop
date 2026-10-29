# deslop

You can spot an AI-made landing page from across the room. A tiny uppercase label sits over the headline. One word in the headline is italic Instrument Serif. Pills say "New". Three cards each have an icon in a tinted square, and a purple glow sits behind the lot.

deslop is a skill for Claude that turns those tells off. Each one stays off unless the content gives a real reason for it. In their place, the skill asks for one bold move taken from the subject itself. A music project can borrow the layout of music software. A walking guide can open with a signed welcome from the local who wrote it.

It comes with a checker. Point it at a URL, an HTML file or a folder of built pages. It opens each page in headless Chrome and lists the tells it finds. Here it is on the test page that has all of them:

```
$ node scripts/check.mjs tests/fixtures/slop.html
deslop · tests/fixtures/slop.html · 1 page at 1440×900
27 tells · 0 allowed · 8 on the watch list

Labels nobody needs
  tags                 3  span.pill "New" · span.pill "Beta" · span.pill "AI"
  eyebrows             4  "✨ INTRODUCING ACME AI" over h1 "Ship beautiful products…" · …
  section-numbers      3  span.num "01 / Features" · span.num "02 / Proof" · span.num "03 / Product"

Type tricks
  trend-serif          3  h1 "Ship products" · em "beautiful" · span.grad "faster"
  giant-hero           3  h1 "Ship products" 112px · em "beautiful" 112px · span.grad "faster" 112px
  …
```

## What it looks for

27 tells in eight groups, plus a watch list of nine habits that are not tells yet. [SKILL.md](SKILL.md) has the full table, with what each tell looks like and what to do instead.

| Group | Tells |
| :- | :- |
| Labels nobody needs | `tags`, `eyebrows`, `section-numbers`, `code-breadcrumbs`, `all-caps` |
| Type tricks | `trend-serif`, `tight-tracking`, `italic-accent`, `mono`, `giant-hero` |
| Lines, boxes and tints | `dividers`, `bordered-boxes`, `tints` |
| Too much | `fake-ui`, `diagrams`, `wall-of-text` |
| Gradients and glow | `gradients`, `glow`, `glass` |
| Icon decoration | `icon-tiles`, `emoji` |
| Template layouts | `two-button-hero`, `three-up`, `bento`, `logo-strip` |
| Made-up proof | `made-up-stats`, `placeholder-proof` |

The watch list covers the fonts AI reaches for by default (Inter, Geist, Manrope, Cal Sans and friends), arrows at the end of links, "5 min read · Design" lines, centred headings, one big radius on every box, coloured side bars on cards, fade-up on scroll, two stock palettes and invented testimonial names. The checker reports them so you can ask whether the subject chose them.

## Install

### Claude Code

```bash
git clone https://github.com/mcclaff/deslop.git ~/.claude/skills/deslop
```

Claude picks it up on design work, or when you say "deslop this" or "does this look AI-made".

### claude.ai

Download `deslop.zip` from the [latest release](https://github.com/mcclaff/deslop/releases/latest). In claude.ai, open Customize > Skills, upload the zip and switch it on. The checker needs Chrome, which claude.ai does not have, so there Claude uses the tables in SKILL.md as a checklist.

### Only the checker

You need Node 22 or newer and Chrome or Chromium. Nothing else gets installed.

```bash
npx github:mcclaff/deslop https://example.com
```

## Running the checker

```bash
node scripts/check.mjs <url | file.html | folder> [more targets] [--json] [--allow FILE] [--max N]
```

- A folder gets served on 127.0.0.1 and up to 25 of its `.html` files get checked. Change the limit with `--max`.
- A bare domain such as `example.com` becomes `https://example.com`.
- `--json` prints machine-readable output.
- Pages render at 1440×900.
- The exit code is 0 when nothing is left outside the allowed list, 1 when tells remain and 2 on an error.
- `CHROME_PATH` points it at another browser. `DESLOP_CHROME_FLAGS` adds flags, for example `--no-sandbox` in a container that runs as root.

Component projects (Astro, React, Vue) need a build or a running dev server first. Then pass the build folder or the local URL.

## Keeping a tell on purpose

Sometimes the content does give a reason. A code tool can set its code labels in mono. A page that copies a printed form can have ruled lines. Write the reason down and the checker moves the tell to its "allowed" list:

```html
<!-- deslop-allow mono: the product is a code tool, and these labels are code -->
```

That marker covers its own page. Astro and some other frameworks strip HTML comments, so there you can use a meta tag instead:

```html
<meta name="deslop-allow" content="mono: the product is a code tool, and these labels are code">
```

To allow a tell across a whole project, put the same `id: reason` line in a `deslop.allow` file at the project root. The checker finds it next to a file or folder you check, and in the current folder when you check a URL. `--allow FILE` names one directly.

"It looks clean" is not a reason. "The steps happen in this order" is.

## In CI

The exit code makes it easy to fail a build when a new tell slips in:

```yaml
jobs:
  deslop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci && npm run build
      # Chrome's sandbox needs user namespaces, which Ubuntu blocks by default.
      - run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
      - run: npx github:mcclaff/deslop dist
```

## Limits

It reads code, not taste. A page can pass every check and still look like a thousand other pages. The skill asks Claude for a swap test for that reason: hide the logo and the name, and if the page could belong to any other brand, the bold move is too weak.

`wall-of-text`, `fake-ui` and `diagrams` are rough heuristics, so confirm them by eye. The first full run covered 73 pages on five live sites. It turned up five false alarms: plain prose that mentioned "your company", percentages in data tables, a class named `tag` on plain text, the small labels of a real product grid, and a dashed chart key drawn with a gradient. All five are fixed, and `tests/fixtures/false-alarms.html` keeps them fixed. Expect more. When you hit one, please open an issue.

The list also dates. Instrument Serif went from a tasteful pick to a tell in about a year, and whatever replaces it will go the same way. The watch list is where the next ones wait.

## Contributing

- A new tell needs a row in SKILL.md with the date, a rule in `scripts/audit.js` and an example in `tests/fixtures/slop.html`.
- For a false alarm, add the pattern to `tests/fixtures/false-alarms.html` first and watch the test fail. Then fix the rule.
- Run `npm test` before you open a pull request. It needs Node 22 and Chrome, and CI runs the same tests on every push.
- Push a tag such as `v1.1.0` to publish a release. The release workflow attaches `deslop.zip` for claude.ai, and `npm run zip` builds the same file locally.

## Credits

The list grew out of the "design slop indicators" thread on X (28 Oct 2026) and the replies under it.

MIT licensed. See [LICENSE](LICENSE).
