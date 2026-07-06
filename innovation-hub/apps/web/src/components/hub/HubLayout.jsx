import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Settings, LogOut, Moon, Sun, Bell, Sparkles, Send, X, ChevronDown, LayoutGrid, Map, MessageSquare, Lightbulb, CheckSquare, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useCatalogStore } from '../../store/useCatalogStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { api } from '../../api';
import Logo from './Logo';
import BrandShapes from '../ui/BrandShapes';

const ROLE_LABEL = { viewer: 'Viewer', product_owner: 'Product Owner', committee: 'Committee', admin: 'Admin' };

// Navigation defined inline below in grouped categories

const linkStyle = (isActive) => ({
  padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--text-secondary)',
  background: isActive ? 'var(--primary)' : 'transparent',
});

const DISCOVER_ITEMS = [
  { to: '/catalog', label: 'Catalog', desc: 'Browse and search available tools', icon: LayoutGrid },
  { to: '/roadmap', label: 'Products Roadmap', desc: 'See what is planned and upcoming', icon: Map },
  { to: '/voice', label: 'Voice of Clients', desc: 'Review client feedback and feature requests', icon: MessageSquare }
];

const BUILD_ITEMS = [
  { to: '/ideas', label: 'Idea Pipeline', desc: 'Scope, evaluate, and design new ideas', icon: Lightbulb }
];

const MANAGE_ITEMS = [
  { to: '/manage', label: 'My Workspace', desc: 'Manage your submitted ideas and tools', icon: LayoutGrid },
  { to: '/review', label: 'Review', desc: 'Review submitted ideas and tools', icon: CheckSquare, roles: ['committee', 'admin'] },
  { to: '/admin', label: 'Admin', desc: 'Manage users, settings, and taxonomies', icon: Shield, roles: ['admin'] }
];

