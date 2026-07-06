import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Send } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { api } from '../../api';

// Simple LaTeX translation to unicode/HTML for clean visual rendering:
function renderLatex(text) {
  let formatted = text;
  // Replace block math $$ ... $$
  formatted = formatted.replace(/\$\$(.*?)\$\$/gs, (_, math) => {
    return `<div class="math-block" style="font-family: 'JetBrains Mono', 'Courier New', monospace; background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px; margin: 8px 0; text-align: center; font-style: italic; overflow-x: auto; color: var(--primary-text);">${math}</div>`;
  });
  // Replace inline math $ ... $
  formatted = formatted.replace(/\$(.*?)\$/g, (_, math) => {
    return `<code class="math-inline" style="font-family: 'JetBrains Mono', monospace; font-style: italic; background: rgba(0,0,0,0.08); padding: 2px 4px; border-radius: 4px; color: var(--primary-text);">${math}</code>`;
  });
  
  // Clean up common math symbols for display
  const replacements = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ', '\\omega': 'ω',
    '\\times': '×', '\\div': '÷', '\\pm': '±', '\\infty': '∞', '\\approx': '≈',
    '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\rightarrow': '→', '\\partial': '∂',
    '\\sum': '∑', '\\int': '∫', '\\Delta': 'Δ', '\\mu_0': 'μ₀', '\\sigma^2': 'σ²'
  };
  
  Object.entries(replacements).forEach(([latex, unicode]) => {
    formatted = formatted.replace(new RegExp(latex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), unicode);
  });
  
  return formatted;
}

