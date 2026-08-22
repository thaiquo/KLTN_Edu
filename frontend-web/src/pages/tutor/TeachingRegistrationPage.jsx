import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, Check, CheckCircle2,
  ChevronRight, Clock3, FileBadge2, GraduationCap, Lightbulb, LoaderCircle, RotateCcw,
  Send, ShieldCheck, Sparkles, Upload, X, XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { HomeHeader } from '../../components/home/HomeHeader';
import { tutorApplicationApi } from '../../api/tutorApplications';
import { catalogSuggestionApi, teachingCatalogApi, teachingRegistrationApi } from '../../api/teachingRegistrations';
import { TeachingRegistrationDetailsStep } from './TeachingRegistrationDetailsStep';
import { TeachingRegistrationHistory } from './TeachingRegistrationHistory';

const EMPTY_FORM = {
  programTypeId: '', educationLevelId: '', categoryId: '', subjectId: '', levelIds: [],
  experienceYears: '0', tuitionMin: '', tuitionMax: '', description: '', evidenceIds: [],
  isProposal: false,
  proposedSubjectName: '',
  proposedLevelName: '',
  proposedLevelNames: [],
  proposedLevels: [],
  proposedLevelType: 'SKILL_LEVEL',
  proposedNote: ''
};

const LEVEL_TYPE_LABELS = {
  GRADE: 'Lớp học', EXAM_PREPARATION: 'Ôn thi', UNIVERSITY_LEVEL: 'Đại học',
  CERTIFICATE_TARGET: 'Mục tiêu chứng chỉ', SKILL_LEVEL: 'Trình độ kỹ năng',
  COACHING_LEVEL: 'Định hướng / coaching'
};
const TEACHING_EVIDENCE_TYPES = ['DEGREE', 'CERTIFICATE', 'WORK_EXPERIENCE', 'PORTFOLIO', 'OTHER'];
const MAX_EVIDENCE_PER_REGISTRATION = 5;
const SCHOOL_GRADE_OPTIONS = {
  PRIMARY: ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'],
  SECONDARY: ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'],
  HIGH_SCHOOL: ['Lớp 10', 'Lớp 11', 'Lớp 12']
};
const SCHOOL_GRADE_CODES = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => [`Lớp ${index + 1}`, `GRADE_${index + 1}`])
);
const UNIVERSITY_TARGETS = [
  { code: 'YEAR_1', name: 'Sinh viên năm 1' },
  { code: 'YEAR_2', name: 'Sinh viên năm 2' },
  { code: 'YEAR_3', name: 'Sinh viên năm 3' },
  { code: 'YEAR_4_PLUS', name: 'Sinh viên năm 4+' }
];
const SKILL_TARGETS = [
  { code: 'BEGINNER', name: 'Cơ bản' },
  { code: 'INTERMEDIATE', name: 'Trung cấp' },
  { code: 'ADVANCED', name: 'Nâng cao' }
];

