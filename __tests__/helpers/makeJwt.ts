/**
 * Synthesize a JWT-shaped token for tests.
 *
 * Produces `header.payload.signature` with the given object encoded as the
 * payload. The header and signature are placeholders — the action never
 * validates them — but the three-segment structure must be present.
 */
export function makeJwt(payload: Record<string, unknown>, opts: MakeJwtOptions = {}): string {
  const header = opts.header ?? { alg: 'RS256', typ: 'JWT' };
  const headerSeg = encodeSegment(JSON.stringify(header));
  const payloadSeg = opts.payloadRaw ?? encodeSegment(JSON.stringify(payload));
  const sigSeg = opts.signature ?? 'signature-placeholder';
  return `${headerSeg}.${payloadSeg}.${sigSeg}`;
}

export interface MakeJwtOptions {
  header?: Record<string, unknown>;
  /** If provided, used verbatim as the payload segment (bypasses JSON.stringify). */
  payloadRaw?: string;
  signature?: string;
}

function encodeSegment(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}
