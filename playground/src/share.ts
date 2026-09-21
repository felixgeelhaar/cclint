/** Compress/decompress playground source for URL hash sharing. */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function encodeSharePayload(text: string): Promise<string> {
  const input = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') {
    return `r${bytesToBase64Url(input)}`;
  }
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return `z${bytesToBase64Url(new Uint8Array(buffer))}`;
}

export async function decodeSharePayload(hash: string): Promise<string | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length < 2) return null;
  const kind = raw[0];
  const body = raw.slice(1);
  try {
    const bytes = base64UrlToBytes(body);
    if (kind === 'r') {
      return new TextDecoder().decode(bytes);
    }
    if (kind === 'z' && typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      const buffer = await new Response(stream).arrayBuffer();
      return new TextDecoder().decode(buffer);
    }
  } catch {
    return null;
  }
  return null;
}
