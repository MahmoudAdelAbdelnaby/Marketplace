import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Check, RotateCcw, Ban, Search, Trash2, ChevronDown, ChevronUp, Layers, Wrench, FolderArchive, User, Building, Landmark, DollarSign, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

function ReviewCard({ item, type, onDone, me, archived = false, allIdeas = [], onDeleteArchive }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const act = async (decision) => {
    setBusy(true);
    try { 
      await api(`/${type}/${item.id}/review`, { method: 'POST', body: { decision, note } }); 
      onDone(); 
    } catch (e) { 
      alert(e.message); 
      setBusy(false); 
    }
  };

  const btn = (color) => ({ 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: 6, 
    padding: '8px 14px', 
    borderRadius: 9, 
    border: 'none', 
    cursor: 'pointer', 
    fontWeight: 600, 
    fontSize: 13, 
    color: '#fff', 
    background: color, 
    opacity: busy ? 0.6 : 1,
    transition: 'all 0.15s ease'
  });

  // Extract canvas details for display
  const canvas = item.canvas || {};
  const isIdea = type === 'ideas';

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: 0 }}>{item.name}</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>by {item.owner}</span>
            {item.review_status === 'changes' || item.status === 'changes' ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', background: 'rgba(255,132,0,0.1)', padding: '2px 8px', borderRadius: 4 }}>RESUBMITTED</span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Submitted: {new Date((item.created_at || item.updated_at) * 1000).toLocaleDateString()} {item.team ? `| Team: ${item.team}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {archived && me?.role === 'admin' && (
            <button 
              onClick={() => onDeleteArchive(item.id, type)}
              title="Delete permanently from archive"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.1s' }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main summary view */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        {!isIdea && item.idea_id && allIdeas.find(i => i.id === item.idea_id) ? (() => {
          const idea = allIdeas.find(i => i.id === item.idea_id);
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>ORIGINAL IDEA</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{idea.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{idea.canvas?.problemStatement || idea.problem || '—'}</div>
              </div>
              <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--primary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>TOOL SUBMISSION</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.problem || '—'}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>Delivers: {item.delivers || '—'}</div>
              </div>
            </div>
          );
        })() : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>
            {item.problem || canvas?.problemStatement || 'No description provided.'}
          </p>
        )}
      </div>

      {/* Collapsible Scoping details */}
      <div style={{ marginBottom: 12 }}>
        <button 
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', color: 'var(--primary-text)', fontWeight: 600 }}
        >
          {showDetails ? <><ChevronUp size={14} /> Hide Scoping Details</> : <><ChevronDown size={14} /> Show Full Scoping Details</>}
        </button>

        {showDetails && (
          <div style={{ marginTop: 14, padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isIdea ? (
              // Structured Scoping Canvas Details
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5, textTransform: 'uppercase', marginBottom: 4 }}>1. Concept & Problem</div>
                  <div style={{ display: 'grid', gap: 10, paddingLeft: 8 }}>
                    <div><strong>Problem Statement: </strong>{canvas.problemStatement || '—'}</div>
                    <div><strong>Current Process: </strong>{canvas.currentProcess || '—'}</div>
                    <div><strong>Pain Points: </strong>{canvas.painPoints || '—'}</div>
                    <div><strong>Frequency: </strong>{canvas.frequency || '—'}</div>
                    <div><strong>Implications of Inaction: </strong>{canvas.implicationsOfInaction || '—'}</div>
                    <div><strong>Target Users: </strong>{canvas.primaryUsers?.join(', ') || '—'}</div>
                    <div><strong>Value Proposition Aud/Outcome/Method: </strong>{canvas.vpAudience ? `Helps ${canvas.vpAudience} achieve ${canvas.vpOutcome} by ${canvas.vpMethod}` : '—'}</div>
                    <div><strong>Solution Type: </strong>{canvas.solutionTypes?.join(', ') || '—'}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5, textTransform: 'uppercase', marginBottom: 4 }}>2. Solution Strategy</div>
                  <div style={{ display: 'grid', gap: 10, paddingLeft: 8 }}>
                    <div>
                      <strong>Strategic Alignment: </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
                        {Object.entries(canvas.strategicAlignment || {}).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 4 }}>
                            {k.replace(/([A-Z])/g, ' $1')}: {v === 2 ? 'Definite' : v === 1 ? 'Potential' : 'None'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div><strong>Scalability Scope: </strong>{`Industries: ${canvas.industries?.join(', ') || '—'} | Functions: ${canvas.functions?.join(', ') || '—'} | Regions: ${canvas.regions?.join(', ') || '—'}`}</div>
                    <div><strong>Differentiation (Alternatives/Competitors/Unique): </strong>{`Alts: ${canvas.currentAlternatives || '—'} | Competitors: ${canvas.existingCompetitors || '—'} | Unique: ${canvas.whatMakesUnique || '—'}`}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5, textTransform: 'uppercase', marginBottom: 4 }}>3. Execution, Feasibility & Adoption</div>
                  <div style={{ display: 'grid', gap: 10, paddingLeft: 8 }}>
                    <div><strong>Business Impact: </strong>{`Est. Users: ${canvas.businessImpact?.estimatedUsers || '0'} | Hrs Saved: ${canvas.businessImpact?.hoursSavedPerUser || '0'}/wk | Savings: ${canvas.businessImpact?.costSavings || '—'} | Revenue: ${canvas.businessImpact?.revenuePotential || '—'}`}</div>
                    {canvas.projectedROI && <div><strong>Projected ROI: </strong>{canvas.projectedROI}</div>}
                    {canvas.deploymentTimeDays && <div><strong>Time to Deploy: </strong>{canvas.deploymentTimeDays} days</div>}
                    {canvas.pricing && (
                      <div><strong>Pricing: </strong>{`Price/User: $${canvas.pricing.pricePerUser || '0'} | Deployment Fee: $${canvas.pricing.deploymentFees || '0'} | Amount: $${canvas.pricing.amount || '0'}`}</div>
                    )}
                    <div>
                      <strong>Feasibility Scores: </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
                        {Object.entries(canvas.feasibility || {}).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 4 }}>
                            {k}: {v === 1 ? 'Low' : v === 2 ? 'Medium-Low' : v === 3 ? 'Medium' : v === 4 ? 'Medium-High' : 'High'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div><strong>Anticipated Roadblockers/Technology Dependencies: </strong>{canvas.anticipatedRoadblockers || '-'}</div>
                    <div>
                      <strong>Adoption Potential: </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
                        {Object.entries(canvas.adoption || {}).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 4 }}>
                            {k}: {v === 1 ? 'Low' : v === 2 ? 'Medium-Low' : v === 3 ? 'Medium' : v === 4 ? 'Medium-High' : 'High'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div><strong>Build vs Buy (Decision/Justification): </strong>{`Decision: ${canvas.decision || '—'} | Justification: ${canvas.decisionJustification || '—'}`}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5, textTransform: 'uppercase', marginBottom: 4 }}>4. Risks & Success Metrics</div>
                  <div style={{ display: 'grid', gap: 10, paddingLeft: 8 }}>
                    <div><strong>Technical Risks: </strong>{canvas.risks?.technical?.join(', ') || 'None'}</div>
                    <div><strong>Operational Risks: </strong>{canvas.risks?.operational?.join(', ') || 'None'}</div>
                    <div><strong>KPIs & Targets: </strong>{`KPIs: ${canvas.successMetrics?.kpis || '—'} | Targets: ${canvas.successMetrics?.revenueTargets || '—'}`}</div>
                  </div>
                </div>

                {canvas.aiEvaluation && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5, textTransform: 'uppercase', marginBottom: 4 }}>5. AI Evaluation & Pitch</div>
                    <div style={{ paddingLeft: 8, whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.5, background: 'var(--bg-card)', padding: 12, borderRadius: 8 }}>
                      {canvas.aiEvaluation}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Tool (Product) Fields
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                <div><strong>Category: </strong>{item.category}</div>
                <div><strong>Status/Maturity: </strong>{item.status}</div>
                <div><strong>Implementation: </strong>{item.implementation_status}</div>
                <div><strong>Deployed Client: </strong>{item.account || '—'}</div>
                <div><strong>ROI ($/yr): </strong>{item.roi ? `$${item.roi.toLocaleString()}` : '—'}</div>
                <div><strong>Impact Tagline: </strong>{item.impact || '—'}</div>
                {item.achieved_through && <div style={{ gridColumn: '1 / -1' }}><strong>Achieved Through: </strong>{item.achieved_through}</div>}
                <div style={{ gridColumn: '1 / -1' }}><strong>Capabilities: </strong>{item.capabilities?.join(', ') || '—'}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>What it delivers: </strong>{item.delivers || '—'}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Benefits: </strong>{item.benefits || '—'}</div>
              </div>
            )}
          </div>
        )}
        
        {item.demo_type === 'container' && (
          <div style={{ marginTop: 14, padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
              <Layers size={14} color="var(--primary)" />
              AI Code Audit & Container Build Status
            </h4>
            
            {item.demo_security_report && (() => {
              try {
                const audit = JSON.parse(item.demo_security_report);
                return (
                  <div style={{ 
                    marginBottom: 12, 
                    padding: 12, 
                    background: audit.decision === 'flag' ? '#fef2f2' : 'rgba(34,197,94,0.05)', 
                    border: audit.decision === 'flag' ? '1px solid #fee2e2' : '1px solid rgba(34,197,94,0.15)',
                    borderRadius: 8,
                    fontSize: 12.5
                  }}>
                    <div style={{ fontWeight: 700, color: audit.decision === 'flag' ? '#b91c1c' : '#15803d', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span>AI Audit Security Decision: {audit.decision?.toUpperCase()}</span>
                    </div>
                    <div style={{ color: audit.decision === 'flag' ? '#991b1b' : 'var(--text-secondary)' }}>
                      <b>AI Analysis:</b> {audit.reason}
                    </div>
                    {audit.tech_stack && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)' }}><b>Detected Tech:</b> {audit.tech_stack}</div>}
                  </div>
                );
              } catch(e) {
                return <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Audit: {item.demo_security_report}</div>;
              }
            })()}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Container Status: <span style={{ fontWeight: 700, color: item.demo_container_status === 'running' ? '#22c55e' : item.demo_container_status === 'building' ? '#3b82f6' : '#ef4444' }}>{item.demo_container_status?.toUpperCase()}</span>
                {item.demo_container_port ? ` (Port: ${item.demo_container_port})` : ''}
              </div>
              
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Trigger AI security scan and start container rebuild?")) return;
                  try {
                    await api(`/tools/${item.id}/demo/build`, { method: 'POST' });
                    alert("Build triggered successfully!");
                    onDone();
                  } catch(e2) {
                    alert("Build failed: " + e2.message);
                  }
                }}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
              >
                Run AI Audit & Rebuild Demo
              </button>
            </div>

            {item.demo_container_build_logs && (
              <div style={{ marginTop: 12 }}>
                <details style={{ fontSize: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>Show Container Build Logs</summary>
                  <pre style={{ 
                    marginTop: 8, 
                    background: '#090d16', 
                    color: '#e2e8f0', 
                    padding: 12, 
                    borderRadius: 6, 
                    maxHeight: 250, 
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {item.demo_container_build_logs}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {archived ? (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Archived: {item.review_status === 'declined' || item.status === 'declined' ? 'Declined' : 'Sent Back'}</span>
          {item.review_note && <span style={{ fontStyle: 'italic' }}>Note: "{item.review_note}"</span>}
        </div>
      ) : (
        <>
          <textarea 
            value={note} 
            onChange={(e) => setNote(e.target.value)} 
            placeholder="Decision note (sent to the submitter)…" 
            style={{ marginTop: 12, minHeight: 56, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }} 
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {me.role === 'committee' ? (
              <>
                <button onClick={() => act('approve')} disabled={busy} style={btn('var(--success)')}><Check size={15} /> Recommend Approval</button>
                <button onClick={() => act('changes')} disabled={busy} style={btn('var(--warning)')}><RotateCcw size={15} /> Recommend Changes</button>
                <button onClick={() => act('decline')} disabled={busy} style={btn('var(--danger)')}><Ban size={15} /> Recommend Decline</button>
              </>
            ) : (
              <>
                <button onClick={() => act('approve')} disabled={busy} style={btn('var(--success)')}><Check size={15} /> Approve</button>
                <button onClick={() => act('changes')} disabled={busy} style={btn('var(--warning)')}><RotateCcw size={15} /> Send back</button>
                <button onClick={() => act('decline')} disabled={busy} style={btn('var(--danger)')}><Ban size={15} /> Decline</button>
              </>
            )}
            {type === 'tools' && (
              <Link 
                to={`/tools/${item.id}`} 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', 
                  borderRadius: 9, textDecoration: 'none', fontWeight: 600, fontSize: 13, 
                  color: 'var(--primary-text)', border: '1px solid var(--border-color)', background: 'var(--bg-card)' 
                }}
              >
                Test &amp; Review Demo
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReviewCenter() {
  const me = useAuthStore((s) => s.user);
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [archivedTools, setArchivedTools] = useState([]);
  const [archivedIdeas, setArchivedIdeas] = useState([]);
  const [allIdeas, setAllIdeas] = useState([]);
  
  // Tabs: 'ideas' | 'products' | 'archive'
  const [tab, setTab] = useState('ideas');
  const [search, setSearch] = useState('');

  const load = () => {
    api('/review/tools').then(setTools).catch(() => {});
    api('/review/ideas').then(setIdeas).catch(() => {});
    api('/archive/tools').then(setArchivedTools).catch(() => {});
    api('/archive/ideas').then(setArchivedIdeas).catch(() => {});
    api('/ideas').then(setAllIdeas).catch(() => {});
  };
  
  useEffect(() => { load(); }, []);

  const handleDeleteArchive = async (id, type) => {
    if (window.confirm(`Are you sure you want to permanently delete this archived ${type === 'ideas' ? 'idea' : 'tool'}?`)) {
      try {
        await api(`/${type}/${id}`, { method: 'DELETE' });
        load();
      } catch (e) {
        alert("Failed to delete archived item: " + e.message);
      }
    }
  };

  if (!['committee', 'approver', 'admin'].includes(me?.role)) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Reviewers only.</div>;
  }

  // Filter lists by search query matching the title
  const filterBySearch = (list) => {
    if (!search.trim()) return list;
    const query = search.toLowerCase();
    return list.filter(item => (item.name || '').toLowerCase().includes(query));
  };

  const activeIdeas = filterBySearch(ideas);
  const activeTools = filterBySearch(tools);
  
  const archivedItems = [
    ...archivedIdeas.map(i => ({ ...i, type: 'ideas' })),
    ...archivedTools.map(t => ({ ...t, type: 'tools' }))
  ].sort((a, b) => (b.created_at || b.updated_at) - (a.created_at || a.updated_at));

  const activeArchived = filterBySearch(archivedItems);

  const tabBtn = (id, label, Icon) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 0',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
    color: tab === id ? 'var(--primary)' : 'var(--text-secondary)',
    borderBottom: tab === id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
    transition: 'all 0.15s ease'
  });

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><ClipboardCheck /> Review Center</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Approve to publish (and make the submitter a Product Owner), send back with notes, or decline.</p>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('ideas')} style={tabBtn('ideas', 'Ideas', Layers)}>
          <Layers size={16} /> Ideas awaiting review ({ideas.length})
        </button>
        <button onClick={() => setTab('products')} style={tabBtn('products', 'Products / Tools', Wrench)}>
          <Wrench size={16} /> Products awaiting review ({tools.length})
        </button>
        <button onClick={() => setTab('archive')} style={tabBtn('archive', 'Archive', FolderArchive)}>
          <FolderArchive size={16} /> Archive ({archivedItems.length})
        </button>
      </div>

      {/* Search Row */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, marginBottom: 24 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
        <input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tab} by title...`}
          style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
        />
      </div>

      {/* List Area */}
      <div>
        {tab === 'ideas' && (
          <>
            {activeIdeas.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No ideas matching criteria.</div>}
            {activeIdeas.map((i) => (
              <ReviewCard key={i.id} item={i} type="ideas" onDone={load} me={me} />
            ))}
          </>
        )}

        {tab === 'products' && (
          <>
            {activeTools.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No products matching criteria.</div>}
            {activeTools.map((t) => (
              <ReviewCard key={t.id} item={t} type="tools" onDone={load} me={me} allIdeas={allIdeas} />
            ))}
          </>
        )}

        {tab === 'archive' && (
          <>
            {activeArchived.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No archived items.</div>}
            {activeArchived.map((item) => (
              <ReviewCard 
                key={`${item.type}-${item.id}`} 
                item={item} 
                type={item.type} 
                onDone={load} 
                me={me} 
                archived={true} 
                allIdeas={allIdeas} 
                onDeleteArchive={handleDeleteArchive} 
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