export function TeachingRegistrationPage({ embedded = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [catalog, setCatalog] = useState({ programs: [], educationLevels: [], categories: [], subjects: [], levels: [] });
  const [registrations, setRegistrations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stagedDocuments, setStagedDocuments] = useState([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState({ subjectName: '', levelCode: '', levelName: '', levelNames: [], levelType: 'SKILL_LEVEL', note: '' });
  const [uploadingDocument, setUploadingDocument] = useState('');
  const [documentErrors, setDocumentErrors] = useState({});
  const documentInputRef = useRef(null);
  const pendingDocumentType = useRef('');
  const pendingDocumentMetadata = useRef({});

  const selectedProgram = findById(catalog.programs, form.programTypeId);
  const academic = selectedProgram?.code === 'ACADEMIC';
  const steps = useMemo(() => buildSteps(academic), [academic]);
  const currentStep = steps[step] || steps[0];
  const selected = {
    program: selectedProgram,
    education: findById(catalog.educationLevels, form.educationLevelId),
    category: findById(catalog.categories, form.categoryId),
    subject: findById(catalog.subjects, form.subjectId),
    levels: catalog.levels.filter((item) => form.levelIds.includes(item.id))
  };
  const schoolGrades = SCHOOL_GRADE_OPTIONS[selected.education?.code] || [];
  const schoolGradeProposal = academic && schoolGrades.length > 0 && !String(selected.category?.code || '').includes('EXAM');
  const reusableEvidence = documents.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType));
  const identityDocuments = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'];
  const hasIdentity = hasIdentityDocuments(documents);
  const visibleDocuments = [...documents, ...stagedDocuments];

  const [tutorApp, setTutorApp] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      teachingCatalogApi.programTypes(), teachingCatalogApi.educationLevels(),
      teachingRegistrationApi.mine(), catalogSuggestionApi.mine().catch(() => []),
      tutorApplicationApi.getMyApplicationDocuments().catch(() => []),
      tutorApplicationApi.getMyTutorApplication().catch(() => null)
    ]).then(([programs, educationLevels, items, requested, savedDocuments, app]) => {
      if (!active) return;
      setCatalog((current) => ({ ...current, programs, educationLevels }));
      setRegistrations(Array.isArray(items) ? items : []);
      setSuggestions(Array.isArray(requested) ? requested : []);
      setDocuments(Array.isArray(savedDocuments) ? savedDocuments : []);
      if (app) setTutorApp(app);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Không thể tải dữ liệu đăng ký dạy.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function chooseProgram(program) {
    const nextAcademic = program.code === 'ACADEMIC';
    clearNotice();
    setForm({ ...EMPTY_FORM, programTypeId: String(program.id) });
    setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] }));
    setSuggestion({ subjectName: '', levelCode: '', levelName: '', levelNames: [], levelType: nextAcademic ? 'GRADE' : 'SKILL_LEVEL', note: '' });
    if (!nextAcademic) await loadCategories(program.id, '');
    setStep(1);
  }

  async function chooseEducation(item) {
    clearNotice();
    setForm((current) => ({ ...current, educationLevelId: String(item.id), categoryId: '', subjectId: '', levelIds: [] }));
    setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] }));
    await loadCategories(form.programTypeId, item.id);
    setStep(2);
  }

  async function loadCategories(programTypeId, educationLevelId) {
    setCatalogLoading(true);
    try {
      const categories = await teachingCatalogApi.categories(programTypeId, educationLevelId);
      setCatalog((current) => ({ ...current, categories: Array.isArray(categories) ? categories : [], subjects: [], levels: [] }));
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải nhóm môn.');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function chooseCategory(item) {
    clearNotice();
    setCatalogLoading(true);
    setForm((current) => ({ ...current, categoryId: String(item.id), subjectId: '', levelIds: [] }));
    setCatalog((current) => ({ ...current, subjects: [], levels: [] }));
    try {
      const subjects = await teachingCatalogApi.subjects(item.id);
      setCatalog((current) => ({ ...current, subjects: Array.isArray(subjects) ? subjects : [] }));
      setStep(academic ? 3 : 2);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải môn học.');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function chooseSubject(item) {
    clearNotice();
    setCatalogLoading(true);
    setForm((current) => ({ ...current, subjectId: String(item.id), levelIds: [] }));
    try {
      const levels = await teachingCatalogApi.levels(item.id);
      setCatalog((current) => ({ ...current, levels: Array.isArray(levels) ? levels : [] }));
      setStep(academic ? 4 : 3);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải lớp hoặc trình độ.');
    } finally {
      setCatalogLoading(false);
    }
  }

  function toggleLevel(item) {
    clearNotice();
    setForm((current) => ({
      ...current,
      levelIds: current.levelIds.includes(item.id)
        ? current.levelIds.filter((id) => id !== item.id)
        : [...current.levelIds, item.id]
    }));
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    clearNotice();
  }

  function toggleEvidence(id) {
    setForm((current) => ({
      ...current,
      evidenceIds: current.evidenceIds.includes(id)
        ? current.evidenceIds.filter((item) => item !== id)
        : current.evidenceIds.length >= MAX_EVIDENCE_PER_REGISTRATION
          ? current.evidenceIds
          : [...current.evidenceIds, id]
    }));
    if (!form.evidenceIds.includes(id) && form.evidenceIds.length >= MAX_EVIDENCE_PER_REGISTRATION) {
      setError(`Mỗi đăng ký dạy chỉ được chọn tối đa ${MAX_EVIDENCE_PER_REGISTRATION} minh chứng.`);
    } else {
      clearNotice();
    }
  }

  async function submit(event) {
    event.preventDefault();
    const stagedEvidence = stagedDocuments.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType) && item.file);
    const selectedSavedEvidence = reusableEvidence.filter((item) => form.evidenceIds.includes(item.id));
    const identityTypesAtSubmit = new Set([...documents, ...stagedDocuments.filter((item) => item.file)].map((item) => item.documentType));
    const identityReadyAtSubmit = identityTypesAtSubmit.has('PASSPORT') || (identityTypesAtSubmit.has('IDENTITY_FRONT') && identityTypesAtSubmit.has('IDENTITY_BACK'));
    
    if (!form.isProposal) {
      if (!form.subjectId || !form.levelIds.length) return setError('Vui lòng chọn ít nhất một lớp hoặc trình độ.');
    } else {
      if (!form.proposedSubjectName || !form.proposedLevelName) return setError('Vui lòng nhập đầy đủ thông tin môn học và trình độ đề xuất.');
    }
    
    if (!form.description.trim()) return setError('Vui lòng mô tả ngắn về năng lực giảng dạy.');
    if (!form.tuitionMin || !form.tuitionMax) return setError('Vui lòng nhập khoảng học phí dự kiến.');
    if (Number(form.tuitionMin) > Number(form.tuitionMax)) return setError('Học phí tối thiểu không được lớn hơn học phí tối đa.');
    if (tutorApp && tutorApp.status !== 'APPROVED') {
      return setError('Hồ sơ cá nhân và xác minh danh tính của bạn đang trong trạng thái ' + (tutorApp.status === 'PENDING' ? 'chờ Ban quản trị duyệt' : 'chưa được phê duyệt') + '. Vui lòng đợi phê duyệt trước khi đăng ký thêm môn dạy mới.');
    }
    if (!identityReadyAtSubmit) return setError('Vui lòng hoàn thành xác minh danh tính (CCCD/CMND hoặc Hộ chiếu) trong trang Hồ sơ cá nhân trước khi đăng ký dạy.');
    if (stagedEvidence.length + selectedSavedEvidence.length < 1) return setError('Vui lòng thêm ít nhất 1 minh chứng cho đăng ký dạy này.');
    if (stagedEvidence.length + selectedSavedEvidence.length > MAX_EVIDENCE_PER_REGISTRATION) return setError(`Mỗi đăng ký dạy chỉ được chọn tối đa ${MAX_EVIDENCE_PER_REGISTRATION} minh chứng.`);

    setBusy(true);
    clearNotice();
    try {
      const readyStaged = stagedDocuments.filter((item) => item.file);
      const uploadedStaged = await Promise.all(readyStaged.map((item) => tutorApplicationApi.uploadApplicationDocument({ documentType: item.documentType, file: item.file, metadata: TEACHING_EVIDENCE_TYPES.includes(item.documentType) ? { title: item.title || item.file.name.replace(/\.[^/.]+$/, ''), issuer: '', issueDate: item.issueDate || '', validityType: item.validityType || 'DOES_NOT_EXPIRE', expiryDate: item.expiryDate || '' } : {} })));
      const freshDocuments = uploadedStaged.length ? await tutorApplicationApi.getMyApplicationDocuments() : documents;
      const selectedEvidence = [...uploadedStaged.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType)), ...selectedSavedEvidence];
      
      const payload = {
        subjectId: form.isProposal ? null : Number(form.subjectId),
        levelIds: form.isProposal ? null : form.levelIds,
        experienceYears: Number(form.experienceYears),
        tuitionMin: Number(form.tuitionMin),
        tuitionMax: Number(form.tuitionMax),
        description: form.description.trim(),
        evidence: selectedEvidence.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType)).map((item) => ({
          evidenceType: toEvidenceType(item.documentType),
          title: item.title || item.originalFilename || 'Minh chứng năng lực', accountDocumentId: item.id
        })),

        categoryId: form.isProposal ? Number(form.categoryId) : null,
        proposedSubjectName: form.isProposal ? form.proposedSubjectName : null,
        proposedLevelName: form.isProposal ? form.proposedLevelName : null,
        proposedLevelType: form.isProposal ? form.proposedLevelType : null,
        proposedNote: form.isProposal ? form.proposedNote : null,
        proposedLevels: form.isProposal ? form.proposedLevels : null
      };

      const saved = await teachingRegistrationApi.createBatch(payload);
      setRegistrations((current) => [saved, ...current]);
      setDocuments(Array.isArray(freshDocuments) ? freshDocuments : documents);
      setStagedDocuments([]);
      resetWizard(false);
      setMessage(form.isProposal
        ? 'Đề xuất môn mới kèm hồ sơ dạy của bạn đã được gửi. Admin sẽ duyệt và tạo môn mới đồng thời phê duyệt hồ sơ dạy của bạn.'
        : 'Đăng ký môn dạy đã được gửi. Admin sẽ duyệt riêng quyền dạy này trước khi bạn có thể tạo lớp.');
    } catch (saveError) {
      setError(saveError.message || 'Không thể gửi đăng ký dạy.');
    } finally {
      setBusy(false);
    }
  }

  function submitSuggestion(event) {
    event.preventDefault();
    if (!form.categoryId) return setError('Vui lòng chọn nhóm môn trước khi đề xuất môn mới.');
    const proposedLevels = schoolGradeProposal ? suggestion.levelNames : [suggestion.levelName.trim()].filter(Boolean);
    if (!suggestion.subjectName.trim() || proposedLevels.length === 0) {
      return setError(schoolGradeProposal
        ? `Vui lòng nhập tên môn và chọn ít nhất một lớp thuộc cấp ${selected.education?.name}.`
        : 'Vui lòng nhập đầy đủ tên môn học và trình độ hoặc mục tiêu đề xuất.');
    }

    setForm((current) => ({
      ...current,
      isProposal: true,
      subjectId: '',
      levelIds: [],
      proposedSubjectName: suggestion.subjectName.trim(),
      proposedLevelName: proposedLevels.join(', '),
      proposedLevelNames: proposedLevels,
      proposedLevelType: schoolGradeProposal ? 'GRADE' : suggestion.levelType,
      proposedLevels: proposedLevels.map((name) => ({
        code: schoolGradeProposal ? SCHOOL_GRADE_CODES[name] : suggestion.levelCode || null,
        name,
        type: schoolGradeProposal ? 'GRADE' : suggestion.levelType
      })),
      proposedNote: suggestion.note.trim()
    }));

    setShowSuggestion(false);
    setSuggestion({ subjectName: '', levelCode: '', levelName: '', levelNames: [], levelType: academic ? 'GRADE' : 'SKILL_LEVEL', note: '' });
    clearNotice();
    setStep(academic ? 5 : 4);
  }

  function chooseDocument(type, metadata = {}) {
    pendingDocumentType.current = type;
    pendingDocumentMetadata.current = metadata;
    documentInputRef.current.value = '';
    documentInputRef.current.click();
  }

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    const documentType = pendingDocumentType.current;
    if (!file || !documentType) return;
    const identity = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(documentType);
    const allowed = identity ? ['jpg', 'jpeg', 'png'] : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const limit = identity ? 5 : 10;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(extension) || file.size > limit * 1024 * 1024) {
      setError(`File phải là ${identity ? 'JPG/PNG' : 'Word, Excel, PDF hoặc ảnh'} và không quá ${limit}MB.`);
      return;
    }
    setUploadingDocument(documentType);
    setDocumentErrors((current) => ({ ...current, [documentType]: '' }));
    clearNotice();
    try {
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, '');
      const providedMetadata = pendingDocumentMetadata.current || {};
      await tutorApplicationApi.uploadApplicationDocument({
        documentType,
        file,
        metadata: identity ? {} : {
          title: providedMetadata.title?.trim() || fallbackTitle,
          issuer: '',
          issueDate: '',
          validityType: 'DOES_NOT_EXPIRE',
          ...providedMetadata,
          title: providedMetadata.title?.trim() || fallbackTitle
        }
      });
      const savedDocuments = await tutorApplicationApi.getMyApplicationDocuments();
      setDocuments(Array.isArray(savedDocuments) ? savedDocuments : []);
      setDocumentErrors((current) => ({ ...current, [documentType]: '' }));
      setMessage('Tài liệu đã được lưu và có thể chọn cho quyền dạy này.');
    } catch (uploadError) {
      const message = uploadError.message || 'Không thể tải tài liệu lên.';
      setDocumentErrors((current) => ({ ...current, [documentType]: message }));
      setError(message);
    } finally {
      setUploadingDocument('');
      pendingDocumentType.current = '';
      pendingDocumentMetadata.current = {};
      event.target.value = '';
    }
  }

  async function uploadDocumentFile(file, documentType, metadata = {}) {
    if (!file || !documentType) return;
    const identity = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(documentType);
    const allowed = identity ? ['jpg', 'jpeg', 'png'] : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const limit = identity ? 5 : 10;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(extension) || file.size > limit * 1024 * 1024) {
      setError(`File phải là ${identity ? 'JPG/PNG' : 'Word, Excel, PDF hoặc ảnh'} và không quá ${limit}MB.`);
      return;
    }
    setUploadingDocument(documentType);
    setDocumentErrors((current) => ({ ...current, [documentType]: '' }));
    clearNotice();
    try {
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, '');
      await tutorApplicationApi.uploadApplicationDocument({
        documentType,
        file,
        metadata: identity ? {} : {
          title: metadata.title?.trim() || fallbackTitle,
          issuer: '',
          issueDate: metadata.issueDate || '',
          validityType: metadata.validityType || 'DOES_NOT_EXPIRE',
          expiryDate: metadata.expiryDate || ''
        }
      });
      const savedDocuments = await tutorApplicationApi.getMyApplicationDocuments();
      setDocuments(Array.isArray(savedDocuments) ? savedDocuments : []);
      setMessage('Tài liệu đã được lưu và có thể chọn cho quyền dạy này.');
    } catch (uploadError) {
      const message = uploadError.message || 'Không thể tải tài liệu lên.';
      setDocumentErrors((current) => ({ ...current, [documentType]: message }));
      setError(message);
    } finally {
      setUploadingDocument('');
    }
  }

  function stageDocument(file, documentType, metadata = {}) {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    if (!allowed.includes(extension) || file.size > 10 * 1024 * 1024) {
      setError('File phải là Word, Excel, PDF hoặc ảnh và không quá 10MB.');
      return;
    }
    const id = `local-${Date.now()}`;
    const title = metadata.title?.trim() || file.name.replace(/\.[^/.]+$/, '');
    setStagedDocuments((current) => [...current, { id, file, documentType, title, originalFilename: file.name, verificationStatus: 'LOCAL', metadata: { ...metadata, title, issuer: '' } }]);
    setForm((current) => ({ ...current, evidenceIds: [...current.evidenceIds, id] }));
    setMessage('File đã chọn thành công, chưa tải lên S3. File sẽ được gửi khi bạn bấm Gửi quyền dạy.');
  }

  function upsertStagedDocument(document) {
    setStagedDocuments((current) => {
      const exists = current.some((item) => item.id === document.id);
      return exists ? current.map((item) => item.id === document.id ? document : item) : [...current, document];
    });
  }

  function removeStagedDocument(id) {
    setStagedDocuments((current) => current.filter((item) => item.id !== id));
    setForm((current) => ({ ...current, evidenceIds: current.evidenceIds.filter((item) => item !== id) }));
  }

  function resetWizard(clear = true) {
    setForm(EMPTY_FORM);
    setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] }));
    setStep(0);
    if (clear) clearNotice();
  }

  function clearNotice() { setError(''); setMessage(''); }

  return (
    <div className={embedded ? "" : "min-h-screen bg-[#f4f7fa] text-slate-900"}>
      {!embedded && <HomeHeader />}
      <main className={embedded ? "container-app pb-16" : "container-app pb-16 pt-28"}>
        {!embedded && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"><ArrowLeft size={16} /> Hồ sơ cá nhân</Link>
            {step > 0 && <button type="button" onClick={() => resetWizard()} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"><RotateCcw size={15} /> Chọn lại từ đầu</button>}
          </div>
        )}
        {embedded && step > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => resetWizard()} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"><RotateCcw size={15} /> Chọn lại từ đầu</button>
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,.07)]">
          <div className="bg-slate-900 px-6 py-8 text-white sm:px-8">
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-100"><Sparkles size={16} /> Quyền giảng dạy</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Đăng ký môn dạy</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-300">Mỗi môn và trình độ là một quyền dạy riêng. Chỉ quyền đã được Admin duyệt mới xuất hiện khi bạn tạo lớp học.</p>
          </div>
        </section>

        {error && <Notice tone="red">{error}</Notice>}
        {message && <Notice tone="green">{message}</Notice>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Tiến trình đăng ký</p>
            <div className="mt-5 space-y-1">{steps.map((item, index) => <StepItem key={item.id} item={item} index={index} current={step} onClick={() => index < step && setStep(index)} />)}</div>
            <div className="mt-6 rounded-[8px] border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} /><p className="text-xs font-semibold leading-5 text-slate-600">CCCD được lưu trong hồ sơ gia sư và dùng chung. Bạn không phải tải lại CCCD cho từng môn.</p></div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)] sm:p-8">
              {loading ? <LoadingState /> : tutorApp && tutorApp.status !== 'APPROVED' ? (
                <div className="py-8 text-center space-y-5">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                    <ShieldCheck size={32} />
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    CHƯA ĐỦ ĐIỀU KIỆN ĐĂNG KÝ MÔN DẠY
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Hồ sơ cá nhân & CCCD của bạn chưa được Ban quản trị phê duyệt
                  </h2>
                  <p className="text-xs font-semibold text-slate-600 max-w-lg mx-auto leading-6">
                    Theo quy định: Bạn cần tải lên 2 mặt CCCD (hoặc Hộ chiếu) và được Ban quản trị phê duyệt Hồ sơ cá nhân trước khi mở tính năng Đăng ký môn dạy và Tạo lớp học mới.
                  </p>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-left max-w-md mx-auto space-y-1">
                    <p className="font-bold text-slate-700">Trạng thái hồ sơ cá nhân hiện tại:</p>
                    <p className="font-black text-amber-700">
                      {!tutorApp || tutorApp.status === 'DRAFT' ? '📝 Bản nháp (Chưa nộp gửi duyệt)' :
                       tutorApp.status === 'PENDING' ? '⏳ Đang chờ Ban quản trị duyệt' :
                       tutorApp.status === 'REJECTED' ? `✕ Bị từ chối (Lý do: ${tutorApp.rejectionReason || 'Thông tin chưa đạt yêu cầu'})` : tutorApp.status}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link
                      to="/profile"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#073554] px-5 py-3 text-xs font-bold text-white hover:bg-[#147b77] transition-all shadow-sm"
                    >
                      Về trang Hồ sơ cá nhân để nộp & theo dõi duyệt
                    </Link>
                  </div>
                </div>
              ) : <>
                <StepHeading step={step + 1} title={currentStep.title} description={currentStep.description} icon={currentStep.icon} />
                <div className="mt-7">
                  {currentStep.id === 'program' && <ProgramStep items={catalog.programs} onChoose={chooseProgram} />}
                  {currentStep.id === 'education' && <ChoiceGrid items={catalog.educationLevels} selectedId={form.educationLevelId} onChoose={chooseEducation} loading={catalogLoading} />}
                  {currentStep.id === 'category' && <ChoiceGrid items={catalog.categories} selectedId={form.categoryId} onChoose={chooseCategory} loading={catalogLoading} empty="Chưa có nhóm môn phù hợp trong danh mục." />}
                  {currentStep.id === 'subject' && <SubjectStep items={catalog.subjects} selectedId={form.subjectId} onChoose={chooseSubject} onSuggest={() => {
                    const examCategory = String(selected.category?.code || '').includes('EXAM');
                    const examTarget = examCategory
                      ? selected.education?.code === 'SECONDARY'
                        ? { code: 'GRADE_10_ENTRANCE_EXAM', name: 'Ôn thi vào lớp 10' }
                        : selected.education?.code === 'HIGH_SCHOOL'
                          ? { code: 'NATIONAL_EXAM', name: 'Ôn thi THPT Quốc gia' }
                          : { code: '', name: '' }
                      : { code: '', name: '' };
                    setSuggestion({
                      subjectName: '', levelCode: examTarget.code, levelName: examTarget.name, levelNames: [],
                      levelType: academic ? (examCategory ? 'EXAM_PREPARATION' : selected.education?.code === 'UNIVERSITY' ? 'UNIVERSITY_LEVEL' : 'GRADE') : 'SKILL_LEVEL',
                      note: ''
                    });
                    setShowSuggestion(true);
                  }} loading={catalogLoading} />}
                  {currentStep.id === 'level' && <LevelStep items={catalog.levels} selectedIds={form.levelIds} onToggle={toggleLevel} onContinue={() => setStep(academic ? 5 : 4)} loading={catalogLoading} />}
              {currentStep.id === 'details' && <TeachingRegistrationDetailsStep form={form} selected={selected} documents={documents} stagedDocuments={stagedDocuments} busy={busy} onChange={updateField} onUpsertStaged={upsertStagedDocument} onRemoveStaged={removeStagedDocument} onBack={() => setStep((current) => Math.max(0, current - 1))} onSubmit={submit} />}
            </div>
                {step > 0 && currentStep.id !== 'details' && <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"><ArrowLeft size={16} /> Quay lại bước trước</button>}
              </>}
            </section>
            <TeachingRegistrationHistory registrations={registrations} suggestions={suggestions} />
          </div>
        </div>
      </main>

      <input ref={documentInputRef} type="file" className="hidden" onChange={uploadDocument} />

      {showSuggestion && <SuggestionModal value={suggestion} setValue={setSuggestion} academic={academic} education={selected.education} category={selected.category} schoolGrades={schoolGrades} schoolGradeProposal={schoolGradeProposal} busy={busy} onClose={() => setShowSuggestion(false)} onSubmit={submitSuggestion} />}
    </div>
  );
}

