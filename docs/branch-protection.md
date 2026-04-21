# Branch protection configuration

Apply these rules via **Settings → Branches → Branch protection rules** in the
GitHub UI, or via `gh api`. Only the aggregator job (`all-checks-passed`) needs
to be listed as a required status check, so matrix changes don't require
reconfiguration.

---

## `main`

| Setting | Value |
|---|---|
| Require a pull request before merging | ✅ Yes |
| Required approving reviews | 1 |
| Dismiss stale pull request approvals when new commits are pushed | ✅ Yes |
| Require review from Code Owners | ✅ Yes |
| Require status checks to pass before merging | ✅ Yes |
| Required status checks | `all-checks-passed` |
| Require branches to be up to date before merging | ✅ Yes |
| Require conversation resolution before merging | ✅ Yes |
| Require signed commits | ✅ Yes |
| Require linear history | ✅ Yes |
| Include administrators | ✅ Yes |
| Allow force pushes | ❌ No |
| Allow deletions | ❌ No |

---

## `main-node20`

This branch is written exclusively by `github-actions[bot]` via the
`sync-node20-branch.yml` workflow. Human pushes are not expected.

| Setting | Value |
|---|---|
| Require a pull request before merging | ❌ No (bot pushes directly) |
| Require status checks to pass before merging | ✅ Yes |
| Required status checks | `all-checks-passed` |
| Require branches to be up to date before merging | ✅ Yes |
| Require signed commits | ❌ No (GitHub Actions commits are not GPG-signed) |
| Restrict pushes | Restrict to `github-actions[bot]` |
| Allow force pushes | ❌ No |
| Allow deletions | ❌ No |

---

## Tags

Protect the floating major tags and all vX.Y.Z / vX.Y.Z-node20 patterns via
the **Tag protection rules**:

- `v*` — protected (only `Release` workflow should create/move them)
- `v*-node20` — protected

---

## Applying via `gh`

```bash
gh api --method PUT \
  "repos/ilyaka-gmx/reusable-workflow-context/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["all-checks-passed"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": true
}
JSON
```
