import React, { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { aiTutorM2, buildTutorMatchPayload, patchAiRequirement, type AiRequirement, type Clarification, type GroundingResult, type MatchingResult } from '../src/api/m2';
import { AppShell } from '../src/components/AppShell';
import { TutorCard, money } from '../src/components/m2/TutorCard';
import { base } from '../src/theme/tokens';

type Step = 'INPUT' | 'ANALYZING' | 'GROUNDING' | 'REVIEW' | 'MATCHING' | 'RESULTS';
type Draft = { step: Step; message: string; analyzed: AiRequirement | null; grounded: GroundingResult | null; result: MatchingResult | null };
const drafts = new Map<number, Draft>();
const hints = ['Ôn thi', 'Cải thiện môn yếu', 'Học online', 'Học trực tiếp', 'Buổi tối', 'Cuối tuần'];

export default function TutorMatching() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('INPUT');
  const [message, setMessage] = useState('');
  const [analyzed, setAnalyzed] = useState<AiRequirement | null>(null);
  const [grounded, setGrounded] = useState<GroundingResult | null>(null);
  const [result, setResult] = useState<MatchingResult | null>(null);
  const [freeText, setFreeText] = useState<Record<string, string>>({});
  const [optional, setOptional] = useState({ learningGoal: '', weakTopics: '', tutorPreferences: '' });
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!user) return;
    const saved = drafts.get(user.id);
    if (saved) { setStep(saved.step); setMessage(saved.message); setAnalyzed(saved.analyzed); setGrounded(saved.grounded); setResult(saved.result); }
  }, [user?.id]);
  useEffect(() => {
    if (!user || step === 'ANALYZING' || step === 'GROUNDING' || step === 'MATCHING') return;
    drafts.set(user.id, { step, message, analyzed, grounded, result });
  }, [user?.id, step, message, analyzed, grounded, result]);
  useEffect(() => {
    if (step !== 'REVIEW' && step !== 'RESULTS') return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [step]);

  if (!user) return <Redirect href={{ pathname: '/(auth)/sign-in', params: { returnTo: '/matching' } }} />;
  if (user.activeRole !== 'STUDENT') return <Redirect href="/(app)" />;

  async function ground(requirement: AiRequirement) {
    setStep('GROUNDING'); setError('');
    try { const data = await aiTutorM2.ground(requirement); setGrounded(data); setStep('REVIEW'); }
    catch (cause) { setStep('REVIEW'); setError(friendlyError(cause, 'ground')); }
  }
  async function analyze() {
    const text = message.trim();
    if (text.length < 10) { setError('Bạn hãy mô tả nhu cầu học tập rõ hơn một chút.'); return; }
    setStep('ANALYZING'); setError(''); setGrounded(null); setResult(null);
    try {
      const response = await aiTutorM2.analyze(text);
      if (response.status === 'INVALID' || !response.requirement) { setStep('INPUT'); setError('Nội dung chưa giống nhu cầu tìm gia sư. Hãy nêu môn học, trình độ hoặc mục tiêu.'); return; }
      setAnalyzed(response.requirement); await ground(response.requirement);
    } catch (cause) { setStep('INPUT'); setError(friendlyError(cause, 'analyze')); }
  }
  async function clarify(clarification: Clarification, option: { name?: string; value?: string; code?: string }) {
    if (!analyzed) return;
    const next = patchAiRequirement(analyzed, clarification, option); setAnalyzed(next); await ground(next);
  }
  async function match() {
    const requirement = grounded?.requirement;
    if (!grounded?.coreMatchingReady || !requirement?.subject?.id || !requirement.level?.id || !requirement.teachingMode) { setError('Vui lòng bổ sung thông tin bắt buộc trước khi tìm gia sư.'); return; }
    setStep('MATCHING'); setError('');
    try { const response = await aiTutorM2.match(buildTutorMatchPayload(requirement, optional)); setResult(response); setStep('RESULTS'); }
    catch (cause) { setStep('REVIEW'); setError(friendlyError(cause, 'match')); }
  }
  function startAgain() { setStep('INPUT'); setResult(null); setGrounded(null); setAnalyzed(null); setError(''); }
  const requirement = grounded?.requirement;
  const busy = step === 'ANALYZING' || step === 'GROUNDING' || step === 'MATCHING';
  const ready = Boolean(grounded?.coreMatchingReady && requirement?.subject?.id && requirement?.level?.id && requirement?.teachingMode);

  return <AppShell active="explore" title="Tìm bằng AI" role="STUDENT"><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={17} color={base.muted} /><Text style={styles.backText}>Quay lại</Text></Pressable>
      <View style={styles.titleRow}><Sparkles size={22} color="#2463ae" /><Text style={styles.title}>Tìm gia sư bằng AI</Text></View>
      {step === 'INPUT' || step === 'ANALYZING' || step === 'GROUNDING' ? <>
        <Text style={styles.intro}>Bạn đang cần một gia sư như thế nào? Mô tả tự nhiên bằng tiếng Việt; EduConnect sẽ kiểm tra với dữ liệu môn học và gia sư thật.</Text>
        <Text style={styles.label}>Nhu cầu học tập của bạn</Text>
        <TextInput accessibilityLabel="Nhu cầu học tập" multiline textAlignVertical="top" maxLength={3000} editable={!busy} value={message} onChangeText={setMessage} placeholder="Ví dụ: Em học lớp 12, cần gia sư Toán online ôn thi, yếu hình học, rảnh tối thứ 2..." placeholderTextColor="#8999a4" style={styles.input} />
        <Text style={styles.counter}>{message.length}/3000</Text>
        <View style={styles.hints}>{hints.map(hint => <Pressable key={hint} disabled={busy} onPress={() => setMessage(current => current.trim() ? `${current.trim()} ${hint.toLowerCase()}.` : `${hint}. `)} style={styles.hint}><Text style={styles.hintText}>{hint}</Text></Pressable>)}</View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <View style={styles.busy}><ActivityIndicator color="#2463ae" /><Text style={styles.intro}>{step === 'ANALYZING' ? 'AI đang phân tích nhu cầu...' : 'Đang kiểm tra môn học và khu vực...'}</Text></View> : null}
        <Pressable disabled={busy} onPress={() => void analyze()} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>Phân tích nhu cầu</Text></Pressable>
      </> : null}
      {step === 'REVIEW' || step === 'MATCHING' ? <>
        <Text style={styles.intro}>Kiểm tra thông tin AI đã hiểu. Bạn có thể bổ sung phần còn thiếu trước khi tìm.</Text>
        {requirement ? <View style={styles.review}>
          <Info label="Môn học" value={requirement.subject?.name || 'Cần bổ sung'} /><Info label="Trình độ" value={requirement.level?.name || 'Cần bổ sung'} />
          <Info label="Hình thức" value={requirement.teachingMode === 'ONLINE' ? 'Online' : requirement.teachingMode === 'OFFLINE' ? 'Trực tiếp' : 'Cần bổ sung'} />
          <Info label="Ngân sách" value={budgetText(requirement.budget)} />
          <Info label="Thời gian" value={requirement.preferredSchedules?.length ? requirement.preferredSchedules.map(slot => `${slot.dayOfWeek ? slot.dayOfWeek === 8 ? 'CN' : `T${slot.dayOfWeek}` : ''} ${slot.startTime && slot.endTime ? `${slot.startTime}-${slot.endTime}` : slot.timeOfDayHint || ''}`).join('; ') : 'Chưa nêu'} />
          <Info label="Khu vực" value={requirement.teachingMode === 'ONLINE' ? 'Không yêu cầu cho Online' : [requirement.location?.communeName, requirement.location?.provinceName].filter(Boolean).join(', ') || requirement.locationHint || 'Chưa nêu'} />
          <Info label="Mục tiêu" value={requirement.learningGoal || 'Chưa nêu'} /><Info label="Nội dung cần cải thiện" value={requirement.weakTopics?.join(', ') || 'Chưa nêu'} /><Info label="Mong muốn về gia sư" value={requirement.tutorPreferences?.join(', ') || 'Chưa nêu'} />
        </View> : <View style={styles.review}><Text style={styles.error}>Chưa kiểm tra được dữ liệu môn học.</Text>{analyzed ? <Pressable onPress={() => void ground(analyzed)}><Text style={styles.link}>Thử kiểm tra lại</Text></Pressable> : null}</View>}
        {grounded?.clarifications?.length ? <View style={styles.clarifications}><Text style={styles.sectionTitle}>Thông tin cần làm rõ</Text>{grounded.clarifications.map((item, index) => <View key={`${item.field}-${index}`} style={styles.clarification}><Text style={styles.label}>{item.question || fallbackQuestion(item.field)}{item.blocking ? ' *' : ''}</Text>
          {item.options?.length ? <View style={styles.hints}>{item.options.map((option, optionIndex) => <Pressable key={`${option.value || option.id}-${optionIndex}`} disabled={busy} onPress={() => void clarify(item, option)} style={styles.hint}><Text style={styles.hintText}>{option.name}</Text></Pressable>)}</View> : null}
          {item.freeTextAllowed ? <View style={styles.freeText}><TextInput accessibilityLabel={`Bổ sung ${item.field}`} value={freeText[item.field] || ''} onChangeText={value => setFreeText(current => ({ ...current, [item.field]: value }))} placeholder="Nhập bổ sung" style={styles.smallInput} /><Pressable onPress={() => { const value = freeText[item.field]?.trim(); if (value) void clarify(item, { name: value, value }); }} style={styles.smallButton}><Text style={styles.smallButtonText}>Dùng</Text></Pressable></View> : null}
        </View>)}</View> : null}
        <View style={styles.optional}><Text style={styles.sectionTitle}>Bổ sung nếu bạn muốn</Text>{!requirement?.learningGoal ? <OptionalField label="Mục tiêu học tập" value={optional.learningGoal} onChange={value => setOptional(current => ({ ...current, learningGoal: value }))} /> : null}
          {!requirement?.weakTopics?.length ? <OptionalField label="Nội dung đang gặp khó khăn (ngăn cách bằng dấu phẩy)" value={optional.weakTopics} onChange={value => setOptional(current => ({ ...current, weakTopics: value }))} /> : null}
          {!requirement?.tutorPreferences?.length ? <OptionalField label="Mong muốn về gia sư (ngăn cách bằng dấu phẩy)" value={optional.tutorPreferences} onChange={value => setOptional(current => ({ ...current, tutorPreferences: value }))} /> : null}</View>
        {error ? <Text style={styles.error}>{error}</Text> : null}{!ready ? <Text style={styles.warning}>Cần làm rõ môn học, trình độ và hình thức trước khi tìm.</Text> : null}
        <Pressable disabled={!ready || busy} onPress={() => void match()} style={[styles.primary, (!ready || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Tìm gia sư phù hợp</Text>}</Pressable>
        <Pressable disabled={busy} onPress={() => setStep('INPUT')} style={styles.secondary}><Text style={styles.secondaryText}>Sửa mô tả ban đầu</Text></Pressable>
      </> : null}
      {step === 'RESULTS' && result ? <>
        <Text style={styles.intro}>Gia sư được sắp xếp theo điểm phù hợp từ hệ thống. Không thay đổi thứ tự kết quả.</Text>
        <Text style={styles.sectionTitle}>{result.results.length} gia sư phù hợp</Text>
        {!result.results.length ? <View style={styles.review}><Text style={styles.intro}>Chưa tìm thấy gia sư theo nhu cầu này. Thử điều chỉnh mô tả hoặc xem tất cả gia sư.</Text><Pressable onPress={startAgain}><Text style={styles.link}>Mô tả lại nhu cầu</Text></Pressable></View> : result.results.map(tutor => <TutorCard key={tutor.tutorId} tutor={tutor} ai />)}
        <Pressable onPress={startAgain} style={styles.secondary}><Text style={styles.secondaryText}>Tìm bằng AI lần nữa</Text></Pressable>
        <Pressable onPress={() => router.push('/tutors')} style={styles.secondary}><Text style={styles.secondaryText}>Xem tất cả gia sư</Text></Pressable>
      </> : null}
    </ScrollView>
  </KeyboardAvoidingView></AppShell>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function OptionalField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ gap: 5 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} multiline value={value} onChangeText={onChange} placeholder="Có thể để trống" style={styles.smallInput} /></View>; }
