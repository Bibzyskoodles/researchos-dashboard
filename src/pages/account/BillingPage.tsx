import React, { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { licensingApi } from "../../services/api";
import { motion } from "framer-motion";
import styles from "./BillingPage.module.css";

interface License {
  org_id: string;
  tier: "free" | "basic" | "professional" | "enterprise";
  status: "active" | "expired" | "suspended";
  expires_at: string;
  max_users: number;
  max_submissions: number;
  features: Record<string, boolean>;
}

interface Usage {
  org_id: string;
  current_month: string;
  submissions_used: number;
  submissions_limit: number;
  percentage_used: number;
  remaining: number;
}

interface WhiteLabel {
  org_id: string;
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  custom_domain?: string;
}

const PLAN_DETAILS: Record<string, any> = {
  free: {
    name: "Free",
    price: "$0/month",
    submissions: "100/month",
    features: ["Basic quality checks", "Email support"],
    color: "#9CA3AF",
  },
  basic: {
    name: "Basic",
    price: "$99/month",
    submissions: "1,000/month",
    features: ["All quality checks", "Image verification", "Priority support"],
    color: "#3B82F6",
  },
  professional: {
    name: "Professional",
    price: "$499/month",
    submissions: "10,000/month",
    features: ["All quality checks", "Image & audio verification", "AI insights", "Priority support"],
    color: "#8B5CF6",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    submissions: "Unlimited",
    features: ["All features", "Custom integrations", "Dedicated support", "SLA guarantee"],
    color: "#EC4899",
  },
};

export default function BillingPage() {
  const [license, setLicense] = useState<License | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewTier, setRenewTier] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState(365);

  useEffect(() => {
    loadLicenseData();
  }, []);

  async function loadLicenseData() {
    try {
      setLoading(true);
      const [licenseData, usageData, whiteLabelData] = await Promise.all([
        licensingApi.getLicense().catch(() => null),
        licensingApi.getUsage().catch(() => null),
        licensingApi.getWhiteLabel().catch(() => null),
      ]);
      setLicense(licenseData);
      setUsage(usageData);
      setWhiteLabel(whiteLabelData);
    } catch (err: any) {
      setError(err.message || "Failed to load license data");
    } finally {
      setLoading(false);
    }
  }

  async function handleRenew() {
    if (!renewTier) return;
    try {
      await licensingApi.renewLicense({ tier: renewTier, expires_in_days: renewDays });
      setRenewTier(null);
      loadLicenseData();
    } catch (err: any) {
      setError(err.message || "Failed to renew license");
    }
  }

  const expireDate = license ? new Date(license.expires_at) : null;
  const daysUntilExpiry = expireDate
    ? Math.ceil((expireDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const planColor = license ? PLAN_DETAILS[license.tier]?.color : "#9CA3AF";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Billing & License</h1>
        <p>Manage your subscription and usage</p>
      </div>

      {error && (
        <motion.div className={styles.errorBanner} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </motion.div>
      )}

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading license information...</p>
        </div>
      ) : (
        <>
          {/* Current License Card */}
          <motion.div
            className={styles.licenseCard}
            style={{ borderLeftColor: planColor }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.licenseHeader}>
              <div>
                <h2>Current Plan</h2>
                <p className={styles.tierName} style={{ color: planColor }}>
                  {license ? PLAN_DETAILS[license.tier]?.name : "Unknown"}
                </p>
              </div>
              <div className={styles.statusBadge} data-status={license?.status}>
                {license?.status?.toUpperCase()}
              </div>
            </div>

            {license && (
              <div className={styles.licenseDetails}>
                <div className={styles.detailRow}>
                  <span>Monthly Price</span>
                  <strong>{PLAN_DETAILS[license.tier]?.price}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Submissions/Month</span>
                  <strong>{PLAN_DETAILS[license.tier]?.submissions}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Max Users</span>
                  <strong>{license.max_users || "Unlimited"}</strong>
                </div>
                {expireDate && (
                  <div className={styles.detailRow} style={{ color: daysUntilExpiry! < 30 ? "#DC2626" : "inherit" }}>
                    <span>License Expires</span>
                    <strong>
                      {expireDate.toLocaleDateString()} ({daysUntilExpiry} days)
                    </strong>
                  </div>
                )}
              </div>
            )}

            {license?.status === "expired" && (
              <div className={styles.actionButton} style={{ background: "#DC2626" }}>
                ⚠️ License Expired — Renew to continue using
              </div>
            )}
          </motion.div>

          {/* Usage Card */}
          {usage && (
            <motion.div
              className={styles.usageCard}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2>Monthly Usage</h2>
              <div className={styles.usageMetrics}>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Submissions Used</div>
                  <div className={styles.metricValue}>{usage.submissions_used.toLocaleString()}</div>
                  <div className={styles.metricLimit}>of {usage.submissions_limit.toLocaleString()} allowed</div>
                </div>

                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(usage.percentage_used, 100)}%`,
                      background:
                        usage.percentage_used > 90
                          ? "#DC2626"
                          : usage.percentage_used > 70
                            ? "#F59E0B"
                            : "#10B981",
                    }}
                  />
                </div>

                <div className={styles.metricSummary}>
                  <span>{usage.percentage_used.toFixed(1)}% used</span>
                  <span>{usage.remaining.toLocaleString()} remaining</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Features Card */}
          {license && (
            <motion.div
              className={styles.featuresCard}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2>Included Features</h2>
              <div className={styles.featureList}>
                {Object.entries(license.features).map(([feature, enabled]) => (
                  <div key={feature} className={styles.featureItem} data-enabled={enabled}>
                    <span className={styles.featureIcon}>{enabled ? "✓" : "−"}</span>
                    <span className={styles.featureName}>{feature.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Upgrade Options */}
          {license && license.tier !== "enterprise" && (
            <motion.div
              className={styles.upgradeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2>Upgrade Your Plan</h2>
              <div className={styles.upgradeOptions}>
                {(["basic", "professional", "enterprise"] as const)
                  .filter((tier) => tier !== license.tier)
                  .map((tier) => (
                    <motion.div
                      key={tier}
                      className={styles.upgradeCard}
                      whileHover={{ y: -5 }}
                      onClick={() => {
                        setRenewTier(tier);
                      }}
                    >
                      <div className={styles.upgradeName}>{PLAN_DETAILS[tier].name}</div>
                      <div className={styles.upgradePrice}>{PLAN_DETAILS[tier].price}</div>
                      <div className={styles.upgradeFeatures}>
                        {PLAN_DETAILS[tier].features.slice(0, 3).map((feat: string) => (
                          <div key={feat} className={styles.upgradeFeature}>
                            ✓ {feat}
                          </div>
                        ))}
                      </div>
                      <button className={styles.upgradeBtn}>Upgrade to {PLAN_DETAILS[tier].name}</button>
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Renewal Modal */}
          {renewTier && (
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setRenewTier(null)}
            >
              <motion.div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3>Renew License</h3>
                <p>
                  Upgrade to <strong>{PLAN_DETAILS[renewTier].name}</strong>
                </p>

                <div className={styles.renewOptions}>
                  <label>
                    <input
                      type="radio"
                      value="30"
                      checked={renewDays === 30}
                      onChange={(e) => setRenewDays(Number(e.target.value))}
                    />
                    1 Month (Save 0%)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="90"
                      checked={renewDays === 90}
                      onChange={(e) => setRenewDays(Number(e.target.value))}
                    />
                    3 Months (Save 5%)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="365"
                      checked={renewDays === 365}
                      onChange={(e) => setRenewDays(Number(e.target.value))}
                    />
                    1 Year (Save 15%)
                  </label>
                </div>

                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setRenewTier(null)}>
                    Cancel
                  </button>
                  <button className={styles.confirmBtn} onClick={handleRenew}>
                    Confirm Upgrade
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* White-Label Settings */}
          {license?.features?.custom_branding && (
            <motion.div
              className={styles.whiteLabelCard}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className={styles.whiteLabelHeader}>
                <h2>White-Label Configuration</h2>
                <span className={styles.badge}>Premium Feature</span>
              </div>
              {whiteLabel && (
                <div className={styles.whiteLabelConfig}>
                  <div className={styles.configItem}>
                    <label>Company Name</label>
                    <input type="text" value={whiteLabel.company_name || ""} disabled />
                  </div>
                  <div className={styles.configItem}>
                    <label>Primary Color</label>
                    <div className={styles.colorPicker}>
                      <div
                        className={styles.colorPreview}
                        style={{ background: whiteLabel.primary_color || "#2463EB" }}
                      />
                      <code>{whiteLabel.primary_color || "#2463EB"}</code>
                    </div>
                  </div>
                  {whiteLabel.custom_domain && (
                    <div className={styles.configItem}>
                      <label>Custom Domain</label>
                      <input type="text" value={whiteLabel.custom_domain} disabled />
                    </div>
                  )}
                  <button className={styles.editBtn} onClick={() => alert("Edit white-label settings")}>
                    Edit Settings
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
