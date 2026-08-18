import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  PlusCircle,
  X,
} from "lucide-react";
import { staffTutorsApi } from "../../../api/staffTutors";
import { catalogSuggestionApi, teachingRegistrationApi } from "../../../api/teachingRegistrations";

const PREVIEW_SIZE_LIMIT = 15 * 1024 * 1024;

type ReviewKind = "registration" | "suggestion";

export function TeachingRegistrationReview({
  onNotice,
  onError,
  onPendingCountChange,
  onActionSuccess,
}: {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onPendingCountChange?: (count: number) => void;
  onActionSuccess?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ReviewKind>("registration");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ kind: ReviewKind; item: any }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const items = await teachingRegistrationApi.adminPending();
      const list = Array.isArray(items) ? items : [];

      const standard = list.filter((item: any) => item.subject !== null);
      const proposed = list.filter((item: any) => item.subject === null);

      setRegistrations(standard);
      setSuggestions(proposed);
      onPendingCountChange?.(list.length);
    } catch (error: any) {
      onError(error?.message || "Không thể tải hàng chờ duyệt quyền dạy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approveRegistration(item: any, note: string) {
    setBusy(true);
    try {
      await teachingRegistrationApi.approve(item.id, note);

      if (item.subject !== null) {
        setRegistrations((current) => current.filter((value) => value.id !== item.id));
      } else {
        setSuggestions((current) => current.filter((value) => value.id !== item.id));
      }

      onPendingCountChange?.(registrations.length + suggestions.length - 1);
      setSelected(undefined);
      onNotice(!item.subject
        ? "Đã duyệt đề xuất. Môn học mới đã được thêm vào danh mục và hồ sơ dạy của gia sư đã được duyệt."
        : "Đã duyệt quyền dạy. Gia sư có thể dùng môn và các lớp này khi tạo lớp.");
      onActionSuccess?.();
    } catch (error: any) {
      onError(error?.message || "Không thể duyệt đăng ký dạy.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectRegistration(item: any, reason: string) {
    if (!reason.trim()) {
      onError("Vui lòng nhập lý do từ chối.");
      return;
    }
    setBusy(true);
    try {
      await teachingRegistrationApi.reject(item.id, reason.trim());

      if (item.subject !== null) {
        setRegistrations((current) => current.filter((value) => value.id !== item.id));
      } else {
        setSuggestions((current) => current.filter((value) => value.id !== item.id));
      }

      onPendingCountChange?.(registrations.length + suggestions.length - 1);
      setSelected(undefined);
      onNotice("Đã từ chối đăng ký dạy.");
      onActionSuccess?.();
    } catch (error: any) {
      onError(error?.message || "Không thể từ chối đăng ký dạy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 border border-[#d7dde6] bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-[#e4e8ee] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff695f]">Teaching approval queue</p>
          <h2 className="mt-1 font-display text-xl font-black text-[#073554]">Hàng chờ duyệt quyền dạy</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Môn có sẵn được duyệt trực tiếp. Môn nhập tay phải được bổ sung vào danh mục trước.</p>
        </div>
        <button type="button" onClick={load} className="w-fit border border-[#d7dde6] px-3 py-2 text-xs font-black text-slate-600 hover:border-[#147b77]">Tải lại</button>
      </header>

      <div className="flex gap-2 border-b border-[#e4e8ee] px-5 pt-4">
        <QueueTab active={activeTab === "registration"} onClick={() => setActiveTab("registration")} label="Hồ sơ quyền dạy" count={registrations.length} />
        <QueueTab active={activeTab === "suggestion"} onClick={() => setActiveTab("suggestion")} label="Đề xuất môn mới" count={suggestions.length} warning />
      </div>

      {loading ? (
        <div className="m-5 h-36 animate-pulse bg-slate-100" />
      ) : activeTab === "registration" ? (
        <RegistrationQueue items={registrations} onSelect={(item) => setSelected({ kind: "registration", item })} />
      ) : (
        <RegistrationQueue items={suggestions} onSelect={(item) => setSelected({ kind: "registration", item })} />
      )}

      {selected?.kind === "registration" && (
        <RegistrationDetailModal
          item={selected.item}
          busy={busy}
          onClose={() => setSelected(undefined)}
          onApprove={(note) => approveRegistration(selected.item, note)}
          onReject={(reason) => rejectRegistration(selected.item, reason)}
          onError={onError}
        />
      )}
    </section>
  );
}

function QueueTab({ active, label, count, warning, onClick }: any) {
  return (
    <button type="button" onClick={onClick} className={`border-b-2 px-3 pb-3 text-xs font-black ${active ? "border-[#147b77] text-[#073554]" : "border-transparent text-slate-400"}`}>
      {label} <span className={`ml-1 px-2 py-0.5 ${warning ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{count}</span>
    </button>
  );
}

function RegistrationQueue({ items, onSelect }: { items: any[]; onSelect: (item: any) => void }) {
  if (!items.length) return <EmptyQueue text="Không có hồ sơ quyền dạy đang chờ duyệt." />;
  return (
    <div className="divide-y divide-[#edf0f4]">
      {items.map((item) => {
        const isProposal = !item.subject;
        return (
          <article key={item.id} className={`grid gap-4 p-5 hover:bg-[#f9fbfd] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center ${isProposal ? "bg-amber-50/10" : ""}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-black text-[#073554]">
                  {isProposal ? `${item.proposedSubjectName} (Đề xuất mới)` : item.subject?.name}
                </h3>
                {isProposal ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-700">Môn đề xuất</span>
                ) : (
                  <StatusBadge />
                )}
              </div>
              <p className="mt-1 truncate text-xs font-bold text-slate-500">{item.tutorEmail}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {item.category?.name} · {isProposal ? item.proposedLevelName : (item.levels || []).map((level: any) => level.name).join(", ")}
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              <p className="font-black text-[#073554]">{formatCurrency(item.tuitionMin)} - {formatCurrency(item.tuitionMax)}/buổi</p>
              <p className="mt-1">{item.experienceYears || 0} năm kinh nghiệm · {item.evidence?.length || 0} minh chứng</p>
              <p className="mt-1">Nộp {formatDateTime(item.submittedAt)}</p>
            </div>
            <button type="button" onClick={() => onSelect(item)} className="inline-flex w-fit items-center gap-2 border border-[#073554] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#073554] hover:bg-[#073554] hover:text-white">
              <Eye className="h-3.5 w-3.5" /> Xem chi tiết
            </button>
          </article>
        );
      })}
    </div>
  );
}

function RegistrationDetailModal({ item, busy, onClose, onApprove, onReject, onError }: any) {
  const [note, setNote] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const isProposal = !item.subject;
  return (
    <Modal title={isProposal ? "Chi tiết đề xuất môn và hồ sơ dạy" : "Chi tiết hồ sơ quyền dạy"} subtitle={item.tutorEmail} onClose={onClose}>
      <div className="flex items-center justify-between bg-[#f7f9fc] p-3 text-xs font-bold text-[#073554]">
        <span>Nộp lúc {formatDateTime(item.submittedAt)}</span>
        {isProposal ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Môn đề xuất</span>
        ) : (
          <StatusBadge />
        )}
      </div>

      {isProposal && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/40 p-4 text-xs font-semibold text-amber-800 leading-5">
          👉 **Môn học này do gia sư đề xuất thêm mới.** Khi bạn bấm **Duyệt**, hệ thống sẽ tự động tạo môn học <strong>{item.proposedSubjectName}</strong> và trình độ <strong>{item.proposedLevelName}</strong> trong danh mục, đồng thời phê duyệt luôn quyền giảng dạy môn học này cho gia sư.
        </div>
      )}

      <section className="mt-4 rounded-xl border border-[#073554] p-4">
        <h3 className="font-display text-base font-black text-[#073554]">
          {isProposal ? item.proposedSubjectName : item.subject?.name}
        </h3>
        <DetailRow label="Chương trình" value={[item.programType?.name, item.educationLevel?.name, item.category?.name].filter(Boolean).join(" / ")} />
        <DetailRow label="Lớp / trình độ" value={isProposal ? item.proposedLevelName : (item.levels || []).map((level: any) => level.name).join(", ")} />
        {isProposal && <DetailRow label="Loại trình độ đề xuất" value={item.proposedLevelType || "--"} />}
        {isProposal && item.proposedNote && <DetailRow label="Ghi chú đề xuất của gia sư" value={item.proposedNote} />}
        <DetailRow label="Học phí" value={`${formatCurrency(item.tuitionMin)} - ${formatCurrency(item.tuitionMax)}/buổi`} />
        <DetailRow label="Kinh nghiệm" value={`${item.experienceYears || 0} năm`} />
        <DetailRow label="Mô tả năng lực" value={item.description || "--"} />
        <div className="mt-4">
          <p className="text-xs font-black text-[#073554]">Minh chứng ({item.evidence?.length || 0})</p>
          <div className="mt-2 space-y-2">
            {(item.evidence || []).map((evidence: any) => <EvidenceItem key={evidence.id} evidence={evidence} onError={onError} />)}
          </div>
        </div>
      </section>
      <label className="mt-5 block border-t border-slate-200 pt-4">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{rejectMode ? "Lý do từ chối (bắt buộc)" : "Ghi chú duyệt (không bắt buộc)"}</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-[#147b77]" />
      </label>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {rejectMode && <button type="button" disabled={busy} onClick={() => setRejectMode(false)} className="px-4 py-2.5 text-xs font-black text-slate-500">Hủy</button>}
        <button type="button" disabled={busy} onClick={() => rejectMode ? onReject(note) : setRejectMode(true)} className="border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50">{rejectMode ? "Xác nhận từ chối" : "Từ chối"}</button>
        {!rejectMode && <button type="button" disabled={busy} onClick={() => onApprove(note)} className="bg-[#147b77] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
          {busy ? "Đang xử lý..." : isProposal ? "Duyệt & Tạo môn" : "Duyệt quyền dạy"}
        </button>}
      </div>
    </Modal>
  );
}


