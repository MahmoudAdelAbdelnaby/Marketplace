import React from 'react';
import { 
  Users, CheckSquare, Database, Lightbulb, Heart, Send, 
  UserCheck, DollarSign, TrendingUp, HelpCircle, CheckCircle2,
  Ban, ClipboardCheck, AlertTriangle
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { SECTIONS } from '../../canvas/sections';
import { api } from '../../api';

export default function BusinessModelCanvas() {
  const canvas = useCanvasStore((s) => s.canvas);
  const openEditor = useCanvasStore((s) => s.openEditor);
  const activePhase = useCanvasStore((s) => s.activePhase);
  const getScores = useCanvasStore((s) => s.getScores);
  const scores = getScores();

  // Helper to check if a section is filled
  const isFilled = (id) => {
    const sec = SECTIONS.find(s => s.id === id);
    return sec ? sec.isFilled(canvas) : false;
  };

  // Define phases and their sections
  const phases = [
    {
      id: 'concept',
      title: '1. Concept & Problem',
      color: 'rgba(0, 115, 127, 0.05)',
      blocks: [
        {
          id: 'problem_solving',
          title: 'Problem We Are Solving',
          icon: HelpCircle,
          desc: 'What core problem does this solve and what are the pain points?',
          text: canvas.problemStatement,
          badges: canvas.painPoints ? ['Has pain points'] : []
        },
        {
          id: 'target_users',
          title: 'Target Users',
          icon: Users,
          desc: 'Who are the primary users and decision makers?',
          text: canvas.primaryUsers?.length > 0 ? `Primary: ${canvas.primaryUsers.join(', ')}` : '',
          badges: canvas.decisionMakers?.length > 0 ? [`${canvas.decisionMakers.length} decision makers`] : []
        },
        {
          id: 'value_proposition',
          title: 'Value Proposition',
          icon: Lightbulb,
          desc: 'How does it help users, what outcome is achieved, and by what method?',
          text: canvas.vpOutcome || canvas.vpAudience || canvas.vpMethod 
            ? `Outcome: ${canvas.vpOutcome || '—'}\nAudience: ${canvas.vpAudience || '—'}` 
            : '',
          badges: canvas.vpMethod ? ['Method defined'] : []
        },
        {
          id: 'solution_type',
          title: 'Solution Type',
          icon: CheckSquare,
          desc: 'What is the product type or format (SaaS, internal tool, etc.)?',
          text: canvas.solutionTypes?.join(', '),
          badges: []
        }
      ]
    },
    {
      id: 'strategy',
      title: '2. Solution Strategy',
      color: 'rgba(245, 158, 11, 0.05)',
      blocks: [
        {
          id: 'strategic_alignment',
          title: 'Strategic Alignment',
          icon: TrendingUp,
          desc: 'How does it align to cost reduction, productivity, CSAT, etc.?',
          text: Object.entries(canvas.strategicAlignment || {})
            .filter(([_, v]) => v === 2)
            .map(([k]) => k.replace(/([A-Z])/g, ' $1'))
            .join(', '),
          badges: scores.assessed.strategic ? ['Strategic'] : []
        },
        {
          id: 'scalability',
          title: 'Scalability Assessment',
          icon: Database,
          desc: 'What industries, business functions, and regions can adopt this?',
          text: canvas.industries?.length > 0 ? `Industries: ${canvas.industries.slice(0, 3).join(', ')}` : '',
          badges: [...(canvas.regions || []), ...(canvas.functions || []).slice(0, 1)]
        },
        {
          id: 'differentiation',
          title: 'Differentiation',
          icon: UserCheck,
          desc: 'What are the current alternatives, competitors, and our unique edge?',
          text: canvas.whatMakesUnique || canvas.currentAlternatives,
          badges: canvas.existingCompetitors ? ['Has competitors'] : []
        }
      ]
    },
    {
      id: 'execution',
      title: '3. Execution & Impact',
      color: 'rgba(16, 185, 129, 0.05)',
      blocks: [
        {
          id: 'business_impact',
          title: 'Business Impact',
          icon: DollarSign,
          desc: 'What are the estimated users, hours saved, cost savings, and pricing details?',
          text: canvas.businessImpact?.costSavings || canvas.businessImpact?.revenuePotential
            ? `Savings: ${canvas.businessImpact.costSavings || '—'}\nRevenue: ${canvas.businessImpact.revenuePotential || '—'}`
            : '',
          badges: canvas.projectedROI ? [`ROI: ${canvas.projectedROI}`] : []
        },
        {
          id: 'feasibility',
          title: 'Feasibility Assessment',
          icon: Heart,
          desc: 'Technical/data/resource feasibility and roadblockers.',
          text: canvas.anticipatedRoadblockers,
          badges: scores.assessed.feasibility ? ['Feasibility'] : []
        },
        {
          id: 'adoption',
          title: 'Adoption Potential',
          icon: Send,
          desc: 'Ease of use, training requirements, and user demand.',
          text: Object.entries(canvas.adoption || {})
            .filter(([_, v]) => v >= 4)
            .map(([k]) => k.replace(/([A-Z])/g, ' $1'))
            .join(', '),
          badges: scores.assessed.adoption ? ['Adoption'] : []
        },
        {
          id: 'build_partner',
          title: 'Build vs Partner',
          icon: Users,
          desc: 'Build from scratch, buy off-the-shelf, or extend existing?',
          text: canvas.decision ? `Decision: ${canvas.decision}\nJustification: ${canvas.decisionJustification}` : '',
          badges: []
        }
      ]
    },
    {
      id: 'outcomes',
      title: '4. Risks & Success',
      color: 'rgba(239, 68, 68, 0.05)',
      blocks: [
        {
          id: 'risks',
          title: 'Risks & Dependencies',
          icon: Ban,
          desc: 'What technical and operational risks or dependencies exist?',
          text: canvas.risks?.technical?.length > 0 ? `Tech Risks: ${canvas.risks.technical.join(', ')}` : '',
          badges: canvas.risks?.operational?.length > 0 ? [`${canvas.risks.operational.length} op risks`] : []
        },
        {
          id: 'success_metrics',
          title: 'Success Metrics',
          icon: ClipboardCheck,
          desc: 'What KPIs and target success criteria determine project success?',
          text: canvas.successMetrics?.kpis,
          badges: canvas.successMetrics?.revenueTargets ? ['Targets defined'] : []
        }
      ]
    }
  ];

  const [evalExpanded, setEvalExpanded] = React.useState(false);
  const [evalLoading, setEvalLoading] = React.useState(false);
  const updateField = useCanvasStore((s) => s.updateField);

  const generateEvaluation = async () => {
    setEvalLoading(true);
    try {
      let sysInstruction = "";
      try {
        const sysRes = await api('/ai/system-prompt/prompt_scoping_evaluator');
        sysInstruction = sysRes?.prompt || "";
      } catch (e) {}

      const prompt = `${sysInstruction || "You are a senior strategy consultant evaluating a new AI product proposal."}
Here is the current scoping canvas:
- Name: ${canvas.name || 'Untitled'}
- Problem Statement: ${canvas.problemStatement || 'Not defined'}
- Value Proposition Outcome: ${canvas.vpOutcome || 'Not defined'}
- Differentiation: ${canvas.whatMakesUnique || 'Not defined'}
- Cost Structure / Savings: ${canvas.businessImpact?.costSavings || 'Not defined'}

Please write a structured evaluation (3-4 paragraphs) covering:
1. Strategic Potential
2. Key Risks & Implementation Roadblocks
3. Recommendations for improvement.`;

      const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
      updateField(null, 'aiEvaluation', res.text);
      setEvalExpanded(true);
    } catch (e) {
      alert("Failed to generate evaluation: " + e.message);
    } finally {
      setEvalLoading(false);
      try {
        const { useAuthStore } = await import('../../store/useAuthStore');
        useAuthStore.getState().reloadUser();
      } catch (reloadErr) {}
    }
  };

  return (
    <div style={{ padding: '0 8px', width: '100%' }}>
      {/* Collapsible AI Evaluation Accordion */}
      <div style={{ 
        marginBottom: 20, 
        border: '1px solid var(--border-color)', 
        borderRadius: 16, 
        overflow: 'hidden',
        background: 'var(--bg-card)'
      }}>
        <div 
          onClick={() => setEvalExpanded(!evalExpanded)} 
          style={{ 
            padding: '12px 18px', 
            background: 'linear-gradient(135deg, rgba(0,115,127,0.06), rgba(37,226,204,0.03))', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <strong style={{ fontSize: 14.5, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>AI Storyboard Evaluation</strong>
            {canvas.aiEvaluation && (
              <span style={{ fontSize: 11.5, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                Analysis Ready
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              type="button"
              disabled={evalLoading}
              onClick={(e) => { e.stopPropagation(); generateEvaluation(); }}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: evalLoading ? 0.6 : 1
              }}
            >
              {evalLoading ? 'Evaluating…' : canvas.aiEvaluation ? 'Regenerate Analysis' : 'Run strategic evaluation'}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', transform: evalExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              ▼
            </span>
          </div>
        </div>

        {(evalExpanded || evalLoading) && (
          <div style={{ padding: '18px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
            {evalLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both' }}>●</span>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }}>●</span>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }}>●</span>
                Scoping canvas analysis in progress...
              </div>
            ) : canvas.aiEvaluation ? (
              <div style={{ 
                fontSize: 13.5, 
                lineHeight: 1.6, 
                color: 'var(--text-primary)', 
                whiteSpace: 'pre-wrap'
              }}>
                {canvas.aiEvaluation}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No evaluation run yet. Fill out the scoping canvas fields and click "Run strategic evaluation" to analyze your pitch.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.05em', margin: 0 }}>
          Interactive Scoping Storyboard
        </h3>
      </div>

      {/* 4-column phase layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        width: '100%',
        alignItems: 'stretch'
      }}>
        {phases.map((phase) => (
          <div 
            key={phase.id} 
            style={{ 
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ 
              fontSize: 14.5, 
              fontWeight: 700, 
              color: 'var(--primary-text)', 
              borderBottom: '1px solid var(--border-color)', 
              paddingBottom: 8, 
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{phase.title}</span>
            </div>

            {phase.blocks.map((b) => {
              const Icon = b.icon;
              const filled = isFilled(b.id);
              const required = SECTIONS.find(s => s.id === b.id)?.required;
              
              // Dark mode glassmorphic styling
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    useCanvasStore.getState().setActivePhase(phase.id);
                    openEditor(b.id);
                  }}
                  className="glass card-hover"
                  style={{
                    background: filled ? 'rgba(0, 115, 127, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1.5px ${filled ? 'solid' : 'dashed'} ${filled ? 'var(--primary)' : required ? 'var(--warning)' : 'var(--border-color)'}`,
                    borderRadius: '20px 4px 20px 4px', // CNX asymmetric shape
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minHeight: 120
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,115,127,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = filled ? 'var(--primary)' : required ? 'var(--warning)' : 'var(--border-color)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} style={{ color: filled ? 'var(--primary)' : 'var(--text-muted)' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{b.title}</span>
                    {required && !filled && (
                      <span style={{ fontSize: 9, background: 'rgba(255,132,0,0.1)', color: 'var(--warning)', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 'auto' }}>
                        REQUIRED
                      </span>
                    )}
                    {filled && (
                      <CheckCircle2 size={14} style={{ color: 'var(--success)', marginLeft: 'auto' }} />
                    )}
                  </div>

                  {/* Description or Text snippet */}
                  {filled && b.text ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                      {b.text}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {b.desc}
                    </div>
                  )}

                  {b.badges?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto', paddingTop: 4 }}>
                      {b.badges.map((badge, idx) => (
                        <span key={idx} style={{ fontSize: 9, fontWeight: 700, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 6px', borderRadius: 4 }}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
