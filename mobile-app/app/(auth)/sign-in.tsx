import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpenCheck, Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { base, themeForRole } from '../../src/theme/tokens';

export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string; message?: string; role?: string; returnTo?: string }>();
  const { login } = useAuth();
  const [tutorMode, setTutorMode] = useState(params.role === 'TUTOR');
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = themeForRole(tutorMode ? 'TUTOR' : 'STUDENT');

  async function submit() {
    if (!email.trim() || !password) { setError('Vui lòng nhập email và mật khẩu.'); return; }
    setPending(true); setError(null);
    try {
      await login(email.trim().toLowerCase(), password, tutorMode);
      const returnTo = params.returnTo;
      router.replace(returnTo === '/matching' && !tutorMode ? '/matching'
        : returnTo?.startsWith('/community') ? returnTo as '/community' : '/(app)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Đăng nhập chưa thành công. Vui lòng thử lại.');
    } finally { setPending(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.mark, { backgroundColor: theme.primary }]}><BookOpenCheck color="#fff" size={27} /></View>
      <Text style={styles.brand}>EduConnect</Text>
      <Text style={styles.title}>Chào mừng trở lại</Text>
      <Text style={styles.subtitle}>Đăng nhập để tiếp tục hành trình học tập.</Text>
      <View style={styles.segment}>
        <Pressable onPress={() => setTutorMode(false)} accessibilityRole="button" style={[styles.segmentItem, !tutorMode && { backgroundColor: '#e8f1fb' }]}>
          <GraduationCap size={18} color={!tutorMode ? '#2463ae' : base.muted} /><Text style={[styles.segmentText, !tutorMode && { color: '#2463ae' }]}>Học viên</Text>
        </Pressable>
        <Pressable onPress={() => setTutorMode(true)} accessibilityRole="button" style={[styles.segmentItem, tutorMode && { backgroundColor: '#fce9f1' }]}>
          <BookOpenCheck size={18} color={tutorMode ? '#a92f69' : base.muted} /><Text style={[styles.segmentText, tutorMode && { color: '#a92f69' }]}>Gia sư</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>Email</Text>
      <View style={styles.field}><Mail size={19} color={base.muted} /><TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#90a0ac" style={styles.input} /></View>
      <Text style={styles.label}>Mật khẩu</Text>
      <View style={styles.field}><LockKeyhole size={19} color={base.muted} /><TextInput secureTextEntry={!showPassword} autoComplete="current-password" value={password} onChangeText={setPassword} placeholder="Nhập mật khẩu" placeholderTextColor="#90a0ac" style={styles.input} /><Pressable onPress={() => setShowPassword(v => !v)} accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={19} color={base.muted} /> : <Eye size={19} color={base.muted} />}</Pressable></View>
      {params.message && !error && <Text style={styles.success}>{params.message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email, role: tutorMode ? 'TUTOR' : 'STUDENT' } })}><Text style={styles.link}>Quên mật khẩu?</Text></Pressable>
      <Pressable disabled={pending} onPress={() => void submit()} style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: pending ? 0.7 : 1 }]}>
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Đăng nhập</Text>}
      </Pressable>
      <Text style={styles.foot}>Một tài khoản cho cả Học viên và Gia sư</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/register')}><Text style={styles.linkCenter}>Chưa có tài khoản? Đăng ký</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.replace('/(public)')}><Text style={styles.guestLink}>Tiếp tục khám phá không cần đăng nhập</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: base.surface }, fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 36, maxWidth: 480, width: '100%', alignSelf: 'center' },
  mark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 12 },
  brand: { fontWeight: '800', fontSize: 18, color: base.ink, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: base.ink, marginBottom: 7 },
  subtitle: { fontSize: 15, color: base.muted, marginBottom: 28, lineHeight: 22 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: base.background, borderRadius: 8, marginBottom: 28 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segmentText: { fontSize: 14, fontWeight: '700', color: base.muted },
  label: { fontSize: 13, fontWeight: '700', color: base.ink, marginBottom: 8 },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12, borderWidth: 1, borderColor: base.line, borderRadius: 8, marginBottom: 20 },
  input: { flex: 1, color: base.ink, fontSize: 15 },
  error: { color: base.danger, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  success: { color: base.success, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  link: { color: '#2463ae', fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 14 },
  linkCenter: { color: '#2463ae', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 15 },
  primaryButton: { minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  foot: { color: base.muted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  guestLink: { color: base.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 22 },
});
