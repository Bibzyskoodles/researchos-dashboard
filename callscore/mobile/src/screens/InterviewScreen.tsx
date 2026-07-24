import React, { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import GlanceConfirm from '../components/GlanceConfirm';
import { saveSession } from '../db/local';
import { syncAllPending } from '../sync/syncService';
import { COLORS } from '../theme';
import { LocalSession, QuestionnaireItem, Respondent } from '../types';

// MVP placeholder — real items come from the imported XLSForm via the
// backend's questionnaire_items (Bible 8.7).
const PLACEHOLDER_QUESTIONS: QuestionnaireItem[] = [
  { question_key: 'q1', question_text: 'How many people live in your household?', is_required: true, sort_order: 1 },
  { question_key: 'q2', question_text: 'What is your main source of income?', is_required: true, sort_order: 2 },
  { question_key: 'q3', question_text: 'Any other comments?', is_required: false, sort_order: 3 },
];

/**
 * The interview session (Bible 2.3 steps 3–10). Start and Stop are
 * deliberate button presses — the anchor timestamps for the whole evidence
 * chain — and are never automated (Design Principle 3). Everything here
 * works with zero connectivity; Stop saves locally and queues for sync.
 */
export default function InterviewScreen({
  respondent,
  projectId,
  orgId,
  enumeratorId,
  consentUri,
  onDone,
}: {
  respondent: Respondent;
  projectId: string;
  orgId: string;
  enumeratorId: string;
  consentUri: string;
  onDone: () => void;
}) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [callNumber, setCallNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const startInterview = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setStartedAt(new Date().toISOString()); // anchor timestamp #1
    } catch {
      Alert.alert('Recording failed', 'Could not start audio capture. Check microphone permission.');
    }
  };

  // Manual, one-tap screenshot attach (Bible 6.1, MVP interim per Part 10).
  // The image is picked only to prove it exists on-device; it is NEVER
  // uploaded — only the number the enumerator confirms below syncs.
  const attachScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    if (!res.canceled) setScreenshotAttached(true);
  };

  const stopInterview = async () => {
    if (!recording || !startedAt) return;
    const missing = PLACEHOLDER_QUESTIONS.filter(
      (q) => q.is_required && !(answers[q.question_key] || '').trim(),
    );
    if (missing.length > 0) {
      Alert.alert(
        'Unanswered questions',
        `${missing.length} required question(s) are blank. Stop anyway? The compliance check will flag them.`,
        [
          { text: 'Keep interviewing', style: 'cancel' },
          { text: 'Stop anyway', style: 'destructive', onPress: () => void finalize() },
        ],
      );
      return;
    }
    await finalize();
  };

  const finalize = async () => {
    if (!recording || !startedAt || busy) return;
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const audioUri = recording.getURI();
      const session: LocalSession = {
        id: Crypto.randomUUID(), // client-generated: idempotent sync (Bible 5.3)
        org_id: orgId,
        project_id: projectId,
        respondent_id: respondent.id,
        respondent_name: respondent.display_name || '',
        enumerator_id: enumeratorId,
        started_at: startedAt,
        stopped_at: new Date().toISOString(), // anchor timestamp #2
        consent_uri: consentUri,
        audio_uri: audioUri,
        screenshot_fields: screenshotAttached || callNumber
          ? { number: callNumber || undefined }
          : null,
        answers,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };
      await saveSession(session);
      void syncAllPending(); // best-effort; offline just leaves it queued
      Alert.alert('Interview saved', 'Queued for sync — it will upload automatically when online.');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (!startedAt) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{respondent.display_name || 'Respondent'}</Text>
        <Text style={styles.sub}>
          Consent is recorded. Place the call on your other phone as usual, then press
          Start Interview the moment the conversation begins.
        </Text>
        <TouchableOpacity style={styles.startButton} onPress={startInterview}>
          <Text style={styles.startText}>▶ Start Interview</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={styles.liveBar}>
        <Text style={styles.liveText}>● Recording — {respondent.display_name || 'respondent'}</Text>
      </View>

      {PLACEHOLDER_QUESTIONS.map((q) => (
        <GlanceConfirm
          key={q.question_key}
          questionText={q.question_text}
          required={q.is_required}
          value={answers[q.question_key] || ''}
          state="manual"
          onChange={(v) => setAnswers((a) => ({ ...a, [q.question_key]: v }))}
        />
      ))}

      <View style={styles.screenshotBox}>
        <Text style={styles.screenshotTitle}>Call screen evidence</Text>
        <Text style={styles.screenshotSub}>
          Screenshot your call screen on the other phone, then confirm the number you dialled.
          The screenshot itself never leaves your device.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Number dialled (as shown on the call screen)"
          keyboardType="phone-pad"
          value={callNumber}
          onChangeText={setCallNumber}
          placeholderTextColor={COLORS.subtext}
        />
        <TouchableOpacity style={styles.attachBtn} onPress={attachScreenshot}>
          <Text style={styles.attachText}>
            {screenshotAttached ? '✓ Screenshot attached (kept on device)' : 'Attach screenshot'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.stopButton} onPress={stopInterview} disabled={busy}>
        <Text style={styles.startText}>■ Stop Interview</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 10, marginBottom: 28, lineHeight: 21 },
  startButton: { backgroundColor: COLORS.green, borderRadius: 12, padding: 18, alignItems: 'center' },
  stopButton: { backgroundColor: COLORS.red, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16 },
  startText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  liveBar: {
    backgroundColor: COLORS.redBg, borderRadius: 8, padding: 10, marginBottom: 14,
  },
  liveText: { color: COLORS.red, fontWeight: '700', fontSize: 13 },
  screenshotBox: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, marginTop: 6,
  },
  screenshotTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  screenshotSub: { fontSize: 12, color: COLORS.subtext, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10, fontSize: 15, color: COLORS.text, marginBottom: 10,
  },
  attachBtn: { alignSelf: 'flex-start' },
  attachText: { color: COLORS.blue, fontWeight: '600', fontSize: 13 },
});
