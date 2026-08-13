import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, FileText, LoaderCircle, PencilLine, Send, ShieldCheck, X, XCircle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { tutorApplicationApi } from '../../../api/tutorApplications';

const STEP_BY_MISSING_ITEM = {
  accountFullName: 0,
  accountEmail: 0,
  emailVerified: 0,
  profilePhoto: 0,
  educationLevel: 1,
  institution: 1,
  experienceSummary: 1,
  bio: 3,
  teachingSubjects: 2,
  validTeachingSubjects: 2,
  identityDocument: 4,
  degreeOrCertificate: 4
};

export function ReviewSubmitStep({ application, readOnly, onApplicationUpdated, onBack, onStepChange }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [backendMissingItems, setBackendMissingItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitSuccessOpen, setSubmitSuccessOpen] = useState(false);
  const [viewingId, setViewingId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadReviewData() {
      setLoading(true);
      setError('');

      try {
        const [nextSubjects, nextDocuments] = await Promise.all([
          tutorApplicationApi.getMyTutorApplicationSubjects(),
          tutorApplicationApi.getMyApplicationDocuments()
        ]);
        if (!active) return;
        setSubjects(Array.isArray(nextSubjects) ? nextSubjects : []);
        setDocuments(Array.isArray(nextDocuments) ? nextDocuments : []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Không thể tải dữ liệu xem lại.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReviewData();

    return () => {
      active = false;
    };
  }, []);

  const missingItems = useMemo(
    () => backendMissingItems.length > 0 ? backendMissingItems : calculateMissingItems(user, application, subjects, documents),
    [backendMissingItems, user, application, subjects, documents]
  );
  const sections = useMemo(
    () => buildSections(user, application, subjects, documents, missingItems),
    [user, application, subjects, documents, missingItems]
  );
  const completedCount = sections.filter((section) => section.complete).length;
  const canSubmit = !readOnly && !loading && missingItems.length === 0 && ['DRAFT', 'REJECTED'].includes(application?.status);

  async function submitApplication() {
    setSubmitting(true);
    setSubmitError('');
    setBackendMissingItems([]);

    try {
      const updated = await tutorApplicationApi.submitMyTutorApplication();
      onApplicationUpdated?.(updated);
      setConfirming(false);
      setSubmitSuccessOpen(true);
    } catch (submitFailure) {
      const nextMissingItems = Array.isArray(submitFailure.raw?.missingItems) ? submitFailure.raw.missingItems : [];
      setBackendMissingItems(nextMissingItems);
      setSubmitError(toFriendlyMessage(submitFailure, nextMissingItems));
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function viewDocument(document) {
    setViewingId(document.id);
    setError('');

    try {
      const response = await tutorApplicationApi.getApplicationDocumentDownloadUrl(document.id);
      if (response?.url) {
        window.open(response.url, '_blank', 'noopener,noreferrer');
      }
    } catch (viewError) {
      setError(viewError.message || 'Không thể mở tài liệu.');
    } finally {
      setViewingId('');
    }
  }

  return (
    <section>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
          <ShieldCheck size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Bước 6</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            Xem lại & gửi duyệt
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
            Kiểm tra lần cuối trước khi gửi. Sau khi gửi, hồ sơ chuyển sang trạng thái chờ Staff xét duyệt và tạm thời không chỉnh sửa.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-6">
        {application?.status === 'PENDING' && (
          <InfoCard tone="green" title="Hồ sơ đang được xét duyệt">
            Bạn đã gửi hồ sơ thành công. Staff sẽ xem thông tin, môn học và tài liệu xác minh trước khi phê duyệt.
          </InfoCard>
        )}

        {error && <InfoCard tone="red" title="Không thể tải dữ liệu xem lại">{error}</InfoCard>}
        {submitError && <InfoCard tone="red" title="Chưa thể gửi hồ sơ">{submitError}</InfoCard>}

        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-950">Hồ sơ của bạn</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {completedCount}/{sections.length} mục đã hoàn thành
              </p>
            </div>
            <span className={`w-fit rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] ${missingItems.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {missingItems.length ? `Còn ${missingItems.length} mục cần hoàn thiện` : 'Sẵn sàng gửi duyệt'}
            </span>
          </div>
        </div>

        {loading ? (
          <ReviewSkeleton />
        ) : (
          <div className="grid gap-4">
            {sections.map((section) => (
              <ReviewSection key={section.id} section={section} readOnly={readOnly} onStepChange={onStepChange} />
            ))}
          </div>
        )}

        <DocumentPreview documents={documents} viewingId={viewingId} onView={viewDocument} />

        {confirming && (
          <div className="rounded-[8px] border border-amber-100 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-extrabold">Gửi hồ sơ xét duyệt?</h3>
                <p className="mt-2 text-sm font-semibold leading-6">
                  Sau khi gửi, bạn sẽ không thể chỉnh sửa hồ sơ cho đến khi Staff phản hồi.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="rounded-[8px] border border-amber-200 bg-white px-4 py-3 text-sm font-extrabold text-amber-900 disabled:opacity-60">Hủy</button>
                  <button type="button" onClick={submitApplication} disabled={submitting} className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60">
                    {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? 'Đang gửi...' : 'Gửi hồ sơ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {submitSuccessOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4">
            <div className="w-full max-w-md rounded-[12px] border border-emerald-100 bg-white p-6 shadow-[0_26px_70px_rgba(15,23,42,.22)]">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={24} />
                </span>
                <button type="button" onClick={() => setSubmitSuccessOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
                  <X size={18} />
                </button>
              </div>
              <h3 className="mt-5 font-display text-2xl font-extrabold text-slate-950">Hồ sơ đã được gửi</h3>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                Hồ sơ đăng ký gia sư của bạn đã được gửi đến bộ phận xét duyệt. Trong thời gian chờ xử lý, hồ sơ đã gửi sẽ ở trạng thái chỉ đọc.
              </p>
              <button type="button" onClick={() => setSubmitSuccessOpen(false)} className="mt-6 inline-flex w-full items-center justify-center rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-900">
                Đã hiểu
              </button>
            </div>
          </div>
        )}

        <div className="mt-1 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45">
            <ArrowLeft size={16} />
            Quay lại
          </button>
          {!readOnly && (
            <button type="button" onClick={() => setConfirming(true)} disabled={!canSubmit || submitting} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#147b77] disabled:cursor-not-allowed disabled:opacity-45">
              <Send size={16} />
              Gửi hồ sơ xét duyệt
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewSection({ section, readOnly, onStepChange }) {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950">
            {section.complete ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-amber-600" />}
            {section.title}
          </h3>
          <div className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-slate-600">
            {section.lines.map((line) => <p key={line}>{line}</p>)}
          </div>
          {!section.complete && <p className="mt-3 text-sm font-extrabold text-amber-700">{section.missingLabel}</p>}
        </div>
        {!readOnly && (
          <button type="button" onClick={() => section.externalUrl ? window.location.assign(section.externalUrl) : onStepChange(section.step)} className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary">
            <PencilLine size={15} />
            Chỉnh sửa
          </button>
        )}
      </div>
    </article>
  );
}

function DocumentPreview({ documents, viewingId, onView }) {
  if (documents.length === 0) return null;
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5">
      <h2 className="font-display text-xl font-extrabold text-slate-950">Tài liệu đã tải lên</h2>
      <div className="mt-4 grid gap-3">
        {documents.map((document) => (
          <div key={document.id} className="flex flex-col gap-3 rounded-[8px] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-sm font-extrabold text-slate-950">
              <FileText size={16} className="mr-2 inline text-primary" />
              {documentLabel(document.documentType)} · {document.title || document.originalFilename} · {statusLabel(document.verificationStatus)}{document.expired ? ' · Hết hạn' : ''}
            </p>
            <button type="button" onClick={() => onView(document)} disabled={Boolean(viewingId)} className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:opacity-60">
              {viewingId === document.id ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}
              Xem
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function calculateMissingItems(user, application, subjects, documents) {
  const missing = [];
  if (!user?.fullName) missing.push('accountFullName');
  if (!user?.email) missing.push('accountEmail');
  if (!user?.emailVerified) missing.push('emailVerified');
  if (!(user?.avatarUrl || user?.avatar || user?.publicAvatarUrl || user?.avatarKey)) missing.push('profilePhoto');
  if (!application?.educationLevel) missing.push('educationLevel');
  if (!application?.institution) missing.push('institution');
  if (!application?.experienceSummary) missing.push('experienceSummary');
  if (!application?.bio) missing.push('bio');
  if (!subjects.length) missing.push('teachingSubjects');
  if (!hasIdentityDocument(documents)) missing.push('identityDocument');
  if (!documents.some((document) => document.documentType === 'DEGREE' || (document.documentType === 'CERTIFICATE' && !document.expired))) missing.push('degreeOrCertificate');
  return missing;
}

function buildSections(user, application, subjects, documents, missingItems) {
  return [
    {
      id: 'account',
      title: 'Thông tin cá nhân',
      step: 0,
      externalUrl: '/profile',
      complete: !missingItems.some((item) => ['accountFullName', 'accountEmail', 'emailVerified', 'profilePhoto'].includes(item)),
      missingLabel: 'Cần hoàn thiện thông tin tài khoản, ảnh đại diện hoặc xác minh email.',
      lines: [
        user?.fullName || 'Chưa có họ tên',
        user?.email || 'Chưa có email',
        user?.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh',
        (user?.avatarUrl || user?.avatar || user?.publicAvatarUrl || user?.avatarKey) ? 'Đã có ảnh đại diện' : 'Chưa có ảnh đại diện'
      ]
    },
    {
      id: 'education',
      title: 'Học vấn & kinh nghiệm',
      step: 1,
      complete: !missingItems.some((item) => ['educationLevel', 'institution', 'experienceSummary'].includes(item)),
      missingLabel: 'Cần bổ sung trình độ, trường/cơ sở đào tạo và kinh nghiệm.',
      lines: [application?.educationLevel || 'Chưa có trình độ', application?.institution || 'Chưa có trường/cơ sở đào tạo', application?.major || 'Chưa có chuyên ngành', application?.experienceSummary || 'Chưa có tóm tắt kinh nghiệm']
    },
    {
      id: 'subjects',
      title: 'Môn học nhận dạy',
      step: 2,
      complete: !missingItems.some((item) => ['teachingSubjects', 'validTeachingSubjects'].includes(item)),
      missingLabel: 'Cần ít nhất một môn học hợp lệ.',
      lines: subjects.length ? subjects.map((item) => {
        const levels = item.levels?.length ? ` · ${item.levels.map((level) => levelLabels[level] || level).join(', ')}` : '';
        return `${item.subject?.name}${levels} · ${formatVnd(item.oneToOneHourlyRate)}/giờ · ${item.experienceYears ?? 0} năm kinh nghiệm`;
      }) : ['Chưa thêm môn học nào']
    },
    {
      id: 'intro',
      title: 'Giới thiệu',
      step: 3,
      complete: !missingItems.includes('bio'),
      missingLabel: 'Cần viết phần giới thiệu hồ sơ.',
      lines: [application?.bio || 'Chưa có giới thiệu']
    },
    {
      id: 'documents',
      title: 'Tài liệu xác minh',
      step: 4,
      complete: !missingItems.some((item) => ['identityDocument', 'degreeOrCertificate'].includes(item)),
      missingLabel: 'Cần giấy tờ danh tính và ít nhất một bằng cấp/chứng chỉ.',
      lines: [
        identitySummary(documents),
        `${documents.filter((document) => ['DEGREE', 'CERTIFICATE'].includes(document.documentType)).length} bằng cấp/chứng chỉ`,
        documents.some((document) => document.documentType === 'CERTIFICATE' && document.expired) ? 'Có chứng chỉ đã hết hạn' : 'Không có chứng chỉ hết hạn'
      ]
    }
  ];
}

function hasIdentityDocument(documents) {
  const types = new Set(documents.map((document) => document.documentType));
  return types.has('PASSPORT') || (types.has('IDENTITY_FRONT') && types.has('IDENTITY_BACK'));
}

function identitySummary(documents) {
  const types = new Set(documents.map((document) => document.documentType));
  if (types.has('PASSPORT')) return 'Đã có hộ chiếu';
  if (types.has('IDENTITY_FRONT') && types.has('IDENTITY_BACK')) return 'Đã có CCCD/CMND hai mặt';
  return 'Chưa đủ tài liệu danh tính';
}

function InfoCard({ tone, title, children }) {
  const styles = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    red: 'border-red-100 bg-red-50 text-red-800'
  };
  return <div className={`rounded-[8px] border p-4 text-sm font-semibold leading-6 ${styles[tone]}`}><p className="font-extrabold">{title}</p><div className="mt-1">{children}</div></div>;
}

function ReviewSkeleton() {
  return <div className="grid gap-4">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-[8px] bg-slate-100" />)}</div>;
}

function toFriendlyMessage(error, missingItems) {
  if (missingItems.length) return `Còn thiếu: ${missingItems.map(missingLabel).join(', ')}.`;
  if (error?.status === 409) return error.message || 'Hồ sơ hiện không thể gửi ở trạng thái này.';
  return error?.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.';
}

function missingLabel(item) {
  const labels = {
    accountFullName: 'họ tên',
    accountEmail: 'email',
    emailVerified: 'xác minh email',
    profilePhoto: 'ảnh đại diện',
    educationLevel: 'trình độ',
    institution: 'trường/cơ sở đào tạo',
    experienceSummary: 'kinh nghiệm',
    bio: 'giới thiệu',
    teachingSubjects: 'môn học',
    validTeachingSubjects: 'môn học hợp lệ',
    identityDocument: 'giấy tờ danh tính',
    degreeOrCertificate: 'bằng cấp/chứng chỉ'
  };
  return labels[item] || item;
}

function formatVnd(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};

function statusLabel(status) {
  if (status === 'VERIFIED') return 'Đã xác minh';
  if (status === 'REJECTED') return 'Bị từ chối';
  return 'Đang chờ xác minh';
}

function documentLabel(type) {
  const labels = {
    IDENTITY_FRONT: 'CCCD mặt trước',
    IDENTITY_BACK: 'CCCD mặt sau',
    PASSPORT: 'Hộ chiếu',
    DEGREE: 'Bằng cấp',
    CERTIFICATE: 'Chứng chỉ'
  };
  return labels[type] || type;
}
