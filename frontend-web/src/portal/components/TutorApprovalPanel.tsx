import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Download, ExternalLink, LoaderCircle, RefreshCw, X } from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { levelGroupLabelVi, levelLabelVi, subjectLabelVi } from "../tutorApplication";
import { StatusBadge } from "./EvidenceUploader";

type Certificate = { id: string; name: string; issueDate: string; expiryDate?: string | null; fileUrl?: string; originalFileName: string; contentType: string; fileSize: number; verificationStatus: string };
type TeachingSubject = { id: string; levelGroup: string; subjectName: string; teachingLevel: string; bio: string; experience: string; certificates: Certificate[] };
type Application = { id: string; userId: string; applicantName?: string; applicantEmail?: string; status: string; rejectionReason?: string | null; reviewNote?: string | null; certificates: Certificate[]; teachingSubjects?: TeachingSubject[]; submittedAt?: string; reviewedAt?: string };

const isReviewable = (status: string) => ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status);
const badge = (status: string) => status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "pending";
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

const isImage = (c: Certificate) =>
  (c.contentType && c.contentType.startsWith("image/")) ||
  /\.(png|jpe?g|webp|gif|svg)$/i.test(c.originalFileName || "");

const isPdf = (c: Certificate) =>
  c.contentType === "application/pdf" ||
  /\.pdf$/i.test(c.originalFileName || "");

const isWord = (c: Certificate) =>
  (c.contentType && (c.contentType.includes("word") || c.contentType.includes("officedocument"))) ||
  /\.(docx?)$/i.test(c.originalFileName || "");

const supportsBrowserPreview = (certificate: Certificate) =>
  certificate.fileSize <= PREVIEW_MAX_BYTES && (isImage(certificate) || isPdf(certificate) || isWord(certificate));

