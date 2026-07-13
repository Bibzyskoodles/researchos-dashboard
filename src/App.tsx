import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AdaProvider } from './ada/AdaContext';
import { GamifyProvider } from './gamify/GamifyContext';
import { ResearchProvider } from './context/ResearchContext';
import { ProjectProvider } from './context/ProjectContext';
import { IndustryProvider } from './store/IndustryContext';
import { PlatformProvider } from './platform/PlatformProvider';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import CreateProjectPage from './pages/projects/CreateProjectPage';
import ProjectPage from './pages/projects/ProjectPage';
import DesignStagePage from './pages/stages/DesignStagePage';
import CollectStagePage from './pages/stages/CollectStagePage';
import VerifyStagePage from './pages/stages/VerifyStagePage';
import AnalyseStagePage from './pages/stages/AnalyseStagePage';
import ReportStagePage from './pages/stages/ReportStagePage';
import SubmissionsPage from './pages/field-quality/SubmissionsPage';
import EnumeratorsPage from './pages/field-quality/EnumeratorsPage';
import MapPage from './pages/field-quality/MapPage';
import SettingsPage from './pages/settings/SettingsPage';
import InsightsPage from './pages/insights/InsightsPage';
import ReportsPage from './pages/reports/ReportsPage';
import IntegrationsPage from './pages/field-quality/IntegrationsPage';
import OverviewPage from './pages/field-quality/OverviewPage';
import SubmissionDetailPage from './pages/field-quality/SubmissionDetailPage';
import ScorecardPage from './pages/field-quality/ScorecardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F0F4FF', fontFamily: 'Inter, sans-serif',
      color: '#6B7280', fontSize: 14,
    }}>
      Loading ResearchOS...
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Wrap AppShell in a single ProjectProvider so Sidebar always has project context
function AppShellWithProject() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <ResearchProvider>
            <AppShellWithProject />
          </ResearchProvider>
        </ProtectedRoute>
      }>
        {/* Root redirect */}
        <Route index element={<Navigate to="/projects" replace />} />

        {/* Projects hub */}
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<CreateProjectPage />} />

        {/* Project detail + stages */}
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/design" element={<DesignStagePage />} />
        <Route path="projects/:projectId/collect" element={<CollectStagePage />} />
        <Route path="projects/:projectId/verify" element={<VerifyStagePage />} />
        <Route path="projects/:projectId/verify/:id" element={<SubmissionDetailPage />} />
        <Route path="projects/:projectId/verify/enumerators" element={<EnumeratorsPage />} />
        <Route path="projects/:projectId/verify/map" element={<MapPage />} />
        <Route path="projects/:projectId/analyse" element={<AnalyseStagePage />} />
        <Route path="projects/:projectId/report" element={<ReportStagePage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Cross-project standalone pages */}
        <Route path="overview" element={<OverviewPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="insights/:id" element={<Navigate to="/insights" replace />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="enumerators" element={<EnumeratorsPage />} />
        <Route path="scorecard" element={<ScorecardPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="questionnaire" element={<Navigate to="/projects" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <IndustryProvider>
          <PlatformProvider>
            <AdaProvider>
              <GamifyProvider>
                <AppRoutes />
              </GamifyProvider>
            </AdaProvider>
          </PlatformProvider>
        </IndustryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
