// Shared timeline helpers (entry statuses, colors, quick-add parsing).
export const ENTRY_STATUS = {
  planned: 'Planned', inprogress: 'In progress', delayed: 'Delayed',
  finalized: 'Finalized', implemented: 'Implemented', updated: 'Updated', onhold: 'On hold',
};

export const STATUS_COLOR = {
  planned: '#94A3B8', inprogress: '#2148E0', delayed: '#9A5B12', finalized: '#2B5BC4',
  implemented: '#16A34A', updated: '#5B3FB8', onhold: '#B9690A', future: '#E8920C',
};

const ALIAS = {
  plan: 'planned', planned: 'planned', todo: 'planned', pending: 'planned', backlog: 'planned',
  wip: 'inprogress', progress: 'inprogress', inprogress: 'inprogress', doing: 'inprogress', started: 'inprogress',
  delay: 'delayed', delayed: 'delayed', late: 'delayed',
  done: 'finalized', finalized: 'finalized', finished: 'finalized', complete: 'finalized', completed: 'finalized',
  live: 'implemented', implemented: 'implemented', shipped: 'implemented', deployed: 'implemented',
  update: 'updated', updated: 'updated',
  hold: 'onhold', onhold: 'onhold', blocked: 'onhold', stuck: 'onhold', paused: 'onhold',
};

export const normalizeStatus = (s) => ALIAS[(s || '').toLowerCase().replace(/[^a-z]/g, '')] || 'planned';

// Accepts YYYY-MM or YYYY-MM-DD; returns Date or null.
export function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  return m ? new Date(+m[1], +m[2] - 1, +(m[3] || 1)) : null;
}

export const sortEntries = (entries) => (entries || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

// Parse quick-add lines: `date | comment | status`
export function parseQuickAdd(text) {
  return (text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split('|').map((p) => p.trim());
    const status = normalizeStatus(parts[2]);
    return { date: parts[0] || '', comment: parts[1] || '', status, roadblock: status === 'onhold' ? (parts[3] || '') : '' };
  }).filter((e) => e.date || e.comment);
}
