import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, TrendingUp } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCatalogStore } from '../../store/useCatalogStore';
import { api } from '../../api';
import { Link } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const ScoreGauge = ({ label, score, color }) => (
  <div style={{ marginBottom: '0.45rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem', fontSize: '11.5px', fontWeight: 500 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: color, fontWeight: 700 }}>{score}/100</span>
    </div>
    <div style={{ width: '100%', backgroundColor: 'var(--border-color)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, backgroundColor: color, height: '100%', transition: 'width 0.3s' }} />
    </div>
  </div>
);

const RightPanel = () => {
  const getScores = useCanvasStore(state => state.getScores);
  const scores = getScores();
  const canvas = useCanvasStore(state => state.canvas);
  const isScorecardCollapsed = useCanvasStore(state => state.isScorecardCollapsed);
  const toggleScorecardCollapsed = useCanvasStore(state => state.toggleScorecardCollapsed);

  const { tools, load: loadCatalog } = useCatalogStore();
  const [backendIdeas, setBackendIdeas] = useState([]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    api('/ideas').then(setBackendIdeas).catch(() => {});
  }, [canvas]);

  const calculateSimilarity = (item, isTool = true) => {
    const extractWords = (str) => {
      if (!str) return [];
      return str.toLowerCase().match(/[a-z]{3,}/g) || [];
    };

    const canvasText = [
      canvas.name || '',
      canvas.problemStatement || '',
      canvas.keyActivities || '',
      canvas.vpOutcome || '',
      canvas.vpMethod || '',
      (canvas.solutionTypes || []).join(' '),
      (canvas.industries || []).join(' '),
      (canvas.functions || []).join(' ')
    ].join(' ');

    const itemText = isTool ? [
      item.name || '',
      item.problem || '',
      item.category || '',
      item.delivers || '',
      item.benefits || '',
      (item.tags || []).join(' ')
    ].join(' ') : [
      item.name || '',
      item.canvas?.problemStatement || '',
      item.canvas?.keyActivities || '',
      item.canvas?.vpOutcome || '',
      item.canvas?.vpMethod || '',
      (item.canvas?.solutionTypes || []).join(' '),
      (item.canvas?.industries || []).join(' '),
      (item.canvas?.functions || []).join(' ')
    ].join(' ');

    const wordsCanvas = new Set(extractWords(canvasText));
    const wordsItem = new Set(extractWords(itemText));

    if (wordsCanvas.size === 0 || wordsItem.size === 0) return 0;

    let intersection = 0;
    wordsCanvas.forEach((w) => {
      if (wordsItem.has(w)) intersection++;
    });

    const union = new Set([...wordsCanvas, ...wordsItem]).size;
    if (union === 0) return 0;

    const jaccard = intersection / union;

    if (canvas.name && item.name && canvas.name.toLowerCase().trim() === item.name.toLowerCase().trim()) {
      if (isTool || item.id !== canvas.id) {
        return 100;
      }
    }

    const pct = Math.round(jaccard * 100);
    return Math.min(100, pct * 3.5);
  };

  const matches = useMemo(() => {
    const list = [];
    tools.filter(t => t.review_status === 'approved').forEach(t => {
      const score = calculateSimilarity(t, true);
      if (score > 10) {
        list.push({ item: t, isTool: true, score });
      }
    });
    backendIdeas.forEach(i => {
      if (i.id === canvas.id) return;
      const score = calculateSimilarity(i, false);
      if (score > 10) {
        list.push({ item: i, isTool: false, score });
      }
    });
    return list.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [tools, backendIdeas, canvas]);

  const highestMatch = useMemo(() => {
    if (matches.length === 0) return null;
    return matches[0];
  }, [matches]);

  if (isScorecardCollapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 16 }}>
        <button 
          onClick={toggleScorecardCollapsed} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            padding: '0.5rem', 
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
          }}
          title="Expand Scorecard"
        >
          <ChevronLeft size={20} color="var(--text-muted)" />
          <TrendingUp size={20} color="var(--primary)" />
          <div style={{
            writingMode: 'vertical-rl',
            textTransform: 'uppercase',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
            marginTop: 8
          }}>
            Scorecard
          </div>
        </button>
      </div>
    );
  }

  const getOverallColor = (score) => {
    if (!scores.scored) return 'var(--text-muted)';
    if (score < 31) return 'var(--danger)';
    if (score < 61) return 'var(--warning)';
    return 'var(--success)';
  };

  const getOverallLabel = (score) => {
    if (!scores.scored) return 'Not yet scored';
    if (score < 31) return 'Low Potential';
    if (score < 61) return 'Moderate Potential';
    if (score < 81) return 'Strong Potential';
    return 'High Strategic Opportunity';
  };

  const radarData = [
    { subject: 'Rev.', A: canvas.strategicAlignment.revenueGrowth },
    { subject: 'Cost', A: canvas.strategicAlignment.costReduction },
    { subject: 'Prod.', A: canvas.strategicAlignment.productivity },
    { subject: 'Client', A: canvas.strategicAlignment.clientExperience },
    { subject: 'Emp.', A: canvas.strategicAlignment.employeeExperience },
    { subject: 'Mkt.', A: canvas.strategicAlignment.marketExpansion },
    { subject: 'Comp.', A: canvas.strategicAlignment.competitiveAdvantage },
    { subject: 'Inn.', A: canvas.strategicAlignment.innovationLeadership },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>
          Opportunity Scorecard
        </h3>
        <button onClick={toggleScorecardCollapsed} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* Compact Overall Score Card */}
      <div style={{ 
        backgroundColor: getOverallColor(scores.overallScore) + '12', 
        border: `1px solid ${getOverallColor(scores.overallScore)}`,
        borderRadius: '10px', 
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: getOverallColor(scores.overallScore), lineHeight: 1, minWidth: 44, textAlign: 'center' }}>
          {scores.scored ? scores.overallScore : '—'}
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>
            Opportunity Score
          </div>
          <div style={{ fontWeight: 600, color: getOverallColor(scores.overallScore), fontSize: '11px', marginTop: 1 }}>
            {getOverallLabel(scores.overallScore)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>
            {scores.completenessPct}% complete{scores.provisional && scores.scored ? ' · provisional' : ''}
          </div>
        </div>
      </div>

      {/* Similarity Score Card */}
      <div style={{ 
        backgroundColor: highestMatch ? 'var(--secondary)' : 'var(--bg-main)', 
        border: `1px solid ${highestMatch ? 'rgba(0,115,127,0.3)' : 'var(--border-color)'}`,
        borderRadius: '10px', 
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: highestMatch ? 'var(--primary)' : 'var(--text-muted)', lineHeight: 1, minWidth: 44, textAlign: 'center' }}>
          {highestMatch ? `${highestMatch.score}%` : '—%'}
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.2, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>
            Similarity Score
          </div>
          <div style={{ fontWeight: 600, color: highestMatch ? 'var(--primary-text)' : 'var(--text-muted)', fontSize: '11px', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
            {highestMatch ? `Matches "${highestMatch.item.name}"` : 'No duplicate ideas found'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>
            {highestMatch ? 'Link to duplicate details below' : 'Scanned across catalog & drafts'}
          </div>
        </div>
      </div>

      {/* Compact Sub Scores */}
      <div style={{ flexShrink: 0 }}>
        <ScoreGauge label="Strategic Alignment" score={scores.strategicScore} color="var(--primary)" />
        <ScoreGauge label="Scalability" score={scores.scalScore} color="var(--primary)" />
        <ScoreGauge label="Feasibility" score={scores.feasibilityScore} color="var(--primary)" />
        <ScoreGauge label="Adoption Potential" score={scores.adoptionScore} color="var(--primary)" />
      </div>

      {/* Compact Radar Chart */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', flexShrink: 0 }}>
        <div style={{ height: '140px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: 'var(--text-secondary)' }} />
              <PolarRadiusAxis angle={30} domain={[0, 2]} tick={false} axisLine={false} />
              <Radar name="Strategy" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Similarity Matches */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', flexShrink: 0 }}>
        <h4 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <Lightbulb size={13} color="var(--primary)" /> Similar Solutions ({matches.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 8 }}>
          {matches.map(({ item, isTool, score }) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '8px', background: 'var(--secondary)', color: 'var(--primary-text)', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, flexShrink: 0 }}>
                    {score}%
                  </span>
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                  {isTool ? 'Catalog Tool' : 'Saved Draft'}
                </div>
              </div>
              {isTool ? (
                <Link to={`/tools/${item.id}`} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', marginLeft: '6px', whiteSpace: 'nowrap' }}>
                  View &rarr;
                </Link>
              ) : (
                <button 
                  onClick={() => useCanvasStore.getState().loadBackendIdea(item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', padding: 0, marginLeft: '6px', whiteSpace: 'nowrap' }}
                >
                  Load &rarr;
                </button>
              )}
            </div>
          ))}
          {matches.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No similar tools or ideas found.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default RightPanel;
