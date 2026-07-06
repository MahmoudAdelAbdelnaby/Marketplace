import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '../../store/useCanvasStore';
import { SECTIONS } from '../../canvas/sections';

const PHASE_COLOR = {
  concept: '#2563EB',
  strategy: '#7C3AED',
  execution: '#0891B2',
  outcomes: '#DB2777',
  evaluation: '#D97706',
};

const hiddenHandle = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 'none', pointerEvents: 'none' };

function SectionNode({ data }) {
  const { label, required, filled, color, onOpen } = data;
  const border = filled ? color : (required ? '#F59E0B' : '#CBD5E1');
  return (
    <div
      onClick={onOpen}
      title={filled ? `${label} — defined (click to edit)` : (required ? `${label} — required (click to fill)` : `${label} — optional, add later`)}
      style={{
        width: 150, padding: '10px 12px', cursor: 'pointer', boxSizing: 'border-box',
        borderRadius: 12,
        border: `2px ${filled ? 'solid' : 'dashed'} ${border}`,
        background: filled ? color + '14' : 'var(--bg-card)',
        boxShadow: filled ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
        opacity: !filled && !required ? 0.72 : 1,
        transition: 'transform .12s, box-shadow .12s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.12)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = filled ? '0 1px 3px rgba(15,23,42,0.08)' : 'none'; }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <div style={{ fontSize: 13, fontWeight: 600, color: filled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2, color: filled ? color : (required ? '#B45309' : 'var(--text-muted)') }}>
        {filled ? '✓ defined' : (required ? 'required' : 'optional')}
      </div>
    </div>
  );
}

function HubNode({ data }) {
  const { name, score, scored, completenessPct, requiredComplete, requiredRemaining, provisional } = data;
  const ring = !scored ? '#94A3B8' : score < 31 ? '#DC2626' : score < 61 ? '#D97706' : '#16A34A';
  return (
    <div style={{
      width: 200, padding: '16px', textAlign: 'center', boxSizing: 'border-box',
      borderRadius: 16, background: 'var(--bg-card)', border: `2px solid ${ring}`,
      boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
    }}>
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
        Opportunity Score
      </div>
      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15, color: ring }}>
        {scored ? score : '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{name || 'New idea'}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
        {completenessPct}% complete{provisional && scored ? ' · provisional' : ''}
      </div>
      <div style={{
        marginTop: 8, fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, display: 'inline-block',
        background: requiredComplete ? 'rgba(22,163,74,0.10)' : 'rgba(245,158,11,0.12)',
        color: requiredComplete ? '#15803D' : '#B45309',
      }}>
        {requiredComplete ? 'Ready to submit ✓' : `${requiredRemaining} core section${requiredRemaining === 1 ? '' : 's'} left`}
      </div>
    </div>
  );
}

const nodeTypes = { section: SectionNode, hub: HubNode };

export default function CanvasMap() {
  const getScores = useCanvasStore((s) => s.getScores);
  const openEditor = useCanvasStore((s) => s.openEditor);
  const scores = getScores();

  const { nodes, edges } = useMemo(() => {
    const cx = 520, cy = 380, Rx = 440, Ry = 300;
    const n = SECTIONS.length;
    const nodeList = [{
      id: 'hub', type: 'hub', position: { x: cx - 100, y: cy - 78 }, draggable: false,
      data: {
        name: '', score: scores.overallScore, scored: scores.scored,
        completenessPct: scores.completenessPct, requiredComplete: scores.requiredComplete,
        requiredRemaining: scores.requiredRemaining, provisional: scores.provisional,
      },
    }];
    const edgeList = [];
    SECTIONS.forEach((s, i) => {
      const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = cx + Rx * Math.cos(ang) - 75;
      const y = cy + Ry * Math.sin(ang) - 28;
      const filled = scores.filledIds ? scores.filledIds.has(s.id) : false;
      const color = PHASE_COLOR[s.phase] || '#2563EB';
      nodeList.push({
        id: s.id, type: 'section', position: { x, y }, draggable: false,
        data: { label: s.label, phase: s.phase, required: s.required, filled, color, onOpen: () => openEditor(s.id) },
      });
      edgeList.push({
        id: 'e-' + s.id, source: 'hub', target: s.id,
        style: {
          stroke: filled ? color : (s.required ? '#F59E0B' : '#CBD5E1'),
          strokeWidth: filled ? 2 : 1.5,
          strokeDasharray: filled ? '0' : '5 5',
        },
      });
    });
    return { nodes: nodeList, edges: edgeList };
  }, [scores, openEditor]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 170px)', minHeight: 480, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg, 16px)', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} color="#EDF1F7" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
