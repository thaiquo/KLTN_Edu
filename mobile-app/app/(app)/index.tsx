import React, { useCallback, useState } from 'react';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BookOpen, Compass, FileCheck2, Newspaper, Sparkles, UserRound } from 'lucide-react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { api } from '../../src/api/client';
import { AppShell } from '../../src/components/AppShell';
import { base, themeForRole } from '../../src/theme/tokens';

export default function Home() {
  const { user } = useAuth();
  const [registrationSummary, setRegistrationSummary] = useState<{ total: number; pending: number } | null>(null);
  useFocusEffect(useCallback(() => {
    if (user?.activeRole !== 'TUTOR' || user.tutorStatus !== 'APPROVED') { setRegistrationSummary(null); return; }
    let active = true;
    void api.request<Array<{ status: string }>>('/api/learning/tutor/subject-registrations')
      .then(items => { if (active) setRegistrationSummary({ total: items.length, pending: items.filter(item => item.status === 'PENDING').length }); })
      .catch(() => { if (active) setRegistrationSummary(null); });
    return () => { active = false; };
  }, [user?.activeRole, user?.tutorStatus]));
  if (!user) return <Redirect href="/(public)" />;
  const tutor = user.activeRole === 'TUTOR';
  const theme = themeForRole(user.activeRole);
  const firstName = user.fullName?.trim().split(/\s+/).at(-1) || 'bạn';
  return <AppShell active="home" title={tutor ? 'Tổng quan' : 'Trang chủ'} role={tutor ? 'TUTOR' : 'STUDENT'}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>{tutor ? 'KHÔNG GIAN GIA SƯ' : 'KHÔNG GIAN HỌC VIÊN'}</Text>
      <Text style={styles.greeting}>Chào {firstName},</Text>
      <Text style={styles.title}>{tutor ? 'Sẵn sàng cho buổi dạy tiếp theo' : 'Hôm nay bạn muốn học gì?'}</Text>
      <Text style={styles.description}>{tutor ? 'Theo dõi hồ sơ và chuyên môn giảng dạy của bạn.' : 'Tìm gia sư, lớp học và cộng đồng phù hợp với mục tiêu của bạn.'}</Text>
      {tutor ? <>
        <View style={[styles.status, { backgroundColor: theme.primarySoft, borderLeftColor: theme.primary }]}>
          <FileCheck2 size={21} color={theme.primary} />
          <View style={styles.statusText}><Text style={styles.statusLabel}>Hồ sơ gia sư</Text><Text style={styles.statusValue}>{statusLabel(user.tutorStatus)}</Text></View>
        </View>
        {registrationSummary ? <View style={styles.summary}>
          <View style={styles.summaryItem}><Text style={[styles.summaryNumber, { color: theme.primary }]}>{registrationSummary.total}</Text><Text style={styles.summaryLabel}>Đăng ký môn</Text></View>
          <View style={styles.summaryItem}><Text style={[styles.summaryNumber, { color: theme.primary }]}>{registrationSummary.pending}</Text><Text style={styles.summaryLabel}>Chờ xét duyệt</Text></View>
        </View> : null}
        <Text style={styles.section}>Quản lý giảng dạy</Text>
        <ActionRow icon={BookOpen} title="Môn giảng dạy" detail="Hồ sơ đăng ký và môn đã gửi" color={theme.primary} onPress={() => router.push('/(app)/management')} />
        <ActionRow icon={UserRound} title="Hồ sơ gia sư" detail="Thông tin xét duyệt và giấy tờ" color={theme.primary} onPress={() => router.push('/(app)/tutor-onboarding')} />
        <ActionRow icon={Newspaper} title="Cộng đồng" detail="Bài viết, khảo sát và lớp học" color={theme.primary} onPress={() => router.push('/community')} />
      </> : <>
        <Pressable onPress={() => router.push('/tutors')} style={[styles.primary, { backgroundColor: theme.primary }]}><Compass size={19} color="#fff" /><Text style={styles.primaryText}>Tìm gia sư phù hợp</Text><ArrowRight size={18} color="#fff" /></Pressable>
        <Text style={styles.section}>Dành cho bạn</Text>
        <ActionRow icon={Sparkles} title="Tìm bằng AI" detail="Mô tả nhu cầu và xem gia sư phù hợp" color={theme.primary} onPress={() => router.push('/matching')} />
        <ActionRow icon={Compass} title="Khám phá" detail="Gia sư, lớp học và bảng tin" color={theme.primary} onPress={() => router.push('/(app)/explore')} />
        <ActionRow icon={UserRound} title="Hồ sơ của tôi" detail="Thông tin và tài khoản cá nhân" color={theme.primary} onPress={() => router.push('/(app)/profile')} />
      </>}
    </ScrollView>
  </AppShell>;
}

function statusLabel(status?: string | null) {
  return ({ APPROVED: 'Đã được duyệt', PENDING: 'Đang chờ duyệt', REJECTED: 'Cần cập nhật', DRAFT: 'Bản nháp' } as Record<string, string>)[status || ''] || 'Chưa hoàn thiện';
}

type IconType = typeof BookOpen;
function ActionRow({ icon: Icon, title, detail, color, onPress }: { icon: IconType; title: string; detail: string; color: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
    <Icon size={22} color={color} /><View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><ArrowRight size={18} color={base.muted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, alignSelf: 'stretch', padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: '800', marginTop: 18 }, greeting: { color: base.ink, fontSize: 23, fontWeight: '800', marginTop: 8 },
  title: { color: base.ink, fontSize: 30, lineHeight: 37, fontWeight: '800', marginTop: 3 },
  description: { color: base.muted, fontSize: 14, lineHeight: 22, marginTop: 12, marginBottom: 27 },
  status: { padding: 17, borderRadius: 8, borderLeftWidth: 4, flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 26 },
  statusText: { flex: 1 }, statusLabel: { color: base.muted, fontSize: 12 }, statusValue: { color: base.ink, fontWeight: '800', fontSize: 15, marginTop: 3 },
  summary: { flexDirection: 'row', gap: 10, marginBottom: 24 }, summaryItem: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, padding: 16 },
  summaryNumber: { fontSize: 24, fontWeight: '800' }, summaryLabel: { color: base.muted, fontSize: 12, marginTop: 4 },
  primary: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 8, marginBottom: 29 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800', flexShrink: 1 },
  section: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  row: { minHeight: 75, backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, paddingHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1 }, rowTitle: { fontSize: 15, fontWeight: '800', color: base.ink }, rowDetail: { color: base.muted, fontSize: 12, marginTop: 4 },
});
