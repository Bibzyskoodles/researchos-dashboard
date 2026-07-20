import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AdaChangeableSettings {
  language: string;
  timezone: string;
  adaPersonality: 'professional' | 'friendly' | 'concise';
  adaProactive: boolean;
  adaGuidance: boolean;
  adaBrief: boolean;
  adaCelebrations: boolean;
  gpsAccuracy: number;
  dupThreshold: number;
  passThreshold: number;
  minDuration: number;
  maxDuration: number;
  mediaRetention: string;
  notifyEmail: boolean;
  notifySlack: boolean;
  notifyInApp: boolean;
  sessionTimeout: string;
}

const DEFAULTS: AdaChangeableSettings = {
  language: 'English',
  timezone: 'Africa/Lagos',
  adaPersonality: 'professional',
  adaProactive: true,
  adaGuidance: true,
  adaBrief: true,
  adaCelebrations: true,
  gpsAccuracy: 50,
  dupThreshold: 85,
  passThreshold: 70,
  minDuration: 8,
  maxDuration: 120,
  mediaRetention: '90',
  notifyEmail: true,
  notifySlack: false,
  notifyInApp: true,
  sessionTimeout: '8h',
};

interface SettingsContextValue {
  settings: AdaChangeableSettings;
  changeSetting: <K extends keyof AdaChangeableSettings>(key: K, value: AdaChangeableSettings[K]) => void;
  reset: () => void;
}

const SettingsCtx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AdaChangeableSettings>(DEFAULTS);

  const changeSetting = useCallback(<K extends keyof AdaChangeableSettings>(
    key: K,
    value: AdaChangeableSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  return (
    <SettingsCtx.Provider value={{ settings, changeSetting, reset }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
