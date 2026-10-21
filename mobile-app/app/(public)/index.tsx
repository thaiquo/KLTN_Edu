import React from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BookOpen, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react-native';
import { AppShell } from '../../src/components/AppShell';
import { base, themeForRole } from '../../src/theme/tokens';

export default function GuestHome() {
  const blue = themeForRole('STUDENT').primary;
  return <AppShell active="home" title="Trang chủ"><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>KẾT NỐI HỌC VIÊN VÀ GIA SƯ</Text>
      <Text style={styles.title}>Tìm gia sư phù hợp với bạn</Text>
      <Text style={styles.description}>Khám phá gia sư đã xác minh, lớp học linh hoạt và cộng đồng học tập.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/tutors')} style={[styles.primary, { backgroundColor: blue }]}><Text style={styles.primaryText}>Khám phá gia sư</Text><ArrowRight size={18} color="#fff" /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')} style={styles.secondary}><Text style={[styles.secondaryText, { color: blue }]}>Bắt đầu miễn phí</Text></Pressable>
    </View>
    <Text style={styles.section}>Bắt đầu từ đây</Text>
    <View style={styles.path}><View style={[styles.icon, { backgroundColor: '#e8f1fb' }]}><BookOpen size={22} color={blue} /></View><View style={styles.pathText}><Text style={styles.pathTitle}>Dành cho Học viên</Text><Text style={styles.pathDetail}>Tìm người đồng hành theo mục tiêu học tập.</Text></View></View>
    <View style={styles.path}><View style={[styles.icon, { backgroundColor: '#fce9f1' }]}><GraduationCap size={22} color="#a92f69" /></View><View style={styles.pathText}><Text style={styles.pathTitle}>Dành cho Gia sư</Text><Text style={styles.pathDetail}>Xây dựng hồ sơ, đăng ký chuyên môn giảng dạy.</Text></View></View>
    <Pressable onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { returnTo: '/matching' } })} style={styles.path}><View style={[styles.icon, { backgroundColor: '#e8f1fb' }]}><Sparkles size={22} color={blue} /></View><View style={styles.pathText}><Text style={styles.pathTitle}>Tìm bằng AI</Text><Text style={styles.pathDetail}>Đăng nhập học viên để mô tả nhu cầu và nhận gợi ý phù hợp.</Text></View><ArrowRight size={17} color={blue} /></Pressable>
    <View style={styles.trust}><ShieldCheck size={21} color="#237d76" /><Text style={styles.trustText}>Hồ sơ xác minh và hợp đồng rõ ràng</Text></View>
  </ScrollView></AppShell>;
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, alignSelf: 'stretch', padding: 20, paddingBottom: 36 },
  hero: { paddingTop: 36, paddingBottom: 32 }, eyebrow: { color: '#237d76', fontSize: 11, fontWeight: '800' },
  title: { color: base.ink, fontSize: 36, lineHeight: 43, fontWeight: '800', marginTop: 12 },
  description: { color: base.muted, fontSize: 16, lineHeight: 24, marginTop: 15, marginBottom: 23 },
  primary: { minHeight: 52, paddingHorizontal: 18, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { fontSize: 14, fontWeight: '800' },
  section: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  path: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderColor: base.line },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, pathText: { flex: 1 },
  pathTitle: { fontSize: 15, fontWeight: '800', color: base.ink }, pathDetail: { color: base.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  trust: { marginTop: 14, borderTopWidth: 1, borderColor: base.line, paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustText: { color: base.muted, fontSize: 13, fontWeight: '700', flex: 1 },
});
