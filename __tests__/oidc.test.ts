import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeJwt } from './helpers/makeJwt.js';

vi.mock('@actions/core', () => ({
  getIDToken: vi.fn(),
}));

import * as core from '@actions/core';
import { decodePayload, getToken } from '../src/oidc.js';

const getIDTokenMock = vi.mocked(core.getIDToken);

describe('decodePayload — happy path', () => {
  it('decodes a valid three-segment JWT with all claims present', () => {
    const token = makeJwt({
      iss: 'https://token.actions.githubusercontent.com',
      job_workflow_ref: 'owner/repo/.github/workflows/ci.yml@refs/tags/v1',
      job_workflow_sha: 'deadbeef'.repeat(5),
      sub: 'ignored',
    });
    const claims = decodePayload(token);
    expect(claims.iss).toBe('https://token.actions.githubusercontent.com');
    expect(claims.job_workflow_ref).toBe('owner/repo/.github/workflows/ci.yml@refs/tags/v1');
    expect(claims.job_workflow_sha).toBe('deadbeef'.repeat(5));
  });

  it('decodes a token with only the mandatory iss claim', () => {
    const token = makeJwt({ iss: 'https://token.actions.githubusercontent.com' });
    const claims = decodePayload(token);
    expect(claims.iss).toBe('https://token.actions.githubusercontent.com');
    expect(claims.job_workflow_ref).toBeUndefined();
    expect(claims.job_workflow_sha).toBeUndefined();
  });

  it('preserves unicode in string claims', () => {
    const ref = 'owner/repo/.github/workflows/café.yml@refs/heads/feat/ünicode';
    const token = makeJwt({
      iss: 'https://token.actions.githubusercontent.com',
      job_workflow_ref: ref,
    });
    expect(decodePayload(token).job_workflow_ref).toBe(ref);
  });

  it('ignores non-string values in the optional claim fields', () => {
    const token = makeJwt({
      iss: 'https://token.actions.githubusercontent.com',
      job_workflow_ref: 42 as unknown as string,
      job_workflow_sha: { bad: true } as unknown as string,
    });
    const claims = decodePayload(token);
    expect(claims.job_workflow_ref).toBeUndefined();
    expect(claims.job_workflow_sha).toBeUndefined();
  });
});

describe('decodePayload — failure modes', () => {
  it('throws on an empty string', () => {
    expect(() => decodePayload('')).toThrow(/empty token/);
  });

  it('throws on a two-segment token', () => {
    expect(() => decodePayload('aaa.bbb')).toThrow(/header\.payload\.signature/);
  });

  it('throws on a four-segment token', () => {
    expect(() => decodePayload('aaa.bbb.ccc.ddd')).toThrow(/header\.payload\.signature/);
  });

  it('throws when the payload is not valid JSON', () => {
    const token = makeJwt(
      {},
      { payloadRaw: Buffer.from('not json', 'utf8').toString('base64url') },
    );
    expect(() => decodePayload(token)).toThrow(/Failed to parse OIDC token payload as JSON/);
  });

  it('throws when the payload decodes to a non-object JSON value', () => {
    const token = makeJwt(
      {},
      { payloadRaw: Buffer.from('"just a string"', 'utf8').toString('base64url') },
    );
    expect(() => decodePayload(token)).toThrow(/not an object/);
  });

  it('throws when the payload decodes to a JSON array', () => {
    const token = makeJwt({}, { payloadRaw: Buffer.from('[1,2,3]', 'utf8').toString('base64url') });
    expect(() => decodePayload(token)).toThrow(/not an object/);
  });

  it('throws when iss is missing', () => {
    const token = makeJwt({ sub: 'no-iss-here' });
    expect(() => decodePayload(token)).toThrow(/missing required 'iss'/);
  });

  it('throws when iss is an empty string', () => {
    const token = makeJwt({ iss: '' });
    expect(() => decodePayload(token)).toThrow(/missing required 'iss'/);
  });

  it('throws when the payload segment is empty', () => {
    expect(() => decodePayload('aaa..ccc')).toThrow(/empty payload/);
  });

  it('rejects non-string token input', () => {
    expect(() => decodePayload(undefined as unknown as string)).toThrow();
    expect(() => decodePayload(null as unknown as string)).toThrow();
  });
});

describe('getToken', () => {
  beforeEach(() => {
    getIDTokenMock.mockReset();
  });

  it('calls core.getIDToken with undefined audience when audience is empty', async () => {
    getIDTokenMock.mockResolvedValue('token-1');
    await expect(getToken('')).resolves.toBe('token-1');
    expect(getIDTokenMock).toHaveBeenCalledWith(undefined);
  });

  it('passes a non-empty audience through to core.getIDToken', async () => {
    getIDTokenMock.mockResolvedValue('token-2');
    await expect(getToken('my-audience')).resolves.toBe('token-2');
    expect(getIDTokenMock).toHaveBeenCalledWith('my-audience');
  });

  it('propagates errors from core.getIDToken', async () => {
    getIDTokenMock.mockRejectedValue(new Error('runner blew up'));
    await expect(getToken('')).rejects.toThrow(/runner blew up/);
  });
});
