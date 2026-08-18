import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Award, Eye, FileCheck2, FileText, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { tutorApplicationApi } from '../../../api/tutorApplications';

const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];
const MAX_IDENTITY_SIZE = 5 * 1024 * 1024;
const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024;
const EVIDENCE_DOCUMENT_TYPES = ['DEGREE', 'CERTIFICATE', 'WORK_EXPERIENCE', 'PORTFOLIO', 'OTHER'];

export function VerificationDocumentsStep({ application, readOnly }) {
  const [documents, setDocuments] = useState([]);
  const [identityMode, setIdentityMode] = useState('CCCD');
  const [credentialType, setCredentialType] = useState('DEGREE');
  const [credentialForm, setCredentialForm] = useState(defaultCredentialForm('DEGREE'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingType, setUploadingType] = useState('');
  const [busyId, setBusyId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);
  const pendingUploadRef = useRef(null);

  const editable = !readOnly && EDITABLE_STATUSES.includes(application?.status);
  const byType = useMemo(() => groupByType(documents), [documents]);
  const credentials = documents.filter((document) => EVIDENCE_DOCUMENT_TYPES.includes(document.documentType));
  const identityOptions = identityMode === 'PASSPORT'
    ? [{ type: 'PASSPORT', label: 'Trang thông tin hộ chiếu', accept: 'image/jpeg,image/png' }]
    : [
        { type: 'IDENTITY_FRONT', label: 'CCCD / CMND mặt trước', accept: 'image/jpeg,image/png' },
        { type: 'IDENTITY_BACK', label: 'CCCD / CMND mặt sau', accept: 'image/jpeg,image/png' }
      ];

  useEffect(() => {
    let active = true;
    async function loadDocuments() {
      setLoading(true);
      setError('');
      try {
        const response = await tutorApplicationApi.getMyApplicationDocuments();
        if (active) setDocuments(Array.isArray(response) ? response : []);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Không thể tải tài liệu xác minh.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDocuments();
    return () => {
      active = false;
    };
  }, []);

  function chooseIdentityFile(option) {
    pendingUploadRef.current = { documentType: option.type, metadata: {}, accept: option.accept };
    openFileInput(option.accept);
  }

  function chooseCredentialFile(event) {
    event.preventDefault();
    const metadata = normalizeCredentialMetadata(credentialType, credentialForm);
    const validationError = validateCredentialMetadata(credentialType, metadata);
    if (validationError) {
      setError(validationError);
      return;
    }
    pendingUploadRef.current = {
      documentType: credentialType,
      metadata,
      accept: 'image/jpeg,image/png,application/pdf'
    };
    openFileInput('image/jpeg,image/png,application/pdf');
  }

  function openFileInput(accept) {
    if (!editable || uploadingType || !fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }

  async function uploadSelectedFile(event) {
    const file = event.target.files?.[0];
    const upload = pendingUploadRef.current;
    if (!file || !upload) return;

    const uploadFile = normalizeUploadFile(file);
    const validationError = validateFile(upload.documentType, uploadFile);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setUploadingType(upload.documentType);
    setError('');
    setSuccess('');

    try {
      await tutorApplicationApi.uploadApplicationDocument({
        documentType: upload.documentType,
        file: uploadFile,
        metadata: upload.metadata
      });
      const response = await tutorApplicationApi.getMyApplicationDocuments();
      setDocuments(Array.isArray(response) ? response : []);
      setSuccess('Tài liệu đã được tải lên và đang chờ xác minh.');
      if (EVIDENCE_DOCUMENT_TYPES.includes(upload.documentType)) {
        setCredentialForm(defaultCredentialForm(credentialType));
      }
    } catch (uploadError) {
      setError(toFriendlyMessage(uploadError));
    } finally {
      setUploadingType('');
      pendingUploadRef.current = null;
      event.target.value = '';
    }
  }

  async function viewDocument(document) {
    setBusyId(`view-${document.id}`);
    setError('');
    try {
      const response = await tutorApplicationApi.getApplicationDocumentDownloadUrl(document.id);
      if (response?.url) window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch (viewError) {
      setError(toFriendlyMessage(viewError));
    } finally {
      setBusyId('');
    }
  }

  async function deleteDocument() {
    if (!deleteTarget) return;
    setBusyId(`delete-${deleteTarget.id}`);
    setError('');
    setSuccess('');
    try {
      await tutorApplicationApi.deleteApplicationDocument(deleteTarget.id);
      setDocuments((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSuccess('Tài liệu đã được xóa.');
    } catch (deleteError) {
      setError(toFriendlyMessage(deleteError));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
          <FileCheck2 size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Bước 5</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            Tài liệu xác minh
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
            CCCD/hộ chiếu được lưu một lần cho hồ sơ gia sư và dùng lại cho các lần đăng ký môn sau. Bạn có thể bổ sung nhiều minh chứng chuyên môn để chọn lại khi đăng ký từng môn dạy.
          </p>
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={uploadSelectedFile} />

      <div className="mt-7 grid gap-6">
        {!editable && (
          <InfoCard tone="slate" title="Chế độ chỉ đọc">
            Hồ sơ đang ở trạng thái {application?.status}. Bạn vẫn có thể xem tài liệu, nhưng chưa thể tải lên hoặc xóa.
          </InfoCard>
        )}
        {success && <InfoCard tone="green" title={success}>Danh sách tài liệu đã được đồng bộ từ backend.</InfoCard>}
        {error && <InfoCard tone="red" title="Thao tác tài liệu không thành công">{error}</InfoCard>}

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
          <SectionTitle icon={<ShieldCheck size={20} />} title="Xác minh danh tính dùng chung" description="Bạn chỉ cần lưu CCCD/CMND hai mặt hoặc hộ chiếu một lần. Hệ thống sẽ tái sử dụng cho các đăng ký dạy tiếp theo." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { id: 'CCCD', title: 'CCCD / CMND', description: 'Yêu cầu mặt trước và mặt sau.' },
              { id: 'PASSPORT', title: 'Hộ chiếu', description: 'Chỉ cần trang thông tin hộ chiếu.' }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setIdentityMode(option.id)}
                className={`rounded-[8px] border p-4 text-left ${identityMode === option.id ? 'border-[#147b77] bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
              >
                <span className="block text-sm font-extrabold text-slate-950">{option.title}</span>
                <span className="mt-1 block text-xs font-bold text-slate-500">{option.description}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3">
            {identityOptions.map((option) => (
              <UploadSlot
                key={option.type}
                option={option}
                document={byType[option.type]?.[0]}
                editable={editable}
                uploading={uploadingType === option.type}
                busyId={busyId}
                onUpload={() => chooseIdentityFile(option)}
                onView={viewDocument}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
          <SectionTitle icon={<Award size={20} />} title="Minh chứng chuyên môn" description="Bằng cấp, chứng chỉ, xác nhận kinh nghiệm giảng dạy, portfolio hoặc minh chứng khác. PDF/JPG/PNG, tối đa 10MB mỗi file." />

          {editable && (
            <form onSubmit={chooseCredentialFile} className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                {EVIDENCE_DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setCredentialType(type);
                      setCredentialForm(defaultCredentialForm(type));
                    }}
                    className={`rounded-full border px-3 py-2 text-xs font-extrabold ${credentialType === type ? 'border-[#147b77] bg-[#147b77] text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    {documentLabel(type)}
                  </button>
                ))}
              </div>
              <CredentialFields type={credentialType} form={credentialForm} setForm={setCredentialForm} />
              <button type="submit" disabled={Boolean(uploadingType)} className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60">
                {uploadingType === credentialType ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                Chọn file và tải lên
              </button>
            </form>
          )}

          {loading ? (
            <DocumentSkeleton />
          ) : credentials.length === 0 ? (
            <div className="mt-5 rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Bạn chưa tải lên minh chứng chuyên môn nào. Mỗi đăng ký dạy cần chọn tối thiểu 1 và tối đa 5 minh chứng liên quan.
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {credentials.map((document) => (
                <DocumentRow key={document.id} document={document} editable={editable} busyId={busyId} onView={viewDocument} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </section>

        {deleteTarget && (
          <div className="rounded-[8px] border border-red-100 bg-red-50 p-5 text-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-extrabold">Xóa tài liệu {deleteTarget.originalFilename}?</h3>
                <p className="mt-2 text-sm font-semibold leading-6">Metadata và file trên S3 sẽ được xóa nếu storage thao tác thành công.</p>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(busyId)} className="rounded-[8px] border border-red-200 bg-white px-4 py-3 text-sm font-extrabold text-red-800 disabled:opacity-60">Hủy</button>
                  <button type="button" onClick={deleteDocument} disabled={Boolean(busyId)} className="rounded-[8px] bg-red-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-800 disabled:opacity-60">
                    {busyId === `delete-${deleteTarget.id}` ? 'Đang xóa...' : 'Xóa tài liệu'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CredentialFields({ type, form, setForm }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="field">
        <span>{titleFieldLabel(type)}</span>
        <div><input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder={titlePlaceholder(type)} /></div>
      </label>
      <label className="field">
        <span>{issuerFieldLabel(type)}</span>
        <div><input value={form.issuer} onChange={(e) => setForm((c) => ({ ...c, issuer: e.target.value }))} placeholder="IUH, British Council, trung tâm ABC..." /></div>
      </label>
      <label className="field">
        <span>{type === 'WORK_EXPERIENCE' ? 'Ngày xác nhận / ngày bắt đầu' : 'Ngày cấp / ngày tạo'}</span>
        <div><input type="date" value={form.issueDate} onChange={(e) => setForm((c) => ({ ...c, issueDate: e.target.value }))} /></div>
      </label>
      {type === 'CERTIFICATE' && (
        <label className="field">
          <span>Hiệu lực</span>
          <div>
            <select value={form.validityType} onChange={(e) => setForm((c) => ({ ...c, validityType: e.target.value, expiryDate: e.target.value === 'DOES_NOT_EXPIRE' ? '' : c.expiryDate }))}>
              <option value="EXPIRES">Có thời hạn</option>
              <option value="DOES_NOT_EXPIRE">Không thời hạn</option>
            </select>
          </div>
        </label>
      )}
      {type === 'CERTIFICATE' && form.validityType === 'EXPIRES' && (
        <label className="field">
          <span>Ngày hết hạn</span>
          <div><input type="date" value={form.expiryDate} onChange={(e) => setForm((c) => ({ ...c, expiryDate: e.target.value }))} /></div>
        </label>
      )}
      <label className="field">
        <span>Mã chứng chỉ / số hiệu</span>
        <div><input value={form.credentialNumber} onChange={(e) => setForm((c) => ({ ...c, credentialNumber: e.target.value }))} placeholder="Optional" /></div>
      </label>
    </div>
  );
}

function SectionTitle({ icon, title, description }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-slate-950">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function UploadSlot({ option, document, editable, uploading, busyId, onUpload, onView, onDelete }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-extrabold text-slate-950">{option.label}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {document ? `${document.originalFilename} · ${formatSize(document.fileSize)} · ${statusLabel(document.verificationStatus)}` : 'Chưa tải lên'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {document && <DocumentActions document={document} editable={editable} busyId={busyId} onView={onView} onDelete={onDelete} />}
        {editable && (
          <button type="button" onClick={onUpload} disabled={uploading || Boolean(busyId)} className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:opacity-60">
            {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
            {document ? 'Thay file' : 'Tải lên'}
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentRow({ document, editable, busyId, onView, onDelete }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-slate-950">
          {document.title || document.originalFilename}
          {document.expired && <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-[10px] text-red-700">Hết hạn</span>}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {documentLabel(document.documentType)} · {document.issuer || 'Chưa có đơn vị cấp'} · {formatDate(document.issueDate)} · {formatValidity(document)}
        </p>
        <p className="mt-1 truncate text-xs font-bold text-slate-400">
          {document.originalFilename} · {formatContentType(document.contentType)} · {formatSize(document.fileSize)} · {statusLabel(document.verificationStatus)}
        </p>
      </div>
      <DocumentActions document={document} editable={editable} busyId={busyId} onView={onView} onDelete={onDelete} />
    </div>
  );
}

function DocumentActions({ document, editable, busyId, onView, onDelete }) {
  return (
    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={() => onView(document)} disabled={Boolean(busyId)} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:opacity-60">
        {busyId === `view-${document.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}
        Xem
      </button>
      {editable && (
        <button type="button" onClick={() => onDelete(document)} disabled={Boolean(busyId)} className="inline-flex items-center gap-2 rounded-[8px] border border-red-100 bg-red-50 px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-60">
          <Trash2 size={15} />
          Xóa
        </button>
      )}
    </div>
  );
}

function InfoCard({ tone, title, children }) {
  const styles = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    red: 'border-red-100 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700'
  };
  return <div className={`rounded-[8px] border p-4 text-sm font-semibold leading-6 ${styles[tone]}`}><p className="font-extrabold">{title}</p><div className="mt-1">{children}</div></div>;
}

function DocumentSkeleton() {
  return <div className="mt-5 h-20 animate-pulse rounded-[8px] bg-slate-100" />;
}

function groupByType(documents) {
  return documents.reduce((acc, document) => {
    acc[document.documentType] = [...(acc[document.documentType] || []), document];
    return acc;
  }, {});
}

function defaultCredentialForm(type) {
  return {
    title: '',
    issuer: '',
    issueDate: '',
    validityType: type === 'CERTIFICATE' ? 'EXPIRES' : 'DOES_NOT_EXPIRE',
    expiryDate: '',
    credentialNumber: ''
  };
}

function normalizeCredentialMetadata(type, form) {
  return {
    title: form.title.trim(),
    issuer: form.issuer.trim(),
    issueDate: form.issueDate,
    validityType: type === 'CERTIFICATE' ? form.validityType : 'DOES_NOT_EXPIRE',
    expiryDate: form.validityType === 'EXPIRES' ? form.expiryDate : '',
    credentialNumber: form.credentialNumber.trim()
  };
}

function validateCredentialMetadata(type, metadata) {
  if (!metadata.title) return `Vui lòng nhập ${titleFieldLabel(type).toLowerCase()}.`;
  if (!metadata.issuer) return `Vui lòng nhập ${issuerFieldLabel(type).toLowerCase()}.`;
  if (!metadata.issueDate) return 'Vui lòng chọn ngày cấp hoặc ngày xác nhận.';
  if (type === 'CERTIFICATE' && metadata.validityType === 'EXPIRES' && !metadata.expiryDate) return 'Vui lòng chọn ngày hết hạn.';
  return '';
}

function validateFile(type, file) {
  const identity = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(type);
  const allowedTypes = identity ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = identity ? MAX_IDENTITY_SIZE : MAX_CERTIFICATE_SIZE;
  if (!allowedTypes.includes(file.type)) return 'Định dạng file không phù hợp với loại tài liệu.';
  if (file.size > maxSize) return `File vượt quá giới hạn ${identity ? '5MB' : '10MB'}.`;
  return '';
}

function normalizeUploadFile(file) {
  if (file.type) return file;
  const inferredType = inferContentType(file.name);
  return inferredType ? new File([file], file.name, { type: inferredType }) : file;
}

function inferContentType(filename = '') {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return '';
}

function toFriendlyMessage(error) {
  if (error?.status === 409) return error.message || 'Hồ sơ hiện không cho phép thao tác tài liệu.';
  if (error?.status === 400) return error.message || 'File hoặc metadata không hợp lệ.';
  if (error?.status === 404) return error.message || 'Không tìm thấy tài liệu.';
  return error?.message || 'Thao tác tài liệu không thành công.';
}

function formatSize(size) {
  const value = Number(size || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function formatContentType(contentType) {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType === 'image/png') return 'PNG';
  if (contentType === 'image/jpeg') return 'JPG';
  return contentType || 'File';
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật ngày cấp';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

function formatValidity(document) {
  if (document.validityType === 'DOES_NOT_EXPIRE') return 'Không thời hạn';
  if (document.expiryDate) return `Hết hạn ${formatDate(document.expiryDate)}`;
  return 'Có thời hạn';
}

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
    CERTIFICATE: 'Chứng chỉ',
    WORK_EXPERIENCE: 'Minh chứng kinh nghiệm',
    PORTFOLIO: 'Portfolio',
    OTHER: 'Minh chứng khác'
  };
  return labels[type] || type;
}

function titleFieldLabel(type) {
  const labels = {
    DEGREE: 'Tên bằng cấp',
    CERTIFICATE: 'Tên chứng chỉ',
    WORK_EXPERIENCE: 'Tên minh chứng kinh nghiệm',
    PORTFOLIO: 'Tên portfolio',
    OTHER: 'Tên minh chứng'
  };
  return labels[type] || 'Tên minh chứng';
}

function issuerFieldLabel(type) {
  const labels = {
    DEGREE: 'Trường / đơn vị cấp',
    CERTIFICATE: 'Đơn vị cấp chứng chỉ',
    WORK_EXPERIENCE: 'Trường / trung tâm / đơn vị xác nhận',
    PORTFOLIO: 'Đơn vị / nguồn portfolio',
    OTHER: 'Đơn vị / nguồn xác nhận'
  };
  return labels[type] || 'Đơn vị / nguồn xác nhận';
}

function titlePlaceholder(type) {
  const placeholders = {
    DEGREE: 'Cử nhân Sư phạm Tiếng Anh',
    CERTIFICATE: 'IELTS Academic 7.5',
    WORK_EXPERIENCE: 'Xác nhận giảng dạy tại Trung tâm ABC',
    PORTFOLIO: 'Portfolio lớp đã dạy / dự án học viên',
    OTHER: 'Minh chứng chuyên môn khác'
  };
  return placeholders[type] || 'Minh chứng chuyên môn';
}
