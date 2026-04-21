import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type * as coreTypes from '@actions/core';

export interface CoreIO {
  setOutput: Mock;
  setFailed: Mock;
  info: Mock;
  debug: Mock;
  warning: Mock;
  getInput: Mock;
  getIDToken: Mock;
}

/**
 * Return typed vitest mocks for the `@actions/core` surface the action uses.
 * The module must already be mocked at the top of the importing test file
 * via `vi.mock('@actions/core', ...)`.
 */
export function captureCoreIO(core: typeof coreTypes): CoreIO {
  return {
    setOutput: vi.mocked(core.setOutput),
    setFailed: vi.mocked(core.setFailed),
    info: vi.mocked(core.info),
    debug: vi.mocked(core.debug),
    warning: vi.mocked(core.warning),
    getInput: vi.mocked(core.getInput),
    getIDToken: vi.mocked(core.getIDToken),
  };
}

/** Collect all setOutput calls into a simple name→value map. */
export function outputsFrom(setOutput: Mock): Record<string, string> {
  const out: Record<string, string> = {};
  for (const call of setOutput.mock.calls) {
    const [name, value] = call as [string, string];
    out[name] = value;
  }
  return out;
}
