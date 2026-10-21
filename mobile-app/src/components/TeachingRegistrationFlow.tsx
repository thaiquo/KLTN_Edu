import React, { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Check, ChevronRight, FileText, Plus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { tutorM1, type DocumentType, type TutorDocument, type UploadAsset } from '../api/m1';
import { useAuth } from '../auth/AuthProvider';
import { Button, Choice, Field, FormScreen, Heading, Notice, Panel } from './Ui';
import { FullScreenLoading } from './States';
import { base, themeForRole } from '../theme/tokens';
import { normalizedSearch, registrationSteps, statusLabel, validTeachingDetails, type StepId } from '../utils/teachingRegistration';

type Option = { id: number; code: string; name: string; description?: string };
type Category = Option & { educationLevel?: Option | null };
type Level = Option & { type: string };
type Registration = {
  id: number; status: string; subject?: Option | null; proposedSubjectName?: string | null;
  proposedLevelName?: string | null; proposedLevels?: { name: string }[]; levels?: Level[];
  category?: Category; experienceYears?: number; tuitionMin?: number; tuitionMax?: number;
  description?: string; rejectReason?: string; reviewNote?: string; submittedAt?: string;
  evidence?: { id: number; title: string }[];
};
type Draft = {
  programTypeId: number | null; educationLevelId: number | null; categoryId: number | null;
  subjectId: number | null; levelIds: number[]; proposal: boolean;
  proposedSubjectName: string; proposedLevelNames: string[]; proposedLevelName: string;
  proposedLevelType: string; proposedNote: string;
  years: string; min: string; max: string; description: string; evidenceIds: number[];
};
type StagedEvidence = { key: string; documentType: DocumentType; asset: UploadAsset };
type PickerKind = 'category' | 'subject';

const emptyDraft: Draft = {
  programTypeId: null, educationLevelId: null, categoryId: null, subjectId: null,
  levelIds: [], proposal: false, proposedSubjectName: '', proposedLevelNames: [],
  proposedLevelName: '', proposedLevelType: 'SKILL_LEVEL', proposedNote: '',
  years: '', min: '', max: '', description: '', evidenceIds: [],
};
const evidenceTypes: DocumentType[] = ['DEGREE', 'CERTIFICATE', 'WORK_EXPERIENCE', 'PORTFOLIO', 'OTHER'];
const evidenceLabels: Record<string, string> = {
  DEGREE: 'Bằng cấp', CERTIFICATE: 'Chứng chỉ', WORK_EXPERIENCE: 'Kinh nghiệm',
  PORTFOLIO: 'Portfolio', OTHER: 'Minh chứng khác',
};
const stepTitles: Record<StepId, string> = {
  program: 'Loại chương trình', education: 'Cấp học', category: 'Nhóm môn', subject: 'Môn học',
  level: 'Lớp / trình độ', proposal: 'Đề xuất môn mới', details: 'Thông tin giảng dạy',
  evidence: 'Minh chứng chuyên môn', review: 'Xem lại hồ sơ',
};
const gradeRanges: Record<string, number[]> = {
  PRIMARY: [1, 2, 3, 4, 5], SECONDARY: [6, 7, 8, 9], HIGH_SCHOOL: [10, 11, 12],
};
const money = (value?: number | string) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
function registrationLevelNames(item: Registration) {
  const names = item.subject ? item.levels?.map(level => level.name) : item.proposedLevels?.map(level => level.name);
  return (names?.length ? names : item.proposedLevelName ? [item.proposedLevelName] : []).join(', ');
}

export default function TeachingRegistrationFlow() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [programs, setPrograms] = useState<Option[]>([]);
  const [educationLevels, setEducationLevels] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [documents, setDocuments] = useState<TutorDocument[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [staged, setStaged] = useState<StagedEvidence[]>([]);
  const [step, setStep] = useState<StepId | null>(null);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [query, setQuery] = useState('');
  const [evidenceType, setEvidenceType] = useState<DocumentType>('CERTIFICATE');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const theme = themeForRole('TUTOR');

  const load = useCallback(async () => {
    if (user?.activeRole !== 'TUTOR' || user.tutorStatus !== 'APPROVED') {
      setLoading(false); return;
    }
    setLoading(true);
    try {
      const [types, grades, mine, docs] = await Promise.all([
        api.request<Option[]>('/api/learning/teaching-catalog/program-types'),
        api.request<Option[]>('/api/learning/teaching-catalog/education-levels'),
        api.request<Registration[]>('/api/learning/tutor/subject-registrations'),
        tutorM1.documents(),
      ]);
      setPrograms(types); setEducationLevels(grades); setRegistrations(mine); setDocuments(docs);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ giảng dạy.');
    } finally { setLoading(false); }
  }, [user?.activeRole, user?.tutorStatus]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const program = programs.find(item => item.id === draft.programTypeId);
  const education = educationLevels.find(item => item.id === draft.educationLevelId);
  const category = categories.find(item => item.id === draft.categoryId);
  const subject = subjects.find(item => item.id === draft.subjectId);
  const chosenLevels = levels.filter(item => draft.levelIds.includes(item.id));
  const steps = registrationSteps(program?.code, draft.proposal);
  const stepIndex = step ? steps.indexOf(step) : -1;
  const availableDocuments = documents.filter(item => evidenceTypes.includes(item.documentType));
  const evidenceCount = draft.evidenceIds.length + staged.length;
  const identityReady = documents.some(item => item.documentType === 'PASSPORT') ||
    (documents.some(item => item.documentType === 'IDENTITY_FRONT') && documents.some(item => item.documentType === 'IDENTITY_BACK'));
  const pickerItems = picker === 'category' ? categories : subjects;
  const filteredItems = useMemo(() => pickerItems.filter(item => normalizedSearch(`${item.name} ${item.description || ''}`).includes(normalizedSearch(query))), [pickerItems, query]);

  function patch(values: Partial<Draft>) { setDraft(current => ({ ...current, ...values })); setError(''); }
  function move(next: StepId) { setStep(next); setError(''); setMessage(''); }
  function reset() { setDraft(emptyDraft); setStaged([]); setStep(null); setError(''); }

  async function fetchCategories(programId: number, educationId?: number) {
    setCatalogLoading(true); setError('');
    try {
      const params = `programTypeId=${programId}${educationId ? `&educationLevelId=${educationId}` : ''}`;
      const items = await api.request<Category[]>(`/api/learning/teaching-catalog/categories?${params}`);
      setCategories(items); setSubjects([]); setLevels([]); move('category');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải nhóm môn.'); }
    finally { setCatalogLoading(false); }
  }
  async function chooseProgram(item: Option) {
    setDraft({ ...emptyDraft, programTypeId: item.id });
    setCategories([]); setSubjects([]); setLevels([]);
    if (item.code === 'ACADEMIC') move('education');
    else await fetchCategories(item.id);
  }
  async function chooseEducation(item: Option) {
    if (!draft.programTypeId) return;
    patch({ educationLevelId: item.id, categoryId: null, subjectId: null, levelIds: [] });
    await fetchCategories(draft.programTypeId, item.id);
  }
  async function chooseCategory(item: Category) {
    setPicker(null); setQuery(''); setCatalogLoading(true); setError('');
    patch({ categoryId: item.id, subjectId: null, levelIds: [], proposal: false });
    setSubjects([]); setLevels([]);
    try {
      setSubjects(await api.request<Option[]>(`/api/learning/teaching-catalog/subjects?categoryId=${item.id}`));
      move('subject');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải môn học.'); }
    finally { setCatalogLoading(false); }
  }
  async function chooseSubject(item: Option) {
    setPicker(null); setQuery(''); setCatalogLoading(true); setError('');
    patch({ subjectId: item.id, levelIds: [], proposal: false }); setLevels([]);
    try {
      setLevels(await api.request<Level[]>(`/api/learning/teaching-catalog/levels?subjectId=${item.id}`));
      move('level');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lớp hoặc trình độ.'); }
    finally { setCatalogLoading(false); }
  }
  async function retryCatalog() {
    if (step === 'category' && draft.programTypeId) await fetchCategories(draft.programTypeId, draft.educationLevelId || undefined);
    if (step === 'subject' && category) await chooseCategory(category);
    if (step === 'level' && subject) await chooseSubject(subject);
  }

  function startProposal() {
    const exam = category?.code.includes('EXAM') || false;
    const target = exam && education?.code === 'SECONDARY' ? 'Ôn thi vào lớp 10' : exam && education?.code === 'HIGH_SCHOOL' ? 'Ôn thi THPT Quốc gia' : '';
    const type = program?.code !== 'ACADEMIC' ? 'SKILL_LEVEL' : education?.code === 'UNIVERSITY' ? 'UNIVERSITY_LEVEL' : exam ? 'EXAM_PREPARATION' : 'GRADE';
    patch({ proposal: true, subjectId: null, levelIds: [], proposedSubjectName: '', proposedLevelNames: [], proposedLevelName: target, proposedLevelType: type, proposedNote: '' });
    move('proposal');
  }
  function nextProposal() {
    if (!draft.proposedSubjectName.trim() || draft.proposedSubjectName.trim().length > 160) return setError('Nhập tên môn đề xuất (tối đa 160 ký tự).');
    if (draft.proposedLevelType === 'GRADE' ? !draft.proposedLevelNames.length : !draft.proposedLevelName.trim()) return setError('Chọn hoặc nhập trình độ đề xuất.');
    move('details');
  }

  async function chooseFile() {
    if (evidenceCount >= 5) return setError('Mỗi đăng ký được chọn tối đa 5 minh chứng.');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const extension = asset.name.split('.').pop()?.toLowerCase();
      if (!extension || !['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx'].includes(extension) || (asset.size || 0) > 10 * 1024 * 1024) return setError('Chọn PDF, Word, Excel hoặc ảnh không quá 10 MB.');
      setStaged(current => [...current, { key: `${Date.now()}-${current.length}`, documentType: evidenceType,
        asset: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'application/octet-stream', size: asset.size, file: asset.file } }]);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể chọn file.'); }
  }

  async function submit() {
    const detailError = validTeachingDetails(draft.years, draft.min, draft.max, draft.description);
    if (detailError) { move('details'); setError(detailError); return; }
    if (!identityReady) return setError('Hồ sơ cần CCCD hai mặt hoặc hộ chiếu trước khi đăng ký môn.');
    if (evidenceCount < 1 || evidenceCount > 5) return setError('Chọn từ 1 đến 5 minh chứng chuyên môn.');
    setBusy(true); setError('');
    const selectedDocs = availableDocuments.filter(item => draft.evidenceIds.includes(item.id));
    let submitStage: 'upload' | 'registration' = 'upload';
    try {
      if (__DEV__) console.info('[Teaching registration] submit', {
        activeRole: user?.activeRole, accessTokenPresent: !!api.getToken(), stagedFiles: staged.map(item => ({
          documentType: item.documentType, mimeType: item.asset.mimeType, size: item.asset.size,
        })), subjectId: draft.subjectId, levelIds: draft.levelIds, categoryId: draft.categoryId,
      });
      for (const item of staged) {
        const uploaded = await tutorM1.uploadDocument(item.documentType, item.asset);
        selectedDocs.push(uploaded);
        setDocuments(current => [...current, uploaded]);
        setDraft(current => ({ ...current, evidenceIds: [...current.evidenceIds, uploaded.id] }));
        setStaged(current => current.filter(entry => entry.key !== item.key));
      }
      const proposedLevels = draft.proposal ? (draft.proposedLevelType === 'GRADE'
        ? draft.proposedLevelNames.map(name => ({ code: `GRADE_${name.replace(/\D/g, '')}`, name, type: 'GRADE' }))
        : [{ code: category?.code.includes('EXAM') && education?.code === 'SECONDARY' ? 'GRADE_10_ENTRANCE_EXAM' : category?.code.includes('EXAM') && education?.code === 'HIGH_SCHOOL' ? 'NATIONAL_EXAM' : null,
          name: draft.proposedLevelName.trim(), type: draft.proposedLevelType }]) : null;
      submitStage = 'registration';
      await api.request('/api/learning/tutor/subject-registrations/batch', {
        method: 'POST', body: JSON.stringify({
          subjectId: draft.proposal ? null : draft.subjectId, levelIds: draft.proposal ? null : draft.levelIds,
          categoryId: draft.proposal ? draft.categoryId : null,
          proposedSubjectName: draft.proposal ? draft.proposedSubjectName.trim() : null,
          proposedLevelName: draft.proposal ? proposedLevels?.map(item => item.name).join(', ') : null,
          proposedLevelType: draft.proposal ? draft.proposedLevelType : null,
          proposedNote: draft.proposal ? draft.proposedNote.trim() : null, proposedLevels,
          experienceYears: Number(draft.years), tuitionMin: Number(draft.min), tuitionMax: Number(draft.max),
          description: draft.description.trim(),
          evidence: selectedDocs.map(item => ({ evidenceType: item.documentType, title: (item.title || item.originalFilename || 'Minh chứng chuyên môn').slice(0, 160), accountDocumentId: item.id })),
        }),
      });
      reset(); setMessage('Đăng ký môn dạy đã được gửi xét duyệt.'); await load();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Không thể gửi đăng ký dạy.';
      setError(`${submitStage === 'upload' ? 'Tải minh chứng' : 'Gửi đăng ký'}: ${detail}`);
    }
    finally { setBusy(false); }
  }

  if (!user || loading) return <FullScreenLoading />;
  if (user.activeRole !== 'TUTOR') return <FormScreen role="STUDENT"><Heading title="Chỉ dành cho Gia sư" role="STUDENT" /><Button label="Về hồ sơ" onPress={() => router.replace('/(app)/profile')} role="STUDENT" /></FormScreen>;
  if (user.tutorStatus !== 'APPROVED') return <FormScreen role="TUTOR"><Heading title="Chưa mở đăng ký môn" detail="Hồ sơ Gia sư cần được duyệt trước khi đăng ký chuyên môn." role="TUTOR" /><Button label="Xem hồ sơ gia sư" onPress={() => router.replace('/(app)/tutor-onboarding')} role="TUTOR" /></FormScreen>;

  const active = step !== null;
  const title = step ? stepTitles[step] : 'Môn giảng dạy';
  const proposalNames = draft.proposedLevelType === 'GRADE' ? draft.proposedLevelNames : [draft.proposedLevelName].filter(Boolean);
  return <FormScreen role="TUTOR">
    <Pressable onPress={() => active ? reset() : router.replace('/(app)/management')} style={styles.back}><ArrowLeft size={18} color={theme.primary} /><Text style={styles.backText}>{active ? 'Danh sách hồ sơ' : 'Môn học'}</Text></Pressable>
    <Heading eyebrow="CHUYÊN MÔN GIA SƯ" title={title} detail={active ? `Bước ${stepIndex + 1}/${steps.length} · ${program?.name || 'Chọn chương trình'}` : 'Quản lý quyền dạy và hồ sơ đăng ký của bạn.'} role="TUTOR" />
    {active && <View style={styles.progress}><View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} /></View>}
    <Notice message={error} /><Notice message={message} success />
    {!active && <>
      <Button label="Thêm đăng ký môn" onPress={() => move('program')} role="TUTOR" />
      <Text style={styles.sectionTitle}>Hồ sơ đã nộp</Text>
      {registrations.length ? registrations.map(item => <Pressable key={item.id} onPress={() => setSelectedRegistration(item)} style={styles.registrationCard}>
        <View style={styles.row}><Text style={styles.cardTitle} numberOfLines={2}>{item.subject?.name || item.proposedSubjectName || 'Môn đề xuất'}</Text><StatusBadge status={item.status} /></View>
        <Text style={styles.secondary} numberOfLines={2}>{registrationLevelNames(item)}</Text>
        <Text style={styles.meta}>{item.experienceYears ?? 0} năm kinh nghiệm · {money(item.tuitionMin)} – {money(item.tuitionMax)}đ/buổi</Text>
        {item.rejectReason ? <Text style={styles.reject} numberOfLines={2}>Lý do: {item.rejectReason}</Text> : null}
      </Pressable>) : <Panel><Text style={styles.secondary}>Bạn chưa gửi đăng ký môn dạy nào.</Text></Panel>}
    </>}
    {step === 'program' && <Panel>{programs.map(item => <Choice key={item.id} label={item.name} detail={item.description} selected={draft.programTypeId === item.id} onPress={() => void chooseProgram(item)} role="TUTOR" />)}{!programs.length && <Text style={styles.secondary}>Chưa tải được chương trình. Hãy thử lại.</Text>}<Button label="Tải lại" onPress={() => void load()} role="TUTOR" secondary /></Panel>}
    {step === 'education' && <Panel>{educationLevels.map(item => <Choice key={item.id} label={item.name} detail={item.description} selected={draft.educationLevelId === item.id} onPress={() => void chooseEducation(item)} role="TUTOR" />)}</Panel>}
    {step === 'category' && <Panel><Text style={styles.secondary}>Chọn nhóm môn thuộc {education?.name || program?.name}.</Text><PickerField label="Nhóm môn" value={category?.name} onPress={() => { setQuery(''); setPicker('category'); }} />{!categories.length && <Text style={styles.secondary}>Chưa có nhóm môn phù hợp.</Text>}{catalogLoading && <ActivityIndicator color={theme.primary} />}{error ? <Button label="Thử tải lại" onPress={() => void retryCatalog()} role="TUTOR" secondary /> : null}</Panel>}
    {step === 'subject' && <Panel><Text style={styles.secondary}>{category?.name}</Text><PickerField label="Môn học" value={subject?.name} onPress={() => { setQuery(''); setPicker('subject'); }} /><Pressable onPress={startProposal} style={styles.proposalLink}><Plus size={18} color={theme.primary} /><Text style={styles.proposalText}>Không thấy môn? Đề xuất môn mới</Text><ChevronRight size={17} color={theme.primary} /></Pressable>{catalogLoading && <ActivityIndicator color={theme.primary} />}{error ? <Button label="Thử tải lại" onPress={() => void retryCatalog()} role="TUTOR" secondary /> : null}</Panel>}
    {step === 'level' && <Panel><Text style={styles.secondary}>{subject?.name} · Chọn một hoặc nhiều lớp/trình độ.</Text>{levels.map(item => <Choice key={item.id} label={item.name} detail={item.description} selected={draft.levelIds.includes(item.id)} onPress={() => patch({ levelIds: draft.levelIds.includes(item.id) ? draft.levelIds.filter(id => id !== item.id) : [...draft.levelIds, item.id] })} role="TUTOR" />)}{!levels.length && <Text style={styles.secondary}>Môn này chưa có lớp/trình độ phù hợp.</Text>}{error ? <Button label="Thử tải lại" onPress={() => void retryCatalog()} role="TUTOR" secondary /> : null}<Button label={`Tiếp tục với ${draft.levelIds.length} lựa chọn`} disabled={!draft.levelIds.length} onPress={() => move('details')} role="TUTOR" /></Panel>}
    {step === 'proposal' && <Panel><Text style={styles.secondary}>Admin sẽ xét duyệt môn và trình độ mới trong nhóm {category?.name}.</Text><Field label="Tên môn đề xuất" value={draft.proposedSubjectName} onChangeText={value => patch({ proposedSubjectName: value })} maxLength={160} placeholder="Tên môn muốn giảng dạy" />
      {draft.proposedLevelType === 'GRADE' ? <><Text style={styles.fieldLabel}>Chọn các lớp thuộc {education?.name}</Text>{(gradeRanges[education?.code || ''] || []).map(grade => { const name = `Lớp ${grade}`; return <Choice key={grade} label={name} selected={draft.proposedLevelNames.includes(name)} onPress={() => patch({ proposedLevelNames: draft.proposedLevelNames.includes(name) ? draft.proposedLevelNames.filter(value => value !== name) : [...draft.proposedLevelNames, name] })} role="TUTOR" />; })}</> : <>
        {!category?.code.includes('EXAM') && <><Text style={styles.fieldLabel}>Loại trình độ / mục tiêu</Text>{(program?.code !== 'ACADEMIC' ? ['SKILL_LEVEL', 'CERTIFICATE_TARGET', 'COACHING_LEVEL'] : ['UNIVERSITY_LEVEL', 'EXAM_PREPARATION', 'COACHING_LEVEL']).map(type => <Choice key={type} label={typeLabel(type)} selected={draft.proposedLevelType === type} onPress={() => patch({ proposedLevelType: type, proposedLevelName: '' })} role="TUTOR" />)}</>}
        <Field label="Trình độ / mục tiêu đề xuất" value={draft.proposedLevelName} onChangeText={value => patch({ proposedLevelName: value })} maxLength={160} placeholder="Ví dụ: Cơ bản, IELTS 6.5..." />
      </>}
      <Field label="Ghi chú cho Admin" value={draft.proposedNote} onChangeText={value => patch({ proposedNote: value })} multiline maxLength={1000} placeholder="Nội dung môn hoặc lý do cần bổ sung" /><Button label="Tiếp tục" onPress={nextProposal} role="TUTOR" /></Panel>}
    {step === 'details' && <Panel><Text style={styles.secondary}>{draft.proposal ? draft.proposedSubjectName : subject?.name} · {(draft.proposal ? proposalNames : chosenLevels.map(level => level.name)).join(', ')}</Text>
      <Field label="Số năm kinh nghiệm" value={draft.years} onChangeText={value => patch({ years: value })} keyboardType="number-pad" placeholder="Số năm thực tế" />
      <Field label="Học phí tối thiểu (đ/buổi)" value={draft.min} onChangeText={value => patch({ min: value.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Ví dụ: 150000" />
      <Field label="Học phí tối đa (đ/buổi)" value={draft.max} onChangeText={value => patch({ max: value.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Ví dụ: 300000" />
      {(draft.min || draft.max) && <Text style={styles.secondary}>{money(draft.min)} – {money(draft.max)}đ/buổi</Text>}
      <Field label="Mô tả năng lực giảng dạy" value={draft.description} onChangeText={value => patch({ description: value })} multiline maxLength={1500} placeholder="Kinh nghiệm, phương pháp và đối tượng học viên phù hợp" />
      <Text style={styles.meta}>{draft.description.length}/1500</Text>
      <Button label="Tiếp tục" onPress={() => { const issue = validTeachingDetails(draft.years, draft.min, draft.max, draft.description); if (issue) setError(issue); else move('evidence'); }} role="TUTOR" />
    </Panel>}
    {step === 'evidence' && <Panel><Text style={styles.secondary}>Chọn 1–5 minh chứng. CCCD/hộ chiếu đã lưu trong hồ sơ gia sư dùng chung.</Text>
      {!identityReady && <Notice message="Hồ sơ cần CCCD hai mặt hoặc hộ chiếu trước khi gửi đăng ký." />}
      <Text style={styles.fieldLabel}>Tài liệu đã lưu ({draft.evidenceIds.length})</Text>
      {availableDocuments.map(item => <Choice key={item.id} label={item.title || item.originalFilename || evidenceLabels[item.documentType]} detail={evidenceLabels[item.documentType]} selected={draft.evidenceIds.includes(item.id)} onPress={() => {
        if (!draft.evidenceIds.includes(item.id) && evidenceCount >= 5) return setError('Mỗi đăng ký được chọn tối đa 5 minh chứng.');
        patch({ evidenceIds: draft.evidenceIds.includes(item.id) ? draft.evidenceIds.filter(id => id !== item.id) : [...draft.evidenceIds, item.id] });
      }} role="TUTOR" />)}
      <Text style={styles.fieldLabel}>Thêm file mới</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeStrip}>{evidenceTypes.map(type => <Pressable key={type} onPress={() => setEvidenceType(type)} style={[styles.typeChip, evidenceType === type && styles.typeChipSelected]}><Text style={[styles.typeText, evidenceType === type && styles.typeTextSelected]}>{evidenceLabels[type]}</Text></Pressable>)}</ScrollView>
      <Button label="Chọn file" onPress={() => void chooseFile()} disabled={evidenceCount >= 5} role="TUTOR" secondary />
      {staged.map(item => <View key={item.key} style={styles.fileRow}><FileText size={18} color={theme.primary} /><View style={{ flex: 1 }}><Text style={styles.fileName} numberOfLines={2}>{item.asset.name}</Text><Text style={styles.meta}>{evidenceLabels[item.documentType]} · Sẽ tải lên khi gửi</Text></View><Pressable accessibilityLabel={`Bỏ ${item.asset.name}`} onPress={() => setStaged(current => current.filter(file => file.key !== item.key))}><X size={20} color={base.danger} /></Pressable></View>)}
      <Text style={styles.meta}>Đã chọn {evidenceCount}/5 minh chứng</Text><Button label="Xem lại hồ sơ" disabled={!identityReady || evidenceCount < 1} onPress={() => move('review')} role="TUTOR" />
    </Panel>}
    {step === 'review' && <Panel><ReviewLine label="Chương trình" value={program?.name} /><ReviewLine label="Cấp học" value={education?.name} /><ReviewLine label="Nhóm môn" value={category?.name} /><ReviewLine label="Môn" value={`${draft.proposal ? draft.proposedSubjectName : subject?.name}${draft.proposal ? ' (đề xuất)' : ''}`} /><ReviewLine label="Lớp / trình độ" value={(draft.proposal ? proposalNames : chosenLevels.map(level => level.name)).join(', ')} /><ReviewLine label="Kinh nghiệm" value={`${draft.years} năm`} /><ReviewLine label="Học phí" value={`${money(draft.min)} – ${money(draft.max)}đ/buổi`} /><ReviewLine label="Mô tả" value={draft.description.trim()} /><ReviewLine label="Minh chứng" value={[...availableDocuments.filter(item => draft.evidenceIds.includes(item.id)).map(item => item.title || item.originalFilename || evidenceLabels[item.documentType]), ...staged.map(item => item.asset.name)].join(', ')} />
      <Button label="Sửa thông tin" onPress={() => move('details')} role="TUTOR" secondary /><Button label="Sửa minh chứng" onPress={() => move('evidence')} role="TUTOR" secondary /><Button label="Gửi đăng ký xét duyệt" onPress={() => void submit()} busy={busy} role="TUTOR" />
    </Panel>}
    {active && step !== 'program' && <Pressable onPress={() => move(steps[Math.max(0, stepIndex - 1)])} style={styles.back}><ArrowLeft size={17} color={theme.primary} /><Text style={styles.backText}>Bước trước</Text></Pressable>}
    {selectedRegistration && <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedRegistration(null)}><View style={styles.overlay}><View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}><View style={styles.row}><Text style={styles.modalTitle}>Chi tiết hồ sơ</Text><Pressable accessibilityLabel="Đóng" onPress={() => setSelectedRegistration(null)}><X size={22} color={base.ink} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.cardTitle}>{selectedRegistration.subject?.name || selectedRegistration.proposedSubjectName}</Text><StatusBadge status={selectedRegistration.status} /><ReviewLine label="Lớp / trình độ" value={registrationLevelNames(selectedRegistration)} /><ReviewLine label="Nhóm môn" value={selectedRegistration.category?.name} /><ReviewLine label="Kinh nghiệm" value={`${selectedRegistration.experienceYears ?? 0} năm`} /><ReviewLine label="Học phí" value={`${money(selectedRegistration.tuitionMin)} – ${money(selectedRegistration.tuitionMax)}đ/buổi`} /><ReviewLine label="Mô tả" value={selectedRegistration.description} /><ReviewLine label="Minh chứng" value={selectedRegistration.evidence?.map(item => item.title).join(', ')} />{selectedRegistration.rejectReason && <Notice message={`Lý do từ chối: ${selectedRegistration.rejectReason}`} />}{selectedRegistration.reviewNote && <Text style={styles.secondary}>Ghi chú: {selectedRegistration.reviewNote}</Text>}</ScrollView></View></View></Modal>}
    {picker && <Modal visible transparent animationType="slide" onRequestClose={() => setPicker(null)}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}><View style={styles.row}><Text style={styles.modalTitle}>Chọn {picker === 'category' ? 'nhóm môn' : 'môn học'}</Text><Pressable accessibilityLabel="Đóng" onPress={() => setPicker(null)}><X size={22} color={base.ink} /></Pressable></View><Field label="Tìm kiếm" value={query} onChangeText={setQuery} placeholder="Nhập tên để tìm" autoFocus /><View style={styles.list}><FlatList data={filteredItems} keyExtractor={item => String(item.id)} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable onPress={() => void (picker === 'category' ? chooseCategory(item as Category) : chooseSubject(item))} style={styles.pickerRow}><Text style={styles.fileName}>{item.name}</Text>{(picker === 'category' ? draft.categoryId : draft.subjectId) === item.id ? <Check size={18} color={theme.primary} /> : <ChevronRight size={18} color={base.muted} />}</Pressable>} ListEmptyComponent={<View style={styles.empty}><Search size={24} color={base.muted} /><Text style={styles.secondary}>{catalogLoading ? 'Đang tải danh mục...' : query ? 'Không tìm thấy mục phù hợp.' : 'Chưa có dữ liệu phù hợp.'}</Text>{!catalogLoading && <Button label="Thử tải lại" onPress={() => void retryCatalog()} role="TUTOR" secondary />}</View>} /></View></View></KeyboardAvoidingView></Modal>}
  </FormScreen>;
}

function PickerField({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.pickerField}><View style={{ flex: 1 }}><Text style={styles.meta}>{label}</Text><Text style={styles.fileName}>{value || `Chọn ${label.toLowerCase()}`}</Text></View><ChevronRight size={20} color={base.muted} /></Pressable>;
}
function ReviewLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <View style={styles.reviewLine}><Text style={styles.meta}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>;
}
function StatusBadge({ status }: { status: string }) {
  const color = status === 'APPROVED' ? base.success : status === 'REJECTED' ? base.danger : '#99651c';
  const background = status === 'APPROVED' ? '#e8f5ef' : status === 'REJECTED' ? '#fff0f2' : '#fff6e6';
  return <View style={[styles.badge, { backgroundColor: background }]}><Text style={{ color, fontSize: 11, fontWeight: '800' }}>{statusLabel(status)}</Text></View>;
}
function typeLabel(type: string) { return ({ SKILL_LEVEL: 'Trình độ kỹ năng', CERTIFICATE_TARGET: 'Mục tiêu chứng chỉ', COACHING_LEVEL: 'Định hướng / coaching', UNIVERSITY_LEVEL: 'Trình độ đại học', EXAM_PREPARATION: 'Ôn thi' } as Record<string, string>)[type] || type; }

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 42, marginBottom: 10 },
  backText: { color: '#a92f69', fontWeight: '700', fontSize: 13 },
  progress: { height: 5, borderRadius: 3, backgroundColor: '#f6dce8', overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: 5, backgroundColor: '#a92f69' },
  sectionTitle: { color: base.ink, fontSize: 17, fontWeight: '800', marginTop: 26, marginBottom: 12 },
  registrationCard: { borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', padding: 16, marginBottom: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cardTitle: { color: base.ink, fontWeight: '800', fontSize: 16, flexShrink: 1 },
  secondary: { color: base.muted, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  meta: { color: base.muted, fontSize: 12, lineHeight: 17 },
  reject: { color: base.danger, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-start' },
  pickerField: { minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: base.line, padding: 12, flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: '#fff' },
  proposalLink: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 18, marginTop: 12, borderTopWidth: 1, borderTopColor: base.line },
  proposalText: { flex: 1, color: '#a92f69', fontWeight: '700', fontSize: 14 },
  fieldLabel: { color: base.ink, fontWeight: '800', fontSize: 14, marginTop: 12, marginBottom: 10 },
  typeStrip: { flexGrow: 0, marginBottom: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: base.line, marginRight: 8 },
  typeChipSelected: { borderColor: '#a92f69', backgroundColor: '#fce9f1' },
  typeText: { color: base.ink, fontWeight: '700', fontSize: 12 },
  typeTextSelected: { color: '#a92f69' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: base.line, paddingVertical: 13 },
  fileName: { color: base.ink, fontWeight: '700', fontSize: 14 },
  reviewLine: { borderBottomWidth: 1, borderBottomColor: base.line, paddingVertical: 11, gap: 4 },
  reviewValue: { color: base.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  overlay: { flex: 1, backgroundColor: 'rgba(23,38,51,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, paddingBottom: 30, maxHeight: '78%' },
  modalTitle: { color: base.ink, fontSize: 18, fontWeight: '800' },
  list: { flexShrink: 1, minHeight: 160, maxHeight: 420 },
  pickerRow: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: base.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
});
