import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callApi } from '../api/client';
import { COLORS } from '../theme';
import { Respondent } from '../types';

const PROJECT_KEY = 'cs_project_id';
const CACHE_KEY = 'cs_respondents_cache';

/**
 * Bible 2.3 step 1: select the assigned respondent. The list is cached
 * locally so a day of interviews works with zero connectivity after one
 * online refresh (Design Principle 5). MVP: the project id is entered
 * once by the enumerator; assignment-driven project lists arrive with the
 * trust-record query work.
 */
export default function RespondentListScreen({
  onSelect,
  onOpenSyncQueue,
}: {
  onSelect: (respondent: Respondent, projectId: string) => void;
  onOpenSyncQueue: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [savedProject, setSavedProject] = useState<string | null>(null);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const pid = await AsyncStorage.getItem(PROJECT_KEY);
      const cache = await AsyncStorage.getItem(CACHE_KEY);
      if (pid) setSavedProject(pid);
      if (cache) setRespondents(JSON.parse(cache));
    })();
  }, []);

  const refresh = useCallback(async (pid: string) => {
    setRefreshing(true);
    try {
      const data = await callApi.listRespondents(pid);
      setRespondents(data.respondents);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data.respondents));
      setNote(null);
    } catch {
      setNote('Offline — showing your last synced respondent list.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (savedProject) void refresh(savedProject);
  }, [savedProject, refresh]);

  if (!savedProject) {
    return (
      <View style={styles.setup}>
        <Text style={styles.title}>Project setup</Text>
        <Text style={styles.sub}>
          Enter the project ID your supervisor gave you. You only do this once.
        </Text>
        <TextInput
          style={styles.input} placeholder="PROJ-XXXXXXXX" autoCapitalize="characters"
          value={projectId} onChangeText={setProjectId} placeholderTextColor={COLORS.subtext}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            const pid = projectId.trim();
            if (!pid) return;
            await AsyncStorage.setItem(PROJECT_KEY, pid);
            setSavedProject(pid);
          }}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Respondents</Text>
        <TouchableOpacity onPress={onOpenSyncQueue}>
          <Text style={styles.link}>Sync queue</Text>
        </TouchableOpacity>
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      <FlatList
        data={respondents}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh(savedProject)} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No respondents yet. Pull down to refresh once you're online.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item, savedProject)}>
            <Text style={styles.name}>{item.display_name || 'Unnamed respondent'}</Text>
            <Text style={styles.phone}>{item.phone_number || 'No number on file'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  setup: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.subtext, marginTop: 6, marginBottom: 16 },
  link: { color: COLORS.blue, fontWeight: '600', fontSize: 13 },
  note: { fontSize: 12, color: COLORS.amber, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.text, marginBottom: 12,
  },
  button: { backgroundColor: COLORS.blue, borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { textAlign: 'center', color: COLORS.subtext, fontSize: 13, marginTop: 40 },
  card: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, marginBottom: 8,
  },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  phone: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
});
