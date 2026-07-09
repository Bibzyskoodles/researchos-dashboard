import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Upload, Settings, ArrowRight, X } from 'lucide-react';
import { useAda } from '../../ada/AdaContext';

const BLUE = '#2463EB';

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  action: () => void;
}

interface WelcomeModalProps {
  onDismiss: () => void;
}

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  const nav = useNavigate();
  const { setOpen } = useAda();
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: <Sparkles size={32} color={BLUE} />,
      title: 'Welcome to ResearchOS',
      body: 'Your intelligent field research platform. Ada — your AI research assistant — is here to guide you through everything, from setting up your first project to generating insights from your data.',
      cta: 'Get Started',
      action: () => setStep(1),
    },
    {
      icon: <Upload size={32} color={BLUE} />,
      title: 'Connect Your Data',
      body: 'Upload submissions from KoboToolbox, ODK, or your own API. ResearchOS automatically scores each response across five quality engines: GPS, Image, Audio, Duration, and Duplicate detection.',
      cta: 'Go to Integrations',
      action: () => { onDismiss(); nav('/integrations'); },
    },
    {
      icon: <Settings size={32} color={BLUE} />,
      title: 'Configure Your Project',
      body: "Set your pass/flag/reject thresholds, choose your industry mode (Research Agency, NGO, FMCG, Government, Health, Education, or Consultancy), and tailor Ada's personality to match your team's culture.",
      cta: 'Go to Settings',
      action: () => { onDismiss(); nav('/settings'); },
    },
    {
      icon: <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />,
      title: 'Meet Ada, Your Research Partner',
      body: 'Ask Ada anything — filter submissions, navigate the dashboard, change settings, or explain your data. Ada speaks your language and learns your research context.',
      cta: 'Chat with Ada',
      action: () => { onDismiss(); setTimeout(() => setOpen(true), 200); },
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="welcome-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,15,40,0.55)',
          zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          key={`step-${step}`}
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={{
            background: 'white', borderRadius: 20, padding: '36px 32px',
            maxWidth: 480, width: '100%', position: 'relative',
            boxShadow: '0 24px 64px rgba(10,15,40,.22)',
          }}
        >
          {/* Close */}
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#CBD5E1', padding: 4, borderRadius: 6,
              display: 'grid', placeItems: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'; }}
          >
            <X size={16} />
          </button>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {steps.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 4, borderRadius: 2,
                  flex: i === step ? 2 : 1,
                  background: i <= step ? BLUE : '#E8EDF5',
                  transition: 'all .3s',
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div style={{ marginBottom: 20 }}>
            {current.icon}
          </div>

          {/* Text */}
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 12, lineHeight: 1.25 }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.65, marginBottom: 28 }}>
            {current.body}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '11px 20px', borderRadius: 10, border: '1px solid #E8EDF5',
                  background: 'white', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                  color: '#6B7280', fontFamily: 'Inter, sans-serif',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={current.action}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 10, border: 'none',
                background: BLUE, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                color: 'white', fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 14px rgba(36,99,235,.35)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = BLUE; }}
            >
              {current.cta}
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Skip */}
          {!isLast && step === 0 && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                onClick={onDismiss}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, color: '#9CA3AF', fontFamily: 'Inter, sans-serif',
                }}
              >
                Skip for now
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
