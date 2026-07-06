import React from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import styles from './Layout.module.css';
import { useCanvasStore } from '../../store/useCanvasStore';

const PHASES = [
  { id: 'concept', label: '1. Concept & Problem' },
  { id: 'strategy', label: '2. Solution Strategy' },
  { id: 'execution', label: '3. Execution & Impact' },
  { id: 'outcomes', label: '4. Risks & Success Metrics' },
  { id: 'evaluation', label: '5. AI Pitch Evaluation' }
];


const Sidebar = () => {
  const getScores = useCanvasStore(state => state.getScores);
  const scores = getScores();
  const activePhase = useCanvasStore(state => state.activePhase);
  const setActivePhase = useCanvasStore(state => state.setActivePhase);
  const isProgressCollapsed = useCanvasStore(state => state.isProgressCollapsed);
  const toggleProgressCollapsed = useCanvasStore(state => state.toggleProgressCollapsed);

  if (isProgressCollapsed) {
    return (
      <div style={{ padding: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={toggleProgressCollapsed} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            padding: '0.5rem', 
            borderRadius: 'var(--radius-md)' 
          }}
          title="Expand Sidebar"
        >
           <ChevronRight size={20} color="var(--text-muted)" />
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 0' }}>
      <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
        <button 
          onClick={toggleProgressCollapsed}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            width: '100%', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            padding: 0,
            marginBottom: isProgressCollapsed ? '0' : '0.5rem'
          }}
        >
          <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: 0 }}>
            Canvas Progress
          </h3>
          {isProgressCollapsed ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronUp size={14} color="var(--text-muted)" />}
        </button>

        {!isProgressCollapsed && (
          <>
            <div style={{ width: '100%', backgroundColor: 'var(--border-color)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${scores.completenessPct}%`, backgroundColor: 'var(--primary)', height: '100%', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span>Completion</span>
              <span>{scores.completenessPct}%</span>
            </div>
          </>
        )}
      </div>

      <nav>
        <ul style={{ listStyle: 'none' }}>
          {PHASES.map(phase => {
            const isActive = activePhase === phase.id;
            return (
              <li key={phase.id}>
                <button 
                  onClick={() => setActivePhase(phase.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1.5rem',
                    background: isActive ? 'var(--secondary)' : 'none',
                    border: 'none',
                    borderRight: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                      e.currentTarget.style.color = 'var(--primary)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {phase.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
