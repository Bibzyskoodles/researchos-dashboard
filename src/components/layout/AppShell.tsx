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

// Engine-config keys (scoring thresholds/weights) — client-side config,
// shared across the org via engineConfig's own sync, not the org-settings API.
const ENGINE_KEY_PATH: Record<string, [string] | [string, string]> = {
  passScoreThreshold: ['passThreshold'],
  flagScoreThreshold: ['flagThreshold'],
  minDurationMins: ['minDurationMins'],
  maxDurationMins: ['maxDurationMins'],
  gpsToleranceMeters: ['gpsToleranceMeters'],
  weight_gps: ['weights', 'gps'],
  weight_duration: ['weights', 'duration'],
  weight_image: ['weights', 'image'],
  weight_audio: ['weights', 'audio'],
  weight_duplicate: ['weights', 'duplicate'],
};

// Ada's advertised setting keys → the real backend field each one maps to.
// This used to be handled by a listener that only existed inside the
// Settings page component — so changing a setting while on any other page
// silently did nothing, while AppShell still showed a "changed" toast
// regardless of whether anything was actually persisted. Applying the
// change here instead (AppShell is always mounted) makes it work from
// anywhere, and the toast now reflects what actually happened.
const ADA_PROFILE_KEYS = new Set(['timezone']);
const ADA_TO_ORG_SETTINGS_FIELD: Record<string, string> = {
  adaPersonality: 'ada_personality',
  adaProactive: 'ada_proactive',
  adaGuidance: 'ada_element_guidance',
  adaBrief: 'ada_daily_brief',
  adaCelebrations: 'ada_celebrations',
  brandPrimaryColor: 'brand_primary_color',
  brandAccentColor: 'brand_accent_color',
  brandFooter: 'brand_footer',
};

/**
 * Apply one Ada CHANGE_SETTING command for real. Returns a human-readable
 * result so the caller can show an honest toast (not just an optimistic
 * "changed!" regardless of what actually happened).
 */
async function applyAdaSetting(key: string, value: unknown): Promise<{ ok: boolean; message: string }> {
  const { orgSettingsApi } = await import('../../services/api');

  // Scoring engine — client-side shared config.
  const enginePath = ENGINE_KEY_PATH[key];
  if (enginePath) {
    const { loadEngineConfig, saveEngineConfig } = await import('../../services/engineConfig');
    const current = loadEngineConfig();
    if (enginePath.length === 1) {
      (current as any)[enginePath[0]] = value;
    } else {
      (current as any)[enginePath[0]] = { ...(current as any)[enginePath[0]], [enginePath[1]]: value };
    }
    saveEngineConfig(current);
    return { ok: true, message: `${key} updated` };
  }

  // Org profile field (flat column, safe to send alone).
  if (ADA_PROFILE_KEYS.has(key)) {
    await orgSettingsApi.updateSettings({ [key]: value });
    return { ok: true, message: `${key} updated` };
  }

  // Ada personality/branding fields — /api/org/settings merges these
  // server-side (see org_settings_routes.py), so a single-key PUT is safe.
  if (ADA_TO_ORG_SETTINGS_FIELD[key]) {
    await orgSettingsApi.updateSettings({ [ADA_TO_ORG_SETTINGS_FIELD[key]]: value });
    return { ok: true, message: `${key} updated` };
  }

  // Notifications — a per-event × per-channel matrix, not a single flag.
  // The PUT replaces the whole blob, so this reads current prefs, flips
  // the requested channel across every event, and writes the merged
  // object back rather than overwriting everything else to blank.
  const NOTIFY_CHANNEL: Record<string, string> = {
    notifyEmail: 'email', notifySlack: 'slack', notifyInApp: 'inapp',
  };
  if (NOTIFY_CHANNEL[key]) {
    const channel = NOTIFY_CHANNEL[key];
    const current = (await orgSettingsApi.getNotifications()).data || {};
    const merged: Record<string, Record<string, boolean>> = { ...current };
    for (const event of Object.keys(merged)) {
      merged[event] = { ...merged[event], [channel]: Boolean(value) };
    }
    await orgSettingsApi.updateNotifications(merged);
    return { ok: true, message: `${channel} notifications ${value ? 'enabled' : 'disabled'}` };
  }

  // Security — same whole-blob-replace concern as notifications. 'twoFa' is
  // deliberately not handled here — 2FA isn't enforced at login in this
  // deployment, so there's no real setting for Ada to change (see
  // adaSafeguards.ts's ALLOWED_SETTING_KEYS, which already rejects the key
  // before a command carrying it could ever reach this function).
  if (key === 'sessionTimeout') {
    const current = (await orgSettingsApi.getSecurity()).data || {};
    const merged = {
      sso_enabled: current.sso_enabled ?? false,
      session_timeout_mins: Number(value),
      ip_allowlist: current.ip_allowlist ?? [],
    };
    await orgSettingsApi.updateSecurity(merged);
    return { ok: true, message: `${key} updated` };
  }

  return { ok: false, message: `"${key}" isn't wired to a real setting yet — no change made` };
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { store, setOpen, addMessage } = useAda();
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
        // Still fired for any page-local listeners (e.g. the scoring
        // engine's own live-preview UI), but the toast now reflects what
        // actually got persisted — applyAdaSetting is the one place that
        // does the real write, so it works regardless of which page the
        // user is on when Ada makes the change.
        window.dispatchEvent(new CustomEvent('ada:change_setting', {
          detail: { key: cmd.key, value: cmd.value, scope: cmd.scope, project_id: cmd.project_id }
        }));
        applyAdaSetting(cmd.key, cmd.value)
          .then(r => showToast(r.ok ? cmd.label : `Couldn't apply that — ${r.message}`))
          .catch(() => showToast(`Couldn't save "${cmd.key}" — please try again or change it in Settings.`));
        break;

      case 'RESCORE_PROJECT': {
        const rescoreId = cmd.project_id;
        showToast('Rescoring project…');
        import('../../services/api').then(({ default: api }) => {
          api.post(`/api/projects/${rescoreId}/rescore-all`).catch(() => showToast('Rescore failed — please try again.'));
        });
        break;
      }

      case 'BRIDGE_SYNC': {
        const syncId = cmd.project_id;
        showToast('Syncing to AI analysis…');
        import('../../services/api').then(({ default: api }) => {
          api.post(`/api/projects/${syncId}/ai-upload`, {}).catch(() => showToast('Sync failed — please try again.'));
        });
        break;
      }

      case 'CONFIRM_DELETE_PROJECT':
        // Never deletes anything here — just surfaces a confirmation card
        // in the chat. AdaDock renders the card and makes the actual
        // DELETE call (with the server re-verifying the project is empty)
        // only when the user clicks it.
        addMessage({
          id: `confirm-${cmd.project_id}-${cmd.seq}`,
          role: 'assistant',
          content: `I'd like to delete "${cmd.project_name}" — it looks like an empty duplicate. Confirm?`,
          timestamp: new Date().toISOString(),
          confirmAction: { type: 'delete_project', project_id: cmd.project_id, project_name: cmd.project_name },
        });
        break;

      case 'SWITCH_PROJECT':
        navigate(`/projects/${cmd.id}`);
        setOpen(false);
        break;

      case 'GENERATE_REPORT':
        // Navigate to the InsightScore project and trigger download via event
        navigate(`/insights/${cmd.project_id}?tab=intelligence`);
        setOpen(false);
        window.dispatchEvent(new CustomEvent('ada:generate_report', {
          detail: { project_id: cmd.project_id, format: cmd.format }
        }));
        showToast(`Generating ${cmd.format.toUpperCase()} report…`);
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
