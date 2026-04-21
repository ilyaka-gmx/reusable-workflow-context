# Changelog

All notable changes to `reusable-workflow-context` are documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

### Added

- **Reusable workflow self-identity outputs** (always populated, fail-fast if the
  `job_workflow_ref` claim is missing): `workflow_ref`, `workflow_full_ref`,
  `workflow_ref_type`, `workflow_sha`, `workflow_repository`,
  `workflow_repository_owner`, `workflow_path`, `job_workflow_ref`.
- Platform-aware pre-flight error messages for GitHub.com, GHEC, and GHES.
- Dual-tag release strategy: `v1` (Node 24, default) and `v1-node20` (Node 20, for
  older bundled runners).
- Unit tests (Vitest) covering parse, OIDC decode, and end-to-end orchestration.
  Property tests via fast-check for the ref parser.
