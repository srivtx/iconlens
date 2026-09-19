<div align="center">

# iconlens

> Lint standalone SVG before it ships.

**Offline accessibility lint for standalone `.svg` files.**

[![CI](https://github.com/srivtx/iconlens/actions/workflows/ci.yml/badge.svg)](https://github.com/srivtx/iconlens/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/srivtx/iconlens?sort=semver&color=4f46e5)](https://github.com/srivtx/iconlens/releases)
[![license](https://img.shields.io/badge/license-MIT-0f766e)](LICENSE)
[![runtime](https://img.shields.io/badge/runtime-Bun-14151A?logo=bun&logoColor=white)](https://bun.sh)
[![types](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![tests](https://img.shields.io/badge/tests-67-0f766e)](#testing)
[![network](https://img.shields.io/badge/network-none-0f766e)](#privacy)

</div>

---

**Live site:** [iconlens](https://iconlens-srivtx.vercel.app)  ·  **Playground:** [https://iconlens-srivtx.vercel.app/#playground](https://iconlens-srivtx.vercel.app/#playground)  ·  **Source:** [github.com/srivtx/iconlens](https://github.com/srivtx/iconlens)

## Website

The product site and a fully client-side playground live at
**[iconlens-srivtx.vercel.app](https://iconlens-srivtx.vercel.app)**. The site is
static: no framework, no external requests, and no build step at deploy time.
Vercel serves the `site/` directory directly (`vercel.json`).

Preview it locally:

```bash
bun install
bun run build:site        # bundles src/index.ts -> site/assets/demo.js
bun run check:site        # verifies links, classes, headings, and no CDN
python3 -m http.server 4173 --directory site
# open http://localhost:4173
```

`site/assets/demo.js` is the committed esbuild bundle (IIFE, global `IconLens`)
that powers the playground. Rebuild it with `bun run build:site` whenever the
library changes.

## The problem

Design systems and icon libraries ship `.svg` assets that have no accessible
name. The existing tools do not catch it:

| Tool | Why it doesn't solve it |
|---|---|
| [svglint](https://github.com/simple-icons/svglint) | Generic XML/attribute linter — accessibility only if you hand-write the rules; no accessible-name computation, no dangling-IDREF checks |
| [svgo](https://github.com/svg/svgo) | Actively **removes** `<title>` and `<desc>` by default |
| axe-core / Pa11y | Need a live DOM and a browser; they don't lint asset files |
| Biome `noSvgWithoutTitle` | One rule, and only for inline HTML/JSX |
| W3C [ACT rule 7d6734](https://www.w3.org/WAI/standards-guidelines/act/rules/7d6734/) | Defines the test, ships no tool |

`iconlens` lints the asset itself: it computes the accessible name the way a
screen reader would and flags the structural failures that break standalone SVG.

## Install

`iconlens` is not published to npm. Install it from GitHub with the one-line script (requires [Bun](https://bun.sh)):

```bash
# One-line install (installs the `iconlens` binary)
curl -fsSL https://raw.githubusercontent.com/srivtx/iconlens/main/install.sh | sh

# Or run once, without installing
bunx github:srivtx/iconlens icons/*.svg

# Install globally
bun add -g github:srivtx/iconlens
iconlens icons/*.svg

# Add to a project as a dev dependency
bun add -d github:srivtx/iconlens
```

## Development

```bash
bun install
bun run src/cli.ts fixtures/bad.svg
```

## Usage

```bash
# Lint files
iconlens icons/*.svg

# Lint a directory (non-recursive, sorted)
iconlens --dir icons/

# Machine-readable (one object for a single file, a JSON array for many)
iconlens logo.svg --json

# Summary only
iconlens logo.svg --quiet

# Lint standard input
cat logo.svg | iconlens -

# Write a SARIF report and tighten the failure threshold
iconlens --dir icons/ --sarif iconlens.sarif --fail-on warning

# Lint a file whose name starts with a dash ("--" ends option parsing)
iconlens -- -weird-name.svg
```

Every option that takes a value (`--dir`, `--sarif`, `--fail-on`) accepts both
`--flag value` and `--flag=value`, and exits `2` when the value is missing.
Unknown options are rejected with `iconlens: unknown option <flag>`, the usage
text, and exit code `2`.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | No issues at or above `--fail-on` |
| `1` | At least one issue at or above `--fail-on` |
| `2` | Invalid usage, input over the size limit, or input that is not a well-formed SVG |
| `3` | I/O error: an input file could not be read, or the report could not be written |

A malformed or non-`<svg>` file is **never** reported as clean: it produces an
`SVG-PARSE-000` error and exit code `2`, so a CI gate cannot pass on garbage.

### Input size limit

An input larger than **16 MiB (16,777,216 bytes)** is rejected before parsing,
for both files and standard input, with an `SVG-PARSE-000` error and exit code
`2`. The limit bounds the memory an untrusted document can consume; it is the
documented cap that `SECURITY.md` refers to.

### Library

```ts
import { auditSvg, parseSvg, accessibleName } from "iconlens";

const result = auditSvg(source, "logo.svg");
const name = accessibleName(parseSvg(source));
// { name: "Company logo", source: "aria-labelledby" }
```

## Rules

| Code | Severity | WCAG | Check |
|---|---|---|---|
| SVG-PARSE-000 | error | — | Input is not a well-formed `<svg>` document |
| SVG-NAME-001 | error | 4.1.2 | `role="img"` with no accessible name |
| SVG-NAME-002 | error | 4.1.2 | `aria-labelledby` references a missing id |
| SVG-DECOR-003 | warning | 1.1.1 | No role, no name, not marked decorative |
| SVG-TITLE-004 | warning | 1.3.1 | `<title>` is not the first child of `<svg>` |
| SVG-DESC-005 | info | 1.1.1 | Named graphic without a `<desc>` |
| SVG-ID-006 | error | — | Duplicate `id` attributes |
| SVG-USE-007 | warning | — | `<use>` points at an id that does not exist |
| SVG-FOCUS-008 | warning | 2.4.3 | `tabindex` (non-negative) on a non-interactive element |
| SVG-REF-009 | error | 4.1.2 | `aria-describedby` references a missing id |

## Accessible-name computation

`iconlens` follows the SVG-AAM priority order:

1. `aria-labelledby` — each referenced id is resolved and its text concatenated
2. `aria-label`
3. the first child `<title>`

If none apply, the graphic has no accessible name and the rules say so.

## How it works

```
.svg ──fast-xml-parser──▶ node tree + id map + duplicate ids
                            ├── accessibleName (SVG-AAM priority)
                            └── rule functions → Issue[]
                                  └── JSON / text report
```

## CI

```yaml
- name: Icon accessibility gate
  run: iconlens --dir src/assets/icons --quiet
```

## SARIF and code scanning

`iconlens` emits [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html),
so findings show up inline in GitHub code scanning and the Security tab.

```bash
# Write a SARIF report
iconlens --dir src/assets/icons --sarif iconlens.sarif

# Upload it (GitHub Actions)
- name: Icon accessibility scan
  run: iconlens --dir src/assets/icons --sarif iconlens.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: iconlens.sarif
```

Each issue becomes a result with `ruleId` set to its code (for example
`SVG-NAME-001`), a level mapped from severity (`error` → `error`,
`warning` → `warning`, `info` → `note`), and a location pointing at the file.

### Choosing the failure threshold

By default the exit code is `1` only when an **error**-severity issue is found.
Use `--fail-on` to tighten or loosen the gate:

```bash
iconlens icons/*.svg --fail-on error    # default
iconlens icons/*.svg --fail-on warning  # fail on warnings too
iconlens icons/*.svg --fail-on info     # fail on any finding
iconlens icons/*.svg --fail-on none     # never fail on findings
```

`--fail-on` affects only the exit code; every issue is still reported and
included in SARIF output.

## Testing

| Gate | Result |
|---|---|
| `bun test` | 67 tests |
| `bunx tsc --noEmit` | clean (strict) |
| fixtures | `bun run make-fixtures` writes a clean and a broken SVG |

Tests cover the good/bad fixtures, CLI exit codes (including malformed,
non-SVG, and oversized input), `--` end-of-options and unknown-option handling,
`--flag=value` parsing, `--sarif`/`--fail-on` argument validation, the input
size cap for files and stdin, the no-silent-clean guard around the rule runner,
focus, dangling `aria-labelledby`/`aria-describedby`/`<use>` references,
duplicate ids, and the name-priority order (`aria-labelledby` beats `title`).

## Privacy

No network code. Files are parsed locally.

## Limitations

- Static file analysis; it does not render or compute colour contrast.
- Name computation follows SVG-AAM priority but does not implement every edge
  of the full specification.
- Inline SVG in HTML/JSX is out of scope.

## The suite

- **booklens** — EPUB accessibility audit and fix
- **officelens** — DOCX/PPTX accessibility audit
- **odflens** — ODT/ODS/ODP accessibility audit
- **iconlens** — standalone SVG accessibility lint *(this repo)*
- **waxseal** — detached Ed25519 seal for WACZ web archives

## License

[MIT](LICENSE).
