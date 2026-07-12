import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AdaDock from "./AdaDock";
import { useAda } from "../../ada/AdaContext";
import { useIsMobile } from "../../hooks/useIsMobile";

// Pages where a Refresh button is meaningful
const REFRESHABLE = ["/submissions", "/overview", "/enumerators", "/map"];

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { store, setOpen } = useAda();
  const lastCmdSeq = useRef<number | null>(null);
  const [adaToast, setAdaToast] = useState<string | null>(null);
  const isMobile = useIsMobile(820);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Pull the organisation's shared Trust Index scoring policy once per app
  // load — without this, each browser scores from its own private
  // localStorage config and two supervisors can see different numbers for
  // the same submission.
  useEffect(() => {
    import("../../services/engineConfig").then(({ syncEngineConfigFromServer }) => {
      syncEngineConfigFromServer();
    });
  }, []);

  // Execute Ada commands
  useEffect(() => {
    const cmd = store.command;
    if (!cmd) return;
    if (lastCmdSeq.current === cmd.seq) return;
    lastCmdSeq.current = cmd.seq;

    switch (cmd.type) {
      case 'NAVIGATE_TO':
        navigate(cmd.path, cmd.state ? { state: cmd.state } : undefined);
        setOpen(false);
        break;

      case 'OPEN_SETTINGS_SECTION':
        navigate('/settings', { state: { section: cmd.section } });
        setOpen(false);
        showToast(`Opening ${cmd.label}`);
        break;

      case 'CREATE_PROJECT':
        navigate('/projects/new');
        setOpen(false);
        showToast('Opening new project wizard');
        break;

      case 'FILTER_SUBMISSIONS':
        window.dispatchEvent(new CustomEvent('ada:filter_submissions', { detail: { verdict: cmd.verdict } }));
        showToast(cmd.verdict === 'ALL' ? 'Showing all submissions' : `Filtered to ${cmd.verdict.toLowerCase()} submissions`);
        break;

      case 'HIGHLIGHT_ENUMERATOR':
        window.dispatchEvent(new CustomEvent('ada:highlight_enumerator', { detail: { id: cmd.id } }));
        showToast(`Highlighting enumerator ${cmd.id}`);
        break;

      case 'CHANGE_SETTING':
        window.dispatchEvent(new CustomEvent('ada:change_setting', { detail: { key: cmd.key, value: cmd.value } }));
        showToast(cmd.label);
        break;

      case 'SHOW_TOAST':
        showToast(cmd.message);
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.command]);

  function showToast(msg: string) {
    setAdaToast(msg);
    setTimeout(() => setAdaToast(null), 3000);
  }

  // Quiet milestone notifications from the rewards layer (GamifyContext)
  useEffect(() => {
    const onMilestone = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setAdaToast(detail.message);
        setTimeout(() => setAdaToast(null), 5000);
      }
    };
    window.addEventListener('fs-milestone', onMilestone);
    return () => window.removeEventListener('fs-milestone', onMilestone);
  }, []);

  const handleRefresh = REFRESHABLE.includes(location.pathname)
    ? () => window.dispatchEvent(new Event("researchos:refresh"))
    : undefined;

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#F0F4FF", fontFamily: "Inter, sans-serif",
    }}>
      {/* Desktop sidebar — always visible above 820px */}
      {!isMobile && <Sidebar />}

      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {isMobile && drawerOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(8,13,26,.55)",
              zIndex: 300,
            }}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobile && drawerOpen && (
          <motion.div
            key="drawer"
            initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 301, width: 240 }}
          >
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar onRefresh={handleRefresh} onMenuToggle={isMobile ? () => setDrawerOpen(o => !o) : undefined} />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "24px" }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <AdaDock />

      {/* Ada command toast */}
      <AnimatePresence>
        {adaToast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", bottom: 110, left: "50%", transform: "translateX(-50%)",
              zIndex: 1100, background: "#080D1A", color: "white",
              padding: "10px 18px 10px 14px", borderRadius: 10,
              fontSize: 13, fontWeight: 600, fontFamily: "Inter,sans-serif",
              boxShadow: "0 4px 24px rgba(8,13,26,.32)",
              display: "flex", alignItems: "center", gap: 10,
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
            </div>
            {adaToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
