import React, { useState, useEffect } from 'react';
import { 
  Users, Building, Sliders, Key, Plus, Check, 
  AlertCircle, Trash2, Copy, Edit, Save, Shield, HelpCircle, Info
} from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

export default function MyOrganization() {
  const me = useAuthStore((s) => s.user);

  // States
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [orgName, setOrgName] = useState('My Organization');
  const [orgDefaultPerms, setOrgDefaultPerms] = useState({});
  const [toolsList, setToolsList] = useState([]);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  // Permission Editor Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('viewer');
  const [editPerms, setEditPerms] = useState({});

  // Loading/Messages
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const orgRes = await api('/org/members');
      setMembers(orgRes.members || []);
      setInvites(orgRes.invites || []);
      setOrgName(orgRes.org_name || 'My Organization');
      setOrgDefaultPerms(orgRes.org_default_permissions || {});

      const toolsRes = await api('/tools');
      setToolsList(toolsRes || []);
    } catch (e) {
      setError('Failed to load organization details: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Hierarchy role comparison index helper
  const ROLES = ["waiting", "viewer", "product_owner", "committee", "approver", "admin"];
  const getRoleIndex = (roleName) => {
    const idx = ROLES.indexOf(roleName);
    return idx === -1 ? 0 : idx;
  };

  // Invite action
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const payload = {
        email: inviteEmail.trim(),
        role: inviteRole
      };
      const res = await api('/org/invites', { method: 'POST', body: payload });
      
      if (res.direct_added) {
        showSuccess(`User ${inviteEmail} was already registered and has been directly added to your organization!`);
        setInviteEmail('');
        setInviteRole('viewer');
        loadAll();
      } else {
        const inviteUrl = `${window.location.origin}/register?token=${res.token}`;
        setInviteEmail('');
        setInviteRole('viewer');

        // Draft mailto link
        const subject = encodeURIComponent(`Invitation to join ${orgName} on Concentrix Marketplace`);
        const bodyText = encodeURIComponent(
          `Hi,\n\nYou have been invited to join the Concentrix Marketplace under the organization "${orgName}".\n\nPlease complete your registration using this secure link:\n\n${inviteUrl}\n\nThis invitation is valid for 7 days.`
        );
        window.location.href = `mailto:${res.email}?subject=${subject}&body=${bodyText}`;

        alert(`Invitation link generated and copied!\n\nGive this secure link to your colleague:\n\n${inviteUrl}`);
        navigator.clipboard.writeText(inviteUrl).catch(() => {});
        loadAll();
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    }
  };

  // Revoke invitation action
  const handleRevokeInvite = async (id) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api(`/org/invites/${id}`, { method: 'DELETE' });
      showSuccess('Invitation revoked successfully');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  // Permissions editor Modal openers
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditRole(user.role);
    // Deep clone custom overrides permissions
    setEditPerms(JSON.parse(JSON.stringify(user.permissions || {})));
  };

  const closeEditModal = () => {
    setEditingUser(null);
  };

  const toggleEditPerm = (key) => {
    setEditPerms(prev => {
      const copy = { ...prev };
      if (copy[key] === undefined) {
        // If not overridden, set override to contrary of organization default
        const orgDef = orgDefaultPerms[key] !== undefined ? orgDefaultPerms[key] : true;
        copy[key] = !orgDef;
      } else {
        // Toggle the current override
        copy[key] = !copy[key];
      }
      return copy;
    });
  };

  // SharePoint-style inheritance options
  const inheritOrgDefaults = () => {
    // Clears all custom boolean and list overrides so the user inherits org defaults
    setEditPerms({});
    showSuccess('Permissions reset to follow organization defaults.');
  };

  const inheritMyPermissions = () => {
    // Clone manager's active permissions (minus system role and credits)
    const cloned = {};
    const keys = ["can_see_roi", "can_see_client_names", "can_submit_tools", "can_submit_ideas", "can_push_live_demos", "allowed_pages", "allowed_categories", "allowed_tools"];
    keys.forEach(k => {
      if (me.permissions && me.permissions[k] !== undefined) {
        cloned[k] = me.permissions[k];
      }
    });
    setEditPerms(cloned);
    showSuccess('Permissions configured to match your own.');
  };

  // Categories helper
  const handleToggleCategory = (cat) => {
    setEditPerms(prev => {
      const copy = { ...prev };
      let list = copy.allowed_categories || ['all'];
      if (list.includes('all')) {
        list = [cat];
      } else if (list.includes(cat)) {
        list = list.filter(c => c !== cat);
        if (list.length === 0) list = ['all'];
      } else {
        list = [...list, cat];
      }
      copy.allowed_categories = list;
      return copy;
    });
  };

  // Tools specific lock checklist helper
  const handleToggleTool = (toolId) => {
    setEditPerms(prev => {
      const copy = { ...prev };
      let list = copy.allowed_tools || ['all'];
      if (list.includes('all')) {
        list = [toolId];
      } else if (list.includes(toolId)) {
        list = list.filter(id => id !== toolId);
        if (list.length === 0) list = ['all'];
      } else {
        list = [...list, toolId];
      }
      copy.allowed_tools = list;
      return copy;
    });
  };

  // Save member overrides
  const handleSavePermissions = async () => {
    try {
      await api(`/org/members/${editingUser.id}/permissions`, {
        method: 'PUT',
        body: {
          role: editRole,
          org_id: me.org_id,
          permissions: editPerms
        }
      });
      closeEditModal();
      showSuccess(`Permissions updated for ${editingUser.name || editingUser.email}`);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to update member permissions');
    }
  };

  const isManager = getRoleIndex(me?.role) >= 2;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <Building size={28} style={{ color: 'var(--primary)' }} /> {isManager ? `${orgName} Management` : `${orgName} Directory`}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
          {isManager 
            ? "Manage your organization members, invite clients/collaborators, and configure page & tool visibility."
            : "View members and collaborators belonging to your organization."}
        </p>
      </div>

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

      {/* Top dashboard layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isManager ? '2fr 1fr' : '1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Members Directory */}
        <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--primary)' }} /> Organization Members ({members.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Member Info</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Status / Config</th>
                  {isManager && <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(u => {
                  const isSelf = u.id === me.id;
                  const canManage = isManager && !isSelf && getRoleIndex(me.role) >= getRoleIndex(u.role);
                  const overridesCount = Object.keys(u.permissions || {}).length;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.name || 'Unnamed'} {isSelf && <span style={{ fontSize: 10, background: 'var(--secondary)', color: 'var(--primary-text)', padding: '1px 6px', borderRadius: 4 }}>You</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {overridesCount > 0 ? (
                          <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>
                            {overridesCount} overrides set
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Inherited defaults</span>
                        )}
                      </td>
                      {isManager && (
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {canManage ? (
                            <button
                              onClick={() => openEditModal(u)}
                              style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Edit size={12} /> Manage Access
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Protected</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Side Card */}
        {isManager && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Invite panel */}
            <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} style={{ color: 'var(--primary)' }} /> Invite Member
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14 }}>Invite a colleague directly to this organization.</p>
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Email Address</label>
                  <input 
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>System Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                  >
                    {/* Lock dropdown values to inviter's role or lower */}
                    {ROLES.slice(1, getRoleIndex(me.role) + 1).map(r => (
                      <option key={r} value={r}>{r.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <button 
                  type="submit"
                  style={{ padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  Send Invite Link
                </button>
              </form>
            </div>

            {/* Pending Invites List */}
            {invites.length > 0 && (
              <div style={{ padding: 22, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={16} /> Pending Invites ({invites.filter(x => x.status === 'pending').length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
                  {invites.map(inv => {
                    const url = `${window.location.origin}/register?token=${inv.token}`;
                    return (
                      <div key={inv.id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, wordBreak: 'break-word', maxWidth: '80%' }}>{inv.email}</span>
                          <button onClick={() => handleRevokeInvite(inv.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Revoke</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Role: {inv.role}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              alert('Copied invite registration link!');
                            }}
                            style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permissions Editor Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '90%', maxWidth: 620, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Configure Access Controls</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Member: <b>{editingUser.name || editingUser.email}</b> ({editingUser.email})</span>
              </div>
              <button onClick={closeEditModal} style={{ border: 'none', background: 'transparent', fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
            </div>

            {/* SharePoint inheritance shortcuts */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: 14, borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ color: 'var(--primary-text)', flexShrink: 0 }}><Info size={16} /></div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>Inherit access rules from organization templates or clone your own settings:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button 
                  onClick={inheritOrgDefaults}
                  style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Follow Org Defaults
                </button>
                <button 
                  onClick={inheritMyPermissions}
                  style={{ padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                >
                  Inherit My Permissions
                </button>
              </div>
            </div>

            {/* Role selection */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>System Role</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                {/* Manager can only assign up to their own role index */}
                {ROLES.slice(1, getRoleIndex(me.role) + 1).map(r => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Visual Screen page checklist */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Allowed Sections (Lock/Hide Pages)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { key: 'catalog', label: 'Tool Catalog' },
                  { key: 'roadmap', label: 'Roadmap' },
                  { key: 'matchmaker', label: 'Matchmaker (AI)' },
                  { key: 'insights', label: 'Insights (VOC)' },
                  { key: 'settings', label: 'Account Settings' }
                ].map(page => {
                  const allowedList = editPerms.allowed_pages || orgDefaultPerms.allowed_pages || [];
                  const isChecked = allowedList.includes(page.key);
                  return (
                    <label key={page.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '8px 10px', background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          let nextList = [...allowedList];
                          if (nextList.includes(page.key)) {
                            nextList = nextList.filter(k => k !== page.key);
                          } else {
                            nextList = [...nextList, page.key];
                          }
                          setEditPerms(p => ({ ...p, allowed_pages: nextList }));
                        }}
                      />
                      {page.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Actions Checklist overrides */}
            <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Action Privileges Overrides</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { key: 'can_see_roi', label: 'Allow ROI metrics viewing' },
                  { key: 'can_see_client_names', label: 'Allow Client names viewing' },
                  { key: 'can_submit_tools', label: 'Allow Tool submissions' },
                  { key: 'can_submit_ideas', label: 'Allow Idea proposals' },
                  { key: 'can_push_live_demos', label: 'Allow Live Container uploads' },
                  { key: 'can_view_voc', label: 'Allow VOC viewing' },
                  { key: 'can_submit_voc', label: 'Allow VOC submissions' }
                ].map(p => {
                  const isOverridden = editPerms[p.key] !== undefined;
                  const value = isOverridden ? editPerms[p.key] : orgDefaultPerms[p.key];
                  return (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                      <span style={{ fontSize: 12.5 }}>{p.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input 
                          type="checkbox"
                          checked={!!value}
                          onChange={() => toggleEditPerm(p.key)}
                        />
                        {isOverridden && (
                          <button 
                            onClick={() => setEditPerms(prev => {
                              const copy = { ...prev };
                              delete copy[p.key];
                              return copy;
                            })}
                            style={{ fontSize: 9, color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Allowed tools product selection */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Allowed Products (Specific Tool Lock)</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Restrict access to specific tools. If unchecked, the tool is completely hidden from this member's views.</p>
              
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, background: 'var(--bg-main)', maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {toolsList.map(t => {
                  const allowedList = editPerms.allowed_tools || ['all'];
                  const isChecked = allowedList.includes('all') || allowedList.includes(t.id);
                  return (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }} className="card-hover">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTool(t.id)}
                      />
                      <div>
                        <b>{t.name}</b> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({t.category})</span>
                      </div>
                    </label>
                  );
                })}
                {toolsList.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No products available to restrict.</div>}
              </div>
            </div>

            {/* Actions Panel */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <button 
                onClick={handleSavePermissions}
                style={{ flex: 1, padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Save size={16} /> Save Member Access
              </button>
              <button 
                onClick={closeEditModal}
                style={{ flex: 1, padding: '11px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
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
