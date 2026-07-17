import React, { useState, useEffect } from 'react';
import { 
  Users, Building, Sliders, Key, RefreshCw, Plus, Check, 
  AlertCircle, Trash2, Copy, Edit, Save, Shield, HelpCircle 
} from 'lucide-react';

export default function AccessControlTab({ api }) {
  // Lists
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [globalLimit, setGlobalLimit] = useState(5);
  
  // Create Org Form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPerms, setNewOrgPerms] = useState({
    can_see_roi: true,
    can_see_client_names: true,
    can_submit_tools: true,
    can_submit_ideas: true,
    can_push_live_demos: true,
    can_view_voc: true,
    can_submit_voc: true,
    allowed_categories: ['all'],
    allowed_pages: ['catalog', 'roadmap', 'matchmaker', 'insights', 'settings']
  });

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteOrgId, setInviteOrgId] = useState('');

  // Selected User for Edit Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('viewer');
  const [editOrgId, setEditOrgId] = useState('');
  const [editPerms, setEditPerms] = useState({});

  // Loading/Status
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const uRes = await api('/admin/users');
      setUsers(uRes);
      
      const oRes = await api('/admin/organizations');
      setOrgs(oRes);
      
      const iRes = await api('/admin/invites');
      setInvites(iRes);
      
      const sRes = await api('/admin/settings');
      setGlobalLimit(sRes.global_default_ai_credits || 5);
    } catch (e) {
      setError('Failed to load access control details: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Organizations management
  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      const payload = {
        name: newOrgName.trim(),
        default_permissions: newOrgPerms
      };
      await api('/admin/organizations', { method: 'POST', body: payload });
      setNewOrgName('');
      showSuccess(`Organization "${payload.name}" created successfully!`);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to create organization');
    }
  };

  const toggleNewOrgPerm = (key) => {
    setNewOrgPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Referral Invite Creation
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const payload = {
        email: inviteEmail.trim(),
        role: inviteRole,
        org_id: inviteOrgId ? parseInt(inviteOrgId) : null
      };
      const res = await api('/admin/invites', { method: 'POST', body: payload });
      
      if (res.direct_added) {
        showSuccess(`User ${inviteEmail} was already registered and has been directly added to the organization!`);
        setInviteEmail('');
        setInviteOrgId('');
        setInviteRole('viewer');
        loadAll();
      } else {
        const inviteUrl = `${window.location.origin}/register?token=${res.token}`;
        setInviteEmail('');
        setInviteOrgId('');
        setInviteRole('viewer');
        
        // Attempt pre-compose email client
        const subject = encodeURIComponent("You're invited to join Concentrix Marketplace");
        const bodyText = encodeURIComponent(
          `Hi,\n\nYou have been invited to join the Concentrix Marketplace.\n\nPlease complete your registration using this secure link:\n\n${inviteUrl}\n\nThis token is valid for 7 days.`
        );
        window.location.href = `mailto:${res.email}?subject=${subject}&body=${bodyText}`;

        alert(`Invite token generated!\n\nIf your email client didn't open automatically, copy this registration link:\n\n${inviteUrl}`);
        loadAll();
      }
    } catch (err) {
      setError(err.message || 'Failed to create invitation');
    }
  };

  const handleRevokeInvite = async (id) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api(`/admin/invites/${id}`, { method: 'DELETE' });
      showSuccess('Invitation revoked successfully');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  // Global defaults
  const handleSaveSettings = async () => {
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: { global_default_ai_credits: parseInt(globalLimit) }
      });
      showSuccess('Global default AI credits updated!');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    }
  };

  const handleResetCredits = async () => {
    try {
      await api('/admin/users/reset-ai-credits', { method: 'POST' });
      setResetConfirm(false);
      showSuccess('Successfully reset daily AI usages for everyone!');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to reset credits');
    }
  };

  // Permissions editor Modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditOrgId(user.org_id || '');
    setEditPerms(user.permissions || {});
  };

  const closeEditModal = () => {
    setEditingUser(null);
  };

  const toggleEditPerm = (key) => {
    setEditPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveUserPermissions = async () => {
    try {
      await api(`/admin/users/${editingUser.id}/permissions`, {
        method: 'PUT',
        body: {
          role: editRole,
          org_id: editOrgId ? parseInt(editOrgId) : null,
          permissions: editPerms
        }
      });
      closeEditModal();
      showSuccess(`Permissions updated for ${editingUser.email}`);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to update user permissions');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Messages */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} /> {success}
        </div>
      )}

      {/* Top Controls Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Referral Invites Card */}
        <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
              <Plus size={18} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Send Referral Invite</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, margin: '0 0 16px' }}>
            Invite clients or internal colleagues. Invited client accounts automatically bypass Concentrix internal domain rules.
          </p>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Email Address</label>
              <input 
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Designated Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="product_owner">Product Owner</option>
                  <option value="committee">Committee</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Organization Binding</label>
                <select
                  value={inviteOrgId}
                  onChange={e => setInviteOrgId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="">Concentrix Global (Internal)</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button 
              type="submit"
              style={{ padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Check size={16} /> Generate Invite Token
            </button>
          </form>
        </div>

        {/* Global Settings & resets */}
        <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Sliders size={18} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Global AI Credits Control</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, margin: '0 0 16px' }}>
              Modify the default daily AI credits allowed for everyone, or perform a global reset of credit usage.
            </p>
            
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Default Daily Credits</label>
                <input 
                  type="number"
                  min="0"
                  value={globalLimit}
                  onChange={e => setGlobalLimit(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <button 
                onClick={handleSaveSettings}
                style={{ padding: '10.5px 16px', background: 'var(--bg-card)', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Save size={15} /> Save Default
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Global Action</label>
            {!resetConfirm ? (
              <button 
                onClick={() => setResetConfirm(true)}
                style={{ width: '100%', padding: '11px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <RefreshCw size={15} /> Reset Daily AI Usages For Everyone
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={handleResetCredits}
                  style={{ flex: 2, padding: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
                >
                  Confirm Reset Now!
                </button>
                <button 
                  onClick={() => setResetConfirm(false)}
                  style={{ flex: 1, padding: '11px', background: 'var(--bg-body)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organizations List & Creator */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Orgs display */}
        <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Building size={18} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Registered Client Organizations</h2>
          </div>
          
          {orgs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No external client organizations created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orgs.map(org => (
                <div key={org.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-body)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{org.name}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(org.default_permissions || {}).map(([k, v]) => {
                        if (typeof v === 'boolean') {
                          return (
                            <span key={k} style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: v ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: v ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                              {k.replace('can_', '')}: {v ? 'YES' : 'NO'}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Org ID: {org.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Org Form */}
        <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
            <Building size={18} style={{ color: 'var(--primary)' }} /> Add Organization
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Create a new external partner organization and define their default platform permissions.</p>
          <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Org Name</label>
              <input 
                type="text"
                required
                placeholder="e.g. Acme Corporation"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, transition: 'all 0.2s' }}
                className="input-focus"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default Permissions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'can_see_roi', label: 'Allow ROI figures' },
                  { key: 'can_see_client_names', label: 'Allow client names' },
                  { key: 'can_submit_tools', label: 'Allow tool submissions' },
                  { key: 'can_submit_ideas', label: 'Allow idea proposals' },
                  { key: 'can_push_live_demos', label: 'Allow live container uploads' },
                  { key: 'can_view_voc', label: 'Allow VOC viewing' },
                  { key: 'can_submit_voc', label: 'Allow VOC submissions' }
                ].map(p => {
                  const isActive = newOrgPerms[p.key];
                  return (
                    <div 
                      key={p.key}
                      onClick={() => toggleNewOrgPerm(p.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 8, border: '1px solid var(--border-color)',
                        background: isActive ? 'var(--secondary)' : 'var(--bg-main)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        borderLeft: isActive ? '3.5px solid var(--primary)' : '1px solid var(--border-color)'
                      }}
                      onMouseOver={e => { if(!isActive) e.currentTarget.style.borderColor = 'var(--primary)' }}
                      onMouseOut={e => { if(!isActive) e.currentTarget.style.borderColor = 'var(--border-color)' }}
                    >
                      <input 
                        type="checkbox"
                        checked={isActive}
                        onChange={() => {}} // Click is handled by the parent div
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              type="submit"
              style={{ width: '100%', padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}
            >
              <Plus size={16} /> Create Organization
            </button>
          </form>
        </div>
      </div>

      {/* Users & Overrides Table */}
      <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
              <Users size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Member Directory & Permissions Overrides</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>Click Manage to override visibility rules or credit counts for any specific user.</p>
            </div>
          </div>
          <button onClick={loadAll} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={12} /> Refresh Directory
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Member Info</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Organization</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>System Role</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>AI Credits</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Overrides Configured</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ fontWeight: 700 }}>{u.name || 'Unnamed User'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{u.org_name}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: u.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'var(--bg-body)', color: u.role === 'admin' ? '#6366f1' : 'var(--text-secondary)', fontWeight: 600, fontSize: 11.5 }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <strong>{u.ai_credits}</strong> daily <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({u.daily_usage} used)</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {Object.keys(u.permissions || {}).length > 0 ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{Object.keys(u.permissions).length} Overrides</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>None (Using Defaults)</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button 
                      onClick={() => openEditModal(u)}
                      style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Edit size={12} /> Manage Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Table */}
      {invites.length > 0 && (
        <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={16} /> Pending Referral Invitation Links ({invites.filter(x => x.status === 'pending').length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invites.map(inv => {
              const inviteUrl = `${window.location.origin}/register?token=${inv.token}`;
              const isPending = inv.status === 'pending';
              const isExpired = inv.expires_at < Date.now() / 1000;
              
              return (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{inv.email}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: isPending ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: isPending ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                      {isPending ? (isExpired ? 'EXPIRED' : 'PENDING') : 'ACCEPTED'}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Role: {inv.role.toUpperCase()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isPending && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl);
                          alert('Copied registration link to clipboard!');
                        }}
                        style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontWeight: 600 }}
                      >
                        <Copy size={12} /> Copy Link
                      </button>
                    )}
                    <button 
                      onClick={() => handleRevokeInvite(inv.id)}
                      style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Trash2 size={12} /> {isPending ? 'Revoke' : 'Delete Log'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Permissions Editor Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 500, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configure User Permissions</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{editingUser.email}</span>
              </div>
              <button onClick={closeEditModal} style={{ border: 'none', background: 'transparent', fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
            </div>

            {/* Role & Org Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>System Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 12.5 }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="product_owner">Product Owner</option>
                  <option value="committee">Committee</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Organization</label>
                <select
                  value={editOrgId}
                  onChange={e => setEditOrgId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 12.5 }}
                >
                  <option value="">Concentrix Global (Internal)</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Overrides Checkboxes */}
            <div style={{ background: 'var(--bg-body)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Individual Custom Overrides</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'can_see_roi', label: 'Can see ROI metrics' },
                  { key: 'can_see_client_names', label: 'Can see Client names' },
                  { key: 'can_submit_tools', label: 'Can submit tools' },
                  { key: 'can_submit_ideas', label: 'Can submit ideas' },
                  { key: 'can_push_live_demos', label: 'Can upload live container demos' },
                  { key: 'can_view_voc', label: 'Can view VOC feedback' },
                  { key: 'can_submit_voc', label: 'Can submit VOC feedback' }
                ].map(item => {
                  const hasOverride = editPerms[item.key] !== undefined;
                  const isOverriddenVal = editPerms[item.key];
                  
                  return (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5 }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!hasOverride ? (
                          <button 
                            onClick={() => setEditPerms(p => ({ ...p, [item.key]: true }))}
                            style={{ fontSize: 11.5, background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            Use Default
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input 
                              type="checkbox"
                              checked={isOverriddenVal}
                              onChange={() => toggleEditPerm(item.key)}
                            />
                            <button 
                              onClick={() => setEditPerms(p => {
                                const copy = { ...p };
                                delete copy[item.key];
                                return copy;
                              })}
                              style={{ fontSize: 10, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Credits Override */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Daily AI Credits Limit Override</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input 
                  type="number"
                  placeholder="Leave blank to use default"
                  value={editPerms.ai_credits_override !== undefined ? editPerms.ai_credits_override : ''}
                  onChange={e => {
                    const val = e.target.value;
                    setEditPerms(prev => ({
                      ...prev,
                      ai_credits_override: val !== '' ? parseInt(val) : undefined
                    }));
                  }}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 12.5 }}
                />
                {editPerms.ai_credits_override !== undefined && (
                  <button 
                    onClick={() => setEditPerms(prev => {
                      const copy = { ...prev };
                      delete copy.ai_credits_override;
                      return copy;
                    })}
                    style={{ fontSize: 11, color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear Override
                  </button>
                )}
              </div>
            </div>

            {/* Categories multi-select override */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Allowed Product Categories</label>
              <input 
                type="text"
                placeholder="Comma separated: all, IX Suite, Tech Infusion, Innovations Hub"
                value={editPerms.allowed_categories !== undefined ? editPerms.allowed_categories.join(', ') : ''}
                onChange={e => {
                  const val = e.target.value;
                  setEditPerms(prev => ({
                    ...prev,
                    allowed_categories: val !== '' ? val.split(',').map(s => s.trim()) : undefined
                  }));
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 12.5 }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 3 }}>
                Use <strong>all</strong> for full catalog access, or list specific categories to restrict view.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button 
                onClick={handleSaveUserPermissions}
                style={{ flex: 1, padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Save size={16} /> Save Changes
              </button>
              <button 
                onClick={closeEditModal}
                style={{ flex: 1, padding: '11px', background: 'var(--bg-body)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
