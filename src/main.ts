import * as core from '@actions/core';
import { getToken, decodePayload } from './oidc.js';
import { parseJobWorkflowRef } from './parse.js';
import type { OidcClaims, ParsedWorkflowRef } from './types.js';

const DOCS = {
  dotcom:
    'https://docs.github.com/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect',
  ghec: 'https://docs.github.com/enterprise-cloud@latest/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect',
  ghes: 'https://docs.github.com/enterprise-server@latest/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect',
} as const;

/**
 * Entry point. Returns nothing; failures go through `core.setFailed`.
 *
 * Execution flow:
 *   0. Pre-flight: ACTIONS_ID_TOKEN_REQUEST_URL must be set
 *   1. Fetch + decode OIDC token (fail-fast on malformed token)
 *   2. Parse job_workflow_ref (fail-fast on missing/malformed claim)
 *   3. Emit Tier A outputs
 */
export async function run(): Promise<void> {
  try {
    if (!preflightCheck()) return;

    const audience = core.getInput('audience');

    let token: string;
    try {
      token = await getToken(audience);
    } catch (err) {
      core.setFailed(
        `Failed to retrieve OIDC token despite environment being configured. Original error: ${errorMessage(
          err,
        )}. Check the runner logs for details.`,
      );
      return;
    }

    let claims: OidcClaims;
    try {
      claims = decodePayload(token);
    } catch (err) {
      core.setFailed(errorMessage(err));
      return;
    }

    if (claims.job_workflow_ref === undefined || claims.job_workflow_ref.length === 0) {
      core.setFailed(
        "'job_workflow_ref' claim not present in OIDC token. This action must be called from inside a reusable workflow (a workflow triggered by 'workflow_call'). Note: on GitHub Enterprise Server, the 'job_workflow_ref' claim requires GHES 3.5 or later.",
      );
      return;
    }

    let parsed: ParsedWorkflowRef;
    try {
      parsed = parseJobWorkflowRef(claims.job_workflow_ref);
    } catch (err) {
      core.setFailed(
        `Malformed 'job_workflow_ref' claim: '${claims.job_workflow_ref}'. Expected format: owner/repo/path@ref. Details: ${errorMessage(
          err,
        )}`,
      );
      return;
    }

    emitOutputs(parsed, claims);
  } catch (err) {
    core.setFailed(`Unexpected error: ${errorMessage(err)}`);
  }
}

function preflightCheck(): boolean {
  if ((process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? '').length === 0) {
    core.setFailed(preflightErrorMessage(process.env.GITHUB_SERVER_URL ?? ''));
    return false;
  }
  return true;
}

/** Craft the platform-appropriate error message for the missing-OIDC case. */
export function preflightErrorMessage(serverUrl: string): string {
  const normalized = serverUrl.toLowerCase();
  if (normalized === 'https://github.com') {
    return [
      "OIDC token unavailable. Set 'permissions: id-token: write' at the workflow or job level.",
      'This is the only required configuration on GitHub.com.',
      `Docs: ${DOCS.dotcom}`,
    ].join(' ');
  }
  if (hostOf(normalized).endsWith('.ghe.com')) {
    return [
      "OIDC token unavailable. Set 'permissions: id-token: write' at the workflow or job level.",
      'If already set, check whether your enterprise has restricted OIDC for this repository or organization.',
      `Docs: ${DOCS.ghec}`,
    ].join(' ');
  }
  return [
    "OIDC token unavailable. Set 'permissions: id-token: write' at the workflow or job level.",
    'If already set, ask your GHES administrator to verify that OIDC for Actions is enabled on this instance (GHES 3.5+ required).',
    `Docs: ${DOCS.ghes}`,
  ].join(' ');
}

function emitOutputs(parsed: ParsedWorkflowRef, claims: OidcClaims): void {
  core.setOutput('workflow_ref', parsed.ref);
  core.setOutput('workflow_full_ref', parsed.ref_full);
  core.setOutput('workflow_ref_type', parsed.ref_type);
  core.setOutput('workflow_sha', claims.job_workflow_sha ?? '');
  core.setOutput('workflow_repository', parsed.repository);
  core.setOutput('workflow_repository_owner', parsed.repository_owner);
  core.setOutput('workflow_path', parsed.path);
  core.setOutput('job_workflow_ref', claims.job_workflow_ref ?? '');

  if (claims.job_workflow_sha === undefined || claims.job_workflow_sha.length === 0) {
    core.warning("'job_workflow_sha' claim absent; workflow_sha left empty.");
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Entry execution — skipped under vitest (vitest sets VITEST).
if (process.env.VITEST === undefined) {
  void run();
}
