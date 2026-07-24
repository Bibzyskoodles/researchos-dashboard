import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
export default function SyncQueueScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setSessions(await listSessions()), []);
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
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text style={styles.empty}>No interviews yet.</Text>}
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
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, marginBottom: 8,
  },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  time: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700' },
});
