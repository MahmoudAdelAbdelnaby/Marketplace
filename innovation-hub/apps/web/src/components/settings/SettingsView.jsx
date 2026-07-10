import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Key, Cpu, Cloud, Lock } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

const PROVIDERS = [
  { id: 'local', label: 'Local model', icon: Cpu, hint: 'Runs on your machine via Ollama — no key needed.' },
  { id: 'gemini', label: 'Google Gemini', icon: Cloud, hint: 'Paste your Gemini API key.' },
  { id: 'openai', label: 'OpenAI', icon: Cloud, hint: 'Paste your OpenAI API key.' },
];

export default function SettingsView() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [provider, setProvider] = useState(user?.ai_provider || 'local');
  const [selectedModel, setSelectedModel] = useState(user?.ai_model || 'llama3.2');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [prompt, setPrompt] = useState('In one sentence, why search a tool catalog before building?');
  const [result, setResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState('');

  // Password reset states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const updatePassword = async () => {
    setPasswordErr(''); setPasswordSaved(false);
    if (!currentPassword) { setPasswordErr('Please enter your current password.'); return; }
    if (!newPassword) { setPasswordErr('Please enter a new password.'); return; }
    if (newPassword !== confirmPassword) { setPasswordErr('New passwords do not match.'); return; }
    
    setPasswordBusy(true);
    try {
      await api('/me/password', { method: 'PUT', body: { current_password: currentPassword, new_password: newPassword } });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (e) {
      setPasswordErr(e.message);
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => { 
    api('/ai/status')
      .then((data) => {
        setStatus(data);
        if (data.local_available && data.models.length > 0 && !user?.ai_model) {
          setSelectedModel(data.models[0]);
        }
      })
      .catch(() => setStatus({ local_available: false, models: [] })); 
  }, [user?.ai_model]);

  const save = async () => {
    setErr(''); setSaved(false);
    try {
      const u = await api('/me/aikey', { method: 'PUT', body: { ai_provider: provider, ai_key: key, ai_model: selectedModel } });
      setUser(u); setSaved(true); setKey('');
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(e.message); }
  };

  const runTest = async () => {
    setTesting(true); setErr(''); setResult('');
    try {
      const r = await api('/ai/generate', { method: 'POST', body: { prompt } });
      setResult(`${r.text}\n\n— via ${r.via}`);
    } catch (e) { setErr(e.message); } finally { setTesting(false); }
  };

  const card = { background: 'var(--bg-card)', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)' };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SettingsIcon /> Settings
      </h1>

      {user?.role === 'admin' && (
        <div style={card}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Key size={18} /> AI provider</h3>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
            Pick where AI features run. Use the local model for testing — or add your own cloud key.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {PROVIDERS.map((p) => {
              const Icon = p.icon; const on = provider === p.id;
              return (
                <button key={p.id} onClick={() => setProvider(p.id)}
                  style={{ padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: on ? 'rgba(33,72,224,0.05)' : 'var(--bg-card)' }}>
                  <Icon size={18} color={on ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 6 }}>{p.label}</div>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{PROVIDERS.find((p) => p.id === provider)?.hint}</p>

          {provider !== 'local' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>API key</label>
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
                placeholder={user?.has_ai_key ? '•••••••• (saved — paste to replace)' : 'Paste your key'} style={{ marginTop: 6 }} />
            </div>
          )}

          {provider === 'local' && status?.local_available && status.models?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Local Model</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                {status.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={save} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
            {saved && <span style={{ color: 'var(--success)', fontSize: 13.5, fontWeight: 600 }}>✓ Saved</span>}
            {status && (
              <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: status.local_available ? 'var(--success)' : 'var(--text-muted)' }}>
                {status.local_available ? `● Local model active: ${user?.ai_model || 'llama3.2'}` : '○ Local model offline'}
              </span>
            )}
          </div>
          {!status?.local_available && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              To enable the local model: run <code>ollama serve</code> and <code>ollama pull {status?.default_model || 'llama3.2'}</code>.
            </p>
          )}
        </div>
      )}

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Test the AI</h3>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ minHeight: 70 }} />
        <button onClick={runTest} disabled={testing} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, opacity: testing ? 0.6 : 1 }}>
          {testing ? 'Thinking…' : 'Run test'}
        </button>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{err}</div>}
        {result && <pre style={{ marginTop: 14, whiteSpace: 'pre-wrap', background: 'var(--secondary)', padding: 14, borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.6 }}>{result}</pre>}
      </div>

      <div style={card}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Lock size={18} /> Change Password</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
          Update your account password. Passwords must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Current Password</label>
            <input 
              type="password" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password" 
              style={{ marginTop: 6 }} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password" 
                style={{ marginTop: 6 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password" 
                style={{ marginTop: 6 }} 
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={updatePassword} 
            disabled={passwordBusy}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: passwordBusy ? 0.6 : 1 }}
          >
            {passwordBusy ? 'Updating…' : 'Update Password'}
          </button>
          {passwordSaved && <span style={{ color: 'var(--success)', fontSize: 13.5, fontWeight: 600 }}>✓ Password Updated</span>}
        </div>
        {passwordErr && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{passwordErr}</div>}
      </div>
    </div>
  );
}
