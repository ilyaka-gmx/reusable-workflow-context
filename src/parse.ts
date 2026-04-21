import type { ParsedWorkflowRef, WorkflowRefType } from './types.js';

/**
 * Parse the `job_workflow_ref` claim into structured fields.
 *
 * Input grammar (per GitHub docs):
 *   `<owner>/<repo>/<path>@<ref>`
 *
 * Where:
 *  - `<owner>/<repo>` are the first two path segments
 *  - `<path>` is everything between (joined by `/`)
 *  - `<ref>` may be a full `refs/tags/<name>`, `refs/heads/<name>`, a bare SHA,
 *    or (rarely) a bare name. Branch names can contain `@`; workflow file
 *    paths under `.github/workflows/` cannot — so the **first** `@` is the
 *    separator and everything after it is the ref (including any nested `@`).
 *
 * Pure function. No I/O, no mutation, no dependence on the toolkit.
 *
 * @throws {Error} when the input cannot be parsed into owner/repo/path@ref
 */
export function parseJobWorkflowRef(input: string): ParsedWorkflowRef {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('empty job_workflow_ref');
  }

  const atIndex = input.indexOf('@');
  if (atIndex < 0) {
    throw new Error(`missing '@' separator in job_workflow_ref: '${input}'`);
  }

  const pathPart = input.slice(0, atIndex);
  const refFull = input.slice(atIndex + 1);

  if (pathPart.length === 0) {
    throw new Error(`empty repository path in job_workflow_ref: '${input}'`);
  }
  if (refFull.length === 0) {
    throw new Error(`empty ref in job_workflow_ref: '${input}'`);
  }

  const segments = pathPart.split('/').filter((s) => s.length > 0);
  if (segments.length < 3) {
    throw new Error(`job_workflow_ref must contain owner/repo/path (got '${pathPart}')`);
  }

  const owner = segments[0]!;
  const repo = segments[1]!;
  const path = segments.slice(2).join('/');

  const { ref, ref_type } = classifyRef(refFull);

  return {
    repository_owner: owner,
    repository: `${owner}/${repo}`,
    path,
    ref_full: refFull,
    ref,
    ref_type,
  };
}

/**
 * Classify a ref string as tag/branch/sha and produce its short form.
 *
 * - `refs/tags/<name>` → { ref: name, ref_type: 'tag' }
 * - `refs/heads/<name>` → { ref: name, ref_type: 'branch' }
 * - 40-hex-char string → { ref: sha, ref_type: 'sha' }
 * - anything else → { ref: input, ref_type: 'branch' } (safe default — GitHub
 *   has historically emitted bare branch names here before the `refs/heads`
 *   prefix was normalized.)
 */
function classifyRef(refFull: string): { ref: string; ref_type: WorkflowRefType } {
  if (refFull.startsWith('refs/tags/')) {
    return { ref: refFull.slice('refs/tags/'.length), ref_type: 'tag' };
  }
  if (refFull.startsWith('refs/heads/')) {
    return { ref: refFull.slice('refs/heads/'.length), ref_type: 'branch' };
  }
  if (/^[0-9a-f]{40}$/.test(refFull)) {
    return { ref: refFull, ref_type: 'sha' };
  }
  return { ref: refFull, ref_type: 'branch' };
}
