# Contributing to `reusable-workflow-context`

Thanks for your interest. This guide covers the local developer setup, the CI
gates your PR must pass, and the release process.

## Prerequisites

- Node.js 24.x (the `.node-version` file locks the dev Node version to match
  the runtime declared in `action.yml`)
- `npm` 10+

## Local developer workflow

```bash
npm ci                    # install dependencies
npm run lint              # ESLint
npm run format:check      # Prettier
npm run typecheck         # tsc --noEmit
npm test                  # Vitest
npm run build             # ncc → dist/index.js
git diff --exit-code dist/   # must be clean after build
```

One-shot that mirrors the CI gate:

```bash
npm run ci-local
```

## Branch model

`main` is the only long-lived branch. The action is published as `runs.using: node24`. Users on GHES instances with Node 20-only runners are expected to fork and run `script/repoint-to-node20.sh` (see the README for details); upstream does not publish a `-node20` variant.

## Opening a PR

1. Fork and branch from `main`.
2. Run `npm run ci-local`. If anything fails, fix it before pushing.
3. Keep commits focused. Use conventional-ish prefixes (`feat:`, `fix:`, `chore:`,
   `docs:`, `test:`) for the summary line.
4. **Always** commit a rebuilt `dist/` alongside source changes. CI will reject
   PRs where `dist/` is stale.
5. Add or update tests when behaviour changes. The action is fail-fast by
   design: every failure path needs a test that asserts the exact
   `core.setFailed` message shape.

## Required status checks

Your PR must pass the aggregator job `all-checks-passed` in `ci.yml`, which
depends on:

- `lint-and-format`
- `typecheck`
- `test` (Linux, macOS, Windows)
- `build-and-dist-check`

Integration tests (`integration-caller.yml`) run alongside CI; failures there
block merge.

## Coding standards

- TypeScript `strict` mode is on, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables`.
- The parser and OIDC decode paths throw on malformed input; `main.ts` catches
  and translates those into `core.setFailed` with user-actionable messages.
- No runtime dependencies beyond `@actions/core`.
  Any new runtime dependency requires discussion in an issue first.
- Dev dependencies: new additions OK if justified, but prefer the dev tools
  already in use.

## Releasing (maintainer note)

Releases are triggered manually via the `Release` workflow dispatch with a
`MAJOR.MINOR.PATCH` version input. The workflow:

1. Verifies the dispatcher is on `main` and (optionally) in
   `vars.RELEASE_ALLOWLIST`.
2. Verifies the tag doesn't already exist and that a fresh `npm run build`
   leaves `dist/` clean.
3. Creates `vX.Y.Z` and force-moves the floating `vX` major tag to `main`.
4. Publishes a GitHub Release whose body is auto-generated from commits and
   PRs merged since the previous tag (`generate_release_notes: true`).

Because release notes are auto-generated, commit and PR titles are the source
of truth: prefer descriptive, conventional-ish titles.

Rollback, if a release is only partially tagged:

```bash
git push --delete origin v<X.Y.Z>
git tag -d v<X.Y.Z>
# Re-point the v<major> floating tag if it was moved.
```

Then re-dispatch once the root cause is fixed.

## Code of Conduct

This project follows [Contributor Covenant 2.1](CODE_OF_CONDUCT.md).
