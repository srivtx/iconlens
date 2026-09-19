# Contributing to iconlens

Thanks for helping improve SVG accessibility tooling. This document covers what
you need to build, test, and submit a change.

## Development setup

iconlens targets [Bun](https://bun.sh) and TypeScript in strict mode.

```bash
git clone https://github.com/srivtx/iconlens.git
cd iconlens
bun install
```

Run the CLI from source while you work:

```bash
bun run src/cli.ts fixtures/bad.svg
```

## The gate

Every pull request must pass the same gate CI runs:

```bash
bunx tsc --noEmit && bun test
```

Do not open a PR with a red typecheck or a failing test. Fix the cause rather
than disabling a rule or test.

## Fixtures

`fixtures/` holds the SVGs the tests run against. They are generated, not
hand-edited:

```bash
bun run make-fixtures
```

`good.svg` has a valid accessible name and `bad.svg` is intentionally broken.
When you add a rule, add an SVG that exercises it and assert on the emitted
issue codes in `tests/rules.test.ts`. CLI behavior belongs in
`tests/cli.test.ts`. Accessible-name computation cases should cover
`aria-labelledby`, `<title>`, and their precedence.

## Code style

- Strict TypeScript. No `any` to silence a type error, no non-null assertions
  to dodge null checks.
- No new runtime dependencies without discussion in an issue first. The offline
  and dependency-light posture is a feature.
- No network access, ever. Parsing and linting are local operations.
- Keep accessible-name computation separate from rule reporting so the
  SVG-AAM logic stays testable on its own.
- Match the surrounding style; keep modules small and focused.
- No comments unless they explain something non-obvious.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>

fix(rules): resolve aria-labelledby before falling back to title
feat(rules): flag dangling IDREFs in aria-describedby
test(accessible-name): cover nested title elements
docs: document the exit codes
```

Common types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`. Useful scopes:
`rules`, `accessible-name`, `cli`.

## Pull request checklist

- [ ] Tests added or updated for the change.
- [ ] `bunx tsc --noEmit` is clean.
- [ ] `bun test` passes.
- [ ] Docs (`README.md`) updated when behavior or flags change.
- [ ] Commit messages follow Conventional Commits.
