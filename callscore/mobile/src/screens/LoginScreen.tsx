import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authApi } from '../api/client';
import { COLORS } from '../theme';

// One account across the platform (Bible 1.3) — this signs into the same
// FieldScore backend the dashboard uses.
export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.login(email.trim(), password);
      onLoggedIn();
    } catch {
      setError('Sign-in failed. Check your email, password, and connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>
        CALL<Text style={{ color: COLORS.blue }}>SCORE</Text>
      </Text>
      <Text style={styles.tag}>Every remote interview, verified by AI</Text>
      <TextInput
        style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail}
        placeholderTextColor={COLORS.subtext}
      />
      <TextInput
        style={styles.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword} placeholderTextColor={COLORS.subtext}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.navy, justifyContent: 'center', padding: 28 },
  logo: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  tag: { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', marginBottom: 36, marginTop: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, marginBottom: 12,
  },
  error: { color: '#FCA5A5', fontSize: 13, marginBottom: 10 },
  button: { backgroundColor: COLORS.blue, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
