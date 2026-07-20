import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, MessageSquare, Plus, ArrowRight, User } from 'lucide-react';
import { useCatalogStore } from '../../store/useCatalogStore';
import { api } from '../../api';

const welcomeMsg = {
  sender: 'ai',
  text: "Hello! I'm the Analytics AI Hub Matchmaker. Describe what business problem or pain point you're trying to solve, and I'll search our team's arsenal to suggest the best tool. If we don't have it, I'll guide you to create it!"
};

export default function AIChatView() {
  const { tools, load } = useCatalogStore();
  const [messages, setMessages] = useState([welcomeMsg]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    load();
    api('/chat/messages')
      .then((data) => {
        if (data && data.length > 0) {
          setMessages([welcomeMsg, ...data]);
        }
      })
      .catch((e) => console.error('Failed to load chat history:', e));
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const suggestedQuestions = [
    "I need to automate my monthly performance and KPI reporting.",
    "Is there a tool that helps me analyze process bottlenecks?",
    "How can I build scrollable, storytelling viz dashboards?",
    "I want to track customer sentiment and churn."
  ];

  const handleSend = async (textToSend) => {
    const input = textToSend || query;
    if (!input.trim() || loading) return;

    if (!textToSend) setQuery('');
    setLoading(true);

    try {
      await api('/chat/messages', { method: 'POST', body: { sender: 'user', text: input } });
      setMessages((prev) => [...prev, { sender: 'user', text: input }]);

      const catalogContext = tools.filter(t => t.review_status === 'approved').map((t) => (
        `- Tool ID: ${t.id}\n  Name: ${t.name}\n  Category: ${t.category}\n  Status: ${t.status}\n  Problem: ${t.problem}\n  Capabilities: ${t.capabilities?.join(', ')}\n  Link: /tools/${t.id}`
      )).join('\n\n');

      const historyStr = [...messages, { sender: 'user', text: input }]
        .map(m => `${m.sender === 'user' ? 'User' : 'AI Matchmaker'}: ${m.text}`)
        .join('\n');

      let sysInstruction = "";
      try {
        const sysRes = await api('/ai/system-prompt/prompt_matchmaker');
        sysInstruction = sysRes?.prompt || "";
      } catch (e) {}

      const prompt = `${sysInstruction || "You are the Analytics AI Hub Matchmaker. Your job is to match the user's business pain point or problem statement with the best existing solutions in our catalog."}

Here is the catalog of existing tools:
${catalogContext}

Conversation history:
${historyStr}
User: ${input}
AI Matchmaker:`;

      const res = await api('/ai/generate', { method: 'POST', body: { prompt } });
      const aiResponse = res?.text || "I apologize, I could not process that request. Please try again.";

      await api('/chat/messages', { method: 'POST', body: { sender: 'ai', text: aiResponse } });
      setMessages((prev) => [...prev, { sender: 'ai', text: aiResponse }]);
    } catch (err) {
      console.error('Matchmaker error:', err);
      setMessages((prev) => [...prev, { 
        sender: 'ai', 
        text: `Error: ${err.message}` 
      }]);
    } finally {
      setLoading(false);
      try {
        const { useAuthStore } = await import('../../store/useAuthStore');
        useAuthStore.getState().reloadUser();
      } catch (reloadErr) {}
    }
  };

  const parseMarkdown = (text) => {
    if (!text) return '';
    
    const renderFormatting = (str) => {
      const parts = [];
      let lastIdx = 0;
      // Match bold **, italic *, or inline math $
      const fmtRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\$([^$]+)\$)/g;
      let fmtMatch;
      while ((fmtMatch = fmtRegex.exec(str)) !== null) {
        if (fmtMatch.index > lastIdx) {
          parts.push(str.substring(lastIdx, fmtMatch.index));
        }
        if (fmtMatch[2]) {
          parts.push(<strong key={fmtMatch.index} style={{ fontWeight: 700 }}>{fmtMatch[2]}</strong>);
        } else if (fmtMatch[3]) {
          parts.push(<em key={fmtMatch.index} style={{ fontStyle: 'italic' }}>{fmtMatch[3]}</em>);
        } else if (fmtMatch[4]) {
          // Replace common latex symbols with nice unicode
          let math = fmtMatch[4];
          const replacements = {
            '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ',
            '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ', '\\omega': 'ω',
            '\\times': '×', '\\div': '÷', '\\pm': '±', '\\infty': '∞', '\\approx': '≈',
            '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\rightarrow': '→', '\\partial': '∂',
            '\\sum': '∑', '\\int': '∫', '\\Delta': 'Δ', '\\mu_0': 'μ₀', '\\sigma^2': 'σ²'
          };
          Object.entries(replacements).forEach(([latex, unicode]) => {
            math = math.replace(new RegExp(latex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), unicode);
          });
          parts.push(
            <code key={fmtMatch.index} className="math-inline" style={{ fontFamily: 'JetBrains Mono, monospace', fontStyle: 'italic', background: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 4, color: 'var(--primary-text)' }}>
              {math}
            </code>
          );
        }
        lastIdx = fmtRegex.lastIndex;
      }
      if (lastIdx < str.length) {
        parts.push(str.substring(lastIdx));
      }
      return parts.length > 0 ? parts : str;
    };

    // First handle block math $$
    const blockMathParts = [];
    let lastBlockIdx = 0;
    const blockRegex = /\$\$(.*?)\$\$/gs;
    let blockMatch;
    
    // Split the entire text by $$ block math to render them as standalone blocks
    while ((blockMatch = blockRegex.exec(text)) !== null) {
      if (blockMatch.index > lastBlockIdx) {
        blockMathParts.push({ type: 'text', content: text.substring(lastBlockIdx, blockMatch.index) });
      }
      let math = blockMatch[1];
      const replacements = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ',
        '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ', '\\omega': 'ω',
        '\\times': '×', '\\div': '÷', '\\pm': '±', '\\infty': '∞', '\\approx': '≈',
        '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\rightarrow': '→', '\\partial': '∂',
        '\\sum': '∑', '\\int': '∫', '\\Delta': 'Δ', '\\mu_0': 'μ₀', '\\sigma^2': 'σ²'
      };
      Object.entries(replacements).forEach(([latex, unicode]) => {
        math = math.replace(new RegExp(latex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), unicode);
      });
      blockMathParts.push({ type: 'math-block', content: math });
      lastBlockIdx = blockRegex.lastIndex;
    }
    
    if (lastBlockIdx < text.length) {
      blockMathParts.push({ type: 'text', content: text.substring(lastBlockIdx) });
    }

    return blockMathParts.map((section, secIdx) => {
      if (section.type === 'math-block') {
        return (
          <div key={secIdx} className="math-block" style={{ fontFamily: 'JetBrains Mono, Courier New, monospace', background: 'rgba(0,0,0,0.12)', padding: 10, borderRadius: 8, margin: '12px 0', textAlign: 'center', fontStyle: 'italic', overflowX: 'auto', color: 'var(--primary-text)' }}>
            {section.content}
          </div>
        );
      }
      
      const paragraphs = section.content.split('\n\n');
      return paragraphs.map((para, paraIdx) => {
        const parts = [];
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(para)) !== null) {
          const textBefore = para.substring(lastIndex, match.index);
          if (textBefore) {
            parts.push(renderFormatting(textBefore));
          }
          const label = match[1];
          const to = match[2];
          parts.push(
            <Link 
              key={match.index} 
              to={to} 
              style={{ 
                color: 'var(--accent)', 
                fontWeight: 700, 
                textDecoration: 'underline',
                background: 'rgba(37,226,204,0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'all 0.15s'
              }}
            >
              {label}
            </Link>
          );
          lastIndex = regex.lastIndex;
        }

        const textAfter = para.substring(lastIndex);
        if (textAfter) {
          parts.push(renderFormatting(textAfter));
        }

        return (
          <p key={`${secIdx}-${paraIdx}`} style={{ marginBottom: '12px', lineHeight: 1.6 }}>
            {parts.length > 0 ? parts : renderFormatting(para)}
          </p>
        );
      });
    });
  };


  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', minHeight: 0, overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Left sidebar: instructions & tips */}
      <aside style={{ 
        borderRight: '1px solid var(--border-color)', 
        background: 'var(--bg-card)', 
        padding: '24px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: 'var(--primary-text)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>AI Matchmaker</h2>
          </div>
          <button
            onClick={async () => {
              if (window.confirm('Clear all chat history from your account?')) {
                await api('/chat/messages', { method: 'DELETE' });
                setMessages([
                  { sender: 'ai', text: "Hello! I'm the Analytics AI Hub Matchmaker. Describe what business problem or pain point you're trying to solve, and I'll search our team's arsenal to suggest the best tool. If we don't have it, I'll guide you to create it!" }
                ]);
              }
            }}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
              fontWeight: 600, transition: 'all 0.15s', alignSelf: 'flex-start'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--danger)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            Clear History
          </button>
        </div>
        
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Our catalog contains tools designed to automate reporting, identify process bottlenecks, visual storytelling, and more. Describe your operational challenge, and I will recommend what we have.
        </p>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.05em', fontWeight: 700, marginBottom: '12px' }}>
            Suggested Queries
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                style={{
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '16px', background: 'var(--secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary-text)', marginBottom: '4px' }}>
            No match found?
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 10px' }}>
            If no tools exist for your workflow, you can pitch and scope it yourself.
          </p>
          <Link 
            to="/ideas" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              fontWeight: 700, 
              color: 'var(--primary-text)' 
            }}
          >
            Open Scoping Board <ArrowRight size={12} />
          </Link>
        </div>
      </aside>

      {/* Main chat window */}
      <main style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Chat Thread */}
        <div style={{ 
          flex: 1, 
          padding: '24px 32px', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px'
        }}>
          {messages.map((m, idx) => {
            const isAI = m.sender === 'ai';
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  maxWidth: '780px',
                  alignSelf: isAI ? 'flex-start' : 'flex-end',
                  flexDirection: isAI ? 'row' : 'row-reverse'
                }}
              >
                {/* Avatar Icon */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isAI ? 'var(--secondary)' : 'var(--primary)',
                  color: isAI ? 'var(--primary)' : '#fff',
                  border: isAI ? '1px solid var(--border-color)' : 'none',
                  flexShrink: 0
                }}>
                  {isAI ? <MessageSquare size={16} /> : <User size={16} />}
                </div>

                {/* Message Bubble */}
                <div style={{
                  background: isAI ? 'var(--bg-card)' : 'var(--primary)',
                  color: isAI ? 'var(--text-primary)' : '#fff',
                  padding: '16px 20px',
                  borderRadius: isAI ? '0 16px 16px 16px' : '16px 0 16px 16px',
                  border: isAI ? '1px solid var(--border-color)' : 'none',
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: '14.5px',
                  lineHeight: 1.6
                }}>
                  {isAI ? parseMarkdown(m.text) : <p style={{ whiteSpace: 'pre-wrap', margin: 0, color: '#fff' }}>{m.text}</p>}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--secondary)', color: 'var(--primary-text)',
                border: '1px solid var(--border-color)', flexShrink: 0
              }}>
                <MessageSquare size={16} />
              </div>
              <div style={{
                background: 'var(--bg-card)',
                padding: '16px 20px',
                borderRadius: '0 16px 16px 16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', animation: 'bounce 1.4s infinite ease-in-out both' }}></div>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Input Bar */}
        <footer style={{ 
          padding: '24px 32px', 
          borderTop: '1px solid var(--border-color)', 
          background: 'var(--bg-card)'
        }}>
          <div style={{ position: 'relative', maxWidth: '780px', margin: '0 auto' }}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your workflow pain point... (e.g., 'we waste hours on data cleaning')"
              style={{
                width: '100%',
                padding: '14px 50px 14px 18px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                fontSize: '14px',
                lineHeight: 1.5,
                resize: 'none',
                minHeight: '48px',
                maxHeight: '120px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!query.trim() || loading}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: query.trim() ? 'var(--primary)' : 'transparent',
                color: query.trim() ? '#fff' : 'var(--text-muted)',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: query.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={15} />
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Matchmaker will analyze the catalog to find similarities. Generates answers using your configured AI key.
          </div>
        </footer>
      </main>

      {/* Bounce animation keyframes inject */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
}
