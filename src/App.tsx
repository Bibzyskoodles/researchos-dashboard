import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AdaProvider } from './ada/AdaContext';
import { GamifyProvider } from './gamify/GamifyContext';
import { ResearchProvider } from './context/ResearchContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { IndustryProvider } from './store/IndustryContext';
import { PlatformProvider } from './platform/PlatformProvider';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
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
import AdminPage from './pages/admin/AdminPage';
import InsightsPage from './pages/insights/InsightsPage';
import InsightProjectPage from './pages/insights/InsightProjectPage';
import ReportsPage from './pages/reports/ReportsPage';
import IntegrationsPage from './pages/field-quality/IntegrationsPage';
import OverviewPage from './pages/field-quality/OverviewPage';
import SubmissionDetailPage from './pages/field-quality/SubmissionDetailPage';
import ScorecardPage from './pages/field-quality/ScorecardPage';
import DataCleaningPage from './pages/field-quality/DataCleaningPage';
import LiveInvestigationPage from './pages/field-quality/LiveInvestigationPage';
import SharedReportPage from './pages/reports/SharedReportPage';
import CallReviewQueuePage from './pages/call/CallReviewQueuePage';
import CallScorecardPage from './pages/call/CallScorecardPage';
import CallCapturePage from './pages/call/CallCapturePage';

// The public FieldScore demo is lazy-loaded so its scripted dataset and
// tour machinery never weigh down the main app bundle.
const DemoPage = React.lazy(() => import('./demo/DemoPage'));

// Public Ada-guided deployment configurator (replaces the traditional pricing
// page). Lazy — a visitor who never opens it shouldn't pay for its bundle.
const ConfiguratorPage = React.lazy(() => import('./pages/configure/ConfiguratorPage'));

// Public pricing page and the live "meet Ada" voice session. Both were fully
// built and never routed — the marketing site links to /pricing and /meeting,
// and until these routes existed those links bounced prospects to the login
// form. Lazy for the same bundle reason as the configurator.
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const MeetingAdaPage = React.lazy(() => import('./pages/MeetingAdaPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F0F4FF', fontFamily: 'Inter, sans-serif',
      color: '#6B7280', fontSize: 14,
    }}>
      Loading FieldScore...
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Sends the sidebar's "Questionnaire" item to the active project's design
 *  stage, where the questionnaire workspace actually lives. */
function QuestionnaireRedirect() {
  const { activeProject } = useProject();
  return <Navigate to={activeProject ? `/projects/${activeProject.id}/design` : '/projects'} replace />;
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
      {/* Public: request a reset link, and the emailed link's landing page
          (?token=…). See ResetPasswordPage for the no-existence-oracle rule. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public deployment configurator — no auth, no API calls until the
          visitor chooses to send their configuration. */}
      <Route path="/configure" element={
        <React.Suspense fallback={<div style={{ height: '100vh', background: '#F7F9FC' }} />}>
          <ConfiguratorPage />
        </React.Suspense>
      } />

      {/* Public interactive demo — zero auth, zero API calls, fully scripted */}
      <Route path="/demo" element={
        <React.Suspense fallback={<div style={{ height: '100vh', background: '#0A0F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.5)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>Loading FieldScore demo…</div>}>
          <DemoPage />
        </React.Suspense>
      } />

      {/* Public pricing — every plan including Solo, NGN/USD toggle. The free
          card links to /register; a visitor never needs an account to see a
          price. */}
      <Route path="/pricing" element={
        <React.Suspense fallback={<div style={{ height: '100vh', background: '#F7F9FC' }} />}>
          <PricingPage />
        </React.Suspense>
      } />

      {/* Public live Ada voice session — the marketing site's "Talk to Ada"
          links point here. */}
      <Route path="/meeting" element={
        <React.Suspense fallback={<div style={{ height: '100vh', background: '#0A0F1F' }} />}>
          <MeetingAdaPage />
        </React.Suspense>
      } />

      {/* Public shared report view — no auth, no Sidebar/AppShell. Deliberately
          outside ProtectedRoute: opened by someone outside the org who has no
          FieldScore account (see fieldscore-backend's GET /shared-report/<token>). */}
      <Route path="/shared-report/:token" element={<SharedReportPage />} />

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
        <Route path="projects/:projectId/live" element={<LiveInvestigationPage />} />
        <Route path="projects/:projectId/verify/:id" element={<SubmissionDetailPage />} />
        <Route path="projects/:projectId/verify/enumerators" element={<EnumeratorsPage />} />
        <Route path="projects/:projectId/collect/call/new" element={<CallCapturePage />} />
        <Route path="projects/:projectId/verify/call" element={<CallReviewQueuePage />} />
        <Route path="projects/:projectId/verify/call/:id" element={<CallScorecardPage />} />
        <Route path="projects/:projectId/verify/map" element={<MapPage />} />
        <Route path="projects/:projectId/analyse" element={<AnalyseStagePage />} />
        <Route path="projects/:projectId/report" element={<ReportStagePage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Billing lives as a section inside Settings, but platform/registry.ts
            advertises a "/billing" nav item. Without this route that link fell
            through to the catch-all and silently bounced the user to /projects —
            so the one link a customer clicks to PAY went nowhere. Redirect it to
            the real billing section. */}
        <Route path="billing" element={<Navigate to="/settings" state={{ section: 'billing' }} replace />} />

        {/* Platform admin (server-gated to platform-admin emails; the page
            itself also refuses to render for non-admins). */}
        <Route path="admin" element={<AdminPage />} />

        {/* Cross-project standalone pages */}
        <Route path="overview" element={<OverviewPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="insights/:id" element={<InsightProjectPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="enumerators" element={<EnumeratorsPage />} />
        <Route path="scorecard" element={<ScorecardPage />} />
        <Route path="data-cleaning" element={<DataCleaningPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        {/* Questionnaire design is per-project (DesignStagePage renders it),
            so there is no standalone page to show — but the sidebar advertises
            it as a Professional capability. This used to dump the user on
            /projects with no explanation; now it opens the design stage of the
            project they're already working in, and only falls back to the
            project list when there isn't one. */}
        <Route path="questionnaire" element={<QuestionnaireRedirect />} />
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