function buildSteps(academic) {
  const program = { id: 'program', title: 'Loại chương trình', description: 'Chọn nhánh phù hợp với nội dung bạn muốn giảng dạy.', icon: GraduationCap };
  const category = { id: 'category', title: academic ? 'Nhóm môn' : 'Lĩnh vực', description: academic ? 'Chọn nhóm môn thuộc cấp học đã chọn.' : 'Chọn lĩnh vực kỹ năng hoặc nghề nghiệp.', icon: BriefcaseBusiness };
  const subject = { id: 'subject', title: 'Môn học', description: 'Chọn môn có sẵn hoặc đề xuất môn mới nếu chưa có trong danh mục.', icon: BookOpen };
  const level = { id: 'level', title: academic ? 'Lớp / trình độ' : 'Trình độ / mục tiêu', description: 'Chọn đúng đối tượng hoặc mục tiêu mà bạn đủ năng lực giảng dạy.', icon: BadgeCheck };
  const details = { id: 'details', title: 'Thông tin & minh chứng', description: 'Khai báo kinh nghiệm, học phí theo buổi và chọn minh chứng đã lưu trong hồ sơ.', icon: FileBadge2 };
  if (!academic) return [program, category, subject, level, details];
  return [program, { id: 'education', title: 'Cấp học', description: 'Chọn cấp học làm gốc cho chương trình học thuật.', icon: GraduationCap }, category, subject, level, details];
}

