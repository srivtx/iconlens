# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/example/iconlens/releases/tag/v0.1.0
