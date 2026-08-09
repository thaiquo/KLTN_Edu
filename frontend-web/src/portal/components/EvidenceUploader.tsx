import React, { useRef, useState } from "react";
import { Award, FileText, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { newClientId, SubjectEvidence } from "../tutorApplication";

interface Props {
  value: SubjectEvidence[];
  onChange: (value: SubjectEvidence[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function EvidenceUploader({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const update = (index: number, patch: Partial<SubjectEvidence>) =>
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const selected = Array.from(files);
    const invalid = selected.find((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setError("Only PDF, PNG or JPG files up to 5 MB are accepted.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(selected.map(async (file) => ({
        file,
        result: await tutorApplicationApi.uploadEvidence(file)
      })));
      onChange([...value, ...uploaded.map(({ file, result }) => ({
        clientId: newClientId(),
        name: file.name.replace(/\.[^.]+$/, ""),
        issuer: "",
        issueDate: "",
        expiryDate: null,
        description: "",
        fileKey: result.fileKey,
        originalFileName: result.originalFileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        category: result.category,
        verificationStatus: "pending" as const
      }))]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the evidence.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-variant/60">Certificates / Evidence for this subject</h4>
          <p className="text-[10px] text-brand-text-variant/55 mt-1">PDF, PNG or JPG · maximum 5 MB per file.</p>
        </div>
        <button disabled={disabled || uploading} type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-secondary/30 text-brand-secondary text-xs font-bold disabled:opacity-40">
          {uploading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add evidence
        </button>
        <input ref={inputRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => uploadFiles(event.target.files)} />
      </div>

      {value.length === 0 && (
        <button disabled={disabled || uploading} type="button" onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-brand-border/40 rounded-xl p-7 text-center hover:border-brand-secondary hover:bg-brand-secondary/5 disabled:opacity-50">
          <Upload className="w-7 h-7 mx-auto mb-2 text-brand-text-variant/35" />
          <span className="text-xs font-bold text-brand-text">Upload evidence for this subject</span>
        </button>
      )}

      {value.map((evidence, index) => (
        <div key={evidence._id || evidence.clientId || index} className="p-4 rounded-xl border border-brand-border/30 bg-brand-low/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-text">
              {evidence.fileType === "application/pdf" ? <FileText className="w-4 h-4 text-brand-primary" /> : <Award className="w-4 h-4 text-brand-secondary" />}
              {evidence.originalFileName}
            </span>
            <div className="flex items-center gap-2">
              {evidence.verificationStatus && <StatusBadge status={evidence.verificationStatus} />}
              <button disabled={disabled} type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} className="p-1.5 text-brand-error hover:bg-brand-error/5 rounded-lg disabled:opacity-40" aria-label="Remove evidence"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field-label">Certificate / evidence name
              <input disabled={disabled} value={evidence.name} onChange={(e) => update(index, { name: e.target.value })} className="field-control" placeholder="IELTS Academic C1" />
            </label>
            <label className="field-label">Issuer
              <input disabled={disabled} value={evidence.issuer} onChange={(e) => update(index, { issuer: e.target.value })} className="field-control" placeholder="British Council" />
            </label>
            <label className="field-label">Issue date
              <input disabled={disabled} type="date" value={evidence.issueDate} onChange={(e) => update(index, { issueDate: e.target.value })} className="field-control" />
            </label>
            <label className="field-label">Expiry date (optional)
              <input disabled={disabled} type="date" value={evidence.expiryDate || ""} onChange={(e) => update(index, { expiryDate: e.target.value || null })} className="field-control" />
            </label>
          </div>
          <label className="field-label">Description (optional)
            <textarea disabled={disabled} value={evidence.description} onChange={(e) => update(index, { description: e.target.value })} className="field-control resize-none" rows={2} />
          </label>
          {evidence.adminNote && <p className="text-xs text-brand-error font-semibold">Admin note: {evidence.adminNote}</p>}
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
  return <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${style}`}>{status === "pending" ? "Pending review" : status}</span>;
}
