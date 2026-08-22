import { useRef, useState } from 'react';
import { ArrowLeft, FileText, LoaderCircle, Send, Trash2, Upload } from 'lucide-react';

const EVIDENCE_TYPES = ['DEGREE', 'CERTIFICATE', 'WORK_EXPERIENCE', 'PORTFOLIO', 'OTHER'];
const ACCEPTED_EVIDENCE = '.doc,.docx,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.gif,.webp';

export function TeachingRegistrationDetailsStep({
  form,
  selected,
  stagedDocuments,
  busy,
  onChange,
  onUpsertStaged,
  onRemoveStaged,
  onBack,
  onSubmit
}) {
  const evidenceDrafts = stagedDocuments.filter((item) => EVIDENCE_TYPES.includes(item.documentType));
  const readyEvidenceCount = evidenceDrafts.filter((item) => item.file).length;
  const allDraftsReady = evidenceDrafts.every((item) => item.file);
  const canSubmit = allDraftsReady && readyEvidenceCount >= 1 && readyEvidenceCount <= 5;

  function addEvidence() {
    if (evidenceDrafts.length >= 5) return;
    const id = `local-evidence-${Date.now()}`;
    onUpsertStaged({ id, documentType: 'OTHER', title: '', issueDate: '', validityType: 'DOES_NOT_EXPIRE', expiryDate: '', file: null });
  }

  return (
    <form onSubmit={onSubmit}>
      <section className="mt-5 rounded-[8px] border border-emerald-100 bg-emerald-50 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#147b77]">Quyền dạy đang đăng ký</p>
        <p className="mt-2 font-display text-xl font-extrabold text-slate-950">
          {form.isProposal ? `${form.proposedSubjectName} (Đề xuất mới)` : selected.subject?.name}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {form.isProposal ? (
            (form.proposedLevels?.length ? form.proposedLevels.map((level) => level.name) : form.proposedLevelNames?.length ? form.proposedLevelNames : String(form.proposedLevelName || '').split(',').map((name) => name.trim()).filter(Boolean)).map((name) => (
              <span key={name} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#147b77]">{name}</span>
            ))
          ) : (
            selected.levels.map((level) => <span key={level.id} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#147b77]">{level.name}</span>)
          )}
        </div>
      </section>
 
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <Field label="Số năm kinh nghiệm" type="number" min="0" name="experienceYears" value={form.experienceYears} onChange={onChange} />
        <Field label="Học phí tối thiểu (đ/buổi)" type="number" min="1" name="tuitionMin" value={form.tuitionMin} onChange={onChange} />
        <Field label="Học phí tối đa (đ/buổi)" type="number" min="1" name="tuitionMax" value={form.tuitionMax} onChange={onChange} />
      </div>
      <label className="field mt-5 block"><span>Mô tả năng lực giảng dạy</span><div><textarea required name="description" value={form.description} onChange={onChange} rows={4} maxLength={1500} /></div></label>
 
      <section className="mt-7 rounded-[8px] border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950"><FileText size={20} className="text-primary" /> Minh chứng chuyên môn</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">Mỗi minh chứng nằm trong một form riêng. File chỉ được giữ tạm và chưa tải lên S3.</p>
          </div>
          <button type="button" onClick={addEvidence} disabled={evidenceDrafts.length >= 5} className="rounded-[8px] border border-[#147b77] px-3 py-2 text-sm font-extrabold text-[#147b77] disabled:opacity-40">+ Thêm minh chứng</button>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">Đã thêm {evidenceDrafts.length}/5 form · {readyEvidenceCount} file sẵn sàng</p>
 
        <div className="mt-4 grid gap-4">
          {evidenceDrafts.map((draft, index) => (
            <EvidenceDraftForm key={draft.id} index={index} draft={draft} onChange={(patch) => onUpsertStaged({ ...draft, ...patch })} onRemove={() => onRemoveStaged(draft.id)} />
          ))}
          {evidenceDrafts.length === 0 && <div className="rounded-[8px] border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">Bấm “+ Thêm minh chứng” để tạo form đầu tiên. Cần ít nhất 1 và tối đa 5 minh chứng.</div>}
        </div>
      </section>
 
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500"><ArrowLeft size={16} /> Quay lại</button>
        <button disabled={busy || !canSubmit} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">
          {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} Gửi {form.isProposal ? (form.proposedLevels?.length || form.proposedLevelNames?.length || 1) : form.levelIds.length} quyền dạy
        </button>
      </div>
    </form>
  );
}

function EvidenceDraftForm({ index, draft, onChange, onRemove }) {
  const inputRef = useRef(null);
  return <article className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Minh chứng {index + 1}</p><button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-extrabold text-red-600"><Trash2 size={14} /> Xóa form</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="field sm:col-span-2"><span>File minh chứng</span><div className="flex items-center gap-3"><input className="hidden" ref={inputRef} type="file" accept={ACCEPTED_EVIDENCE} onChange={(event) => { const file = event.target.files?.[0]; if (file) onChange({ file, originalFilename: file.name, title: draft.title || file.name.replace(/\.[^/.]+$/, '') }); event.target.value = ''; }} /><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700"><Upload size={15} /> {draft.file ? 'Thay file' : 'Chọn file'}</button><span className={`min-w-0 truncate text-xs font-bold ${draft.file ? 'text-emerald-700' : 'text-slate-400'}`}>{draft.file ? `${draft.file.name} · Đã chọn, chưa tải lên` : 'Chưa chọn file'}</span></div></label><Field label="Tên minh chứng" value={draft.title || ''} onChange={(event) => onChange({ title: event.target.value })} placeholder="Tự điền theo tên file và có thể sửa" /><Field label="Ngày cấp (không bắt buộc)" type="date" value={draft.issueDate || ''} onChange={(event) => onChange({ issueDate: event.target.value })} /><label className="field"><span>Thời hạn</span><div><select value={draft.validityType || 'DOES_NOT_EXPIRE'} onChange={(event) => onChange({ validityType: event.target.value, expiryDate: event.target.value === 'DOES_NOT_EXPIRE' ? '' : draft.expiryDate })}><option value="DOES_NOT_EXPIRE">Không thời hạn</option><option value="EXPIRES">Có thời hạn</option></select></div></label>{draft.validityType === 'EXPIRES' && <Field label="Ngày hết hạn" type="date" value={draft.expiryDate || ''} onChange={(event) => onChange({ expiryDate: event.target.value })} />}</div></article>;
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><div><input required={false} {...props} /></div></label>;
}
