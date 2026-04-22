# `reusable-workflow-context`

[![CI](https://github.com/ilyaka-gmx/reusable-workflow-context/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ilyaka-gmx/reusable-workflow-context/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/ilyaka-gmx/reusable-workflow-context?sort=semver)](https://github.com/ilyaka-gmx/reusable-workflow-context/releases)
[![License: MIT](https://img.shields.io/github/license/ilyaka-gmx/reusable-workflow-context)](./LICENSE)
[![Node runtime](https://img.shields.io/badge/runtime-node24-brightgreen?logo=node.js)](./action.yml)

> Expose a reusable workflow's own ref, SHA, repo, and path via the OIDC token — no inputs from the caller, no ref duplication.

When you build a reusable workflow, the workflow itself cannot see which ref it was invoked at. The caller knows, but inside the reusable workflow `github.ref` refers to the **caller**, not to you. Workarounds force users to pass the ref as an input — duplicating information that the platform already has via hardcoded ref from the reusable workflow `uses:`.

This action reads the job's OIDC token and extracts the authoritative `job_workflow_ref` / `job_workflow_sha` claims, parsing them into clean, directly-usable outputs. No inputs from the caller. No ref drift.

- **GitHub.com**, **GHEC**, **GHES 3.5+** all supported from a single source tree
- **Linux** / **macOS** / **Windows**, github-hosted or self-hosted, containerized jobs OK
- Zero network calls — the OIDC token is fetched by the runner itself
- No Octokit, no JWT verification library, no shell-outs

## Without vs. with this action

<table>
<tr>
<th width="50%">❌ Without this action</th>
<th width="50%">✅ With this action</th>
</tr>

<!-- Row 1: Caller workflow -->
<tr>
<td><b>Caller workflow — must pass the ref explicitly</b></td>
<td><b>Caller workflow — nothing extra needed</b></td>
</tr>
<tr>
<td>

```yaml
# caller.yml
jobs:
  call:
    uses: my-org/shared/.github/workflows/reusable.yml@v2.5
    with:
      workflow_ref: v2.5   # ← manual, duplicates "uses" ref
      <other-real-input-params>
```

</td>
<td>

```yaml
# caller.yml
jobs:
  call:
    uses: my-org/shared/.github/workflows/reusable.yml@v2.5
    # no workflow_ref input needed
    <real-input-params>
    permissions: # here or in the workflow level
      contents: read
      id-token: write


```

</td>
</tr>

<!-- Row 2: Inside the reusable workflow -->
<tr>
<td><b>Inside the reusable workflow — reads caller-supplied input</b></td>
<td><b>Inside the reusable workflow — reads from OIDC token</b></td>
</tr>
<tr>
<td>

```yaml
# reusable.yml
on:
  workflow_call:
    inputs:
      workflow_ref:        # ← must declare
        type: string
        ...
      <real-input-params>

jobs:
  work:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.workflow_ref }}   
```

</td>
<td>

```yaml
# reusable.yml
on:
  workflow_call:           # no extra inputs

permissions:
  id-token: write
  contents: read # <- needed permissions

jobs:
  work:
    runs-on: ubuntu-latest
    steps:
      - id: ctx
        uses: ilyaka-gmx/reusable-workflow-context@v1

      - uses: actions/checkout@v4
        with:
          ref: ${{ steps.ctx.outputs.workflow_ref }}  # ← authoritative
```

</td>
</tr>
</table>

## Quick start

```yaml
# .github/workflows/reusable.yml (in your shared-workflows repo)
on:
  workflow_call:

permissions:
  id-token: write
  contents: read

jobs:
  do-work:
    runs-on: ubuntu-latest
    steps:
      - id: ctx
        uses: ilyaka-gmx/reusable-workflow-context@v1

      - name: Check out this reusable workflow's own repo at its own ref
        uses: actions/checkout@v4
        with:
          repository: ${{ steps.ctx.outputs.workflow_repository }}
          ref: ${{ steps.ctx.outputs.workflow_ref }}
          path: _reusable
```

## Outputs

All outputs are strings. An empty string means "not available" (e.g. `workflow_sha` when the `job_workflow_sha` claim is absent).

| Output                      | Example                                                     | Description                                        |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `workflow_ref`              | `v2.4.0`                                                    | Short ref: `refs/tags/` and `refs/heads/` stripped |
| `workflow_full_ref`         | `refs/tags/v2.4.0`                                          | Raw ref including any `refs/…` prefix              |
| `workflow_ref_type`         | `tag`                                                       | One of `tag`, `branch`, `sha`                      |
| `workflow_sha`              | `deadbeef…`                                                 | Commit SHA of the reusable workflow file           |
| `workflow_repository`       | `my-org/my-repo`                                            | Full `owner/repo`                                  |
| `workflow_repository_owner` | `my-org`                                                    | Owner only                                         |
| `workflow_path`             | `.github/workflows/ci.yml`                                  | Workflow file path                                 |
| `job_workflow_ref`          | `my-org/my-repo/.github/workflows/ci.yml@refs/tags/v2.4.0`  | Raw OIDC claim                                     |

## Inputs

| Input      | Type   | Default | Description                                                                                                 |
| ---------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| `audience` | string | `''`    | Custom audience (`aud` claim) for the OIDC token request. Leave blank to use the runner's default audience. |

**When do you need `audience`?** Almost never. The default audience (the GitHub host URL) is what downstream trust policies — cloud providers, Vault, signing services — normally expect. Override it only when the verifier at the other end requires a specific `aud` value (e.g. a cloud OIDC trust policy that pins `aud` to a tenant-specific string).

Example — passing a custom audience:

```yaml
- id: ctx
  uses: ilyaka-gmx/reusable-workflow-context@v1
  with:
    audience: https://my-verifier.example.com
```

## Common use cases

### Stamp build artifacts with exact workflow version

```yaml
- uses: ilyaka-gmx/reusable-workflow-context@v1
  id: ctx
- run: |
    echo "built_by=${{ steps.ctx.outputs.workflow_repository }}@${{ steps.ctx.outputs.workflow_ref }}" > artifact.meta
    echo "built_from_sha=${{ steps.ctx.outputs.workflow_sha }}" >> artifact.meta
```

### Conditional behaviour by workflow ref type

```yaml
- uses: ilyaka-gmx/reusable-workflow-context@v1
  id: ctx

- if: ${{ steps.ctx.outputs.workflow_ref_type == 'tag' }}
  run: echo "Running from a pinned tag — safe to publish"

- if: ${{ steps.ctx.outputs.workflow_ref_type == 'branch' }}
  run: echo "Running from a mutable branch — dry-run only"
```

### Check out the reusable workflow's own repo at its own ref

```yaml
- uses: ilyaka-gmx/reusable-workflow-context@v1
  id: ctx

- uses: actions/checkout@v4
  with:
    repository: ${{ steps.ctx.outputs.workflow_repository }}
    ref: ${{ steps.ctx.outputs.workflow_ref }}
    path: _reusable
```

More examples in [docs/examples/](docs/examples/).

## Requirements & caveats

- **Must be called from inside a reusable workflow** (one triggered by `workflow_call`). Called from a regular workflow, the action fails fast with a clear message.
- **`permissions: id-token: write`** at the workflow or job level is required. **Important:** both in the caller workflow and in the reusable workflow.
- **Supported platforms:** GitHub.com, GitHub Enterprise Cloud (GHEC), GitHub Enterprise Server **3.5 or later** (OIDC with `job_workflow_ref` requires GHES 3.5+).
- **Supported runners:** Linux / macOS / Windows; github-hosted or self-hosted; jobs in containers are fine.

## GHES with Node 20-only runners

This action ships as `runs.using: node24`. If you run on a GHES instance whose bundled runner does not yet support Node 24, we do **not** publish a Node 20 variant — the maintenance cost of dual-publishing is not justified by the shrinking audience.

Instead, fork this repository and repoint the runtime in your fork:

```bash
git clone https://github.com/<your-org>/reusable-workflow-context.git
cd reusable-workflow-context
./script/repoint-to-node20.sh    # rewrites action.yml and rebuilds dist/
git push
git tag v1-node20 && git push --tags
```

Then consume it from the fork:

```yaml
- uses: <your-org>/reusable-workflow-context@v1-node20
```

The source under `src/` is unchanged by the script — only `action.yml` and `dist/index.js` differ from upstream. Re-run the script after pulling new upstream commits.

## How it works

```
┌──────────────────────────────────────────────┐
│ 1. Pre-flight                                │
│    - require ACTIONS_ID_TOKEN_REQUEST_URL    │
│    - else platform-aware error + setFailed   │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 2. Fetch OIDC token via @actions/core        │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 3. base64-decode the JWT payload segment     │
│    (no signature verify — runner is trusted) │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ 4. Parse job_workflow_ref claim into fields  │
│    owner/repo/path@ref → structured outputs  │
└──────────────────────────────────────────────┘
```

Module responsibilities:

| Module | Role | Throws? |
|---|---|---|
| `src/parse.ts` | Pure ref-claim parser | Yes, on malformed input |
| `src/oidc.ts` | Token fetch + base64 decode | Yes, on malformed token |
| `src/main.ts` | Orchestration + all error messages | Never (catches all) |

The action performs no outbound network I/O and depends only on the OIDC token delivered to the step by the runner. There are no hardcoded hostnames. The same `dist/index.js` runs unchanged on GitHub.com, GHEC, and GHES 3.5+.

## Security

This action:

- reads the `iss`, `job_workflow_ref`, and `job_workflow_sha` claims from the OIDC token
- does **not** verify the token signature — the runner issues the token directly to the step, so no untrusted intermediary can tamper with it
- makes **zero** outbound network calls
- never reads `GITHUB_TOKEN` or any other secret

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Notable rules:

- PRs target `main`.
- Every PR runs lint, typecheck, test, build, and a strict `git diff --exit-code dist/` check.
- Third-party GitHub Actions in this repo are tracked by Dependabot; when practical, pin to a full commit SHA for supply-chain safety.

## License

MIT — see [LICENSE](LICENSE).
