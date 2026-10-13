/**
 * Validates a redirect target path to prevent Open Redirect vulnerabilities.
 * Ensures the destination is a safe relative URL within the current origin.
 */
export function getSafeRedirectUrl(target: string | null | undefined, fallback: string = '/account'): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Empty or whitespace-only targets fallback
  if (!trimmed) {
    return fallback;
  }

  // Target must begin with a single slash '/'
  // Explicitly reject protocol-relative URLs (starting with '//')
  // and Windows UNC or backslash evasion (starting with '/\')
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Reject backslashes anywhere in the target string
  if (trimmed.includes('\\')) {
    return fallback;
  }

  // Prevent scheme evasion like /https://evil.com or javascript:
  try {
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(trimmed, dummyOrigin);

    // Origin must match dummyOrigin and pathname must start with '/'
    if (parsed.origin !== dummyOrigin || !parsed.pathname.startsWith('/')) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
