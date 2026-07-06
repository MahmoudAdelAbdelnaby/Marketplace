import React, { useEffect, useState } from 'react';
import { LayoutGrid, PenLine, ChevronUp, Lightbulb, Wrench, Megaphone, ThumbsUp } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function ManageView() {
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);
  
  // Hover states for buttons
  const [hoveredBtnId, setHoveredBtnId] = useState(null);

  useEffect(() => { 
    api('/tools').then(setTools).catch(() => {});
    api('/ideas').then(setIdeas).catch(() => {});
  }, [me]);

  const myTools = tools.filter(t => t.owner_id === me.id);
  const myIdeas = ideas.filter(i => i.owner_id === me.id);
  const myVocIdeas = myIdeas.filter(i => i.voc_id !== null && i.voc_id !== undefined);
  
  const totalVotes = myTools.reduce((sum, t) => sum + (t.votes || 0), 0) + 
                     myIdeas.reduce((sum, i) => sum + (i.votes || 0), 0);

  // Button styles helper
  const getBtnStyle = (id, isPrimary = false) => {
    const isHovered = hoveredBtnId === id;
    
    // Light-mode/dark-mode responsive styling
    // Lighter color for darkmode button
    const darkmodeActive = document.body.classList.contains('dark') || 
                           window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const baseBg = isPrimary 
      ? 'var(--primary)' 
      : (darkmodeActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 115, 127, 0.06)');
      
    const hoverBg = isPrimary 
      ? 'var(--primary-dark, #005a63)' 
      : (darkmodeActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 115, 127, 0.12)');

    const color = isPrimary 
      ? '#fff' 
      : 'var(--primary-text)';

    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      borderRadius: 8,
      border: isPrimary ? 'none' : '1px solid var(--border-color)',
      background: isHovered ? hoverBg : baseBg,
      color: color,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: isHovered ? 'scale(1.02)' : 'none',
      boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
    };
  };

  const cardStyle = {
    padding: 24,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 0.2s',
  };

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><LayoutGrid /> My Workspace</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Manage your submitted ideas and tools.</p>

      {/* 4 Stats Cards at the Top */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 28 }}>
        <div style={cardStyle} className="card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)', marginBottom: 8 }}>
            <Wrench size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)' }}>My Products</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>{myTools.length}</span>
        </div>

        <div style={cardStyle} className="card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b', marginBottom: 8 }}>
            <Lightbulb size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)' }}>Ideas Submitted</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>{myIdeas.length}</span>
        </div>

        <div style={cardStyle} className="card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', marginBottom: 8 }}>
            <Megaphone size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)' }}>VOC Idea Submissions</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>{myVocIdeas.length}</span>
        </div>

        <div style={cardStyle} className="card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 8 }}>
            <ThumbsUp size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)' }}>Total Upvotes</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>{totalVotes}</span>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
        
        {/* My Tools Section */}
        <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>My Tools / Products</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Tools where you are the owner.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto', paddingRight: 6 }}>
            {myTools.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(0,115,127,0.08)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      <ChevronUp size={12} /> {t.votes || 0}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Status: {t.status} | Review: {t.review_status}</div>
                </div>
                <button 
                  onClick={() => nav(`/tools/${t.id}`)}
                  style={getBtnStyle(`tool-${t.id}`)}
                  onMouseEnter={() => setHoveredBtnId(`tool-${t.id}`)}
                  onMouseLeave={() => setHoveredBtnId(null)}
                >
                  <PenLine size={14} /> View
                </button>
              </div>
            ))}
            {myTools.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No tools owned.</div>}
          </div>
        </div>
        
        {/* My Ideas Section */}
        <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>My Canvas Storyboards</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Ideas submitted or drafted by you.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto', paddingRight: 6 }}>
            {myIdeas.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{i.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      <ChevronUp size={12} /> {i.votes || 0}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Status: {i.status} {i.voc_id ? `| Linked to VOC #${i.voc_id}` : ''}
                  </div>
                </div>
                <button 
                  onClick={() => nav(`/canvas`)}
                  style={getBtnStyle(`idea-${i.id}`, true)}
                  onMouseEnter={() => setHoveredBtnId(`idea-${i.id}`)}
                  onMouseLeave={() => setHoveredBtnId(null)}
                >
                  <PenLine size={14} /> Go to Canvas
                </button>
              </div>
            ))}
            {myIdeas.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No ideas submitted.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
