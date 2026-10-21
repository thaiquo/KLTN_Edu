import React, { useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronRight, GraduationCap, Newspaper } from 'lucide-react-native';
import { publicWebUrl } from '../config/runtime';
import { base, themeForRole } from '../theme/tokens';

const destinations = [
  { label: 'Tìm gia sư', detail: 'Khám phá hồ sơ và chuyên môn', path: '/tutors', icon: GraduationCap },
  { label: 'Tìm lớp', detail: 'Xem các lớp đang mở', path: '/classes', icon: BookOpen },
  { label: 'Bảng tin kết nối', detail: 'Xem bài viết cộng đồng', path: '/community', icon: Newspaper },
];

export function PublicExplore({ role }: { role?: string | null }) {
  const [error, setError] = useState('');
  const theme = themeForRole(role);
  async function open(path: string) {
    if (path === '/tutors') { router.push('/tutors'); setError(''); return; }
    if (path === '/community') { router.push('/community'); setError(''); return; }
    if (!publicWebUrl) { setError('Chưa cấu hình địa chỉ Web EduConnect.'); return; }
    try { await Linking.openURL(`${publicWebUrl}${path}`); setError(''); }
    catch { setError('Không thể mở trang EduConnect lúc này.'); }
  }
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>KHÁM PHÁ</Text>
    <Text style={styles.title}>Học theo cách của bạn</Text>
    <Text style={styles.intro}>Gia sư, lớp học và cộng đồng EduConnect.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.list}>{destinations.map(item => {
      const Icon = item.icon;
      return <Pressable key={item.path} accessibilityRole="link" onPress={() => void open(item.path)} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><Icon size={22} color={theme.primary} /></View>
        <View style={styles.rowText}><Text style={styles.label}>{item.label}</Text><Text style={styles.detail}>{item.detail}</Text></View>
        <ChevronRight size={18} color={base.muted} />
      </Pressable>;
    })}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, alignSelf: 'stretch', padding: 20, paddingBottom: 36 },
  eyebrow: { color: '#237d76', fontSize: 11, fontWeight: '800', marginTop: 8 },
  title: { color: base.ink, fontSize: 26, fontWeight: '800', marginTop: 7 },
  intro: { color: base.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  error: { color: base.danger, fontSize: 13, marginTop: 14 },
  list: { marginTop: 27, borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 13, borderBottomWidth: 1, borderBottomColor: base.line },
  icon: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '800', color: base.ink },
  detail: { fontSize: 12, color: base.muted, marginTop: 4 },
});
