import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HubLayout, { isPageAllowed } from './components/hub/HubLayout';
import CatalogView from './components/catalog/CatalogView';
import ToolPage from './components/catalog/ToolPage';
import IdeaPipelineView from './components/ideas/IdeaPipelineView';
import VoiceBoard from './components/ideas/VoiceBoard';
import RoadmapView from './components/roadmap/RoadmapView';
import SettingsView from './components/settings/SettingsView';
import AdminCenter from './components/admin/AdminCenter';
import InboxView from './components/inbox/InboxView';
import ManageView from './components/manage/ManageView';
import ReviewCenter from './components/review/ReviewCenter';
import AuthView from './components/auth/AuthView';
import AIChatView from './components/chat/AIChatView';
import PromoWalkthrough from './components/promo/PromoWalkthrough';
import MyOrganization from './components/manage/MyOrganization';
import { useAuthStore } from './store/useAuthStore';
import './index.css';

function getFallbackRoute(user) {
  if (!user) return "/auth";
  if (user.role === 'admin') return "/catalog";
  const allowed = user.permissions?.allowed_pages;
  if (!allowed) return "/catalog";
  
  if (allowed.includes('catalog')) return "/catalog";
  if (allowed.includes('roadmap')) return "/roadmap";
  if (allowed.includes('settings')) return "/settings";
  return "/manage";
}

function GuardedRoute({ element, to }) {
  const user = useAuthStore((s) => s.user);
  if (!isPageAllowed(to, user)) {
    const fallback = getFallbackRoute(user);
    if (fallback === to) {
      return (
        <div style={{ height: '80vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Access Restricted</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 16px', fontSize: 14 }}>
              Your account permissions do not allow viewing this section. Please contact your organization manager.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to={fallback} replace />;
  }
  return element;
}

function App() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const init = useAuthStore((s) => s.init);

  useEffect(() => { init(); }, [init]);

  if (!ready) {
    return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  }
  return (
    <Router>
      {!user ? (
        <AuthView />
      ) : (
        <HubLayout>
          <Routes>
            <Route path="/catalog" element={<GuardedRoute to="/catalog" element={<CatalogView />} />} />
            <Route path="/tools/:id" element={<GuardedRoute to="/catalog" element={<ToolPage />} />} />
            <Route path="/chat" element={<GuardedRoute to="/chat" element={<AIChatView />} />} />
            <Route path="/ideas" element={<IdeaPipelineView />} />
            <Route path="/voice" element={<GuardedRoute to="/voice" element={<VoiceBoard />} />} />
            <Route path="/roadmap" element={<GuardedRoute to="/roadmap" element={<RoadmapView />} />} />
            <Route path="/review" element={<ReviewCenter />} />
            <Route path="/admin" element={<GuardedRoute to="/admin" element={<AdminCenter />} />} />
            <Route path="/org-management" element={<GuardedRoute to="/org-management" element={<MyOrganization />} />} />
            <Route path="/inbox" element={<InboxView />} />
            <Route path="/manage" element={<ManageView />} />
            <Route path="/settings" element={<GuardedRoute to="/settings" element={<SettingsView />} />} />
            <Route path="/promo" element={<PromoWalkthrough />} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
        </HubLayout>
      )}
    </Router>
  );
}

export default App;
