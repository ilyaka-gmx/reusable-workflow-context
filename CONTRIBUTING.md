# Contributing to `reusable-workflow-context`

Thanks for your interest. This guide covers the local developer setup, the CI
gates your PR must pass, and the two-branch dual-tag model for releases.

## Prerequisites

- Node.js 20.x (the `.node-version` file locks the dev Node version)
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

- **`main`** is the primary development branch. Its `action.yml` declares
  `runs.using: node24`.
- **`main-node20`** is an auto-synced sibling: identical source, but its
  `action.yml` declares `runs.using: node20` and `dist/` is rebuilt against
  the Node 20 environment. It is produced by `.github/workflows/sync-node20-branch.yml`
  on every push to `main`.

**Do not open PRs against `main-node20` directly.** Make your change on `main`;
the sync workflow will cherry-pick it. If a cherry-pick fails, the workflow
opens an issue tagged `sync-conflict` and halts further syncs until resolved.

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
6. Update `CHANGELOG.md` under the `Unreleased` section.

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

Releases are triggered manually via the `Release` workflow dispatch. The
workflow enforces pre-flight guards and produces dual tags. The
[`script/release.sh`](script/release.sh) helper can be run locally to verify
all invariants before clicking dispatch.

Rollback, if a release is only partially tagged:

```bash
git push --delete origin v<X.Y.Z>
git push --delete origin v<X.Y.Z>-node20
git tag -d v<X.Y.Z> v<X.Y.Z>-node20
# Re-point v<major> floating tags if they were moved.
```

Then re-dispatch once the root cause is fixed.

## Code of Conduct

This project follows [Contributor Covenant 2.1](CODE_OF_CONDUCT.md).
