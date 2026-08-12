import React, { useState } from "react";
import { Award, FileText, Plus, Trash2, Upload } from "lucide-react";
import { newClientId, SubjectEvidence } from "../tutorApplication";

interface Props {
  value: SubjectEvidence[];
  onChange: (value: SubjectEvidence[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ACCEPTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx", "xls", "xlsx"];
const MAX_EVIDENCES_PER_SUBJECT = 5;

export function EvidenceUploader({ value, onChange, disabled }: Props) {
  const [error, setError] = useState("");

  const update = (index: number, patch: Partial<SubjectEvidence>) =>
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const addForms = () => {
    setError("");
    if (value.length >= MAX_EVIDENCES_PER_SUBJECT) { setError(`Mỗi môn học chỉ được nộp tối đa ${MAX_EVIDENCES_PER_SUBJECT} minh chứng.`); return; }
    onChange([...value, { clientId: newClientId(), name: "", issuer: "", issueDate: "", expiryDate: null, description: "", fileKey: "", originalFileName: "", fileType: "", fileSize: 0, verificationStatus: "pending" }]);
  };

  const selectFile = (index: number, file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if ((!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.includes(extension || "")) || file.size > 5 * 1024 * 1024) { setError("Chỉ chấp nhận ảnh, PDF, Word hoặc Excel có dung lượng tối đa 5 MB."); return; }
    update(index, { uploadFile: file, originalFileName: file.name, fileType: file.type, fileSize: file.size, name: value[index].name || file.name.replace(/\.[^.]+$/, "") });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-variant/60">Chứng chỉ / bằng cấp cho môn học</h4>
          <p className="text-[10px] text-brand-text-variant/55 mt-1">Ảnh, PDF, Word hoặc Excel · tối đa 5 MB mỗi file.</p>
        </div>
        <button disabled={disabled || value.length >= MAX_EVIDENCES_PER_SUBJECT} type="button" onClick={addForms} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-secondary/30 text-brand-secondary text-xs font-bold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Thêm minh chứng
        </button>
      </div>
      <p className="text-[11px] text-brand-text-variant">Đã thêm {value.length}/{MAX_EVIDENCES_PER_SUBJECT} minh chứng cho môn học này.</p>

      {value.length === 0 && (
        <button disabled={disabled} type="button" onClick={addForms} className="w-full border-2 border-dashed border-brand-border/40 rounded-xl p-7 text-center hover:border-brand-secondary hover:bg-brand-secondary/5 disabled:opacity-50">
          <Upload className="w-7 h-7 mx-auto mb-2 text-brand-text-variant/35" />
          <span className="text-xs font-bold text-brand-text">Tải một hoặc nhiều chứng chỉ / bằng cấp</span>
        </button>
      )}

      {value.map((evidence, index) => (
        <div key={evidence._id || evidence.clientId || index} className="p-4 rounded-xl border border-brand-border/30 bg-brand-low/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-text">
              {evidence.fileType === "application/pdf" ? <FileText className="w-4 h-4 text-brand-primary" /> : <Award className="w-4 h-4 text-brand-secondary" />}
              {evidence.originalFileName || "Chưa chọn file"}
            </span>
            <div className="flex items-center gap-2">
              {evidence.verificationStatus && <StatusBadge status={evidence.verificationStatus} />}
              <button disabled={disabled} type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} className="p-1.5 text-brand-error hover:bg-brand-error/5 rounded-lg disabled:opacity-40" aria-label="Xóa chứng chỉ"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field-label">File minh chứng
              <input disabled={disabled} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx" onChange={e => selectFile(index, e.target.files?.[0])} className="field-control" />
            </label>
            <label className="field-label">Tên chứng chỉ / bằng cấp
              <input disabled={disabled} value={evidence.name} onChange={(e) => update(index, { name: e.target.value })} className="field-control" placeholder="IELTS Academic C1" />
            </label>
            <label className="field-label">Ngày cấp
              <input disabled={disabled} type="date" value={evidence.issueDate} onChange={(e) => update(index, { issueDate: e.target.value })} className="field-control" />
            </label>
            <label className="field-label flex items-center gap-2 pt-5">
              <input disabled={disabled} type="checkbox" checked={!!evidence.expiryDate} onChange={(e) => update(index, { expiryDate: e.target.checked ? new Date().toISOString().slice(0, 10) : null })} />
              Chứng chỉ có thời hạn
            </label>
          </div>
          <p className="text-[11px] text-brand-text-variant">{evidence.expiryDate ? "Loại: Có thời hạn" : "Loại: Không thời hạn"}</p>
          {evidence.expiryDate && <label className="field-label max-w-sm">Ngày hết hạn
            <input disabled={disabled} type="date" min={evidence.issueDate || undefined} value={evidence.expiryDate} onChange={(e) => update(index, { expiryDate: e.target.value || null })} className="field-control" />
          </label>}
          {evidence.adminNote && <p className="text-xs text-brand-error font-semibold">Ghi chú của quản trị viên: {evidence.adminNote}</p>}
        </div>
      ))}
      {error && <p className="text-xs font-semibold text-brand-error">{error}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style = status === "approved"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "rejected"
      ? "bg-red-50 text-red-700 border-red-200"
      : status === "withdrawn"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  const label = status === "pending" ? "Chờ duyệt" : status === "approved" ? "Đã duyệt" : status === "rejected" ? "Từ chối" : status === "withdrawn" ? "Đã rút" : status;
  return <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${style}`}>{label}</span>;
}
