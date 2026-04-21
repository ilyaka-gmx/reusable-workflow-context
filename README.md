# `reusable-workflow-context`

> Expose a reusable workflow's own ref, SHA, repo, and path via the OIDC token — no inputs from the caller, no ref duplication.

When you build a reusable workflow, the workflow itself cannot see which ref it was invoked at. The caller knows, but inside the reusable workflow `github.ref` refers to the **caller**, not to you. Workarounds force users to pass the ref as an input — duplicating information that the platform already has.

This action reads the job's OIDC token and extracts the authoritative `job_workflow_ref` / `job_workflow_sha` claims, parsing them into clean, directly-usable outputs. No inputs from the caller. No ref drift.

- **GitHub.com**, **GHEC**, **GHES 3.5+** all supported from a single source tree
- **Linux** / **macOS** / **Windows**, github-hosted or self-hosted, containerized jobs OK
- Zero network calls — the OIDC token is fetched by the runner itself
- No Octokit, no JWT verification library, no shell-outs

## Quick start (GitHub.com / GHEC)

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

## Quick start (GitHub Enterprise Server with Node 20 Runner)

GHES still bundles older runners that do not support Node 24. Pin to the `-node20` track:

```yaml
- uses: ilyaka-gmx/reusable-workflow-context@v1-node20
```

Everything else is identical. Once your GHES upgrade supports Node 24, you can switch back to `@v1`.

## Outputs

All outputs are strings. An empty string means "not available" (e.g. `workflow_sha` when the `job_workflow_sha` claim is absent).


| Output                      | Example                                                    | Description                                        |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `workflow_ref`              | `v2.4.0`                                                   | Short ref: `refs/tags/` and `refs/heads/` stripped |
| `workflow_full_ref`         | `refs/tags/v2.4.0`                                         | Raw ref including any `refs/…` prefix              |
| `workflow_ref_type`         | `tag`                                                      | One of `tag`, `branch`, `sha`                      |
| `workflow_sha`              | `deadbeef…`                                                | Commit SHA of the reusable workflow file           |
| `workflow_repository`       | `my-org/my-repo`                                           | Full `owner/repo`                                  |
| `workflow_repository_owner` | `my-org`                                                   | Owner only                                         |
| `workflow_path`             | `.github/workflows/ci.yml`                                 | Workflow file path                                 |
| `job_workflow_ref`          | `my-org/my-repo/.github/workflows/ci.yml@refs/tags/v2.4.0` | Raw OIDC claim                                     |


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

More examples under `[docs/examples/](docs/examples/)`.

## Requirements & caveats

- **Must be called from inside a reusable workflow** (one triggered by `workflow_call`). Called from a regular workflow, the action fails fast with a clear message.
- `**permissions: id-token: write`** at the workflow or job level is required.
- **Cross-org reusable workflows** need `id-token: write` at the caller level too (GitHub enforces this).
- **Supported platforms:** GitHub.com, GitHub Enterprise Cloud (GHEC), GitHub Enterprise Server **3.5 or later** (OIDC with `job_workflow_ref` requires GHES 3.5+).
- **Supported runners:** Linux / macOS / Windows; github-hosted or self-hosted; jobs in containers are fine.
- **GHES users:** pin `@v1-node20` until your GHES runners support Node 24.

## Security

This action:

- reads the `iss`, `job_workflow_ref`, and `job_workflow_sha` claims from the OIDC token
- does **not** verify the token signature — the runner issues the token directly to the step, so no untrusted intermediary can tamper with it
- makes **zero** outbound network calls
- never reads `GITHUB_TOKEN` or any other secret

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Notable rules:

- PRs target `main`. The `main-node20` branch is auto-synced; do not PR it directly.
- Every PR runs lint, typecheck, test, build, and a strict `git diff --exit-code dist/` check.
- All third-party GitHub Actions used in this repo are SHA-pinned; Dependabot keeps them current.

## License

MIT — see [LICENSE](LICENSE).