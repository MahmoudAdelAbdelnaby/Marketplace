import React, { useEffect, useState } from 'react';
import { ChevronUp, Megaphone, Plus, Lightbulb, User, Building, ExternalLink, Search, X, Trash2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useVocStore } from '../../store/useVocStore';
import { api } from '../../api';

export default function VoiceBoard() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const { vocs, load, addVoc, voteVoc, deleteVoc } = useVocStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [department, setDepartment] = useState('');
  const [client, setClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [viewingIdea, setViewingIdea] = useState(null);
  const [viewingSolutionsVocId, setViewingSolutionsVocId] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('concept');

  useEffect(() => { 
    load(); 
    api('/ideas').then(setIdeas).catch(() => {});
  }, [load]);

  const voteIdeaLocal = async (id) => {
    try {
      const updatedIdea = await api(`/ideas/${id}/vote`, { method: 'POST' });
      setIdeas(prev => prev.map(i => i.id === id ? updatedIdea : i));
    } catch (e) {
      alert("Failed to vote for idea: " + e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !statement.trim()) return;
    setSubmitting(true);
    try {
      await addVoc({ title, problem_statement: statement, department, client });
      setTitle(''); setStatement(''); setDepartment(''); setClient('');
      setIsFormOpen(false);
    } catch (e) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteVoc = async (id) => {
    if (window.confirm("Are you sure you want to delete this VOC problem statement?")) {
      try {
        await deleteVoc(id);
      } catch (e) {
        alert("Failed to delete VOC problem: " + e.message);
      }
    }
  };

  const handleIdeate = (vocId) => {
    nav(`/ideas?voc_id=${vocId}`);
  };

  const uniqueClients = Array.from(new Set(vocs.map(v => v.client).filter(Boolean)));

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><Megaphone /> Voice of Clients</h1>
        <button onClick={() => setIsFormOpen(!isFormOpen)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
          <Plus size={16} /> Submit a Problem
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 22 }}>Have a problem statement from a client or operations but lack the tools to solve it? Submit it here so innovators can ideate solutions.</p>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, width: '100%', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
          <input 
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search problems..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
          />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, width: 180, cursor: 'pointer' }}>
          <option value="">All Departments</option>
          {['Operations', 'Marketing', 'Sales', 'HR', 'IT', 'Analytics', 'Finance', 'Legal', 'Training', 'Quality', 'WFM', 'Leadership', 'Innovation & Transformation', 'Account Management'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {user && ['admin', 'committee', 'approver'].includes(user.role) && (
          <div style={{ position: 'relative', width: 180 }}>
            <input 
              list="voc-clients-list" 
              value={filterClient} 
              onChange={e => setFilterClient(e.target.value)}
              placeholder="All Clients"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
            />
            <datalist id="voc-clients-list">
              {uniqueClients.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontFamily: 'var(--font-display)' }}>Submit a Problem Statement</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Problem Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g., Automated reporting for enterprise clients" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Client (Freetext / autocomplete)</label>
              <input value={client} list="submit-clients-datalist" onChange={(e) => setClient(e.target.value)} placeholder="E.g., Concentrix, Google" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
              <datalist id="submit-clients-datalist">
                {uniqueClients.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <option value="">Select a department...</option>
              {['Operations', 'Marketing', 'Sales', 'HR', 'IT', 'Analytics', 'Finance', 'Legal', 'Training', 'Quality', 'WFM', 'Leadership', 'Innovation & Transformation', 'Account Management'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Problem Statement Details</label>
            <textarea required value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Describe the client's problem, pain points, and current workarounds..." rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsFormOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{submitting ? 'Submitting...' : 'Submit Problem'}</button>
          </div>
        </form>
      )}

      {vocs.length === 0 && !isFormOpen && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, background: 'var(--bg-card)', borderRadius: 14, border: '1px dashed var(--border-color)' }}>No problem statements submitted yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {vocs.filter(v => {
          if (filterDept && v.department !== filterDept) return false;
          if (filterClient && (v.client || '').toLowerCase() !== filterClient.toLowerCase()) return false;
          if (search) {
            const sq = search.toLowerCase();
            const t = (v.title || '').toLowerCase();
            const p = (v.problem_statement || '').toLowerCase();
            if (!t.includes(sq) && !p.includes(sq)) return false;
          }
          return true;
        }).map((voc) => {
          const voted = (voc.voters || []).includes(user?.id);
          const relatedIdeas = ideas.filter(i => i.voc_id === voc.id);
          return (
            <div key={voc.id} className="card-hover" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '20px 24px', width: '100%' }}>
              
              {/* Header row (divider below) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-color)', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={13} /> {voc.owner_name}</span>
                  {voc.department && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={13} /> {voc.department}</span>}
                  {voc.client && (user && ['admin', 'committee', 'approver'].includes(user.role) ? (
                    <span style={{ background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>Client: {voc.client}</span>
                  ) : (
                    voc.client === 'Confidential' && <span style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>Client: Confidential</span>
                  ))}
                  <span>{new Date(voc.created_at * 1000).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#f59e0b', background: '#f59e0b1f', borderRadius: 6, padding: '3px 8px' }}>STATUS: {(voc.status || 'open').toUpperCase()}</span>
                  {user?.role === 'admin' && (
                    <button 
                      onClick={() => handleDeleteVoc(voc.id)} 
                      title="Delete Problem Statement" 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom section split */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {/* Left controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 140, flexShrink: 0 }}>
                  <button onClick={() => voteVoc(voc.id)} title="Upvote this problem" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 60, borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${voted ? 'var(--primary)' : 'var(--border-color)'}`, background: voted ? 'var(--secondary)' : 'var(--bg-card)', color: voted ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    <ChevronUp size={22} /><span style={{ fontWeight: 800, fontSize: 16 }}>{voc.votes}</span>
                  </button>
                  {relatedIdeas.length > 0 && (
                    <button 
                      onClick={() => setViewingSolutionsVocId(voc.id)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--primary-text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Solutions ({relatedIdeas.length})
                    </button>
                  )}
                </div>

                {/* Main statement content */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{voc.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{voc.problem_statement}</p>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, justifyContent: 'center' }}>
                  <button onClick={() => handleIdeate(voc.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--secondary)', color: 'var(--primary-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Lightbulb size={16} /> Ideate a Solution
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Viewing Solutions Popup Modal */}
      {viewingSolutionsVocId && (() => {
        const solutionsList = ideas.filter(i => i.voc_id === viewingSolutionsVocId);
        return (
        <div onClick={() => setViewingSolutionsVocId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,38,50,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(700px, 100%)', background: 'var(--bg-card-solid)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 19, fontFamily: 'var(--font-display)', fontWeight: 700 }}>Ideated Solutions</h3>
              <button onClick={() => setViewingSolutionsVocId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 6 }}>
              {solutionsList.map(i => {
                const iVoted = (i.voters || []).includes(user?.id);
                return (
                  <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--bg-main)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14.5 }}>{i.name || 'Untitled Idea'}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>STATUS: {(i.status || 'draft').toUpperCase()}</span>
                        <button 
                          onClick={() => { setViewingIdea(i); setActiveModalTab('concept'); }} 
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                        >
                          View Full Details
                        </button>
                        <button 
                          onClick={() => voteIdeaLocal(i.id)} 
                          style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${iVoted ? 'var(--primary)' : 'var(--border-color)'}`, 
                            background: iVoted ? 'var(--secondary)' : 'var(--bg-card)', 
                            color: iVoted ? 'var(--primary)' : 'var(--text-secondary)',
                            fontSize: 11, fontWeight: 700
                          }}
                        >
                          <ChevronUp size={14} /> {i.votes || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Full Canvas Details Popup Modal */}
      {viewingIdea && (
        <div onClick={() => setViewingIdea(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,38,50,0.6)', backdropFilter: 'blur(6px)', zIndex: 10000, display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(880px, 100%)', background: 'var(--bg-card-solid)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{viewingIdea.name || 'Untitled Idea'}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scoped by {viewingIdea.owner || 'Unknown'} | Team: {viewingIdea.team || '—'}</span>
              </div>
              <button onClick={() => setViewingIdea(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {/* Modal Tabs for Phase Groups */}
            <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 16, overflowX: 'auto', flexShrink: 0 }}>
              {[
                { id: 'concept', label: '1. Concept & Problem' },
                { id: 'strategy', label: '2. Strategy' },
                { id: 'execution', label: '3. Execution & Impact' },
                { id: 'outcomes', label: '4. Risks & Success' },
                { id: 'pitch', label: '5. AI Pitch' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveModalTab(t.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeModalTab === t.id ? 'var(--primary)' : 'transparent',
                    color: activeModalTab === t.id ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, fontSize: 13.5 }}>
              {activeModalTab === 'concept' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--primary)' }}>Problem Statement</h4>
                    <p style={{ margin: 0, background: 'var(--bg-main)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.problemStatement || '—'}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Current Process</h4>
                      <p style={{ margin: 0, background: 'var(--bg-main)', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.currentProcess || '—'}</p>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Pain Points</h4>
                      <p style={{ margin: 0, background: 'var(--bg-main)', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.painPoints || '—'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Frequency</h4>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '4px 8px', borderRadius: 4 }}>{viewingIdea.canvas?.frequency || '—'}</span>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Implications of Inaction</h4>
                      <p style={{ margin: 0, background: 'var(--bg-main)', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.implicationsOfInaction || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Target Users</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(viewingIdea.canvas?.primaryUsers || []).map((u, i) => (
                        <span key={i} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 20 }}>{u}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--primary)' }}>Value Proposition Formula</h4>
                    <div style={{ background: 'var(--secondary)', padding: 14, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong>Helps: </strong>{viewingIdea.canvas?.vpAudience || '—'}</div>
                      <div><strong>Achieve: </strong>{viewingIdea.canvas?.vpOutcome || '—'}</div>
                      <div><strong>By doing: </strong>{viewingIdea.canvas?.vpMethod || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'strategy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Strategic Alignment Scores</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {Object.entries(viewingIdea.canvas?.strategicAlignment || {}).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-main)', borderRadius: 6 }}>
                          <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span style={{ fontWeight: 700, color: val > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{val === 2 ? 'Definite' : val === 1 ? 'Potential' : 'None'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Scalability Assessment</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><strong>Industries: </strong>{viewingIdea.canvas?.industries?.join(', ') || '—'}</div>
                      <div><strong>Functions: </strong>{viewingIdea.canvas?.functions?.join(', ') || '—'}</div>
                      <div><strong>Regions: </strong>{viewingIdea.canvas?.regions?.join(', ') || '—'}</div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Differentiation</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong>Alternatives: </strong>{viewingIdea.canvas?.currentAlternatives || '—'}</div>
                      <div><strong>Competitors: </strong>{viewingIdea.canvas?.existingCompetitors || '—'}</div>
                      <div><strong>What makes it unique: </strong>{viewingIdea.canvas?.whatMakesUnique || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'execution' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Business Impact Estimation</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 8 }}>
                        <strong>Estimated Users: </strong>{viewingIdea.canvas?.businessImpact?.estimatedUsers || '0'}
                      </div>
                      <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 8 }}>
                        <strong>Hours Saved per User (Weekly): </strong>{viewingIdea.canvas?.businessImpact?.hoursSavedPerUser || '0'}
                      </div>
                    </div>
                    {viewingIdea.canvas?.projectedROI && (
                      <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        <strong>Projected ROI: </strong>{viewingIdea.canvas?.projectedROI}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><strong>Cost Saving Areas: </strong>{viewingIdea.canvas?.businessImpact?.costSavings || '—'}</div>
                      <div><strong>Potential Revenue: </strong>{viewingIdea.canvas?.businessImpact?.revenuePotential || '—'}</div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Feasibility Assessment</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {Object.entries(viewingIdea.canvas?.feasibility || {}).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-main)', borderRadius: 6 }}>
                          <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span style={{ fontWeight: 700 }}>{val === 1 ? 'Low' : val === 2 ? 'Medium-Low' : val === 3 ? 'Medium' : val === 4 ? 'Medium-High' : 'High'}</span>
                        </div>
                      ))}
                    </div>
                    {viewingIdea.canvas?.anticipatedRoadblockers && (
                      <div style={{ marginTop: 10 }}><strong>Anticipated Roadblockers/Technology Dependencies: </strong>{viewingIdea.canvas?.anticipatedRoadblockers}</div>
                    )}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Adoption Potential</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {Object.entries(viewingIdea.canvas?.adoption || {}).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-main)', borderRadius: 6 }}>
                          <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span style={{ fontWeight: 700 }}>{val === 1 ? 'Low' : val === 2 ? 'Medium-Low' : val === 3 ? 'Medium' : val === 4 ? 'Medium-High' : 'High'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Build vs Partner</h4>
                    <div style={{ background: 'var(--bg-main)', padding: 12, borderRadius: 8 }}>
                      <div><strong>Decision: </strong>{viewingIdea.canvas?.decision || '—'}</div>
                      <div style={{ marginTop: 6 }}><strong>Justification: </strong>{viewingIdea.canvas?.decisionJustification || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'outcomes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Risks & Dependencies</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <strong>Technical: </strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{viewingIdea.canvas?.risks?.technical?.join(', ') || 'None'}</p>
                      </div>
                      <div>
                        <strong>Operational: </strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{viewingIdea.canvas?.risks?.operational?.join(', ') || 'None'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Success Metrics</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <strong>KPIs: </strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{viewingIdea.canvas?.successMetrics?.kpis || '—'}</p>
                      </div>
                      <div>
                        <strong>Targets: </strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{viewingIdea.canvas?.successMetrics?.revenueTargets || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'pitch' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {viewingIdea.canvas?.proposedPitch && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--primary)' }}>Proposed Pitch for Idea</h4>
                      <p style={{ margin: 0, background: 'var(--bg-main)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.proposedPitch}</p>
                    </div>
                  )}
                  {viewingIdea.canvas?.differentiationAnalysis && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>How It Differs from Existing Tools</h4>
                      <p style={{ margin: 0, background: 'var(--bg-main)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{viewingIdea.canvas?.differentiationAnalysis}</p>
                    </div>
                  )}
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>AI Strategic Evaluation & Value Proposition</h4>
                    <p style={{ margin: 0, background: 'var(--bg-main)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{viewingIdea.canvas?.aiEvaluation || 'No evaluation generated yet.'}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12, textAlign: 'right' }}>
              <button onClick={() => setViewingIdea(null)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Close Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
