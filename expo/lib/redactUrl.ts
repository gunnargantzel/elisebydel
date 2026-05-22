const SENSITIVE_QUERY_PARAMS = new Set([
  'access_token',
  'code',
  'id_token',
  'session_state',
  'refresh_token',
  'client_secret',
  'password',
  'token',
]);

const SENSITIVE_HASH_PATTERN =
  /(?:^|[&#])(?:access_token|code|id_token|session_state|refresh_token|token)=/i;

function redactHashFragment(url: string): string {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return url;
  const beforeHash = url.slice(0, hashIndex);
  const fragment = url.slice(hashIndex + 1);
  if (SENSITIVE_HASH_PATTERN.test(fragment) || fragment.includes('=')) {
    return `${beforeHash}#[REDACTED]`;
  }
  return url;
}

export function redactUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  const withRedactedHash = redactHashFragment(url);

  try {
    const parsed = new URL(withRedactedHash);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    let result = parsed.toString();
    if (withRedactedHash.includes('#[REDACTED]') && !result.includes('#[REDACTED]')) {
      const base = `${parsed.origin}${parsed.pathname}${parsed.search}`;
      result = `${base}#[REDACTED]`;
    }
    return result;
  } catch {
    if (withRedactedHash.includes('#[REDACTED]')) {
      return withRedactedHash.split('#')[0] + '#[REDACTED]';
    }
    return withRedactedHash.split('?')[0] + (withRedactedHash.includes('?') ? '?[REDACTED]' : '');
  }
}
