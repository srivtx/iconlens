# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-20

### Fixed

- Malformed XML and non-`<svg>` input no longer report clean: they now emit an
  `SVG-PARSE-000` error and the CLI exits `2`, so a CI gate cannot pass on
  unreadable or non-SVG input.
- `--sarif`/`--dir` no longer swallow the following flag as their value.
- Missing files, unreadable directories, and unwritable `--sarif` reports now
  exit `2` with a one-line message instead of an uncaught stack trace.
- `--sarif=<path>` and `--fail-on=<level>` inline forms are supported.
- `--json` over multiple files emits a single valid JSON array.
- `aria-hidden="false"` no longer suppresses `SVG-DECOR-003`.
- `tabindex="-1"` (programmatic focus) is no longer a focus-order violation.
- SARIF `artifactLocation.uri` is the plain file path, not the annotated
  finding location. The site playground emits the same `0.2.0` tool version.

### Added

- `SVG-REF-009`: dangling `aria-describedby` references.
- `-q` as a short alias for `--quiet`, and `-` to read an SVG from stdin.
- Regression tests for every fix above.
- `robots.txt` and `sitemap.xml` for the static site.
- CI bundle-drift gate: `build:site` is rebuilt and `site/assets/demo.js` must
  be byte-identical, alongside `check:site`, `sh -n install.sh` and
  `sh install.sh --help`.

### Changed

- Publish metadata: `author`, a plain-string `repository`, an explicit `files`
  allowlist, and an `exports` map that also exposes `./package.json`.

### Removed

- `peerDependencies.typescript` (moved to `devDependencies`) and
  `publishConfig`, which contradicted the "not published to npm" policy.

## [0.1.0] - 2026-09-19

### Added

- Initial release of `iconlens`.
- `auditSvg(source, file?)` static accessibility audit for standalone SVG files.
- Accessible-name computation following SVG-AAM priority order.
- Rules for missing accessible names, dangling `aria-labelledby`/`aria-describedby`
  references, duplicate ids, broken `<use>` references, `tabindex` on non-interactive
  elements, and out-of-order `<title>`.
- `formatText` and `formatJson` reporters.
- `iconlens` CLI with `--dir`, `--json`, and `--quiet` flags.
- `makeGoodSvg` / `makeBadSvg` fixtures and `writeFixturesTo(dir)` helper.
- GitHub Actions CI running typecheck, tests, and fixture CLI checks.

[0.2.0]: https://github.com/srivtx/iconlens/releases/tag/v0.2.0
[0.1.0]: https://github.com/srivtx/iconlens/releases/tag/v0.1.0
