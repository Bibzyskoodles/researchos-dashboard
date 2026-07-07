import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ErrorBoundary from "../ErrorBoundary";
import AdaDock from "./AdaDock";
import { useAda } from "../../ada/AdaContext";

export default function AppShell() {
  const location = useLocation();
  useAda();

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#F0F4FF", fontFamily: "Inter, sans-serif",
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ flex: 1, overflowY: "auto", padding: "24px" }}
          >
            <ErrorBoundary><Outlet /></ErrorBoundary>
          </motion.main>
        </AnimatePresence>
      </div>
      <AdaDock />
    </div>
  );
}
