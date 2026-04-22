import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeJwt } from './helpers/makeJwt.js';
import { captureCoreIO, outputsFrom } from './helpers/captureCoreIO.js';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  getIDToken: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
}));

import * as core from '@actions/core';
import { run, preflightErrorMessage } from '../src/main.js';

const io = captureCoreIO(core);

const VALID_REF = 'my-org/my-repo/.github/workflows/ci.yml@refs/tags/v2.4.0';

function setEnv(env: Record<string, string | undefined>): () => void {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    original[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  return () => {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  };
}

function validToken(overrides: Record<string, unknown> = {}): string {
  return makeJwt({
    iss: 'https://token.actions.githubusercontent.com',
    job_workflow_ref: VALID_REF,
    job_workflow_sha: 'deadbeef'.repeat(5),
    ...overrides,
  });
}

describe('preflightErrorMessage', () => {
  it('returns the github.com message for https://github.com', () => {
    expect(preflightErrorMessage('https://github.com')).toMatch(/only required configuration/);
    expect(preflightErrorMessage('https://github.com')).toMatch(/id-token: write/);
  });

  it('returns the ghec message for a *.ghe.com host', () => {
    expect(preflightErrorMessage('https://my-tenant.ghe.com')).toMatch(
      /restricted OIDC for this repository or organization/,
    );
  });

  it('returns the ghes message for any other host', () => {
    expect(preflightErrorMessage('https://ghes.example.com')).toMatch(/GHES administrator/);
  });

  it('returns the ghes message when server URL is blank (safe default)', () => {
    expect(preflightErrorMessage('')).toMatch(/GHES administrator/);
  });
});

describe('run — pre-flight', () => {
  let restoreEnv: () => void = () => undefined;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => restoreEnv());

  it('fails with the github.com message when ACTIONS_ID_TOKEN_REQUEST_URL is missing and server is github.com', async () => {
    restoreEnv = setEnv({
      ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
      GITHUB_SERVER_URL: 'https://github.com',
    });
    await run();
    expect(io.setFailed).toHaveBeenCalledOnce();
    expect(io.setFailed).toHaveBeenCalledWith(expect.stringMatching(/only required configuration/));
  });

  it('fails with the ghec message for a *.ghe.com server URL', async () => {
    restoreEnv = setEnv({
      ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
      GITHUB_SERVER_URL: 'https://my-co.ghe.com',
    });
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/enterprise has restricted OIDC/),
    );
  });

  it('fails with the ghes message for other server URLs', async () => {
    restoreEnv = setEnv({
      ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
      GITHUB_SERVER_URL: 'https://ghes.example.com',
    });
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(expect.stringMatching(/GHES administrator/));
  });
});

describe('run — happy path', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetAllMocks();
    io.getInput.mockReturnValue('');
    io.getIDToken.mockResolvedValue(validToken());
    restoreEnv = setEnv({
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://runner.example/idtoken',
      GITHUB_SERVER_URL: 'https://github.com',
    });
  });

  afterEach(() => restoreEnv());

  it('emits all outputs with parsed values', async () => {
    await run();
    const out = outputsFrom(io.setOutput);
    expect(out.workflow_ref).toBe('v2.4.0');
    expect(out.workflow_full_ref).toBe('refs/tags/v2.4.0');
    expect(out.workflow_ref_type).toBe('tag');
    expect(out.workflow_sha).toBe('deadbeef'.repeat(5));
    expect(out.workflow_repository).toBe('my-org/my-repo');
    expect(out.workflow_repository_owner).toBe('my-org');
    expect(out.workflow_path).toBe('.github/workflows/ci.yml');
    expect(out.job_workflow_ref).toBe(VALID_REF);
    expect(io.setFailed).not.toHaveBeenCalled();
  });

  it('warns and emits empty workflow_sha when the claim is absent', async () => {
    io.getIDToken.mockResolvedValue(validToken({ job_workflow_sha: undefined }));
    await run();
    const out = outputsFrom(io.setOutput);
    expect(out.workflow_sha).toBe('');
    expect(io.warning).toHaveBeenCalledWith(expect.stringContaining('job_workflow_sha'));
  });

  it('passes audience input to getIDToken', async () => {
    io.getInput.mockImplementation((name: string) => (name === 'audience' ? 'my-aud' : ''));
    await run();
    expect(io.getIDToken).toHaveBeenCalledWith('my-aud');
  });

  it('uses the toolkit default audience when input is blank', async () => {
    io.getInput.mockReturnValue('');
    await run();
    expect(io.getIDToken).toHaveBeenCalledWith(undefined);
  });

  it('logs a one-line info headline with the resolved ref', async () => {
    await run();
    const lines = io.info.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Reusable workflow ref: v2.4.0 (tag)');
  });

  it('emits resolved fields at debug level (not info)', async () => {
    await run();
    const debugLines = io.debug.mock.calls.map((call) => String(call[0]));
    expect(debugLines.some((l) => l.startsWith('repository :'))).toBe(true);
    expect(debugLines.some((l) => l.startsWith('sha        :'))).toBe(true);
    const infoLines = io.info.mock.calls.map((call) => String(call[0]));
    expect(infoLines.some((l) => l.startsWith('repository :'))).toBe(false);
  });
});

describe('run — fail-fast branches', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetAllMocks();
    io.getInput.mockReturnValue('');
    restoreEnv = setEnv({
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://runner.example/idtoken',
      GITHUB_SERVER_URL: 'https://github.com',
    });
  });

  afterEach(() => restoreEnv());

  it('fails when getIDToken rejects', async () => {
    io.getIDToken.mockRejectedValue(new Error('runner denied'));
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Failed to retrieve OIDC token'),
    );
  });

  it('fails when the token is malformed', async () => {
    io.getIDToken.mockResolvedValue('not-a-jwt');
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(expect.stringContaining('Malformed OIDC token'));
  });

  it('fails when job_workflow_ref claim is absent', async () => {
    io.getIDToken.mockResolvedValue(validToken({ job_workflow_ref: undefined }));
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("'job_workflow_ref' claim not present"),
    );
  });

  it('fails when job_workflow_ref is malformed', async () => {
    io.getIDToken.mockResolvedValue(validToken({ job_workflow_ref: 'no-at-symbol' }));
    await run();
    expect(io.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Malformed 'job_workflow_ref'"),
    );
  });
});
