import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, MapPin, Star } from 'lucide-react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { tutorM2, type Page, type TutorProfile, type TutorReview } from '../../src/api/m2';
import { AppShell } from '../../src/components/AppShell';
import { avatarInitials, dayText, fee, locationText, money } from '../../src/components/m2/TutorCard';
import { base } from '../../src/theme/tokens';

export default function TutorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [reviews, setReviews] = useState<Page<TutorReview> | null>(null);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewReload, setReviewReload] = useState(0);
  const [reviewError, setReviewError] = useState('');
  const [deferred, setDeferred] = useState('');
  useEffect(() => {
    const tutorId = Number(id); if (!Number.isInteger(tutorId) || tutorId <= 0) { setError('Hồ sơ gia sư không hợp lệ.'); setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    tutorM2.detail(tutorId).then(data => { if (active) setTutor(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ gia sư.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload]);
  useEffect(() => {
    if (!tutor?.userId) return;
    let active = true; setReviewError('');
    tutorM2.reviews(tutor.userId, reviewPage).then(data => { if (active) setReviews(data); })
      .catch(cause => { if (active) setReviewError(cause instanceof Error ? cause.message : 'Không thể tải đánh giá.'); });
    return () => { active = false; };
  }, [tutor?.userId, reviewPage, reviewReload]);

  const modes = tutor?.teachingModes?.map(mode => mode === 'ONLINE' ? 'Online' : 'Trực tiếp').join(' · ');
  return <AppShell active="explore" title="Hồ sơ gia sư" role={user?.activeRole === 'TUTOR' ? 'TUTOR' : user ? 'STUDENT' : null}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={17} color={base.muted} /><Text style={styles.backText}>Quay lại danh sách</Text></Pressable>
      {loading ? <ActivityIndicator color="#2463ae" style={{ marginTop: 40 }} /> : error ? <View style={styles.section}><Text style={styles.error}>{error}</Text><Pressable onPress={() => setReload(value => value + 1)}><Text style={styles.link}>Thử lại</Text></Pressable></View> : tutor ? <>
        <View style={styles.header}>
          {tutor.avatarUrl ? <Image source={{ uri: tutor.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{avatarInitials(tutor.fullName)}</Text></View>}
          <View style={styles.headerText}><Text style={styles.name}>{tutor.fullName}</Text>{tutor.approvedOrVerified ? <View style={styles.inline}><BadgeCheck size={15} color={base.success} /><Text style={styles.verified}>Đã xét duyệt</Text></View> : null}
            <Text style={styles.meta}>{tutor.subjects?.map(item => item.subjectName).join(' · ') || 'Gia sư EduConnect'}</Text></View>
        </View>
        <View style={styles.summary}><View style={styles.summaryItem}><Text style={styles.summaryValue}>{tutor.reviewCount && tutor.averageRating != null ? Number(tutor.averageRating).toFixed(1) : '—'}</Text><Text style={styles.summaryLabel}>{tutor.reviewCount || 0} đánh giá</Text></View><View style={styles.summaryItem}><Text style={styles.summaryValue}>{tutor.startingTuition == null ? 'Liên hệ' : money(tutor.startingTuition)}</Text><Text style={styles.summaryLabel}>Mức nhận dạy từ / buổi</Text></View></View>
        {locationText(tutor.location) ? <View style={styles.inline}><MapPin size={15} color={base.muted} /><Text style={styles.meta}>{locationText(tutor.location)}</Text></View> : null}
        {modes ? <Text style={styles.meta}>Hình thức: {modes}</Text> : null}
        <View style={styles.section}><Text style={styles.sectionTitle}>Giới thiệu</Text><Text style={styles.body}>{tutor.bio || 'Gia sư chưa cập nhật phần giới thiệu công khai.'}</Text></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Môn học & năng lực giảng dạy</Text>{tutor.subjects?.length ? tutor.subjects.map(subject => <View key={subject.registrationId || subject.subjectId} style={styles.subject}><Text style={styles.subjectName}>{subject.subjectName}</Text><Text style={styles.meta}>{[subject.categoryName, subject.experienceYears == null ? null : `${subject.experienceYears} năm kinh nghiệm`].filter(Boolean).join(' · ')}</Text><Text style={styles.body}>{subject.levels?.map(level => level.levelName).join(' · ') || 'Chưa công bố cấp độ'}</Text><Text style={styles.fee}>{fee(subject.tuitionMin, subject.tuitionMax)} / buổi</Text>{subject.description ? <Text style={styles.body}>{subject.description}</Text> : null}</View>) : <Text style={styles.meta}>Hồ sơ chưa có môn được duyệt công khai.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Lịch có thể giảng dạy</Text>{tutor.availability?.length ? tutor.availability.map((slot, index) => <View key={slot.id || index} style={styles.slot}><CalendarDays size={15} color="#2463ae" /><Text style={styles.body}>{dayText(slot.dayOfWeek)} · {slot.startTime} - {slot.endTime}</Text></View>) : <Text style={styles.meta}>Gia sư chưa công khai khung giờ có thể giảng dạy.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Đánh giá từ học viên</Text><Text style={styles.meta}>{tutor.reviewCount || 0} đánh giá công khai</Text>{reviewError ? <Pressable onPress={() => { setReviews(null); setReviewReload(value => value + 1); }}><Text style={styles.error}>{reviewError} Nhấn để thử lại.</Text></Pressable> : reviews ? reviews.content.length ? reviews.content.map(review => <View key={review.id} style={styles.review}><View style={styles.inline}><Star size={15} color="#d58a16" fill="#d58a16" /><Text style={styles.subjectName}>{review.rating}/5</Text><Text style={styles.meta}>{review.createdAt?.slice(0, 10) || ''}</Text></View>{review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}</View>) : <Text style={styles.meta}>Chưa có đánh giá công khai.</Text> : <ActivityIndicator color="#2463ae" />}
          {reviews && reviews.totalPages > 1 ? <View style={styles.pager}><Pressable disabled={reviewPage <= 0} onPress={() => setReviewPage(value => value - 1)} style={styles.pageButton}><ChevronLeft color="#2463ae" size={18} /></Pressable><Text style={styles.meta}>Trang {reviewPage + 1}/{reviews.totalPages}</Text><Pressable disabled={reviews.last} onPress={() => setReviewPage(value => value + 1)} style={styles.pageButton}><ChevronRight color="#2463ae" size={18} /></Pressable></View> : null}
        </View>
        {tutor.publishedClassCount ? <View style={styles.section}><Text style={styles.sectionTitle}>Lớp công khai</Text><Text style={styles.meta}>{tutor.publishedClassCount} lớp đang công khai. Xem lớp trong phiên bản ứng dụng tiếp theo.</Text></View> : null}
        <View style={styles.section}><Text style={styles.sectionTitle}>Kết nối với gia sư</Text><View style={styles.actions}><Pressable onPress={() => setDeferred('Nhắn tin sẽ có trên ứng dụng ở giai đoạn tiếp theo.')} style={styles.action}><Text style={styles.actionText}>Nhắn tin</Text></Pressable><Pressable onPress={() => setDeferred('Theo dõi gia sư sẽ có trên ứng dụng ở giai đoạn tiếp theo.')} style={styles.action}><Text style={styles.actionText}>Theo dõi</Text></Pressable></View>{deferred ? <Text style={styles.meta}>{deferred}</Text> : null}</View>
      </> : null}
    </ScrollView>
  </AppShell>;
}

const styles = StyleSheet.create({
  content: { maxWidth: 620, width: '100%', alignSelf: 'center', padding: 18, paddingBottom: 40, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }, backText: { color: base.muted, fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', gap: 15, alignItems: 'center' }, avatar: { width: 82, height: 82, borderRadius: 8 },
  avatarFallback: { width: 82, height: 82, borderRadius: 8, backgroundColor: '#e8f1fb', alignItems: 'center', justifyContent: 'center' }, initials: { color: '#2463ae', fontSize: 24, fontWeight: '800' },
  headerText: { flex: 1, gap: 5 }, name: { color: base.ink, fontSize: 23, fontWeight: '800' }, inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verified: { color: base.success, fontSize: 12, fontWeight: '700' }, meta: { color: base.muted, fontSize: 13, lineHeight: 20 },
  summary: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: base.line, paddingVertical: 16, marginTop: 7 },
  summaryItem: { flex: 1, paddingRight: 8 }, summaryValue: { color: base.ink, fontSize: 19, fontWeight: '800' }, summaryLabel: { color: base.muted, fontSize: 11, marginTop: 3 },
  section: { marginTop: 10, paddingTop: 18, borderTopWidth: 1, borderColor: base.line, gap: 10 }, sectionTitle: { color: base.ink, fontSize: 18, fontWeight: '800' }, body: { color: base.ink, fontSize: 14, lineHeight: 22 },
  subject: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, padding: 14, gap: 5 }, subjectName: { color: base.ink, fontSize: 15, fontWeight: '800' }, fee: { color: '#2463ae', fontSize: 14, fontWeight: '800' },
  slot: { flexDirection: 'row', gap: 8, alignItems: 'center' }, review: { paddingVertical: 12, borderBottomWidth: 1, borderColor: base.line, gap: 7 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }, pageButton: { width: 44, height: 44, borderWidth: 1, borderColor: base.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 9 }, action: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#2463ae', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#2463ae', fontWeight: '800' },
  error: { color: base.danger, fontSize: 13 }, link: { color: '#2463ae', fontSize: 13, fontWeight: '800' },
});
