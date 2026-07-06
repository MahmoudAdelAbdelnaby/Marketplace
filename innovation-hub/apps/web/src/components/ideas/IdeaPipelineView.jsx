import React, { useState, useEffect } from 'react';
import { PlusCircle, Save, Send, Layers, TableProperties, Trash2, X, Plus, Search, Filter, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from '../layout/Layout.module.css';
import Sidebar from '../layout/Sidebar';
import RightPanel from '../layout/RightPanel';
import AiPanel from '../layout/AiPanel';
import CanvasPage from '../canvas/CanvasPage';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCatalogStore } from '../../store/useCatalogStore';
import { api } from '../../api';
import ToolForm from '../catalog/ToolForm';

const ISTATUS = {
  draft: { label: 'Draft', c: '#8a9aa0' },
  proposed: { label: 'Proposed', c: '#00737f' },
  changes: { label: 'Changes requested', c: '#ff8400' },
  approved: { label: 'Approved', c: '#00897b' },
  declined: { label: 'Declined', c: '#cc3262' },
};

export default function IdeaPipelineView() {
  const user = useAuthStore((s) => s.user);
  const isProgressCollapsed = useCanvasStore((s) => s.isProgressCollapsed);
  const isScorecardCollapsed = useCanvasStore((s) => s.isScorecardCollapsed);
  const isAiPanelCollapsed = useCanvasStore((s) => s.isAiPanelCollapsed);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const loadBackendIdea = useCanvasStore((s) => s.loadBackendIdea);
  const canvas = useCanvasStore((s) => s.canvas);
  const getScores = useCanvasStore((s) => s.getScores);
  const openTabs = useCanvasStore((s) => s.openTabs) || [];
  const activeTabId = useCanvasStore((s) => s.activeTabId);
  const newTab = useCanvasStore((s) => s.newTab);
  const switchTab = useCanvasStore((s) => s.switchTab);
  const closeTab = useCanvasStore((s) => s.closeTab);
  const renameTab = useCanvasStore((s) => s.renameTab);
  
  const setToolFormDraft = useCatalogStore((s) => s.setToolFormDraft);
  const [submittingTool, setSubmittingTool] = useState(false);
  
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('canvas'); // 'canvas' | 'table'
  const [ideas, setIdeas] = useState([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [renamingTabId, setRenamingTabId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleRenameSubmit = (id) => {
    if (renameValue.trim()) {
      renameTab(id, renameValue.trim());
    }
    setRenamingTabId(null);
    setRenameValue('');
  };

  const loadIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const data = await api('/ideas');
      // Filter ideas to only show ones owned by the user, or show all if admin/committee
      const myIdeas = ['admin', 'committee'].includes(user?.role) 
        ? data 
        : data.filter((i) => i.owner_id === user?.id);
      setIdeas(myIdeas);
    } catch (e) {
      console.error('Failed to load ideas:', e);
    } finally {
      setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    loadIdeas();
  }, [user]);

  useEffect(() => {
    document.body.classList.add('idea-pipeline-active');
    return () => {
      document.body.classList.remove('idea-pipeline-active');
    };
  }, []);

  useEffect(() => {
    const vocId = searchParams.get('voc_id');
    if (vocId) {
      setActiveTab('canvas');
      if (!canvas.voc_id || canvas.voc_id != vocId) {
        // Here we could inject the problem statement if we fetched it, but simply setting voc_id works for association
        newTab(); // Ensure fresh canvas or just mutate the current one
        useCanvasStore.setState((s) => ({ canvas: { ...s.canvas, voc_id: parseInt(vocId) } }));
      }
    }
  }, [searchParams]);

  const handleNew = () => {
    newTab();
  };

  const handleSave = async () => {
    const defaultName = canvas.name || '';
    const name = window.prompt('Name this idea:', defaultName);
    if (!name) return;
    try {
      const saved = await api('/ideas', { 
        method: 'POST', 
        body: { id: canvas.id, name, canvas, scores: getScores(), status: 'draft' } 
      });
      loadBackendIdea(saved);
      window.alert('Idea saved as draft.');
      loadIdeas();
    } catch (e) {
      window.alert('Save failed: ' + e.message);
    }
  };

  const handleSubmit = async () => {
    const defaultName = canvas.name || '';
    const name = window.prompt('Name this idea for the committee:', defaultName);
    if (!name) return;
    try {
      await api('/ideas', { 
        method: 'POST', 
        body: { id: canvas.id, name, canvas, scores: getScores(), status: 'proposed', voc_id: canvas.voc_id, team: canvas.team } 
      });
      window.alert('Idea submitted to the committee. Check progress in the Saved Ideas tracker.');
      clearCanvas();
      loadIdeas();
      setActiveTab('table');
    } catch (e) {
      window.alert('Submit failed: ' + e.message);
    }
  };

  const exportCSV = () => {
    const headers = ['Idea Title', 'Team', 'Status', 'Completeness', 'Overall Score', 'Note'];
    const rows = filteredIdeas.map(i => [
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.team || '').replace(/"/g, '""')}"`,
      i.status || 'draft',
      i.scores?.completenessPct || 0,
      i.scores?.overallScore || 0,
      `"${(i.review_note || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ideas_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredIdeas = ideas.filter(i => {
    if (statusFilter !== 'All' && i.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!i.name?.toLowerCase().includes(q) && !i.team?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const deleteIdea = async (ideaId) => {
    if (!window.confirm('Are you sure you want to delete this idea?')) return;
    try {
      await api(`/ideas/${ideaId}`, { method: 'DELETE' });
      // If we deleted the active editing idea, clear canvas
      if (canvas.id === ideaId) {
        clearCanvas();
      }
      loadIdeas();
    } catch (e) {
      window.alert('Delete failed: ' + e.message);
    }
  };

  const actionBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card,#fff)', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
  const tabBtn = (id, label, Icon) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, color: activeTab === id ? 'var(--primary)' : 'var(--text-secondary)',
    borderBottom: activeTab === id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
    transition: 'all 0.15s ease'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar, var(--bg-card))' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Idea Pipeline</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Scope a new idea or view scoped drafts and review updates.</div>
        
        {activeTab === 'canvas' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={actionBtn} onClick={handleNew}><PlusCircle size={16} /> New</button>
            <button style={actionBtn} onClick={handleSave}><Save size={16} /> Save Draft</button>
            <button style={{ ...actionBtn, background: 'var(--primary)', color: '#fff', border: 'none' }} onClick={handleSubmit}><Send size={16} /> Submit for review</button>
          </div>
        )}
      </div>

      {/* Tabs Selection Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar, var(--bg-card))', paddingLeft: '24px', alignItems: 'flex-end', flexWrap: 'nowrap', overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <button onClick={() => setActiveTab('canvas')} style={tabBtn('canvas', 'Storyboard Board', Layers)}>
            <Layers size={15} /> Storyboard Board
          </button>
          <button onClick={() => { setActiveTab('table'); loadIdeas(); }} style={tabBtn('table', 'Saved Ideas Tracker', TableProperties)}>
            <TableProperties size={15} /> Saved Ideas Tracker ({ideas.length})
          </button>
        </div>

        {/* Board Tabs */}
        {activeTab === 'canvas' && (
          <div style={{ display: 'flex', flex: 1, overflowX: 'auto', background: 'var(--bg-sidebar, var(--bg-card))', borderLeft: '1px solid var(--border-color)', paddingLeft: 0, paddingRight: 24, alignSelf: 'stretch', alignItems: 'stretch' }}>
             {openTabs.map(tab => {
               const isActive = tab.id === activeTabId;
               const title = isActive ? (canvas.name || 'Untitled Idea') : (tab.canvasData.name || 'Untitled Idea');
               return (
                 <div 
                   key={tab.id} 
                   onClick={() => switchTab(tab.id)} 
                   style={{ 
                     display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', 
                     borderRight: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)',
                     marginRight: '-1px', cursor: 'pointer',
                     background: isActive ? 'var(--bg-main)' : 'var(--bg-card)',
                     borderTop: isActive ? '2px solid var(--primary)' : '1px solid transparent',
                     color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                     fontWeight: isActive ? 700 : 500, fontSize: 12.5,
                     marginBottom: '-1px', zIndex: isActive ? 2 : 1
                   }}
                 >
                   {renamingTabId === tab.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(tab.id);
                          if (e.key === 'Escape') setRenamingTabId(null);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          color: 'inherit',
                          fontWeight: 'inherit',
                          fontSize: 'inherit',
                          fontFamily: 'inherit',
                          padding: '2px 4px',
                          width: Math.max(60, renameValue.length * 8) + 'px',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      <span 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingTabId(tab.id);
                          setRenameValue(isActive ? (canvas.name || '') : (tab.canvasData.name || ''));
                        }}
                      >
                        {title}
                      </span>
                    )}
                   <div 
                     onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                     style={{ padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}
                     onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                     onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'inherit'; }}
                   >
                     <X size={13} />
                   </div>
                 </div>
               );
             })}
             <button 
               onClick={handleNew} 
               style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 16px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             >
               <Plus size={16} />
             </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'canvas' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            
            <div className={styles.mainArea} style={{ flex: 1, minHeight: 0 }}>
              <aside className={isProgressCollapsed ? styles.leftPanelCollapsed : styles.leftPanel}>
              <Sidebar />
            </aside>
            <main className={styles.centerPanel}>
              <CanvasPage />
            </main>
            <aside className={isScorecardCollapsed ? styles.rightPanelCollapsed : styles.rightPanel}>
               <RightPanel />
             </aside>
             <aside className={isAiPanelCollapsed ? styles.rightPanelCollapsed : styles.rightPanel}>
               <AiPanel />
             </aside>
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxWidth: 1080, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Saved Ideas &amp; Scoping Drafts</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, margin: 0 }}>Manage your scoping drafts, inspect review committee decisions, or load any draft back into the active canvas.</p>
              </div>
              <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                <input 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search ideas or teams..."
                  style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, minWidth: 140 }}>
                <option value="All">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="proposed">Proposed</option>
                <option value="changes">Changes Requested</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
            </div>

            {loadingIdeas ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading ideas tracker…</div>
            ) : ideas.length === 0 ? (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: '48px', textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                <strong style={{ display: 'block', fontSize: 16, marginBottom: 6 }}>No saved ideas found</strong>
                <p style={{ fontSize: 13, margin: '0 0 16px', color: 'var(--text-muted)' }}>You haven't saved any canvas scoping drafts or submitted ideas to the database yet.</p>
                <button onClick={() => setActiveTab('canvas')} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Start Scoping now</button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <th style={{ padding: '14px 16px' }}>Idea Title</th>
                      <th style={{ padding: '14px 16px' }}>Team</th>
                      <th style={{ padding: '14px 16px' }}>Status</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Completeness</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Overall Score</th>
                      <th style={{ padding: '14px 16px' }}>Feedback Note</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIdeas.map((idea) => {
                      const completeness = idea.scores?.completenessPct || 0;
                      const overall = idea.scores?.overallScore || 0;
                      const currentStatus = ISTATUS[idea.status] || ISTATUS.proposed;
                      return (
                        <tr key={idea.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s' }} className="card-hover">
                          <td style={{ padding: '16px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {idea.name}
                            {canvas.id === idea.id && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>EDITING</span>}
                          </td>
                          <td style={{ padding: '16px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                            {idea.team || '—'}
                          </td>
                          <td style={{ padding: '16px 16px' }}>
                            <span style={{ 
                              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, 
                              color: currentStatus.c,
                              background: currentStatus.c + '14',
                              padding: '4px 8px', borderRadius: 6
                            }}>
                              {currentStatus.label}
                            </span>
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 90 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${completeness}%`, height: '100%', background: 'var(--primary)' }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{completeness}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-text)' }}>
                            {overall}
                          </td>
                          <td style={{ padding: '16px 16px', color: idea.status === 'changes' ? 'var(--warning)' : idea.status === 'declined' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: 12.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={idea.review_note}>
                            {idea.review_note || '—'}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button 
                                onClick={() => {
                                  loadBackendIdea(idea);
                                  setActiveTab('canvas');
                                }}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--primary-text)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                              >
                                Resume/Edit
                              </button>
                              <button 
                                onClick={() => {
                                  setToolFormDraft({
                                    name: idea.name || '',
                                    problem: idea.canvas?.problemStatement || '',
                                    delivers: idea.canvas?.proposedSolution || '',
                                    benefits: idea.canvas?.businessValue || '',
                                    category: 'Innovations Hub',
                                    department: idea.team || '',
                                    idea_id: idea.id,
                                    status: 'pilot',
                                    implementation_status: 'not_implemented'
                                  });
                                  setSubmittingTool(true);
                                }}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                              >
                                Submit as Tool
                              </button>
                              <button 
                                onClick={() => deleteIdea(idea.id)}
                                style={{ padding: '6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                                onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                title="Delete idea"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {submittingTool && <ToolForm onClose={() => setSubmittingTool(false)} />}
    </div>
  );
}
