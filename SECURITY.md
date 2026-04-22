# Security policy

## Supported versions

| Version | Supported |
|---|---|
| `v1.x` (node24 runtime) | Yes |
| Pre-1.0 / unreleased | No |

Upstream publishes the `node24` runtime only. Consumers on GHES with
Node 20-only bundled runners maintain their own fork (see the README's
"GHES with Node 20-only runners" section); vulnerability fixes land on
`main` and forks can pull and rebuild.

## Reporting a vulnerability

If you believe you have found a security vulnerability in this action, please
**do not open a public issue**. Instead:

1. Open a [private security advisory](https://github.com/ilyaka-gmx/reusable-workflow-context/security/advisories/new)
   on GitHub, or
2. Email the maintainer (see the `author` field in `action.yml`) with the
   subject line `SECURITY: reusable-workflow-context`.

Please include:

- A description of the issue and its impact
- Steps to reproduce
- The version tag (`v1.x.x` or commit SHA) you tested against

You should receive an acknowledgement within 72 hours. Fixes for confirmed
vulnerabilities will be released via the normal `v1` tag track, with a GitHub
Security Advisory published simultaneously.

## What this action does with secrets

- **Reads the OIDC ID token** for the current step via `@actions/core.getIDToken()`.
  The token is used to extract claims (`iss`, `job_workflow_ref`,
  `job_workflow_sha`) and is never persisted, logged, printed, or exfiltrated.
- **Never reads `GITHUB_TOKEN`** or any other repository secret.
- **Makes zero outbound network calls.** The OIDC token is fetched by the
  runner itself via `@actions/core.getIDToken()`; the action performs no
  additional HTTP requests.

## Why the JWT signature is not verified

The OIDC token is obtained directly from the runner daemon via the
`ACTIONS_ID_TOKEN_REQUEST_URL` / `ACTIONS_ID_TOKEN_REQUEST_TOKEN` environment
variables that GitHub's runner sets for steps with `permissions: id-token: write`.
No untrusted intermediary sits between the runner and this step, so the claims
can be treated as authentic. Verifying the RSA signature would add a
`jsonwebtoken` dependency (plus JWK fetch) and buy no additional security in
this threat model.

If you have a scenario where you need a verified token downstream, use the
`job_workflow_ref` output and fetch/verify the token yourself using
`@actions/core.getIDToken()` in a follow-up step.

## Supply chain

- Runtime deps pinned and limited to `@actions/core`.
- Third-party GitHub Actions referenced in this repo's workflows are tracked
  by Dependabot for weekly updates. Where practical, pin to a full commit SHA
  for stronger supply-chain guarantees.
- `dist/` is built via `@vercel/ncc` and committed to the repo. CI rejects
  PRs where `dist/` does not match a fresh build of source.
