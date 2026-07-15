// Tiny fetch wrapper for the local demo backend.
export const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export const getToken = () => localStorage.getItem('hub_token') || '';
export const setToken = (t) => {
  if (t) localStorage.setItem('hub_token', t);
  else localStorage.removeItem('hub_token');
};

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch { detail = res.statusText; }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}
