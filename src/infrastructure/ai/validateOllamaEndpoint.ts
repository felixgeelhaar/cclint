/**
 * Validate an Ollama base URL before it is passed to fetch (SSRF hardening).
 *
 * Allows http/https only, strips credentials, rejects cloud-metadata hosts,
 * and returns a normalized origin (no path/query/hash).
 */

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

export function validateOllamaEndpoint(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new Error('Ollama endpoint must not be empty.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid Ollama endpoint "${raw}". Expected an absolute http(s) URL.`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `Ollama endpoint must use http or https (got ${url.protocol}).`
    );
  }

  if (url.username !== '' || url.password !== '') {
    throw new Error('Ollama endpoint must not include credentials.');
  }

  const host = url.hostname.toLowerCase();
  if (host === '') {
    throw new Error('Ollama endpoint must include a hostname.');
  }

  if (BLOCKED_HOSTS.has(host) || host.endsWith('.metadata.google.internal')) {
    throw new Error(
      `Ollama endpoint host "${host}" is not allowed (cloud metadata).`
    );
  }

  // Link-local / AWS/GCP/Azure IMDS ranges commonly used in SSRF.
  if (
    host === '169.254.169.254' ||
    host === '169.254.170.2' ||
    host === 'fd00:ec2::254' ||
    host.startsWith('169.254.')
  ) {
    throw new Error(
      `Ollama endpoint host "${host}" is not allowed (link-local / metadata).`
    );
  }

  // Origin only — drop path/query/hash so callers cannot smuggle extra path.
  return url.origin;
}
