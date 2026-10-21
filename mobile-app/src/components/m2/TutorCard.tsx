import React, { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BadgeCheck, CalendarDays, MapPin, Star } from 'lucide-react-native';
import type { TutorProfile, TutorSubject } from '../../api/m2';
import { base } from '../../theme/tokens';

export function money(value?: number | null) { return value == null ? 'Liên hệ' : `${Number(value).toLocaleString('vi-VN')}đ`; }
export function fee(min?: number | null, max?: number | null) {
  if (min == null && max == null) return 'Liên hệ';
  if (min != null && max != null && Number(min) !== Number(max)) return `${money(min)} - ${money(max)}`;
  return money(min ?? max);
}
export function locationText(location?: TutorProfile['location']) {
  return [location?.communeName, location?.provinceName].filter(Boolean).join(', ');
}
export function dayText(day: number) { return day === 8 ? 'CN' : `T${day}`; }
export function avatarInitials(name: string) { return name.trim().split(/\s+/).slice(-2).map(item => item[0]).join('').toUpperCase(); }

export function TutorCard({ tutor, selectedSubjectId, ai = false }: { tutor: TutorProfile; selectedSubjectId?: number; ai?: boolean }) {
  const [showScore, setShowScore] = useState(false);
  const subject: TutorSubject | undefined = ai ? tutor.matchedSubject : tutor.subjects?.find(item => item.subjectId === selectedSubjectId);
  const headline = subject?.subjectName || tutor.subjects?.slice(0, 3).map(item => item.subjectName).join(' · ') || 'Gia sư EduConnect';
  const price = subject ? fee(subject.tuitionMin, subject.tuitionMax) : tutor.startingTuition == null ? 'Liên hệ' : `Từ ${money(tutor.startingTuition)}`;
  const rating = Number(tutor.reviewCount || 0) > 0 && tutor.averageRating != null;
  const availability = [...new Set((tutor.availability || []).map(slot => dayText(slot.dayOfWeek)))].join(', ');
  const score = Number(tutor.matchPercentage);
  const criteria = tutor.scoreBreakdown?.criteria || [];
  return <Pressable accessibilityRole="button" accessibilityLabel={`Xem hồ sơ ${tutor.fullName}`} onPress={() => router.push({ pathname: '/tutors/[id]', params: { id: String(tutor.tutorId) } })} style={styles.card}>
    <View style={styles.top}>
      {tutor.avatarUrl ? <Image source={{ uri: tutor.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{avatarInitials(tutor.fullName || 'GS')}</Text></View>}
      <View style={styles.identity}><Text style={styles.name} numberOfLines={2}>{tutor.fullName}</Text>
        {tutor.approvedOrVerified ? <View style={styles.verified}><BadgeCheck size={13} color={base.success} /><Text style={styles.verifiedText}>Đã xét duyệt</Text></View> : null}
        <View style={styles.rating}><Star size={13} color="#d58a16" fill={rating ? '#d58a16' : 'none'} /><Text style={styles.meta}>{rating ? `${Number(tutor.averageRating).toFixed(1)} · ${tutor.reviewCount} đánh giá` : 'Chưa có đánh giá'}</Text></View>
      </View>
      {ai && Number.isFinite(score) ? <View style={styles.score}><Text style={styles.scoreNumber}>{Math.round(score)}%</Text><Text style={styles.scoreLabel}>Phù hợp</Text></View> : null}
    </View>
    <Text style={styles.specialty} numberOfLines={2}>{headline}</Text>
    {subject?.levels?.length ? <Text style={styles.meta} numberOfLines={2}>{subject.levels.map(level => level.levelName).join(' · ')}</Text> : ai && tutor.matchedSubject?.levelName ? <Text style={styles.meta}>{tutor.matchedSubject.levelName}</Text> : null}
    <View style={styles.metaGrid}>
      {subject?.experienceYears != null ? <Text style={styles.meta}>{subject.experienceYears} năm kinh nghiệm</Text> : null}
      {tutor.teachingModes?.length ? <Text style={styles.meta}>{tutor.teachingModes.map(mode => mode === 'ONLINE' ? 'Online' : 'Trực tiếp').join(' · ')}</Text> : null}
      {locationText(tutor.location) ? <View style={styles.inline}><MapPin size={13} color={base.muted} /><Text style={styles.meta} numberOfLines={1}>{locationText(tutor.location)}</Text></View> : null}
      {availability ? <View style={styles.inline}><CalendarDays size={13} color={base.muted} /><Text style={styles.meta} numberOfLines={1}>Lịch rảnh: {availability}</Text></View> : null}
    </View>
    {subject?.description || tutor.bio ? <Text style={styles.bio} numberOfLines={2}>{subject?.description || tutor.bio}</Text> : null}
    {ai && tutor.matchingReasons?.length ? <View style={styles.reasons}><Text style={styles.reasonTitle}>Vì sao phù hợp</Text>{tutor.matchingReasons.slice(0, 3).map((reason, index) => <Text key={`${index}-${reason}`} style={styles.reason}>• {reason}</Text>)}</View> : null}
    {ai && tutor.mismatchReasons?.length ? <Text style={styles.caveat}>Chưa khớp: {tutor.mismatchReasons.slice(0, 2).join('; ')}</Text> : null}
    {ai && criteria.length ? <View style={styles.explanation}><Pressable onPress={event => { event.stopPropagation(); setShowScore(value => !value); }} accessibilityRole="button" accessibilityLabel={`Vì sao ${Math.round(score)} phần trăm phù hợp`}><Text style={styles.explanationTitle}>Vì sao {Math.round(score)}%? {showScore ? 'Thu gọn' : 'Xem chi tiết'}</Text></Pressable>{showScore ? criteria.slice(0, 5).map(item => <View key={item.criterion || item.label} style={styles.criterion}><Text style={styles.criterionTitle}>{item.label} · {Math.round(Number(item.contribution || 0))}/{item.weight}</Text><Text style={styles.meta}>{item.evidence || item.policy}</Text></View>) : null}</View> : null}
    <View style={styles.bottom}><View><Text style={styles.priceLabel}>Mức nhận dạy / buổi</Text><Text style={styles.price}>{price}</Text></View><ArrowRight size={19} color="#2463ae" /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, padding: 16, marginBottom: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, avatar: { width: 58, height: 58, borderRadius: 8 },
  avatarFallback: { width: 58, height: 58, borderRadius: 8, backgroundColor: '#e8f1fb', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#2463ae', fontSize: 19, fontWeight: '800' }, identity: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: base.ink, fontSize: 17, fontWeight: '800' }, verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: base.success, fontSize: 11, fontWeight: '700' }, rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  score: { backgroundColor: '#e8f1fb', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center' },
  scoreNumber: { color: '#2463ae', fontWeight: '800', fontSize: 18 }, scoreLabel: { color: '#2463ae', fontSize: 10, fontWeight: '700' },
  specialty: { color: base.ink, fontSize: 15, fontWeight: '800' }, meta: { color: base.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  metaGrid: { gap: 4 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reasons: { backgroundColor: '#edf7f2', borderRadius: 7, padding: 10, gap: 4 }, reasonTitle: { color: base.success, fontSize: 11, fontWeight: '800' },
  reason: { color: '#215943', fontSize: 12, lineHeight: 18 }, caveat: { color: '#976917', fontSize: 12, lineHeight: 18 },
  bio: { color: base.muted, fontSize: 12, lineHeight: 19 }, explanation: { borderTopWidth: 1, borderColor: base.line, paddingTop: 8, gap: 8 },
  explanationTitle: { color: '#2463ae', fontSize: 12, fontWeight: '800' }, criterion: { gap: 2 }, criterionTitle: { color: base.ink, fontSize: 12, fontWeight: '700' },
  bottom: { borderTopWidth: 1, borderColor: base.line, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { color: base.muted, fontSize: 11 }, price: { color: base.ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
});