function budgetText(budget?: AiRequirement['budget']) { if (!budget) return 'Chưa nêu'; if (budget.min && budget.max && budget.min !== budget.max) return `${money(budget.min)} - ${money(budget.max)} / buổi`; return `${money(budget.target ?? budget.min ?? budget.max)} / buổi`; }
function fallbackQuestion(field: string) { return ({ SUBJECT: 'Bạn muốn học môn nào?', LEVEL: 'Bạn muốn học ở trình độ nào?', TEACHING_MODE: 'Bạn muốn học online hay trực tiếp?', LOCATION: 'Bạn muốn học trực tiếp ở khu vực nào?' } as Record<string, string>)[field] || 'Bạn muốn bổ sung thông tin nào?'; }
function friendlyError(cause: unknown, stage: string) {
  const status = cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) : -1;
  if (status === 0) return 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.';
  if (status === 401) return 'Vui lòng đăng nhập bằng tài khoản học viên.';
  if (status === 403) return 'Tính năng này chỉ dành cho học viên.';
  if (status === 429) return 'AI đã đạt giới hạn sử dụng tạm thời. Vui lòng thử lại sau.';
  if (status === 503) return 'Dịch vụ AI đang tạm thời bận. Vui lòng thử lại sau.';
  if (status === 400) return 'Nội dung chưa hợp lệ. Vui lòng kiểm tra mô tả hoặc thông tin đã chọn.';
  if (status >= 500) return stage === 'analyze' ? 'Chưa thể phân tích nhu cầu lúc này. Mô tả của bạn vẫn được giữ để thử lại.' : 'Chưa thể hoàn tất bước này. Vui lòng thử lại sau.';
  return cause instanceof Error ? cause.message : 'Yêu cầu chưa thực hiện được. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  content: { maxWidth: 620, width: '100%', alignSelf: 'center', padding: 18, paddingBottom: 45, flexGrow: 1 },
  back: { flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 20 }, backText: { color: base.muted, fontSize: 13, fontWeight: '700' },
  titleRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }, title: { color: base.ink, fontSize: 25, fontWeight: '800', flex: 1 },
  intro: { color: base.muted, fontSize: 14, lineHeight: 22, marginBottom: 16 }, label: { color: base.ink, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 8, minHeight: 190, padding: 14, color: base.ink, fontSize: 15, lineHeight: 23 },
  counter: { color: base.muted, fontSize: 11, textAlign: 'right', marginTop: 6 }, hints: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, hint: { backgroundColor: '#e8f1fb', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8 }, hintText: { color: '#2463ae', fontSize: 12, fontWeight: '700' },
  primary: { marginTop: 20, minHeight: 50, borderRadius: 8, backgroundColor: '#2463ae', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, disabled: { opacity: .5 },
  secondary: { minHeight: 46, borderWidth: 1, borderColor: base.line, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingHorizontal: 12 }, secondaryText: { color: '#2463ae', fontWeight: '800' },
  busy: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 15 }, error: { color: base.danger, fontSize: 13, lineHeight: 20, marginTop: 12 }, warning: { color: '#976917', fontSize: 13, marginTop: 12 }, link: { color: '#2463ae', fontWeight: '800', fontSize: 13 },
  review: { gap: 0, borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 4 },
  info: { borderBottomWidth: 1, borderColor: base.line, paddingVertical: 11 }, infoLabel: { color: base.muted, fontSize: 11, fontWeight: '700' }, infoValue: { color: base.ink, fontSize: 14, fontWeight: '700', marginTop: 3, lineHeight: 21 },
  clarifications: { marginTop: 20, gap: 12 }, sectionTitle: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 9 }, clarification: { borderTopWidth: 1, borderColor: base.line, paddingTop: 12 },
  freeText: { flexDirection: 'row', gap: 8, marginTop: 10 }, smallInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', color: base.ink, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  smallButton: { minWidth: 52, borderRadius: 8, backgroundColor: '#2463ae', alignItems: 'center', justifyContent: 'center' }, smallButtonText: { color: '#fff', fontWeight: '800' }, optional: { gap: 11, marginTop: 24 },
});