export function TutorApprovalPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; contentType: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try { setApplications(await tutorApplicationApi.list()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể tải hồ sơ."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    return tutorApplicationApi.subscribeAdmin((updated: Application) => {
      setApplications(old => old.some(item => item.id === updated.id) ? old.map(item => item.id === updated.id ? updated : item) : [updated, ...old]);
      setSelected(old => old?.id === updated.id ? updated : old);
    });
  }, []);

  const review = async (approved: boolean) => {
    if (!selected) return;
    if (!note.trim()) { setError("Vui lòng nhập ghi chú gửi cho người dùng trước khi duyệt hoặc từ chối."); return; }
    setActionId(selected.id); setError("");
    try {
      if (approved) await tutorApplicationApi.approve(selected.id, note.trim());
      else await tutorApplicationApi.reject(selected.id, note.trim());
      setNote(""); setSelected(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể cập nhật hồ sơ."); }
    finally { setActionId(""); }
  };

  const openCertificate = async (certificate: Certificate) => {
    if (!selected) return;
    if (!supportsBrowserPreview(certificate)) return;
    try { const url = await tutorApplicationApi.openForReview(selected.id, certificate.id); setPreview({ url, contentType: certificate.contentType, name: certificate.originalFileName }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể mở minh chứng."); }
  };

  const downloadCertificate = async (certificate: Certificate) => {
    if (!selected) return;
    try {
      const url = await tutorApplicationApi.openForReview(selected.id, certificate.id);
      const link = document.createElement("a");
      link.href = url;
      link.download = certificate.originalFileName || "minh-chung";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải minh chứng."); }
  };

  const applicationCard = (application: Application) => <button key={application.id} type="button" onClick={() => { setSelected(application); setNote(""); setError(""); }} className="w-full bg-white border border-brand-border/30 rounded-xl p-5 flex items-center justify-between gap-4 text-left hover:border-brand-primary hover:shadow-sm transition">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-sm truncate">{application.applicantName || "Người đăng ký"}</h3><StatusBadge status={badge(application.status)} /></div><p className="text-xs text-brand-text-variant mt-1 truncate">{application.applicantEmail || application.userId}</p><p className="text-xs text-brand-text-variant mt-2">{application.submittedAt ? new Date(application.submittedAt).toLocaleString("vi-VN") : "Bản nháp"} · {application.teachingSubjects?.length || 0} môn · {application.certificates.length} minh chứng</p></div><ChevronRight className="w-5 h-5 shrink-0 text-brand-primary" />
  </button>;

  const pending = applications.filter(item => isReviewable(item.status));
  const history = applications.filter(item => ["APPROVED", "REJECTED"].includes(item.status));

  return <div className="space-y-7 max-w-5xl mx-auto pb-10">
    <header className="flex items-center justify-between gap-4"><div><h2 className="font-display font-black text-xl text-brand-text">Duyệt hồ sơ giảng viên</h2><p className="text-xs text-brand-text-variant mt-1">Chọn một hồ sơ để xem chi tiết và xử lý.</p></div><button type="button" onClick={load} disabled={loading} title="Tải lại" className="p-2.5 rounded-lg border text-brand-primary disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button></header>
    {error && !selected && <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</p>}
    {loading && !applications.length && <LoaderCircle className="w-6 h-6 animate-spin mx-auto text-brand-primary" />}
    <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-black text-sm">Hồ sơ chờ xử lý</h3><span className="text-xs text-brand-text-variant">{pending.length} hồ sơ</span></div>{!pending.length && !loading ? <p className="p-6 text-center bg-white border rounded-xl text-sm text-brand-text-variant">Không có hồ sơ đang chờ duyệt.</p> : pending.map(applicationCard)}</section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-black text-sm">Lịch sử xét duyệt</h3><span className="text-xs text-brand-text-variant">{history.length} hồ sơ</span></div>{!history.length ? <p className="p-6 text-center bg-white border rounded-xl text-sm text-brand-text-variant">Chưa có lịch sử xét duyệt.</p> : history.map(applicationCard)}</section>

    {selected && <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4"><div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-6 space-y-5">
      <div className="flex justify-between gap-4"><div><h3 className="font-black text-lg">Chi tiết hồ sơ giảng viên</h3><p className="text-xs text-brand-text-variant mt-1">{selected.applicantName || "Người đăng ký"} · {selected.applicantEmail || selected.userId}</p></div><button type="button" onClick={() => { setSelected(null); setNote(""); setError(""); }} aria-label="Đóng"><X /></button></div>
      <div className="flex flex-wrap justify-between gap-3 p-3 rounded-lg bg-slate-50"><p className="text-xs"><b>Ngày nộp:</b> {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString("vi-VN") : "Chưa nộp"}<br /><b>Ngày xử lý:</b> {selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString("vi-VN") : "—"}</p><StatusBadge status={badge(selected.status)} /></div>
      {selected.teachingSubjects?.map((subject, index) => <section key={subject.id} className="p-4 rounded-xl border space-y-3 text-xs"><h4 className="font-black text-sm">Môn học {index + 1}: {subjectLabelVi(subject.subjectName)}</h4><div className="grid sm:grid-cols-2 gap-2"><p><b>Cấp bậc:</b> {levelGroupLabelVi(subject.levelGroup)}</p><p><b>Lớp / trình độ:</b> {subject.teachingLevel.split(",").map(levelLabelVi).join(", ")}</p></div><p><b>Giới thiệu theo môn:</b> {subject.bio}</p><p><b>Kinh nghiệm giảng dạy / làm việc:</b> {subject.experience}</p><div className="space-y-2"><b>Chứng chỉ / bằng cấp ({subject.certificates.length}):</b>{subject.certificates.map(certificate => <div key={certificate.id} className="w-full p-3 rounded-lg bg-slate-50 border flex justify-between gap-3 text-left"><span><b className="block">{certificate.name}</b><small className="text-brand-text-variant">File: {certificate.originalFileName}<br />Ngày cấp: {certificate.issueDate} · {certificate.expiryDate ? `Hết hạn: ${certificate.expiryDate}` : "Không thời hạn"} · {certificate.contentType} · {formatSize(certificate.fileSize)}</small>{!supportsBrowserPreview(certificate) && <small className="block mt-1 text-brand-text-variant">{certificate.fileSize > PREVIEW_MAX_BYTES ? "File lớn: tải xuống để xem." : "Định dạng này cần tải xuống để xem."}</small>}</span><span className="flex shrink-0 items-center gap-2">{supportsBrowserPreview(certificate) && <button type="button" title="Xem trước" onClick={() => openCertificate(certificate)} className="p-2 rounded-lg text-brand-primary hover:bg-brand-primary/10"><ExternalLink className="w-4 h-4" /></button>}<button type="button" title="Tải xuống" onClick={() => downloadCertificate(certificate)} className="p-2 rounded-lg text-brand-primary hover:bg-brand-primary/10"><Download className="w-4 h-4" /></button></span></div>)}</div></section>)}
      {!isReviewable(selected.status) && selected.reviewNote && <p className={`p-3 rounded-lg border text-xs ${selected.status === "REJECTED" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}><b>Ghi chú đã gửi người dùng:</b> {selected.reviewNote}</p>}
      {error && <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</p>}
      {isReviewable(selected.status) && <div className="space-y-3 border-t pt-4"><label className="field-label">Ghi chú gửi cho người dùng <span className="text-red-600">*</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} className="field-control resize-none mt-2" placeholder="Nêu nhận xét, kết quả xác minh hoặc lý do từ chối" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => review(false)} disabled={!!actionId} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-black disabled:opacity-40"><X className="w-4 h-4" /> Từ chối</button><button type="button" onClick={() => review(true)} disabled={!!actionId || !selected.certificates.length} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-black disabled:opacity-40">{actionId ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Duyệt hồ sơ</button></div></div>}
    </div></div>}
    {preview && (
      <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b">
            <b className="text-sm truncate font-display">{preview.name}</b>
            <button type="button" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          {preview.contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(preview.name) ? (
            <img src={preview.url} alt={preview.name} className="min-h-0 flex-1 object-contain mx-auto" />
          ) : preview.contentType.includes("word") || /\.(docx?)$/i.test(preview.name) ? (
            <iframe title={preview.name} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.url)}`} className="min-h-0 flex-1 w-full border rounded-lg" />
          ) : (
            <iframe title={preview.name} src={preview.url} className="min-h-0 flex-1 w-full border rounded-lg" />
          )}
        </div>
      </div>
    )}
  </div>;
}
