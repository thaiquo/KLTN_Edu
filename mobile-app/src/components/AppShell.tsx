import React from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Compass, GraduationCap, House, UserRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { base, themeForRole } from '../theme/tokens';

type Tab = 'home' | 'explore' | 'management' | 'account';
type Props = { children: React.ReactNode; role?: 'STUDENT' | 'TUTOR' | null; active: Tab; title: string };

export function AppShell({ children, role = null, active, title }: Props) {
  const color = themeForRole(role).primary;
  const tabs = role === 'TUTOR'
    ? [
        { key: 'home' as const, label: 'Tổng quan', icon: House, href: '/(app)' as const },
        { key: 'management' as const, label: 'Môn học', icon: BookOpen, href: '/(app)/management' as const },
        { key: 'account' as const, label: 'Tài khoản', icon: UserRound, href: '/(app)/profile' as const },
      ]
    : role === 'STUDENT'
      ? [
          { key: 'home' as const, label: 'Trang chủ', icon: House, href: '/(app)' as const },
          { key: 'explore' as const, label: 'Khám phá', icon: Compass, href: '/(app)/explore' as const },
          { key: 'account' as const, label: 'Tài khoản', icon: UserRound, href: '/(app)/profile' as const },
        ]
      : [
          { key: 'home' as const, label: 'Trang chủ', icon: House, href: '/(public)' as const },
          { key: 'explore' as const, label: 'Khám phá', icon: Compass, href: '/(public)/discover' as const },
          { key: 'account' as const, label: 'Tài khoản', icon: UserRound, href: '/(public)/account' as const },
        ];

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Về trang chủ" onPress={() => router.replace(role ? '/(app)' : '/(public)')} style={styles.identity}>
        <View style={[styles.mark, { backgroundColor: color }]}><GraduationCap size={21} color="#fff" /></View>
        <Text style={styles.brand}>EduConnect</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.pageTitle}>{title}</Text>
    </View>
    <View style={styles.body}>{children}</View>
    <View style={styles.tabBar}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const selected = tab.key === active;
        return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} onPress={() => router.replace(tab.href)} style={styles.tab}>
          <Icon size={21} color={selected ? color : base.muted} strokeWidth={selected ? 2.3 : 1.9} />
          <Text numberOfLines={1} style={[styles.tabLabel, selected && { color, fontWeight: '800' }]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: base.background },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: base.line, backgroundColor: '#fff' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 0 },
  mark: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  brand: { color: base.ink, fontWeight: '800', fontSize: 17 },
  pageTitle: { color: base.muted, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  body: { flex: 1 },
  tabBar: { height: 62, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: base.line, backgroundColor: '#fff' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: base.muted },
});
