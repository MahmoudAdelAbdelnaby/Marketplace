import React from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import CanvasContent from './CanvasContent';
import BusinessModelCanvas from './BusinessModelCanvas';
import SectionDrawer from './SectionDrawer';

const CanvasPage = () => {
  const viewMode = useCanvasStore((s) => s.viewMode);
  const setViewMode = useCanvasStore((s) => s.setViewMode);

  const isAdvancedMode = useCanvasStore((s) => s.isAdvancedMode);
  const toggleAdvancedMode = useCanvasStore((s) => s.toggleAdvancedMode);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        {/* Left spacer to help center the view selectors */}
        <div style={{ width: '180px' }}></div>

        {/* View Selectors */}
        <div style={{ display: 'inline-flex', background: 'var(--secondary)', borderRadius: 999, padding: 4, gap: 4 }}>
          {[{ id: 'map', label: 'Storyboard Board' }, { id: 'form', label: 'Section Focus' }].map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              style={{
                padding: '6px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                background: viewMode === m.id ? 'var(--primary)' : 'transparent',
                color: viewMode === m.id ? '#fff' : 'var(--text-secondary)',
                transition: 'all .15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Toggle Switch for Simple/Advanced Scoping */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: '180px', justifyContent: 'flex-end' }}>
          <span style={{ opacity: isAdvancedMode ? 0.6 : 1 }}>Simple</span>
          <div 
            onClick={toggleAdvancedMode}
            style={{
              width: 38, height: 22, borderRadius: 12, background: isAdvancedMode ? 'var(--primary)' : 'var(--border-color)',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3, left: isAdvancedMode ? 19 : 3,
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </div>
          <span style={{ opacity: isAdvancedMode ? 1 : 0.6 }}>Advanced</span>
        </div>
      </div>
      {viewMode === 'map' ? <BusinessModelCanvas /> : <CanvasContent />}
      <SectionDrawer />
    </div>
  );
};

export default CanvasPage;
