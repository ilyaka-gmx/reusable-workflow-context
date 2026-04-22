#!/usr/bin/env bash
# Repoint a fork of reusable-workflow-context to the Node 20 runtime.
#
# For consumers on older GHES instances whose bundled runner does not yet ship
# Node 24. The upstream repo does not publish a node20 variant; instead,
# fork this repo and run this script once to produce a node20-compatible build.
#
# Usage:
#   ./script/repoint-to-node20.sh
#
# Effects:
#   1. Rewrites `action.yml` runtime from `node24` to `node20`.
#   2. Reinstalls dependencies and rebuilds `dist/`.
#   3. Stages and commits the result on the current branch.
#
# After running, tag the resulting commit (e.g. `v1-node20`) and consume the
# action from your fork:
#
#   uses: your-org/reusable-workflow-context@v1-node20
#
# The source under `src/` is unchanged by this script — only `action.yml` and
# `dist/index.js` differ from upstream.

set -euo pipefail

if [[ ! -f action.yml ]]; then
  echo "Error: action.yml not found. Run this from the repo root." >&2
  exit 1
fi

if ! grep -qE 'using:[[:space:]]*"?node24"?' action.yml; then
  if grep -qE 'using:[[:space:]]*"?node20"?' action.yml; then
    echo "action.yml already set to node20 — nothing to change."
    exit 0
  fi
  echo "Error: action.yml runtime line not recognized (expected node24 or node20)." >&2
  exit 1
fi

echo "==> Rewriting action.yml runtime: node24 → node20"
sed -i.bak -E 's/using:[[:space:]]*"?node24"?/using: "node20"/' action.yml
rm -f action.yml.bak

echo "==> Installing dependencies"
npm ci

echo "==> Building dist/"
npm run build

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Warning: not inside a git repo — skipping commit step."
  echo "Changes are on disk; commit them in your fork manually."
  exit 0
fi

git add action.yml dist/
if git diff --staged --quiet; then
  echo "Nothing to commit (action.yml and dist/ already on node20)."
else
  git commit -m "chore: repoint action runtime to node20"
  echo
  echo "Done. Commit created on $(git rev-parse --abbrev-ref HEAD)."
  echo "Tag and push from your fork, then use:"
  echo "  uses: <your-fork>/reusable-workflow-context@<your-tag>"
fi
