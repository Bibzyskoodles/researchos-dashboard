/**
 * CallScore Link — the Device 1 companion app (Bible Part 6.1).
 *
 * Single purpose, minimum permission (Design Principle 6): this app
 * requests NO permissions at all in its MVP form. It reports call state
 * over the CLOUD RELAY (Bible 6.2 path 3 — explicitly the weakest
 * supported transport; BLE becomes the default in V1 when native
 * call-state modules land: CXCallObserver on iOS, AudioManager mode +
 * TelephonyManager on Android — see README).
 *
 * MVP flow: sign in with the same FieldScore account → enter the Link
 * code shown on the enumerator's Device 2 during a live interview →
 * tap "Call started" / "Call ended" at the trust-critical moments
 * (deliberate human actions, Design Principle 3) → optionally confirm
 * the number/name from your own screenshot of the call screen. The
 * screenshot itself never enters this app — only the fields you type
 * (Bible 6.1: immediate discard, structured fields only).
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { authApi, linkApi } from './src/api';
import { COLORS } from './src/theme';

type Stage = 'login' | 'pair' | 'live' | 'wrapup' | 'done';

export default function App() {
  const [stage, setStage] = useState<Stage>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.wrap}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.logo}>
            CALLSCORE <Text style={{ color: COLORS.blue }}>LINK</Text>
          </Text>

          {stage === 'login' && (
            <>
              <Text style={styles.sub}>Sign in with your FieldScore account.</Text>
              <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
                keyboardType="email-address" value={email} onChangeText={setEmail}
                placeholderTextColor={COLORS.faint} />
              <TextInput style={styles.input} placeholder="Password" secureTextEntry
                value={password} onChangeText={setPassword} placeholderTextColor={COLORS.faint} />
              <Button label="Sign in" busy={busy} onPress={() => act(async () => {
                await authApi.login(email.trim(), password);
                setStage('pair');
              })} />
            </>
          )}

          {stage === 'pair' && (
            <>
              <Text style={styles.sub}>
                Enter the Link code shown on the interview phone (Device 2) during a live interview.
              </Text>
              <TextInput style={[styles.input, styles.code]} placeholder="A1B2C3"
                autoCapitalize="characters" maxLength={8} value={code} onChangeText={setCode}
                placeholderTextColor={COLORS.faint} />
              <Button label="Pair" busy={busy} onPress={() => act(async () => {
                const res = await linkApi.pair(code.trim());
                setSubmissionId(res.submission_id);
                setStage('live');
              })} />
            </>
          )}

          {stage === 'live' && (
            <>
              <Text style={styles.paired}>Paired ✓ session …{submissionId.slice(-6)}</Text>
              <Text style={styles.sub}>
                Tap the moment the actual call connects on this phone, whatever app you're calling with.
              </Text>
              {!callStartedAt ? (
                <Button color={COLORS.green} label="📞 Call started" busy={busy}
                  onPress={() => act(async () => {
                    const at = new Date().toISOString();
                    await linkApi.reportState(submissionId, { call_started_at: at });
                    setCallStartedAt(at);
                  })} />
              ) : (
                <>
                  <Text style={styles.live}>● Call in progress since {new Date(callStartedAt).toLocaleTimeString()}</Text>
                  <Button color={COLORS.red} label="📵 Call ended" busy={busy}
                    onPress={() => act(async () => {
                      await linkApi.reportState(submissionId, { call_ended_at: new Date().toISOString() });
                      setStage('wrapup');
                    })} />
                </>
              )}
            </>
          )}

          {stage === 'wrapup' && (
            <>
              <Text style={styles.sub}>
                Screenshot your call screen for your own records, then confirm what it shows.
                The screenshot stays on this phone — only these fields are sent.
              </Text>
              <TextInput style={styles.input} placeholder="Number shown on call screen"
                keyboardType="phone-pad" value={number} onChangeText={setNumber}
                placeholderTextColor={COLORS.faint} />
              <TextInput style={styles.input} placeholder="Name shown (if any)"
                value={name} onChangeText={setName} placeholderTextColor={COLORS.faint} />
              <Button label="Send & finish" busy={busy} onPress={() => act(async () => {
                if (number || name) {
                  await linkApi.reportState(submissionId, {
                    number: number || undefined, name: name || undefined,
                  });
                }
                setStage('done');
              })} />
            </>
          )}

          {stage === 'done' && (
            <>
              <Text style={styles.paired}>All done ✓</Text>
              <Text style={styles.sub}>Call state reported. You can pair the next interview.</Text>
              <Button label="Pair next interview" busy={false} onPress={() => {
                setCode(''); setSubmissionId(''); setCallStartedAt(null);
                setNumber(''); setName(''); setStage('pair');
              }} />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Button({ label, onPress, busy, color }: {
  label: string; onPress: () => void; busy: boolean; color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, color ? { backgroundColor: color } : null]}
      onPress={onPress} disabled={busy}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.navy },
  body: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 22, lineHeight: 21 },
  paired: { color: '#4ADE80', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  live: { color: '#F87171', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, marginBottom: 12,
  },
  code: { textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: '700' },
  button: { backgroundColor: COLORS.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginTop: 14 },
});
