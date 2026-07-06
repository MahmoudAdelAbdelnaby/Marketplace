import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HubLayout from './components/hub/HubLayout';
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
import { useAuthStore } from './store/useAuthStore';
import './index.css';

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
            <Route path="/catalog" element={<CatalogView />} />
            <Route path="/tools/:id" element={<ToolPage />} />
            <Route path="/chat" element={<AIChatView />} />
            <Route path="/ideas" element={<IdeaPipelineView />} />
            <Route path="/voice" element={<VoiceBoard />} />
            <Route path="/roadmap" element={<RoadmapView />} />
            <Route path="/review" element={<ReviewCenter />} />
            <Route path="/admin" element={<AdminCenter />} />
            <Route path="/inbox" element={<InboxView />} />
            <Route path="/manage" element={<ManageView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
        </HubLayout>
      )}
    </Router>
  );
}

export default App;
