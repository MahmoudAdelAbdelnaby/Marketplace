import { create } from 'zustand';
import { api, getToken, setToken } from '../api';

export const useAuthStore = create((set) => ({
  user: null,
  ready: false,
  error: '',

  init: async () => {
    if (!getToken()) { set({ ready: true }); return; }
    try {
      const user = await api('/auth/me');
      set({ user, ready: true });
    } catch {
      setToken('');
      set({ user: null, ready: true });
    }
  },

  register: async (data) => {
    const r = await api('/auth/register', { method: 'POST', body: data, auth: false });
    if (r.waiting) {
      return { waiting: true, message: r.message };
    }
    setToken(r.token);
    set({ user: r.user, error: '' });
    return r.user;
  },

  login: async (data) => {
    const r = await api('/auth/login', { method: 'POST', body: data, auth: false });
    setToken(r.token);
    set({ user: r.user, error: '' });
    return r.user;
  },

  logout: () => { setToken(''); set({ user: null }); },
  setUser: (user) => set({ user }),
  reloadUser: async () => {
    try {
      const user = await api('/auth/me');
      set({ user });
    } catch (e) {}
  },
}));
