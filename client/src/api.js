// The one place the React app talks to the server. Every call:
//   - sends the JWT as "Authorization: Bearer <token>"
//   - turns the server's { error: { code, message } } envelope into a thrown Error
//   - on 401 forgets the token and tells the app to show the login screen

const TOKEN_KEY = 'leaveflow.token';
let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// localStorage can throw (private windows, blocked storage) — never let that break the app.
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* the session just won't survive a reload */ }
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server — is it running?');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data?.error?.code || 'ERROR';
    const message = data?.error?.message || `Request failed (${res.status})`;
    // A bad login is a 401 too, but that one should just show its message.
    if (res.status === 401 && path !== '/auth/login') {
      setToken(null);
      onUnauthorized();
    }
    throw new ApiError(res.status, code, message);
  }
  return data;
}
