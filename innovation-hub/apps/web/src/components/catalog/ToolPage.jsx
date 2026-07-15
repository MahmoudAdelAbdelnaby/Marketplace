import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Pencil, Trash2, Plus, Globe, Code, PlayCircle, Presentation, HandHeart, CalendarClock, ChevronUp, Check, RotateCcw, Ban, ExternalLink } from 'lucide-react';
import { useCatalogStore } from '../../store/useCatalogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ENTRY_STATUS, STATUS_COLOR, sortEntries, parseQuickAdd, parseDate } from '../../lib/timeline';
import ToolForm from './ToolForm';
import { api } from '../../api';

const STATUS_STYLE = {
  active: { bg: 'rgba(37,226,204,0.15)', fg: 'var(--primary-text)' },
  pilot: { bg: 'rgba(255,132,0,0.15)', fg: 'var(--badge-fg-pilot)' },
  beta: { bg: 'rgba(204,50,98,0.15)', fg: 'var(--danger)' },
  planned: { bg: 'rgba(148,163,184,0.15)', fg: 'var(--badge-fg-planned)' },
};
const fmtMoney = (n) => (n ? '$' + Math.round(n).toLocaleString() : null);
const ytEmbed = (u) => { const m = (u || '').match(/(?:youtu\.be\/|v=)([\w-]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}` : null; };

// Red-ink helpers
function cssPath(el, doc) {
  if (!el || el.nodeType !== 1) return '';
  const parts = [];
  while (el && el.nodeType === 1 && el !== doc.documentElement) {
    let part = el.tagName.toLowerCase();
    if (el.id) {
      parts.unshift(part + '#' + el.id);
      break;
    }
    const parent = el.parentNode;
    if (parent) {
      const sibs = [...parent.children].filter(c => c.tagName === el.tagName);
      if (sibs.length > 1) {
        part += `:nth-of-type(${sibs.indexOf(el) + 1})`;
      }
    }
    parts.unshift(part);
    el = parent && parent.nodeType === 1 ? parent : null;
  }
  return parts.join(' > ');
}

function elLabel(el) {
  const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return `<${el.tagName.toLowerCase()}>${txt ? ` “${txt}${txt.length >= 60 ? '…' : ''}”` : ''}`;
}

function Section({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (<div style={{ marginBottom: 16 }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{title}</div><div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div></div>);
}
function StatusBadge({ status }) { const c = STATUS_COLOR[status] || '#94A3B8'; return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: c, background: c + '1f', borderRadius: 5, padding: '2px 6px' }}>{ENTRY_STATUS[status] || status}</span>; }

function SponsorBox({ tool }) {
  const sponsorTool = useCatalogStore((s) => s.sponsorTool);
  const [open, setOpen] = useState(false); const [kind, setKind] = useState('sponsor'); const [note, setNote] = useState(''); const [sent, setSent] = useState(false);
  const send = async () => { 
    api(`/tools/${tool.id}/track-action`, { method: 'POST', body: { action_type: `request_${kind}` }, auth: true }).catch(() => {});
    await sponsorTool(tool.id, kind, note); 
    setSent(true); 
  };
  if (sent) return <div style={{ background: 'var(--secondary)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--primary-text)', fontWeight: 600 }}>✓ Sent to the product owner — they'll be in touch.</div>;
  return (
    <div style={{ marginTop: 14, border: '1px solid var(--border-color)', borderRadius: 12, padding: 14 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5 }}><HandHeart size={16} /> Adopt / sponsor / request a meeting</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Register interest</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['sponsor', 'Sponsor'], ['adopt', 'Adopt'], ['meeting', 'Meet']].map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} style={{ flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${kind === k ? 'var(--primary)' : 'var(--border-color)'}`, background: kind === k ? 'var(--secondary)' : 'var(--bg-card)', fontWeight: 600, fontSize: 13 }}>{l}</button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'meeting' ? 'Propose a time / topic for the meetup…' : 'Why do you / your client need this? (optional)'} style={{ minHeight: 56 }} />
          <button onClick={send} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13 }}>{kind === 'meeting' ? <><CalendarClock size={15} /> Request meeting</> : 'Send to product owner'}</button>
        </div>
      )}
    </div>
  );
}

