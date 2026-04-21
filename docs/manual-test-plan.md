# Manual test plan — GHES and other non-CI-reachable scenarios

The automated matrix in `integration-caller.yml` exercises the action on
every runner combination we can script in GitHub Actions. These scenarios
**cannot** be automated there and must be verified by a human before each
release that ships a `-node20` tag.

This plan is a **release gate** for any `-node20` tag.

---

## Prerequisites

- Access to a GHES 3.17 instance (current release target)
- Access to a GHES 3.5 instance (floor — minimum supported)
- (Optional) Access to a GHEC tenant with a restrictive OIDC policy

---

## Scenario 1 — GHES 3.17, full happy path

1. Fork `reusable-workflow-context` into your GHES instance.
2. Create a test calling workflow that invokes the reusable workflow shipped
   in `docs/examples/basic.yml`.
3. Tag the fork with `v1-node20` pointing to your `main-node20` branch.
4. Run the calling workflow.
5. **Verify** all outputs are non-empty and match expected values:
   - `workflow_repository` matches the fork's `owner/repo`
   - `workflow_ref` / `workflow_full_ref` / `workflow_ref_type` reflect how the
     calling workflow referenced the reusable workflow
   - `workflow_sha` is a 40-char hex SHA
   - `workflow_path` is the reusable workflow's file path

---

## Scenario 2 — GHES 3.5, smoke test

Same as Scenario 1 but against a GHES 3.5 instance. Critical checks:

- `job_workflow_ref` claim is present (GHES 3.5 is the floor)
- All outputs populate correctly

If `job_workflow_ref` is absent on GHES 3.5, the fail-fast message must
include the "GHES 3.5 or later" hint.

---

## Scenario 3 — GHEC with restricted OIDC policy

On a GHEC tenant where the OIDC enterprise policy blocks the test repo:

1. Run a calling workflow that attempts to invoke the action.
2. **Verify:** the action fails fast with the GHEC-specific pre-flight message
   that mentions enterprise policy restrictions.

---

## Sign-off

Record sign-off in the PR or release checklist:

```
- [x] Scenario 1 — GHES 3.17: PASS (tester: <name>, date: <YYYY-MM-DD>)
- [x] Scenario 2 — GHES 3.5:  PASS
- [x] Scenario 3 — GHEC restricted OIDC: PASS (or N/A with justification)
```
