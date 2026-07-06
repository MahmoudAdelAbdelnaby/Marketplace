export const SOLUTION_TYPES = [
  'Internal Tool', 'SaaS Product', 'Automation', 'Analytics Platform',
  'Consulting Accelerator', 'Process Improvement',
  'Knowledge Management Tool', 'Workforce Optimization Tool', 'Other'
];

export const INDUSTRIES = ['Internal', 'Financial Services', 'Insurance', 'Retail', 'Telecommunications', 'Technology', 'Healthcare', 'Travel', 'Automotive', 'Public Sector', 'Utilities', 'Media', 'Manufacturing', 'Other'];
export const FUNCTIONS = ['Operations', 'Marketing', 'Sales', 'HR', 'IT', 'Analytics', 'Finance', 'Legal', 'Training', 'Quality', 'WFM', 'Leadership', 'Innovation & Transformation', 'Account Management'];
export const REGIONS = ['Local', 'Regional', 'Global'];

// Tooltip content for all fields
export const TIPS = {
  problemStatement: {
    description: 'Describe the core problem your idea addresses. Be specific about who is affected and what the impact is.',
    example: '"Contact center agents spend 40% of their time manually searching across 5+ disconnected knowledge bases to find answers during live calls."',
    question: 'What happens today that frustrates users or wastes resources?',
  },
  currentProcess: {
    description: 'Explain how things are currently done without your solution. Include manual steps, tools used, and time spent.',
    example: '"Agents alt-tab between CRM, wiki, and email to find policies, then manually type summaries into the ticketing system."',
    question: 'If someone shadowed the process today, what would they see?',
  },
  painPoints: {
    description: 'List the specific frustrations, inefficiencies, or failures caused by the current process.',
    example: '"High average handle time, inconsistent answers across agents, new hire ramp-up takes 12 weeks."',
    question: 'What do stakeholders complain about most?',
  },
  frequency: {
    description: 'How often does this problem occur? More frequent problems typically warrant higher investment priority.',
    example: '"Daily — every agent encounters this on nearly every call."',
    question: 'Is this a daily headache or an occasional inconvenience?',
  },
  implicationsOfInaction: {
    description: 'What happens if we do nothing? Describe the business cost of maintaining the status quo.',
    example: '"Continued attrition at 45% annually, $2.1M in lost productivity, and declining CSAT below industry benchmark."',
    question: 'What is the cost of doing nothing for the next 12 months?',
  },
  primaryUsers: {
    description: 'The people who will directly use the solution on a regular basis.',
    example: '"Frontline contact center agents, team leaders, quality analysts"',
    question: 'Who touches this process every day?',
  },
  decisionMakers: {
    description: 'The stakeholders who approve budget, resources, or adoption of new solutions.',
    example: '"VP of Operations, CTO, Head of Digital Transformation"',
    question: 'Who has the authority to greenlight this initiative?',
  },
  vpAudience: {
    description: 'Define the specific audience segment this solution serves.',
    example: '"Enterprise contact centers with 500+ agents"',
    question: 'Who exactly will benefit from this?',
  },
  vpOutcome: {
    description: 'The measurable outcome or transformation the solution delivers.',
    example: '"30% reduction in average handle time and 95% first-call resolution"',
    question: 'What tangible result will users achieve?',
  },
  vpMethod: {
    description: 'The approach or mechanism through which your solution delivers its value.',
    example: '"AI-powered real-time knowledge retrieval that surfaces the right answer during live calls"',
    question: 'How does your solution make the outcome possible?',
  },
  businessBenefits: {
    description: 'Quantifiable advantages for the organization — revenue, cost savings, efficiency gains.',
    example: '"$1.5M annual savings from reduced handle time, 20% improvement in agent utilization"',
    question: 'How does this move the needle on business KPIs?',
  },
  customerBenefits: {
    description: 'How end-customers or clients benefit from this solution.',
    example: '"Faster resolution times, more accurate answers, consistent experience across channels"',
    question: 'How will the end-customer feel the difference?',
  },
  // Strategic Alignment tooltips
  revenueGrowth: {
    description: 'Does this solution directly or indirectly contribute to increasing revenue?',
    example: '"Enables upsell recommendations during service calls, driving 5% revenue lift."',
    question: 'Could this open new revenue streams or grow existing ones?',
  },
  costReduction: {
    description: 'Does this solution reduce operational costs through automation, efficiency, or resource optimization?',
    example: '"Reduces manual data entry by 80%, saving 2 FTEs annually."',
    question: 'Where are the current cost sinks this could eliminate?',
  },
  productivity: {
    description: 'Does this solution help teams accomplish more in less time?',
    example: '"Agents handle 25% more interactions per shift with AI-assisted responses."',
    question: 'How much faster or more efficiently could people work?',
  },
  clientExperience: {
    description: 'Does this solution improve client satisfaction, loyalty, or engagement?',
    example: '"CSAT improves from 72% to 88% through faster, more accurate resolutions."',
    question: 'Will clients notice a tangible improvement in their experience?',
  },
  employeeExperience: {
    description: 'Does this solution reduce employee friction, burnout, or frustration?',
    example: '"Agents report 40% less frustration with knowledge search after implementation."',
    question: 'Would employees thank you for building this?',
  },
  marketExpansion: {
    description: 'Does this solution enable entry into new markets, segments, or geographies?',
    example: '"Multi-language support unlocks LATAM and APAC markets without additional staffing."',
    question: 'Could this help us reach customers or markets we cannot serve today?',
  },
  competitiveAdvantage: {
    description: 'Does this solution create a differentiator that competitors cannot easily replicate?',
    example: '"Proprietary AI model trained on 10 years of interaction data gives us a unique edge."',
    question: 'Would this make us harder to compete against?',
  },
  innovationLeadership: {
    description: 'Does this solution position the organization as a thought leader or innovator in the industry?',
    example: '"First-to-market real-time AI coaching in BPO — drives press coverage and analyst recognition."',
    question: 'Would this make headlines or turn heads at industry conferences?',
  },
  // Scalability tooltips
  industries: {
    description: 'Which industries could benefit from this solution? More industries = higher scalability score.',
    example: '"Financial Services, Insurance, Telecommunications — any industry with high-volume interactions."',
    question: 'Beyond the initial use case, which sectors have the same pain point?',
  },
  functions: {
    description: 'Which business functions could adopt this solution?',
    example: '"Operations, Sales, HR — any function with knowledge-intensive processes."',
    question: 'Which departments face similar challenges?',
  },
  regions: {
    description: 'What geographic reach does this solution support?',
    example: '"Regional initially (North America), with potential for Global rollout."',
    question: 'Are there language, compliance, or infrastructure barriers to scaling geographically?',
  },
  // Differentiation tooltips
  currentAlternatives: {
    description: 'What are people using today to address this problem (including manual workarounds)?',
    example: '"Spreadsheet-based trackers, shared wikis, tribal knowledge, and ad-hoc Slack questions."',
    question: 'What would users fall back on if your solution did not exist?',
  },
  existingCompetitors: {
    description: 'Name direct competitors or similar products in the market.',
    example: '"Guru, Shelf.io, Coveo — knowledge management platforms with some AI capabilities."',
    question: 'Who else is trying to solve this, and how well are they doing?',
  },
  whatMakesUnique: {
    description: 'Your unique differentiator — the reason customers would choose you over alternatives.',
    example: '"Real-time contextual suggestions during live calls, not just search — plus integration with our proprietary CX data lake."',
    question: 'What can you do that no one else can (or does) today?',
  },
  // Business Impact tooltips
  estimatedUsers: {
    description: 'The total number of people who would use this solution regularly.',
    example: '"2,500 agents across 4 delivery centers"',
    question: 'How many people interact with this process daily?',
  },
  hoursSavedPerUser: {
    description: 'How many hours per week each user currently spends on the process this solution improves.',
    example: '"8 hours/week spent on manual knowledge search and documentation"',
    question: 'If you timed users today, how much effort goes into this task?',
  },
  costSavings: {
    description: 'Detail the areas where costs would be reduced and provide rough estimates.',
    example: '"Eliminate 3 FTEs in manual reporting ($180K), reduce training time by 50% ($95K/year)"',
    question: 'What spend lines on the P&L would shrink?',
  },
  revenuePotential: {
    description: 'Describe how this solution could generate new revenue or grow existing streams.',
    example: '"License to 3 external clients at $200K/year each; enable cross-sell recommendations worth $500K/year"',
    question: 'Could this be sold, licensed, or used to win more business?',
  },
  // Feasibility tooltips
  technical: {
    description: 'How technically feasible is this solution given current infrastructure and capabilities?',
    example: '"High: We have the cloud infra and API layers; Low: Requires a technology we have no experience with."',
    question: 'Do we have the tech stack and expertise to build this?',
  },
  dataAvailability: {
    description: 'Is the data needed for this solution accessible, clean, and sufficient?',
    example: '"High: 3 years of interaction transcripts in our data lake; Low: Data is siloed across legacy systems."',
    question: 'Can we access the data we need, and is it usable?',
  },
  resourceAvailability: {
    description: 'Do we have the people, skills, and bandwidth to execute this?',
    example: '"Medium: Core team available but need 2 additional ML engineers for 6 months."',
    question: 'Who would build this, and are they available?',
  },
  security: {
    description: 'What security requirements or concerns does this solution raise?',
    example: '"High: Handles PII data, needs SOC 2 compliance and encryption at rest."',
    question: 'Does this touch sensitive data or require special security measures?',
  },
  compliance: {
    description: 'Are there regulatory or compliance requirements that add complexity?',
    example: '"Must comply with GDPR for EU data, HIPAA for healthcare clients."',
    question: 'What regulations or policies could slow this down?',
  },
  implementation: {
    description: 'How complex is the implementation — integrations, migration, change management?',
    example: '"Medium: Requires API integration with 3 systems and a 4-week pilot phase."',
    question: 'How many moving parts are involved in getting this live?',
  },
  anticipatedRoadblockers: {
    description: 'What obstacles or blockers could delay or derail this initiative?',
    example: '"Legacy system migration timeline, data privacy legal review, competing priorities from leadership."',
    question: 'What kept similar initiatives from succeeding in the past?',
  },
  // Adoption tooltips
  easeOfUse: {
    description: 'How intuitive and easy to use is the solution for the target users?',
    example: '"High: Simple browser extension; Low: Complex dashboard requiring 2 days of training."',
    question: 'Could a new user figure this out in under 5 minutes?',
  },
  trainingReqs: {
    description: 'How much training and onboarding effort is required for users to adopt this?',
    example: '"Low: Self-serve video tutorials; High: Mandatory 3-day instructor-led training."',
    question: 'What would the onboarding program look like?',
  },
  execSponsorship: {
    description: 'How strong is executive buy-in and sponsorship for this initiative?',
    example: '"High: COO has championed this in 2 board meetings; Low: No senior sponsor identified yet."',
    question: 'Is there a senior leader who will champion this publicly?',
  },
  userDemand: {
    description: 'How much demand or pull exists from end-users for this solution?',
    example: '"High: Top request in last 3 employee surveys; Low: Users are unaware of the problem."',
    question: 'Are users actively asking for a solution, or do we need to create awareness?',
  },
  // Build vs Partner tooltips
  decision: {
    description: 'Choose whether to build from scratch, or extend an existing solution.',
    example: '"Build: No existing solution fits; Extend DIS Solution: Leverage existing platform capabilities."',
    question: 'What gives us the best balance of speed, cost, and control?',
  },
  decisionJustification: {
    description: 'Explain the reasoning behind your build/extend decision.',
    example: '"Building in-house gives us full IP ownership and avoids per-seat licensing costs that would make the unit economics unfavorable at scale."',
    question: 'What is the strongest argument for this approach over the alternatives?',
  },
  decisionTechConsiderations: {
    description: 'Other technical, legal, or strategic factors influencing the decision.',
    example: '"Need to ensure compatibility with existing SSO, consider API rate limits, evaluate long-term maintenance costs."',
    question: 'What else should decision-makers know before committing?',
  },
  // Risks tooltips
  technicalRisks: {
    description: 'Technology risks that could impact delivery — scalability, integration failures, tech debt.',
    example: '"API dependency on third-party vendor, model accuracy below threshold, latency at scale"',
    question: 'What could go wrong technically?',
  },
  operationalRisks: {
    description: 'Risks related to processes, people, or day-to-day operations.',
    example: '"Key developer leaving mid-project, insufficient QA resources, scope creep from stakeholders"',
    question: 'What operational challenges could derail execution?',
  },
  // Success Metrics tooltips
  kpis: {
    description: 'Key Performance Indicators that will measure the success of this initiative.',
    example: '"Average Handle Time reduction, First Call Resolution rate, Agent NPS, Time-to-Proficiency"',
    question: 'How will we know this is working 6 months after launch?',
  },
  revenueTargets: {
    description: 'Specific, measurable targets with timelines for the metrics defined above.',
    example: '"AHT reduced by 25% within Q2, FCR above 90% by Q3, 80% agent adoption in 60 days"',
    question: 'What numbers would make leadership call this a success?',
  },
};
