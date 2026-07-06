import { create } from 'zustand';
import { api } from '../api';

// Normalize backend tool (snake_case) → UI shape.
const norm = (t) => ({ ...t, hasDemo: t.has_demo });

export const useCatalogStore = create((set, get) => ({
  tools: [],
  loading: false,
  error: '',
  query: '',
  activeCategory: 'All',
  isToolFormOpen: false,
  toolFormDraft: null,
  setIsToolFormOpen: (open) => set({ isToolFormOpen: open }),
  setToolFormDraft: (draft) => set((state) => ({ toolFormDraft: state.toolFormDraft ? { ...state.toolFormDraft, ...draft } : draft })),

  load: async () => {
    set({ loading: true, error: '' });
    try {
      const tools = (await api('/tools')).map(norm);
      set({ tools, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  // Submitting a tool sends it to committee review (status 'pending') — it does
  // NOT appear in the catalog until approved, so we don't add it to the list here.
  addTool: async (data) => norm(await api('/tools', { method: 'POST', body: data })),

  updateTool: async (id, data) => {
    const t = norm(await api(`/tools/${id}`, { method: 'PATCH', body: data }));
    set({ tools: get().tools.map((x) => (x.id === id ? t : x)) });
    return t;
  },

  deleteTool: async (id) => {
    await api(`/tools/${id}`, { method: 'DELETE' });
    set({ tools: get().tools.filter((x) => x.id !== id) });
  },

  deleteToolLog: async (id, index) => {
    const t = norm(await api(`/tools/${id}/logs/${index}`, { method: 'DELETE' }));
    set({ tools: get().tools.map((x) => (x.id === id ? t : x)) });
    return t;
  },

  getDemo: async (id) => (await api(`/tools/${id}/demo`)).demo_html,

  fetchTool: async (id) => {
    const t = norm(await api(`/tools/${id}`));
    set((state) => {
      const exists = state.tools.some((x) => x.id === id);
      const next = exists 
        ? state.tools.map((x) => x.id === id ? t : x) 
        : [...state.tools, t];
      return { tools: next };
    });
    return t;
  },

  sponsorTool: (id, kind, note) => api(`/tools/${id}/sponsor`, { method: 'POST', body: { kind, note } }),

  voteTool: async (id) => {
    const t = norm(await api(`/tools/${id}/vote`, { method: 'POST' }));
    set({ tools: get().tools.map((x) => (x.id === id ? t : x)) });
    return t;
  },

  setQuery: (q) => set({ query: q }),
  setCategory: (c) => set({ activeCategory: c }),
  categories: () => ['All', ...Array.from(new Set(get().tools.map((t) => t.category)))],
  filtered: () => {
    const { tools, query, activeCategory } = get();
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      if (activeCategory !== 'All' && t.category !== activeCategory) return false;
      if (!q) return true;
      const hay = [t.name, t.owner, t.category, t.problem, t.status, (t.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  },
}));