function NavDropdown({ title, items, userRole }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  
  const visibleItems = items.filter(item => !item.roles || item.roles.includes(userRole));
  if (visibleItems.length === 0) return null;

  const isActive = visibleItems.some(item => location.pathname.startsWith(item.to));

  return (
    <div 
      style={{ position: 'relative' }} 
      onMouseEnter={() => setOpen(true)} 
      onMouseLeave={() => setOpen(false)}
    >
      <button style={{
        display: 'flex', alignItems: 'center', gap: 4, 
        background: isActive ? 'var(--primary)' : (open ? 'var(--bg-main)' : 'transparent'), 
        border: 'none', 
        fontSize: 14, fontWeight: 600, 
        color: isActive ? '#fff' : 'var(--text-primary)', 
        cursor: 'pointer', padding: '8px 14px', borderRadius: 999,
        transition: 'all 0.2s'
      }}>
        {title}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: isActive ? '#fff' : 'var(--text-muted)' }} />
      </button>
      
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 4, zIndex: 50 }}>
          <div style={{
            background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', 
            borderRadius: 12, padding: 12, width: 320, display: 'flex', flexDirection: 'column', gap: 4,
            boxShadow: 'var(--shadow-lg)'
          }}>
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink 
                key={item.to} 
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 8,
                  textDecoration: 'none', transition: 'all 0.2s',
                  background: isActive ? 'var(--secondary)' : 'transparent',
                })}
                onMouseOver={(e) => {
                  if (e.currentTarget.style.background === 'transparent') {
                    e.currentTarget.style.background = 'var(--bg-main)';
                  }
                }}
                onMouseOut={(e) => {
                  if (e.currentTarget.style.background === 'var(--bg-main)') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  width: 36, height: 36, borderRadius: 8, 
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)', flexShrink: 0
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{item.desc}</span>
                </div>
              </NavLink>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

export function UserDropdown({ user, logout, setThemeMode, theme }) {
  const [open, setOpen] = useState(false);
  const ROLE_LABEL = {
    'admin': 'Hub Administrator',
    'product_owner': 'Product Owner',
    'employee': 'Employee'
  };

  if (!user) return null;

  const ThemeButton = ({ modeId, label, Icon }) => {
    const isActive = theme === modeId;
    return (
      <button 
        onClick={() => setThemeMode(modeId)}
        style={{
          display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
          border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, transition: 'all 0.2s', width: '100%', textAlign: 'left',
          color: isActive ? 'var(--primary)' : 'var(--text-primary)',
          background: isActive ? 'var(--secondary)' : 'transparent'
        }}
        onMouseOver={(e) => {
          if (!isActive) e.currentTarget.style.background = 'var(--bg-main)';
        }}
        onMouseOut={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <Icon size={16} /> {label}
      </button>
    );
  };

  return (
    <div 
      style={{ position: 'relative' }} 
      onMouseEnter={() => setOpen(true)} 
      onMouseLeave={() => setOpen(false)}
    >
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', borderRadius: 999,
        cursor: 'pointer', background: open ? 'var(--bg-main)' : 'transparent', transition: 'background 0.2s', border: '1px solid var(--border-color)',
      }}>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABEL[user.role] || user.role}</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>
          {user.name.charAt(0)}
        </div>
      </div>
      
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 4, zIndex: 50 }}>
          <div style={{
            background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', 
            borderRadius: 12, padding: 8, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <NavLink 
              to="/settings" 
              style={({ isActive }) => ({
                display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
                textDecoration: 'none', transition: 'all 0.2s', fontSize: 13, fontWeight: 600,
                color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                background: isActive ? 'var(--secondary)' : 'transparent'
              })}
              onMouseOver={(e) => {
                if (e.currentTarget.style.background === 'transparent') e.currentTarget.style.background = 'var(--bg-main)';
              }}
              onMouseOut={(e) => {
                if (e.currentTarget.style.background === 'var(--bg-main)') e.currentTarget.style.background = 'transparent';
              }}
            >
              <Settings size={16} /> Account Settings
            </NavLink>

            <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
            
            <ThemeButton modeId="light" label="Standard Light" Icon={Sun} />
            <ThemeButton modeId="light-glass" label="Light Glassmorphism" Icon={Sun} />
            <ThemeButton modeId="dark" label="Dark Mode" Icon={Moon} />
            
            <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
            <button 
              onClick={logout}
              style={{
                display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--danger)', transition: 'background 0.2s', width: '100%', textAlign: 'left'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(204, 50, 98, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Top-level hub shell. The product is the hub; Catalog is the main view and the
// scoping canvas lives under Idea Pipeline as one module.
export default function HubLayout({ children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const isFixedPage = ['/chat', '/ideas'].includes(location.pathname);
  const logout = useAuthStore((s) => s.logout);
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') || 'light'));
  const setThemeMode = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('hub_theme', mode);
    setTheme(mode);
  };
  const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="glass" style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)', background: 'var(--bg-header, var(--bg-card, #fff))', flexShrink: 0, zIndex: 5,
      }}>
        <Logo />
        <nav style={{ display: 'flex', gap: 8, marginLeft: 24, alignItems: 'center' }}>
          <NavDropdown title="Discover" items={DISCOVER_ITEMS} userRole={user?.role} />
          <NavDropdown title="Build" items={BUILD_ITEMS} userRole={user?.role} />
          <NavDropdown title="Manage" items={MANAGE_ITEMS} userRole={user?.role} />
          <NavLink 
            to="/chat" 
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6, 
              background: isActive ? 'var(--primary)' : 'transparent', 
              border: 'none', 
              fontSize: 14, fontWeight: 600, 
              color: isActive ? '#fff' : 'var(--text-primary)', 
              cursor: 'pointer', padding: '8px 14px', borderRadius: 999,
              transition: 'all 0.2s',
              textDecoration: 'none'
            })}
            onMouseOver={(e) => {
              const isActive = location.pathname.startsWith('/chat');
              if (!isActive) e.currentTarget.style.background = 'var(--bg-main)';
            }}
            onMouseOut={(e) => {
              const isActive = location.pathname.startsWith('/chat');
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Sparkles size={14} style={{ color: location.pathname.startsWith('/chat') ? '#fff' : 'var(--primary-text)' }} />
            AI Matchmaker
          </NavLink>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {['product_owner', 'admin'].includes(user?.role) && (
            <NavLink to="/inbox" title="Requests inbox" style={({ isActive }) => ({ ...iconBtn, ...(isActive ? { borderColor: 'var(--primary)', color: 'var(--primary-text)' } : {}) })}><Bell size={16} /></NavLink>
          )}
          
          <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 4px' }} />
          
          <UserDropdown user={user} logout={logout} setThemeMode={setThemeMode} theme={theme} />
        </div>
      </header>
      <div className="scrollable-content" style={{ flex: 1, overflow: isFixedPage ? 'hidden' : 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <BrandShapes variant="catalog" />
        {children}
      </div>
      {location.pathname !== '/ideas' && <AICopilotChat />}
    </div>
  );
}


export function AICopilotChat({ inline = false }) {
  const [open, setOpen] = useState(inline ? true : false);
  const [dismissTooltip, setDismissTooltip] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your AI Copilot. Ask me anything about our tools, future feature roadmaps, or integration steps!' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const location = useLocation();
  const isOnIdeaPage = location.pathname === '/ideas';
  const isToolOpen = useCatalogStore((s) => s.isToolFormOpen);
  const toolFormDraft = useCatalogStore((s) => s.toolFormDraft);
  const setToolFormDraft = useCatalogStore((s) => s.setToolFormDraft);
  
  const updateField = useCanvasStore((s) => s.updateField);
  const updateNestedField = useCanvasStore((s) => s.updateNestedField);
  const canvas = useCanvasStore((s) => s.canvas);

  const [assistEnabled, setAssistEnabled] = useState(true);
  const { tools, load } = useCatalogStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Seed form assist message when entering form pages
  useEffect(() => {
    if (open && (isOnIdeaPage || isToolOpen) && assistEnabled) {
      setMessages((prev) => {
        // Only append helper if the last message is not already the assist helper to avoid duplication
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.text.includes('Scoping Assist Active')) return prev;
        return [
          ...prev,
          {
            role: 'assistant',
            text: `🪄 **Form Scoping Assist is Active!**\n\nExplain your ${isOnIdeaPage ? 'idea' : 'tool'} in plain English (e.g. "it automates reporting for marketing managers in AMER, saving them 5 hours a week"), and I will parse it to auto-populate all the form fields directly.`
          }
        ];
      });
    }
  }, [open, isOnIdeaPage, isToolOpen, assistEnabled]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput('');
    if (chatInputRef.current) chatInputRef.current.style.height = '36px';
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setBusy(true);

    const isAutofill = assistEnabled && (isOnIdeaPage || isToolOpen);

    if (isAutofill) {
      const prompt = isOnIdeaPage ? `You are the AI Scoping Assistant for the Analytics Opportunity Canvas.
The user wants to autofill their idea canvas based on the following description:
"${userMsg}"

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
Note for strategicAlignment: values must be integers between 0 and 2 (0=None, 1=Potential, 2=Definite).` : `You are the AI Submission Assistant for the Tool Catalog.
The user wants to autofill the tool submission form based on the following description:
"${userMsg}"

Analyze the description and output a valid JSON object matching the schema below.
Output ONLY the raw JSON object. Do not include markdown code block formatting (no \`\`\`json).

JSON Schema to return:
{
  "name": "Title of the tool",
  "owner": "Team or person who owns it",
  "category": "e.g., Analytics, Visualization, CX, Process",
  "status": "pilot",
  "implementation_status": "implemented",
  "impact": "e.g., Saved 10 hrs/mo or Reduced reporting time",
  "roi": 50000,
  "problem": "Detailed problem statement",
  "capabilities": "Capabilities/features, listed on separate lines",
  "delivers": "What does the tool deliver to the user?",
  "benefits": "Key benefits",
  "tags": "comma, separated, tags",
  "account": "Client account name (if any, e.g., Concentrix, Google)"
}`;

      let resText = '';
      try {
        const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
        resText = res.text || '';
        
        // Extract JSON string between first '{' and last '}'
        let cleaned = resText;
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleaned = cleaned.substring(startIdx, endIdx + 1);
        } else {
          cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const data = JSON.parse(cleaned);

        if (isOnIdeaPage) {
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
            text: `✨ **Idea Scoping Canvas Populated!**\n\nI parsed your description and filled in the fields including **Value Propositions**, **Key Activities**, and **Business Impact** values on the canvas board behind this drawer. Please review and make any manual adjustments before saving.`
          }]);
        } else {
          setToolFormDraft(data);
          setMessages((prev) => [...prev, {
            role: 'assistant',
            text: `✨ **Tool Submission Form Populated!**\n\nI parsed your description and filled in the fields including **Name**, **Owner**, **Problem**, and **ROI** estimates. Please close this drawer to inspect the form and submit your tool.`
          }]);
        }
      } catch (err) {
        console.error('Autofill parsing error:', err);
        setMessages((prev) => [...prev, {
          role: 'assistant',
          text: `I understood your description, but had trouble auto-filling the form fields directly (Error: ${err.message}). Here is the raw AI response:\n\n${resText || 'No response generated.'}`
        }]);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Build rich tools context including timeline roadmap milestones
    const toolsContext = tools.map((t) => {
      const roadmapText = (t.timeline || [])
        .map((m) => `  - [${m.date}] ${m.comment} (Status: ${m.status}${m.roadblock ? ', Roadblock: true' : ''})`)
        .join('\n');
      return `- **${t.name}**:
  Category: ${t.category}
  Status: ${t.status}
  Owner: ${t.owner}
  Client Account: ${t.account || 'None'}
  Problem Solved: ${t.problem}
  Planned Roadmap Milestones:
${roadmapText || '  (No milestones defined)'}`;
    }).join('\n\n');

    const historyStr = messages.slice(-8)
      .map((m) => `${m.role === 'user' ? 'User' : 'Copilot'}: ${m.text}`)
      .join('\n');

    let draftContext = '';
    if (isOnIdeaPage) {
      draftContext = `\nThe user is currently scoping an idea on the Opportunity Canvas board. Here is their current draft state:
${JSON.stringify(canvas, null, 2)}`;
    } else if (isToolOpen) {
      draftContext = `\nThe user is currently filling out a tool submission form. Here is their current draft form:
${JSON.stringify(toolFormDraft, null, 2)}`;
    }

    const prompt = `You are a helpful AI Copilot for the Analytics Transformation Hub.
Here is the catalog of all existing tools, including their implementation details and planned future roadmaps:

${toolsContext}
${draftContext}

Answer the user's question accurately. If they ask about how to improve their current idea or what is missing from their form/canvas to make it a strong innovation opportunity, analyze their current draft state (above) against the rest of the tools catalog. Keep answers concise, direct, and formatted in Markdown. Use bullet points where appropriate.

Conversation History:
${historyStr}

User: ${userMsg}
Copilot:`;

    try {
      const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.text }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Sorry, I encountered an error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const showBanner = !open && (isOnIdeaPage || isToolOpen);
  if (isToolOpen && !inline) return null;

  return (
    <>
      {/* Intro Tooltip (only show if not inline and not open) */}
      {!inline && !open && !dismissTooltip && !location.pathname.startsWith('/tools/') && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 999,
          background: 'var(--bg-card-solid)', border: '1.5px solid var(--primary)',
          borderRadius: 12, padding: '10px 14px', width: 240,
          boxShadow: '0 8px 30px rgba(0,115,127,0.15)',
          animation: 'bounceBubble 3s ease-in-out infinite'
        }}>
          <button 
            onClick={() => setDismissTooltip(true)} 
            style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={12} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11, color: 'var(--primary-text)', paddingRight: 12 }}>
            <Sparkles size={12} />
            Need help finding the right tool for your client?
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3, marginTop: 4 }}>
            Tell the AI Matchmaker about your client's needs in plain English and let it find the perfect match!
          </div>
          <div style={{
            position: 'absolute', bottom: -7, right: 20, width: 12, height: 12,
            background: 'var(--bg-card-solid)', borderRight: '1.5px solid var(--primary)',
            borderBottom: '1.5px solid var(--primary)', transform: 'rotate(45deg)'
          }} />
        </div>
      )}

      {/* Floating Sparkles Button */}
      {!inline && (
        <button 
          onClick={() => setOpen(!open)}
          title="AI Matchmaker"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 54, height: 54, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--accent, #6d28d9))',
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', boxShadow: '0 4px 18px rgba(0,115,127,0.35)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: open ? 'rotate(90deg) scale(0.9)' : 'scale(1)',
          }}
          onMouseOver={(e) => { if (!open) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseOut={(e) => { if (!open) e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {open ? <X size={22} /> : <Sparkles size={22} />}
        </button>
      )}

      {/* Chat Container */}
      {(open || inline) && (
        <div className={inline ? '' : "glass"} style={inline ? {
          flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden'
        } : {
          position: 'fixed', bottom: 90, right: 24, zIndex: 1000,
          width: 380, height: 500, borderRadius: 20,
          border: '1px solid var(--border-color)', background: 'var(--bg-card-solid)',
          boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)'
          }}>
            <Sparkles size={16} style={{ color: 'var(--primary-text)' }} />
            <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>AI Copilot</span>
            <span style={{ fontSize: 10, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>ONLINE</span>
            {!inline && (
              <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', borderRadius: 14, padding: '10px 14px',
                fontSize: 13, lineHeight: 1.5,
                background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-main)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both' }}>●</span>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }}>●</span>
                <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }}>●</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Assist Mode Toggle */}
          {(isOnIdeaPage || isToolOpen) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: 'var(--secondary)', borderTop: '1px solid var(--border-color)',
              fontSize: 11.5, fontWeight: 600, color: 'var(--primary-text)'
            }}>
              <Sparkles size={13} />
              <span>Scoping Assist Active</span>
              <button
                type="button"
                onClick={() => setAssistEnabled(!assistEnabled)}
                style={{
                  marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, border: 'none',
                  background: assistEnabled ? 'var(--primary)' : 'rgba(0,0,0,0.06)',
                  color: assistEnabled ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 10, cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {assistEnabled ? 'ON (AUTO-FILLS)' : 'OFF (JUST CHAT)'}
              </button>
            </div>
          )}

          {/* Input Panel */}
          <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-color)', background: 'rgba(20,20,20,0.02)', alignItems: 'flex-end' }}>
            <textarea 
              ref={chatInputRef}
              value={input} 
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = '36px';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && input.trim()) send(e);
                }
              }}
              placeholder={assistEnabled && (isOnIdeaPage || isToolOpen) ? "Describe your idea/product..." : "Ask about roadmap, features, integration..."} 
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 10, fontSize: 13,
                border: '1px solid var(--border-color)', background: 'var(--bg-main)',
                color: 'var(--text-primary)', resize: 'none', overflowY: 'auto',
                fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, minHeight: 36
              }}
            />
            <button type="button" onClick={(e) => !busy && input.trim() && send(e)} disabled={busy || !input.trim()} style={{
              display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10,
              border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer',
              opacity: (busy || !input.trim()) ? 0.6 : 1, flexShrink: 0, marginBottom: 1
            }}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes bounceBubble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dot {
          display: inline-block;
        }
      `}</style>
    </>
  );
}
