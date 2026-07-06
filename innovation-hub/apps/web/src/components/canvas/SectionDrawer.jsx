import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { SECTIONS } from '../../canvas/sections';
import SectionFields from './SectionFields';

const navBtn = (disabled) => ({
  padding: '0.5rem 0.85rem', borderRadius: 8, border: '1px solid var(--border-color)',
  background: 'var(--bg-card)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
});

// Inline editor for a single section, opened by clicking a node on the map.
// You fill the section's fields right here; the map node updates live behind it.
export default function SectionDrawer() {
  const editingSection = useCanvasStore((s) => s.editingSection);
  const closeEditor = useCanvasStore((s) => s.closeEditor);
  const openEditor = useCanvasStore((s) => s.openEditor);
  const canvas = useCanvasStore((s) => s.canvas);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeEditor(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeEditor]);

  if (!editingSection) return null;
  const idx = SECTIONS.findIndex((s) => s.id === editingSection);
  const section = SECTIONS[idx];
  if (!section) return null;
  const filled = section.isFilled(canvas);
  const prev = SECTIONS[idx - 1];
  const next = SECTIONS[idx + 1];

  return (
    <>
      <div onClick={closeEditor} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 40 }} />
      <aside
        role="dialog"
        aria-label={`Edit ${section.label}`}
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(560px, 94vw)',
          background: 'var(--bg-card-solid, #fff)', boxShadow: '-8px 0 30px rgba(15,23,42,0.18)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: filled ? 'var(--success, #16a34a)' : (section.required ? '#B45309' : 'var(--text-muted)') }}>
              {section.required ? 'Required' : 'Optional'}{filled ? ' · ✓ defined' : ''}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2px 0 0' }}>{section.label}</h2>
          </div>
          <button onClick={closeEditor} title="Close (Esc)" aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </header>

        <div style={{ padding: '1.5rem', overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>
          <SectionFields sectionId={editingSection} />
        </div>

        <footer style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => prev && openEditor(prev.id)} disabled={!prev} style={navBtn(!prev)}>← {prev ? prev.label : ''}</button>
          <div style={{ flex: 1 }} />
          <button onClick={closeEditor} style={{ ...navBtn(false), background: 'var(--primary)', color: '#fff', border: 'none' }}>Done</button>
          <button onClick={() => next && openEditor(next.id)} disabled={!next} style={navBtn(!next)}>{next ? next.label : ''} →</button>
        </footer>
      </aside>
    </>
  );
}
