import React, { useEffect, useState } from 'react';
import { ShieldCheck, Key, Users, Settings, BarChart2, Check, Trash2, ArrowUpDown, Sparkles, UserPlus, Eye, Play, Mail, FileText, Zap, Activity, Search, MousePointerClick, GitPullRequest, Bot, Star, GripVertical, Vote, Send, UserCheck } from 'lucide-react';
import { api } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';

const ROLES = ['viewer', 'product_owner', 'committee', 'approver', 'admin'];
const ROLE_LABEL = { waiting: 'Waiting', viewer: 'Viewer', product_owner: 'Product Owner', committee: 'Committee (Reviewer)', approver: 'Approver', admin: 'Admin' };

export default function AdminCenter() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [routing, setRouting] = useState('committee');
  const [requiredReviewers, setRequiredReviewers] = useState(1);
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);
  
  const [waitlist, setWaitlist] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  // Navigation tab states
  const [adminTab, setAdminTab] = useState('users');
  const [analyticsSubTab, setAnalyticsSubTab] = useState('time_spent');

  // AI credits editing states
  const [editingCreditsUserId, setEditingCreditsUserId] = useState(null);
  const [editingCreditsVal, setEditingCreditsVal] = useState(5);

  // API Key states
  const [globalKeys, setGlobalKeys] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('gemini');

  // Analytics states
  const [timeSpentData, setTimeSpentData] = useState([]);
  const [searchQueries, setSearchQueries] = useState([]);
  const [visitedProducts, setVisitedProducts] = useState([]);
  const [clicksAudits, setClicksAudits] = useState([]);
  const [funnelAudits, setFunnelAudits] = useState([]);
  const [aiAudits, setAiAudits] = useState([]);
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [expandedUsers, setExpandedUsers] = useState({});

  const load = () => api('/admin/users').then(setUsers).catch((e) => setErr(e.message));
  const loadWaitlist = () => api('/admin/users/waitlist').then(setWaitlist).catch(() => {});
  const loadInvitations = () => api('/admin/invites').then(setInvitations).catch(() => {});
  const loadTools = () => api('/tools').then(setTools).catch(() => {});
  const loadIdeas = () => api('/ideas').then(setIdeas).catch(() => {});
  const loadGlobalKeys = () => api('/admin/keys').then(setGlobalKeys).catch(() => {});

  const loadAnalytics = () => {
    api('/admin/analytics')
      .then((data) => {
        if (data) {
          setTimeSpentData(data.time_spent || []);
          setSearchQueries(data.popular_searches || []);
          setVisitedProducts(data.top_visited || []);
          setClicksAudits(data.action_clicks || []);
          setFunnelAudits(data.funnel_logs || []);
          setAiAudits(data.ai_audit_logs || []);
        }
      })
      .catch(() => {});
  };
  
  useEffect(() => { 
    load(); 
    loadWaitlist();
    loadInvitations();
    loadTools();
    loadIdeas();
    loadGlobalKeys();
    loadAnalytics();
    
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
    try { 
      await api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }); 
      load(); 
      showTempSuccess('Role updated successfully.');
    } catch (e) { 
      setErr(e.message); 
    }
  };

  const showTempSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
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

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${name}? This action cannot be undone.`)) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      load();
      showTempSuccess('User deleted successfully.');
    } catch (e) {
      alert(`Failed to delete user: ${e.message}`);
    }
  };

  const saveCredits = async (userId) => {
    try {
      await api(`/admin/users/${userId}/credits`, { method: 'PUT', body: { credits: editingCreditsVal } });
      setEditingCreditsUserId(null);
      load();
      showTempSuccess('User credits limit updated.');
    } catch (e) {
      alert(`Failed to save credits: ${e.message}`);
    }
  };

  const approveUser = async (userId, selectedRole) => {
    try {
      await api(`/admin/users/${userId}/approve`, { method: 'POST', body: { role: selectedRole } });
      load();
      loadWaitlist();
      showTempSuccess('User registration approved.');
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
      showTempSuccess('User registration declined.');
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
      showTempSuccess('Invitation revoked.');
    } catch (e) {
      setErr(e.message);
    }
  };

  const redraftInvite = (email, token) => {
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
      showTempSuccess('Idea routing policy updated.');
    } catch (e) {
      setErr('Failed to update settings: ' + e.message);
    }
  };

  const updateReviewers = async (val) => {
    setRequiredReviewers(val);
    try {
      await api('/admin/settings', { method: 'POST', body: { required_reviewers: val.toString() } });
      showTempSuccess('Required reviewers count updated.');
    } catch (e) {
      setErr('Failed to update settings: ' + e.message);
    }
  };

  const toggleFeatured = async (id, isFeatured) => {
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, featured: isFeatured } : t)));
    try {
      await api(`/tools/${id}`, { method: 'PATCH', body: { featured: isFeatured } });
      loadTools();
      showTempSuccess('Catalog item featured status updated.');
    } catch (e) {
      setErr('Failed to update featured status: ' + e.message);
      setTools((prev) => prev.map((t) => (t.id === id ? { ...t, featured: !isFeatured } : t)));
    }
  };

  const updateToolSortOrder = async (id, val) => {
    const numericVal = Number(val);
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, sort_order: numericVal } : t)));
    try {
      await api(`/tools/${id}`, { method: 'PATCH', body: { sort_order: numericVal } });
      showTempSuccess('Sort order updated.');
    } catch (e) {
      setErr('Failed to update sort order: ' + e.message);
    }
  };

  const addGlobalKey = async (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    try {
      await api('/admin/keys', {
        method: 'POST',
        body: {
          key_value: newKey.trim(),
          label: newKeyLabel.trim(),
          provider: newKeyProvider
        }
      });
      setNewKey('');
      setNewKeyLabel('');
      loadGlobalKeys();
      showTempSuccess('API key successfully added to rotating pool.');
    } catch (errKey) {
      alert(`Failed to add global key: ${errKey.message}`);
    }
  };

  const toggleGlobalKey = async (id) => {
    try {
      await api(`/admin/keys/${id}/toggle`, { method: 'PUT' });
      loadGlobalKeys();
      showTempSuccess('Key toggle success.');
    } catch (errToggle) {
      alert(`Failed to toggle key: ${errToggle.message}`);
    }
  };

  const deleteGlobalKey = async (id) => {
    if (!window.confirm('Delete this API Key from the rotating pool?')) return;
    try {
      await api(`/admin/keys/${id}`, { method: 'DELETE' });
      loadGlobalKeys();
      showTempSuccess('API Key deleted from pool.');
    } catch (errDel) {
      alert(`Failed to delete key: ${errDel.message}`);
    }
  };

  const exportTelemetryToCSV = (tab) => {
    let headers = [];
    let rows = [];
    let filename = `telemetry-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (tab === 'time_spent') {
      headers = ['User', 'Section', 'Minutes', 'Total User Minutes'];
      groupedTimeSpent.forEach(group => {
        group.sections.forEach(sec => {
          rows.push([group.userName, sec.page, sec.minutes.toFixed(1), group.totalMinutes.toFixed(1)]);
        });
      });
    } else if (tab === 'searches') {
      headers = ['Search Query', 'Count'];
      searchQueries.forEach(row => {
        rows.push([row.query, row.count]);
      });
    } else if (tab === 'views') {
      headers = ['Tool Name', 'Views Count'];
      visitedProducts.forEach(row => {
        rows.push([row.tool_name, row.count]);
      });
    } else if (tab === 'actions') {
      headers = ['User', 'Action Type', 'Tool Name', 'Timestamp'];
      clicksAudits.forEach(row => {
        rows.push([row.user_name, row.action_type, row.tool_name, new Date(row.created_at).toLocaleString()]);
      });
    } else if (tab === 'funnels') {
      headers = ['User', 'Action', 'Draft ID', 'Timestamp'];
      funnelAudits.forEach(row => {
        rows.push([row.user_name, row.action, row.draft_id, new Date(row.created_at).toLocaleString()]);
      });
    } else if (tab === 'ai_audit') {
      headers = ['User', 'Prompt', 'Response', 'Provider', 'Latency Seconds', 'Timestamp'];
      aiAudits.forEach(row => {
        rows.push([row.user_name, row.prompt, row.response, row.provider, row.latency_seconds?.toFixed(1) || '0.0', new Date(row.created_at).toLocaleString()]);
      });
    }

    if (rows.length === 0) {
      alert('No data to export.');
      return;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedTimeSpent = React.useMemo(() => {
    const groups = {};
    timeSpentData.forEach(row => {
      const name = row.user_name || 'Unknown User';
      if (!groups[name]) {
        groups[name] = { userName: name, sections: [], totalMinutes: 0 };
      }
      groups[name].sections.push({ page: row.page, minutes: row.minutes });
      groups[name].totalMinutes += row.minutes;
    });

    return Object.values(groups)
      .filter(g => g.userName.toLowerCase().includes(telemetrySearch.toLowerCase()))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [timeSpentData, telemetrySearch]);

  if (me?.role !== 'admin') return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Admins only.</div>;

  const TAB_ICONS = { users: Users, routing: Settings, sorting: ArrowUpDown, keys: Key, analytics: BarChart2 };

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1020, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Admin Center</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Manage users, routing, catalog sorting, AI keys, and telemetry.
          </p>
        </div>
      </div>

      {err && <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600, fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>{err}</div>}
      {successMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={15} /> {successMsg}
        </div>
      )}

      {/* TABS HEADER */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border-color)', marginBottom: 24, paddingBottom: 0, overflowX: 'auto', whiteSpace: 'nowrap', marginTop: 20 }}>
        {[
          { id: 'users', label: 'Users & Roles' },
          { id: 'routing', label: 'Idea Routing' },
          { id: 'sorting', label: 'Catalog Sorting' },
          { id: 'keys', label: 'API Keys Pool' },
          { id: 'analytics', label: 'Telemetry & Audits' }
        ].map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const isActive = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px 10px 0 0',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                background: isActive ? 'rgba(33,72,224,0.08)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: -2
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: USERS & ROLES */}
      {adminTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Waitlist and invite colleague side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
            {/* Invite Colleague */}
            <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={16} /> Invite Colleague
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px' }}>Generate a unique token and pre-compose a corporate email invite.</p>
              <form onSubmit={inviteUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Role</label>
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)} 
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
                  Generate &amp; Compose Invite
                </button>
              </form>
            </div>

            {/* Waitlist Queue */}
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
                        onChange={(e) => approveUser(u.id, e.target.value)} 
                        style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 600 }}
                      >
                        <option value="" disabled>Approve as...</option>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <button onClick={() => declineUser(u.id)} style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: 'var(--danger-subtle)', color: 'var(--danger)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
                {waitlist.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No waitlisted registrations.</div>}
              </div>
            </div>
          </div>

          {/* Active Users Table */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} /> Active Users Directory
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>Manage roles, reset passwords, set AI credit limits per user.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '6px 12px', width: 220 }}>
                <Search size={14} color="var(--text-muted)" style={{ marginRight: 8 }} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {(() => {
                const filteredUsers = users.filter(u => 
                  u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                  u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                );
                
                const usersByRole = {
                  admin: [],
                  committee: [],
                  approver: [],
                  product_owner: [],
                  viewer: []
                };
                
                filteredUsers.forEach(u => {
                  if (usersByRole[u.role]) {
                    usersByRole[u.role].push(u);
                  } else {
                    usersByRole.viewer.push(u);
                  }
                });

                if (filteredUsers.length === 0) {
                  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No users found matching "{userSearchQuery}".</div>;
                }

                return ['admin', 'committee', 'approver', 'product_owner', 'viewer'].map(role => {
                  const roleUsers = usersByRole[role];
                  if (roleUsers.length === 0) return null;
                  
                  return (
                    <div key={role}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                        {ROLE_LABEL[role]} ({roleUsers.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {roleUsers.map((u) => {
                          const totalCredits = u.ai_credits ?? 5;
                          const usedCredits = u.ai_usage ?? 0;
                          const remaining = Math.max(0, totalCredits - usedCredits);
                const pct = totalCredits > 0 ? (remaining / totalCredits) * 100 : 0;
                const barColor = pct > 50 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444';

                return (
                  <div key={u.id} style={{ padding: '14px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, transition: 'box-shadow 0.2s' }}>
                    {/* Row 1: Name, email, role, actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {u.name}
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                            padding: '2px 8px', borderRadius: 6,
                            background: u.role === 'admin' ? 'rgba(99,102,241,0.12)' : u.role === 'committee' ? 'rgba(234,179,8,0.12)' : 'rgba(100,116,139,0.1)',
                            color: u.role === 'admin' ? '#6366f1' : u.role === 'committee' ? '#ca8a04' : 'var(--text-muted)'
                          }}>
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <button 
                          onClick={() => resetUserPassword(u.id, u.name)}
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}
                        >
                          Reset PW
                        </button>
                        {u.id !== me?.id && (
                          <button 
                            onClick={() => deleteUser(u.id, u.name)}
                            style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: AI Credits — separate line */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap size={14} color="#fff" fill="#fff" />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>AI Credits</span>
                      </div>

                      {/* Visual progress bar */}
                      <div style={{ flex: 1, maxWidth: 180 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: barColor }}>{remaining}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {totalCredits}</span>
                        </div>
                        <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      {/* Edit credits */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                        {editingCreditsUserId === u.id ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Set limit:</span>
                            <input 
                              type="number" 
                              min="0"
                              value={editingCreditsVal} 
                              onChange={(e) => setEditingCreditsVal(Number(e.target.value))} 
                              style={{ width: 58, padding: '4px 8px', fontSize: 13, borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 700, outline: 'none' }} 
                            />
                            <button 
                              onClick={() => saveCredits(u.id)}
                              style={{ padding: '4px 10px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                              title="Save"
                            >
                              <Check size={13} /> Save
                            </button>
                            <button 
                              onClick={() => setEditingCreditsUserId(null)}
                              style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => { setEditingCreditsUserId(u.id); setEditingCreditsVal(totalCredits); }}
                            style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <Settings size={12} /> Edit Limit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Pending Invitations */}
          <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={16} /> Pending Invitations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invitations.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{inv.email}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Assigned Role: <b>{ROLE_LABEL[inv.role] || inv.role}</b></div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => redraftInvite(inv.email, inv.token)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      Redraft Email
                    </button>
                    <button onClick={() => revokeInvite(inv.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
              {invitations.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No pending invitations.</div>}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: IDEA ROUTING */}
      {adminTab === 'routing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={18} /> Idea Routing Policy
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Control which queue newly submitted ideations flow into for review.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { id: 'committee', label: 'Committee Review', desc: 'Ideas are reviewed and voted on by the steering committee first before advancing.', icon: Vote, color: '#3b82f6' },
                { id: 'approver', label: 'Direct to Approvers', desc: 'Ideas bypass committee votes and flow directly to approvers for final scoping.', icon: UserCheck, color: '#8b5cf6' },
                { id: 'admin', label: 'Admin Only', desc: 'Only admins can review, filter, and allocate scoped ideas to catalogs.', icon: ShieldCheck, color: '#f59e0b' }
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = routing === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => updateRouting(opt.id)}
                    style={{
                      padding: 20,
                      borderRadius: 14,
                      border: isSelected ? `2px solid ${opt.color}` : '2px solid var(--border-color)',
                      background: isSelected ? `${opt.color}0a` : 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    {/* Selection indicator */}
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      width: 22, height: 22, borderRadius: '50%',
                      background: isSelected ? opt.color : 'transparent',
                      border: isSelected ? 'none' : '2px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `${opt.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={20} color={opt.color} />
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? opt.color : 'var(--text-primary)', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{opt.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Required Committee Votes</label>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>Minimum approval votes needed before an ideation advances.</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateReviewers(n)}
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      border: requiredReviewers === n ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: requiredReviewers === n ? 'var(--secondary)' : 'var(--bg-main)',
                      color: requiredReviewers === n ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 800, fontSize: 15, cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CATALOG SORTING */}
      {adminTab === 'sorting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowUpDown size={18} /> Catalog Sort Canvas
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Drag items up or down within each pillar to reorder. Click the star to feature/unfeature.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {['IX Suite', 'Tech Infusion', 'Innovations Hub'].map((pillar) => {
              const pillarTools = tools
                .filter((t) => t.category === pillar)
                .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
              const pillarColors = {
                'IX Suite': { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', accent: '#3b82f6' },
                'Tech Infusion': { bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)', accent: '#8b5cf6' },
                'Innovations Hub': { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', accent: '#10b981' }
              };
              const colors = pillarColors[pillar];

              return (
                <div key={pillar} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                  {/* Pillar header */}
                  <div style={{
                    padding: '14px 16px', background: colors.bg,
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: colors.accent, flexShrink: 0
                    }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: colors.accent }}>
                      {pillar}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {pillarTools.length} item{pillarTools.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Draggable list */}
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80, flex: 1 }}>
                    {pillarTools.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 12px', borderRadius: 10,
                          background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                          transition: 'box-shadow 0.2s',
                          cursor: 'default'
                        }}
                      >
                        {/* Drag handle + rank controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (idx === 0) return;
                              const prev = pillarTools[idx - 1];
                              const myOrder = t.sort_order ?? 0;
                              const prevOrder = prev.sort_order ?? 0;
                              updateToolSortOrder(t.id, prevOrder + 1);
                            }}
                            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border-color)' : 'var(--text-muted)', padding: 0, lineHeight: 1 }}
                            title="Move up"
                          >
                            ▲
                          </button>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (idx === pillarTools.length - 1) return;
                              const next = pillarTools[idx + 1];
                              const myOrder = t.sort_order ?? 0;
                              const nextOrder = next.sort_order ?? 0;
                              updateToolSortOrder(t.id, nextOrder - 1);
                            }}
                            style={{ background: 'none', border: 'none', cursor: idx === pillarTools.length - 1 ? 'default' : 'pointer', color: idx === pillarTools.length - 1 ? 'var(--border-color)' : 'var(--text-muted)', padding: 0, lineHeight: 1 }}
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>

                        {/* Name + owner */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.owner}</div>
                        </div>

                        {/* Featured star toggle */}
                        <button
                          type="button"
                          onClick={() => toggleFeatured(t.id, !t.featured)}
                          title={t.featured ? 'Remove from featured' : 'Add to featured'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            color: t.featured ? '#eab308' : 'var(--border-color)',
                            transition: 'color 0.2s, transform 0.2s',
                            display: 'flex', alignItems: 'center'
                          }}
                        >
                          <Star size={18} fill={t.featured ? '#eab308' : 'none'} />
                        </button>
                      </div>
                    ))}
                    {pillarTools.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>No products in this pillar.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: API KEYS POOL */}
      {adminTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Add global key to pool */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={18} /> Manage Rotating API Keys Pool
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Add multiple API keys to form a rotating key pool. The system cycles through active keys in order (Key 1 &gt; Key 2 &gt; Key 3) when calls fail or reach daily limits.
            </p>

            <form onSubmit={addGlobalKey} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>AI Provider</label>
                <select 
                  value={newKeyProvider} 
                  onChange={(e) => setNewKeyProvider(e.target.value)} 
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="gemini">Google Gemini AI</option>
                  <option value="openai">OpenAI GPT</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Key Value</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Paste AI API Key value here" 
                  value={newKey} 
                  onChange={(e) => setNewKey(e.target.value)} 
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Key Description Label</label>
                <input 
                  type="text" 
                  placeholder="e.g. Gemini Primary, Backup" 
                  value={newKeyLabel} 
                  onChange={(e) => setNewKeyLabel(e.target.value)} 
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} 
                />
              </div>
              <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                Add to Pool
              </button>
            </form>
          </div>

          {/* Active keys pool table */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Active Rotating Keys Pool</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {globalKeys.map((k) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {k.label} 
                      <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {k.provider}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      Key: {k.key_value_masked}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Total requests sent: <b style={{ color: 'var(--primary-text)' }}>{k.requests_count ?? 0}</b>
                    </div>

                    <button 
                      onClick={() => toggleGlobalKey(k.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: k.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: k.is_active ? '#22c55e' : '#ef4444',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {k.is_active ? 'ACTIVE (Enabled)' : 'INACTIVE (Disabled)'}
                    </button>

                    <button 
                      onClick={() => deleteGlobalKey(k.id)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {globalKeys.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
                  No global keys added to rotating pool yet. The system will fallback to client-supplied keys or default local model.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TELEMETRY & AUDITS */}
      {adminTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sub-tabs list */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
            {[
              { id: 'time_spent', label: 'Time Spent', icon: Activity },
              { id: 'searches', label: 'Searches', icon: Search },
              { id: 'views', label: 'Views', icon: Eye },
              { id: 'actions', label: 'Actions', icon: MousePointerClick },
              { id: 'funnels', label: 'Funnels', icon: GitPullRequest },
              { id: 'ai_audit', label: 'AI Audits', icon: Bot }
            ].map((sub) => {
              const SubIcon = sub.icon;
              const isActive = analyticsSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setAnalyticsSubTab(sub.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <SubIcon size={13} />
                  {sub.label}
                </button>
              );
            })}
          </div>

          {/* Time spent */}
          {analyticsSubTab === 'time_spent' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>User Engagement (Time Spent Leaderboard)</h3>
                <button onClick={() => exportTelemetryToCSV('time_spent')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              
              {/* Search bar */}
              <div style={{ marginBottom: 16 }}>
                <input 
                  type="text" 
                  value={telemetrySearch} 
                  onChange={(e) => setTelemetrySearch(e.target.value)} 
                  placeholder="Search user..."
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1px solid var(--border-color)', background: 'var(--bg-main)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {groupedTimeSpent.map((group, idx) => {
                  const isExpanded = expandedUsers[group.userName];
                  return (
                    <div key={idx} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedUsers(prev => ({ ...prev, [group.userName]: !prev[group.userName] }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{group.userName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{group.sections.length} active sections</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>
                            {group.totalMinutes.toFixed(1)} total mins
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div style={{ padding: '0 18px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10 }}>
                          {group.sections.map((sec, sidx) => (
                            <div key={sidx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: sidx < group.sections.length - 1 ? '1px dashed var(--border-color)' : 'none' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Section: <b>{sec.page}</b></span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sec.minutes.toFixed(1)} mins</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedTimeSpent.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No engagement logs found.</div>
                )}
              </div>
            </div>
          )}

          {/* Searches */}
          {analyticsSubTab === 'searches' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Top Catalog Search Queries</h3>
                <button onClick={() => exportTelemetryToCSV('searches')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchQueries.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>"{row.query}"</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Searched <b>{row.count}</b> times</span>
                  </div>
                ))}
                {searchQueries.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No search queries registered.</div>
                )}
              </div>
            </div>
          )}

          {/* Product views */}
          {analyticsSubTab === 'views' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Product Details Popularity</h3>
                <button onClick={() => exportTelemetryToCSV('views')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visitedProducts.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.tool_name}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                      {row.count} views
                    </span>
                  </div>
                ))}
                {visitedProducts.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No tool views registered.</div>
                )}
              </div>
            </div>
          )}

          {/* Action audits */}
          {analyticsSubTab === 'actions' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Action Clicks Audit Trail</h3>
                <button onClick={() => exportTelemetryToCSV('actions')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clicksAudits.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Product: <b>{row.tool_name}</b> • Timestamp: {new Date(row.created_at).toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--secondary)', color: 'var(--primary)' }}>
                      {row.action_type}
                    </span>
                  </div>
                ))}
                {clicksAudits.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No action clicks registered.</div>
                )}
              </div>
            </div>
          )}

          {/* Funnel audits */}
          {analyticsSubTab === 'funnels' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Draft Submissions Funnel</h3>
                <button onClick={() => exportTelemetryToCSV('funnels')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {funnelAudits.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>User: {row.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Draft ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{row.draft_id}</code> • Timestamp: {new Date(row.created_at).toLocaleString()}</div>
                    </div>
                    <span style={{ 
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, 
                      background: row.action === 'submit' ? 'rgba(34,197,94,0.15)' : row.action === 'start_draft' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', 
                      color: row.action === 'submit' ? '#22c55e' : row.action === 'start_draft' ? '#3b82f6' : '#ef4444' 
                    }}>
                      {row.action}
                    </span>
                  </div>
                ))}
                {funnelAudits.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No funnel submissions registered.</div>
                )}
              </div>
            </div>
          )}

          {/* AI Audits */}
          {analyticsSubTab === 'ai_audit' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Gemini Prompt &amp; Conversation Audit Logs</h3>
                <button onClick={() => exportTelemetryToCSV('ai_audit')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {aiAudits.map((row, idx) => (
                  <div key={idx} style={{ padding: 14, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{row.user_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timestamp: {new Date(row.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 6 }}>
                      <b>Prompt:</b> <span style={{ color: 'var(--text-secondary)' }}>{row.prompt}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 6 }}>
                      <b>Response:</b> <span style={{ color: 'var(--text-secondary)' }}>{row.response?.slice(0, 200)}{row.response?.length > 200 ? '...' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>
                      <span>Provider: <code>{row.provider || 'gemini'}</code></span>
                      <span>Latency: <b>{row.latency_seconds?.toFixed(1) || '0.0'}s</b></span>
                    </div>
                  </div>
                ))}
                {aiAudits.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No Gemini usage logs found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Database Backup & Restore ALWAYS handy at the bottom of the page */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
        <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Database Backup &amp; Restore</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginBottom: 12 }}>Download a complete JSON backup containing all tools and ideas to restore later.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={async () => {
                try {
                  const backup = await api('/admin/backup');
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `innovation_hub_backup_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                } catch (e) {
                  alert(e.message);
                }
              }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Export JSON Backup
            </button>
            <label style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              Import JSON Backup
              <input 
                type="file" 
                accept=".json" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!window.confirm('WARNING: Importing a backup will overwrite the current database. Proceed?')) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      const data = JSON.parse(String(reader.result));
                      await api('/admin/restore', { method: 'POST', body: data });
                      alert('Database restored successfully!');
                      window.location.reload();
                    } catch (err2) {
                      alert('Restore failed: ' + err2.message);
                    }
                  };
                  reader.readAsText(file);
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
