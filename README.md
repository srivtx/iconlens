# svg-a11y

Offline, static accessibility linter for **standalone `.svg` files**.

`svg-a11y` reads an SVG source string (no browser, no DOM, no network), computes the
accessible name the way assistive tech would, and reports the accessibility problems
that ship silently inside icon libraries and design-system asset folders.

```sh
bunx svg-a11y icons/*.svg
svg-a11y --dir assets/icons --json
```

## The gap

Standalone `.svg` assets are everywhere — design systems, icon packs, brand kits,
downloaded illustrations — and most of them ship with **no accessible name**. A bare
`role="img"` without a `<title>`, `<desc>`, or `aria-label` is announced as
*"graphic"* or skipped entirely. This is a WCAG 2.1 Level A failure (1.1.1 Non-text
Content; 4.1.2 Name, Role, Value) and it recurs across thousands of files that no one
reviews by hand.

Existing tools do not cover the case:

| Tool | What it actually does | Why it misses standalone SVG assets |
| --- | --- | --- |
| [svglint](https://github.com/buhrmi/svglint) (53★, MIT) | Generic XML / attribute linting | No accessible-name computation; does not know `role`, `aria-labelledby`, or SVG-AAM |
| [svgo](https://github.com/svg/svgo) | Optimizes/compresses SVG | Actively **removes** `<title>`/`<desc>` and other metadata by default |
| [axe-core](https://github.com/dequelabs/axe-core) / [Pa11y](https://pa11y.org) | Full accessibility engines | Require a live DOM / headless browser; cannot lint a file on disk as an asset |
| [Biome](https://biomejs.dev) `noSvgWithoutTitle` | Biomes lint rule | Only covers **inline** SVG inside HTML/JSX, never standalone `.svg` files |
| W3C [ACT rule 7d6734](https://www.w3.org/WAI/standards-guidelines/act/rules/7d6734/) | Defines the test for SVG text alternatives | Ships **no tooling** — it is a specification, not a linter |

`svg-a11y` fills that gap: a dependency-light, offline CLI and library that runs on
plain `.svg` sources in CI.

## Rules

| Rule | Severity | Description | WCAG |
| --- | --- | --- | --- |
| `SVG-NAME-001` | error | Root SVG has `role="img"` but no accessible name | 4.1.2 |
| `SVG-NAME-002` | error | `aria-labelledby` references an id that does not exist | 4.1.2 |
| `SVG-DECOR-003` | warning | Root SVG has no `role`, no name, and no `aria-hidden` | 1.1.1 |
| `SVG-TITLE-004` | warning | `<title>` exists but is not the first child element | 1.3.1 |
| `SVG-DESC-005` | info | Named graphic has no `<desc>` | 1.1.1 |
| `SVG-ID-006` | error | Duplicate `id` values in the same document | 4.1.1 |
| `SVG-USE-007` | warning | `<use href>` points at a missing id | 1.1.1 |
| `SVG-FOCUS-008` | warning | `tabindex` on a non-interactive element | 2.4.3 |

> Rule IDs and severities are shown for reference; the authoritative set lives in
> `src/rules.ts`.

## CLI

```
svg-a11y <file...> [--json] [--quiet]
svg-a11y --dir <path> [--json] [--quiet]
```

- `--dir <path>` lints every `.svg` in `path` (non-recursive, sorted).
- `--json` emits machine-readable JSON instead of text.
- `--quiet` prints one summary line per file.
- Exit code `0` when no errors, `1` when any file has `counts.error > 0`, `2` on bad usage.

```sh
svg-a11y icon.svg
svg-a11y --dir public/icons
svg-a11y --dir public/icons --quiet
svg-a11y logo.svg --json
```

## Library

```ts
import { auditSvg, formatText, formatJson } from "svg-a11y";

const result = auditSvg(svgSource, "logo.svg");
if (result.counts.error > 0) {
  console.error(formatText(result));
  process.exit(1);
}
```

`auditSvg(source, file?)` returns an `AuditResult` with `issues` and per-severity
`counts`. Lower-level exports — `parseSvg`, `accessibleName`, `runRules` — are also
available.

### JSON output

```json
{
  "file": "logo.svg",
  "issues": [
    {
      "code": "SVG-NAME-001",
      "severity": "error",
      "message": "Graphic has no accessible name",
      "location": "svg",
      "wcag": "4.1.2"
    }
  ],
  "counts": { "error": 1, "warning": 0, "info": 0 }
}
```

## CI

```yaml
- name: Lint SVG accessibility
  run: svg-a11y --dir public/icons
```

The process exits non-zero on the first accessibility error, so a failing icon fails
the build.

## Limitations

- **Static only.** It analyzes the file as text/tree; it does not render the SVG.
- **No contrast checks.** Colour contrast requires computed rendering and is out of
  scope.
- **Accessible-name computation** follows the SVG-AAM priority order
  (`aria-labelledby` → `aria-label` → `<title>` → …) but is **not** a full
  implementation of the specification.
- References to `<use>` targets are resolved within the document only; external
  references are not fetched.

## Development

```sh
bun install
bun run typecheck
bun test
bun run make-fixtures   # writes fixtures/good.svg and fixtures/bad.svg
```

## License

MIT
