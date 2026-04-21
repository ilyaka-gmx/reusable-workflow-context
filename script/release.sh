#!/usr/bin/env bash
# Dual-tag release orchestration — local preview of what release.yml does on CI.
#
# Usage:
#   script/release.sh <version> [--skip-node20]
#
# Does NOT push tags; it only verifies invariants and prints what would happen.
# Use the GitHub Actions workflow_dispatch ("Release" workflow) to actually tag
# and publish. This script is primarily a safety net for local verification
# before clicking the dispatch button.

set -euo pipefail

VERSION="${1:-}"
SKIP_NODE20=0
shift || true
for arg in "$@"; do
  case "$arg" in
    --skip-node20) SKIP_NODE20=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version> [--skip-node20]" >&2
  exit 2
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be MAJOR.MINOR.PATCH (got '$VERSION')" >&2
  exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "main" ]]; then
  echo "Error: must be run on the 'main' branch (currently on '$branch')" >&2
  exit 1
fi

if git rev-parse --verify "v$VERSION" >/dev/null 2>&1; then
  echo "Error: tag v$VERSION already exists" >&2
  exit 1
fi

if ! grep -qE "^## \[?v?$VERSION\]?" CHANGELOG.md; then
  echo "Error: CHANGELOG.md has no section for $VERSION" >&2
  exit 1
fi

echo "==> Verifying working tree is clean"
if ! git diff --quiet HEAD; then
  echo "Error: working tree has uncommitted changes" >&2
  exit 1
fi

echo "==> Verifying dist/ matches a fresh build on main"
npm ci --silent
npm run build --silent
if ! git diff --exit-code dist/ >/dev/null; then
  echo "Error: dist/ is out of date" >&2
  git diff --stat dist/
  exit 1
fi

echo "==> Verifying main ↔ main-node20 source lockstep"
git fetch origin main-node20:main-node20 --quiet
if ! git diff --quiet main main-node20 -- \
    src/ __tests__/ package.json package-lock.json tsconfig.json; then
  echo "Error: main and main-node20 diverge outside action.yml/dist/:" >&2
  git diff --stat main main-node20 -- src/ __tests__/ package.json package-lock.json tsconfig.json
  exit 1
fi

echo
echo "All invariants OK. Would tag:"
echo "  v$VERSION           → on main"
echo "  v${VERSION%%.*}    → force-moved to main"
if [[ "$SKIP_NODE20" -eq 0 ]]; then
  echo "  v$VERSION-node20    → on main-node20"
  echo "  v${VERSION%%.*}-node20 → force-moved to main-node20"
fi
echo
echo "To actually publish, dispatch the 'Release' workflow on GitHub."
