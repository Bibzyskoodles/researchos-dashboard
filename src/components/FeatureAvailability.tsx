import React, { useEffect, useState } from "react";
import { licensingApi } from "../services/api";
import { motion } from "framer-motion";
import styles from "./FeatureAvailability.module.css";

interface FeatureAvailabilityProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLocked?: boolean;
}

export function FeatureAvailable({ feature, children, fallback, showLocked = true }: FeatureAvailabilityProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [license, setLicense] = useState<any>(null);

  useEffect(() => {
    checkFeatureAvailability();
    // Refresh every 5 minutes to catch license changes
    const interval = setInterval(checkFeatureAvailability, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [feature]);

  async function checkFeatureAvailability() {
    try {
      const licenseData = await licensingApi.getLicense();
      if (licenseData?.features?.[feature]) {
        setAvailable(true);
        setLicense(licenseData);
      } else {
        setAvailable(false);
        setLicense(licenseData);
      }
    } catch {
      // Assume feature is available if license check fails (don't block functionality)
      setAvailable(true);
    }
  }

  if (available === null) {
    return <>{children}</>;
  }

  if (!available) {
    if (!showLocked) {
      return <>{fallback || null}</>;
    }

    return (
      <motion.div
        className={styles.lockedContainer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className={styles.lockedOverlay}>
          <div className={styles.lockedContent}>
            <span className={styles.icon}>🔒</span>
            <p className={styles.message}>
              {feature.replace(/_/g, " ")} is not available on your current plan
            </p>
            <a href="/account/billing" className={styles.upgradeLink}>
              Upgrade to unlock
            </a>
          </div>
        </div>
        <div className={styles.blurredContent}>{children}</div>
      </motion.div>
    );
  }

  return <>{children}</>;
}

interface FeatureBadgeProps {
  feature: string;
  inline?: boolean;
}

export function FeatureBadge({ feature, inline = false }: FeatureBadgeProps) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkFeatureAvailability();
  }, [feature]);

  async function checkFeatureAvailability() {
    try {
      const licenseData = await licensingApi.getLicense();
      setAvailable(licenseData?.features?.[feature] || false);
    } catch {
      setAvailable(true);
    }
  }

  if (available === null || available) {
    return null;
  }

  const className = inline ? styles.badgeInline : styles.badge;

  return (
    <span className={className}>
      <span className={styles.badgeIcon}>🔒</span>
      Premium
    </span>
  );
}

interface LicenseExpiryCountdownProps {
  compact?: boolean;
}

export function LicenseExpiryCountdown({ compact = false }: LicenseExpiryCountdownProps) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<"active" | "expiring" | "expired">("active");

  useEffect(() => {
    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function checkExpiry() {
    try {
      const licenseData = await licensingApi.getLicense();
      if (licenseData?.expires_at) {
        const expiryDate = new Date(licenseData.expires_at);
        const now = new Date();
        const days = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        setDaysRemaining(days);

        if (licenseData.status === "expired") {
          setStatus("expired");
        } else if (days <= 30) {
          setStatus("expiring");
        } else {
          setStatus("active");
        }
      }
    } catch {
      // Silently fail if license check fails
    }
  }

  if (daysRemaining === null) {
    return null;
  }

  if (status === "active" && daysRemaining > 30) {
    return null;
  }

  const className = compact ? styles.countdownCompact : styles.countdown;
  const bgColor = status === "expired" ? "#FEE2E2" : status === "expiring" ? "#FEF3C7" : "#D1FAE5";
  const textColor = status === "expired" ? "#7F1D1D" : status === "expiring" ? "#92400E" : "#065F46";

  return (
    <motion.div
      className={className}
      style={{ background: bgColor, color: textColor }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {status === "expired" ? (
        <>
          <span className={styles.icon}>⚠️</span>
          <span className={styles.text}>License expired</span>
          <a href="/account/billing" className={styles.link}>
            Renew now
          </a>
        </>
      ) : (
        <>
          <span className={styles.icon}>📅</span>
          <span className={styles.text}>{daysRemaining} days left</span>
          <a href="/account/billing" className={styles.link}>
            Manage
          </a>
        </>
      )}
    </motion.div>
  );
}
