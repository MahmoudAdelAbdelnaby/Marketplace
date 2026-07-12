import React, { useState } from 'react';
import { Slider, CheckboxGroup, FieldLabel, Tooltip, AutoTextArea } from '../ui/UI';
import { useCanvasStore } from '../../store/useCanvasStore';
import { api } from '../../api';
import { SOLUTION_TYPES, INDUSTRIES, FUNCTIONS, REGIONS, TIPS } from './sectionConstants';
import { parseMarkdownAndLatex } from '../layout/AiPanel';

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' };

export default function SectionFields({ sectionId }) {
  const { canvas, isAdvancedMode, updateField, updateNestedField, toggleArrayItem } = useCanvasStore();
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const generatePitch = async () => {
    setLoadingAI(true);
    try {
      const prompt = `Review the following complete business canvas for a new product/idea:\n${JSON.stringify(canvas, null, 2)}\n\nAct as a senior strategy consultant. Evaluate its strengths, weaknesses, and viability. Then generate a compelling, executive-level value proposition and strategic recommendation for the board. Formulate equations using standard LaTeX if helpful. Do not use markdown headings. Just plain text.`;
      const { text } = await api('/ai/generate', { method: 'POST', body: { prompt } });
      updateField(null, 'aiEvaluation', text);
    } catch (err) {
      alert(`AI error: ${err.message}\n\nTip: set your AI provider in Settings.`);
    } finally {
      setLoadingAI(false);
      try {
        const { useAuthStore } = await import('../../store/useAuthStore');
        useAuthStore.getState().reloadUser();
      } catch (reloadErr) {}
    }
  };

  const generateProposedPitch = async () => {
    setLoadingPitch(true);
    try {
      const prompt = `Review the following complete business canvas for a new product/idea:\n${JSON.stringify(canvas, null, 2)}\n\nAct as a senior strategy consultant. Create a compelling 1-minute elevator pitch for this product to convince leadership or a client to adopt it. Do not use markdown headings.`;
      const { text } = await api('/ai/generate', { method: 'POST', body: { prompt } });
      updateField(null, 'proposedPitch', text);
    } catch (err) {
      alert(`AI error: ${err.message}`);
    } finally {
      setLoadingPitch(false);
      try {
        const { useAuthStore } = await import('../../store/useAuthStore');
        useAuthStore.getState().reloadUser();
      } catch (reloadErr) {}
    }
  };

  const generateDifferentiation = async () => {
    setLoadingDiff(true);
    try {
      const prompt = `Review the following complete business canvas for a new product/idea:\n${JSON.stringify(canvas, null, 2)}\n\nAct as a senior strategy consultant. Create a concise comparison of this solution against existing alternatives, workarounds, or competitors. Highlight its unique differentiation points. Do not use markdown headings.`;
      const { text } = await api('/ai/generate', { method: 'POST', body: { prompt } });
      updateField(null, 'differentiationAnalysis', text);
    } catch (err) {
      alert(`AI error: ${err.message}`);
    } finally {
      setLoadingDiff(false);
      try {
        const { useAuthStore } = await import('../../store/useAuthStore');
        useAuthStore.getState().reloadUser();
      } catch (reloadErr) {}
    }
  };

  switch (sectionId) {
    case 'problem_solving':
      return (
        <>
          <div>
            <FieldLabel tip={TIPS.problemStatement}>Problem Statement / Pain Points</FieldLabel>
            <AutoTextArea 
              placeholder="Describe the core problem your idea addresses and the key pain points..." 
              value={canvas.problemStatement || ''} 
              onChange={(e) => updateField(null, 'problemStatement', e.target.value)} 
            />
          </div>
          {isAdvancedMode && (
            <>
              <div style={grid2}>
                <div>
                  <FieldLabel tip={TIPS.currentProcess}>Current Process Description</FieldLabel>
                  <AutoTextArea 
                    placeholder="How is this currently done?" 
                    value={canvas.currentProcess || ''} 
                    onChange={(e) => updateField(null, 'currentProcess', e.target.value)} 
                  />
                </div>
                <div>
                  <FieldLabel tip={TIPS.painPoints}>Pain Points Details</FieldLabel>
                  <AutoTextArea 
                    placeholder="List specific frustrations..." 
                    value={canvas.painPoints || ''} 
                    onChange={(e) => updateField(null, 'painPoints', e.target.value)} 
                  />
                </div>
              </div>
              <div style={grid2}>
                <div>
                  <FieldLabel tip={TIPS.frequency}>Frequency of Issue</FieldLabel>
                  <select 
                    value={canvas.frequency || ''} 
                    onChange={(e) => updateField(null, 'frequency', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="" disabled>Select frequency...</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="rarely">Rarely</option>
                  </select>
                </div>
                <div>
                  <FieldLabel tip={TIPS.implicationsOfInaction}>Implications of Inaction</FieldLabel>
                  <AutoTextArea 
                    placeholder="What happens if we do nothing?" 
                    value={canvas.implicationsOfInaction || ''} 
                    onChange={(e) => updateField(null, 'implicationsOfInaction', e.target.value)} 
                  />
                </div>
              </div>
            </>
          )}
        </>
      );

    case 'target_users':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={grid2}>
            <div>
              <FieldLabel tip={TIPS.primaryUsers}>Primary Users (Comma separated)</FieldLabel>
              <input value={canvas.primaryUsers?.join(', ') || ''} onChange={(e) => updateField(null, 'primaryUsers', e.target.value.split(', '))} placeholder="e.g. Call Agents, Financial Analysts" />
            </div>
            <div>
              <FieldLabel tip={TIPS.decisionMakers}>Decision Makers (Comma separated)</FieldLabel>
              <input value={canvas.decisionMakers?.join(', ') || ''} onChange={(e) => updateField(null, 'decisionMakers', e.target.value.split(', '))} placeholder="e.g. Operations Director, Account Lead" />
            </div>
          </div>
        </div>
      );

    case 'value_proposition':
      return (
        <>
          <div style={{ backgroundColor: 'var(--secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>This solution helps: <Tooltip {...TIPS.vpAudience} /></span><input style={{ marginTop: '0.25rem' }} value={canvas.vpAudience || ''} onChange={(e) => updateField(null, 'vpAudience', e.target.value)} placeholder="who?" /></div>
              <div><span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>Achieve: <Tooltip {...TIPS.vpOutcome} /></span><input style={{ marginTop: '0.25rem' }} value={canvas.vpOutcome || ''} onChange={(e) => updateField(null, 'vpOutcome', e.target.value)} placeholder="what outcome?" /></div>
              <div><span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>By doing: <Tooltip {...TIPS.vpMethod} /></span><AutoTextArea style={{ marginTop: '0.25rem' }} value={canvas.vpMethod || ''} onChange={(e) => updateField(null, 'vpMethod', e.target.value)} placeholder="by what method?" /></div>
            </div>
          </div>
          {isAdvancedMode && (
            <div style={grid2}>
              <div><FieldLabel tip={TIPS.businessBenefits}>Business Benefits</FieldLabel><AutoTextArea value={canvas.businessBenefits || ''} onChange={(e) => updateField(null, 'businessBenefits', e.target.value)} /></div>
              <div><FieldLabel tip={TIPS.customerBenefits}>Customer Benefits</FieldLabel><AutoTextArea value={canvas.customerBenefits || ''} onChange={(e) => updateField(null, 'customerBenefits', e.target.value)} /></div>
            </div>
          )}
        </>
      );

    case 'solution_type':
      return (
        <div>
          <FieldLabel tip={{ description: 'Select the technical solution type format for this opportunity.', question: 'What type of tool are we building?' }}>
            Solution Type
          </FieldLabel>
          <CheckboxGroup options={SOLUTION_TYPES} selected={canvas.solutionTypes} onChange={(opt) => toggleArrayItem('solutionTypes', opt)} />
          {canvas.solutionTypes?.includes('Other') && (
            <div style={{ marginTop: '1rem' }}>
              <label>Specify Other:</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="text" placeholder="Press Enter to add custom type..." onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const val = e.target.value.trim();
                    if (!canvas.solutionTypes.includes(val)) updateField(null, 'solutionTypes', [...canvas.solutionTypes, val]);
                    e.target.value = '';
                  }
                }} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {canvas.solutionTypes.filter((t) => !SOLUTION_TYPES.includes(t)).map((t) => (
                  <div key={t} style={{ background: 'var(--secondary)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {t}
                    <button onClick={() => toggleArrayItem('solutionTypes', t)} style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}>&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'strategic_alignment':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '0.5rem' }}>
          {[
            ['revenueGrowth', 'Revenue Growth'], ['costReduction', 'Cost Reduction'], ['productivity', 'Productivity Improvement'],
            ['clientExperience', 'Client Experience'], ['employeeExperience', 'Employee Experience'], ['marketExpansion', 'Market Expansion'],
            ['competitiveAdvantage', 'Competitive Advantage'], ['innovationLeadership', 'Innovation Leadership'],
          ].map(([key, label]) => (
            <Slider key={key} label={label} value={canvas.strategicAlignment[key]} min={0} max={2}
              valueLabelMapping={{ 0: 'None', 1: 'Potential Impact', 2: 'Definite Impact' }}
              onChange={(val) => updateNestedField('strategicAlignment', key, val)} tip={TIPS[key]} />
          ))}
        </div>
      );

    case 'scalability':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div><FieldLabel tip={TIPS.industries}><span style={{ fontSize: '1rem' }}>Industries</span></FieldLabel><CheckboxGroup options={INDUSTRIES} selected={canvas.industries} onChange={(opt) => toggleArrayItem('industries', opt)} /></div>
          <div><FieldLabel tip={TIPS.functions}><span style={{ fontSize: '1rem' }}>Functions</span></FieldLabel><CheckboxGroup options={FUNCTIONS} selected={canvas.functions} onChange={(opt) => toggleArrayItem('functions', opt)} /></div>
          <div><FieldLabel tip={TIPS.regions}><span style={{ fontSize: '1rem' }}>Geographic Regions</span></FieldLabel><CheckboxGroup options={REGIONS} selected={canvas.regions} onChange={(opt) => toggleArrayItem('regions', opt)} /></div>
        </div>
      );

    case 'differentiation':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={grid2}>
            <div><FieldLabel tip={TIPS.currentAlternatives}>Current Alternatives / Workarounds</FieldLabel><AutoTextArea value={canvas.currentAlternatives || ''} onChange={e => updateField(null, 'currentAlternatives', e.target.value)} placeholder="How do users cope today?" /></div>
            <div><FieldLabel tip={TIPS.existingCompetitors}>Existing Competitors</FieldLabel><AutoTextArea value={canvas.existingCompetitors || ''} onChange={e => updateField(null, 'existingCompetitors', e.target.value)} placeholder="Are there internal/external similar tools?" /></div>
          </div>
          <div>
            <FieldLabel tip={TIPS.whatMakesUnique}>What makes this unique?</FieldLabel>
            <AutoTextArea value={canvas.whatMakesUnique || ''} onChange={e => updateField(null, 'whatMakesUnique', e.target.value)} placeholder="What is our unfair advantage?" />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.8rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>AI Differentiation Comparison</h4>
            <button type="button" onClick={generateDifferentiation} disabled={loadingDiff} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12, opacity: loadingDiff ? 0.6 : 1 }}>
              {loadingDiff ? 'Generating...' : '✨ Generate AI Differentiation Comparison'}
            </button>
            <AutoTextArea value={canvas.differentiationAnalysis || ''} onChange={e => updateField(null, 'differentiationAnalysis', e.target.value)} placeholder="Run AI comparison or write details..." style={{ height: 120 }} />
          </div>
        </div>
      );

    case 'business_impact':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.2rem' }}>
            <div><FieldLabel tip={TIPS.estimatedUsers}>Estimated Users</FieldLabel><input type="number" value={canvas.businessImpact?.estimatedUsers || 0} onChange={(e) => updateNestedField('businessImpact', 'estimatedUsers', parseInt(e.target.value) || 0)} /></div>
            <div><FieldLabel tip={TIPS.hoursSavedPerUser}>Hours Saved per User Weekly</FieldLabel><input type="number" value={canvas.businessImpact?.hoursSavedPerUser || 0} onChange={(e) => updateNestedField('businessImpact', 'hoursSavedPerUser', parseFloat(e.target.value) || 0)} /></div>
            <div>
              <FieldLabel tip={{ description: 'Projected financial return on investment per year.', question: 'What is the projected ROI?' }}>Projected ROI ($/yr)</FieldLabel>
              <input value={canvas.projectedROI || ''} onChange={(e) => updateField(null, 'projectedROI', e.target.value)} placeholder="e.g. $120,000" />
            </div>
          </div>

          <div style={grid2}>
            <div><FieldLabel tip={TIPS.costSavings}>Potential Cost Saving Areas</FieldLabel><AutoTextArea value={canvas.businessImpact?.costSavings || ''} onChange={(e) => updateNestedField('businessImpact', 'costSavings', e.target.value)} placeholder="Where are costs reduced?" /></div>
            <div><FieldLabel tip={TIPS.revenuePotential}>Potential Revenue Streams</FieldLabel><AutoTextArea value={canvas.businessImpact?.revenuePotential || ''} onChange={(e) => updateNestedField('businessImpact', 'revenuePotential', e.target.value)} placeholder="Where is revenue grown?" /></div>
          </div>

          <div style={grid2}>
            <div>
              <FieldLabel tip={{ description: 'Estimated time in days required to deploy this solution to production.', question: 'How long to deploy?' }}>Time to Deploy (Days)</FieldLabel>
              <input type="number" value={canvas.deploymentTimeDays || 0} onChange={(e) => updateField(null, 'deploymentTimeDays', parseInt(e.target.value) || 0)} />
            </div>
          </div>


        </div>
      );

    case 'feasibility':
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '0.5rem' }}>
            {[
              ['technical', 'Technical Feasibility'], ['dataAvailability', 'Data Availability'], ['resourceAvailability', 'Resource Availability'],
              ['security', 'Security Requirements'], ['compliance', 'Compliance Complexity'], ['implementation', 'Implementation Complexity'],
            ].map(([key, label]) => (
              <Slider key={key} label={label} value={canvas.feasibility[key]} onChange={(val) => updateNestedField('feasibility', key, val)} tip={TIPS[key]} />
            ))}
          </div>
          <div style={{ marginTop: '1.2rem' }}>
            <FieldLabel tip={TIPS.anticipatedRoadblockers}>Anticipated Roadblockers/Technology Dependencies</FieldLabel>
            <AutoTextArea value={canvas.anticipatedRoadblockers || ''} onChange={(e) => updateField(null, 'anticipatedRoadblockers', e.target.value)} placeholder="List major blockers or dependencies..." />
          </div>
        </>
      );

    case 'adoption':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '0.5rem' }}>
          {[
            ['easeOfUse', 'Ease of Use'], ['trainingReqs', 'Training Requirements'],
            ['execSponsorship', 'Executive Sponsorship'], ['userDemand', 'User Demand'],
          ].map(([key, label]) => (
            <Slider key={key} label={label} value={canvas.adoption[key]} onChange={(val) => updateNestedField('adoption', key, val)} tip={TIPS[key]} />
          ))}
        </div>
      );

    case 'build_partner':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <FieldLabel tip={TIPS.decision}>Build vs Buy vs Partner Approach</FieldLabel>
            <select value={canvas.decision || ''} onChange={(e) => updateField(null, 'decision', e.target.value)} style={{ width: '100%', cursor: 'pointer' }}>
              <option value="" disabled>Select approach...</option>
              <option value="Build">Build (Proprietary / In-house)</option>
              <option value="Buy">Buy (Commercial SaaS / Third-party)</option>
              <option value="Partner">Partner (Joint development / Ext. Vendor)</option>
              <option value="Extend Existing DIS Solution">Extend Existing DIS Solution</option>
              <option value="Extend Existing CNX Solution">Extend Existing CNX Solution</option>
            </select>
          </div>
          <div style={grid2}>
            <div><FieldLabel tip={TIPS.decisionJustification}>Justification</FieldLabel><AutoTextArea value={canvas.decisionJustification || ''} onChange={(e) => updateField(null, 'decisionJustification', e.target.value)} /></div>
            <div><FieldLabel tip={TIPS.decisionTechConsiderations}>Other Considerations</FieldLabel><AutoTextArea value={canvas.decisionTechConsiderations || ''} onChange={(e) => updateField(null, 'decisionTechConsiderations', e.target.value)} /></div>
          </div>
        </div>
      );

    case 'risks':
      return (
        <div style={grid2}>
          <div>
            <FieldLabel tip={TIPS.technicalRisks}>Technical Risks (Comma separated)</FieldLabel>
            <AutoTextArea 
              value={canvas.risks?.technical?.join(', ') || ''} 
              onChange={(e) => updateNestedField('risks', 'technical', e.target.value.split(', '))} 
              placeholder="e.g. API limits, data sync lag"
            />
          </div>
          <div>
            <FieldLabel tip={TIPS.operationalRisks}>Operational Risks (Comma separated)</FieldLabel>
            <AutoTextArea 
              value={canvas.risks?.operational?.join(', ') || ''} 
              onChange={(e) => updateNestedField('risks', 'operational', e.target.value.split(', '))} 
              placeholder="e.g. Agent friction, training time"
            />
          </div>
        </div>
      );

    case 'success_metrics':
      return (
        <div style={grid2}>
          <div><FieldLabel tip={TIPS.kpis}>KPIs</FieldLabel><AutoTextArea value={canvas.successMetrics?.kpis || ''} onChange={(e) => updateNestedField('successMetrics', 'kpis', e.target.value)} placeholder="List measurable indicators..." /></div>
          <div><FieldLabel tip={TIPS.revenueTargets}>Targets</FieldLabel><AutoTextArea value={canvas.successMetrics?.revenueTargets || ''} onChange={(e) => updateNestedField('successMetrics', 'revenueTargets', e.target.value)} placeholder="Define target thresholds..." /></div>
        </div>
      );

    case 'pitch':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Proposed Pitch for Idea</h4>
            <button type="button" onClick={generateProposedPitch} disabled={loadingPitch} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12, opacity: loadingPitch ? 0.6 : 1 }}>
              {loadingPitch ? 'Generating...' : '✨ Generate Proposed Pitch'}
            </button>
            <AutoTextArea value={canvas.proposedPitch || ''} onChange={e => updateField(null, 'proposedPitch', e.target.value)} placeholder="AI elevator pitch or write details..." style={{ height: 120 }} />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Strategic Evaluation & Value Proposition</h4>
            <button onClick={generatePitch} disabled={loadingAI} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12, opacity: loadingAI ? 0.6 : 1 }}>
              {loadingAI ? 'Evaluating…' : '✨ Generate AI strategic evaluation'}
            </button>
            
            {canvas.aiEvaluation ? (
              <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 10 }}>
                {parseMarkdownAndLatex(canvas.aiEvaluation)}
              </div>
            ) : null}
            <AutoTextArea style={{ height: '180px' }}
              placeholder="Write your executive pitch here, or click generate above..."
              value={canvas.aiEvaluation || ''} onChange={(e) => updateField(null, 'aiEvaluation', e.target.value)} />
          </div>
        </div>
      );

    default:
      return null;
  }
}

