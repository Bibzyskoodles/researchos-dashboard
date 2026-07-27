import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Audio } from 'expo-av';
import { startLiveSession, LiveSession, LIVE_SAMPLE_RATE } from '../live/liveTranscribe';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlanceConfirm from '../components/GlanceConfirm';
import { callApi } from '../api/client';
import { saveSession } from '../db/local';
import { syncAllPending } from '../sync/syncService';
import { COLORS } from '../theme';
import { LocalSession, QuestionnaireItem, Respondent } from '../types';

const QUESTIONNAIRE_CACHE = 'cs_questionnaire_cache';

// Live pre-fill needs a progressively-readable recording, and the file IS
// the evidence recording (one recorder, tailed for live). Android first —
// that's what enumerators carry: AMR-WB, the wideband telephony codec
// (frame-streamable, ~25kbps — cheapest option on data). iOS: PCM WAV.
const LIVE_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.amr',
    outputFormat: Audio.AndroidOutputFormat.AMR_WB,
    audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
    sampleRate: LIVE_SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 23850, // AMR-WB's highest mode
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: LIVE_SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: LIVE_SAMPLE_RATE * 16,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
};

// Offline fallback until the project's XLSForm has been imported and
// fetched at least once (Bible 8.7 — the real items come from
// questionnaire_items server-side).
const FALLBACK_QUESTIONS: QuestionnaireItem[] = [
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireItem[]>(FALLBACK_QUESTIONS);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [callNumber, setCallNumber] = useState('');
  const [busy, setBusy] = useState(false);
  // Live pre-fill (opt-in — streaming uses more data; constitution 00 §6).
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveState, setLiveState] = useState<'off' | 'live' | 'unavailable'>('off');
  const [aiSuggested, setAiSuggested] = useState<Record<string, number>>({});
  const touchedRef = useRef<Set<string>>(new Set());
  const liveRef = useRef<LiveSession | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Real questionnaire, cached for offline days; fallback keeps the flow
  // usable before the project's XLSForm import has happened.
  useEffect(() => {
    void (async () => {
      const cached = await AsyncStorage.getItem(`${QUESTIONNAIRE_CACHE}:${projectId}`);
      if (cached) setQuestions(JSON.parse(cached));
      try {
        const data = await callApi.getQuestionnaire(projectId);
        if (data.items.length > 0) {
          setQuestions(data.items);
          await AsyncStorage.setItem(`${QUESTIONNAIRE_CACHE}:${projectId}`, JSON.stringify(data.items));
        }
      } catch {
        // offline — cached or fallback items stand
      }
    })();
  }, [projectId]);

  const startInterview = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const useLive = liveEnabled;
      const { recording: rec } = await Audio.Recording.createAsync(
        useLive ? LIVE_RECORDING_OPTIONS : Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      recordingRef.current = rec;
      if (useLive) {
        liveRef.current = await startLiveSession({
          projectId,
          language: 'en',
          format: Platform.OS === 'android' ? 'amr-wb' : 'wav',
          recordingUri: () => recordingRef.current?.getURI() ?? null,
          onState: setLiveState,
          onAnswers: (list) => {
            for (const a of list) {
              if (touchedRef.current.has(a.question_key)) continue; // human wins
              setAnswers((prev) =>
                (prev[a.question_key] || '').trim() && aiSuggested[a.question_key] === undefined
                  ? prev
                  : { ...prev, [a.question_key]: a.answer });
              setAiSuggested((prev) => ({ ...prev, [a.question_key]: a.confidence }));
            }
          },
        });
      }
      const started = new Date().toISOString();
      const id = Crypto.randomUUID(); // client-generated: idempotent sync (Bible 5.3)
      setSessionId(id);
      setStartedAt(started); // anchor timestamp #1
      // Best-effort early server create so CallScore Link can pair via the
      // cloud relay during the call. Offline is fine — sync creates it
      // later idempotently; Link pairing just isn't available (Bible 6.2:
      // the relay is explicitly the weakest path).
      callApi
        .createSession({
          id, org_id: orgId, project_id: projectId, enumerator_id: enumeratorId,
          respondent_id: respondent.id, started_at: started, consent_captured: true,
        })
        .catch(() => undefined);
    } catch {
      Alert.alert('Recording failed', 'Could not start audio capture. Check microphone permission.');
    }
  };

  // Manual, one-tap screenshot attach (Bible 6.1; deliberate human action).
  // The image uploads with the evidence bundle — number, duration and
  // timestamp in one shot is the ironclad proof (founder decision).
  const attachScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setScreenshotUri(res.assets[0].uri);
      setScreenshotAttached(true);
    }
  };

  const stopInterview = async () => {
    if (!recording || !startedAt) return;
    const missing = questions.filter(
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
      liveRef.current?.stop();
      liveRef.current = null;
      await recording.stopAndUnloadAsync();
      const audioUri = recording.getURI();
      const session: LocalSession = {
        id: sessionId || Crypto.randomUUID(),
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
        screenshot_uri: screenshotUri,
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
        {(Platform.OS === 'android' || Platform.OS === 'ios') && (
          <View style={styles.liveToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveToggleTitle}>🎧 Live answer capture</Text>
              <Text style={styles.liveToggleSub}>
                Answers pre-fill as they're heard. Needs a connection and uses
                more data — if the signal drops, recording continues untouched.
              </Text>
            </View>
            <Switch value={liveEnabled} onValueChange={setLiveEnabled} />
          </View>
        )}
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
        {sessionId && (
          <Text style={styles.pairCode}>
            Link code: {sessionId.slice(-6).toUpperCase()}
          </Text>
        )}
      </View>
      {liveState === 'live' && (
        <Text style={styles.livePill}>🎧 Live listening — answers pre-fill as they're heard</Text>
      )}

      {questions.map((q) => {
        const suggested =
          aiSuggested[q.question_key] !== undefined && !touchedRef.current.has(q.question_key);
        return (
          <GlanceConfirm
            key={q.question_key}
            questionText={q.question_text}
            required={q.is_required}
            value={answers[q.question_key] || ''}
            state={suggested ? 'confirm' : 'manual'}
            questionType={q.question_type}
            choices={q.choices}
            onChange={(v) => {
              touchedRef.current.add(q.question_key); // human input wins from now on
              setAiSuggested((prev) => {
                const { [q.question_key]: _gone, ...rest } = prev;
                return rest;
              });
              setAnswers((a) => ({ ...a, [q.question_key]: v }));
            }}
            onConfirm={() => {
              touchedRef.current.add(q.question_key);
              setAiSuggested((prev) => {
                const { [q.question_key]: _gone, ...rest } = prev;
                return rest;
              });
            }}
          />
        );
      })}

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
            {screenshotAttached ? '✓ Screenshot attached — uploads with the interview' : 'Attach call-screen screenshot'}
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
  liveToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  liveToggleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  liveToggleSub: { fontSize: 12, color: COLORS.subtext, marginTop: 3, lineHeight: 17 },
  livePill: {
    fontSize: 12, fontWeight: '600', color: COLORS.green, marginBottom: 12,
  },
  stopButton: { backgroundColor: COLORS.red, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16 },
  startText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  liveBar: {
    backgroundColor: COLORS.redBg, borderRadius: 8, padding: 10, marginBottom: 14,
  },
  liveText: { color: COLORS.red, fontWeight: '700', fontSize: 13 },
  pairCode: { color: COLORS.subtext, fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
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
