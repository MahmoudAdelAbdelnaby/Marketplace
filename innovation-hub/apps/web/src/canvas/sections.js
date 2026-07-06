// Single source of truth for canvas sections.
// Drives the structured map, the completeness meter, and completeness-aware scoring.
// `required: true` sections gate submission; optional sections are skippable.

const has = (v) => (v || '').toString().trim().length > 0;
const anyArr = (a) => Array.isArray(a) && a.length > 0;
const anyOver = (obj, base = 0) => Object.values(obj || {}).some((v) => Number(v) > base);

export const SECTIONS = [
  {
    id: 'problem_solving', label: '1. Problem We Are Solving', phase: 'concept', required: true,
    isFilled: (c) => has(c.problemStatement) || has(c.currentProcess) || has(c.painPoints),
  },
  {
    id: 'target_users', label: '2. Target Users', phase: 'concept', required: true,
    isFilled: (c) => anyArr(c.primaryUsers) && has(c.primaryUsers[0]),
  },
  {
    id: 'value_proposition', label: '3. Value Proposition', phase: 'concept', required: true,
    isFilled: (c) => has(c.vpAudience) || has(c.vpOutcome) || has(c.vpMethod),
  },
  {
    id: 'solution_type', label: '4. Solution Type', phase: 'concept', required: false,
    isFilled: (c) => anyArr(c.solutionTypes),
  },
  {
    id: 'strategic_alignment', label: '5. Strategic Alignment', phase: 'strategy', required: false,
    isFilled: (c) => anyOver(c.strategicAlignment, 0),
  },
  {
    id: 'scalability', label: '6. Scalability Assessment', phase: 'strategy', required: false,
    isFilled: (c) => anyArr(c.industries) || anyArr(c.functions) || anyArr(c.regions),
  },
  {
    id: 'differentiation', label: '8. Differentiation', phase: 'strategy', required: false,
    isFilled: (c) => has(c.currentAlternatives) || has(c.existingCompetitors) || has(c.whatMakesUnique),
  },
  {
    id: 'business_impact', label: '9. Business Impact', phase: 'execution', required: false,
    isFilled: (c) => Number(c.businessImpact?.estimatedUsers) > 0 || Number(c.businessImpact?.hoursSavedPerUser) > 0 || has(c.businessImpact?.costSavings) || has(c.businessImpact?.revenuePotential) || has(c.projectedROI),
  },
  {
    id: 'feasibility', label: '10. Feasibility Assessment', phase: 'execution', required: false,
    isFilled: (c) => anyOver(c.feasibility, 1) || has(c.anticipatedRoadblockers),
  },
  {
    id: 'adoption', label: '11. Adoption Potential', phase: 'execution', required: false,
    isFilled: (c) => anyOver(c.adoption, 1),
  },
  {
    id: 'build_partner', label: '12. Build vs Partner', phase: 'execution', required: false,
    isFilled: (c) => has(c.decision),
  },
  {
    id: 'risks', label: '13. Risks & Dependencies', phase: 'outcomes', required: false,
    isFilled: (c) => anyArr(c.risks?.technical) || anyArr(c.risks?.operational),
  },
  {
    id: 'success_metrics', label: '14. Success Metrics', phase: 'outcomes', required: false,
    isFilled: (c) => has(c.successMetrics?.kpis) || has(c.successMetrics?.revenueTargets),
  },
  {
    id: 'pitch', label: 'Executive Summary & Pitch', phase: 'evaluation', required: false,
    isFilled: (c) => has(c.aiEvaluation) || has(c.proposedPitch),
  },
];

export const REQUIRED_SECTIONS = SECTIONS.filter((s) => s.required);

// Completeness: how much of the canvas is engaged (separate from the opportunity score).
export function getCompleteness(canvas) {
  const filled = SECTIONS.filter((s) => s.isFilled(canvas));
  const requiredFilled = REQUIRED_SECTIONS.filter((s) => s.isFilled(canvas));
  return {
    filledIds: new Set(filled.map((s) => s.id)),
    completenessPct: Math.round((filled.length / SECTIONS.length) * 100),
    requiredComplete: requiredFilled.length === REQUIRED_SECTIONS.length,
    requiredRemaining: REQUIRED_SECTIONS.length - requiredFilled.length,
  };
}
