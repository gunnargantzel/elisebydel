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

export function redactUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return url.split('?')[0] + (url.includes('?') ? '?[REDACTED]' : '');
  }
}