function StepItem({ item, index, current, onClick }) {
  const Icon = item.icon;
  const done = index < current;
  const active = index === current;
  return <button type="button" onClick={onClick} disabled={!done} className={`flex w-full items-center gap-3 rounded-[8px] p-3 text-left transition ${active ? 'bg-slate-900 text-white' : done ? 'text-slate-800 hover:bg-slate-50' : 'text-slate-400'}`}>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-white/10' : done ? 'bg-emerald-50 text-[#147b77]' : 'bg-slate-100'}`}>{done ? <Check size={17} /> : <Icon size={17} />}</span>
    <span><span className="block text-[10px] font-black uppercase tracking-wider">Bước {index + 1}</span><span className="mt-0.5 block text-sm font-extrabold">{item.title}</span></span>
  </button>;
}

function StepHeading({ step, title, description, icon: Icon }) {
  return <div className="flex items-start gap-4">
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary"><Icon size={22} /></span>
    <div><p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Bước {step}</p><h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">{title}</h2><p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{description}</p></div>
  </div>;
}

function ProgramStep({ items, onChoose }) {
  return <div className="grid gap-4 md:grid-cols-2">{items.map((item) => {
    const academic = item.code === 'ACADEMIC';
    const Icon = academic ? GraduationCap : BriefcaseBusiness;
    return <button key={item.id} type="button" onClick={() => onChoose(item)} className="group rounded-[8px] border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-[#147b77] hover:shadow-lg">
      <span className={`grid h-14 w-14 place-items-center rounded-[16px] ${academic ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}><Icon size={26} /></span>
      <h3 className="mt-5 font-display text-xl font-extrabold text-slate-950">{item.name}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">{item.description}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#147b77]">Chọn chương trình <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
    </button>;
  })}</div>;
}

function ChoiceGrid({ items, selectedId, onChoose, loading, empty = 'Chưa có dữ liệu phù hợp.' }) {
  if (loading) return <LoadingState compact />;
  if (!items.length) return <EmptyCatalog message={empty} />;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <button key={item.id} type="button" onClick={() => onChoose(item)} className={`group flex min-h-24 items-center justify-between rounded-[8px] border p-4 text-left transition ${String(selectedId) === String(item.id) ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-[#147b77] hover:bg-white'}`}>
    <span><span className="block font-display text-lg font-extrabold text-slate-950">{item.name}</span>{item.description && <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.description}</span>}</span>
    <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#147b77]" />
  </button>)}</div>;
}

function SubjectStep({ items, selectedId, onChoose, onSuggest, loading }) {
  return <div><ChoiceGrid items={items} selectedId={selectedId} onChoose={onChoose} loading={loading} empty="Nhóm này chưa có môn trong danh mục." />
    <button type="button" onClick={onSuggest} className="mt-5 flex w-full items-center justify-between rounded-[8px] border border-dashed border-amber-300 bg-amber-50 p-4 text-left text-amber-900 hover:border-amber-500">
      <span className="flex items-center gap-3"><Lightbulb size={20} /><span><strong className="block">Không tìm thấy môn bạn muốn dạy?</strong><span className="mt-1 block text-xs font-semibold">Nhập môn và trình độ mong muốn để gửi Admin bổ sung vào danh mục.</span></span></span><ArrowRight size={18} className="shrink-0" />
    </button>
  </div>;
}

function LevelStep({ items, selectedIds, onToggle, onContinue, loading }) {
  if (loading) return <LoadingState compact />;
  if (!items.length) return <EmptyCatalog message="Môn này chưa có lớp hoặc trình độ phù hợp. Bạn có thể quay lại và gửi đề xuất mới cho Admin." />;
  return <div>
    <div className="mb-4 rounded-[8px] border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-slate-600">Bạn có thể chọn nhiều lớp hoặc trình độ trong cùng lần gửi. Mỗi lựa chọn vẫn được lưu thành một quyền dạy riêng để Admin duyệt.</div>
    <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => {
      const active = selectedIds.includes(item.id);
      return <button key={item.id} type="button" onClick={() => onToggle(item)} className={`flex items-start gap-3 rounded-[8px] border p-5 text-left transition hover:border-[#147b77] ${active ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${active ? 'border-[#147b77] bg-[#147b77] text-white' : 'border-slate-300 bg-white'}`}>{active && <Check size={13} />}</span>
        <span><span className="text-[10px] font-black uppercase tracking-wider text-[#147b77]">{LEVEL_TYPE_LABELS[item.type] || item.type}</span><span className="mt-2 block font-display text-lg font-extrabold text-slate-950">{item.name}</span>{item.description && <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.description}</span>}</span>
      </button>;
    })}</div>
    <div className="mt-6 flex justify-end"><button type="button" disabled={!selectedIds.length} onClick={onContinue} className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">Tiếp tục với {selectedIds.length || 0} lựa chọn <ArrowRight size={16} /></button></div>
  </div>;
}

function DetailsStep({ form, selected, documents, hasIdentity, busy, uploadingDocument, documentErrors, onUploadDocument, onUploadDocumentFile, onStageDocument, onChange, onToggleEvidence, onBack, onSubmit }) {
  const [identityMode, setIdentityMode] = useState('CCCD');
  const reusableEvidence = documents.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType));
  const identityReady = hasIdentity ? 'Giấy tờ danh tính đã được lưu trong hồ sơ dùng chung.' : 'Hãy tải giấy tờ danh tính ngay tại bước này.';
  return <NewDetailsStep form={form} selected={selected} documents={documents} hasIdentity={hasIdentity} busy={busy} uploadingDocument={uploadingDocument} documentErrors={documentErrors} onUploadDocument={onUploadDocument} onUploadDocumentFile={onUploadDocumentFile} onStageDocument={onStageDocument} onChange={onChange} onToggleEvidence={onToggleEvidence} onBack={onBack} onSubmit={onSubmit} />;
  /* Kept below temporarily while the new layout is verified. */
  return <form onSubmit={onSubmit}>
    <div className="mb-4 rounded-[8px] border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-extrabold text-slate-900">Bước 1: Tải file minh chứng</p><p className="mt-1 text-xs font-semibold text-slate-600">Nếu chưa nhập tên, hệ thống tự lấy tên file làm tên minh chứng. Bạn có thể đặt tên hiển thị trước khi tải.</p></div>
    <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#147b77]">Quyền dạy đang đăng ký</p><p className="mt-2 font-display text-xl font-extrabold text-slate-950">{selected.subject?.name}</p><div className="mt-3 flex flex-wrap gap-2">{selected.levels.map((level) => <span key={level.id} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#147b77]">{level.name}</span>)}</div><p className="mt-3 text-sm font-semibold text-slate-600">{[selected.program?.name, selected.education?.name, selected.category?.name].filter(Boolean).join(' / ')}</p></div>
    <div className="mt-6 grid gap-5 sm:grid-cols-3"><Field label="Số năm kinh nghiệm" type="number" min="0" max="60" name="experienceYears" value={form.experienceYears} onChange={onChange} /><Field label="Học phí tối thiểu (đ/buổi)" type="number" min="1" name="tuitionMin" value={form.tuitionMin} onChange={onChange} /><Field label="Học phí tối đa (đ/buổi)" type="number" min="1" name="tuitionMax" value={form.tuitionMax} onChange={onChange} /></div>
    <label className="field mt-5 block"><span>Mô tả năng lực giảng dạy</span><div><textarea required name="description" value={form.description} onChange={onChange} rows={5} maxLength={1500} placeholder="Kinh nghiệm, phương pháp, thành tích hoặc đối tượng học viên phù hợp..." /></div></label>
    <div className="mt-7 border-t border-slate-200 pt-6">
      <div className="flex items-start gap-3"><ShieldCheck size={21} className={hasIdentity ? 'text-emerald-600' : 'text-amber-600'} /><div><h3 className="font-display text-lg font-extrabold text-slate-950">Giấy tờ dùng chung</h3><p className="mt-1 text-sm font-semibold text-slate-500">{hasIdentity ? 'Hồ sơ đã có giấy tờ danh tính. CCCD không cần gửi lại trong đăng ký này.' : 'Hồ sơ chưa đủ CCCD hai mặt hoặc hộ chiếu. Hãy cập nhật ở mục Tài liệu xác minh.'}</p></div></div>
      <div className="mt-5 rounded-[8px] border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-600">Giấy tờ danh tính dùng chung</p><p className="mt-2 text-sm font-semibold text-slate-600">{identityReady} CCCD/hộ chiếu chỉ cần nộp một lần và dùng cho các lần đăng ký môn sau.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setIdentityMode('CCCD')} className={`rounded-[8px] border p-3 text-left text-xs font-extrabold ${identityMode === 'CCCD' ? 'border-[#147b77] bg-emerald-50 text-[#147b77]' : 'border-slate-200 bg-white text-slate-700'}`}>CCCD / CMND<span className="mt-1 block text-[11px] font-semibold text-slate-500">Tải mặt trước và mặt sau</span></button><button type="button" onClick={() => setIdentityMode('PASSPORT')} className={`rounded-[8px] border p-3 text-left text-xs font-extrabold ${identityMode === 'PASSPORT' ? 'border-[#147b77] bg-emerald-50 text-[#147b77]' : 'border-slate-200 bg-white text-slate-700'}`}>Hộ chiếu<span className="mt-1 block text-[11px] font-semibold text-slate-500">Chỉ tải trang thông tin</span></button></div><div className="mt-3 flex flex-wrap gap-2">{identityMode === 'CCCD' ? <><button type="button" onClick={() => onUploadDocument('IDENTITY_FRONT')} disabled={Boolean(uploadingDocument)} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-50"><Upload size={14} />Tải mặt trước</button><button type="button" onClick={() => onUploadDocument('IDENTITY_BACK')} disabled={Boolean(uploadingDocument)} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-50"><Upload size={14} />Tải mặt sau</button></> : <button type="button" onClick={() => onUploadDocument('PASSPORT')} disabled={Boolean(uploadingDocument)} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-50"><Upload size={14} />Tải trang thông tin hộ chiếu</button>}</div></div>
      <div className="mt-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Chọn minh chứng liên quan ({form.evidenceIds.length}/{MAX_EVIDENCE_PER_REGISTRATION})</p>
        <p className="mt-2 text-sm font-semibold text-slate-500">Tối thiểu 1, tối đa 5 minh chứng cho mỗi quyền dạy. Có thể chọn bằng sư phạm, chứng chỉ IELTS/TOEIC, xác nhận giảng dạy ở trường/trung tâm, portfolio hoặc minh chứng khác.</p>
        <div className="mt-3 rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-4"><div className="flex flex-wrap gap-2">{TEACHING_EVIDENCE_TYPES.map((type) => <button key={type} type="button" onClick={() => onUploadDocument(type)} disabled={Boolean(uploadingDocument)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"><Upload size={14} />{documentTypeLabel(type)}</button>)}</div><p className="mt-2 text-xs font-semibold text-slate-500">PDF/JPG/PNG, tối đa 10MB mỗi file. Bạn có thể tải nhiều minh chứng, nhưng mỗi quyền dạy chỉ chọn tối đa 5 file.</p></div>
        {reusableEvidence.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{reusableEvidence.map((document) => {
          const active = form.evidenceIds.includes(document.id);
          const disabled = !active && form.evidenceIds.length >= MAX_EVIDENCE_PER_REGISTRATION;
          return <button key={document.id} type="button" disabled={disabled} onClick={() => onToggleEvidence(document.id)} className={`flex items-start gap-3 rounded-[8px] border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${active ? 'border-[#147b77] bg-[#147b77] text-white' : 'border-slate-300 bg-white'}`}>{active && <Check size={13} />}</span><span><strong className="block text-sm text-slate-900">{document.title || document.originalFilename}</strong><span className="mt-1 block text-xs font-semibold text-slate-500">{documentTypeLabel(document.documentType)} · {document.verificationStatus === 'VERIFIED' ? 'Đã xác minh' : 'Đang chờ xác minh'}</span></span></button>;
        })}</div> : <div className="mt-3 rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Chưa có minh chứng chuyên môn. Hãy bấm “Tải minh chứng mới”, sau đó chọn ít nhất 1 file để gửi Admin.</div>}
      </div>
    </div>
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"><ArrowLeft size={16} /> Quay lại chọn lớp</button><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-6 py-3 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} Gửi {form.levelIds.length} quyền dạy</button></div>
  </form>;
}

function SimpleDetailsStep({ form, selected, documents, busy, uploadingDocument, documentErrors, onUploadDocument: openDocument, onUploadDocumentFile, onStageDocument, onChange, onToggleEvidence, onBack, onSubmit }) {
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [detailDocument, setDetailDocument] = useState(null);
  const [metadata, setMetadata] = useState({ title: '', issueDate: '', validityType: 'DOES_NOT_EXPIRE', expiryDate: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const evidenceFileInputRef = useRef(null);
  const identityFileInputRef = useRef(null);
  const identityTypeRef = useRef('IDENTITY_FRONT');
  const onUploadDocument = chooseIdentityFile;
  const evidence = documents.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType));
  const canAdd = evidence.length < 5;
  const [identityMode, setIdentityMode] = useState('CCCD');
  const identityTypes = identityMode === 'CCCD' ? ['IDENTITY_FRONT', 'IDENTITY_BACK'] : ['PASSPORT'];

  function uploadEvidence() {
    if (!selectedFile) {
      evidenceFileInputRef.current?.click();
      return;
    }
    onStageDocument(selectedFile, 'OTHER', { title: metadata.title.trim(), issuer: '', issueDate: metadata.issueDate, validityType: metadata.validityType, expiryDate: metadata.expiryDate });
  }

  function chooseEvidenceFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setMetadata((current) => ({ ...current, title: current.title || file.name.replace(/\.[^/.]+$/, '') }));
    event.target.value = '';
  }

  function chooseIdentityFile(type) {
    identityTypeRef.current = type;
    identityFileInputRef.current?.click();
  }

  function stageIdentityFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    onStageDocument(file, identityTypeRef.current, {});
    event.target.value = '';
  }

  return <form onSubmit={onSubmit}>
    <input ref={evidenceFileInputRef} type="file" className="hidden" onChange={chooseEvidenceFile} />
    <input ref={identityFileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={stageIdentityFile} />
    <button type="button" onClick={() => onUploadDocument('OTHER', { title: '', issuer: '', issueDate: '', validityType: 'DOES_NOT_EXPIRE' })} disabled={Boolean(uploadingDocument)} className="mb-4 inline-flex items-center gap-2 rounded-[8px] border border-[#147b77] px-4 py-3 text-sm font-extrabold text-[#147b77] disabled:opacity-50"><Upload size={16} /> Chọn file trước</button>
    <section className="mt-5 rounded-[8px] border border-slate-200 p-4"><h3 className="font-display text-xl font-extrabold text-slate-950">Xác minh danh tính dùng chung</h3><p className="mt-2 text-sm font-semibold text-slate-500">Chọn CCCD/CMND để tải hai mặt hoặc hộ chiếu để tải một trang thông tin.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setIdentityMode('CCCD')} className={`rounded-[8px] border p-3 text-left text-sm font-extrabold ${identityMode === 'CCCD' ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>CCCD / CMND<span className="mt-1 block text-xs font-semibold text-slate-500">Mặt trước và mặt sau</span></button><button type="button" onClick={() => setIdentityMode('PASSPORT')} className={`rounded-[8px] border p-3 text-left text-sm font-extrabold ${identityMode === 'PASSPORT' ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>Hộ chiếu<span className="mt-1 block text-xs font-semibold text-slate-500">Một trang thông tin</span></button></div><div className="mt-3 grid gap-3">{identityTypes.map((type) => <UploadStatusRow key={type} label={type === 'IDENTITY_FRONT' ? 'CCCD / CMND mặt trước' : type === 'IDENTITY_BACK' ? 'CCCD / CMND mặt sau' : 'Hộ chiếu'} document={documents.find((item) => item.documentType === type)} error={documentErrors[type]} uploading={uploadingDocument === type} onUpload={() => onUploadDocument(type)} />)}</div></section>
    <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#147b77]">Quyền dạy đang đăng ký</p><p className="mt-2 font-display text-xl font-extrabold text-slate-950">{selected.subject?.name}</p><div className="mt-3 flex flex-wrap gap-2">{selected.levels.map((level) => <span key={level.id} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#147b77]">{level.name}</span>)}</div></div>
    <div className="mt-6 grid gap-5 sm:grid-cols-3"><Field label="Số năm kinh nghiệm" type="number" min="0" name="experienceYears" value={form.experienceYears} onChange={onChange} /><Field label="Học phí tối thiểu (đ/buổi)" type="number" min="1" name="tuitionMin" value={form.tuitionMin} onChange={onChange} /><Field label="Học phí tối đa (đ/buổi)" type="number" min="1" name="tuitionMax" value={form.tuitionMax} onChange={onChange} /></div>
    <label className="field mt-5 block"><span>Mô tả năng lực giảng dạy</span><div><textarea required name="description" value={form.description} onChange={onChange} rows={4} maxLength={1500} /></div></label>
    <section className="mt-7 rounded-[8px] border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950"><AwardIcon /> Minh chứng chuyên môn</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Tên minh chứng, ngày cấp nếu có, có hoặc không có thời hạn và file đính kèm. Word, Excel, PDF và ảnh, tối đa 10MB mỗi file.</p><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Đã thêm {evidence.length}/5 minh chứng</p><button type="button" disabled={!canAdd} onClick={() => setShowEvidenceForm(true)} className="inline-flex items-center gap-2 rounded-[8px] border border-[#147b77] px-3 py-2 text-sm font-extrabold text-[#147b77] disabled:opacity-40">+ Thêm minh chứng</button></div>{showEvidenceForm && <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Tên minh chứng" value={metadata.title} onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))} placeholder="Chứng chỉ tiếng Anh IELTS" /><Field label="Ngày cấp (không bắt buộc)" type="date" value={metadata.issueDate} onChange={(event) => setMetadata((current) => ({ ...current, issueDate: event.target.value }))} /><label className="field"><span>Thời hạn</span><div><select value={metadata.validityType} onChange={(event) => setMetadata((current) => ({ ...current, validityType: event.target.value }))}><option value="DOES_NOT_EXPIRE">Không thời hạn</option><option value="EXPIRES">Có thời hạn</option></select></div></label>{metadata.validityType === 'EXPIRES' && <Field label="Ngày hết hạn" type="date" value={metadata.expiryDate} onChange={(event) => setMetadata((current) => ({ ...current, expiryDate: event.target.value }))} />}</div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={uploadEvidence} disabled={!metadata.title.trim() || Boolean(uploadingDocument)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Upload size={16} /> Chọn file và tải lên</button><button type="button" onClick={() => setShowEvidenceForm(false)} className="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600">Hủy</button></div></div>}
      <div className="mt-4 grid gap-3">{evidence.length ? evidence.map((document) => <article key={document.id} onClick={() => setDetailDocument(document)} className="cursor-pointer rounded-[8px] border border-slate-200 bg-white p-4 hover:border-[#147b77]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{document.originalFilename}</p><p className="mt-1 text-xs font-bold text-slate-500">{document.title || 'Minh chứng chuyên môn'} · {document.issueDate ? formatDate(document.issueDate) : 'Không có ngày cấp'}</p></div><span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">{document.verificationStatus === 'VERIFIED' ? 'ĐÃ XÁC MINH' : 'CHỜ DUYỆT'}</span></div></article>) : <p className="rounded-[8px] border border-dashed border-slate-300 p-4 text-xs font-semibold text-slate-500">Mỗi quyền dạy cần chọn tối thiểu 1 và tối đa 5 minh chứng liên quan.</p>}</div></section>
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500"><ArrowLeft size={16} /> Quay lại</button><button disabled={busy || form.evidenceIds.length < 1 || form.evidenceIds.length > 5} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} Gửi {form.levelIds.length} quyền dạy</button></div>
    {detailDocument && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setDetailDocument(null)}><div className="w-full max-w-lg rounded-[12px] bg-white p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><h4 className="font-display text-xl font-extrabold">Chi tiết minh chứng</h4><button type="button" onClick={() => setDetailDocument(null)} className="text-slate-500">Đóng</button></div><div className="mt-5 grid gap-3 text-sm"><p><strong>Tên file:</strong> {detailDocument.originalFilename}</p><p><strong>Tên minh chứng:</strong> {detailDocument.title || 'Không có'}</p><p><strong>Ngày cấp:</strong> {detailDocument.issueDate ? formatDate(detailDocument.issueDate) : 'Không có'}</p><p><strong>Thời hạn:</strong> {detailDocument.validityType === 'EXPIRES' ? formatDate(detailDocument.expiryDate) : 'Không thời hạn'}</p><p><strong>Trạng thái:</strong> {detailDocument.verificationStatus === 'VERIFIED' ? 'Đã xác minh' : 'Chờ duyệt'}</p></div></div></div>}
  </form>;
}

function NewDetailsStep({ form, selected, documents, hasIdentity, busy, uploadingDocument, documentErrors, onUploadDocument, onUploadDocumentFile, onStageDocument, onChange, onToggleEvidence, onBack, onSubmit }) {
  return <SimpleDetailsStep form={form} selected={selected} documents={documents} busy={busy} uploadingDocument={uploadingDocument} documentErrors={documentErrors} onUploadDocument={onUploadDocument} onUploadDocumentFile={onUploadDocumentFile} onStageDocument={onStageDocument} onChange={onChange} onToggleEvidence={onToggleEvidence} onBack={onBack} onSubmit={onSubmit} />;
  /* Legacy layout retained below until the new screen is verified. */
  /* eslint-disable no-unreachable */
  const [identityMode, setIdentityMode] = useState('CCCD');
  const evidenceType = 'OTHER';
  const setEvidenceType = () => {};
  const [metadata, setMetadata] = useState({ title: '', issuer: '', issueDate: '', credentialNumber: '', validityType: 'DOES_NOT_EXPIRE', expiryDate: '' });
  const evidence = documents.filter((item) => TEACHING_EVIDENCE_TYPES.includes(item.documentType));
  const identityTypes = identityMode === 'CCCD' ? ['IDENTITY_FRONT', 'IDENTITY_BACK'] : ['PASSPORT'];
  const labels = { IDENTITY_FRONT: 'CCCD / CMND mặt trước', IDENTITY_BACK: 'CCCD / CMND mặt sau', PASSPORT: 'Hộ chiếu' };

  function uploadEvidence() {
    if (!metadata.title.trim()) return;
    onUploadDocument(evidenceType, { ...metadata, title: metadata.title.trim(), issuer: metadata.issuer.trim() });
  }

  return <form onSubmit={onSubmit}>
    <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#147b77]">Quyền dạy đang đăng ký</p><p className="mt-2 font-display text-xl font-extrabold text-slate-950">{selected.subject?.name}</p><div className="mt-3 flex flex-wrap gap-2">{selected.levels.map((level) => <span key={level.id} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#147b77]">{level.name}</span>)}</div><p className="mt-3 text-sm font-semibold text-slate-600">{[selected.program?.name, selected.education?.name, selected.category?.name].filter(Boolean).join(' / ')}</p></div>
    <div className="mt-6 grid gap-5 sm:grid-cols-3"><Field label="Số năm kinh nghiệm" type="number" min="0" max="60" name="experienceYears" value={form.experienceYears} onChange={onChange} /><Field label="Học phí tối thiểu (đ/buổi)" type="number" min="1" name="tuitionMin" value={form.tuitionMin} onChange={onChange} /><Field label="Học phí tối đa (đ/buổi)" type="number" min="1" name="tuitionMax" value={form.tuitionMax} onChange={onChange} /></div>
    <label className="field mt-5 block"><span>Mô tả năng lực giảng dạy</span><div><textarea required name="description" value={form.description} onChange={onChange} rows={5} maxLength={1500} /></div></label>

    <section className="mt-7 rounded-[8px] border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950"><ShieldCheck size={20} className="text-primary" /> Xác minh danh tính dùng chung</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Bạn chỉ cần lưu CCCD/CMND hai mặt hoặc hộ chiếu một lần. Hệ thống sẽ tái sử dụng cho các đăng ký dạy tiếp theo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setIdentityMode('CCCD')} className={`rounded-[8px] border p-4 text-left ${identityMode === 'CCCD' ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><strong className="block text-sm text-slate-950">CCCD / CMND</strong><span className="mt-1 block text-xs font-bold text-slate-500">Yêu cầu mặt trước và mặt sau.</span></button><button type="button" onClick={() => setIdentityMode('PASSPORT')} className={`rounded-[8px] border p-4 text-left ${identityMode === 'PASSPORT' ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><strong className="block text-sm text-slate-950">Hộ chiếu</strong><span className="mt-1 block text-xs font-bold text-slate-500">Chỉ cần trang thông tin hộ chiếu.</span></button></div><div className="mt-3 grid gap-3">{identityTypes.map((type) => { const document = documents.find((item) => item.documentType === type); return <UploadStatusRow key={type} label={labels[type]} document={document} error={documentErrors[type]} uploading={uploadingDocument === type} onUpload={() => onUploadDocument(type)} />; })}</div></section>

    <section className="mt-5 rounded-[8px] border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950"><AwardIcon /> Minh chứng chuyên môn</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Bằng cấp, chứng chỉ, xác nhận kinh nghiệm giảng dạy, portfolio hoặc minh chứng khác. PDF/JPG/PNG, tối đa 10MB mỗi file.</p><div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap gap-2">{TEACHING_EVIDENCE_TYPES.map((type) => <button key={type} type="button" onClick={() => { setEvidenceType(type); setMetadata({ title: '', issuer: '', issueDate: '', credentialNumber: '' }); }} className={`rounded-full border px-3 py-2 text-xs font-extrabold ${evidenceType === type ? 'border-[#147b77] bg-[#147b77] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{documentTypeLabel(type)}</button>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={evidenceType === 'DEGREE' ? 'Tên bằng cấp' : 'Tên minh chứng'} value={metadata.title} onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))} placeholder="Cử nhân Sư phạm Tiếng Anh" /><Field label="Trường / đơn vị cấp" value={metadata.issuer} onChange={(event) => setMetadata((current) => ({ ...current, issuer: event.target.value }))} placeholder="IUH, British Council, trung tâm ABC..." /><Field label="Ngày cấp / ngày tạo" type="date" value={metadata.issueDate} onChange={(event) => setMetadata((current) => ({ ...current, issueDate: event.target.value }))} /><Field label="Mã chứng chỉ / số hiệu" value={metadata.credentialNumber} onChange={(event) => setMetadata((current) => ({ ...current, credentialNumber: event.target.value }))} placeholder="Không bắt buộc" /></div><button type="button" onClick={uploadEvidence} disabled={Boolean(uploadingDocument) || !metadata.title.trim() || !metadata.issuer.trim() || !metadata.issueDate} className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Upload size={16} /> Chọn file và tải lên</button></div><div className="mt-4 grid gap-3">{evidence.length ? evidence.map((document) => <UploadStatusRow key={document.id} label={`${documentTypeLabel(document.documentType)} · ${document.title || document.originalFilename}`} document={document} error={documentErrors[document.documentType]} uploading={uploadingDocument === document.documentType} onUpload={() => onUploadDocument(document.documentType)} selected={form.evidenceIds.includes(document.id)} onSelect={() => onToggleEvidence(document.id)} />) : <p className="rounded-[8px] border border-dashed border-slate-300 p-4 text-xs font-semibold text-slate-500">Bạn chưa tải lên minh chứng chuyên môn nào. Mỗi quyền dạy cần chọn tối thiểu 1 và tối đa 5 minh chứng liên quan.</p>}</div></section>
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500"><ArrowLeft size={16} /> Quay lại</button><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} Gửi {form.levelIds.length} quyền dạy</button></div>
  </form>;
}

function UploadStatusRow({ label, document, error, uploading, onUpload, selected, onSelect }) {
  return <div className={`flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between ${selected ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><div><p className="text-sm font-extrabold text-slate-950">{label}</p><p className={`mt-1 text-xs font-bold ${document ? 'text-emerald-700' : error ? 'text-red-700' : 'text-slate-500'}`}>{document ? `Đã tải lên · ${document.originalFilename || document.title}` : error || 'Chưa tải lên'}</p></div><div className="flex gap-2"><button type="button" onClick={onUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 disabled:opacity-50">{uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />} {document ? 'Thay file' : 'Tải lên'}</button>{onSelect && <button type="button" onClick={onSelect} className="rounded-[8px] border border-[#147b77] px-3 py-2 text-xs font-extrabold text-[#147b77]">{selected ? 'Đã chọn' : 'Chọn'}</button>}</div></div>;
}

function AwardIcon() { return <span className="text-primary">✪</span>; }

function RegistrationHistory({ registrations, suggestions }) {
  if (!registrations.length && !suggestions.length) return null;
  return <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="font-display text-2xl font-extrabold text-slate-950">Hồ sơ đã gửi</h2><p className="mt-2 text-sm font-semibold text-slate-500">Theo dõi riêng trạng thái từng môn và trình độ.</p>
    {registrations.length > 0 && <div className="mt-5 grid gap-3">{registrations.map((item) => <RegistrationCard key={item.id} item={item} />)}</div>}
    {suggestions.length > 0 && <div className="mt-6 border-t border-slate-200 pt-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Môn mới đang đề xuất</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{suggestions.map((item) => <SuggestionCard key={item.id} item={item} />)}</div></div>}
  </section>;
}

function RegistrationCard({ item }) {
  const config = { PENDING: { icon: Clock3, label: 'Chờ duyệt', color: 'text-amber-700 bg-amber-50 border-amber-100' }, APPROVED: { icon: CheckCircle2, label: 'Đã duyệt · Có thể tạo lớp', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }, REJECTED: { icon: XCircle, label: 'Cần chỉnh sửa', color: 'text-red-700 bg-red-50 border-red-100' } }[item.status] || { icon: Clock3, label: item.status, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  const Icon = config.icon;
  return <article className="flex flex-col gap-4 rounded-[8px] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display text-lg font-extrabold text-slate-950">{item.subject?.name} · {(item.levels || []).map((level) => level.name).join(', ')}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.category?.name} · {item.experienceYears} năm kinh nghiệm · {formatMoney(item.tuitionMin)} - {formatMoney(item.tuitionMax)}/buổi</p>{item.rejectReason && <p className="mt-3 rounded bg-red-50 p-2 text-xs font-bold text-red-700">Lý do: {item.rejectReason}</p>}</div><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold ${config.color}`}><Icon size={14} />{config.label}</span></article>;
}

function SuggestionCard({ item }) {
  const label = item.status === 'APPROVED' ? 'Đã thêm vào danh mục' : item.status === 'REJECTED' ? 'Không được chấp nhận' : 'Admin đang xem xét';
  return <article className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><p className="font-extrabold text-slate-950">{item.subjectName} · {item.levelName}</p><p className="mt-2 text-xs font-bold text-slate-500">{label}</p>{item.rejectReason && <p className="mt-2 text-xs font-semibold text-red-700">{item.rejectReason}</p>}</article>;
}

function SuggestionModal({ value, setValue, academic, education, category, schoolGrades, schoolGradeProposal, busy, onClose, onSubmit }) {
  const examCategory = academic && String(category?.code || '').includes('EXAM');
  const university = academic && education?.code === 'UNIVERSITY';
  const types = university
    ? ['UNIVERSITY_LEVEL', 'EXAM_PREPARATION', 'COACHING_LEVEL']
    : academic
      ? ['EXAM_PREPARATION']
      : ['SKILL_LEVEL', 'CERTIFICATE_TARGET', 'COACHING_LEVEL'];
  const levelLabel = university
    ? 'Đối tượng / trình độ đại học'
    : examCategory
      ? 'Mục tiêu ôn thi'
      : value.levelType === 'CERTIFICATE_TARGET'
        ? 'Chứng chỉ / mục tiêu đầu ra'
        : value.levelType === 'COACHING_LEVEL'
          ? 'Mục tiêu hướng dẫn'
          : 'Trình độ kỹ năng';
  const levelPlaceholder = university
    ? 'Ví dụ: Sinh viên năm 1, Hỗ trợ khóa luận...'
    : examCategory
      ? 'Ví dụ: Ôn thi vào lớp 10, Ôn thi THPT Quốc gia...'
      : value.levelType === 'CERTIFICATE_TARGET'
        ? 'Ví dụ: IELTS 6.5, MOS Associate...'
        : 'Ví dụ: Cơ bản, Trung cấp, Nâng cao...';
  const standardTargets = university && value.levelType === 'UNIVERSITY_LEVEL'
    ? UNIVERSITY_TARGETS
    : !academic && value.levelType === 'SKILL_LEVEL'
      ? SKILL_TARGETS
      : [];
  const canSubmit = value.subjectName.trim() && (schoolGradeProposal ? value.levelNames.length > 0 : value.levelName.trim());
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 sm:py-8" role="dialog" aria-modal="true"><form onSubmit={onSubmit} className="my-auto w-full max-w-xl rounded-[8px] bg-white p-6 shadow-2xl sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Đề xuất danh mục</p><h2 className="mt-1 font-display text-2xl font-extrabold">Môn học chưa có</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={18} /></button></div>
    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Đã chọn: <strong className="text-slate-800">{[education?.name, category?.name].filter(Boolean).join(' / ')}</strong>. Admin sẽ kiểm tra và tạo môn cùng các lớp/trình độ tương ứng.</p>
    <div className="mt-6 grid gap-4">
      <Field label={schoolGradeProposal ? `Tên môn học trong cấp ${education?.name}` : 'Tên môn / nội dung muốn dạy'} value={value.subjectName} onChange={(event) => setValue((current) => ({ ...current, subjectName: event.target.value }))} placeholder={schoolGradeProposal ? 'Ví dụ: Khoa học máy tính' : 'Ví dụ: Kỹ năng sống, Luyện thi IELTS...'} />
      {schoolGradeProposal ? (
        <fieldset>
          <legend className="text-sm font-extrabold text-slate-800">Chọn lớp muốn dạy trong cấp {education?.name}</legend>
          <p className="mt-1 text-xs font-semibold text-slate-500">Có thể chọn nhiều lớp. Hệ thống chỉ cho chọn các lớp thuộc đúng cấp học đã chọn.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {schoolGrades.map((grade) => {
              const checked = value.levelNames.includes(grade);
              return <button key={grade} type="button" onClick={() => setValue((current) => ({ ...current, levelNames: checked ? current.levelNames.filter((name) => name !== grade) : [...current.levelNames, grade] }))} className={`flex items-center justify-between rounded-[8px] border px-3 py-3 text-sm font-extrabold ${checked ? 'border-[#147b77] bg-emerald-50 text-[#147b77]' : 'border-slate-200 bg-white text-slate-600'}`}><span>{grade}</span>{checked && <Check size={16} />}</button>;
            })}
          </div>
        </fieldset>
      ) : (
        <>
          {!examCategory && <label className="field"><span>Phân loại trình độ / mục tiêu</span><div><select value={value.levelType} onChange={(event) => setValue((current) => ({ ...current, levelType: event.target.value, levelCode: '', levelName: '' }))}>{types.map((type) => <option key={type} value={type}>{LEVEL_TYPE_LABELS[type]}</option>)}</select></div></label>}
          {standardTargets.length > 0 && <fieldset><legend className="text-sm font-extrabold text-slate-800">Chọn mức chuẩn</legend><div className="mt-3 grid grid-cols-2 gap-2">{standardTargets.map((target) => <button key={target.code} type="button" onClick={() => setValue((current) => ({ ...current, levelCode: target.code, levelName: target.name }))} className={`rounded-[8px] border px-3 py-3 text-left text-sm font-extrabold ${value.levelCode === target.code ? 'border-[#147b77] bg-emerald-50 text-[#147b77]' : 'border-slate-200 bg-white text-slate-600'}`}>{target.name}</button>)}</div></fieldset>}
          <Field label={standardTargets.length ? `${levelLabel} đã chọn hoặc nhập mức khác` : levelLabel} value={value.levelName} onChange={(event) => setValue((current) => ({ ...current, levelCode: '', levelName: event.target.value }))} placeholder={levelPlaceholder} readOnly={examCategory && Boolean(value.levelCode)} />
        </>
      )}
      <label className="field"><span>Ghi chú cho Admin</span><div><textarea rows={3} maxLength={1000} value={value.note} onChange={(event) => setValue((current) => ({ ...current, note: event.target.value }))} placeholder="Mô tả ngắn nội dung môn, giáo trình hoặc lý do cần bổ sung..." /></div></label>
    </div>
    <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700">Hủy</button><button disabled={busy || !canSubmit} className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy && <LoaderCircle size={16} className="animate-spin" />} Tiếp tục hồ sơ dạy</button></div>
  </form></div>;
}

function Field({ label, ...props }) { return <label className="field"><span>{label}</span><div><input required {...props} /></div></label>; }
function Notice({ tone, children }) { return <div className={`mt-5 rounded-[8px] border p-4 text-sm font-bold ${tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>; }
function EmptyCatalog({ message }) { return <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">{message}</div>; }
function LoadingState({ compact = false }) { return <div className={`grid place-items-center text-slate-500 ${compact ? 'py-12' : 'py-24'}`}><LoaderCircle className="animate-spin text-primary" size={26} /><p className="mt-3 text-sm font-bold">Đang tải dữ liệu...</p></div>; }
function findById(items, id) { return items.find((item) => String(item.id) === String(id)); }
function hasIdentityDocuments(documents) { const types = new Set(documents.map((item) => item.documentType)); return types.has('PASSPORT') || (types.has('IDENTITY_FRONT') && types.has('IDENTITY_BACK')); }
function formatMoney(value) { return new Intl.NumberFormat('vi-VN').format(Number(value || 0)); }
function formatDate(value) { return value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : 'Không có'; }
function toEvidenceType(documentType) { return TEACHING_EVIDENCE_TYPES.includes(documentType) ? documentType : 'OTHER'; }
function documentTypeLabel(type) {
  const labels = {
    DEGREE: 'Bằng cấp',
    CERTIFICATE: 'Chứng chỉ',
    WORK_EXPERIENCE: 'Minh chứng kinh nghiệm',
    PORTFOLIO: 'Portfolio',
    OTHER: 'Minh chứng khác'
  };
  return labels[type] || type;
}
