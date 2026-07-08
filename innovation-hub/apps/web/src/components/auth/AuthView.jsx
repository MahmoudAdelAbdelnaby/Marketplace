import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../api';
import Logo from '../hub/Logo';

export default function AuthView() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const [inviteToken, setInviteToken] = useState('');
  const [isEmailLocked, setIsEmailLocked] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [waitlistMsg, setWaitlistMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    if (tok) {
      setInviteToken(tok);
      setMode('register');
      setError('');
      setBusy(true);
      api(`/auth/invites/validate?token=${tok}`)
        .then((res) => {
          setForm((prev) => ({ ...prev, email: res.email }));
          setIsEmailLocked(true);
        })
        .catch((e) => {
          setError('This invitation link is invalid, expired, or has already been used.');
        })
        .finally(() => {
          setBusy(false);
        });
    }
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pwRules = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    digit: /\d/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); 

    if (mode === 'register') {
      const email = form.email.toLowerCase().trim();
      if (!email.endsWith('@concentrix.com')) {
        setError('Registration is restricted to @concentrix.com email addresses.');
        return;
      }
      if (!pwRules.length || !pwRules.upper || !pwRules.lower || !pwRules.digit || !pwRules.special) {
        setError('Password does not meet all complexity requirements.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        const payload = { ...form };
        if (inviteToken) payload.token = inviteToken;
        
        const res = await register(payload);
        if (res && res.waiting) {
          setIsWaitlisted(true);
          setWaitlistMsg(res.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = { width: '100%', padding: '11px 13px', fontSize: 14, marginTop: 6, borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' };

  if (isWaitlisted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-main)' }}>
        <div style={{ width: 'min(460px, 100%)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 18, padding: 32, textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⏳</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)' }}>Added to Waitlist</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 24px' }}>
            {waitlistMsg || "Thank you for your interest! Your account has been added to the waitlist pending administrator approval."}
          </p>
          <button 
            onClick={() => {
              setIsWaitlisted(false);
              setMode('login');
              setForm({ email: '', password: '', name: '', role: 'viewer' });
              window.history.replaceState({}, document.title, window.location.pathname);
            }} 
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-main)' }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={36} />
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 18, padding: 28, boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--secondary)', borderRadius: 999, padding: 4, marginBottom: 22 }}>
            {['login', 'register'].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} type="button"
                style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
                  background: mode === m ? 'var(--bg-card)' : 'transparent', color: mode === m ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none' }}>
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Name</label>
                <input style={field} value={form.name} onChange={set('name')} placeholder="Your name" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>{mode === 'login' ? 'Email or username' : 'Email'}</label>
              <input style={field} type={mode === 'login' ? 'text' : 'email'} required value={form.email} onChange={set('email')} readOnly={isEmailLocked} placeholder={mode === 'login' ? 'you@concentrix.com or admin' : 'you@concentrix.com'} />
            </div>
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Password</label>
              <input 
                style={field} 
                type="password" 
                required 
                value={form.password} 
                onChange={set('password')} 
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                placeholder="••••••••" 
              />
              
              {mode === 'register' && showTooltip && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card-solid)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 99,
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    Password Security Rules:
                  </div>
                  {[
                    { label: 'At least 8 characters', met: pwRules.length },
                    { label: 'One uppercase letter (A-Z)', met: pwRules.upper },
                    { label: 'One lowercase letter (a-z)', met: pwRules.lower },
                    { label: 'One number (0-9)', met: pwRules.digit },
                    { label: 'One special character (!@#$...)', met: pwRules.special }
                  ].map((rule, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        fontSize: 12, 
                        fontWeight: 600,
                        color: rule.met ? 'var(--success)' : 'var(--text-secondary)',
                        transition: 'color 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: rule.met ? 'rgba(37,226,204,0.15)' : 'rgba(0,0,0,0.05)', color: rule.met ? 'var(--success)' : 'var(--text-muted)' }}>
                        {rule.met ? '✓' : '○'}
                      </span>
                      {rule.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div style={{ marginBottom: 18, fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--secondary)', borderRadius: 10, padding: '10px 12px' }}>
                You'll start as a <b>Viewer</b> — browse tools, vote on ideas, and submit your own tool for committee review. When a tool of yours is approved you become its <b>Product Owner</b>.
              </div>
            )}

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button type="submit" disabled={busy}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14.5, opacity: busy ? 0.6 : 1, cursor: 'pointer' }}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Local demo — accounts live in a local SQLite database on your machine.
        </p>
      </div>
    </div>
  );
}
