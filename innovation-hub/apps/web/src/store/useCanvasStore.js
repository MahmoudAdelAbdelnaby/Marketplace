import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCompleteness } from '../canvas/sections';

// Initial state for a new idea canvas
const initialCanvasState = {
  // BMC Text Fields
  keyPartners: '',
  keyActivities: '',
  keyResources: '',
  customerRelationships: '',
  channels: '',
  costStructure: '',
  revenueStreams: '',

  // Section 1: Problem Definition
  problemStatement: '',
  currentProcess: '',
  painPoints: '',
  frequency: '',
  implicationsOfInaction: '',
  workarounds: '',

  // Section 2: Target Users
  primaryUsers: [],
  secondaryUsers: [],
  decisionMakers: [],
  influencers: [],
  beneficiaries: [],

  // Section 3: Value Proposition
  vpAudience: '',
  vpOutcome: '',
  vpMethod: '',
  keyBenefits: '',
  businessBenefits: '',
  customerBenefits: '',
  operationalBenefits: '',

  // Section 4: Solution Type
  solutionTypes: [],

  // Section 5: Strategic Alignment (0-2 sliders: 0=None, 1=Potential, 2=Definite)
  strategicAlignment: {
    revenueGrowth: 0,
    costReduction: 0,
    productivity: 0,
    clientExperience: 0,
    employeeExperience: 0,
    marketExpansion: 0,
    competitiveAdvantage: 0,
    innovationLeadership: 0,
  },

  // Section 6: Scalability Assessment
  industries: [],
  functions: [],
  regions: [],

  // Section 8: Differentiation
  currentAlternatives: '',
  existingCompetitors: '',
  manualProcessesReplaced: '',
  whyBetter: '',
  whatMakesUnique: '',
  hardToReplicate: '',
  proprietaryAssets: '',
  differentiationAnalysis: '',

  // Section 9: Business Impact
  businessImpact: {
    estimatedUsers: 0,
    hoursSavedPerUser: 0,
    costSavings: '',
    revenuePotential: '',
    riskReduction: '',
    qualityImprovement: '',
  },
  projectedROI: '',
  deploymentTimeDays: '',
  pricing: {
    pricePerUser: '',
    deploymentFees: '',
    amount: '',
  },

  // Section 10: Feasibility Assessment
  feasibility: {
    technical: 1,
    dataAvailability: 1,
    resourceAvailability: 1,
    security: 1,
    compliance: 1,
    implementation: 1,
  },
  anticipatedRoadblockers: '',

  // Section 11: Adoption Potential (1-5 ratings)
  adoption: {
    easeOfUse: 1,
    trainingReqs: 1,
    execSponsorship: 1,
    userDemand: 1,
  },

  // Section 12: Build vs Buy vs Partner
  decision: '',
  decisionJustification: '',
  decisionDependencies: '',
  decisionTechConsiderations: '',

  // Section 13: Risks & Dependencies
  risks: {
    technical: [],
    operational: [],
    financial: [],
    compliance: [],
    adoption: [],
  },

  // Section 14: Success Metrics
  successMetrics: {
    kpis: '',
    adoptionTargets: '',
    revenueTargets: '',
    savingsTargets: '',
    customerOutcomes: '',
  },

  // Section 16: AI Evaluation
  aiEvaluation: '',
  proposedPitch: '',

};

