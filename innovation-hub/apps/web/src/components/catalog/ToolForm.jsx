import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Upload, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useCatalogStore } from '../../store/useCatalogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { parseQuickAdd, ENTRY_STATUS } from '../../lib/timeline';
import { AICopilotChat } from '../hub/HubLayout';
import { api } from '../../api';

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
const lbl = { fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', marginBottom: 5, letterSpacing: '0.01em' };

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
      time_to_deploy: src?.time_to_deploy || '',
      success_stories: src?.success_stories || [],
      co_owners: Array.isArray(src?.co_owners) ? src.co_owners.map(o => o.email || o.name).join(', ') : '',
      draft_id: src?.draft_id || '',
      demo_type: src?.demo_type || 'html',
      demo_zip_url: src?.demo_zip_url || '',
    };
  });
  const [successStories, setSuccessStories] = useState(f.success_stories || []);
  const [storyTitle, setStoryTitle] = useState('');
  const [badges, setBadges] = useState(tool?.badges || []);
  const [newBadgeTitle, setNewBadgeTitle] = useState('');
  const [newBadgeImg, setNewBadgeImg] = useState('');
  const [demoHtml, setDemoHtml] = useState(null);
  const [demoName, setDemoName] = useState('');
  const [demoZipBase64, setDemoZipBase64] = useState(null);
  const [demoZipName, setDemoZipName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [row, setRow] = useState({ date: '', update: '', status: 'planned' });
  const [step, setStep] = useState(1);
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

  React.useEffect(() => {
    if (editing) return;
    const isNew = !localStorage.getItem('tool_submit_draft');
    if (isNew && !f.draft_id) {
      const dId = 'draft_' + Math.random().toString(36).substring(2, 9);
      setF(p => ({ ...p, draft_id: dId }));
      api('/funnel/track-submission', {
        method: 'POST',
        body: { action: 'start_draft', draft_id: dId },
        auth: true
      }).catch(() => {});
    }
  }, [editing]);

  const onAddStory = (title, fileData) => {
    const next = [...successStories, { title, file_url: fileData }];
    setSuccessStories(next);
    setF(prev => ({ ...prev, success_stories: next }));
  };

  const onRemoveStory = (index) => {
    const next = successStories.filter((_, i) => i !== index);
    setSuccessStories(next);
    setF(prev => ({ ...prev, success_stories: next }));
  };

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

  const onZipFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('ZIP demo file size exceeds the 50MB limit.');
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setDemoZipBase64(String(r.result));
      setDemoZipName(file.name);
    };
    r.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    if (editing && !editNote.trim()) {
      setErr("Reason for Edit / Change Note is required.");
      setBusy(false);
      return;
    }
    const payload = {
      name: f.name, owner: f.owner, category: f.category, status: f.status,
      implementation_status: f.implementation_status, impact: f.impact, roi: parseFloat(f.roi) || 0, problem: f.problem,
      capabilities: f.capabilities.split('\n').map((x) => x.trim()).filter(Boolean),
      delivers: f.delivers, benefits: f.benefits,
      tags: f.tags ? f.tags.split(',').map((x) => x.trim()).filter(Boolean) : [],
      sample: f.sample, configs: f.configs, demo_url: f.demo_url, video_url: f.video_url, ppt_url: f.ppt_url,
      account: f.account, img_url: f.img_url, achieved_through: f.achieved_through,
      pricing_model: f.pricing_model, price_per_user: f.price_per_user, deployment_fees: f.deployment_fees,
      badges: badges,
      timeline: parseQuickAdd(f.timelineText),
      time_to_deploy: f.time_to_deploy,
      success_stories: f.success_stories,
      co_owners: f.co_owners ? f.co_owners.split(',').map((x) => ({ email: x.trim() })).filter(x => x.email) : [],
      demo_type: f.demo_type || 'html',
    };
    if (demoHtml !== null) payload.demo_html = demoHtml;
    if (demoZipBase64 !== null) payload.demo_zip_url = demoZipBase64;
    if (editing) payload.edit_note = editNote;
    try {
      if (editing) { 
        await updateTool(tool.id, payload); 
        onClose(); 
      }
      else { 
        await addTool(payload); 
        api('/funnel/track-submission', {
          method: 'POST',
          body: { action: 'submit', draft_id: f.draft_id || 'unknown' },
          auth: true
        }).catch(() => {});
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
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: 'min(1150px, 98%)',
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
          display: 'grid', gridTemplateColumns: showAI ? 'minmax(0, 1fr) 300px' : '1fr',
          flex: 1, overflow: 'hidden'
        }}>
          {/* Left Panel: Form + Footer */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Scrollable Form Area */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Wizard progress header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                {[{ n: 1, label: 'Core Identity' }, { n: 2, label: 'Value & Impact' }, { n: 3, label: 'Media & Demo' }, { n: 4, label: 'Review' }].map((s, i) => {
                  const isDone = step > s.n;
                  const isActive = step === s.n;
                  return (
                    <React.Fragment key={s.n}>
                      {i > 0 && <div style={{ flex: '0 1 56px', height: 2, borderRadius: 1, background: step > i ? 'var(--primary)' : 'var(--border-color)', margin: '0 10px', transition: 'background 0.3s' }} />}
                      <button
                        type="button"
                        onClick={() => setStep(s.n)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}
                      >
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center',
                          fontWeight: 700, fontSize: 11.5, flexShrink: 0,
                          background: isDone || isActive ? 'var(--primary)' : 'transparent',
                          color: isDone || isActive ? '#fff' : 'var(--text-muted)',
                          border: isDone || isActive ? 'none' : '1.5px solid var(--border-color)',
                          transition: 'all 0.2s'
                        }}>
                          {isDone ? '✓' : s.n}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {/* Step 1: Core Info & Metadata */}
          {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>What is it and who owns it? Just the essentials.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Tool Name</label><input autoFocus value={f.name} onChange={set('name')} /></div>
              <div><label style={lbl}>Owner / Submitter</label><input value={f.owner} onChange={set('owner')} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Section</label><select value={f.implementation_status} onChange={set('implementation_status')}>{IMPL.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></div>
              <div><label style={lbl}>Category</label><select value={f.category} onChange={set('category')}><option value="">Select Category</option><option value="IX Suite">IX Suite</option><option value="Tech Infusion">Tech Infusion</option><option value="Innovations Hub">Innovations Hub</option></select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Maturity</label><select value={f.status} onChange={set('status')}><option value="pilot">Pilot</option><option value="active">Active</option><option value="implemented">Implemented</option><option value="retired">Retired</option></select></div>
              {user?.permissions?.can_see_roi !== false ? (
                <div><label style={lbl}>ROI ($/yr)</label><input type="number" value={f.roi} onChange={set('roi')} placeholder="0" /></div>
              ) : (
                <div><label style={lbl}>ROI ($/yr)</label><input type="text" value="Confidential" disabled style={{ background: 'var(--bg-main)', cursor: 'not-allowed', color: 'var(--text-muted)' }} /></div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {user?.permissions?.can_see_client_names !== false ? (
                <div><label style={lbl}>Deployed Client Account</label><input value={f.account} onChange={set('account')} placeholder="e.g. Concentrix" /></div>
              ) : (
                <div><label style={lbl}>Deployed Client Account</label><input type="text" value="Confidential Client" disabled style={{ background: 'var(--bg-main)', cursor: 'not-allowed', color: 'var(--text-muted)' }} /></div>
              )}
              <div><label style={lbl}>Time to Deploy / Reproduce</label><input value={f.time_to_deploy} onChange={set('time_to_deploy')} placeholder="e.g. 2 weeks, 1 month" /></div>
            </div>
            <div>
              <div>
                <label style={lbl}>Custom Card Image (URL or Upload)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input 
                    value={f.img_url?.startsWith('data:') ? '[Uploaded Image]' : f.img_url} 
                    onChange={set('img_url')} 
                    placeholder="https://…/image.png" 
                    style={{ flex: 1 }} 
                    disabled={f.img_url?.startsWith('data:')}
                  />
                  {f.img_url?.startsWith('data:') ? (
                    <button 
                      type="button" 
                      onClick={() => setF(p => ({ ...p, img_url: '' }))}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                      title="Clear Image"
                    >
                      <X size={14} />
                    </button>
                  ) : (
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
                  )}
                </div>
              </div>
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

          {/* Step 2: Value & Deliverables */}
          {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Why does it matter? Describe the problem and the value it creates.</p>
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
                    <input 
                      value={f.sample?.startsWith('[') ? '[Uploaded Multiple Files]' : (f.sample?.startsWith('data:') ? '[Uploaded File]' : f.sample)} 
                      onChange={set('sample')} 
                      placeholder="https://… or upload files" 
                      style={{ flex: 1 }} 
                      disabled={f.sample?.startsWith('data:') || f.sample?.startsWith('[')}
                    />
                    {f.sample?.startsWith('data:') || f.sample?.startsWith('[') ? (
                      <button 
                        type="button" 
                        onClick={() => setF(p => ({ ...p, sample: '' }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                        title="Clear Data File"
                      >
                        <X size={14} />
                      </button>
                    ) : (
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
                    )}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Configs (link or upload, max 5MB)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input 
                      value={f.configs?.startsWith('data:') ? '[Uploaded Config File]' : f.configs} 
                      onChange={set('configs')} 
                      placeholder="https://… or upload file" 
                      style={{ flex: 1 }} 
                      disabled={f.configs?.startsWith('data:')}
                    />
                    {f.configs?.startsWith('data:') ? (
                      <button 
                        type="button" 
                        onClick={() => setF(p => ({ ...p, configs: '' }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                        title="Clear Config File"
                      >
                        <X size={14} />
                      </button>
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Demo Media & Timeline */}
          {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Show it off — a live demo is what gets tools adopted.</p>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Demo media</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {f.demo_type === 'url' ? (
                  <div><label style={lbl}>Web demo (URL)</label><input value={f.demo_url} onChange={set('demo_url')} placeholder="https://your-app.example.com" /></div>
                ) : (
                  <div><label style={lbl}>Live Demo Mode</label><div style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingTop: 8, lineHeight: 1.4 }}>Configuring {f.demo_type === 'html' ? 'HTML file upload' : 'Docker ZIP upload'} below</div></div>
                )}
                <div>
                  <label style={lbl}>Video (URL or Upload, max 5MB)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input 
                      value={f.video_url?.startsWith('data:') ? '[Uploaded Video]' : f.video_url} 
                      onChange={set('video_url')} 
                      placeholder="YouTube / mp4 link" 
                      style={{ flex: 1 }} 
                      disabled={f.video_url?.startsWith('data:')}
                    />
                    {f.video_url?.startsWith('data:') ? (
                      <button 
                        type="button" 
                        onClick={() => setF(p => ({ ...p, video_url: '' }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                        title="Clear Video"
                      >
                        <X size={14} />
                      </button>
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Pitch deck (PPT URL or Upload, max 5MB)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input 
                    value={f.ppt_url?.startsWith('data:') ? '[Uploaded Pitch Deck]' : f.ppt_url} 
                    onChange={set('ppt_url')} 
                    placeholder="https://…/deck.pptx" 
                    style={{ flex: 1 }} 
                    disabled={f.ppt_url?.startsWith('data:')}
                  />
                  {f.ppt_url?.startsWith('data:') ? (
                    <button 
                      type="button" 
                      onClick={() => setF(p => ({ ...p, ppt_url: '' }))}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                      title="Clear Pitch Deck"
                    >
                      <X size={14} />
                    </button>
                  ) : (
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
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.45 }}>
                  Recommended: Upload your slide deck to the <a href="https://cnxmail.sharepoint.com/sites/msteams_6fa7d4/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents%2FTayim%2FInnovation%20Decks&viewid=4016852e%2D4dea%2D4b92%2Dab08%2Dae8ac56ee35b&newTargetListUrl=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents&viewpath=%2Fsites%2Fmsteams%5F6fa7d4%2FShared%20Documents%2FForms%2FAllItems%2Easpx" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>Concentrix SharePoint Innovation Decks repository</a> and paste the sharing link here.
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Live Demo Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: user?.permissions?.can_push_live_demos !== false ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 10, marginBottom: 12, marginTop: 6 }}>
                  {[
                    { id: 'html', icon: '📄', title: 'HTML Demo', desc: 'Single self-contained .html file' },
                    ...(user?.permissions?.can_push_live_demos !== false ? [
                      { id: 'container', icon: '📦', title: 'Live Application', desc: 'Full app as ZIP, runs in a container' }
                    ] : []),
                    { id: 'url', icon: '🔗', title: 'External URL', desc: 'Link to an already-hosted demo' },
                  ].map((opt) => {
                    const sel = (f.demo_type || 'html') === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setF({ ...f, demo_type: opt.id })}
                        style={{
                          padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: sel ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                          background: sel ? 'var(--secondary)' : 'var(--bg-main)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: sel ? 'var(--primary)' : 'var(--text-primary)' }}>{opt.title}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.35 }}>{opt.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {f.demo_type === 'url' && (
                  <div>
                    <label style={lbl}>Web demo (URL)</label>
                    <input value={f.demo_url} onChange={set('demo_url')} placeholder="https://your-app.example.com" />
                  </div>
                )}

                {f.demo_type === 'html' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-color)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                      <Upload size={14} />{demoName ? `✓ ${demoName}` : editing && tool.demo_type === 'html' && tool.has_demo ? 'HTML demo attached — choose to replace' : 'Upload self-contained .html demo'}
                      <input type="file" accept=".html,text/html" onChange={onFile} style={{ display: 'none' }} />
                    </label>
                    {(demoHtml !== null || (editing && tool.demo_type === 'html' && tool.has_demo)) && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setDemoHtml('');
                          setDemoName('');
                          if (editing) tool.has_demo = false;
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                        title="Clear HTML Demo"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}

                {f.demo_type === 'container' && (
                  <div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-color)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                        <Upload size={14} />{demoZipName ? `✓ ${demoZipName}` : editing && tool.demo_type === 'container' && tool.demo_zip_url ? 'ZIP codebase attached — choose to replace' : 'Upload application codebase (.zip)'}
                        <input type="file" accept=".zip" onChange={onZipFile} style={{ display: 'none' }} />
                      </label>
                      {(demoZipBase64 !== null || (editing && tool.demo_type === 'container' && tool.demo_zip_url)) && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setDemoZipBase64('');
                            setDemoZipName('');
                            if (editing) {
                              tool.demo_zip_url = '';
                              tool.has_demo = false;
                            }
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 38, border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                          title="Clear Codebase ZIP"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.45 }}>
                      💡 <b>Tip:</b> Make sure to exclude large folders (like <code>node_modules</code> or Python <code>.venv</code>) before zipping your project.
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <label style={lbl}>Success Stories (Multiple PDFs/PPTs)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {successStories.map((story, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{story.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{story.file_url.startsWith('data:') ? '[Uploaded File]' : 'Link'}</span>
                      <button type="button" onClick={() => onRemoveStory(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input 
                    placeholder="Story Title (e.g. Finance ROI)" 
                    value={storyTitle} 
                    onChange={(e) => setStoryTitle(e.target.value)} 
                    style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--bg-card)', fontSize: 12.5, fontWeight: 600 }}>
                    Upload file & Add
                    <input type="file" accept=".pdf,.ppt,.pptx" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!storyTitle.trim()) {
                        alert('Please enter a title for the success story first.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File size exceeds the 5MB limit.');
                        return;
                      }
                      const r = new FileReader();
                      r.onload = () => {
                        onAddStory(storyTitle.trim(), String(r.result));
                        setStoryTitle('');
                      };
                      r.readAsDataURL(file);
                    }} style={{ display: 'none' }} />
                  </label>
                </div>
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

          {/* Step 4: Review & Submit */}
          {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 24px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Almost there — double-check everything before submitting.</p>

            {(() => {
              const issues = [];
              if (!f.name.trim()) issues.push({ field: 'Tool Name', step: 1 });
              if (!f.owner.trim()) issues.push({ field: 'Owner / Submitter', step: 1 });
              if (!f.category) issues.push({ field: 'Category', step: 1 });
              if (!f.problem.trim()) issues.push({ field: 'Problem it solves', step: 2 });
              const hasDemo = demoHtml || demoZipBase64 || f.demo_url || (editing && (tool.has_demo || tool.demo_zip_url));
              if (!hasDemo && !f.video_url) issues.push({ field: 'A demo or video', step: 3 });
              if (issues.length === 0) return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                  <CheckCircle2 size={16} /> Everything looks complete. Ready to submit!
                </div>
              );
              return (
                <div style={{ padding: '10px 14px', background: 'rgba(255,132,0,0.08)', border: '1px solid rgba(255,132,0,0.3)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--warning-text)', marginBottom: 6 }}>
                    <AlertTriangle size={15} /> Missing details
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {issues.map((iss) => (
                      <button key={iss.field} type="button" onClick={() => setStep(iss.step)}
                        style={{ fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                        {iss.field} → Step {iss.step}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 13 }}>
              <div><b>Name:</b> {f.name || '—'}</div>
              <div><b>Owner:</b> {f.owner || '—'}</div>
              <div><b>Category:</b> {f.category || '—'}</div>
              <div><b>Maturity:</b> {f.status}</div>
              <div><b>Section:</b> {IMPL.find(i => i.id === f.implementation_status)?.label}</div>
              <div><b>ROI:</b> {user?.permissions?.can_see_roi !== false ? (f.roi ? `$${Number(f.roi).toLocaleString()}/yr` : '—') : 'Confidential'}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Problem:</b> {f.problem ? (f.problem.length > 160 ? f.problem.slice(0, 160) + '…' : f.problem) : '—'}</div>
              <div><b>Demo:</b> {f.demo_type === 'container' ? (demoZipName || (editing && tool.demo_zip_url ? 'ZIP attached' : 'ZIP missing')) : f.demo_type === 'url' ? (f.demo_url || 'URL missing') : (demoName || (editing && tool.has_demo ? 'HTML attached' : 'HTML missing'))}</div>
              <div><b>Video:</b> {f.video_url ? '✓' : '—'} &nbsp; <b>Deck:</b> {f.ppt_url ? '✓' : '—'} &nbsp; <b>Stories:</b> {successStories.length}</div>
              <div><b>Tags:</b> {f.tags || '—'}</div>
              <div><b>Timeline entries:</b> {f.timelineText ? f.timelineText.split('\n').filter(Boolean).length : 0}</div>
            </div>
          </div>
          )}
          </div>
          </div>
          </div>
            
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            {editing && step === 4 && (
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
                      api('/funnel/track-submission', {
                        method: 'POST',
                        body: { action: 'discard', draft_id: f.draft_id || 'unknown' },
                        auth: true
                      }).catch(() => {});
                      localStorage.removeItem('tool_submit_draft');
                      setF({
                        name: '', owner: '', category: '', status: 'pilot', implementation_status: 'not_implemented',
                        impact: '', roi: '', problem: '', capabilities: '', delivers: '', benefits: '', tags: '',
                        sample: '', configs: '', demo_url: '', video_url: '', ppt_url: '', account: '', img_url: '',
                        timelineText: '', pricing_model: '', price_per_user: '', deployment_fees: '',
                        time_to_deploy: '', success_stories: [], draft_id: ''
                      });
                      setSuccessStories([]);
                    }
                  }}
                  style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Clear Draft
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                {step > 1 && (
                  <button type="button" onClick={() => setStep(step - 1)}
                    style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                    Back
                  </button>
                )}
                {step < 4 ? (
                  <button type="button" onClick={() => setStep(step + 1)}
                    style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                    Continue →
                  </button>
                ) : (
                  <button onClick={submit} disabled={busy} style={{ padding: '10px 30px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13.5, opacity: busy ? 0.6 : 1, cursor: 'pointer' }}>
                    {busy ? 'Saving…' : editing ? 'Save changes' : 'Submit for review ✓'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

          {showAI && (
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <AICopilotChat inline={true} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
