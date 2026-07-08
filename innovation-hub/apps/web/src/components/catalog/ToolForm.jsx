import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Upload, AlertTriangle, CheckCircle2, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { useCatalogStore } from '../../store/useCatalogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { parseQuickAdd, ENTRY_STATUS } from '../../lib/timeline';
import { AICopilotChat } from '../hub/HubLayout';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'our', 'have', 'across', 'every', 'when', 'where', 'they', 'their', 'manually', 'same']);
const words = (s) => (s || '').toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) || [];

function findOverlaps(tools, name, problem, excludeId) {
  const mine = new Set([...words(name), ...words(problem)]);
  if (mine.size === 0) return [];
  return tools.filter((t) => t.id !== excludeId).map((t) => {
    const theirs = new Set([...words(t.name), ...words(t.problem), ...words((t.tags || []).join(' '))]);
    let shared = 0; mine.forEach((w) => theirs.has(w) && shared++);
    return { t, shared };
  }).filter((x) => x.shared >= 2).sort((a, b) => b.shared - a.shared).slice(0, 3);
}

const IMPL = [
  { id: 'implemented', label: 'Already implemented' },
  { id: 'not_implemented', label: 'Not yet implemented' },
  { id: 'third_party', label: 'Third-party resell' },
];
const lbl = { fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' };

export default function ToolForm({ tool, onClose }) {
  const editing = !!tool;
  const navigate = useNavigate();
  const { tools, addTool, updateTool } = useCatalogStore();
  const user = useAuthStore((s) => s.user);
  const isCommittee = user && ['committee', 'admin'].includes(user.role);

  const [f, setF] = useState(() => {
    let local = null;
    try { local = JSON.parse(localStorage.getItem('tool_submit_draft')); } catch(e) {}
    const src = editing ? tool : local || {};
    return {
      name: src?.name || '', owner: src?.owner || '', category: src?.category || '',
      status: src?.status || 'pilot', implementation_status: src?.implementation_status || 'not_implemented',
      impact: src?.impact || '', roi: src?.roi || '', problem: src?.problem || '',
      capabilities: Array.isArray(src?.capabilities) ? src.capabilities.join('\n') : (typeof src?.capabilities === 'string' ? src.capabilities : ''),
      delivers: src?.delivers || '', benefits: src?.benefits || '',
      tags: Array.isArray(src?.tags) ? src.tags.join(', ') : (typeof src?.tags === 'string' ? src.tags : ''),
      sample: src?.sample || '',
      configs: src?.configs || '',
      demo_url: src?.demo_url || '', video_url: src?.video_url || '', ppt_url: src?.ppt_url || '',
      account: src?.account || '', img_url: src?.img_url || '', achieved_through: src?.achieved_through || '',
      timelineText: src?.timelineText || (Array.isArray(src?.timeline) ? src.timeline.map((e) => `${e.date} | ${e.comment} | ${e.status}`).join('\n') : ''),
      pricing_model: src?.pricing_model || '',
      price_per_user: src?.price_per_user || '',
      deployment_fees: src?.deployment_fees || '',
    };
  });
  const [badges, setBadges] = useState(tool?.badges || []);
  const [newBadgeTitle, setNewBadgeTitle] = useState('');
  const [newBadgeImg, setNewBadgeImg] = useState('');
  const [demoHtml, setDemoHtml] = useState(null);
  const [demoName, setDemoName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [row, setRow] = useState({ date: '', update: '', status: 'planned' });
  const [enlargedSection, setEnlargedSection] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [showAI, setShowAI] = useState(true);

  const setIsToolFormOpen = useCatalogStore((s) => s.setIsToolFormOpen);

  React.useEffect(() => {
    if (editing) return;
    setIsToolFormOpen(true);
    return () => {
      setIsToolFormOpen(false);
    };
  }, [editing, setIsToolFormOpen]);

  React.useEffect(() => {
    if (editing) return;
    localStorage.setItem('tool_submit_draft', JSON.stringify(f));
  }, [editing, f]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const addRow = () => {
    if (!row.date && !row.update) return;
    const line = `${row.date} | ${row.update} | ${row.status}`;
    setF((p) => ({ ...p, timelineText: (p.timelineText ? p.timelineText + '\n' : '') + line }));
    setRow({ date: '', update: '', status: 'planned' });
  };
  const overlaps = useMemo(() => findOverlaps(tools, f.name, f.problem, tool?.id), [tools, f.name, f.problem, tool]);

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('HTML demo file size exceeds the 5MB limit.');
      return;
    }
    const r = new FileReader(); r.onload = () => { setDemoHtml(String(r.result)); setDemoName(file.name); }; r.readAsText(file);
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const payload = {
      name: f.name, owner: f.owner, category: f.category, status: f.status,
      implementation_status: f.implementation_status, impact: f.impact, roi: parseFloat(f.roi) || 0, problem: f.problem,
      capabilities: f.capabilities.split('\n').map((x) => x.trim()).filter(Boolean),
      delivers: f.delivers, benefits: f.benefits,
      tags: f.tags ? f.tags.split(',').map((x) => x.trim()).filter(Boolean) : [],
      sample: f.sample, demo_url: f.demo_url, video_url: f.video_url, ppt_url: f.ppt_url,
      account: f.account, img_url: f.img_url, achieved_through: f.achieved_through,
      pricing_model: f.pricing_model, price_per_user: f.price_per_user, deployment_fees: f.deployment_fees,
      badges: badges,
      timeline: parseQuickAdd(f.timelineText),

    };
    if (demoHtml !== null) payload.demo_html = demoHtml;
    if (editing) payload.edit_note = editNote;
    try {
      if (editing) { await updateTool(tool.id, payload); onClose(); }
      else { 
        await addTool(payload); 
        localStorage.removeItem('tool_submit_draft');
        setDone(true); 
      }
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  if (done) {
    return createPortal(
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,38,50,0.45)', zIndex: 9999, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px,100%)', background: 'var(--bg-card)', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <CheckCircle2 size={44} color="var(--primary)" style={{ margin: '0 auto' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, margin: '12px 0 6px' }}>Submitted for review</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>The committee will review “{f.name}”. If approved it goes live and you become its Product Owner.</p>
          <button onClick={onClose} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600 }}>Done</button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,38,50,0.45)', zIndex: 9999, display: 'grid', placeItems: 'center', padding: '20px' }}>
      <form 
        onClick={(e) => e.stopPropagation()} 
        onSubmit={submit} 
        style={{ 
          width: 'min(1700px, 98%)', 
          background: 'var(--bg-card-solid)', 
          borderRadius: 20, 
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: 0 }}>{editing ? 'Edit tool' : 'Submit a tool'}</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <button 
              type="button" 
              onClick={() => setShowAI(!showAI)} 
              style={{ 
                background: 'none', border: '1px solid var(--border-color)', 
                borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', 
                color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6,
                fontWeight: 600
              }}
            >
              {showAI ? 'Hide AI Copilot' : 'Show AI Copilot'}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', gridTemplateColumns: showAI ? '3.2fr 1fr' : '1fr',
          flex: 1, overflow: 'hidden'
        }}>
          {/* Left Panel: Form + Footer */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Scrollable Form Area */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {enlargedSection && (
                <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)', alignItems: 'center', flexShrink: 0 }}>
                  {[{ id: 1, title: '1. Core Identity' }, { id: 2, title: '2. Value & Impact' }, { id: 3, title: '3. Media & Delivery' }].map(s => (
                    <button 
                      key={s.id} 
                      type="button"
                      onClick={() => setEnlargedSection(s.id)}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: 6, 
                        border: enlargedSection === s.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: enlargedSection === s.id ? 'var(--secondary)' : 'var(--bg-card)',
                        color: enlargedSection === s.id ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: enlargedSection === s.id ? 700 : 600,
                        cursor: 'pointer'
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => setEnlargedSection(null)} 
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Minimize2 size={14} /> Collapse
                  </button>
                </div>
              )}
              <div style={{ display: enlargedSection ? 'block' : 'grid', gridTemplateColumns: enlargedSection ? '1fr' : 'repeat(3, 1fr)', overflowY: 'auto', flex: 1 }}>
          {/* Section 1: Core Info & Metadata */}
          {(!enlargedSection || enlargedSection === 1) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px', background: 'rgba(150, 150, 150, 0.03)', borderRight: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: 8, paddingBottom: 8, overflowX: 'auto' }}>
              <h3 style={{ fontSize: 17, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>1. Core Identity</h3>
              {!enlargedSection && <button type="button" onClick={() => setEnlargedSection(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><Maximize2 size={16} /></button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Name</label><input required value={f.name} onChange={set('name')} /></div>
              <div><label style={lbl}>Owner</label><input value={f.owner} onChange={set('owner')} placeholder="Team or person" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Section</label><select value={f.implementation_status} onChange={set('implementation_status')}>{IMPL.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></div>
              <div><label style={lbl}>Category</label><select value={f.category} onChange={set('category')}><option value="">Select Category</option><option value="IX Suite">IX Suite</option><option value="Tech Infusion">Tech Infusion</option><option value="Innovations Hub">Innovations Hub</option></select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Maturity</label><select value={f.status} onChange={set('status')}><option value="pilot">Pilot</option><option value="active">Active</option><option value="implemented">Implemented</option><option value="retired">Retired</option></select></div>
              <div><label style={lbl}>ROI ($/yr)</label><input type="number" value={f.roi} onChange={set('roi')} placeholder="0" /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
              <div>
                <label style={lbl}>Custom Card Image (URL or Upload)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={f.img_url} onChange={set('img_url')} placeholder="https://…/image.png" style={{ flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload Image">
                    <Upload size={14} />
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Image file size exceeds the 5MB limit.');
                          return;
                        }
                        const r = new FileReader();
                        r.onload = () => setF(p => ({ ...p, img_url: String(r.result) }));
                        r.readAsDataURL(file);
                      }
                    }} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
              <div><label style={lbl}>Deployed Client Account</label><input value={f.account} onChange={set('account')} placeholder="e.g. Concentrix" /></div>
            </div>
            <div><label style={lbl}>Impact banner</label><input value={f.impact} onChange={set('impact')} placeholder='e.g. "Saved 60 hrs/mo"' /></div>
            <div>
              <label style={lbl}>Achieved Through What (e.g. GenAI, Automation, SQL, Python)</label>
              <input value={f.achieved_through} onChange={set('achieved_through')} placeholder="E.g., Generative AI, Robotic Process Automation, custom scripts" style={{ cursor: 'pointer' }} />
            </div>

            {/* Pricing Module */}
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary-text)', marginBottom: 10, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Pricing Module</div>
              <div>
                <label style={lbl}>Pricing Model</label>
                <select value={f.pricing_model} onChange={set('pricing_model')} style={{ cursor: 'pointer' }}>
                  <option value="">Select pricing model...</option>
                  <option value="cost_per_user">Cost Per User</option>
                  <option value="one_time_deployment">One-time Deployment</option>
                  <option value="both">Both</option>
                </select>
              </div>
              {(f.pricing_model === 'cost_per_user' || f.pricing_model === 'both') && (
                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>Price per User ($/mo)</label>
                  <input type="number" value={f.price_per_user} onChange={set('price_per_user')} placeholder="e.g., 10" />
                </div>
              )}
              {(f.pricing_model === 'one_time_deployment' || f.pricing_model === 'both') && (
                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>Deployment Fees ($)</label>
                  <input type="number" value={f.deployment_fees} onChange={set('deployment_fees')} placeholder="e.g., 5000" />
                </div>
              )}
            </div>

            {isCommittee && (
               <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary-text)', marginBottom: 10, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Verification & Badges (Admin)</div>
                 
                 {badges.length > 0 && (
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                     {badges.map((b, idx) => (
                       <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--secondary)', border: '1px solid rgba(0,115,127,0.2)', borderRadius: 12, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-text)' }}>
                         {b.img_url && <img src={b.img_url} style={{ width: 12, height: 12, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                         {b.title}
                         <button 
                           type="button" 
                           onClick={() => setBadges(badges.filter((_, i) => i !== idx))} 
                           style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0, marginLeft: 2 }}
                         >
                           ×
                         </button>
                       </span>
                     ))}
                   </div>
                 )}

                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px dashed var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                   <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Add custom badge</div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                     <input 
                       value={newBadgeTitle} 
                       onChange={(e) => setNewBadgeTitle(e.target.value)} 
                       placeholder="Badge Label (e.g. Top Tool)" 
                       style={{ fontSize: 12, padding: '6px 10px' }}
                     />
                     <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload Badge Icon">
                       <Upload size={13} />
                       <input 
                         type="file" 
                         accept="image/*" 
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             if (file.size > 5 * 1024 * 1024) {
                               alert('Badge icon file size exceeds the 5MB limit.');
                               return;
                             }
                             const r = new FileReader();
                             r.onload = () => setNewBadgeImg(String(r.result));
                             r.readAsDataURL(file);
                           }
                         }} 
                         style={{ display: 'none' }} 
                       />
                     </label>
                   </div>
                   {newBadgeImg && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                       <img src={newBadgeImg} style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                       Icon uploaded!
                     </div>
                   )}
                   <button 
                     type="button" 
                     onClick={() => {
                       if (!newBadgeTitle.trim()) return;
                       setBadges([...badges, { title: newBadgeTitle.trim(), img_url: newBadgeImg }]);
                       setNewBadgeTitle('');
                       setNewBadgeImg('');
                     }}
                     style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                   >
                     Add Badge
                   </button>
                 </div>
               </div>
             )}
            </div>
          )}

          {/* Section 2: Value & Deliverables */}
          {(!enlargedSection || enlargedSection === 2) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px', background: 'rgba(150, 150, 150, 0.07)', borderRight: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: 8, paddingBottom: 8, overflowX: 'auto' }}>
              <h3 style={{ fontSize: 17, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>2. Value & Impact</h3>
              {!enlargedSection && <button type="button" onClick={() => setEnlargedSection(2)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><Maximize2 size={16} /></button>}
            </div>
              <div>
                <label style={lbl}>Problem it solves</label>
                <textarea value={f.problem} onChange={set('problem')} style={{ minHeight: 70 }} />
                {overlaps.length > 0 && (
                  <div style={{ marginTop: 8, background: 'rgba(255,132,0,0.1)', border: '1px solid rgba(255,132,0,0.35)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--warning-text)' }}><AlertTriangle size={14} /> Possible overlap — check before building</div>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {overlaps.map(({ t }) => (
                        <button 
                          key={t.id} 
                          type="button"
                          onClick={() => { onClose(); navigate(`/tools/${t.id}`); }}
                          style={{ 
                            fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
                            borderRadius: 999, padding: '3.5px 12px', color: 'var(--primary-text)', cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div><label style={lbl}>Capabilities (one per line)</label><textarea value={f.capabilities} onChange={set('capabilities')} placeholder={'Activity logs\nBottleneck detection'} style={{ minHeight: 70 }} /></div>
              <div><label style={lbl}>What it delivers</label><textarea value={f.delivers} onChange={set('delivers')} style={{ minHeight: 60 }} /></div>
              <div><label style={lbl}>Benefits</label><textarea value={f.benefits} onChange={set('benefits')} style={{ minHeight: 60 }} /></div>
              <div><label style={lbl}>Tags (comma sep)</label><input value={f.tags} onChange={set('tags')} placeholder="kpi, automation" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Sample data (link or upload, max 5MB)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={f.sample} onChange={set('sample')} placeholder="https://… or upload files" style={{ flex: 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload Data File">
                      <Upload size={14} />
                      <input type="file" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        
                        const oversized = files.find(f => f.size > 5 * 1024 * 1024);
                        if (oversized) {
                          alert(`File "${oversized.name}" exceeds the 5MB size limit.`);
                          return;
                        }

                        if (files.length === 1) {
                          const r = new FileReader();
                          r.onload = () => setF(p => ({ ...p, sample: String(r.result) }));
                          r.readAsDataURL(files[0]);
                        } else {
                          const promises = files.map(file => {
                            return new Promise((resolve) => {
                              const r = new FileReader();
                              r.onload = () => resolve({ name: file.name, type: file.type, data: String(r.result) });
                              r.readAsDataURL(file);
                            });
                          });
                          Promise.all(promises).then(results => {
                            setF(p => ({ ...p, sample: JSON.stringify(results) }));
                          });
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Configs (link or upload, max 5MB)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={f.configs} onChange={set('configs')} placeholder="https://… or upload file" style={{ flex: 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload Config File">
                      <Upload size={14} />
                      <input type="file" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Configs file size exceeds the 5MB limit.');
                            return;
                          }
                          const r = new FileReader();
                          r.onload = () => setF(p => ({ ...p, configs: String(r.result) }));
                          r.readAsDataURL(file);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Demo Media & Timeline */}
          {(!enlargedSection || enlargedSection === 3) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px', background: 'rgba(150, 150, 150, 0.12)', borderRight: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: 8, paddingBottom: 8, overflowX: 'auto' }}>
              <h3 style={{ fontSize: 17, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>3. Media & Delivery</h3>
              {!enlargedSection && <button type="button" onClick={() => setEnlargedSection(3)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><Maximize2 size={16} /></button>}
            </div>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Demo media</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Web demo (URL)</label><input value={f.demo_url} onChange={set('demo_url')} placeholder="https://your-app.example.com" /></div>
                <div>
                  <label style={lbl}>Video (URL or Upload, max 5MB)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={f.video_url} onChange={set('video_url')} placeholder="YouTube / mp4 link" style={{ flex: 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload Video">
                      <Upload size={14} />
                      <input type="file" accept="video/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Video file size exceeds the 5MB limit.');
                            return;
                          }
                          const r = new FileReader();
                          r.onload = () => setF(p => ({ ...p, video_url: String(r.result) }));
                          r.readAsDataURL(file);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Pitch deck (PPT URL or Upload, max 5MB)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={f.ppt_url} onChange={set('ppt_url')} placeholder="https://…/deck.pptx" style={{ flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)' }} title="Upload PPT">
                    <Upload size={14} />
                    <input type="file" accept=".ppt,.pptx,.pdf" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Pitch deck file size exceeds the 5MB limit.');
                          return;
                        }
                        const r = new FileReader();
                        r.onload = () => setF(p => ({ ...p, ppt_url: String(r.result) }));
                        r.readAsDataURL(file);
                      }
                    }} style={{ display: 'none' }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.45 }}>
                  Recommended: Upload your slide deck to the <a href="https://cnxmail.sharepoint.com/sites/msteams_6fa7d4/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents%2FTayim%2FInnovation%20Decks&viewid=4016852e%2D4dea%2D4b92%2Dab08%2Dae8ac56ee35b&newTargetListUrl=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents&viewpath=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents%2FForms%2FAllItems%2Easpx" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>Concentrix SharePoint Innovation Decks repository</a> and paste the sharing link here.
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Or upload an HTML demo</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-color)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <Upload size={14} />{demoName ? `✓ ${demoName}` : editing && tool.has_demo ? 'HTML demo attached — choose to replace' : 'Upload self-contained .html demo'}
                  <input type="file" accept=".html,text/html" onChange={onFile} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Timeline (optional)</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input type="date" value={row.date} onChange={(e) => setRow({ ...row, date: e.target.value })} style={{ width: 130 }} />
                <select value={row.status} onChange={(e) => setRow({ ...row, status: e.target.value })} style={{ width: 110 }}>{Object.entries(ENTRY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input value={row.update} onChange={(e) => setRow({ ...row, update: e.target.value })} placeholder="Update…" style={{ flex: 1 }} />
                <button type="button" onClick={addRow} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600 }}><Plus size={14} /></button>
              </div>
              <textarea value={f.timelineText} onChange={set('timelineText')} placeholder={'2026-06-01 | Built prototype | implemented\n2026-09-01 | Scale rollout | planned'} style={{ minHeight: 65, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            </div>
          </div>
          )}
          </div>
          </div>
            
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, background: 'rgba(150, 150, 150, 0.17)' }}>
            {editing && (
              <div style={{ width: '100%' }}>
                <label style={{ ...lbl, display: 'block', marginBottom: 4 }}>Reason for Edit / Change Note</label>
                <textarea 
                  value={editNote}
                  required
                  onChange={(e) => setEditNote(e.target.value)} 
                  placeholder="Describe your edits (e.g. updated links, revised description, category adjustments)..." 
                  style={{ width: '100%', minHeight: 44, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', resize: 'vertical' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
              {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginRight: 'auto' }}>{err}</div>}
              {!editing && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear your draft and start over?')) {
                      localStorage.removeItem('tool_submit_draft');
                      setF({
                        name: '', owner: '', category: '', status: 'pilot', implementation_status: 'not_implemented',
                        impact: '', roi: '', problem: '', capabilities: '', delivers: '', benefits: '', tags: '',
                        sample: '', configs: '', demo_url: '', video_url: '', ppt_url: '', account: '', img_url: '',
                        timelineText: '', pricing_model: '', price_per_user: '', deployment_fees: ''
                      });
                    }
                  }}
                  style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Clear Draft
                </button>
              )}
              <button type="submit" disabled={busy} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, opacity: busy ? 0.6 : 1, cursor: 'pointer' }}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Submit for review'}
              </button>
            </div>
          </div>
        </div>

          {showAI && (
            <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(150, 150, 150, 0.17)', overflow: 'hidden' }}>
              <AICopilotChat inline={true} />
            </div>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}
