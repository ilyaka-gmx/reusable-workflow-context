# Architecture — quick reference

A user-facing overview of how the action works at runtime. For build and
release-flow details see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Runtime flow

```
┌──────────────────────────────────────────────┐
│ 1. Pre-flight                                │
│    - require ACTIONS_ID_TOKEN_REQUEST_URL    │
│    - else platform-aware error + setFailed   │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 2. oidc.getToken(audience)                   │
│    via @actions/core.getIDToken()            │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 3. oidc.decodePayload(token)                 │
│    base64-decode payload segment; no verify  │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 4. parse.parseJobWorkflowRef(claim)          │
│    owner/repo/path@ref → structured fields   │
└──────────────────────────────────────────────┘
                       │
                       ▼
                Emit all outputs
```

## Module responsibilities

| Module | Role | Throws? |
|---|---|---|
| `parse.ts` | Pure ref-claim parser | Yes, on malformed input |
| `oidc.ts` | Token fetch + base64 decode | Yes, on malformed token |
| `main.ts` | Orchestration + all error messages | Never (catches all) |

## Platform parity

The same `dist/index.js` runs unchanged on:

- GitHub.com (github-hosted + self-hosted runners)
- GHEC (including single-tenant)
- GHES 3.5+

The action performs no outbound network I/O and depends only on the OIDC
token delivered to the step by the runner. There are no hardcoded hostnames.

## Dual-tag dist

Two published variants from one source tree:

- `v1` — `runs.using: node24` — github.com, GHEC, newer GHES runners
- `v1-node20` — `runs.using: node20` — GHES with bundled older runners

The `main-node20` branch is a cherry-pick overlay of `main` with
`action.yml`'s runtime line swapped. See `.github/workflows/sync-node20-branch.yml`.
