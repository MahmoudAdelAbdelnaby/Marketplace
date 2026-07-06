import { create } from 'zustand';
import { api } from '../api';

export const useVocStore = create((set, get) => ({
  vocs: [],
  loading: false,
  error: '',

  load: async () => {
    set({ loading: true, error: '' });
    try {
      const vocs = await api('/voc');
      set({ vocs, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  addVoc: async (data) => {
    const v = await api('/voc', { method: 'POST', body: data });
    set({ vocs: [v, ...get().vocs] });
    return v;
  },

  updateVoc: async (id, data) => {
    const v = await api(`/voc/${id}`, { method: 'PATCH', body: data });
    set({ vocs: get().vocs.map((x) => (x.id === id ? v : x)) });
    return v;
  },

  deleteVoc: async (id) => {
    await api(`/voc/${id}`, { method: 'DELETE' });
    set({ vocs: get().vocs.filter((x) => x.id !== id) });
  },

  voteVoc: async (id) => {
    const v = await api(`/voc/${id}/vote`, { method: 'POST' });
    set({ vocs: get().vocs.map((x) => (x.id === id ? v : x)) });
    return v;
  },
}));