function HorizontalTimeline({ entries }) {
  const [viewMode, setViewMode] = useState('date');
  const sorted = useMemo(() => sortEntries(entries || []), [entries]);
  
  const entriesWithWeeks = useMemo(() => {
    if (!sorted.length) return [];
    const baseTime = new Date(sorted[0].date).getTime();
    return sorted.map((e) => {
      const t = new Date(e.date).getTime();
      if (isNaN(t) || isNaN(baseTime)) return { ...e, displayDate: e.date };
      const diffDays = Math.floor((t - baseTime) / (1000 * 60 * 60 * 24));
      const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
      return { 
        ...e, 
        displayDate: viewMode === 'date' ? e.date : `Week ${weekNum}` 
      };
    });
  }, [sorted, viewMode]);

  if (!entriesWithWeeks.length) {
    return <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No timeline entries yet.</div>;
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Visual Project Timeline</div>
        <div style={{ display: 'flex', background: 'var(--secondary)', borderRadius: 8, padding: 2, gap: 2 }}>
          <button 
            type="button"
            onClick={() => setViewMode('date')} 
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: viewMode === 'date' ? 'var(--primary)' : 'transparent', color: viewMode === 'date' ? '#fff' : 'var(--text-secondary)' }}
          >
            Date
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('week')} 
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: viewMode === 'week' ? 'var(--primary)' : 'transparent', color: viewMode === 'week' ? '#fff' : 'var(--text-secondary)' }}
          >
            Week
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: Math.max(480, entriesWithWeeks.length * 180), position: 'relative', padding: '16px 10px 16px' }}>
          {/* Horizontal Line track */}
          <div style={{ position: 'absolute', top: 93, left: 30, right: 30, height: 3, background: 'var(--border-color)', zIndex: 1 }} />
          
          {entriesWithWeeks.map((e, idx) => {
            const col = STATUS_COLOR[e.status] || '#94A3B8';
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 4px' }}>
                <div style={{ minHeight: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <div 
                    title={e.comment}
                    style={{ 
                      fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 160, 
                      lineHeight: 1.35, wordBreak: 'break-word', display: '-webkit-box',
                      WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' 
                    }}
                  >
                    {e.comment}
                  </div>
                  {e.roadblock && (
                    <span style={{ fontSize: 9, color: 'var(--danger)', fontWeight: 700, marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                      ⚠ roadblock
                    </span>
                  )}
                </div>

                <div style={{ 
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', 
                  border: `3px solid ${col}`, display: 'grid', placeItems: 'center',
                  boxShadow: 'var(--shadow-sm)', marginBottom: 6, position: 'relative'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {e.displayDate}
                </div>
                <div>
                  <StatusBadge status={e.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CommitteeReviewPanel({ tool, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (decision) => {
    setBusy(true);
    try {
      await api(`/tools/${tool.id}/review`, { method: 'POST', body: { decision, note } });
      onDone();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };
  const btn = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600,
    fontSize: 13, color: '#fff', background: color, opacity: busy ? 0.6 : 1
  });
  
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-text)', letterSpacing: '.06em' }}>
          Committee Review Required
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>
        Review this submission's demo, HTML / Video mockups, and documents. Submit decision feedback:
      </p>
      <textarea 
        value={note} 
        onChange={(e) => setNote(e.target.value)} 
        placeholder="Decision feedback comment (sent to the owner)..." 
        style={{ width: '100%', minHeight: 64, marginBottom: 10, fontSize: 13, padding: 8, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} 
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => act('approve')} disabled={busy} style={btn('var(--success)')}><Check size={14} /> Approve</button>
        <button onClick={() => act('changes')} disabled={busy} style={btn('var(--warning)')}><RotateCcw size={14} /> Request changes</button>
        <button onClick={() => act('decline')} disabled={busy} style={btn('var(--danger)')}><Ban size={14} /> Decline</button>
      </div>
    </div>
  );
}

function TimelineBar({ timeline }) {
  return <HorizontalTimeline entries={timeline} />;
}

function DemoArea({ tool }) {
  const updateTool = useCatalogStore((s) => s.updateTool);
  const user = useAuthStore((s) => s.user);
  const getDemo = useCatalogStore((s) => s.getDemo);
  const [html, setHtml] = useState('');
  const cacheBuster = useMemo(() => Date.now(), [tool.id, tool.demo_url]);
  
  // Web demo fallback states
  const [webDemoFailed, setWebDemoFailed] = useState(false);
  const [webDemoLoaded, setWebDemoLoaded] = useState(false);
  const webIframeRef = useRef(null);
  const webFallbackTimer = useRef(null);
  
  // Red-ink states
  const [redInkActive, setRedInkActive] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [timelineBarOpen, setTimelineBarOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState(user?.name || '');

  const iframeRef = useRef(null);
  const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

  const renderPPT = () => {
    const url = tool.ppt_url;
    if (!url) return null;

    const isDataUrl = url.startsWith('data:');
    const isPdf = url.toLowerCase().includes('application/pdf') || url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('/api/uploads/');
    const isSharepoint = url.toLowerCase().includes('sharepoint.com') || url.toLowerCase().includes('office.com');

    if (isSharepoint) {
      return (
        <div style={{ 
          height: 520, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-main) 100%)', padding: 24, textAlign: 'center'
        }}>
          <span style={{ fontSize: 48 }}>📊</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>View Slide Presentation</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            This pitch deck is hosted externally on SharePoint. Click the button below to view it using your credentials.
          </p>
          <a 
            href={url} 
            target="_blank"
            rel="noreferrer"
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 6, 
              padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', 
              color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
              boxShadow: 'var(--shadow-md)', cursor: 'pointer'
            }}
          >
            Open Presentation ↗
          </a>
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe 
          title="ppt" 
          src={url} 
          style={{ width: '100%', height: 560, border: 'none' }} 
        />
      );
    }

    if (isDataUrl) {
      return (
        <div style={{ 
          height: 520, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'var(--bg-card)', padding: 24, textAlign: 'center'
        }}>
          <span style={{ fontSize: 48 }}>📊</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Local PowerPoint Uploaded</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: 0 }}>
            PowerPoint files cannot be previewed natively in the browser. You can download the file below to view it, or upload it as a <b>PDF</b> to enable inline slide preview.
          </p>
          <a 
            href={url} 
            download={`${tool.name || 'presentation'}.pptx`}
            onClick={() => {
              api(`/tools/${tool.id}/track-action`, { method: 'POST', body: { action_type: 'deck_download' }, auth: true }).catch(() => {});
            }}
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 6, 
              padding: '10px 20px', borderRadius: 8, background: 'var(--primary)', 
              color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer'
            }}
          >
            Download PowerPoint Deck 💾
          </a>
        </div>
      );
    }

    return (
      <iframe 
        title="ppt" 
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} 
        style={{ width: '100%', height: 560, border: 'none' }} 
      />
    );
  };

  const tabs = useMemo(() => {
    const t = [];
    const dType = tool.demo_type || 'html';
    if (dType === 'container') {
      t.push({ id: 'container_demo', label: 'Live Demo', icon: Code });
    } else {
      if (tool.demo_url || dType === 'url') t.push({ id: 'web', label: 'Web demo', icon: Globe });
      if (tool.hasDemo || tool.has_demo || tool.demo_html || dType === 'html') t.push({ id: 'html', label: 'HTML demo', icon: Code });
    }
    if (tool.video_url) t.push({ id: 'video', label: 'Video', icon: PlayCircle });
    if (tool.ppt_url) t.push({ id: 'ppt', label: 'Deck', icon: Presentation });
    if (tool.success_stories && Array.isArray(tool.success_stories)) {
      tool.success_stories.forEach((story, idx) => {
        t.push({
          id: `story-${idx}`,
          label: story.title || `Success Story ${idx + 1}`,
          icon: Presentation,
          storyUrl: story.file_url
        });
      });
    }
    return t;
  }, [tool]);
  
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => { setActive(tabs[0]?.id); }, [tabs]);
  useEffect(() => { if (active === 'html' && !html) getDemo(tool.id).then(setHtml).catch(() => {}); }, [active, html, tool.id, getDemo]);

  // Marker drawing helper
  const refreshMarkers = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !doc.body) return;

    // Remove old badges
    doc.querySelectorAll('.ri-badge').forEach(b => b.remove());
    doc.querySelectorAll('[data-ri-marked]').forEach(el => {
      el.style.outline = el.__riNoteOldOutline || '';
      el.removeAttribute('data-ri-marked');
    });

    const activeNotes = (tool.notes || []).filter(n => !n.resolved);
    activeNotes.forEach((note, idx) => {
      let el = null;
      try { el = doc.querySelector(note.sel); } catch(e) {}
      if (!el) return;

      el.__riNoteOldOutline = el.style.outline;
      el.style.outline = '2px solid #D6402B';
      el.setAttribute('data-ri-marked', '1');

      const b = doc.createElement('div');
      b.className = 'ri-badge';
      b.textContent = idx + 1;
      b.setAttribute('data-note', note.id);
      Object.assign(b.style, {
        position: 'absolute', zIndex: '999999', width: '20px', height: '20px',
        borderRadius: '50%', background: '#D6402B', color: '#fff',
        font: '700 11px/20px Arial', textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)', cursor: 'pointer',
        pointerEvents: 'auto'
      });
      
      b.onclick = (e) => {
        e.stopPropagation();
        alert(`Note by ${note.author} (${note.date}):\n\n${note.text}`);
      };

      doc.body.appendChild(b);

      // Position
      const r = el.getBoundingClientRect();
      const sx = doc.defaultView.scrollX || doc.documentElement.scrollLeft;
      const sy = doc.defaultView.scrollY || doc.documentElement.scrollTop;
      b.style.left = `${r.right + sx - 10}px`;
      b.style.top = `${r.top + sy - 10}px`;
    });
  }, [tool.notes]);

  const setupIframeListeners = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument || win?.document;
      if (!doc || !doc.body) return;

    if (doc.body) {
      doc.body.style.cursor = redInkActive ? 'crosshair' : '';
    }

    let hovered = null;
    const onMouseOver = (e) => {
      if (!redInkActive) return;
      if (hovered) hovered.style.outline = hovered.__riOldOutline || '';
      hovered = e.target;
      if (hovered.classList?.contains('ri-badge')) return;
      hovered.__riOldOutline = hovered.style.outline;
      hovered.style.outline = '2px dashed #D6402B';
    };
    const onMouseOut = (e) => {
      if (hovered === e.target) {
         e.target.style.outline = e.target.__riOldOutline || '';
         hovered = null;
      }
    };

    const onClick = async (e) => {
      if (!redInkActive) return;
      e.preventDefault(); e.stopPropagation();
      const el = e.target;
      if (el.classList?.contains('ri-badge')) return;

      let author = reviewerName;
      if (!author) {
        author = window.prompt('Your name (shown on the note):') || 'Anonymous';
        setReviewerName(author);
      }
      const text = window.prompt(`Note for this element:\n${elLabel(el)}`);
      if (!text) return;

      const newNote = {
        id: Date.now().toString(36),
        sel: cssPath(el, doc),
        label: elLabel(el),
        text,
        author,
        date: new Date().toISOString().slice(0, 10),
        resolved: false
      };

      const updatedNotes = [...(tool.notes || []), newNote];
      await updateTool(tool.id, { notes: updatedNotes });
    };

    // Clean up old listeners stored on document to prevent duplicates
    if (doc.__riMouseOver) doc.removeEventListener('mouseover', doc.__riMouseOver, true);
    if (doc.__riMouseOut) doc.removeEventListener('mouseout', doc.__riMouseOut, true);
    if (doc.__riClick) doc.removeEventListener('click', doc.__riClick, true);

    doc.__riMouseOver = onMouseOver;
    doc.__riMouseOut = onMouseOut;
    doc.__riClick = onClick;

    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);

    setTimeout(refreshMarkers, 100);

    win.removeEventListener('scroll', refreshMarkers);
    win.removeEventListener('resize', refreshMarkers);
    win.addEventListener('scroll', refreshMarkers);
    win.addEventListener('resize', refreshMarkers);
    } catch (e) {
      console.warn("Could not register annotation iframe listeners:", e);
    }
  }, [redInkActive, reviewerName, tool, updateTool, refreshMarkers]);

  useEffect(() => {
    if (active === 'html' && html) {
      setupIframeListeners();
    }
  }, [active, html, redInkActive, reviewerName, tool.notes, setupIframeListeners]);

  const locateNote = (note) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    let el = null;
    try { el = doc.querySelector(note.sel); } catch(e) {}
    if (!el) {
      alert(`Element not found in current demo: ${note.label}`);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let flashes = 0;
    const iv = setInterval(() => {
      el.style.outline = (flashes % 2) ? '3px solid #D6402B' : '3px solid transparent';
      if (++flashes > 5) {
        clearInterval(iv);
        el.style.outline = '2px solid #D6402B';
      }
    }, 280);
  };

  const resolveNote = async (noteId) => {
    const updated = (tool.notes || []).map((n) => n.id === noteId ? { ...n, resolved: !n.resolved } : n);
    await updateTool(tool.id, { notes: updated });
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    const updated = (tool.notes || []).filter((n) => n.id !== noteId);
    await updateTool(tool.id, { notes: updated });
  };

  const exportBugReport = () => {
    const open = (tool.notes || []).filter(n => !n.resolved);
    const done = (tool.notes || []).filter(n => n.resolved);
    const lines = [
      `# Bug report — ${tool.name}`,
      '',
      `- Owner: ${tool.owner}`,
      `- Status: ${tool.status}`,
      `- Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      `- Open notes: ${open.length} · Resolved: ${done.length}`,
      '',
      'How to locate each item: open the tool in the catalog, open Notes, and press "Locate" — the demo scrolls to the element and flashes it. The selector path below is the technical address of the element inside the demo HTML.',
      ''
    ];
    let i = 0;
    for (const n of open) {
      lines.push(
        `## #${++i} — reported by ${n.author} on ${n.date}`,
        `- Element: ${n.label}`,
        `- Selector: \`${n.sel}\``,
        `- Note: ${n.text}`,
        ''
      );
    }
    if (done.length) {
      lines.push('---', '## Resolved', '');
      for (const n of done) {
        lines.push(`- [${n.date}] ${n.author} — ${n.text} (${n.label})`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bug-report-${tool.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (tabs.length === 0) return <div style={{ height: 460, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)' }}>No demo media yet.</div>;
  
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap' }}>
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {tabs.map((t) => { const I = t.icon; return (<button key={t.id} onClick={() => setActive(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, background: active === t.id ? 'var(--secondary)' : 'transparent', color: active === t.id ? 'var(--primary)' : 'var(--text-secondary)' }}><I size={14} /> {t.label}</button>); })}
          </div>
        )}

        {active && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button
              onClick={() => {
                const iframe = iframeRef.current || document.querySelector('iframe[title="web"]') || document.querySelector('iframe[title="video"]') || document.querySelector('iframe[title="ppt"]');
                if (iframe) {
                  if (iframe.requestFullscreen) iframe.requestFullscreen();
                  else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
                  else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 8,
                border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: 'transparent', color: 'var(--text-secondary)'
              }}
            >
              ⛶ Fullscreen
            </button>
            <button
              onClick={() => {
                const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
                if (active === 'web') window.open(tool.demo_url, '_blank');
                else if (active === 'html') window.open(`${BASE}/tools/${tool.id}/demo/raw`, '_blank');
                else if (active === 'video') window.open(tool.video_url, '_blank');
                else if (active === 'ppt') window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(tool.ppt_url)}`, '_blank');
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 8,
                border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: 'transparent', color: 'var(--text-secondary)'
              }}
            >
              ↗ Open in Tab
            </button>
          </div>
        )}
        
        {active === 'html' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
            <button
              onClick={() => setRedInkActive(!redInkActive)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8,
                border: redInkActive ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: redInkActive ? 'var(--danger)' : 'transparent',
                color: redInkActive ? '#fff' : 'var(--text-secondary)'
              }}
            >
              ✑ Red-ink
            </button>
            <button
              onClick={() => setNotesPanelOpen(!notesPanelOpen)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8,
                border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: notesPanelOpen ? 'var(--secondary)' : 'transparent',
                color: (tool.notes || []).filter(n => !n.resolved).length > 0 ? 'var(--danger)' : 'var(--text-secondary)'
              }}
            >
              Notes ({(tool.notes || []).filter(n => !n.resolved).length})
            </button>
          </div>
        )}
      </div>



      <div style={{ background: 'var(--bg-card)', minHeight: 520, position: 'relative' }}>
        {active === 'web' && (
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 520, gap: 20, background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-main) 100%)', 
            padding: 32, textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative background circles */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'var(--primary)', opacity: 0.04 }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'var(--primary)', opacity: 0.03 }} />
            
            <div style={{ 
              width: 72, height: 72, borderRadius: 18, display: 'grid', placeItems: 'center',
              background: 'linear-gradient(135deg, var(--primary), hsl(from var(--primary) h s calc(l - 10)))',
              boxShadow: '0 8px 32px rgba(0,115,127,0.25)',
            }}>
              <Globe size={32} color="#fff" />
            </div>
            
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                Live Demo Available
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                Click the button below to launch the live demo in a secure, isolated window.
              </p>
            </div>

            <button 
              onClick={() => {
                api(`/tools/${tool.id}/track-action`, { method: 'POST', body: { action_type: 'demo_launch' }, auth: true }).catch(() => {});
                window.open(tool.demo_url, 'demo_window', 'width=1280,height=800,menubar=no,toolbar=yes,location=yes,status=no');
              }}
              style={{ 
                display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 36px',
                borderRadius: 12, background: 'var(--primary)', color: '#fff', fontWeight: 600,
                fontSize: 15, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,115,127,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,115,127,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,115,127,0.3)'; }}
            >
              <ExternalLink size={18} /> Launch Demo
            </button>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, maxWidth: 340, lineHeight: 1.5 }}>
              {tool.demo_url}
            </p>
          </div>
        )}
        {active === 'html' && (html ? <iframe ref={iframeRef} id="demoFrame" title="html" sandbox="allow-scripts allow-same-origin" srcDoc={html} onLoad={setupIframeListeners} style={{ width: '100%', height: 560, border: 'none' }} /> : <div style={{ display: 'grid', placeItems: 'center', height: 520, color: 'var(--text-muted)' }}>Loading…</div>)}
        {active === 'container_demo' && (
          <iframe 
            ref={iframeRef} 
            id="demoFrame" 
            title="container_demo" 
            sandbox="allow-scripts allow-same-origin allow-forms" 
            src={`/api/tools/${tool.id}/demo/raw`} 
            onLoad={setupIframeListeners} 
            style={{ width: '100%', height: 560, border: 'none' }} 
          />
        )}
        {active === 'video' && (ytEmbed(tool.video_url) ? <iframe title="video" src={ytEmbed(tool.video_url)} allowFullScreen style={{ width: '100%', height: 560, border: 'none' }} /> : <video src={tool.video_url} controls style={{ width: '100%', height: 560, background: '#000' }} />)}
        {active === 'ppt' && renderPPT()}
        {active && active.startsWith('story-') && (
          (() => {
            const tab = tabs.find(t => t.id === active);
            if (!tab) return null;
            const url = tab.storyUrl;
            if (!url) return null;
            const isPdf = url.toLowerCase().includes('application/pdf') || url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('/api/uploads/');
            if (isPdf) {
              return <iframe title={tab.label} src={url} style={{ width: '100%', height: 560, border: 'none' }} />;
            }
            return (
              <div style={{ height: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-card)', padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>📊</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{tab.label}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: 0 }}>This success story is a PowerPoint deck. Click below to download and view it.</p>
                <a 
                  href={url} 
                  download={`${tab.label}.pptx`}
                  onClick={() => {
                    api(`/tools/${tool.id}/track-action`, { method: 'POST', body: { action_type: 'story_download' }, auth: true }).catch(() => {});
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}
                >
                  Download Story 💾
                </a>
              </div>
            );
          })()
        )}
      </div>

      {/* Floating Notes Panel Overlay */}
      {active === 'html' && notesPanelOpen && (
        <div style={{
          position: 'absolute', top: 54, right: 14, width: '330px',
          maxHeight: 'calc(100% - 70px)', overflowY: 'auto',
          background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)',
          borderRadius: 14, boxShadow: 'var(--shadow-lg)', zIndex: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h5 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>✑ Review Notes</h5>
            <button onClick={exportBugReport} disabled={!(tool.notes || []).length} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
              Export bug report
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {(tool.notes || []).filter(n => !n.resolved).length} open · {(tool.notes || []).filter(n => n.resolved).length} resolved
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {(tool.notes || []).map((note) => (
              <div key={note.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--bg-main)', opacity: note.resolved ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{note.author}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{note.date}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{note.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{note.text}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => locateNote(note)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 10.5, cursor: 'pointer' }}>Locate</button>
                  <button onClick={() => resolveNote(note.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 10.5, cursor: 'pointer' }}>
                    {note.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button onClick={() => deleteNote(note.id)} style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 10.5, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
            {(tool.notes || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No notes yet. Turn on Red-ink and click elements in the demo to pin notes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ canEdit, entries, onChange }) {
  const [d, setD] = useState(''); const [c, setC] = useState(''); const [st, setSt] = useState('planned'); const [quick, setQuick] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const sorted = sortEntries(entries);
  const addOne = () => { if (!d && !c) return; onChange([...entries, { date: d, comment: c, status: st, roadblock: '' }]); setD(''); setC(''); setSt('planned'); };
  const addQuick = () => { const p = parseQuickAdd(quick); if (p.length) { onChange([...entries, ...p]); setQuick(''); } };
  const remove = (e) => onChange(entries.filter((x) => x !== e));
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, marginBottom: 16 }}>
      <div 
        onClick={() => setCollapsed(!collapsed)} 
        style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid var(--border-color)' }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Project Timeline ({entries?.length || 0})
        </div>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
          {collapsed ? <><ChevronUp size={14} style={{ transform: 'rotate(180deg)' }} /> Show</> : <><ChevronUp size={14} /> Hide</>}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: 8 }}>
          <HorizontalTimeline entries={entries} />
          {canEdit && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Edit Milestones</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {sorted.map((e, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{e.date}</span>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{e.comment}</span>
                    <button onClick={() => remove(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" value={d} onChange={(e) => setD(e.target.value)} style={{ width: 150 }} />
                  <select value={st} onChange={(e) => setSt(e.target.value)} style={{ width: 140 }}>{Object.entries(ENTRY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Update…" style={{ flex: 1 }} />
                  <button onClick={addOne} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600 }}><Plus size={14} /></button>
                </div>
                <details><summary style={{ fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>⚡ Bulk add (date | update | status)</summary>
                  <textarea value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={'2026-06-01 | Built prototype | implemented'} style={{ marginTop: 6, minHeight: 56, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  <button onClick={addQuick} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontWeight: 600, fontSize: 12 }}>Add lines</button>
                </details>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditHistoryPanel({ history, toolId }) {
  const [collapsed, setCollapsed] = useState(true);
  const user = useAuthStore((s) => s.user);
  const deleteToolLog = useCatalogStore((s) => s.deleteToolLog);
  const isAdmin = user && user.role === 'admin';
  
  if (!history || history.length === 0) return null;
  
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, marginBottom: 16 }}>
      <div 
        onClick={() => setCollapsed(!collapsed)} 
        style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid var(--border-color)' }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Change logs / Edit History ({history.length})
        </div>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      
      {!collapsed && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 240, overflowY: 'auto' }}>
          {history.map((log, idx) => (
            <div key={idx} style={{ paddingBottom: 10, borderBottom: idx < history.length - 1 ? '1px dashed var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.editor_name}</span>
                  {isAdmin && (
                    <button 
                      type="button" 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this change log entry?")) {
                          try {
                            await deleteToolLog(toolId, idx);
                          } catch (err) {
                            alert(err.message);
                          }
                        }
                      }} 
                      style={{ 
                        background: 'none', border: 'none', color: 'var(--danger)', 
                        fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '0 4px',
                        marginLeft: 8, textDecoration: 'underline'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <span>{new Date(log.timestamp * 1000).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {log.note}
              </div>
              {log.changed_fields && log.changed_fields.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {log.changed_fields.map((fld) => (
                    <span key={fld} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 6px', borderRadius: 4 }}>
                      {fld}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BASE_API_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const getFileLink = (val) => {
  if (!val) return '';
  if (/^https?:\/\//.test(val) || val.startsWith('data:')) return val;
  const clean = val.startsWith('/') ? val : `/${val}`;
  return `${BASE_API_URL}${clean}`;
};

const getFileName = (val) => {
  if (!val) return '';
  const parts = val.split('/');
  return parts[parts.length - 1];
};

export default function ToolPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { tools, load, voteTool, deleteTool, updateTool, fetchTool } = useCatalogStore();
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loadingTool, setLoadingTool] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (id) {
      setLoadingTool(true);
      setFetchError('');
      fetchTool(id)
        .then((t) => {
          setEntries(t.timeline || []);
          setLoadingTool(false);
          api(`/tools/${id}/track-view`, { method: 'POST', auth: true }).catch(() => {});
        })
        .catch((err) => {
          setLoadingTool(false);
          setFetchError(err.message || String(err));
        });
    }
  }, [id, fetchTool]);

  const tool = tools.find((t) => String(t.id) === String(id));

  if (loadingTool && !tool) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tool details…</div>;
  if (!tool) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ fontWeight: 600 }}>Tool not found.</p>
        {fetchError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>Reason: {fetchError}</p>}
        <button onClick={() => nav('/catalog')} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', marginTop: 12 }}>← Back to catalog</button>
      </div>
    );
  }

  const isCoOwner = user && Array.isArray(tool.co_owners) && tool.co_owners.some(co => co.email === user.email);
  const canEdit = user && (user.role === 'admin' || tool.owner_id === user.id || isCoOwner);
  const voted = (tool.voters || []).includes(user?.id);
  const s = STATUS_STYLE[tool.status] || STATUS_STYLE.active;
  const saveEntries = async (next) => { setEntries(next); try { await updateTool(tool.id, { timeline: next }); } catch { /* keep local */ } };
  const onDelete = async () => { if (!window.confirm(`Delete "${tool.name}"?`)) return; await deleteTool(tool.id); nav('/catalog'); };

  const isCommittee = user && ['committee', 'admin'].includes(user.role);
  const isPending = tool.review_status !== 'approved';

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 'calc(100vh - 64px)', margin: '0 auto', padding: '16px 24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button onClick={() => nav('/catalog')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontWeight: 600, fontSize: 13 }}><ArrowLeft size={16} /> Catalog</button>
        
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
            <button onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--secondary)', color: 'var(--primary-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><Pencil size={15} /> Edit</button>
            <button onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(220,38,38,0.2)', background: '#fff', color: 'var(--danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><Trash2 size={15} /> Delete</button>
          </div>
        )}

        <button onClick={() => voteTool(tool.id)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, border: `1.5px solid ${voted ? 'var(--primary)' : 'var(--border-color)'}`, background: voted ? 'var(--secondary)' : 'var(--bg-card)', color: voted ? 'var(--primary)' : 'var(--text-secondary)' }}>
          <ChevronUp size={18} /> {voted ? 'Voted' : 'Upvote'} · {tool.votes || 0}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 26%) minmax(0, 1fr)', gap: 24, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 8, paddingBottom: 32, height: '100%' }}>
          {/* Identity Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--primary-text)' }}>{tool.category}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 8px', background: s.bg, color: s.fg }}>{tool.status}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2 }}>{tool.name}</h1>
            
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--badge-fg-owner)', background: 'rgba(255,132,0,0.14)', borderRadius: 999, padding: '4px 10px' }}>Owner: {tool.owner}</span>
              {tool.co_owners && tool.co_owners.map((co, idx) => (
                <span key={idx} style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-text)', background: 'rgba(168,85,247,0.14)', borderRadius: 999, padding: '4px 10px' }}>Co-owner: {co.name || co.email}</span>
              ))}
              {tool.account && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-text)', background: 'var(--secondary)', borderRadius: 999, padding: '4px 10px' }}>@ {tool.account}</span>}
              {tool.time_to_deploy && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '4px 10px' }}>⏱ {tool.time_to_deploy}</span>}
              {fmtMoney(tool.roi) && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--success)' }}>{fmtMoney(tool.roi)}/yr</span>}
            </div>

            {tool.badges && tool.badges.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                {tool.badges.map((b, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--secondary)', border: '1px solid rgba(0,115,127,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-text)' }}>
                    {b.img_url && <img src={b.img_url} style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                    {b.title}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {isCommittee && isPending && (
            <CommitteeReviewPanel tool={tool} onDone={() => fetchTool(tool.id)} />
          )}

          {/* Combined Details Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 16 }}>
            {tool.impact && <div style={{ background: 'rgba(37,226,204,0.14)', border: '1px solid rgba(0,115,127,0.25)', color: 'var(--primary-text)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 16 }}>★ {tool.impact}</div>}
            {tool.achieved_through && <Section title="Achieved through">{tool.achieved_through}</Section>}
            <Section title="Problem">{tool.problem}</Section>
            <Section title="What it delivers">{tool.delivers}</Section>
            <Section title="Benefits">{tool.benefits}</Section>
            <Section title="Capabilities">
              <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--text-secondary)' }}>
                {(Array.isArray(tool.capabilities) ? tool.capabilities : String(tool.capabilities || '').split('\n')).map((c, i) => c.trim() && <li key={i} style={{ marginBottom: 2 }}>{c}</li>)}
              </ul>
            </Section>
            <Section title="Tags">{tool.tags?.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{tool.tags.map((t) => <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, background: 'var(--secondary)', borderRadius: 6, padding: '3px 7px' }}>{t}</span>)}</div> : null}</Section>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <Section title="Sample data">
                  {tool.sample ? (
                    tool.sample.startsWith('[') ? (
                      (() => {
                        try {
                          const files = JSON.parse(tool.sample);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {files.map((file, idx) => (
                                <a key={idx} href={file.data} download={file.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--secondary)', color: 'var(--primary)', borderRadius: 6, textDecoration: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                                  ↓ {file.name.slice(0, 18)}{file.name.length > 18 ? '...' : ''}
                                </a>
                              ))}
                            </div>
                          );
                        } catch (e) {
                          return <span>{tool.sample}</span>;
                        }
                      })()
                    ) : /^https?:\/\//.test(tool.sample) ? (
                      <a href={tool.sample} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', cursor: 'pointer' }}><ExternalLink size={13} /> View Data</a>
                    ) : tool.sample.startsWith('data:') ? (
                      <a href={tool.sample} download={`sample_data_${tool.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--secondary)', color: 'var(--primary)', borderRadius: 6, textDecoration: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>↓ Download File</a>
                    ) : (tool.sample.startsWith('/') || tool.sample.startsWith('uploads/') || tool.sample.includes('/uploads/')) ? (
                      <a href={getFileLink(tool.sample)} download={getFileName(tool.sample)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--secondary)', color: 'var(--primary)', borderRadius: 6, textDecoration: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                        ↓ Download {getFileName(tool.sample).slice(0, 15)}{getFileName(tool.sample).length > 15 ? '...' : ''}
                      </a>
                    ) : (tool.sample)
                  ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None provided</span>}
                </Section>
              </div>
              <div style={{ flex: 1 }}>
                <Section title="Configs">
                  {tool.configs ? (
                    /^https?:\/\//.test(tool.configs) ? (
                      <a href={tool.configs} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}><ExternalLink size={13} /> View Configs</a>
                    ) : tool.configs.startsWith('data:') ? (
                      <a href={tool.configs} download={`configs_${tool.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--secondary)', color: 'var(--primary)', borderRadius: 6, textDecoration: 'none', fontSize: 11.5, fontWeight: 600 }}>↓ Download File</a>
                    ) : (tool.configs.startsWith('/') || tool.configs.startsWith('uploads/') || tool.configs.includes('/uploads/')) ? (
                      <a href={getFileLink(tool.configs)} download={getFileName(tool.configs)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--secondary)', color: 'var(--primary)', borderRadius: 6, textDecoration: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                        ↓ Download {getFileName(tool.configs).slice(0, 15)}{getFileName(tool.configs).length > 15 ? '...' : ''}
                      </a>
                    ) : (tool.configs)
                  ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None provided</span>}
                </Section>
              </div>
            </div>
          </div>
          
          <SponsorBox tool={tool} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', paddingRight: 8, paddingBottom: 32, height: '100%' }}>
          <TimelinePanel canEdit={canEdit} entries={entries} onChange={saveEntries} />
          <EditHistoryPanel history={tool.edit_history} toolId={tool.id} />
          <DemoArea tool={tool} />
        </div>
      </div>

      {editing && <ToolForm tool={tool} onClose={() => setEditing(false)} />}
    </div>
  );
}
