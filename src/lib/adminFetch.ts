const TOKEN_KEY = 'sz_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper that adds the admin auth token.
 * Automatically clears token and reloads on 401.
 */
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearAdminToken();
    window.location.reload();
  }

  return res;
}
