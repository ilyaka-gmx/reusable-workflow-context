import * as core from '@actions/core';
import type { OidcClaims } from './types.js';

/**
 * Fetch the job's OIDC token from the runner.
 *
 * Delegates to `@actions/core.getIDToken()`, which uses
 * `ACTIONS_ID_TOKEN_REQUEST_URL` / `ACTIONS_ID_TOKEN_REQUEST_TOKEN` set by
 * the runner when `permissions: id-token: write` is granted.
 *
 * @param audience Optional custom audience. Empty string → toolkit default.
 */
export async function getToken(audience: string): Promise<string> {
  const aud = audience.length > 0 ? audience : undefined;
  return core.getIDToken(aud);
}

/**
 * Decode the **payload** segment of a JWT without verifying its signature.
 *
 * Signature verification is unnecessary here: the runner issues the token
 * directly to the step, so no untrusted intermediary can tamper with it.
 *
 * @throws {Error} if the token is not three segments, the payload is not
 *   valid base64url, or the decoded text is not valid JSON.
 */
export function decodePayload(token: string): OidcClaims {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Malformed OIDC token: empty token string');
  }
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed OIDC token: expected JWT with header.payload.signature');
  }
  const payloadB64 = segments[1]!;

  let payloadText: string;
  try {
    payloadText = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch (err) {
    throw new Error(`Failed to decode OIDC token payload: ${errorMessage(err)}`, {
      cause: err,
    });
  }
  if (payloadText.length === 0) {
    throw new Error('Failed to decode OIDC token payload: empty payload segment');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch (err) {
    throw new Error(`Failed to parse OIDC token payload as JSON: ${errorMessage(err)}`, {
      cause: err,
    });
  }
  if (!isRecord(payload)) {
    throw new Error('Failed to parse OIDC token payload as JSON: not an object');
  }
  if (typeof payload.iss !== 'string' || payload.iss.length === 0) {
    throw new Error("OIDC token payload missing required 'iss' claim");
  }

  const claims: OidcClaims = { iss: payload.iss };
  if (typeof payload.job_workflow_ref === 'string') {
    claims.job_workflow_ref = payload.job_workflow_ref;
  }
  if (typeof payload.job_workflow_sha === 'string') {
    claims.job_workflow_sha = payload.job_workflow_sha;
  }

  return claims;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