export const useCanvasStore = create(
  persist(
    (set, get) => ({
      settings: {
        apiKey: ''
      },
      isProgressCollapsed: false,
      isScorecardCollapsed: false,
      isAiPanelCollapsed: false,
      isAdvancedMode: false,
      activePhase: 'key_partners', // starts at key_partners
      viewMode: 'map', // 'map' | 'form' — structured map is the default lens
      focusSection: null, // section id to scroll to when jumping from the map
      editingSection: null, // section id currently open in the inline map editor
      canvas: { ...initialCanvasState },
      portfolio: [], // Saved ideas
      openTabs: [{ id: 'default', canvasData: { ...initialCanvasState } }],
      activeTabId: 'default',

      // UI Actions
      toggleProgressCollapsed: () => set((state) => ({ isProgressCollapsed: !state.isProgressCollapsed })),
      toggleScorecardCollapsed: () => set((state) => ({ isScorecardCollapsed: !state.isScorecardCollapsed })),
      toggleAiPanelCollapsed: () => set((state) => ({ isAiPanelCollapsed: !state.isAiPanelCollapsed })),
      toggleAdvancedMode: () => set((state) => ({ isAdvancedMode: !state.isAdvancedMode })),
      setViewMode: (mode) => set({ viewMode: mode }),
      setFocusSection: (id) => set({ focusSection: id }),
      // Inline map editing: open/close a section's fields in the drawer without leaving the map
      openEditor: (sectionId) => set({ editingSection: sectionId }),
      closeEditor: () => set({ editingSection: null }),
      // Jump from a map node straight into editing its section in the full form
      openSection: (phase, sectionId) => set({ activePhase: phase, viewMode: 'form', focusSection: sectionId }),

      // Settings actions
      setApiKey: (key) => set((state) => ({ settings: { ...state.settings, apiKey: key } })),
      setActivePhase: (phase) => set({ activePhase: phase }),

      // Actions
      updateField: (section, field, value) => set((state) => {
    if (section) {
      return { canvas: { ...state.canvas, [section]: { ...state.canvas[section], [field]: value } } };
    }
    return { canvas: { ...state.canvas, [field]: value } };
  }),

  // Nested object updates (for strategic alignment, etc)
  updateNestedField: (section, field, value) => set((state) => ({
    canvas: {
      ...state.canvas,
      [section]: {
        ...state.canvas[section],
        [field]: value
      }
    }
  })),

  // Array toggles (for checkboxes)
  toggleArrayItem: (field, item) => set((state) => {
    const arr = state.canvas[field] || [];
    if (arr.includes(item)) {
      return { canvas: { ...state.canvas, [field]: arr.filter(i => i !== item) } };
    }
    return { canvas: { ...state.canvas, [field]: [...arr, item] } };
  }),

  // Scoring Calculations — completeness-aware.
  // A dimension only counts toward the overall score once the user has actually
  // engaged with it; weights are renormalized over engaged dimensions so that
  // skipping an optional section never drags the score to a misleading low.
  getScores: () => {
    const state = get().canvas;
    // Defensive fallbacks so a partial/legacy persisted canvas can never throw.
    const strategicAlignment = state.strategicAlignment || {};
    const feasibility = state.feasibility || {};
    const adoption = state.adoption || {};
    const industries = state.industries || [];
    const functions = state.functions || [];
    const regions = state.regions || [];

    // Engagement predicates (did the user touch this dimension at all?)
    const stratEngaged = Object.values(strategicAlignment).some((v) => v > 0);
    const scalEngaged = industries.length > 0 || functions.length > 0 || regions.length > 0;
    const feasEngaged = Object.values(feasibility).some((v) => v !== 1);
    const adopEngaged = Object.values(adoption).some((v) => v !== 1);

    // Strategic Alignment Score (0-2 sliders)
    const stratValues = Object.values(strategicAlignment);
    const strategicScore = stratValues.length ? Math.round((stratValues.reduce((a, b) => a + b, 0) / (stratValues.length * 2)) * 100) : 0;

    // Scalability Score
    let scalScore = (industries.length * 5) + (functions.length * 5) + (regions.length * 10);
    scalScore = Math.min(100, scalScore);

    // Feasibility Score (sliders map 1-5 to 0-4)
    const feasValues = Object.values(feasibility);
    const feasibilityScore = feasValues.length ? Math.round((feasValues.reduce((a, b) => a + (b - 1), 0) / (feasValues.length * 4)) * 100) : 0;

    // Adoption Score (sliders map 1-5 to 0-4)
    const adopValues = Object.values(adoption);
    const adoptionScore = adopValues.length ? Math.round((adopValues.reduce((a, b) => a + (b - 1), 0) / (adopValues.length * 4)) * 100) : 0;

    // Weighted overall over ENGAGED dimensions only (renormalized).
    const dims = [
      { score: strategicScore, w: 0.30, on: stratEngaged },
      { score: scalScore, w: 0.25, on: scalEngaged },
      { score: feasibilityScore, w: 0.25, on: feasEngaged },
      { score: adoptionScore, w: 0.20, on: adopEngaged },
    ];
    const engaged = dims.filter((d) => d.on);
    const wSum = engaged.reduce((a, d) => a + d.w, 0);
    const overallScore = wSum > 0
      ? Math.round(engaged.reduce((a, d) => a + d.score * d.w, 0) / wSum)
      : 0;

    const comp = getCompleteness(state);

    return {
      strategicScore,
      scalScore,
      feasibilityScore,
      adoptionScore,
      overallScore,
      assessed: { strategic: stratEngaged, scalability: scalEngaged, feasibility: feasEngaged, adoption: adopEngaged },
      completenessPct: comp.completenessPct,
      requiredComplete: comp.requiredComplete,
      requiredRemaining: comp.requiredRemaining,
      filledIds: comp.filledIds,
      scored: engaged.length > 0,
      provisional: engaged.length < dims.length, // not all dimensions assessed yet
    };
  },

  // Portfolio Management
  saveIdea: (name) => set((state) => {
    const newIdea = {
      id: Date.now(),
      name: name || 'Untitled Idea',
      dateSaved: new Date().toISOString(),
      canvas: { ...state.canvas },
      scores: get().getScores()
    };
    // optionally save to local storage here if needed
    return { portfolio: [...state.portfolio, newIdea] };
  }),

  loadIdea: (id) => set((state) => {
    const idea = state.portfolio.find(i => i.id === id);
    if (idea) {
      return { canvas: { ...idea.canvas } };
    }
    return state;
  }),
  
  loadBackendIdea: (idea) => set((state) => {
    let updatedTabs = [...state.openTabs];
    if (state.activeTabId) {
      updatedTabs = updatedTabs.map(t => 
        t.id === state.activeTabId ? { ...t, canvasData: { ...state.canvas } } : t
      );
    }
    const newId = `idea-${idea.id}`;
    const existing = updatedTabs.find(t => t.id === newId);
    const newCanvas = { ...idea.canvas, id: idea.id, name: idea.name };
    
    if (existing) {
      updatedTabs = updatedTabs.map(t => t.id === newId ? { ...t, canvasData: newCanvas } : t);
      return { openTabs: updatedTabs, activeTabId: newId, canvas: newCanvas, activePhase: 'key_partners' };
    } else {
      updatedTabs.push({ id: newId, canvasData: newCanvas });
      return { openTabs: updatedTabs, activeTabId: newId, canvas: newCanvas, activePhase: 'key_partners' };
    }
  }),
  
  clearCanvas: () => set((state) => {
    const newCanvas = { ...initialCanvasState };
    const updatedTabs = state.openTabs.map(t => 
      t.id === state.activeTabId ? { ...t, canvasData: newCanvas } : t
    );
    return { canvas: newCanvas, openTabs: updatedTabs, activePhase: 'key_partners' };
  }),

  newTab: () => set((state) => {
    const updatedTabs = state.openTabs.map(t => 
      t.id === state.activeTabId ? { ...t, canvasData: { ...state.canvas } } : t
    );
    const newId = `tab-${Date.now()}`;
    const newTabData = { id: newId, canvasData: { ...initialCanvasState } };
    updatedTabs.push(newTabData);
    return {
      openTabs: updatedTabs,
      activeTabId: newId,
      canvas: newTabData.canvasData,
      activePhase: 'key_partners'
    };
  }),

  switchTab: (tabId) => set((state) => {
    if (state.activeTabId === tabId) return state;
    const updatedTabs = state.openTabs.map(t => 
      t.id === state.activeTabId ? { ...t, canvasData: { ...state.canvas } } : t
    );
    const target = updatedTabs.find(t => t.id === tabId);
    if (!target) return { openTabs: updatedTabs };
    return {
      openTabs: updatedTabs,
      activeTabId: tabId,
      canvas: target.canvasData,
      activePhase: 'key_partners'
    };
  }),

  closeTab: (tabId) => set((state) => {
    let updatedTabs = state.openTabs;
    if (state.activeTabId !== tabId) {
      updatedTabs = updatedTabs.map(t => 
        t.id === state.activeTabId ? { ...t, canvasData: { ...state.canvas } } : t
      );
    }
    updatedTabs = updatedTabs.filter(t => t.id !== tabId);
    
    if (updatedTabs.length === 0) {
      const newId = `tab-${Date.now()}`;
      const newTabData = { id: newId, canvasData: { ...initialCanvasState } };
      return { openTabs: [newTabData], activeTabId: newId, canvas: newTabData.canvasData };
    }
    
    if (state.activeTabId === tabId) {
      const nextTab = updatedTabs[updatedTabs.length - 1];
      return { openTabs: updatedTabs, activeTabId: nextTab.id, canvas: nextTab.canvasData };
    }
    
    return { openTabs: updatedTabs };
  }),

  renameTab: (tabId, newName) => set((state) => {
    let updatedTabs = state.openTabs.map(t => 
      t.id === tabId ? { ...t, canvasData: { ...t.canvasData, name: newName } } : t
    );
    if (state.activeTabId === tabId) {
      return { openTabs: updatedTabs, canvas: { ...state.canvas, name: newName } };
    }
    return { openTabs: updatedTabs };
  })
    }),
    {
      name: 'canvas-storage',
      partialize: (state) => ({
        settings: state.settings,
        canvas: state.canvas,
        portfolio: state.portfolio,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId
      }),
      // Backfill any keys an older persisted canvas is missing so schema drift
      // (e.g. state saved by a previous version) can never crash scoring.
      merge: (persisted, current) => {
        const p = persisted || {};
        const canvas = { ...initialCanvasState, ...(p.canvas || {}) };
        const openTabs = p.openTabs || [{ id: 'default', canvasData: canvas }];
        const activeTabId = p.activeTabId || 'default';
        
        // Defensive check: Ensure critical array fields are strictly arrays to avoid runtime crashes
        ['solutionTypes', 'regions', 'industries', 'functions'].forEach((key) => {
          if (!Array.isArray(canvas[key])) {
            canvas[key] = [];
          }
        });

        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings || {}) },
          canvas,
          openTabs,
          activeTabId,
        };
      },
    }
  )
);
