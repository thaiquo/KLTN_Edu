import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { base, themeForRole } from '../theme/tokens';

export function FormScreen({ children, role = 'STUDENT', edges }: { children: React.ReactNode; role?: string; edges?: Edge[] }) {
  return <SafeAreaView edges={edges} style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

export function Heading({ eyebrow, title, detail, role }: { eyebrow?: string; title: string; detail?: string; role?: string }) {
  const color = themeForRole(role).primary;
  return <View style={styles.heading}>{eyebrow ? <Text style={[styles.eyebrow, { color }]}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#8999a4" style={[styles.field, props.multiline && styles.multi, error && styles.fieldError]} {...props} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function Button({ label, onPress, busy, disabled, role, secondary, danger }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; role?: string; secondary?: boolean; danger?: boolean }) {
  const color = danger ? base.danger : themeForRole(role).primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={onPress} style={[styles.button, { backgroundColor: secondary ? '#fff' : color, borderColor: color, opacity: busy || disabled ? .58 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? color : '#fff'} /> : <Text style={[styles.buttonText, { color: secondary ? color : '#fff' }]}>{label}</Text>}
  </Pressable>;
}

export function Notice({ message, success }: { message?: string | null; success?: boolean }) {
  if (!message) return null;
  return <View style={[styles.notice, { backgroundColor: success ? '#e8f5ef' : '#fff0f2', borderColor: success ? '#a4d5be' : '#e8b9c1' }]}><Text style={{ color: success ? base.success : base.danger, lineHeight: 20 }}>{message}</Text></View>;
}

export function Choice({ label, selected, onPress, role, detail }: { label: string; selected: boolean; onPress: () => void; role?: string; detail?: string }) {
  const theme = themeForRole(role);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>
    <Text style={[styles.choiceText, selected && { color: theme.primary }]}>{label}</Text>{detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
  </Pressable>;
}

export function Panel({ children }: { children: React.ReactNode }) { return <View style={styles.panel}>{children}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: base.background }, fill: { flex: 1 }, content: { flexGrow: 1, padding: 20, paddingBottom: 40, maxWidth: 560, alignSelf: 'stretch' },
  heading: { marginTop: 8, marginBottom: 24, gap: 5 }, eyebrow: { fontSize: 12, fontWeight: '800' }, title: { color: base.ink, fontSize: 26, fontWeight: '800', lineHeight: 32 }, detail: { color: base.muted, fontSize: 14, lineHeight: 21, marginTop: 3 },
  fieldWrap: { marginBottom: 16 }, label: { color: base.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 }, field: { minHeight: 50, borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: base.ink }, multi: { minHeight: 106, paddingTop: 12, textAlignVertical: 'top' }, fieldError: { borderColor: base.danger }, error: { color: base.danger, fontSize: 12, marginTop: 5 },
  button: { minHeight: 50, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginTop: 8 }, buttonText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 }, choice: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', padding: 12, justifyContent: 'center', marginBottom: 8 }, choiceText: { color: base.ink, fontSize: 15, fontWeight: '700' }, choiceDetail: { color: base.muted, fontSize: 12, marginTop: 4 }, panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, padding: 16, marginBottom: 16 },
});
