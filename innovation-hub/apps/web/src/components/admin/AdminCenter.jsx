import React, { useEffect, useState } from 'react';
import { ShieldCheck, Key, Users, Settings, BarChart2, Check, Trash2, ArrowUpDown, Sparkles, UserPlus, Eye, Play, Mail, FileText, Zap, Activity, Search, MousePointerClick, GitPullRequest, Bot, Star, GripVertical, Vote, Send, UserCheck } from 'lucide-react';
import { api, BASE, getToken } from '../../api';
import { useAuthStore } from '../../store/useAuthStore';
import AccessControlTab from './AccessControlTab';

const ROLES = ['viewer', 'product_owner', 'committee', 'approver', 'admin'];
const ROLE_LABEL = { waiting: 'Waiting', viewer: 'Viewer', product_owner: 'Product Owner', committee: 'Committee (Reviewer)', approver: 'Approver', admin: 'Admin' };

function AiAuditLogRow({ row }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ padding: 12, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(row.created_at).toLocaleString()} • Latency: {row.latency_seconds?.toFixed(1) || '0.0'}s
        </span>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {expanded ? 'Collapse Detail ▲' : 'Expand Detail ▼'}
        </button>
      </div>
      
      <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
        <strong>Prompt:</strong>{' '}
        <span style={{ color: 'var(--text-secondary)', whiteSpace: expanded ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>
          {expanded ? row.prompt : (row.prompt?.slice(0, 120) + (row.prompt?.length > 120 ? '...' : ''))}
        </span>
      </div>
      
      <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
        <strong>Response:</strong>{' '}
        <span style={{ color: 'var(--text-secondary)', whiteSpace: expanded ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>
          {expanded ? row.response : (row.response?.slice(0, 150) + (row.response?.length > 150 ? '...' : ''))}
        </span>
      </div>
      
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
        <span>Provider: <code>{row.provider || 'gemini'}</code></span>
        {row.api_key_used && <span>Key: <code>{row.api_key_used}</code></span>}
      </div>
    </div>
  );
}

export default function AdminCenter() {
  const me = useAuthStore((s) => s.user);

  const handleDownloadExtract = async (endpointPath, defaultFilename) => {
    try {
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(BASE + endpointPath, { headers });
      if (!res.ok) {
        let detail;
        try { detail = (await res.json()).detail; } catch { detail = res.statusText; }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };
  const [users, setUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [routing, setRouting] = useState('committee');
  const [requiredReviewers, setRequiredReviewers] = useState(1);
  const [aiAudit, setAiAudit] = useState({ enabled: true, provider: 'gemini', localUrl: 'http://localhost:11434', localModel: 'llama3.2' });
  const [teams, setTeams] = useState({ webhookUrl: '', baseUrl: '', triggerKey: '' });
  const [digestSched, setDigestSched] = useState({ day: '', time: '09:00' });
  const [teamsTestState, setTeamsTestState] = useState('');
  const [tools, setTools] = useState([]);
  const [ideas, setIdeas] = useState([]);
  
  const [waitlist, setWaitlist] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  // Navigation tab states
  const [adminTab, setAdminTab] = useState('access');
  const [analyticsSubTab, setAnalyticsSubTab] = useState('time_spent');

  // AI credits editing states
  const [editingCreditsUserId, setEditingCreditsUserId] = useState(null);
  const [editingCreditsVal, setEditingCreditsVal] = useState(5);

  // API Key limits editing states
  const [editingKeyLimitId, setEditingKeyLimitId] = useState(null);
  const [editingKeyLimitVal, setEditingKeyLimitVal] = useState(1000);

  // API Key states
  const [globalKeys, setGlobalKeys] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('gemini');

  // Analytics states
  const [timeSpentData, setTimeSpentData] = useState([]);

  // AI System Prompts states
  const [prompts, setPrompts] = useState({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [previewPayloadItem, setPreviewPayloadItem] = useState(null);

  const fetchPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const data = await api('/admin/prompts');
      setPrompts(data);
    } catch (e) {
      console.error('Failed to load AI system prompts:', e);
    } finally {
      setLoadingPrompts(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handlePromptChange = (key, newValue) => {
    setPrompts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: newValue,
        is_custom: newValue !== prev[key]?.default_value
      }
    }));
  };

  const handleSavePrompts = async () => {
    setSavingPrompts(true);
    setErr('');
    setSuccessMsg('');
    try {
      const payload = {};
      Object.keys(prompts).forEach(k => {
        payload[k] = prompts[k].value;
      });
      await api('/admin/prompts', { method: 'PUT', body: { prompts: payload } });
      setSuccessMsg('AI System Prompts updated successfully! Features will immediately use the updated prompts.');
      await fetchPrompts();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      setErr('Failed to save prompts: ' + e.message);
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleResetPrompt = async (key) => {
    if (!window.confirm(`Reset "${prompts[key]?.title || key}" to its default factory prompt?`)) return;
    try {
      await api('/admin/prompts/reset', { method: 'POST', body: { key } });
      setSuccessMsg(`Prompt "${prompts[key]?.title || key}" reset to factory default.`);
      await fetchPrompts();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setErr('Failed to reset prompt: ' + e.message);
    }
  };
  const [activityLogs, setActivityLogs] = useState([]);
  const [viewLogs, setViewLogs] = useState([]);
  const [searchQueries, setSearchQueries] = useState([]);
  const [detailedSearchLogs, setDetailedSearchLogs] = useState([]);
  const [visitedProducts, setVisitedProducts] = useState([]);
  const [clicksAudits, setClicksAudits] = useState([]);
  const [funnelAudits, setFunnelAudits] = useState([]);
  const [aiAudits, setAiAudits] = useState([]);
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [expandedUsers, setExpandedUsers] = useState({});
  const [expandedAiUsers, setExpandedAiUsers] = useState({});

  // Date filters
  const [datePreset, setDatePreset] = useState('7days'); // 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [feedFilters, setFeedFilters] = useState({ views: true, clicks: true, searches: true, ai: true, funnels: true });

  const getDateRangeTimestamps = () => {
    const now = new Date();
    let start = null;
    let end = null;

    if (datePreset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = todayStart.getTime() / 1000;
      end = now.getTime() / 1000;
    } else if (datePreset === 'yesterday') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      start = yesterdayStart.getTime() / 1000;
      end = yesterdayEnd.getTime() / 1000;
    } else if (datePreset === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = sevenDaysAgo.getTime() / 1000;
      end = now.getTime() / 1000;
    } else if (datePreset === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start = thirtyDaysAgo.getTime() / 1000;
      end = now.getTime() / 1000;
    } else if (datePreset === 'custom') {
      if (customStart) {
        const sDate = new Date(customStart + 'T00:00:00');
        start = sDate.getTime() / 1000;
      }
      if (customEnd) {
        const eDate = new Date(customEnd + 'T23:59:59');
        end = eDate.getTime() / 1000;
      } else {
        end = now.getTime() / 1000;
      }
    }
    return { start, end };
  };

  const load = () => api('/admin/users').then(setUsers).catch((e) => setErr(e.message));
  const loadWaitlist = () => api('/admin/users/waitlist').then(setWaitlist).catch(() => {});
  const loadInvitations = () => api('/admin/invites').then(setInvitations).catch(() => {});
  const loadTools = () => api('/tools').then(setTools).catch(() => {});
  const loadIdeas = () => api('/ideas').then(setIdeas).catch(() => {});
  const loadGlobalKeys = () => api('/admin/keys').then(setGlobalKeys).catch(() => {});

  const loadAnalytics = () => {
    const { start, end } = getDateRangeTimestamps();
    let url = '/admin/analytics';
    const params = [];
    if (start !== null) params.push(`start_time=${start}`);
    if (end !== null) params.push(`end_time=${end}`);
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    api(url)
      .then((data) => {
        if (data) {
          setTimeSpentData(data.time_spent || []);
          setActivityLogs(data.activity_logs || []);
          setViewLogs(data.view_logs || []);
          setSearchQueries(data.popular_searches || []);
          setDetailedSearchLogs(data.search_logs || []);
          setVisitedProducts(data.top_visited || []);
          setClicksAudits(data.action_clicks || []);
          setFunnelAudits(data.funnel_logs || []);
          setAiAudits(data.ai_audit_logs || []);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadAnalytics();
  }, [datePreset, customStart, customEnd]);
  
  useEffect(() => { 
    load(); 
    loadWaitlist();
    loadInvitations();
    loadTools();
    loadIdeas();
    loadGlobalKeys();
    
    if (me?.role === 'admin') {
      api('/admin/settings')
        .then((data) => {
          if (data && data.idea_routing) setRouting(data.idea_routing);
          if (data && data.required_reviewers) setRequiredReviewers(Number(data.required_reviewers));
          if (data) setAiAudit({
            enabled: data.ai_audit_enabled !== 'false',
            provider: data.ai_audit_provider || 'gemini',
            localUrl: data.local_model_url || 'http://localhost:11434',
            localModel: data.local_model_name || 'llama3.2',
          });
          if (data) setTeams({
            webhookUrl: data.teams_webhook_url || '',
            baseUrl: data.app_base_url || '',
            triggerKey: data.digest_trigger_key || '',
          });
          if (data && data.digest_schedule) {
            const [d, t] = data.digest_schedule.split(' ');
            setDigestSched({ day: d || '', time: t || '09:00' });
          }
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

  const saveKeyLimit = async (keyId) => {
    try {
      await api(`/admin/keys/${keyId}/limit`, { method: 'PUT', body: { daily_limit: editingKeyLimitVal } });
      setEditingKeyLimitId(null);
      loadGlobalKeys();
      showTempSuccess('API Key daily limit updated.');
    } catch (e) {
      alert(`Failed to save key limit: ${e.message}`);
    }
  };

  const resetUserUsage = async (userId) => {
    if (!window.confirm("Are you sure you want to reset this user's AI credits usage to 0?")) return;
    try {
      await api(`/admin/users/${userId}/refresh-usage`, { method: 'PUT' });
      load();
      showTempSuccess('User usage metrics refreshed.');
    } catch (e) {
      alert(`Failed to reset user usage: ${e.message}`);
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

  const saveAiAudit = async (next) => {
    setAiAudit(next);
    try {
      await api('/admin/settings', { method: 'POST', body: {
        ai_audit_enabled: String(next.enabled),
        ai_audit_provider: next.provider,
        local_model_url: next.localUrl,
        local_model_name: next.localModel,
      }});
      showTempSuccess('AI audit settings saved.');
    } catch (e) { setErr(e.message); }
  };

  const [teamsSaveState, setTeamsSaveState] = useState('');
  const saveTeams = async (next) => {
    setTeams(next);
    setTeamsSaveState('saving');
    try {
      await api('/admin/settings', { method: 'POST', body: {
        teams_webhook_url: next.webhookUrl,
        app_base_url: next.baseUrl,
        digest_trigger_key: next.triggerKey,
      }});
      setTeamsSaveState('saved');
      setTimeout(() => setTeamsSaveState(''), 2500);
      showTempSuccess('Teams notification settings saved.');
    } catch (e) { setTeamsSaveState(''); setErr(e.message); }
  };

  const saveDigestSched = async (next) => {
    setDigestSched(next);
    try {
      await api('/admin/settings', { method: 'POST', body: {
        digest_schedule: next.day ? `${next.day} ${next.time}` : '',
      }});
      showTempSuccess(next.day ? 'Weekly digest scheduled.' : 'Weekly digest disabled.');
    } catch (e) { setErr(e.message); }
  };

  const testTeams = async () => {
    setTeamsTestState('sending');
    try {
      await api('/admin/teams-test', { method: 'POST' });
      setTeamsTestState('sent');
      setTimeout(() => setTeamsTestState(''), 3000);
    } catch (e) {
      setTeamsTestState('');
      alert('Test failed: ' + e.message);
    }
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
      filteredSearchQueries.forEach(row => {
        rows.push([row.query, row.count]);
      });
    } else if (tab === 'views') {
      headers = ['Tool Name', 'Views Count'];
      filteredVisitedProducts.forEach(row => {
        rows.push([row.tool_name, row.count]);
      });
    } else if (tab === 'actions') {
      headers = ['User', 'Action Type', 'Tool Name', 'Timestamp'];
      filteredClicksAudits.forEach(row => {
        rows.push([row.user_name, row.action_type, row.tool_name, new Date(row.created_at * 1000).toLocaleString()]);
      });
    } else if (tab === 'funnels') {
      headers = ['User', 'Action', 'Draft ID', 'Timestamp'];
      filteredFunnelAudits.forEach(row => {
        rows.push([row.user_name, row.action, row.draft_id, new Date(row.created_at * 1000).toLocaleString()]);
      });
    } else if (tab === 'ai_audit') {
      headers = ['User', 'Prompt', 'Response', 'Provider', 'Latency Seconds', 'Timestamp'];
      filteredAiAudits.forEach(row => {
        rows.push([row.user_name, row.prompt, row.response, row.provider, row.latency_seconds?.toFixed(1) || '0.0', new Date(row.created_at * 1000).toLocaleString()]);
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
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    const currentActivity = activityLogs.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });

    const groups = {};
    currentActivity.forEach(row => {
      const name = row.user_name || 'Unknown User';
      if (!groups[name]) {
        groups[name] = { userName: name, sections: [], totalMinutes: 0 };
      }
      const mins = row.duration_seconds / 60;
      const existing = groups[name].sections.find(s => s.page === row.page);
      if (existing) {
        existing.minutes += mins;
      } else {
        groups[name].sections.push({ page: row.page, minutes: mins });
      }
      groups[name].totalMinutes += mins;
    });

    return Object.values(groups)
      .filter(g => g.userName.toLowerCase().includes(telemetrySearch.toLowerCase()))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [activityLogs, telemetrySearch, datePreset, customStart, customEnd]);

  const groupedAiAudits = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    const currentAudits = aiAudits.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });

    const groups = {};
    currentAudits.forEach(row => {
      const name = row.user_name || 'Unknown User';
      if (!groups[name]) {
        groups[name] = { userName: name, logs: [], count: 0 };
      }
      groups[name].logs.push(row);
      groups[name].count += 1;
    });

    return Object.values(groups)
      .filter(g => g.userName.toLowerCase().includes(telemetrySearch.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  }, [aiAudits, telemetrySearch, datePreset, customStart, customEnd]);

  const getAnalyticsDashboardData = () => {
    const { start, end } = getDateRangeTimestamps();
    const actualEnd = end !== null ? end : (Date.now() / 1000);
    const actualStart = start !== null ? start : 0;
    const duration = start !== null ? (actualEnd - actualStart) : (30 * 24 * 60 * 60);
    const priorStart = actualStart - duration;

    const inCurrentRange = (ts) => {
      if (start === null) return true;
      return ts >= actualStart && ts <= actualEnd;
    };

    const inPriorRange = (ts) => {
      if (start === null) return false;
      return ts >= priorStart && ts < actualStart;
    };

    const currAct = activityLogs.filter(l => inCurrentRange(l.created_at));
    const priAct = activityLogs.filter(l => inPriorRange(l.created_at));

    const currSearches = detailedSearchLogs.filter(l => inCurrentRange(l.created_at));
    const priSearches = detailedSearchLogs.filter(l => inPriorRange(l.created_at));

    const currViews = viewLogs.filter(l => inCurrentRange(l.created_at));
    const priViews = viewLogs.filter(l => inPriorRange(l.created_at));

    const currAi = aiAudits.filter(l => inCurrentRange(l.created_at));
    const priAi = aiAudits.filter(l => inPriorRange(l.created_at));

    const currClicks = clicksAudits.filter(l => inCurrentRange(l.created_at));
    const priClicks = clicksAudits.filter(l => inPriorRange(l.created_at));

    const currFunnels = funnelAudits.filter(l => inCurrentRange(l.created_at));
    const priFunnels = funnelAudits.filter(l => inPriorRange(l.created_at));

    const getActiveUsersCount = (logs) => {
      const uSet = new Set();
      logs.forEach(l => {
        if (l.page.includes('(Active Time)') && l.duration_seconds > 0) {
          uSet.add(l.user_name || l.user_id);
        }
      });
      return uSet.size;
    };
    const cActiveUsers = getActiveUsersCount(currAct);
    const pActiveUsers = getActiveUsersCount(priAct);

    const cAiReqs = currAi.length;
    const pAiReqs = priAi.length;

    const cSearchCount = currSearches.length;
    const pSearchCount = priSearches.length;

    const getAvgSessionMinutes = (logs, activeCount) => {
      if (activeCount === 0) return 0;
      let totalSec = 0;
      logs.forEach(l => {
        if (l.page.includes('(Active Time)')) {
          totalSec += l.duration_seconds;
        }
      });
      return (totalSec / 60) / activeCount;
    };
    const cAvgSession = getAvgSessionMinutes(currAct, cActiveUsers);
    const pAvgSession = getAvgSessionMinutes(priAct, pActiveUsers);

    const getPopDelta = (curr, pri) => {
      if (start === null) return null;
      if (pri === 0) return curr > 0 ? 100 : 0;
      return ((curr - pri) / pri) * 100;
    };

    const activeUsersDelta = getPopDelta(cActiveUsers, pActiveUsers);
    const aiRequestsDelta = getPopDelta(cAiReqs, pAiReqs);
    const searchesDelta = getPopDelta(cSearchCount, pSearchCount);
    const avgSessionDelta = getPopDelta(cAvgSession, pAvgSession);

    const trendPoints = [];
    if (start !== null) {
      const days = [];
      let cDay = new Date(actualStart * 1000);
      cDay.setHours(0, 0, 0, 0);
      const limitDay = new Date(actualEnd * 1000);

      while (cDay.getTime() <= limitDay.getTime()) {
        days.push(new Date(cDay));
        cDay.setDate(cDay.getDate() + 1);
      }

      days.forEach(d => {
        const dayStart = d.getTime() / 1000;
        const dayEnd = dayStart + 86400;

        const dayAct = currAct.filter(l => l.created_at >= dayStart && l.created_at < dayEnd);
        const dayAi = currAi.filter(l => l.created_at >= dayStart && l.created_at < dayEnd);
        const daySearches = currSearches.filter(l => l.created_at >= dayStart && l.created_at < dayEnd);

        const dayUsers = getActiveUsersCount(dayAct);
        let daySecs = 0;
        dayAct.forEach(l => {
          if (l.page.includes('(Active Time)')) {
            daySecs += l.duration_seconds;
          }
        });

        trendPoints.push({
          dateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          activeUsers: dayUsers,
          activeMinutes: Math.round((daySecs / 60) * 10) / 10,
          aiRequests: dayAi.length,
          searches: daySearches.length
        });
      });
    }

    return {
      kpis: {
        activeUsers: { current: cActiveUsers, delta: activeUsersDelta },
        aiRequests: { current: cAiReqs, delta: aiRequestsDelta },
        searches: { current: cSearchCount, delta: searchesDelta },
        avgSession: { current: Math.round(cAvgSession * 10) / 10, delta: avgSessionDelta }
      },
      trendPoints,
      currAct,
      currSearches,
      currViews,
      currAi,
      currClicks,
      currFunnels
    };
  };

  const filteredSearchQueries = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    const currentSearches = detailedSearchLogs.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });

    const counts = {};
    currentSearches.forEach(row => {
      const q = String(row.query).toLowerCase().trim();
      counts[q] = (counts[q] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [detailedSearchLogs, datePreset, customStart, customEnd]);

  const filteredVisitedProducts = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    const currentViews = viewLogs.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });

    const counts = {};
    currentViews.forEach(row => {
      const name = row.tool_name || 'Unnamed Product';
      if (!counts[name]) {
        counts[name] = { tool_name: name, count: 0, viewers: new Set() };
      }
      counts[name].count += 1;
      if (row.user_name) {
        counts[name].viewers.add(row.user_name);
      }
    });

    return Object.values(counts)
      .map(item => ({
        tool_name: item.tool_name,
        count: item.count,
        viewers: Array.from(item.viewers)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [viewLogs, datePreset, customStart, customEnd]);

  const filteredClicksAudits = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    return clicksAudits.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });
  }, [clicksAudits, datePreset, customStart, customEnd]);

  const filteredFunnelAudits = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    return funnelAudits.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });
  }, [funnelAudits, datePreset, customStart, customEnd]);

  const filteredAiAudits = React.useMemo(() => {
    const { start, end } = getDateRangeTimestamps();
    const actualStart = start !== null ? start : 0;
    const actualEnd = end !== null ? end : (Date.now() / 1000);

    return aiAudits.filter(row => {
      if (start === null) return true;
      return row.created_at >= actualStart && row.created_at <= actualEnd;
    });
  }, [aiAudits, datePreset, customStart, customEnd]);

  if (me?.role !== 'admin') return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Admins only.</div>;

  const TAB_ICONS = { access: ShieldCheck, users: Users, routing: Settings, sorting: ArrowUpDown, keys: Key, prompts: Bot, extract: Zap, analytics: BarChart2 };

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1020, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Admin Center</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Manage users, organizations, permissions, routing, catalog sorting, AI system prompts, AI keys, bulk data extract, external APIs, and telemetry.
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '2px solid var(--border-color)', marginBottom: 24, paddingBottom: 0, marginTop: 20 }}>
        {[
          { id: 'access', label: 'Access Control' },
          { id: 'users', label: 'Users & Roles' },
          { id: 'routing', label: 'Idea Routing' },
          { id: 'sorting', label: 'Catalog Sorting' },
          { id: 'keys', label: 'API Keys Pool' },
          { id: 'prompts', label: 'AI System Prompts' },
          { id: 'extract', label: 'Data Extract & API' },
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

      {/* TAB CONTENT: ACCESS CONTROL */}
      {adminTab === 'access' && (
        <AccessControlTab api={api} />
      )}

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
                          const usedCredits = u.daily_usage ?? 0; // daily count — same metric as the user's own header chip
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button 
                              onClick={() => { setEditingCreditsUserId(u.id); setEditingCreditsVal(totalCredits); }}
                              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              <Settings size={12} /> Edit Limit
                            </button>
                            <button 
                              onClick={() => resetUserUsage(u.id)}
                              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                              title="Reset user's AI usage count back to 0"
                            >
                              <Activity size={12} /> Reset Usage
                            </button>
                          </div>
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

          {/* TEAMS NOTIFICATIONS */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={18} /> Teams Notifications
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Posts a card to a Teams channel whenever a new tool or idea is submitted for review.
              In Teams: channel → ⋯ → Workflows → "Post to a channel when a webhook request is received" → paste the URL here.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Workflow Webhook URL</label>
                <input
                  value={teams.webhookUrl}
                  onChange={(e) => setTeams({ ...teams, webhookUrl: e.target.value })}
                  onBlur={() => saveTeams(teams)}
                  placeholder="https://prod-xx.westus.logic.azure.com/workflows/…"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>App URL (for card links)</label>
                <input
                  value={teams.baseUrl}
                  onChange={(e) => setTeams({ ...teams, baseUrl: e.target.value })}
                  onBlur={() => saveTeams(teams)}
                  placeholder="http://35.193.55.69"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Digest Trigger Key</label>
                <input
                  value={teams.triggerKey}
                  onChange={(e) => setTeams({ ...teams, triggerKey: e.target.value })}
                  onBlur={() => saveTeams(teams)}
                  placeholder="secret for the 'new updates' flow"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <button
                onClick={testTeams}
                disabled={teamsTestState === 'sending' || !teams.webhookUrl.trim()}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none', whiteSpace: 'nowrap',
                  background: teamsTestState === 'sent' ? 'var(--success)' : 'var(--primary)',
                  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  opacity: (teamsTestState === 'sending' || !teams.webhookUrl.trim()) ? 0.5 : 1
                }}
              >
                {teamsTestState === 'sent' ? '✓ Sent!' : teamsTestState === 'sending' ? 'Sending…' : 'Send Test'}
              </button>
            </div>

            {/* Explicit save + Power Automate trigger URL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => saveTeams(teams)}
                disabled={teamsSaveState === 'saving'}
                style={{
                  padding: '9px 22px', borderRadius: 8, border: 'none',
                  background: teamsSaveState === 'saved' ? 'var(--success)' : 'var(--primary)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  opacity: teamsSaveState === 'saving' ? 0.6 : 1
                }}
              >
                {teamsSaveState === 'saved' ? '✓ Saved' : teamsSaveState === 'saving' ? 'Saving…' : 'Save Settings'}
              </button>
              {teams.triggerKey.trim() && teams.baseUrl.trim() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 320 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Power Automate URL:</span>
                  <code style={{ fontSize: 11.5, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {`${teams.baseUrl.replace(/\/$/, '')}/review/digest/trigger?key=${teams.triggerKey.trim()}`}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${teams.baseUrl.replace(/\/$/, '')}/review/digest/trigger?key=${teams.triggerKey.trim()}`); showTempSuccess('Trigger URL copied.'); }}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>

            {/* Weekly auto-digest schedule */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border-color)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Weekly Auto-Digest</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Automatically post the pending-review digest to the channel on a schedule (server time).</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={digestSched.day}
                  onChange={(e) => saveDigestSched({ ...digestSched, day: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, width: 'auto' }}
                >
                  <option value="">Off</option>
                  <option value="mon">Monday</option>
                  <option value="tue">Tuesday</option>
                  <option value="wed">Wednesday</option>
                  <option value="thu">Thursday</option>
                  <option value="fri">Friday</option>
                  <option value="sat">Saturday</option>
                  <option value="sun">Sunday</option>
                </select>
                <input
                  type="time"
                  value={digestSched.time}
                  onChange={(e) => saveDigestSched({ ...digestSched, time: e.target.value })}
                  disabled={!digestSched.day}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, width: 'auto', opacity: digestSched.day ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* AI CODE AUDIT SETTINGS */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={18} /> AI Code Audit (Container Demos)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Controls the AI security scan and Dockerfile generation for containerized demo builds.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Enable AI check</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>When off, builds skip the AI entirely and use heuristic stack detection with a standard Dockerfile.</div>
              </div>
              <button
                onClick={() => saveAiAudit({ ...aiAudit, enabled: !aiAudit.enabled })}
                style={{
                  marginLeft: 'auto', width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: aiAudit.enabled ? '#22c55e' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: aiAudit.enabled ? 23 : 3, width: 20, height: 20,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </button>
            </div>

            {aiAudit.enabled && (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {[
                    { id: 'gemini', label: 'Gemini API', desc: 'Uses the active Gemini key from Global API Keys.' },
                    { id: 'local', label: 'Local Model', desc: 'OpenAI-compatible server (Ollama, LM Studio) — for testing.' },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => saveAiAudit({ ...aiAudit, provider: opt.id })}
                      style={{
                        flex: 1, padding: 14, borderRadius: 10, cursor: 'pointer',
                        border: aiAudit.provider === opt.id ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                        background: aiAudit.provider === opt.id ? 'var(--secondary)' : 'var(--bg-main)',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: aiAudit.provider === opt.id ? 'var(--primary)' : 'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>

                {aiAudit.provider === 'local' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Server URL</label>
                      <input
                        value={aiAudit.localUrl}
                        onChange={(e) => setAiAudit({ ...aiAudit, localUrl: e.target.value })}
                        onBlur={() => saveAiAudit(aiAudit)}
                        placeholder="http://localhost:11434"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Model Name</label>
                      <input
                        value={aiAudit.localModel}
                        onChange={(e) => setAiAudit({ ...aiAudit, localModel: e.target.value })}
                        onBlur={() => saveAiAudit(aiAudit)}
                        placeholder="llama3.2"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Active Rotating Keys Pool
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {globalKeys.map((k) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {k.label || 'Unnamed Key'} 
                      <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {k.provider}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      Key: {k.key_value_masked || '••••••••'}
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
                  No global keys added to rotating pool yet.
                </div>
              )}
            </div>
          </div>

          {/* Daily Usage & Limits per API Key */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              Daily Usage per API Key
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, margin: '0 0 16px' }}>
              Monitor daily requests count against each key's individual daily request limits.
              Only successful calls served by the pool count here — requests served by an admin's personal key or the local model fallback don't touch pool keys (see Telemetry & Audits for every request).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {globalKeys.map((k) => {
                const dailyLimit = k.daily_limit ?? 1000;
                const dailyUsage = k.daily_requests_count ?? 0;
                const pct = dailyLimit > 0 ? Math.min(100, (dailyUsage / dailyLimit) * 100) : 0;
                const barColor = pct > 90 ? '#ef4444' : pct > 60 ? '#eab308' : '#22c55e';

                return (
                  <div key={k.id} style={{ padding: '14px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
                        {k.label || 'Unnamed Key'}
                      </div>
                      <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4, display: 'inline-block' }}>
                        {k.provider}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ flex: 1, maxWidth: 300 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Today: <b style={{ color: 'var(--text-primary)' }}>{dailyUsage}</b>
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Limit: {dailyLimit} reqs</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    {/* Edit Key Daily Limit Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 200, justifyContent: 'flex-end' }}>
                      {editingKeyLimitId === k.id ? (
                        <>
                          <input 
                            type="number" 
                            min="1"
                            value={editingKeyLimitVal}
                            onChange={(e) => setEditingKeyLimitVal(Number(e.target.value))}
                            style={{ width: 70, padding: '4px 8px', fontSize: 13, borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 700, outline: 'none' }}
                          />
                          <button 
                            onClick={() => saveKeyLimit(k.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                          >
                            <Check size={13} /> Save
                          </button>
                          <button 
                            onClick={() => setEditingKeyLimitId(null)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5 }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => { setEditingKeyLimitId(k.id); setEditingKeyLimitVal(dailyLimit); }}
                          style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Settings size={12} /> Set Limit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {globalKeys.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No global keys available to display usage.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AI SYSTEM PROMPTS */}
      {adminTab === 'prompts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: 24, borderRadius: 14, border: '1px solid var(--border-color)' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={20} style={{ color: 'var(--primary)' }} /> AI System Prompts & Instructions
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 650 }}>
                Control and customize the system instructions guiding AI behavior across all features—from the Matchmaker chat assistant to code security audits and executive board digests.
              </p>
            </div>
            <button
              onClick={handleSavePrompts}
              disabled={savingPrompts}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 10, background: 'var(--primary)',
                color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
                fontSize: 13.5, boxShadow: 'var(--shadow-md)', opacity: savingPrompts ? 0.7 : 1
              }}
            >
              <Check size={16} /> {savingPrompts ? 'Saving Changes...' : 'Save All Prompts'}
            </button>
          </div>

          {loadingPrompts ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading AI system prompts...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.values(prompts).map((item) => {
                const words = item.value ? item.value.trim().split(/\s+/).length : 0;
                const chars = item.value ? item.value.length : 0;
                return (
                  <div 
                    key={item.key} 
                    style={{ 
                      background: 'var(--bg-card)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 14, 
                      padding: 24, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 16 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{item.title}</h3>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700 }}>
                            {item.category}
                          </span>
                          {item.is_custom ? (
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(234,179,8,0.12)', color: '#ca8a04', fontWeight: 700 }}>
                              Customized (Active Override)
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 700 }}>
                              Factory Default
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{item.description}</p>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewPayloadItem(item)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
                            background: 'var(--bg-main)', color: 'var(--primary-text)', fontSize: 12,
                            fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                          }}
                        >
                          <Eye size={13} style={{ color: 'var(--primary)' }} /> Inspect Passed Data Payload
                        </button>

                        {item.is_custom && (
                          <button
                            onClick={() => handleResetPrompt(item.key)}
                            style={{
                              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
                              background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
                              fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Trash2 size={13} /> Reset to Default
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Available Fields & Data Tokens Toolbar */}
                    {item.available_fields && item.available_fields.length > 0 && (
                      <div style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={13} style={{ color: 'var(--primary)' }} /> Available Fields &amp; Data Tokens (Click to insert into prompt)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.available_fields.map((f, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              title={`${f.desc} — Click to insert into prompt`}
                              onClick={() => {
                                const val = item.value || '';
                                const spacer = (val.endsWith(' ') || val.endsWith('\n') || !val) ? '' : ' ';
                                handlePromptChange(item.key, val + spacer + f.token);
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 6,
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                color: 'var(--primary-text)', fontSize: 12, fontFamily: 'monospace',
                                cursor: 'pointer', transition: 'all 0.15s'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--primary-text)'; }}
                            >
                              <span style={{ fontWeight: 700 }}>{f.token}</span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>({f.desc})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={item.value || ''}
                        onChange={(e) => handlePromptChange(item.key, e.target.value)}
                        rows={8}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: 10,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontFamily: 'JetBrains Mono, Courier New, monospace',
                          fontSize: 13,
                          lineHeight: 1.5,
                          resize: 'vertical',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span>Key: <code style={{ color: 'var(--primary-text)' }}>{item.key}</code></span>
                        <span>{words} words • {chars} characters</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal: Passed AI Data Payload Inspector */}
          {previewPayloadItem && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)'
            }}>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                padding: 24, borderRadius: 16, width: '90%', maxWidth: 780,
                maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Eye size={18} style={{ color: 'var(--primary)' }} /> Passed AI Data Payload Inspector
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {previewPayloadItem.title} (<code style={{ color: 'var(--primary-text)' }}>{previewPayloadItem.key}</code>)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewPayloadItem(null)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Below is the exact data structure and context payload passed to the AI model alongside this system prompt when a user runs a query or generates a result:
                </div>

                {previewPayloadItem.available_fields?.length > 0 && (
                  <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Included Data Fields &amp; Available Tokens:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {previewPayloadItem.available_fields.map((f, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{f.token}</code>: <span style={{ color: 'var(--text-secondary)' }}>{f.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Sample Input Data Payload (Appended to System Prompt):
                  </div>
                  <pre style={{
                    margin: 0, padding: 16, borderRadius: 10,
                    background: '#090d16', color: '#38bdf8', border: '1px solid var(--border-color)',
                    fontFamily: 'JetBrains Mono, Courier New, monospace', fontSize: 12.5,
                    whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto', lineHeight: 1.45
                  }}>
                    {previewPayloadItem.sample_payload || 'No sample payload available for this prompt.'}
                  </pre>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewPayloadItem.sample_payload || '');
                      alert('Sample payload copied to clipboard!');
                    }}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}
                  >
                    Copy Sample Payload
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPayloadItem(null)}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* TAB CONTENT: DATA EXTRACT & EXTERNAL REST API */}
      {adminTab === 'extract' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Bulk Data Extraction Section */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} style={{ color: 'var(--primary)' }} /> Bulk Data Extract (Products &amp; Scoping Ideas)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
              Export comprehensive marketplace data including all products, capabilities, ROI figures, and full 4-Phase Scoping Canvas details for external reporting, executive decks, or custom analytics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {/* CSV Products */}
              <div style={{ padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📊 Export Products (CSV)</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, flex: 1, lineHeight: 1.4 }}>
                  Spreadsheet containing tool names, owners, categories, problem statements, capabilities, deliverables, benefits, and ROI.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadExtract('/admin/extract/csv/tools', `marketplace_products_${new Date().toISOString().slice(0, 10)}.csv`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8, background: '#10b981', color: '#fff',
                    fontWeight: 700, fontSize: 12.5, border: 'none', cursor: 'pointer'
                  }}
                >
                  Download Products CSV
                </button>
              </div>

              {/* CSV Ideas */}
              <div style={{ padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💡 Export Ideas &amp; Canvases (CSV)</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, flex: 1, lineHeight: 1.4 }}>
                  Spreadsheet containing full scoping canvas fields: Problem, Value Proposition, Strategic Alignment, Business Impact, Feasibility, and Risks.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadExtract('/admin/extract/csv/ideas', `marketplace_ideas_${new Date().toISOString().slice(0, 10)}.csv`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff',
                    fontWeight: 700, fontSize: 12.5, border: 'none', cursor: 'pointer'
                  }}
                >
                  Download Ideas CSV
                </button>
              </div>

              {/* Complete JSON */}
              <div style={{ padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📦 Bulk Export Data (JSON)</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, flex: 1, lineHeight: 1.4 }}>
                  Complete structured JSON package containing all products, ideas, canvases, and metadata for custom data pipelines.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadExtract('/admin/extract/json', `marketplace_bulk_extract_${new Date().toISOString().slice(0, 10)}.json`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8, background: '#8b5cf6', color: '#fff',
                    fontWeight: 700, fontSize: 12.5, border: 'none', cursor: 'pointer'
                  }}
                >
                  Download Bulk JSON
                </button>
              </div>
            </div>
          </div>

          {/* External Integration REST API Section */}
          <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} style={{ color: 'var(--primary)' }} /> External Integration REST API
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
              Connect third-party tools, BI dashboards, or internal scripts to consume live Marketplace data using secure public REST endpoints.
            </p>

            {/* Available Endpoints Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { method: 'GET', path: '/api/v1/public/tools', desc: 'List all published products with problem statements, ROI, capabilities, and demo links.', params: '?category=IX+Suite' },
                { method: 'GET', path: '/api/v1/public/tools/{id}', desc: 'Get detailed metadata, co-owners, and capabilities for a specific tool ID.', params: '' },
                { method: 'GET', path: '/api/v1/public/ideas', desc: 'List all proposed/approved ideas with full 4-Phase Scoping Canvas details.', params: '?status=proposed' },
                { method: 'GET', path: '/api/v1/public/stats', desc: 'Retrieve high-level telemetry stats, category distribution, and total projected ROI.', params: '' }
              ].map((ep, idx) => (
                <div key={idx} style={{ padding: '14px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontFamily: 'monospace' }}>
                        {ep.method}
                      </span>
                      <code style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-text)' }}>{ep.path}</code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ep.desc}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const url = window.location.origin + ep.path;
                      navigator.clipboard.writeText(`curl -X GET "${url}${ep.params}"`);
                      alert(`cURL command copied to clipboard!\ncurl -X GET "${url}${ep.params}"`);
                    }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Copy cURL Command
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TELEMETRY & AUDITS */}
      {adminTab === 'analytics' && (() => {
        const dashboard = getAnalyticsDashboardData();
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Date Preset & Custom Picker Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Date Filters:</span>
                <div style={{ display: 'flex', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 3, gap: 2 }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: 'all', label: 'All Time' },
                    { id: 'custom', label: 'Custom Range' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setDatePreset(p.id)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: datePreset === p.id ? 'var(--primary)' : 'transparent',
                        color: datePreset === p.id ? '#fff' : 'var(--text-secondary)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {datePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {(() => {
                const { kpis } = dashboard;
                const renderDelta = (delta) => {
                  if (delta === null) return null;
                  const isUp = delta >= 0;
                  const absVal = Math.abs(delta).toFixed(1);
                  const color = isUp ? '#22c55e' : '#ef4444';
                  return (
                    <span style={{ fontSize: 11, fontWeight: 700, color, background: isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {isUp ? '▲' : '▼'} {absVal}%
                    </span>
                  );
                };

                return (
                  <>
                    {/* Active Users */}
                    <div style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Active Users</span>
                        <Users size={16} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{kpis.activeUsers.current}</span>
                        {renderDelta(kpis.activeUsers.delta)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Engaged users this period</div>
                    </div>

                    {/* Avg Active Minutes */}
                    <div style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Avg Active Minutes</span>
                        <Activity size={16} style={{ color: '#06b6d4' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{kpis.avgSession.current}m</span>
                        {renderDelta(kpis.avgSession.delta)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active time per active user</div>
                    </div>

                    {/* Total AI Requests */}
                    <div style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Total AI Requests</span>
                        <Bot size={16} style={{ color: '#a855f7' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{kpis.aiRequests.current}</span>
                        {renderDelta(kpis.aiRequests.delta)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gemini chat prompts sent</div>
                    </div>

                    {/* Catalog Searches */}
                    <div style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Catalog Searches</span>
                        <Search size={16} style={{ color: '#f59e0b' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{kpis.searches.current}</span>
                        {renderDelta(kpis.searches.delta)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Search queries registered</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* SVG Trend Chart */}
            {datePreset !== 'all' && dashboard.trendPoints.length > 1 && (
              <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>Engagement &amp; Usage Trends</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0' }}>Daily active minutes and AI chat request volume over time</p>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} />
                      Active Minutes
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#a855f7', display: 'inline-block' }} />
                      AI Chat Requests
                    </span>
                  </div>
                </div>

                {/* SVG Drawing Canvas */}
                {(() => {
                  const pts = dashboard.trendPoints;
                  const height = 180;
                  const width = 800;

                  const maxMins = Math.max(...pts.map(p => p.activeMinutes), 1);
                  const maxAi = Math.max(...pts.map(p => p.aiRequests), 1);

                  const getCoords = (val, max, index) => {
                    const x = (index / (pts.length - 1)) * (width - 80) + 40;
                    const y = height - 30 - ((val / max) * (height - 65));
                    return { x, y };
                  };

                  let activePath = '';
                  let activeArea = '';
                  let aiPath = '';
                  let aiArea = '';

                  pts.forEach((p, idx) => {
                    const cAct = getCoords(p.activeMinutes, maxMins, idx);
                    const cAi = getCoords(p.aiRequests, maxAi, idx);

                    if (idx === 0) {
                      activePath = `M ${cAct.x} ${cAct.y}`;
                      activeArea = `M ${cAct.x} ${height - 30} L ${cAct.x} ${cAct.y}`;
                      aiPath = `M ${cAi.x} ${cAi.y}`;
                      aiArea = `M ${cAi.x} ${height - 30} L ${cAi.x} ${cAi.y}`;
                    } else {
                      activePath += ` L ${cAct.x} ${cAct.y}`;
                      activeArea += ` L ${cAct.x} ${cAct.y}`;
                      aiPath += ` L ${cAi.x} ${cAi.y}`;
                      aiArea += ` L ${cAi.x} ${cAi.y}`;
                    }

                    if (idx === pts.length - 1) {
                      activeArea += ` L ${cAct.x} ${height - 30} Z`;
                      aiArea += ` L ${cAi.x} ${height - 30} Z`;
                    }
                  });

                  return (
                    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, gridIdx) => {
                          const y = height - 30 - ratio * (height - 65);
                          return (
                            <line
                              key={gridIdx}
                              x1="40"
                              y1={y}
                              x2={width - 40}
                              y2={y}
                              stroke="var(--border-color)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                          );
                        })}

                        <path d={activeArea} fill="url(#activeGrad)" />
                        <path d={aiArea} fill="url(#aiGrad)" />

                        <path d={activePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={aiPath} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {pts.map((p, idx) => {
                          const cAct = getCoords(p.activeMinutes, maxMins, idx);
                          const cAi = getCoords(p.aiRequests, maxAi, idx);
                          const showLabel = pts.length <= 8 || idx === 0 || idx === pts.length - 1 || idx === Math.floor(pts.length / 2) || (pts.length > 8 && idx % Math.ceil(pts.length / 5) === 0);

                          return (
                            <g key={idx}>
                              {showLabel && (
                                <text
                                  x={cAct.x}
                                  y={height - 10}
                                  textAnchor="middle"
                                  fill="var(--text-muted)"
                                  fontSize="10"
                                  fontWeight="600"
                                >
                                  {p.dateStr}
                                </text>
                              )}

                              <circle
                                cx={cAct.x}
                                cy={cAct.y}
                                r="4"
                                fill="#22c55e"
                                stroke="var(--bg-card)"
                                strokeWidth="1.5"
                                style={{ cursor: 'pointer' }}
                              >
                                <title>{`${p.dateStr}: ${p.activeMinutes} active mins`}</title>
                              </circle>
                              <circle
                                cx={cAi.x}
                                cy={cAi.y}
                                r="4"
                                fill="#a855f7"
                                stroke="var(--bg-card)"
                                strokeWidth="1.5"
                                style={{ cursor: 'pointer' }}
                              >
                                <title>{`${p.dateStr}: ${p.aiRequests} AI requests`}</title>
                              </circle>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Sub-tabs list */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 4 }}>
            {[
              { id: 'activity_feed', label: 'Live Activity', icon: Zap },
              { id: 'time_spent', label: 'Time Spent', icon: Activity },
              { id: 'searches', label: 'Searches', icon: Search },
              { id: 'views', label: 'Views', icon: Eye },
              { id: 'actions', label: 'Actions', icon: MousePointerClick },
              { id: 'funnels', label: 'Funnels', icon: GitPullRequest },
              { id: 'ai_audit', label: 'AI Audits', icon: Bot },
              { id: 'user_breakdown', label: 'User Breakdown', icon: Users }
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

          {/* Live Activity Feed */}
          {analyticsSubTab === 'activity_feed' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>System Activity Stream</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0' }}>Chronological feed of user views, clicks, searches, funnel transitions, and AI queries</p>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={feedFilters.views}
                      onChange={(e) => setFeedFilters(prev => ({ ...prev, views: e.target.checked }))}
                      style={{ cursor: 'pointer' }}
                    />
                    Views
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={feedFilters.clicks}
                      onChange={(e) => setFeedFilters(prev => ({ ...prev, clicks: e.target.checked }))}
                      style={{ cursor: 'pointer' }}
                    />
                    Clicks
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={feedFilters.searches}
                      onChange={(e) => setFeedFilters(prev => ({ ...prev, searches: e.target.checked }))}
                      style={{ cursor: 'pointer' }}
                    />
                    Searches
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={feedFilters.ai}
                      onChange={(e) => setFeedFilters(prev => ({ ...prev, ai: e.target.checked }))}
                      style={{ cursor: 'pointer' }}
                    />
                    AI Queries
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={feedFilters.funnels}
                      onChange={(e) => setFeedFilters(prev => ({ ...prev, funnels: e.target.checked }))}
                      style={{ cursor: 'pointer' }}
                    />
                    Funnels
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                {(() => {
                  const items = [];

                  if (feedFilters.views) {
                    dashboard.currViews.forEach(log => {
                      items.push({
                        type: 'view',
                        icon: Eye,
                        iconColor: '#06b6d4',
                        user: log.user_name || 'Anonymous',
                        desc: `viewed catalog product "${log.tool_name}"`,
                        ts: log.created_at
                      });
                    });
                  }

                  if (feedFilters.clicks) {
                    dashboard.currClicks.forEach(log => {
                      items.push({
                        type: 'click',
                        icon: MousePointerClick,
                        iconColor: '#22c55e',
                        user: log.user_name || 'Anonymous',
                        desc: `clicked "${log.action_type}" on product "${log.tool_name}"`,
                        ts: log.created_at
                      });
                    });
                  }

                  if (feedFilters.searches) {
                    dashboard.currSearches.forEach(log => {
                      items.push({
                        type: 'search',
                        icon: Search,
                        iconColor: '#f59e0b',
                        user: log.user_name || 'Anonymous',
                        desc: `searched for "${log.query}"`,
                        ts: log.created_at
                      });
                    });
                  }

                  if (feedFilters.ai) {
                    dashboard.currAi.forEach(log => {
                      items.push({
                        type: 'ai',
                        icon: Bot,
                        iconColor: '#a855f7',
                        user: log.user_name || 'Anonymous',
                        desc: `queried Gemini AI ("${log.prompt.slice(0, 60)}${log.prompt.length > 60 ? '...' : ''}")`,
                        ts: log.created_at
                      });
                    });
                  }

                  if (feedFilters.funnels) {
                    dashboard.currFunnels.forEach(log => {
                      items.push({
                        type: 'funnel',
                        icon: GitPullRequest,
                        iconColor: '#ef4444',
                        user: log.user_name || 'Anonymous',
                        desc: `triggered funnel state "${log.action.toUpperCase()}" for draft ID: ${log.draft_id}`,
                        ts: log.created_at
                      });
                    });
                  }

                  items.sort((a, b) => b.ts - a.ts);

                  if (items.length === 0) {
                    return (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
                        No events match the selected filters or date range.
                      </div>
                    );
                  }

                  const formatRelativeTime = (ts) => {
                    const elapsed = Math.floor(Date.now() / 1000 - ts);
                    if (elapsed < 5) return 'just now';
                    if (elapsed < 60) return `${elapsed}s ago`;
                    const mins = Math.floor(elapsed / 60);
                    if (mins < 60) return `${mins}m ago`;
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return `${hours}h ago`;
                    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  };

                  return items.map((item, idx) => {
                    const Icon = item.icon;
                    const initials = String(item.user).split('@')[0].slice(0, 2).toUpperCase();
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 17, background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }} title={item.user}>
                            {initials}
                          </div>
                          
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700 }}>{item.user}</span>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: item.iconColor, background: `${item.iconColor}12`, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon size={11} />
                            {item.type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right' }}>
                            {formatRelativeTime(item.ts)}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

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
                {filteredSearchQueries.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>"{row.query}"</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Searched <b>{row.count}</b> times</span>
                  </div>
                ))}
                {filteredSearchQueries.length === 0 && (
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
                {filteredVisitedProducts.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.tool_name}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                      {row.count} views
                    </span>
                  </div>
                ))}
                {filteredVisitedProducts.length === 0 && (
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
                {filteredClicksAudits.map((row, idx) => (
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
                {filteredClicksAudits.length === 0 && (
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
                {filteredFunnelAudits.map((row, idx) => (
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
                {filteredFunnelAudits.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No funnel submissions registered.</div>
                )}
              </div>
            </div>
          )}

          {/* AI Audits */}
          {analyticsSubTab === 'ai_audit' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: 0 }}>AI Prompt &amp; Conversation Audit Logs</h3>
                <button onClick={() => exportTelemetryToCSV('ai_audit')} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Export CSV</button>
              </div>

              {/* Search bar */}
              <div style={{ marginBottom: 16 }}>
                <input 
                  type="text" 
                  value={telemetrySearch} 
                  onChange={(e) => setTelemetrySearch(e.target.value)} 
                  placeholder="Filter by user name or email..."
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1px solid var(--border-color)', background: 'var(--bg-main)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {groupedAiAudits.map((group, idx) => {
                  const isExpanded = expandedAiUsers[group.userName];
                  return (
                    <div key={idx} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedAiUsers(prev => ({ ...prev, [group.userName]: !prev[group.userName] }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{group.userName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{group.count} AI interaction{group.count !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div style={{ padding: '0 18px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                          {group.logs.map((log, sidx) => (
                            <AiAuditLogRow key={sidx} row={log} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedAiAudits.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No Gemini usage logs found.</div>
                )}
              </div>
            </div>
          )}

          {/* User Breakdown */}
          {analyticsSubTab === 'user_breakdown' && (
            <div style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
                  User Telemetry &amp; Audit Profile
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, margin: 0 }}>
                  Select a user's email to view a complete breakdown of their activity, time spent, search queries, actions, and AI message history.
                </p>
              </div>

              {/* User Selection Dropdown */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Select User:</span>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none', fontSize: 13, minWidth: 260, fontWeight: 600 }}
                >
                  <option value="">-- Choose a user --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.email} ({u.name})</option>
                  ))}
                </select>
              </div>

              {(() => {
                if (!selectedUserEmail) {
                  return (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: 10, fontSize: 13.5 }}>
                      Please select a user from the dropdown above to generate their detailed profile breakdown.
                    </div>
                  );
                }

                const selectedUser = users.find(u => u.email === selectedUserEmail);
                if (!selectedUser) return <div style={{ color: 'var(--danger)' }}>User data not found.</div>;

                // 1. Filter metrics
                const userTimeLogs = timeSpentData.filter(log => log.user_name === selectedUser.email || log.user_name === selectedUser.name);
                const userSearches = detailedSearchLogs.filter(log => log.user_name === selectedUser.email || log.user_name === selectedUser.name);
                const userClicks = clicksAudits.filter(log => log.user_name === selectedUser.email || log.user_name === selectedUser.name);
                const userFunnels = funnelAudits.filter(log => log.user_name === selectedUser.email || log.user_name === selectedUser.name);
                const userAiAudits = aiAudits.filter(log => log.user_name === selectedUser.email || log.user_name === selectedUser.name);
                
                // count ideas & tools owned
                const userIdeasCount = ideas.filter(i => i.user_id === selectedUser.id).length;
                const userToolsCount = tools.filter(t => t.owner_id === selectedUser.id).length;

                // compute total active vs idle time
                let totalActiveMins = 0;
                let totalIdleMins = 0;
                userTimeLogs.forEach(log => {
                  if (log.page.includes('(Active Time)')) totalActiveMins += log.minutes;
                  if (log.page.includes('(Idle Time)')) totalIdleMins += log.minutes;
                });

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* User Overview Card */}
                    <div style={{ padding: 18, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Full Name</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedUser.name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Role / Department</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{ROLE_LABEL[selectedUser.role] || selectedUser.role}</span>
                          {selectedUser.department && ` • ${selectedUser.department}`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Total Engagement</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          <span style={{ color: '#22c55e' }}>{totalActiveMins.toFixed(1)}m active</span>
                          {' / '}
                          <span style={{ color: 'var(--text-secondary)' }}>{totalIdleMins.toFixed(1)}m idle</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Contributions</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          <b>{userIdeasCount}</b> ideas • <b>{userToolsCount}</b> products
                        </div>
                      </div>
                    </div>

                    {/* Left & Right Grid splits */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                      {/* Left: Page Breakdown & AI Audits */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Page breakdown card */}
                        <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Activity size={15} /> Page Engagement Breakdown
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(() => {
                              // Group time logs by main page
                              const pageGroups = {};
                              userTimeLogs.forEach(log => {
                                const basePage = log.page.replace(' (Active Time)', '').replace(' (Idle Time)', '');
                                if (!pageGroups[basePage]) {
                                  pageGroups[basePage] = { active: 0, idle: 0 };
                                }
                                if (log.page.includes('(Active Time)')) pageGroups[basePage].active += log.minutes;
                                if (log.page.includes('(Idle Time)')) pageGroups[basePage].idle += log.minutes;
                              });

                              const entries = Object.entries(pageGroups).sort((a, b) => (b[1].active + b[1].idle) - (a[1].active + a[1].idle));
                              if (entries.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No page activity logged.</div>;

                              return entries.map(([pname, times], idx) => {
                                const total = times.active + times.idle;
                                const activePct = total > 0 ? (times.active / total) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: idx < entries.length - 1 ? '1px dashed var(--border-color)' : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pname}</span>
                                      <span style={{ color: 'var(--text-secondary)' }}>
                                        Total: <b>{total.toFixed(1)}m</b> ({times.active.toFixed(1)}m active / {times.idle.toFixed(1)}m idle)
                                      </span>
                                    </div>
                                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--border-color)', display: 'flex', overflow: 'hidden' }}>
                                      <div style={{ width: `${activePct}%`, background: '#22c55e', height: '100%' }} title="Active Time" />
                                      <div style={{ flex: 1, background: '#94a3b8', height: '100%' }} title="Idle Time" />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* AI audit trail card */}
                        <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bot size={15} /> AI Conversational History ({userAiAudits.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 350, overflowY: 'auto', paddingRight: 4 }}>
                            {userAiAudits.map((log, sidx) => (
                              <AiAuditLogRow key={sidx} row={log} />
                            ))}
                            {userAiAudits.length === 0 && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No AI usage history logged.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Searches, Actions, Funnel logs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Searches log card */}
                        <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Search size={14} /> Catalog Search Queries ({userSearches.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                            {userSearches.map((log, sidx) => (
                              <div key={sidx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '6px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>"{log.query}"</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(log.created_at * 1000).toLocaleTimeString()}</span>
                              </div>
                            ))}
                            {userSearches.length === 0 && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No searches recorded.</div>
                            )}
                          </div>
                        </div>

                        {/* Action Clicks Card */}
                        <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MousePointerClick size={14} /> Click Actions Trail ({userClicks.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                            {userClicks.map((log, sidx) => (
                              <div key={sidx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                                <div style={{ minWidth: 0 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{log.action_type}</span>
                                  {' on '}
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.tool_name}</span>
                                </div>
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                            ))}
                            {userClicks.length === 0 && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No resource click events logged.</div>
                            )}
                          </div>
                        </div>

                        {/* Funnel submissions card */}
                        <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-main)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GitPullRequest size={14} /> Drafts &amp; Submissions Funnel ({userFunnels.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                            {userFunnels.map((log, sidx) => (
                              <div key={sidx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                                <div>
                                  Action: <span style={{ 
                                    fontWeight: 700, 
                                    color: log.action === 'submit' ? '#22c55e' : log.action === 'start_draft' ? '#3b82f6' : '#ef4444' 
                                  }}>{log.action.toUpperCase()}</span>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Draft ID: {log.draft_id}</div>
                                </div>
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                            ))}
                            {userFunnels.length === 0 && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No submission funnel logs recorded.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          </div>
        );
      })()}

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
                      const res = await api('/admin/backup', { method: 'POST', body: data });
                      alert(res.message || 'Database restored successfully!');
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
