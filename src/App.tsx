import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { IndustryProvider } from './store/IndustryContext';
import { SettingsProvider } from './store/SettingsContext';
import { PlatformProvider } from './platform/PlatformProvider';
import { AdaProvider } from './ada/AdaContext';
import { GuidedExperienceProvider } from './ada/GuidedExperienceContext';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/field-quality/OverviewPage';
import SubmissionDetailPage from "./pages/field-quality/SubmissionDetailPage";
import SubmissionsPage from './pages/field-quality/SubmissionsPage';
import EnumeratorsPage from './pages/field-quality/EnumeratorsPage';
import MapPage from './pages/field-quality/MapPage';
import DataCleaningPage from './pages/field-quality/DataCleaningPage';
import ScorecardPage from './pages/field-quality/ScorecardPage';
import InsightsPage from './pages/insights/InsightsPage';
import InsightProjectPage from './pages/insights/InsightProjectPage';
import OutcomeIntelligencePage from './pages/insights/OutcomeIntelligencePage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import IntegrationsPage from './pages/field-quality/IntegrationsPage';
import PricingPage from './pages/PricingPage';
import QuestionnairePage from './pages/questionnaire/QuestionnairePage';
import PublicPreview from './pages/questionnaire/PublicPreview';
import MeetingAdaPage from './pages/MeetingAdaPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F0F4FF', fontFamily: 'Inter, sans-serif',
      color: '#6B7280', fontSize: 14
    }}>
      Loading ResearchOS...
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/meeting" element={<MeetingAdaPage />} />
      <Route path="/preview/:token" element={<PublicPreview />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="enumerators" element={<EnumeratorsPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="clean" element={<DataCleaningPage />} />
        <Route path="scorecard" element={<ScorecardPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="insights/:id" element={<InsightProjectPage />} />
        <Route path="outcome" element={<OutcomeIntelligencePage />} />
        <Route path="questionnaire" element={<QuestionnairePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <IndustryProvider>
          <SettingsProvider>
            <PlatformProvider>
              <AdaProvider>
                <GuidedExperienceProvider>
                  <AppRoutes />
                </GuidedExperienceProvider>
              </AdaProvider>
            </PlatformProvider>
          </SettingsProvider>
        </IndustryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
