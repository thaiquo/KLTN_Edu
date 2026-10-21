import React from 'react';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronRight, FileCheck2 } from 'lucide-react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppShell } from '../../src/components/AppShell';
import { base, themeForRole } from '../../src/theme/tokens';

export default function TutorManagement() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/(public)" />;
  if (user.activeRole !== 'TUTOR') return <Redirect href="/(app)" />;
  const approved = user.tutorStatus === 'APPROVED';
  const theme = themeForRole('TUTOR');
  return <AppShell active="management" title="Môn học" role="TUTOR"><ScrollView contentContainerStyle={styles.content}>
    <Text style={[styles.eyebrow, { color: theme.primary }]}>CHUYÊN MÔN GIA SƯ</Text>
    <Text style={styles.title}>Môn giảng dạy</Text>
    <Text style={styles.detail}>Hồ sơ xét duyệt và đăng ký môn dạy được quản lý riêng.</Text>
    <Text style={styles.section}>Hồ sơ & đăng ký</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/tutor-onboarding')} style={styles.row}>
      <FileCheck2 size={22} color={theme.primary} /><View style={styles.rowText}><Text style={styles.rowTitle}>Hồ sơ gia sư</Text><Text style={styles.rowDetail}>Xem trạng thái, giấy tờ và hình thức dạy</Text></View><ChevronRight size={18} color={base.muted} />
    </Pressable>
    {approved ? <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/teaching-registrations')} style={styles.row}>
      <BookOpen size={22} color={theme.primary} /><View style={styles.rowText}><Text style={styles.rowTitle}>Đăng ký môn dạy</Text><Text style={styles.rowDetail}>Danh sách, chi tiết và thêm hồ sơ mới</Text></View><ChevronRight size={18} color={base.muted} />
    </Pressable> : <View style={styles.notice}><Text style={styles.noticeText}>Đăng ký môn dạy mở sau khi hồ sơ gia sư được duyệt.</Text></View>}
  </ScrollView></AppShell>;
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, alignSelf: 'stretch', padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: '800', marginTop: 12 }, title: { color: base.ink, fontSize: 27, fontWeight: '800', marginTop: 7 },
  detail: { color: base.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 28 },
  section: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 13 },
  row: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, padding: 16, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 10 },
  rowText: { flex: 1 }, rowTitle: { color: base.ink, fontSize: 15, fontWeight: '800' }, rowDetail: { color: base.muted, fontSize: 12, marginTop: 4 },
  notice: { padding: 15, backgroundColor: '#fce9f1', borderRadius: 8, marginTop: 4 }, noticeText: { color: '#8a4b5f', lineHeight: 20, fontSize: 13 },
});