export function parseMarkdownAndLatex(text, isUser = false) {
  if (!text) return '';
  if (isUser) return <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{text}</p>;
  
  // Format math/LaTeX first
  let html = renderLatex(text);
  
  // Headings
  html = html.replace(/^### (.*?)$/gm, '<h5 style="font-size: 13px; font-weight: 700; margin: 12px 0 6px; color: var(--primary-text);">$1</h5>');
  html = html.replace(/^## (.*?)$/gm, '<h4 style="font-size: 14.5px; font-weight: 700; margin: 16px 0 8px; color: var(--primary-text);">$1</h4>');
  html = html.replace(/^# (.*?)$/gm, '<h3 style="font-size: 16px; font-weight: 800; margin: 20px 0 10px; color: var(--primary-text);">$1</h3>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>');
  
  // Bullet lists
  html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li style="margin-left: 16px; margin-bottom: 4px; list-style-type: disc;">$1</li>');
  
  // Paragraph line breaks (keeping list tags block level)
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('<li') || line.trim().startsWith('<h') || line.trim().startsWith('<div')) {
      return line;
    }
    return line ? `${line}<br />` : '<div style="height: 6px;"></div>';
  }).join('\n');
  
  return <div style={{ lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AiPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const isAiPanelCollapsed = useCanvasStore((s) => s.isAiPanelCollapsed);
  const toggleAiPanelCollapsed = useCanvasStore((s) => s.toggleAiPanelCollapsed);
  const updateField = useCanvasStore((s) => s.updateField);
  const updateNestedField = useCanvasStore((s) => s.updateNestedField);

  const [mode, setMode] = useState('critique'); // 'critique' | 'autofill'

  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hello! I am your AI Scoping Assistant. Ask me to critique your current Storyboard sections, perform a feasibility check, or suggest value proposition improvements." }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || busy) return;

    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setBusy(true);

    try {
      if (mode === 'autofill') {
        const prompt = `You are the AI Scoping Assistant for the Analytics Opportunity Canvas.
The user wants to autofill their idea canvas based on the following description:
"${userText}"

Analyze the description and output a valid JSON object matching the schema below.
Output ONLY the raw JSON object. Do not include markdown code block formatting (no \`\`\`json).

JSON Schema to return:
{
  "name": "Concise, catchy title for the idea",
  "keyPartners": "Key collaborators/departments/vendors needed",
  "keyActivities": "Main tasks/activities required",
  "keyResources": "Critical systems, data, talent, or compute required",
  "customerRelationships": "How user relationships/onboarding/support will work",
  "channels": "Where users will access the tool (e.g., Teams, web browser)",
  "costStructure": "Expected costs (licenses, cloud compute, dev hours)",
  "revenueStreams": "Expected returns or business value streams",
  "problemStatement": "Describe the core business problem/friction",
  "painPoints": "Bullet points of current pain points",
  "vpAudience": "Who this helps (e.g., call agents, financial analysts)",
  "vpOutcome": "What they will achieve (e.g., 20% faster reports)",
  "vpMethod": "How they achieve it (e.g., automated KPI collation)",
  "solutionTypes": ["Select relevant items ONLY from: 'Internal Tool', 'SaaS Product', 'Automation', 'Analytics Platform', 'Consulting Accelerator', 'Process Improvement', 'Knowledge Management Tool', 'Workforce Optimization Tool', 'Other'"],
  "regions": ["Select relevant items ONLY from: 'Local', 'Regional', 'Global'"],
  "industries": ["Select relevant items ONLY from: 'Financial Services', 'Insurance', 'Retail', 'Telecommunications', 'Technology', 'Healthcare', 'Travel', 'Automotive', 'Public Sector', 'Utilities', 'Media', 'Manufacturing', 'Other'"],
  "functions": ["Select relevant items ONLY from: 'Operations', 'Marketing', 'Sales', 'HR', 'IT', 'Analytics', 'Finance', 'Legal', 'Training', 'Quality', 'WFM', 'Leadership', 'Innovation & Transformation', 'Account Management'"],
  "businessImpact": {
    "estimatedUsers": 10,
    "hoursSavedPerUser": 2,
    "costSavings": "Description of savings",
    "revenuePotential": "Description of revenue growth potential"
  },
  "feasibility": {
    "technical": 3,
    "dataAvailability": 3,
    "resourceAvailability": 3,
    "security": 3,
    "compliance": 3,
    "implementation": 3
  },
  "adoption": {
    "easeOfUse": 3,
    "trainingReqs": 3,
    "execSponsorship": 3,
    "userDemand": 3
  },
  "strategicAlignment": {
    "revenueGrowth": 1,
    "costReduction": 1,
    "productivity": 1,
    "clientExperience": 1,
    "employeeExperience": 1,
    "marketExpansion": 1,
    "competitiveAdvantage": 1,
    "innovationLeadership": 1
  }
}
Note for feasibility and adoption: values must be integers between 1 and 5.
Note for strategicAlignment: values must be integers between 0 and 2 (0=None, 1=Potential, 2=Definite).`;

        const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
        let resText = res.text || '';
        let cleaned = resText;
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleaned = cleaned.substring(startIdx, endIdx + 1);
        } else {
          cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const data = JSON.parse(cleaned);

        Object.keys(data).forEach((k) => {
          if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) {
            Object.keys(data[k]).forEach((subKey) => {
              updateNestedField(k, subKey, data[k][subKey]);
            });
          } else {
            updateField(null, k, data[k]);
          }
        });
        setMessages((prev) => [...prev, {
          role: 'assistant',
          text: `✨ **Idea Scoping Canvas Populated!**\n\nI parsed your description and filled in the fields across the canvas. Please review and make any manual adjustments.`
        }]);

      } else {
        const prompt = `You are a senior strategy consultant auditing this scoping Storyboard:
- Name: ${canvas.name || 'Untitled'}
- Problem Statement: ${canvas.problemStatement || 'Not defined'}
- Current Process: ${canvas.currentProcess || 'Not defined'}
- Value Proposition Outcome: ${canvas.vpOutcome || 'Not defined'}
- Key Activities: ${canvas.keyActivities || 'Not defined'}
- Cost Structure: ${canvas.costStructure || 'Not defined'}
- Revenue/Value Streams: ${canvas.revenueStreams || 'Not defined'}

User's request: "${userText}"

Critique their plan and provide constructive suggestions. Be concise and professional.`;

        const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
        setMessages((prev) => [...prev, { role: 'assistant', text: res.text }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Failed to generate response: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const triggerQuickAction = (actionText) => {
    setInput(actionText);
    setTimeout(() => {
      const form = document.getElementById('ai-panel-form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 50);
  };

  if (isAiPanelCollapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 16 }}>
        <button 
          onClick={toggleAiPanelCollapsed} 
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
          title="Expand AI Assistant"
        >
          <ChevronLeft size={20} color="var(--text-muted)" />
          <Sparkles size={20} color="var(--primary)" />
          <div style={{
            writingMode: 'vertical-rl',
            textTransform: 'uppercase',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
            marginTop: 8
          }}>
            AI Assistant
          </div>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color="var(--primary)" /> AI Assistant
        </h3>
        <button onClick={toggleAiPanelCollapsed} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* Context indicator */}
      <div style={{ 
        padding: '6px 10px', 
        background: 'var(--secondary)', 
        border: '1px solid rgba(0,115,127,0.15)', 
        borderRadius: 8, 
        fontSize: '11px', 
        fontWeight: 600, 
        color: 'var(--primary-text)',
        flexShrink: 0
      }}>
        ✨ Context-aware of active Storyboard sections
      </div>

      {/* Chat Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        background: 'var(--bg-main)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 12, 
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0
      }}>
        {messages.map((m, idx) => (
          <div 
            key={idx} 
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              wordBreak: 'break-word'
            }}
          >
            {parseMarkdownAndLatex(m.text, m.role === 'user')}
          </div>
        ))}
        {busy && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
            <span className="dot" style={{ animation: 'bounce 1.4s infinite both' }}>●</span>
            <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }}>●</span>
            <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }}>●</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flexShrink: 0 }}>
        <button
          onClick={() => { setMode('critique'); setInput('Critique my Storyboard structure and highlight potential weak spots.'); }}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)',
            background: mode === 'critique' ? 'var(--primary)' : 'var(--bg-card)', 
            color: mode === 'critique' ? '#fff' : 'var(--text-secondary)', fontSize: '10.5px',
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          Critique Audit
        </button>
        <button
          onClick={() => { setMode('autofill'); setInput('My idea is: '); }}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)',
            background: mode === 'autofill' ? 'var(--primary)' : 'var(--bg-card)', 
            color: mode === 'autofill' ? '#fff' : 'var(--text-secondary)', fontSize: '10.5px',
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          Autofill Canvas
        </button>
      </div>

      {/* Input Form */}
      <form id="ai-panel-form" onSubmit={send} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask AI Scoping Assistant..."
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: '12.5px',
            border: '1px solid var(--border-color)', background: 'var(--bg-main)',
            color: 'var(--text-primary)'
          }}
        />
        <button 
          type="submit" 
          disabled={busy || !input.trim()} 
          style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', opacity: (busy || !input.trim()) ? 0.6 : 1
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
