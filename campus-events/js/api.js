/**
 * api.js — 前端访问后端的唯一入口
 * 所有请求都带 Cookie（会话在 HttpOnly Cookie 里，前端拿不到 token，更安全）。
 */

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data);
  }
  return data;
}

/* ---- 常用接口 ---- */

export async function getMe() {
  try {
    const data = await api('/auth/me');
    return data.user || null;
  } catch {
    return null;
  }
}

export const login = (account, password) =>
  api('/auth/login', { method: 'POST', body: { account, password } });

export const register = (payload) => api('/auth/register', { method: 'POST', body: payload });

export const logout = () => api('/auth/logout', { method: 'POST' });

export const fetchMeta = () => api('/meta');

export const fetchActivities = (params = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return api(`/activities${suffix ? `?${suffix}` : ''}`);
};

export const fetchActivity = (id) => api(`/activities/${encodeURIComponent(id)}`);

export const createActivity = (payload) =>
  api('/activities', { method: 'POST', body: payload });

export const deleteActivity = (id) =>
  api(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const setVisibility = (id, hidden) =>
  api(`/activities/${encodeURIComponent(id)}/visibility`, { method: 'POST', body: { hidden } });

export const fetchComments = (id) => api(`/activities/${encodeURIComponent(id)}/comments`);

export const postComment = (id, payload) =>
  api(`/activities/${encodeURIComponent(id)}/comments`, { method: 'POST', body: payload });

export const reseed = () => api('/admin/reseed', { method: 'POST' });
