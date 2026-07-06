import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

const ROLES = ['viewer', 'product_owner', 'committee', 'approver', 'admin'];
const ROLE_LABEL = { viewer: 'Viewer', product_owner: 'Product Owner', committee: 'Committee (Reviewer)', approver: 'Approver', admin: 'Admin' };

export default function AdminCenter() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');
  const [routing, setRouting] = useState('committee');
  const [requiredReviewers, setRequiredReviewers] = useState(1);
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);

  const load = () => api('/admin/users').then(setUsers).catch((e) => setErr(e.message));
  const loadTools = () => api('/tools').then(setTools).catch(() => {});
  const loadIdeas = () => api('/ideas').then(setIdeas).catch(() => {});
  
  useEffect(() => { 
    load(); 
    loadTools();
    loadIdeas();
    if (me?.role === 'admin') {
      api('/admin/settings')
        .then((data) => {
          if (data && data.idea_routing) setRouting(data.idea_routing);
          if (data && data.required_reviewers) setRequiredReviewers(Number(data.required_reviewers));
        })
        .catch(() => {});
    }
  }, [me]);

  const setRole = async (id, role) => {
    try { await api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }); load(); }
    catch (e) { setErr(e.message); }
  };

  const updateRouting = async (val) => {
    setRouting(val);
    try {
      await api('/admin/settings', { method: 'POST', body: { idea_routing: val } });
    } catch (e) {
      setErr('Failed to update settings: ' + e.message);
    }
  };

  const updateReviewers = async (val) => {
    setRequiredReviewers(val);
    try {
      await api('/admin/settings', { method: 'POST', body: { required_reviewers: val.toString() } });
    } catch (e) {
      setErr('Failed to update settings: ' + e.message);
    }
  };

  const toggleFeatured = async (id, isFeatured) => {
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, featured: isFeatured } : t)));
    try {
      await api(`/tools/${id}`, { method: 'PATCH', body: { featured: isFeatured } });
      loadTools();
    } catch (e) {
      setErr('Failed to update featured status: ' + e.message);
      setTools((prev) => prev.map((t) => (t.id === id ? { ...t, featured: !isFeatured } : t)));
    }
  };

  if (me?.role !== 'admin') return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Admins only.</div>;

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><ShieldCheck /> Admin center</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Grant roles. Everyone registers as a Viewer; you assign Committee / Product Owner / Admin here.</p>
      {err && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden' }}>
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border-color)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name} {u.id === me.id && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(you)</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--primary-text)', background: 'var(--secondary)', borderRadius: 6, padding: '3px 8px' }}>{ROLE_LABEL[u.role]}</span>
            <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} style={{ width: 170 }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
        ))}
        {users.length === 0 && <div style={{ padding: 20, color: 'var(--text-muted)' }}>No users.</div>}
      </div>

      {/* Idea Routing Settings Block */}
      <div style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Idea Pipeline Routing Configuration</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Configure where new ideas are routed after a user submits them from the canvas scoping pipeline.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select 
            value={routing} 
            onChange={(e) => updateRouting(e.target.value)} 
            style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}
          >
            <option value="committee">Route to Review Committee (Requires Approval)</option>
            <option value="voice_of_clients">Route directly to Voice of Clients (Auto-Approve)</option>
          </select>
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Required Committee Reviews before Final Approval:</label>
          <input 
            type="number" 
            min="1" 
            max="10" 
            value={requiredReviewers}
            onChange={(e) => updateReviewers(Number(e.target.value))}
            style={{ width: 80, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Backup and Restore Section */}
      <div style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Database Backup &amp; Restore</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Download a complete JSON backup containing all tools (including uploaded HTML demos) and ideas. You can use it to restore the system state later.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            onClick={async () => {
              try {
                const backup = await api('/admin/backup');
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                const stamp = new Date().toISOString().slice(0, 10);
                a.href = URL.createObjectURL(blob);
                a.download = `hub-backup-${stamp}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              } catch (e) {
                alert('Export failed: ' + e.message);
              }
            }} 
            style={{ padding: '10px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13 }}
          >
            Export Backup
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Import Backup
            <input 
              type="file" 
              accept=".json" 
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                try {
                  const backup = JSON.parse(await file.text());
                  if (!window.confirm('Restore this backup? This will replace all current tools and ideas in the database.')) return;
                  await api('/admin/backup', { method: 'POST', body: backup });
                  alert('Backup restored successfully!');
                  window.location.reload();
                } catch (e) {
                  alert('Import failed: ' + e.message);
                }
              }} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>
      </div>

      {/* Featured Solutions Panel */}
      <div style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Featured Solutions Manager</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Select which approved tools from the catalog should be featured in the homepage slider.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 6 }}>
          {tools.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.category} • ROI: ${t.roi.toLocaleString()}/yr</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={!!t.featured} 
                  onChange={(e) => toggleFeatured(t.id, e.target.checked)} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                Featured
              </label>
            </div>
          ))}
          {tools.length === 0 && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>No approved tools available.</div>}
        </div>
      </div>
    </div>
  );
}
