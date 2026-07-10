import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AdaProvider } from './ada/AdaContext';
import { ResearchProvider } from './context/ResearchContext';
import { ProjectProvider } from './context/ProjectContext';
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

function LegacySubmissionRedirect() {
  useParams<{ id: string }>();
  return <Navigate to="/projects" replace />;
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
        <Route path="projects/:projectId/verify/:submissionId" element={<SubmissionsPage />} />
        <Route path="projects/:projectId/verify/enumerators" element={<EnumeratorsPage />} />
        <Route path="projects/:projectId/verify/map" element={<MapPage />} />
        <Route path="projects/:projectId/analyse" element={<AnalyseStagePage />} />
        <Route path="projects/:projectId/report" element={<ReportStagePage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Legacy redirects */}
        <Route path="overview" element={<Navigate to="/projects" replace />} />
        <Route path="submissions" element={<Navigate to="/projects" replace />} />
        <Route path="submissions/:id" element={<LegacySubmissionRedirect />} />
        <Route path="insights" element={<Navigate to="/projects" replace />} />
        <Route path="insights/:id" element={<Navigate to="/projects" replace />} />
        <Route path="reports" element={<Navigate to="/projects" replace />} />
        <Route path="questionnaire" element={<Navigate to="/projects" replace />} />
        <Route path="enumerators" element={<Navigate to="/projects" replace />} />
        <Route path="map" element={<Navigate to="/projects" replace />} />
        <Route path="integrations" element={<Navigate to="/projects" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdaProvider>
          <AppRoutes />
        </AdaProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
