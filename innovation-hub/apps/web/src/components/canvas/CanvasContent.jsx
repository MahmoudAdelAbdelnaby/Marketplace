import React, { useEffect } from 'react';
import { Card } from '../ui/UI';
import { useCanvasStore } from '../../store/useCanvasStore';
import { SECTIONS } from '../../canvas/sections';
import SectionFields from './SectionFields';

const PHASE_TITLES = {
  key_partners: 'Key Partners',
  key_activities: 'Key Activities',
  key_resources: 'Key Resources',
  value_propositions: 'Value Propositions',
  customer_relationships: 'Customer Relationships',
  channels: 'Channels',
  customer_segments: 'Customer Segments',
  cost_structure: 'Cost Structure',
  revenue_streams: 'Revenue Streams',
  pitch: 'AI Pitch Evaluation',
};

// Full-page form view. Renders the sections of the active phase, each using the
// same SectionFields the inline map editor uses — one source of truth.
export default function CanvasContent() {
  const activePhase = useCanvasStore((s) => s.activePhase);
  const focusSection = useCanvasStore((s) => s.focusSection);
  const setFocusSection = useCanvasStore((s) => s.setFocusSection);

  const sections = SECTIONS.filter((s) => s.phase === activePhase);

  useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(focusSection);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusSection(null);
  }, [focusSection, activePhase, setFocusSection]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }}>{PHASE_TITLES[activePhase]}</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Define, evaluate, and refine your new idea using this structured canvas.</p>
      </div>

      {sections.map((s) => (
        <Card key={s.id} id={s.id} title={s.label}>
          <SectionFields sectionId={s.id} />
        </Card>
      ))}

      <div style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>End of Phase</div>
    </div>
  );
}