function EvidenceItem({ evidence, onError }: any) {
  const [access, setAccess] = useState<any>();
  const [loading, setLoading] = useState(false);

  async function openPreview() {
    if (!evidence.accountDocumentId) {
      if (evidence.fileUrl) window.open(evidence.fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    try {
      const result = await staffTutorsApi.documentAccess(evidence.accountDocumentId);
      setAccess(result);
      if (!result.previewable || Number(result.fileSize || 0) > PREVIEW_SIZE_LIMIT) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    } catch (error: any) {
      onError(error?.message || "Không thể mở minh chứng.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-[#f7f9fc] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="h-4 w-4 text-[#147b77]" />
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-[#073554]">{evidence.title}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{evidenceTypeLabel(evidence.evidenceType)}</p></div>
        <button type="button" disabled={loading} onClick={openPreview} className="inline-flex items-center gap-1 border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-[#073554] disabled:opacity-50">
          {loading ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Xem file
        </button>
        {access?.url && <a href={access.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-[#073554] px-2.5 py-1.5 text-[10px] font-black text-white"><Download className="h-3 w-3" /> Tải xuống</a>}
      </div>
      {access?.previewable && Number(access.fileSize || 0) <= PREVIEW_SIZE_LIMIT && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {String(access.contentType).startsWith("image/") ? <img src={access.url} alt={access.filename} className="max-h-[420px] w-full object-contain" /> : <iframe title={access.filename} src={access.url} className="h-[420px] w-full" />}
          <p className="border-t border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500">{access.filename} · {formatSize(access.fileSize)}</p>
        </div>
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#061827]/65 p-4 sm:p-8">
      <div className="my-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div><h2 className="font-display text-xl font-black text-[#073554]">{title}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <p className="mt-3 text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">{label}:</strong> {value || "--"}</p>;
}

function StatusBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700"><Clock3 className="h-3 w-3" /> Chờ duyệt</span>;
}

function EmptyQueue({ text }: { text: string }) {
  return <div className="p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-3 text-sm font-black text-[#073554]">{text}</p></div>;
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSize(value?: number) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function evidenceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DEGREE: "Bằng cấp",
    CERTIFICATE: "Chứng chỉ",
    TRANSCRIPT: "Bảng điểm",
    PORTFOLIO: "Portfolio",
    VIDEO: "Video",
    GITHUB_PROJECT: "GitHub",
    WORK_EXPERIENCE: "Minh chứng kinh nghiệm",
    OTHER: "Minh chứng khác",
  };
  return labels[type] || type;
}
