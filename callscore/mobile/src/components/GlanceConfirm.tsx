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
  questionType = 'text',
  choices,
}: {
  questionText: string;
  required: boolean;
  value: string;
  state: ConfirmState;
  onChange: (v: string) => void;
  onConfirm?: () => void;
  questionType?: 'text' | 'numeric' | 'select_one' | 'select_multiple';
  choices?: { name: string; label: string }[] | null;
}) {
  const hasChoices =
    (questionType === 'select_one' || questionType === 'select_multiple') &&
    (choices?.length ?? 0) > 0;
  const multi = questionType === 'select_multiple';
  const selected = new Set(value.split(',').map((s) => s.trim()).filter(Boolean));

  const toggle = (name: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      onChange(Array.from(next).join(', '));
    } else {
      onChange(value === name ? '' : name);
    }
  };

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
        {multi && <Text style={{ color: COLORS.subtext, fontSize: 11 }}>  (select all that apply)</Text>}
      </Text>
      {hasChoices ? (
        <View style={styles.chipWrap}>
          {choices!.map((c) => {
            const on = multi ? selected.has(c.name) : value === c.name;
            return (
              <TouchableOpacity
                key={c.name}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(c.name)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="Answer"
          placeholderTextColor={COLORS.subtext}
          keyboardType={questionType === 'numeric' ? 'numeric' : 'default'}
        />
      )}
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
    borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14,
  },
  chipOn: { borderColor: COLORS.blue, backgroundColor: 'rgba(36,99,235,0.12)' },
  chipText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  chipTextOn: { color: COLORS.blue, fontWeight: '700' },
});
