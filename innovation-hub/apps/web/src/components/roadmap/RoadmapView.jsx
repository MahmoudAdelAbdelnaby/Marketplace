import React, { useEffect, useState } from 'react';
import { useCatalogStore } from '../../store/useCatalogStore';
import { ENTRY_STATUS, STATUS_COLOR, sortEntries, parseDate } from '../../lib/timeline';
import { useNavigate } from 'react-router-dom';

const TOOL_STATUS = [
  { id: 'pilot', label: 'Pilot' },
  { id: 'active', label: 'Active' },
  { id: 'implemented', label: 'Implemented' },
  { id: 'retired', label: 'Retired' },
];
const fmtMoney = (n) => '$' + Math.round(n).toLocaleString();

function Stats({ tools }) {
  const by = (st) => tools.filter((t) => t.status === st).length;
  const totalRoi = tools.reduce((a, t) => a + (t.roi || 0), 0);
  const tile = (label, value, color) => (
    <div style={{ 
      background: 'var(--bg-card)', 
      border: '1px solid var(--border-color)', 
      borderRadius: 14, 
      padding: '16px 18px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
      {tile('In Pilot', by('pilot'), '#00737f')}
      {tile('Active', by('active'), '#00897b')}
      {tile('Implemented', by('implemented'), '#007380')}
      {tile('Retired', by('retired'), '#475569')}
      {tile('Total ROI Savings', fmtMoney(totalRoi) + '/yr', 'var(--success)')}
    </div>
  );
}

function Swimlane({ tools, onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TOOL_STATUS.length}, 1fr)`, gap: 14 }}>
      {TOOL_STATUS.map((col) => {
        const items = tools.filter((t) => t.status === col.id);
        return (
          <div key={col.id} style={{ background: 'var(--secondary)', borderRadius: 14, padding: 12, minHeight: 120 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{col.label} · {items.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((t) => {
                const last = sortEntries(t.timeline).slice(-1)[0];
                const catColor = t.category === 'IX Suite' ? 'var(--primary)' : t.category === 'Tech Infusion' ? '#9333ea' : '#ff8400';
                return (
                  <div key={t.id} onClick={() => onOpen(t)} className="card-hover" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: catColor, marginBottom: 4 }}>@{t.category || 'Tool'}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    {t.roi ? <div style={{ fontSize: 11.5, color: 'var(--success-text)', fontWeight: 700 }}>{fmtMoney(t.roi)}/yr</div> : null}
                    {last && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{last.date} · {ENTRY_STATUS[last.status] || last.status}</div>}
                  </div>
                );
              })}
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Gantt({ tools, onOpen }) {
  const [expandedId, setExpandedId] = useState(null);
  const rows = tools.map((t) => ({ t, ds: (t.timeline || []).map((e) => parseDate(e.date)).filter(Boolean).sort((a, b) => a - b) }));
  const dated = rows.filter((r) => r.ds.length);
  if (!dated.length) return <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24, color: 'var(--text-muted)', fontSize: 13.5 }}>No dated timeline entries yet. Open a tool → Timeline to add entries with dates; they'll plot here.</div>;

  const today = new Date();
  let min = dated[0].ds[0], max = dated[0].ds[0];
  dated.forEach((r) => { if (r.ds[0] < min) min = r.ds[0]; if (r.ds[r.ds.length - 1] > max) max = r.ds[r.ds.length - 1]; });
  if (today < min) min = today; if (today > max) max = today;
  min = new Date(min.getFullYear(), min.getMonth() - 1, 1);
  max = new Date(max.getFullYear(), max.getMonth() + 2, 1);
  const span = Math.max(1, max - min);
  const pct = (d) => ((d - min) / span) * 100;
  const ticks = []; let tk = new Date(min.getFullYear(), Math.floor(min.getMonth() / 3) * 3, 1);
  while (tk < max) { ticks.push(new Date(tk)); tk = new Date(tk.getFullYear(), tk.getMonth() + 3, 1); }
  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20, width: '100%', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ position: 'relative', width: '100%', minWidth: 720 }}>
        <div style={{ position: 'relative', height: 22, marginLeft: 320, borderBottom: '1px solid var(--border-color)' }}>
          {ticks.filter(d => d >= min).map((d, i) => <div key={i} style={{ position: 'absolute', left: pct(d) + '%', top: 2, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', paddingLeft: 4 }}>{d.getFullYear()}·Q{Math.floor(d.getMonth() / 3) + 1}</div>)}
        </div>
        {rows.map(({ t, ds }) => {
          const start = ds.length ? pct(ds[0]) : 0;
          const end = ds.length ? pct(ds[ds.length - 1]) : 0;
          const isExpanded = expandedId === t.id;
          return (
            <React.Fragment key={t.id}>
              <div 
                onClick={() => setExpandedId(isExpanded ? null : t.id)} 
                style={{ 
                  display: 'flex', alignItems: 'center', height: 48, 
                  borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                  background: isExpanded ? 'var(--secondary)' : 'transparent',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ width: 320, flexShrink: 0, paddingRight: 12, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.category === 'IX Suite' ? 'var(--primary)' : t.category === 'Tech Infusion' ? '#9333ea' : '#ff8400', marginRight: 4 }}>
                    @{t.category || 'Tool'}
                  </span>
                  {t.name}<span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.status}{t.roi ? ' · ' + fmtMoney(t.roi) + '/yr' : ''}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: '100%', minWidth: 300 }}>
                  {ds.length > 0 && <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: start + '%', width: Math.max(0.5, end - start) + '%', height: 5, borderRadius: 3, background: 'var(--primary)' }} />}
                  {sortEntries(t.timeline).map((e, i) => {
                    const d = parseDate(e.date); if (!d) return null;
                    const future = (e.date || '') > todayStr;
                    const col = future ? STATUS_COLOR.future : (STATUS_COLOR[e.status] || '#94A3B8');
                    return <div key={i} title={`${e.date} — ${ENTRY_STATUS[e.status] || e.status}: ${e.comment || ''}`} style={{ position: 'absolute', top: '50%', left: pct(d) + '%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', border: `3px solid ${col}` }} />;
                  })}
                  {ds.length === 0 && <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#98A1B8' }}>no dated entries</span>}
                </div>
              </div>

              {isExpanded && (
                <div style={{ 
                  background: 'var(--bg-main)', 
                  borderBottom: '1px solid var(--border-color)',
                  borderLeft: '4px solid var(--primary)',
                  padding: '16px 20px', 
                  display: 'grid', 
                  gridTemplateColumns: '1.2fr 1fr', 
                  gap: 20 
                }}>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>{t.name} Roadmap Details</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {t.problem}
                    </p>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
                      <div><strong style={{ color: 'var(--text-muted)' }}>OWNER:</strong> {t.owner}</div>
                      {t.account && <div><strong style={{ color: 'var(--text-muted)' }}>DEPLOYED CLIENT:</strong> {t.account}</div>}
                      {t.roi > 0 && <div><strong style={{ color: 'var(--text-muted)' }}>ROI SAVINGS:</strong> {fmtMoney(t.roi)}/yr</div>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpen(t); }} 
                      style={{ 
                        marginTop: 14, padding: '7px 14px', borderRadius: 8, 
                        border: 'none', background: 'var(--primary)', color: '#fff', 
                        fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 
                      }}
                    >
                      Open full product details →
                    </button>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: 20, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>MILESTONES ({t.timeline?.length || 0})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto', paddingRight: 6 }}>
                      {sortEntries(t.timeline || []).map((e, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', width: 85, flexShrink: 0 }}>{e.date}</span>
                          <span style={{ fontSize: 12, flex: 1, color: 'var(--text-secondary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{e.comment}</span>
                          <span style={{ 
                            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, 
                            color: STATUS_COLOR[e.status] || '#94A3B8', textTransform: 'uppercase',
                            background: (STATUS_COLOR[e.status] || '#94A3B8') + '14', padding: '2px 5px', borderRadius: 4,
                            flexShrink: 0
                          }}>{e.status}</span>
                        </div>
                      ))}
                      {(!t.timeline || t.timeline.length === 0) && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No timeline entries.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>Dot per update · click row to expand roadmap details &amp; open tool.</div>
    </div>
  );
}

export default function RoadmapView() {
  const { tools, load } = useCatalogStore();
  const [mode, setMode] = useState('swim');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();
  
  useEffect(() => { if (tools.length === 0) load(); }, [tools.length, load]);
  const onOpen = (t) => { navigate(`/tools/${t.id}`); };

  const filteredTools = tools.filter(t => selectedCategory === 'All' || t.category === selectedCategory);
  const totalRoi = filteredTools.reduce((a, t) => a + (t.roi || 0), 0);

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1400, margin: '0 auto', padding: '32px 24px 64px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: 0 }}>Portfolio roadmap</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
            Total Products: <span style={{ color: 'var(--text-primary)' }}>{filteredTools.length}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', background: 'var(--secondary)', borderRadius: 999, padding: 4, gap: 4 }}>
          {[{ id: 'swim', label: 'Swimlane' }, { id: 'gantt', label: 'Timeline' }].map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: mode === m.id ? 'var(--primary)' : 'transparent', color: mode === m.id ? '#fff' : 'var(--text-secondary)' }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Category/Pillar Filter Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', 'IX Suite', 'Tech Infusion', 'Innovations Hub'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12.5,
              background: selectedCategory === cat ? 'var(--text-primary)' : 'var(--bg-card)',
              color: selectedCategory === cat ? 'var(--bg-card)' : 'var(--text-secondary)'
            }}
          >
            {cat === 'All' ? 'All Pillars' : `@${cat}`}
          </button>
        ))}
      </div>

      <Stats tools={filteredTools} />
      {mode === 'swim' ? <Swimlane tools={filteredTools} onOpen={onOpen} /> : <Gantt tools={filteredTools} onOpen={onOpen} />}
    </div>
  );
}
