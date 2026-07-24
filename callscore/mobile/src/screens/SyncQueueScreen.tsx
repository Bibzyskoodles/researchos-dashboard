import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { callApi } from '../api/client';
import { listSessions } from '../db/local';
import { syncAllPending } from '../sync/syncService';
import { COLORS } from '../theme';
import { LocalSession } from '../types';

const STATUS: Record<LocalSession['sync_status'], { label: string; color: string }> = {
  local: { label: 'In progress', color: COLORS.subtext },
  pending: { label: 'Pending sync', color: COLORS.amber },
  syncing: { label: 'Uploading…', color: COLORS.blue },
  synced: { label: 'Synced ✓', color: COLORS.green },
  failed: { label: 'Retry queued', color: COLORS.red },
};

/**
 * Offline queue view (Bible 6.4): "Pending sync" is a normal state, shown
 * calmly. Storage-cap warnings surface here rather than failing silently.
 */
const LOW_STORAGE_BYTES = 500 * 1024 * 1024; // warn below 500 MB free

export default function SyncQueueScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [lowStorage, setLowStorage] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  const sendFeedback = async () => {
    const msg = feedbackText.trim();
    if (!msg) return;
    try {
      await callApi.sendFeedback(msg, 'field_report');
      setFeedbackText('');
      setFeedbackStatus('Sent — thank you.');
    } catch {
      setFeedbackStatus('Could not send (offline?) — try again when connected.');
    }
  };

  const load = useCallback(async () => {
    setSessions(await listSessions());
    // Bible 6.4: surface storage pressure to the enumerator rather than
    // silently failing mid-interview.
    try {
      setLowStorage((await FileSystem.getFreeDiskStorageAsync()) < LOW_STORAGE_BYTES);
    } catch {
      // unsupported platform — no warning is better than a wrong one
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const syncNow = async () => {
    setBusy(true);
    try {
      await syncAllPending();
    } finally {
      setBusy(false);
      void load();
    }
  };

  const pending = sessions.filter((s) => s.sync_status === 'pending' || s.sync_status === 'failed').length;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Sync queue</Text>
        <TouchableOpacity onPress={syncNow} disabled={busy}>
          <Text style={styles.link}>{busy ? 'Syncing…' : `Sync now (${pending})`}</Text>
        </TouchableOpacity>
      </View>
      {lowStorage && (
        <Text style={styles.storageWarning}>
          ⚠️ Storage getting full — sync soon so recordings can be cleared from this device.
        </Text>
      )}
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text style={styles.empty}>No interviews yet.</Text>}
        ListFooterComponent={
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackTitle}>Something not working in the field?</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell the team — app problems, network issues, anything."
              placeholderTextColor={COLORS.subtext}
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity style={styles.feedbackBtn} onPress={() => void sendFeedback()}>
                <Text style={styles.feedbackBtnText}>Send feedback</Text>
              </TouchableOpacity>
              {feedbackStatus && <Text style={styles.feedbackStatus}>{feedbackStatus}</Text>}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS[item.sync_status];
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.respondent_name || item.respondent_id}</Text>
                <Text style={styles.time}>
                  {item.started_at ? new Date(item.started_at).toLocaleString() : 'Not started'}
                </Text>
              </View>
              <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  back: { color: COLORS.blue, fontSize: 14, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  link: { color: COLORS.blue, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: COLORS.subtext, fontSize: 13, marginTop: 40 },
  storageWarning: {
    fontSize: 12, color: COLORS.amber, backgroundColor: COLORS.amberBg,
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  feedbackBox: {
    marginTop: 20, backgroundColor: COLORS.card, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 10, padding: 14,
  },
  feedbackTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  feedbackInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10, fontSize: 13, color: COLORS.text,
    minHeight: 60, textAlignVertical: 'top', marginBottom: 10,
  },
  feedbackBtn: {
    backgroundColor: COLORS.blue, borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 14,
  },
  feedbackBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  feedbackStatus: { fontSize: 11, color: COLORS.subtext, flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, marginBottom: 8,
  },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  time: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700' },
});
