import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AdaProvider } from './ada/AdaContext';

// Layouts
import AppShell from './components/layout/AppShell';

// Pages
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/field-quality/OverviewPage';
import SubmissionsPage from './pages/field-quality/SubmissionsPage';
import EnumeratorsPage from './pages/field-quality/EnumeratorsPage';
import MapPage from './pages/field-quality/MapPage';
import InsightsPage from './pages/insights/InsightsPage';
import ReportsPage from './pages/reports/ReportsPage';

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
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="enumerators" element={<EnumeratorsPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
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
