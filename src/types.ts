/**
 * Shared type definitions for the action.
 *
 * These types describe:
 *  - the subset of OIDC JWT claims this action reads
 *  - the parsed shape of `job_workflow_ref`
 *
 * No types here depend on the GitHub Actions toolkit; all module boundaries
 * in `src/` exchange plain data via these interfaces.
 */

/**
 * The subset of OIDC token claims the action consumes.
 *
 * The token carries many more claims than these; we pick only what's needed
 * to identify the reusable workflow. Unknown fields are ignored (tolerated
 * by schema drift).
 */
export interface OidcClaims {
  /** Issuer URL. Always present on a well-formed OIDC token. */
  iss: string;
  /**
   * `owner/repo/path@ref` describing the reusable workflow file at the ref
   * that was loaded. Present only when the job runs inside a reusable workflow.
   */
  job_workflow_ref?: string;
  /** Commit SHA of the reusable workflow file. */
  job_workflow_sha?: string;
}

/** The three prefixes we recognise in `job_workflow_ref` after `@`. */
export type WorkflowRefType = 'tag' | 'branch' | 'sha';

/**
 * Parsed representation of `claims.job_workflow_ref`.
 *
 * Example input: `my-org/my-repo/.github/workflows/ci.yml@refs/tags/v2.4.0`
 * produces:
 * ```
 * {
 *   repository_owner: "my-org",
 *   repository: "my-org/my-repo",
 *   path: ".github/workflows/ci.yml",
 *   ref_full: "refs/tags/v2.4.0",
 *   ref: "v2.4.0",
 *   ref_type: "tag",
 * }
 * ```
 */
export interface ParsedWorkflowRef {
  repository_owner: string;
  repository: string;
  path: string;
  /** The raw ref part after `@`, including any `refs/...` prefix. */
  ref_full: string;
  /** The ref with `refs/tags/` or `refs/heads/` stripped; SHA or name as-is. */
  ref: string;
  ref_type: WorkflowRefType;
}

/** Names of every output the action can emit. Keeping a central list lets
 *  `main.ts` iterate over them uniformly and lets tests reference a single
 *  source of truth. */
export const OUTPUT_NAMES = [
  'workflow_ref',
  'workflow_full_ref',
  'workflow_ref_type',
  'workflow_sha',
  'workflow_repository',
  'workflow_repository_owner',
  'workflow_path',
  'job_workflow_ref',
] as const;

export type OutputName = (typeof OUTPUT_NAMES)[number];
