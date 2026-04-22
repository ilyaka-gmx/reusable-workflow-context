import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseJobWorkflowRef } from '../src/parse.js';

describe('parseJobWorkflowRef — happy path', () => {
  it('parses a tag ref', () => {
    const result = parseJobWorkflowRef('my-org/my-repo/.github/workflows/ci.yml@refs/tags/v2.4.0');
    expect(result).toEqual({
      repository_owner: 'my-org',
      repository: 'my-org/my-repo',
      path: '.github/workflows/ci.yml',
      ref_full: 'refs/tags/v2.4.0',
      ref: 'v2.4.0',
      ref_type: 'tag',
    });
  });

  it('parses a branch ref', () => {
    const result = parseJobWorkflowRef('my-org/my-repo/.github/workflows/ci.yml@refs/heads/main');
    expect(result.ref).toBe('main');
    expect(result.ref_type).toBe('branch');
    expect(result.ref_full).toBe('refs/heads/main');
  });

  it('parses a 40-char SHA ref', () => {
    const sha = 'a'.repeat(40);
    const result = parseJobWorkflowRef(`owner/repo/.github/workflows/ci.yml@${sha}`);
    expect(result.ref).toBe(sha);
    expect(result.ref_type).toBe('sha');
    expect(result.ref_full).toBe(sha);
  });

  it('parses a bare branch ref (no refs/heads prefix) as branch', () => {
    const result = parseJobWorkflowRef('owner/repo/.github/workflows/ci.yml@main');
    expect(result.ref).toBe('main');
    expect(result.ref_type).toBe('branch');
  });

  it('parses deeply nested workflow paths', () => {
    const result = parseJobWorkflowRef(
      'owner/repo/.github/workflows/nested/dir/file.yml@refs/tags/v1',
    );
    expect(result.path).toBe('.github/workflows/nested/dir/file.yml');
  });

  it('supports workflow paths with dots', () => {
    const result = parseJobWorkflowRef('owner/repo/.github/workflows/build.prod.yml@refs/tags/v1');
    expect(result.path).toBe('.github/workflows/build.prod.yml');
  });
});

describe('parseJobWorkflowRef — edge cases', () => {
  it('splits on the FIRST @ so branch names with @ in them are preserved', () => {
    const result = parseJobWorkflowRef('owner/repo/.github/workflows/ci.yml@refs/heads/feat@foo');
    expect(result.ref_full).toBe('refs/heads/feat@foo');
    expect(result.ref).toBe('feat@foo');
    expect(result.ref_type).toBe('branch');
  });

  it('preserves owner/repo exactly as supplied (case-sensitive)', () => {
    const result = parseJobWorkflowRef('My-Org/My-Repo/.github/workflows/ci.yml@refs/tags/v1');
    expect(result.repository_owner).toBe('My-Org');
    expect(result.repository).toBe('My-Org/My-Repo');
  });

  it('treats short (39-char) hex strings as branches, not SHAs', () => {
    const almostSha = 'a'.repeat(39);
    const result = parseJobWorkflowRef(`owner/repo/.github/workflows/ci.yml@${almostSha}`);
    expect(result.ref_type).toBe('branch');
  });

  it('treats 40-char non-hex strings as branches, not SHAs', () => {
    const notHex = 'z'.repeat(40);
    const result = parseJobWorkflowRef(`owner/repo/.github/workflows/ci.yml@${notHex}`);
    expect(result.ref_type).toBe('branch');
  });

  it('tolerates doubled slashes in the path by collapsing empty segments', () => {
    const result = parseJobWorkflowRef('owner/repo/.github//workflows/ci.yml@refs/tags/v1');
    expect(result.repository).toBe('owner/repo');
    expect(result.path).toBe('.github/workflows/ci.yml');
  });
});

describe('parseJobWorkflowRef — failure modes', () => {
  it('throws on empty input', () => {
    expect(() => parseJobWorkflowRef('')).toThrow(/empty/);
  });

  it('throws when no @ is present', () => {
    expect(() => parseJobWorkflowRef('owner/repo/.github/workflows/ci.yml')).toThrow(/missing '@'/);
  });

  it('throws when the path part is empty', () => {
    expect(() => parseJobWorkflowRef('@refs/tags/v1')).toThrow(/empty repository path/);
  });

  it('throws when the ref part is empty', () => {
    expect(() => parseJobWorkflowRef('owner/repo/.github/workflows/ci.yml@')).toThrow(/empty ref/);
  });

  it('throws when fewer than 3 path segments are present (missing workflow path)', () => {
    expect(() => parseJobWorkflowRef('owner/repo@refs/tags/v1')).toThrow(/owner\/repo\/path/);
  });

  it('throws on a single-segment path', () => {
    expect(() => parseJobWorkflowRef('lone@refs/tags/v1')).toThrow(/owner\/repo\/path/);
  });

  it('rejects non-string input with a throw', () => {
    expect(() => parseJobWorkflowRef(undefined as unknown as string)).toThrow();
    expect(() => parseJobWorkflowRef(null as unknown as string)).toThrow();
  });
});

describe('parseJobWorkflowRef — property-based (fast-check)', () => {
  const segment = fc
    .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/)
    .filter((s) => s.length > 0 && s.length <= 40);

  it('is total over owner/repo/path@refs/tags/<name> shapes', () => {
    fc.assert(
      fc.property(segment, segment, segment, segment, (owner, repo, dir, name) => {
        const input = `${owner}/${repo}/.github/workflows/${dir}/${name}.yml@refs/tags/${name}`;
        const result = parseJobWorkflowRef(input);
        expect(result.repository_owner).toBe(owner);
        expect(result.repository).toBe(`${owner}/${repo}`);
        expect(result.path).toBe(`.github/workflows/${dir}/${name}.yml`);
        expect(result.ref).toBe(name);
        expect(result.ref_type).toBe('tag');
      }),
      { numRuns: 200 },
    );
  });

  it('is injective on distinct valid inputs', () => {
    fc.assert(
      fc.property(segment, segment, segment, segment, (a, b, c, d) => {
        fc.pre(a !== b || c !== d);
        const inputA = `${a}/${c}/.github/workflows/ci.yml@refs/tags/v1`;
        const inputB = `${b}/${d}/.github/workflows/ci.yml@refs/tags/v1`;
        fc.pre(inputA !== inputB);
        const ra = parseJobWorkflowRef(inputA);
        const rb = parseJobWorkflowRef(inputB);
        expect(ra.repository_owner !== rb.repository_owner || ra.repository !== rb.repository).toBe(
          true,
        );
      }),
      { numRuns: 100 },
    );
  });
});
