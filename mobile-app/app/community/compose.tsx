import React, { useEffect, useRef, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { ApiError } from '../../src/api/client';
import { communityApi, type CatalogSubject, type LegacySubject, type Post, type PostInput, type PostType, type ShareableClass, type TutorRegistration, type RewriteSuggestion } from '../../src/api/community';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppShell } from '../../src/components/AppShell';
import { currentRevision, moderationDisplay, pollInput, validatePost } from '../../src/utils/community';
import { base, themeForRole } from '../../src/theme/tokens';

const tutorTypes: Array<[PostType, string]> = [['TUTOR_ANNOUNCEMENT', 'Chia sẻ'], ['TUTOR_POLL', 'Khảo sát'], ['TUTOR_CLASS_SHARE', 'Giới thiệu lớp']];
const makeKey = () => `mobile-community-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function CommunityCompose() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const postId = id ? Number(id) : null;
  const { user, restoring } = useAuth();
  const role = user?.activeRole;
  const color = themeForRole(role).primary;
  const [editing, setEditing] = useState<Post | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogSubject[]>([]);
  const [legacySubjects, setLegacySubjects] = useState<LegacySubject[]>([]);
  const [registrations, setRegistrations] = useState<TutorRegistration[]>([]);
  const [classes, setClasses] = useState<ShareableClass[]>([]);
  const [postType, setPostType] = useState<PostType>(role === 'TUTOR' ? 'TUTOR_ANNOUNCEMENT' : 'STUDENT_FIND_TUTOR');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [catalogSubjectId, setCatalogSubjectId] = useState<number | null>(null);
  const [subjectQuery, setSubjectQuery] = useState('');
  const [catalogLevelId, setCatalogLevelId] = useState<number | null>(null);
  const [registrationId, setRegistrationId] = useState<number | null>(null);
  const [announcementSubjectId, setAnnouncementSubjectId] = useState<number | null>(null);
  const [registrationLevelId, setRegistrationLevelId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [learningMode, setLearningMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [pollQuestion, setPollQuestion] = useState('Bạn học được vào khung giờ nào dưới đây?');
  const [sessions, setSessions] = useState(2);
  const [duration, setDuration] = useState(90);
  const [target, setTarget] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [suggestion, setSuggestion] = useState<RewriteSuggestion | null>(null);
  const [rewriteSourceRevision, setRewriteSourceRevision] = useState<number | null>(null);
  const key = useRef(makeKey());
  const selectedSubject = catalog.find(subject => subject.id === catalogSubjectId);
  const matchedSubjects = subjectQuery.trim() ? catalog.filter(subject => searchText(`${subject.name} ${subject.categoryName || ''}`).includes(searchText(subjectQuery))).slice(0, 12) : [];
  const selectedRegistration = registrations.find(item => item.id === registrationId);
  const selectedLevel = selectedRegistration?.levels?.find(level => level.id === registrationLevelId);
  const selectedClass = classes.find(item => item.id === classId);
  const availableClasses = classes.filter(item => item.status === 'PUBLISHED' && item.terminationCutoffSession == null && item.startDate && item.startDate >= new Date().toISOString().slice(0, 10));
  const effectiveStatus = editing && moderationDisplay(editing).status;
  const canRewrite = effectiveStatus === 'NEEDS_EDIT' || effectiveStatus === 'REJECTED';
  const oldVoteCount = editing?.poll?.totalVotes || 0;

  useEffect(() => {
    if (!user || (role !== 'STUDENT' && role !== 'TUTOR')) return;
    let active = true;
    async function loadOptions() {
      setOptionsLoading(true); setError('');
      try {
        if (role === 'STUDENT') {
          const result = await communityApi.catalog();
          if (active) setCatalog(result.subjects || []);
        } else {
          const [regs, cls, subjects] = await Promise.all([communityApi.registrations(), communityApi.classes(), communityApi.legacySubjects()]);
          if (active) { setRegistrations(regs.filter(item => item.status === 'APPROVED')); setClasses(cls); setLegacySubjects(subjects); }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu tạo bài.'); }
      finally { if (active) setOptionsLoading(false); }
    }
    void loadOptions();
    return () => { active = false; };
  }, [user?.id, role]);

  async function loadEdit(preserveDraft = false) {
    if (!postId || !user) return;
    setLoading(true); setError('');
    try {
      let found: Post | undefined;
      for (let page = 0; page < 50 && !found; page++) {
        const result = await communityApi.feed({ tab: 'MINE', page, size: 50 });
        found = result.content.find(item => item.id === postId);
        if (page + 1 >= result.totalPages) break;
      }
      if (!found || found.authorId !== user.id || found.authorRole !== role) throw new Error('Không tìm thấy bài viết của bạn.');
      setEditing(found); setStale(false);
      setRewriteSourceRevision(null);
      if (!preserveDraft) {
        const source = found.pendingContent || found;
        setPostType(found.postType); setTitle(source.title); setContent(source.content);
        setCatalogSubjectId(source.catalogSubjectId || null); setCatalogLevelId(source.catalogLevelId || null);
        setLearningMode(source.learningMode || 'ONLINE'); setPrice(source.targetPricePerSession ? String(source.targetPricePerSession) : '');
        setAddress(source.address || ''); setClassId(source.linkedClassId || null);
        setAnnouncementSubjectId(source.subjectId || null);
        setPollQuestion(found.poll?.question || 'Bạn học được vào khung giờ nào dưới đây?');
        setSessions(found.poll?.sessionsPerWeek || 2); setDuration(found.poll?.durationMinutes || 90); setTarget(found.poll?.minVotesTarget || 10);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải bài viết.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (postId && user) void loadEdit(); }, [postId, user?.id, role]);
  useEffect(() => {
    if (!editing || !registrations.length) return;
    const reg = registrations.find(item => item.id === editing.subjectId || item.subject?.id === editing.subjectId || item.subject?.name === editing.subjectName);
    if (reg) { setRegistrationId(reg.id); setRegistrationLevelId(reg.levels?.find(level => level.name === editing.educationLevel)?.id || reg.levels?.[0]?.id || null); }
  }, [editing?.id, registrations]);

  function build(): PostInput {
    const student = role === 'STUDENT';
    const poll = postType === 'TUTOR_POLL' ? pollInput(pollQuestion, sessions, duration, target, editing?.poll) : null;
    const legacyStudentEdit = student && editing && !editing.catalogSubjectId && !catalogSubjectId;
    return {
      postType, title: title.trim(), content: content.trim(),
      subjectId: student ? (legacyStudentEdit ? editing.subjectId || null : null) : postType === 'TUTOR_POLL' ? registrationId : postType === 'TUTOR_ANNOUNCEMENT' ? announcementSubjectId : null,
      catalogSubjectId: student ? catalogSubjectId : null,
      catalogLevelId: student ? catalogLevelId : null,
      educationLevel: student ? (legacyStudentEdit ? editing.educationLevel || null : null) : postType === 'TUTOR_POLL' ? selectedLevel?.name || null : postType === 'TUTOR_CLASS_SHARE' ? selectedClass?.level?.name || selectedClass?.registration?.educationLevelName || null : null,
      learningMode: postType === 'TUTOR_CLASS_SHARE' ? selectedClass?.learningMode || 'ONLINE' : learningMode,
      targetPricePerSession: postType === 'TUTOR_ANNOUNCEMENT' ? null : postType === 'TUTOR_CLASS_SHARE' ? selectedClass?.pricePerSession || null : price ? Number(price) : null,
      address: postType === 'TUTOR_CLASS_SHARE' ? selectedClass?.address || null : learningMode === 'OFFLINE' ? address.trim() : null,
      linkedClassId: postType === 'TUTOR_CLASS_SHARE' ? classId : null, poll,
    };
  }
  async function submit() {
    const payload = build();
    const validation = validatePost(payload);
    if (validation && !(role === 'STUDENT' && editing && !editing.catalogSubjectId && !catalogSubjectId && !catalogLevelId && validation.includes('môn học'))) { setError(validation); return; }
    if (payload.targetPricePerSession != null && (!Number.isFinite(payload.targetPricePerSession) || payload.targetPricePerSession <= 0)) { setError('Học phí phải lớn hơn 0.'); return; }
    if (postType === 'TUTOR_POLL' && (sessions < 1 || sessions > 7 || duration < 30 || duration > 240 || target < 1)) { setError('Kiểm tra lại số buổi, thời lượng và mục tiêu khảo sát.'); return; }
    if (postType === 'TUTOR_POLL' && oldVoteCount && (sessions !== editing?.poll?.sessionsPerWeek || duration !== editing?.poll?.durationMinutes)) { setError('Không thể đổi lịch khảo sát sau khi đã có bình chọn.'); return; }
    setBusy(true); setError('');
    try {
      const saved = editing ? await communityApi.update(editing.id, payload, rewriteSourceRevision ?? currentRevision(editing)) : await communityApi.create(payload, key.current);
      key.current = makeKey();
      router.replace({ pathname: '/community/[id]', params: { id: String(saved.id), mine: '1' } });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) { setStale(true); setError('Bài viết đã thay đổi. Tải phiên bản mới trước khi gửi lại; bản nháp của bạn vẫn được giữ.'); }
      else setError(cause instanceof Error ? cause.message : 'Không thể gửi bài viết.');
    } finally { setBusy(false); }
  }
  async function rewrite() {
    if (!editing || !canRewrite) return;
    setBusy(true); setError('');
    try {
      const result = await communityApi.rewrite(editing.id, currentRevision(editing));
      if (!result.canRewrite) { setStale(true); setError('Nội dung đã thay đổi. Tải phiên bản mới rồi tạo gợi ý lại.'); return; }
      setSuggestion(result);
    }
    catch (cause) { if (cause instanceof ApiError && cause.status === 409) setStale(true); setError(cause instanceof Error ? cause.message : 'Không thể gợi ý chỉnh sửa.'); }
    finally { setBusy(false); }
  }
  function applySuggestion() {
    if (!suggestion) return;
    setTitle(suggestion.suggestedTitle || title); setContent(suggestion.suggestedContent || content);
    setRewriteSourceRevision(suggestion.sourceRevision); setSuggestion(null);
  }

  if (restoring) return <View style={styles.restoring}><ActivityIndicator color={color} /></View>;
  if (!user || (role !== 'STUDENT' && role !== 'TUTOR')) return <Redirect href={{ pathname: '/(auth)/sign-in', params: { returnTo: postId ? `/community/compose?id=${postId}` : '/community/compose' } }} />;
  return <AppShell role={role} active={role === 'TUTOR' ? 'home' : 'explore'} title={editing ? 'Sửa bài viết' : 'Đăng bài'}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={color} /><Text style={[styles.link, { color }]}>Cộng đồng</Text></Pressable>
      <Text style={styles.heading}>{editing ? 'Chỉnh sửa bài viết' : 'Tạo bài viết'}</Text>
      {loading || optionsLoading ? <ActivityIndicator color={color} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {stale && <Pressable onPress={() => void loadEdit(true)}><Text style={[styles.link, { color }]}>Tải phiên bản mới (giữ bản nháp)</Text></Pressable>}
      {role === 'TUTOR' && !editing && <View style={styles.segment}>{tutorTypes.map(([value, label]) => <Choice key={value} label={label} selected={postType === value} color={color} onPress={() => setPostType(value)} />)}</View>}
      <Field label="Tiêu đề" value={title} onChangeText={setTitle} placeholder="Tiêu đề bài viết" />
      <Field label="Nội dung" value={content} onChangeText={setContent} placeholder="Bạn muốn chia sẻ điều gì?" multiline />
      {role === 'STUDENT' && <>
        <Text style={styles.section}>Nhu cầu học tập</Text>
        {editing && !editing.catalogSubjectId && <Text style={styles.hint}>Bài cũ: {editing.subjectName} · {editing.educationLevel}. Có thể giữ nguyên hoặc chọn lại danh mục mới.</Text>}
        <Text style={styles.label}>Môn học</Text>
        {selectedSubject && <View style={styles.choices}><Choice label={`${selectedSubject.name} · ${selectedSubject.categoryName || 'Danh mục'}`} selected color={color} onPress={() => { setCatalogSubjectId(null); setCatalogLevelId(null); }} /></View>}
        <TextInput value={subjectQuery} onChangeText={setSubjectQuery} placeholder="Tìm tên môn học" placeholderTextColor={base.muted} style={[styles.input, { marginBottom: 8 }]} />
        {subjectQuery.trim() && <View style={styles.choices}>{matchedSubjects.map(subject => <Choice key={subject.id} label={`${subject.name} · ${subject.categoryName || 'Danh mục'}`} selected={catalogSubjectId === subject.id} color={color} onPress={() => { setCatalogSubjectId(subject.id); setCatalogLevelId(null); setSubjectQuery(''); }} />)}</View>}
        {subjectQuery.trim() && !matchedSubjects.length && <Text style={styles.hint}>Không tìm thấy môn học phù hợp.</Text>}
        {selectedSubject && <><Text style={styles.label}>Trình độ</Text><View style={styles.choices}>{selectedSubject.levels.map(level => <Choice key={level.id} label={level.name} selected={catalogLevelId === level.id} color={color} onPress={() => setCatalogLevelId(level.id)} />)}</View></>}
      </>}
      {role === 'TUTOR' && postType === 'TUTOR_POLL' && <>
        <Text style={styles.section}>Môn giảng dạy đã duyệt</Text>
        {!registrations.length && <Text style={styles.hint}>Chưa có môn giảng dạy được duyệt.</Text>}
        <View style={styles.choices}>{registrations.map(reg => <Choice key={reg.id} label={reg.subject?.name || reg.proposedSubjectName || `Môn #${reg.id}`} selected={registrationId === reg.id} color={color} onPress={() => { setRegistrationId(reg.id); setRegistrationLevelId(null); setPrice(reg.tuitionMin ? String(reg.tuitionMin) : ''); }} />)}</View>
        {selectedRegistration && <><Text style={styles.label}>Lớp / cấp độ</Text><View style={styles.choices}>{selectedRegistration.levels?.map(level => <Choice key={level.id} label={level.name} selected={registrationLevelId === level.id} color={color} onPress={() => setRegistrationLevelId(level.id)} />)}</View></>}
        <Text style={styles.section}>Khảo sát lịch học</Text>
        <Field label="Câu hỏi" value={pollQuestion} onChangeText={setPollQuestion} />
        <Stepper label="Số buổi mỗi tuần" value={sessions} min={1} max={7} locked={oldVoteCount > 0} onChange={setSessions} />
        <Stepper label="Thời lượng (phút)" value={duration} min={30} max={240} step={30} locked={oldVoteCount > 0} onChange={setDuration} />
        <Stepper label="Mục tiêu bình chọn" value={target} min={1} max={100} onChange={setTarget} />
        <Text style={styles.hint}>21 khung giờ chuẩn: thứ Hai đến Chủ nhật, sáng / chiều / tối. Học viên chọn tối đa {sessions} khung giờ.</Text>
      </>}
      {role === 'TUTOR' && postType === 'TUTOR_CLASS_SHARE' && <><Text style={styles.section}>Lớp đang tuyển sinh</Text>{!availableClasses.length && <Text style={styles.hint}>Chưa có lớp đã công bố và sắp khai giảng.</Text>}<View style={styles.choices}>{availableClasses.map(item => <Choice key={item.id} label={item.name} selected={classId === item.id} color={color} onPress={() => setClassId(item.id)} />)}</View></>}
      {role === 'TUTOR' && postType === 'TUTOR_ANNOUNCEMENT' && <><Text style={styles.label}>Gắn môn học (không bắt buộc)</Text><View style={styles.choices}>{legacySubjects.map(subject => <Choice key={subject.id} label={subject.name} selected={announcementSubjectId === subject.id} color={color} onPress={() => setAnnouncementSubjectId(announcementSubjectId === subject.id ? null : subject.id)} />)}</View></>}
      {(role === 'STUDENT' || postType === 'TUTOR_POLL') && <>
        <Text style={styles.section}>Hình thức và học phí</Text><View style={styles.segment}><Choice label="Trực tuyến" selected={learningMode === 'ONLINE'} color={color} onPress={() => setLearningMode('ONLINE')} /><Choice label="Trực tiếp" selected={learningMode === 'OFFLINE'} color={color} onPress={() => setLearningMode('OFFLINE')} /></View>
        <Field label="Học phí mong muốn (đ/buổi, không bắt buộc)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Ví dụ: 150000" />
        {learningMode === 'OFFLINE' && <Field label="Địa chỉ học trực tiếp" value={address} onChangeText={setAddress} placeholder="Khu vực / địa chỉ" />}
      </>}
      {canRewrite && <View style={styles.rewrite}><View style={styles.rewriteHeading}><Sparkles size={18} color={color} /><Text style={styles.rewriteTitle}>Gợi ý chỉnh sửa bằng AI</Text></View><Text style={styles.hint}>{moderationDisplay(editing!).reason || 'Nội dung cần được điều chỉnh trước khi gửi lại.'}</Text><Pressable disabled={busy} onPress={() => void rewrite()}><Text style={[styles.link, { color }]}>Tạo gợi ý</Text></Pressable></View>}
      {suggestion && <View style={styles.suggestion}><Text style={styles.rewriteTitle}>Bản gợi ý (chưa lưu)</Text><Text style={styles.suggestTitle}>{suggestion.suggestedTitle}</Text><Text style={styles.suggestContent}>{suggestion.suggestedContent}</Text>{suggestion.summaryOfChanges && <Text style={styles.hint}>{suggestion.summaryOfChanges}</Text>}<View style={styles.segment}><Pressable onPress={applySuggestion} style={styles.secondary}><Text style={[styles.link, { color }]}>Chèn vào form</Text></Pressable><Pressable onPress={() => setSuggestion(null)} style={styles.secondary}><Text style={styles.hint}>Bỏ qua</Text></Pressable></View></View>}
      <Text style={styles.hint}>Sau khi gửi, AI sẽ kiểm duyệt. Bản chỉnh sửa chưa xuất hiện công khai cho đến khi được duyệt.</Text>
      <Pressable disabled={busy || loading || optionsLoading || Boolean(postId && !editing)} onPress={() => void submit()} style={[styles.submit, { backgroundColor: color }, (busy || loading || optionsLoading) && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{editing ? 'Gửi bản chỉnh sửa' : 'Đăng bài'}</Text>}</Pressable>
    </ScrollView></KeyboardAvoidingView>
  </AppShell>;
}

