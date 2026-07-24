import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme';

/**
 * The Glance-Confirm row — "the most important screen in the product"
 * (Bible 8.5). Pure controlled component so it renders instantly.
 *
 * Confidence states are visually distinct and never silently guessed:
 *  - 'settled'  — clearly heard, shown filled (tap to edit)
 *  - 'confirm'  — pre-filled but uncertain: amber "please confirm"
 *  - 'manual'   — nothing pre-filled, plain input
 * MVP runs everything as 'manual'; the states light up when the on-device
 * copilot pre-fill ships. The UI contract exists NOW so that adding AI
 * later changes data flow, not the enumerator's muscle memory.
 */
export type ConfirmState = 'settled' | 'confirm' | 'manual';

export default function GlanceConfirm({
  questionText,
  required,
  value,
  state,
  onChange,
  onConfirm,
}: {
  questionText: string;
  required: boolean;
  value: string;
  state: ConfirmState;
  onChange: (v: string) => void;
  onConfirm?: () => void;
}) {
  return (
    <View
      style={[
        styles.row,
        state === 'confirm' && styles.rowConfirm,
        state === 'settled' && styles.rowSettled,
      ]}
    >
      <Text style={styles.question}>
        {questionText}
        {required && <Text style={{ color: COLORS.red }}> *</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Answer"
        placeholderTextColor={COLORS.subtext}
      />
      {state === 'confirm' && (
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmText}>Please confirm ✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  rowConfirm: { borderColor: COLORS.amber, backgroundColor: COLORS.amberBg },
  rowSettled: { borderColor: COLORS.green },
  question: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10, fontSize: 15, color: COLORS.text,
  },
  confirmBtn: { marginTop: 8, alignSelf: 'flex-start' },
  confirmText: { color: COLORS.amber, fontWeight: '700', fontSize: 13 },
});
