import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, ChevronLeft, FileText, GraduationCap, Upload } from 'lucide-react-native';
import { ApiError } from '../../src/api/client';
import { tutorM1, type DocumentType, type TeachingMode, type TutorApplication, type TutorDocument, type UploadAsset } from '../../src/api/m1';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Choice, Field, FormScreen, Heading, Notice, Panel } from '../../src/components/Ui';
import { FullScreenLoading } from '../../src/components/States';
import { base, themeForRole } from '../../src/theme/tokens';

type Draft = { bio: string; educationLevel: string; institution: string; major: string; experienceSummary: string; teachingModes: TeachingMode[] };
const empty: Draft = { bio: '', educationLevel: '', institution: '', major: '', experienceSummary: '', teachingModes: [] };
const steps = ['Giới thiệu', 'Hình thức dạy', 'Giấy tờ', 'Xem lại'];

export default function TutorOnboarding() {
  const { user, refreshUser } = useAuth();
  const [application, setApplication] = useState<TutorApplication | null>(null);
  const [documents, setDocuments] = useState<TutorDocument[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [step, setStep] = useState(0); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const theme = themeForRole('TUTOR');
  const pureStudent = user?.activeRole === 'STUDENT' && !user.hasTutorProfile && !user.roles.includes('TUTOR');
  const load = useCallback(async () => {
    if (!user || pureStudent) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await tutorM1.application().catch(cause => { if (cause instanceof ApiError && cause.status === 404) return null; throw cause; });
      setApplication(result);
      if (result) {
        setDraft({ bio: result.bio || '', educationLevel: result.educationLevel || '', institution: result.institution || '', major: result.major || '', experienceSummary: result.experienceSummary || '', teachingModes: result.teachingModes || [] });
        setDocuments(await tutorM1.documents());
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ gia sư.'); }
    finally { setLoading(false); }
  }, [user?.id, pureStudent]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user || loading) return <FullScreenLoading />;
  if (pureStudent) return <FormScreen role="STUDENT"><Heading title="Chỉ dành cho Gia sư" detail="Tính năng này chưa mở cho tài khoản Học viên trên ứng dụng." role="STUDENT" /><Button label="Về hồ sơ" onPress={() => router.replace('/(app)/profile')} role="STUDENT" /></FormScreen>;
  const status = application?.status;
  const editable = !status || status === 'DRAFT' || status === 'REJECTED';
  async function create() {
    setBusy(true); setError('');
    try { const result = await tutorM1.create(); setApplication(result); setDraft(empty); await refreshUser(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo hồ sơ.'); }
    finally { setBusy(false); }
  }
  async function saveAndNext() {
    if (!application) return;
    if (step === 1 && draft.teachingModes.length === 0) return setError('Chọn ít nhất một hình thức nhận dạy.');
    setBusy(true); setError('');
    try { const saved = await tutorM1.update(draft); setApplication(saved); setStep(current => Math.min(current + 1, steps.length - 1)); setMessage('Đã lưu bản nháp.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.'); }
    finally { setBusy(false); }
  }
  async function chooseFile(documentType: DocumentType) {
    let asset: UploadAsset | null = null;
    if (['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(documentType)) {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return setError('Cần quyền truy cập ảnh để chọn giấy tờ.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9 });
      const file = result.assets?.[0]; if (result.canceled || !file) return;
      asset = { uri: file.uri, name: file.fileName || `${documentType.toLowerCase()}.jpg`, mimeType: file.mimeType || 'image/jpeg', size: file.fileSize, file: file.file };
      if (!['image/jpeg', 'image/png'].includes(asset.mimeType) || (asset.size || 0) > 5 * 1024 * 1024) return setError('Ảnh định danh cần là JPG/PNG và không quá 5 MB.');
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true });
      const file = result.assets?.[0]; if (result.canceled || !file) return;
      asset = { uri: file.uri, name: file.name, mimeType: file.mimeType || 'application/octet-stream', size: file.size, file: file.file };
      if ((asset.size || 0) > 10 * 1024 * 1024) return setError('Tài liệu không được quá 10 MB.');
    }
    setBusy(true); setError('');
    try {
      await tutorM1.uploadDocument(documentType, asset);
      setDocuments(await tutorM1.documents()); setMessage('Đã tải tài liệu lên.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải tài liệu lên.'); }
    finally { setBusy(false); }
  }
  async function removeDocument(id: number) {
    setBusy(true); setError('');
    try { await tutorM1.deleteDocument(id); setDocuments(await tutorM1.documents()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa tài liệu.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!application) return;
    const hasPassport = documents.some(d => d.documentType === 'PASSPORT');
    const hasCard = documents.some(d => d.documentType === 'IDENTITY_FRONT') && documents.some(d => d.documentType === 'IDENTITY_BACK');
    if (!hasPassport && !hasCard) return setError('Cần hai mặt CCCD/CMND hoặc hộ chiếu.');
    if (!draft.teachingModes.length) return setError('Cần ít nhất một hình thức nhận dạy.');
    setBusy(true); setError('');
    try { await tutorM1.update(draft); const result = await tutorM1.submit(); setApplication(result); await refreshUser(); setMessage('Hồ sơ đã được gửi xét duyệt.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.'); }
    finally { setBusy(false); }
  }
  const set = (key: keyof Draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  return <FormScreen role="TUTOR"><Pressable accessibilityRole="button" onPress={() => router.replace('/(app)/management')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, marginBottom: 7 }}><ChevronLeft size={18} color={theme.primary} /><Text style={{ color: theme.primary, fontWeight: '700' }}>Môn học</Text></Pressable><Heading eyebrow="HỒ SƠ GIA SƯ" title={status === 'APPROVED' ? 'Hồ sơ đã duyệt' : status === 'PENDING' ? 'Đang xét duyệt' : status === 'REJECTED' ? 'Cập nhật hồ sơ' : 'Trở thành gia sư'} detail={status === 'APPROVED' ? 'Bạn có thể chuyển vai trò và đăng ký chuyên môn giảng dạy.' : 'Thông tin và giấy tờ của bạn được dùng để xét duyệt tài khoản Gia sư.'} role="TUTOR" />
    <Notice message={error} /><Notice message={message} success />
    {!application ? <Panel><GraduationCap color={theme.primary} size={28} /><Text style={{ color: base.ink, fontSize: 17, fontWeight: '800', marginVertical: 12 }}>Bắt đầu hồ sơ gia sư</Text><Text style={{ color: base.muted, lineHeight: 21, marginBottom: 14 }}>Tạo bản nháp, thêm hình thức nhận dạy và giấy tờ định danh trước khi gửi Staff xét duyệt.</Text><Button label="Tạo hồ sơ" onPress={() => void create()} busy={busy} role="TUTOR" /></Panel> : null}
    {status === 'PENDING' ? <Panel><CheckCircle2 color={theme.primary} size={28} /><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginTop: 10 }}>Đã gửi hồ sơ</Text><Text style={{ color: base.muted, lineHeight: 21, marginTop: 8 }}>Hồ sơ đang chờ Staff xét duyệt. Bạn vẫn có thể sử dụng vai trò Học viên.</Text>{application?.submittedAt ? <Text style={{ color: base.muted, marginTop: 8 }}>Gửi lúc: {new Date(application.submittedAt).toLocaleString('vi-VN')}</Text> : null}<Button label="Kiểm tra trạng thái" onPress={() => void load()} busy={busy} role="TUTOR" secondary /></Panel> : null}
    {status === 'APPROVED' ? <Panel><CheckCircle2 color={base.success} size={28} /><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginTop: 10 }}>Đã được phê duyệt</Text><Text style={{ color: base.muted, lineHeight: 21, marginTop: 8 }}>Hồ sơ danh tính đã được xác nhận. Đăng ký môn và cấp độ là bước chuyên môn riêng.</Text><Button label="Đăng ký môn giảng dạy" onPress={() => router.push('/(app)/teaching-registrations')} role="TUTOR" /><Button label="Về Môn học" onPress={() => router.replace('/(app)/management')} role="TUTOR" secondary /></Panel> : null}
    {editable && application ? <>
      {status === 'REJECTED' ? <Notice message={application.rejectionReason || 'Hồ sơ cần chỉnh sửa trước khi gửi lại.'} /> : null}
      <View style={{ flexDirection: 'row', gap: 5, marginBottom: 18 }}>{steps.map((name, index) => <Pressable key={name} onPress={() => setStep(index)} accessibilityLabel={`Bước ${index + 1}: ${name}`} style={{ flex: 1, borderBottomWidth: 3, borderColor: index === step ? theme.primary : base.line, paddingBottom: 8 }}><Text numberOfLines={1} style={{ fontSize: 11, color: index === step ? theme.primary : base.muted, textAlign: 'center', fontWeight: '700' }}>{name}</Text></Pressable>)}</View>
      {step === 0 ? <Panel><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginBottom: 14 }}>Giới thiệu & chuyên môn</Text>
        <Field label="Giới thiệu bản thân" value={draft.bio} onChangeText={v => set('bio', v)} multiline maxLength={3000} placeholder="Kinh nghiệm và phong cách giảng dạy..." />
        <Field label="Trình độ học vấn" value={draft.educationLevel} onChangeText={v => set('educationLevel', v)} maxLength={120} />
        <Field label="Trường / cơ sở đào tạo" value={draft.institution} onChangeText={v => set('institution', v)} maxLength={255} />
        <Field label="Chuyên ngành" value={draft.major} onChangeText={v => set('major', v)} maxLength={160} />
        <Field label="Tóm tắt kinh nghiệm" value={draft.experienceSummary} onChangeText={v => set('experienceSummary', v)} multiline maxLength={1000} />
        <Button label="Lưu & tiếp tục" onPress={() => void saveAndNext()} busy={busy} role="TUTOR" /></Panel> : null}
      {step === 1 ? <Panel><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginBottom: 14 }}>Hình thức nhận dạy</Text>
        {([['ONLINE', 'Trực tuyến'], ['OFFLINE', 'Trực tiếp']] as const).map(([value, label]) => <Choice key={value} label={label} selected={draft.teachingModes.includes(value)} onPress={() => setDraft(current => ({ ...current, teachingModes: current.teachingModes.includes(value) ? current.teachingModes.filter(m => m !== value) : [...current.teachingModes, value] }))} role="TUTOR" />)}
        <Button label="Lưu & tiếp tục" onPress={() => void saveAndNext()} busy={busy} role="TUTOR" /></Panel> : null}
      {step === 2 ? <Panel><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginBottom: 8 }}>Giấy tờ xác minh</Text><Text style={{ color: base.muted, lineHeight: 20, marginBottom: 14 }}>Tải cả hai mặt CCCD/CMND hoặc hộ chiếu. Ảnh JPG/PNG tối đa 5 MB.</Text>
        {([['IDENTITY_FRONT', 'Mặt trước CCCD/CMND'], ['IDENTITY_BACK', 'Mặt sau CCCD/CMND'], ['PASSPORT', 'Hộ chiếu'], ['DEGREE', 'Bằng cấp'], ['CERTIFICATE', 'Chứng chỉ']] as const).map(([type, label]) => {
          const doc = documents.find(d => d.documentType === type);
          return <View key={type} style={{ borderBottomWidth: 1, borderColor: base.line, paddingVertical: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FileText color={doc ? base.success : base.muted} size={18} /><Text style={{ flex: 1, color: base.ink, fontWeight: '700' }}>{label}</Text><Text style={{ color: doc ? base.success : base.muted, fontSize: 12 }}>{doc ? 'Đã tải' : 'Chưa có'}</Text></View>{doc ? <Text style={{ color: base.muted, fontSize: 12, marginTop: 5 }}>{doc.originalFilename || doc.title}</Text> : null}<View style={{ flexDirection: 'row', gap: 8 }}><Pressable disabled={busy} onPress={() => void chooseFile(type)} style={{ paddingVertical: 10, flexDirection: 'row', gap: 5, alignItems: 'center' }}><Upload color={theme.primary} size={15} /><Text style={{ color: theme.primary, fontWeight: '700' }}>{doc ? 'Thay tài liệu' : 'Tải lên'}</Text></Pressable>{doc ? <Pressable disabled={busy} onPress={() => Alert.alert('Xóa tài liệu?', label, [{ text: 'Hủy' }, { text: 'Xóa', style: 'destructive', onPress: () => void removeDocument(doc.id) }])} style={{ padding: 10 }}><Text style={{ color: base.danger }}>Xóa</Text></Pressable> : null}</View></View>;
        })}<Button label="Tiếp tục xem lại" onPress={() => setStep(3)} busy={busy} role="TUTOR" /></Panel> : null}
      {step === 3 ? <Panel><Text style={{ color: base.ink, fontWeight: '800', fontSize: 17, marginBottom: 14 }}>Xem lại trước khi gửi</Text>
        <Summary label="Họ tên" value={user.fullName} /><Summary label="Giới thiệu" value={draft.bio} /><Summary label="Học vấn" value={[draft.educationLevel, draft.institution, draft.major].filter(Boolean).join(' · ')} /><Summary label="Kinh nghiệm" value={draft.experienceSummary} /><Summary label="Hình thức" value={draft.teachingModes.map(m => m === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp').join(', ')} /><Summary label="Giấy tờ" value={documents.map(d => d.documentType).join(', ')} />
        <Button label="Gửi hồ sơ xét duyệt" onPress={() => Alert.alert('Gửi hồ sơ?', 'Staff sẽ xét duyệt giấy tờ và thông tin của bạn.', [{ text: 'Xem lại', style: 'cancel' }, { text: 'Gửi hồ sơ', onPress: () => void submit() }])} busy={busy} role="TUTOR" />
      </Panel> : null}
      {step > 0 ? <Pressable onPress={() => setStep(s => s - 1)} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 4 }}><ChevronLeft size={18} color={theme.primary} /><Text style={{ color: theme.primary, fontWeight: '700' }}>Bước trước</Text></Pressable> : null}
    </> : null}
  </FormScreen>;
}

function Summary({ label, value }: { label: string; value?: string | null }) { return <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: base.line }}><Text style={{ color: base.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: base.ink, marginTop: 4, lineHeight: 20 }}>{value || 'Chưa cập nhật'}</Text></View>; }