function searchText(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase(); }

function Choice({ label, selected, color, onPress }: { label: string; selected: boolean; color: string; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && { borderColor: color, backgroundColor: '#e8f5f2' }]}><Text style={[styles.choiceText, selected && { color }]}>{label}</Text></Pressable>;
}
function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'numeric' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} textAlignVertical={props.multiline ? 'top' : 'center'} style={[styles.input, props.multiline && styles.textarea]} placeholderTextColor={base.muted} /></View>;
}
function Stepper({ label, value, min, max, step = 1, locked, onChange }: { label: string; value: number; min: number; max: number; step?: number; locked?: boolean; onChange: (value: number) => void }) {
  return <View style={styles.stepper}><Text style={styles.label}>{label}</Text><View style={styles.stepperControls}><Pressable disabled={locked || value <= min} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepButton}><Text>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable disabled={locked || value >= max} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepButton}><Text>+</Text></Pressable></View></View>;
}
const styles = StyleSheet.create({
  restoring: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: base.background },
  content: { padding: 18, paddingBottom: 44, maxWidth: 640, width: '100%', alignSelf: 'center' }, back: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 17 },
  heading: { fontSize: 23, color: base.ink, fontWeight: '800', marginBottom: 18 }, section: { fontSize: 16, color: base.ink, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  label: { color: base.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 }, field: { marginBottom: 15 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 7, paddingHorizontal: 12, minHeight: 47, color: base.ink, fontSize: 14 }, textarea: { minHeight: 135, paddingTop: 12, lineHeight: 21 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }, segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 13 },
  choice: { borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 6 }, choiceText: { color: base.ink, fontSize: 12, fontWeight: '700' },
  hint: { color: base.muted, fontSize: 12, lineHeight: 18, marginBottom: 11 }, error: { color: base.danger, backgroundColor: '#fff0ef', padding: 11, borderRadius: 6, marginBottom: 12, fontSize: 13 }, link: { fontSize: 13, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }, stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 }, stepButton: { width: 35, height: 35, borderWidth: 1, borderColor: base.line, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, stepValue: { minWidth: 30, textAlign: 'center', color: base.ink, fontWeight: '800' },
  rewrite: { backgroundColor: '#f0f9f8', borderColor: '#cce9e5', borderWidth: 1, borderRadius: 7, padding: 13, marginVertical: 14 }, rewriteHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }, rewriteTitle: { color: base.ink, fontWeight: '800', fontSize: 14 },
  suggestion: { backgroundColor: '#fff', borderColor: base.line, borderWidth: 1, borderRadius: 7, padding: 13, marginBottom: 13 }, suggestTitle: { color: base.ink, fontWeight: '800', marginTop: 10, marginBottom: 7 }, suggestContent: { color: base.ink, lineHeight: 21, fontSize: 13 }, secondary: { padding: 9 },
  submit: { minHeight: 48, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
