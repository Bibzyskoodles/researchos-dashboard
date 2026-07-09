import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AdaDock from "./AdaDock";
import ErrorBoundary from "../ErrorBoundary";
import GuidedOverlay from "../ada/GuidedOverlay";
import ExperienceLauncher from "../ada/ExperienceLauncher";
import WelcomeModal from "../onboarding/WelcomeModal";
import { GuidedExperienceProvider } from "../../ada/GuidedExperienceContext";
import { useAda } from "../../ada/AdaContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../store/AuthContext";

const REFRESHABLE = ["/submissions", "/overview", "/enumerators", "/map"];

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  useAda();

  useEffect(() => {
    if (!user) return;
    const key = `researchos_welcomed_${user.id}`;
    if (!localStorage.getItem(key)) {
      setShowWelcome(true);
    }
  }, [user]);

  const dismissWelcome = () => {
    if (user) {
      localStorage.setItem(`researchos_welcomed_${user.id}`, '1');
    }
    setShowWelcome(false);
  };

  const handleRefresh = REFRESHABLE.includes(location.pathname)
    ? () => window.dispatchEvent(new Event("researchos:refresh"))
    : undefined;

  return (
    <GuidedExperienceProvider>
      <div style={{
        display: "flex", height: "100vh", overflow: "hidden",
        background: "#F0F4FF", fontFamily: "Inter, sans-serif",
      }}>
        {/* Mobile backdrop */}
        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                zIndex: 199, touchAction: 'none',
              }}
            />
          )}
        </AnimatePresence>

        <Sidebar
          isMobile={isMobile}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar
            onRefresh={handleRefresh}
            onMenuClick={isMobile ? () => setSidebarOpen(o => !o) : undefined}
          />
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "24px" }}
            >
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </motion.main>
          </AnimatePresence>
        </div>
        <AdaDock />
        <GuidedOverlay />
        <ExperienceLauncher />
        {showWelcome && <WelcomeModal onDismiss={dismissWelcome} />}
      </div>
    </GuidedExperienceProvider>
  );
}
