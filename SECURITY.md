# Security Policy

## iconlens

iconlens lints standalone SVG assets. It parses an untrusted `.svg` document,
computes the accessible name per SVG-AAM, and reports structural failures such
as a missing title, a dangling IDREF, or bad focus order.

## Supported versions

The latest commit on `main` is the only supported version. Security fixes land
on `main` and ship in the next tagged release. Older tags do not receive
backports.

| Version | Supported |
| --- | --- |
| Latest on `main` | Yes |
| Older tags | No |

## Threat model

- **Offline by design.** iconlens contains no network code. It never opens a
  socket, resolves an external reference from an SVG, or checks for updates.
- **No telemetry.** Nothing about your files, your usage, or your machine is
  collected or transmitted.
- **Files never leave the machine.** Parsing and linting run in-process and
  locally.
- **Untrusted input.** An SVG is treated as hostile: XML is parsed without
  loading external entities or resolving remote DTDs, and a malformed, deeply
  nested, or oversized document must fail safely rather than exhaust the
  process.
- **Bounded input.** An input larger than **16 MiB (16,777,216 bytes)** is
  rejected *before* parsing, for both files and standard input. The file size
  is checked with `stat` and standard input is streamed through a capped
  reader, so an oversized document is never read fully into memory. The CLI
  prints an `SVG-PARSE-000` error and exits `2`.
- **No rendering or execution.** iconlens does not run scripts, fetch linked
  resources, or rasterize the image; it only reads the markup.
- **No code execution from input.** `<script>`, event handlers, and external
  hrefs in an asset are never evaluated or followed.

## Resource limits and exit codes

The maximum accepted input is **16 MiB (16,777,216 bytes)**; anything larger
produces an `SVG-PARSE-000` error and does not reach the XML parser. The CLI's
exit codes are:

| Code | Meaning |
| --- | --- |
| `0` | No issues at or above `--fail-on` |
| `1` | At least one issue at or above `--fail-on` |
| `2` | Invalid usage, input over the 16 MiB limit, or input that is not a well-formed SVG |
| `3` | I/O error: an input file could not be read, or the report could not be written |

An unexpected failure inside the rule engine is surfaced as an `SVG-PARSE-000`
internal error (exit `2`); it is never reported as a clean result.

## Reporting a vulnerability

Report privately through GitHub Security Advisories on the repository:

https://github.com/srivtx/iconlens/security/advisories/new

Do not open a public issue for a suspected vulnerability. Include a
description, the affected revision, a minimal reproducer (an SVG fixture where
possible), and any suggested fix. Expect an acknowledgement within a few days.

## Verifying a build

```bash
bun install
bunx tsc --noEmit
bun test
```

This installs the locked dependency set, typechecks in strict mode, and runs
the test suite against the generated fixtures. In CI the same gate runs on
every push and pull request.
