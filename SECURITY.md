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
- **No rendering or execution.** iconlens does not run scripts, fetch linked
  resources, or rasterize the image; it only reads the markup.
- **No code execution from input.** `<script>`, event handlers, and external
  hrefs in an asset are never evaluated or followed.

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
