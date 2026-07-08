import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

const ROLES = ['viewer', 'product_owner', 'committee', 'approver', 'admin'];
const ROLE_LABEL = { waiting: 'Waiting', viewer: 'Viewer', product_owner: 'Product Owner', committee: 'Committee (Reviewer)', approver: 'Approver', admin: 'Admin' };

export default function AdminCenter() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');
  const [routing, setRouting] = useState('committee');
  const [requiredReviewers, setRequiredReviewers] = useState(1);
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);
  
  const [waitlist, setWaitlist] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  const load = () => api('/admin/users').then(setUsers).catch((e) => setErr(e.message));
  const loadWaitlist = () => api('/admin/users/waitlist').then(setWaitlist).catch(() => {});
  const loadInvitations = () => api('/admin/invites').then(setInvitations).catch(() => {});
  const loadTools = () => api('/tools').then(setTools).catch(() => {});
  const loadIdeas = () => api('/ideas').then(setIdeas).catch(() => {});
  
  useEffect(() => { 
    load(); 
    loadWaitlist();
    loadInvitations();
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

  const resetUserPassword = async (id, name) => {
    const pw = window.prompt(`Enter a new temporary password for ${name}:`);
    if (pw === null) return;
    if (!pw) { alert('Password cannot be empty.'); return; }
    try {
      await api(`/admin/users/${id}/password`, { method: 'PUT', body: { password: pw } });
      alert(`Password for ${name} was reset successfully!`);
    } catch (e) {
      alert(`Failed to reset password: ${e.message}`);
    }
  };

  const approveUser = async (userId, selectedRole) => {
    try {
      await api(`/admin/users/${userId}/approve`, { method: 'POST', body: { role: selectedRole } });
      load();
      loadWaitlist();
    } catch (e) {
      setErr(e.message);
    }
  };

  const declineUser = async (userId) => {
    if (!window.confirm('Are you sure you want to decline and delete this waitlisted user?')) return;
    try {
      await api(`/admin/users/${userId}/decline`, { method: 'DELETE' });
      load();
      loadWaitlist();
    } catch (e) {
      setErr(e.message);
    }
  };

  const inviteUser = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await api('/admin/invites', { method: 'POST', body: { email: inviteEmail, role: inviteRole } });
      const origin = window.location.origin;
      const inviteUrl = `${origin}/register?token=${res.token}`;
      const subject = encodeURIComponent("You're invited to join the Concentrix Innovation Hub");
      const body = encodeURIComponent(
        `Hi,\n\nYou have been invited to join the Concentrix Innovation Hub.\n\nPlease use the link below to complete your registration:\n\n${inviteUrl}\n\nThis invitation link is valid for 7 days.`
      );
      const mailtoUrl = `mailto:${res.email}?subject=${subject}&body=${body}`;
      window.location.href = mailtoUrl;
      setInviteEmail('');
      setInviteRole('viewer');
      loadInvitations();
      alert(`Invitation link generated successfully! A draft has been pre-composed in your mail client.\n\nIn case Outlook did not launch automatically, here is the link you can copy and send:\n${inviteUrl}`);
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const revokeInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to revoke this invitation? The registration link will become invalid.')) return;
    try {
      await api(`/admin/invites/${inviteId}`, { method: 'DELETE' });
      loadInvitations();
    } catch (e) {
      setErr(e.message);
    }
  };

  const redraftInvite = (email, token, role) => {
    const origin = window.location.origin;
    const inviteUrl = `${origin}/register?token=${token}`;
    const subject = encodeURIComponent("You're invited to join the Concentrix Innovation Hub");
    const body = encodeURIComponent(
      `Hi,\n\nYou have been invited to join the Concentrix Innovation Hub.\n\nPlease use the link below to complete your registration:\n\n${inviteUrl}\n\nThis invitation link is valid for 7 days.`
    );
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  };

  const exportWaitlistToCSV = () => {
    if (waitlist.length === 0) {
      alert('The waitlist queue is empty.');
      return;
    }
    const headers = ['Name', 'Email', 'Department', 'Registered Date'];
    const rows = waitlist.map(u => [
      u.name,
      u.email,
      u.department || 'N/A',
      new Date(u.created_at * 1000).toLocaleString()
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `waitlist-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* SECTION: INVITATIONS & WAITLIST */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, marginBottom: 24 }}>
        {/* Left Column: Invite & Sent Invites */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Sub-Section 1: Invite Colleague */}
          <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Invite Colleague</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px' }}>Generate a unique token and draft a corporate email invite.</p>
            <form onSubmit={inviteUser} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email Address</label>
                <input 
                  type="email" 
                  required 
                  placeholder="colleague@concentrix.com" 
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 4, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Assigned Role</label>
                <select 
                  value={inviteRole} 
                  onChange={(e) => setInviteRole(e.target.value)} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 4, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  {Object.entries(ROLE_LABEL).map(([roleVal, label]) => (
                    roleVal !== 'waiting' && <option key={roleVal} value={roleVal}>{label}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                style={{ marginTop: 'auto', padding: '10px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textAlign: 'center' }}
              >
                Draft Outlook Invite ✉
              </button>
            </form>
          </div>

          {/* Sub-Section 1B: Sent Invitations List */}
          <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', maxHeight: 310, overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Sent Invitations</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px' }}>Track who registered (Accepted) or has pending invites.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', paddingRight: 6 }}>
              {invitations.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Role: {ROLE_LABEL[inv.role] || inv.role} • {inv.status === 'accepted' ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>Accepted</span>
                      ) : (
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Pending</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {inv.status === 'pending' && (
                      <button 
                        onClick={() => redraftInvite(inv.email, inv.token, inv.role)} 
                        title="Re-compose invite email"
                        style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(37,99,235,0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                      >
                        Resend
                      </button>
                    )}
                    <button 
                      onClick={() => revokeInvite(inv.id)} 
                      title="Revoke / Delete Invitation"
                      style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                    >
                      {inv.status === 'accepted' ? 'Remove' : 'Revoke'}
                    </button>
                  </div>
                </div>
              ))}
              {invitations.length === 0 && (
                <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>
                  No invitations sent yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Waitlist Queue */}
        <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', maxHeight: 588, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0 }}>Waitlist Queue</h3>
            <button 
              onClick={exportWaitlistToCSV}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}
            >
              📥 Export CSV
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px' }}>Review and approve registrations submitted without invitation codes.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', paddingRight: 6 }}>
            {waitlist.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.email}>{u.email}</div>
                  {u.department && (
                    <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>
                      {u.department}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <select 
                    defaultValue="viewer" 
                    onChange={(e) => {
                      if (e.target.value) {
                        approveUser(u.id, e.target.value);
                      }
                    }} 
                    style={{ padding: '4px 8px', fontSize: 11.5, borderRadius: 6, cursor: 'pointer' }}
                  >
                    <option value="" disabled>Approve as...</option>
                    {Object.entries(ROLE_LABEL).map(([roleVal, label]) => (
                      roleVal !== 'waiting' && <option key={roleVal} value={roleVal}>{label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => declineUser(u.id)} 
                    style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {waitlist.length === 0 && (
              <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>
                No pending users on waitlist.
              </div>
            )}
          </div>
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Active Users list</h3>
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
            <button 
              onClick={() => resetUserPassword(u.id, u.name)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Reset PW
            </button>
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
