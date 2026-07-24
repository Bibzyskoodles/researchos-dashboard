import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { COLORS } from '../theme';
import { Respondent } from '../types';

// MVP placeholder — the localized, per-project script comes from project
// config (Bible Part 7); it is displayed in-app so wording can't drift.
const DEFAULT_SCRIPT =
  'Hello, my name is [your name] and I am calling on behalf of [organisation]. ' +
  'This interview will be recorded for quality and verification purposes. ' +
  'Your answers are confidential and you may stop at any time. ' +
  'Do I have your permission to record and begin?';

/**
 * The consent moment — deliberately human (Bible 8.4), recorded as its own
 * standalone evidence artifact (Part 7), and a HARD GATE: the Start
 * Interview screen is unreachable until a consent recording exists. That
 * gate is enforced again server-side; this screen is the honest half of it.
 */
export default function ConsentScreen({
  respondent,
  onConsentCaptured,
  onBack,
}: {
  respondent: Respondent;
  onConsentCaptured: (consentUri: string) => void;
  onBack: () => void;
}) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission is required to record consent.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
    } catch {
      setError('Could not start recording. Try again.');
    }
  };

  const stop = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) onConsentCaptured(uri);
      else setError('Recording failed to save — please record consent again.');
    } catch {
      setError('Recording failed to save — please record consent again.');
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Consent — {respondent.display_name || 'respondent'}</Text>
      <Text style={styles.sub}>
        Read this script to the respondent exactly as written, while recording.
        Without a consent recording, this interview cannot be started or analyzed.
      </Text>
      <View style={styles.scriptBox}>
        <Text style={styles.script}>{DEFAULT_SCRIPT}</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {recording ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.red }]} onPress={stop}>
          <Text style={styles.buttonText}>■ Stop — consent given</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.button} onPress={start}>
          <Text style={styles.buttonText}>● Record consent</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  back: { color: COLORS.blue, fontSize: 14, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.subtext, marginTop: 6, marginBottom: 16 },
  scriptBox: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4, borderLeftColor: COLORS.blue, borderRadius: 10, padding: 16, marginBottom: 20,
  },
  script: { fontSize: 15, lineHeight: 24, color: COLORS.text },
  error: { color: COLORS.red, fontSize: 13, marginBottom: 10 },
  button: { backgroundColor: COLORS.blue, borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
