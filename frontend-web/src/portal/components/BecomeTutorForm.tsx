import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, Plus, Send, X } from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { useAuth } from "../../hooks/useAuth";
import { createSubject, levelGroupLabelVi, levelLabelVi, SubjectEvidence, subjectLabelVi, TutorTeachingSubject } from "../tutorApplication";
import { StatusBadge } from "./EvidenceUploader";
import { TeachingSubjectCard } from "./TeachingSubjectCard";

type Certificate = { id: string; name: string; issuer: string; issueDate: string; expiryDate?: string | null; fileKey: string; fileUrl?: string; originalFileName: string; contentType: string; fileSize: number; verificationStatus: string };
type SubmittedSubject = { id: string; levelGroup: string; subjectName: string; teachingLevel: string; bio: string; experience: string; certificates: Certificate[] };
type Application = { id: string; status: string; submittedAt?: string; reviewedAt?: string; rejectionReason?: string | null; reviewNote?: string | null; teachingSubjects: SubmittedSubject[] };

const uiStatus = (status: string) => status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "pending";
const evidence = (item: Certificate): SubjectEvidence => ({ _id: item.id, name: item.name, issuer: item.issuer, issueDate: item.issueDate, expiryDate: item.expiryDate || null, description: "", fileKey: item.fileKey, fileUrl: item.fileUrl, originalFileName: item.originalFileName, fileType: item.contentType, fileSize: item.fileSize, verificationStatus: item.verificationStatus === "VERIFIED" ? "approved" : "pending" });
const toDraft = (subject: SubmittedSubject): TutorTeachingSubject => ({ ...createSubject(), _id: subject.id, levelGroupId: subject.levelGroup, subjectId: subject.subjectName, teachingLevelIds: subject.teachingLevel.split(",").filter(Boolean), bio: subject.bio, experience: subject.experience, evidences: subject.certificates.map(evidence) });

export function BecomeTutorForm() {
  const { refreshUser } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [subjects, setSubjects] = useState<TutorTeachingSubject[]>([createSubject()]);
  const [open, setOpen] = useState<number[]>([0]);
  const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(""); const [detail, setDetail] = useState<Application | null>(null);
  const current = applications[0];
  const draftApplication = current?.status === "DRAFT" ? current : null;
  const editable = !draftApplication || draftApplication.status === "DRAFT";
  const errors = (subject: TutorTeachingSubject) => [
    !subject.levelGroupId && "Vui lòng chọn cấp bậc.", subject.levelGroupId === "__custom__" && !subject.customLevelGroup?.trim() && "Vui lòng nhập cấp bậc.", !subject.subjectId && "Vui lòng chọn môn học.", subject.subjectId === "__custom__" && !subject.customSubject?.trim() && "Vui lòng nhập tên môn học.", !subject.teachingLevelIds.length && "Vui lòng chọn lớp / trình độ dạy.", subject.teachingLevelIds[0] === "__custom__" && !subject.customTeachingLevel?.trim() && "Vui lòng nhập lớp / trình độ.", !subject.bio?.trim() && "Vui lòng nhập phần giới thiệu.", !subject.experience?.trim() && "Vui lòng nhập kinh nghiệm.", !subject.evidences.length && "Mỗi môn cần có ít nhất một chứng chỉ.", subject.evidences.some(x => !x.uploadFile && !x.fileKey) && "Vui lòng chọn file cho mọi minh chứng.", subject.evidences.some(x => !x.name.trim() || !x.issueDate) && "Vui lòng điền tên và ngày cấp cho mọi chứng chỉ / bằng cấp."
  ].filter(Boolean) as string[];
  const valid = subjects.length > 0 && subjects.every(s => !errors(s).length);
  const load = async () => {
    const items = await tutorApplicationApi.getMine() as Application[];
    setApplications(items);
    if (items[0]?.status === "DRAFT") {
      setSubjects(items[0].teachingSubjects.map(toDraft));
      setOpen(items[0].teachingSubjects.map((_, index) => index));
    } else {
      setSubjects([createSubject()]); setOpen([0]);
    }
  };
  useEffect(() => {
    load().catch(e => setMessage(e.message)).finally(() => setLoading(false));
    return tutorApplicationApi.subscribeMine((updated: Application) => { setApplications(old => {
      const exists = old.some(item => item.id === updated.id);
      return exists ? old.map(item => item.id === updated.id ? updated : item) : [updated, ...old];
    }); if (updated.status === "APPROVED") window.setTimeout(() => refreshUser().catch(() => undefined), 750); });
  }, [refreshUser]);
  const updateSubject = (index: number, subject: TutorTeachingSubject) => setSubjects(old => old.map((item, i) => i === index ? subject : item));
  const toggle = (index: number) => setOpen(old => old.includes(index) ? old.filter(i => i !== index) : [...old, index]);
  const add = () => { const index = subjects.length; setSubjects(old => [...old, createSubject()]); setOpen(old => [...old, index]); };
  const submit = async () => {
    if (!valid) { setMessage("Vui lòng hoàn tất các trường bắt buộc được cảnh báo trong từng môn học."); setOpen(subjects.map((_, i) => i)); return; }
    setSubmitting(true); setMessage("");
    try {
      const preparedSubjects = await Promise.all(subjects.map(async subject => ({ ...subject, evidences: await Promise.all(subject.evidences.map(async evidence => {
        if (evidence.fileKey) return evidence;
        const uploaded = await tutorApplicationApi.uploadEvidence(evidence.uploadFile!);
        return { ...evidence, fileKey: uploaded.fileKey, fileUrl: uploaded.fileUrl, originalFileName: uploaded.originalFileName, fileType: uploaded.contentType, fileSize: uploaded.fileSize };
      })) })));
      const payload = { teachingSubjects: preparedSubjects.map(s => ({ levelGroup: s.levelGroupId === "__custom__" ? s.customLevelGroup?.trim() : s.levelGroupId, subjectName: s.subjectId === "__custom__" ? s.customSubject?.trim() : s.subjectId, teachingLevel: s.teachingLevelIds.map(level => level === "__custom__" ? s.customTeachingLevel?.trim() : level).filter(Boolean).join(","), bio: s.bio?.trim(), experience: s.experience?.trim(), certificates: s.evidences.map(c => ({ name: c.name.trim(), issuer: c.issuer.trim() || "Tự khai", issueDate: c.issueDate, expiryDate: c.expiryDate || null, fileKey: c.fileKey, originalFileName: c.originalFileName, contentType: c.fileType, fileSize: c.fileSize })) })) };
      const draft = draftApplication?.id ? await tutorApplicationApi.update(draftApplication.id, payload) : await tutorApplicationApi.create(payload);
      await tutorApplicationApi.submit(draft.id); await load(); setOpen([]); setMessage("Hồ sơ đã được gửi và đang chờ duyệt.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Không thể gửi hồ sơ."); } finally { setSubmitting(false); }
  };
  if (loading) return <div className="p-8 text-center"><LoaderCircle className="w-6 h-6 animate-spin mx-auto text-brand-primary" /></div>;
  return <div className="space-y-6 max-w-4xl">
    <header className="flex items-start justify-between gap-4"><div><h2 className="font-display font-black text-xl text-brand-text">Nộp hồ sơ giảng viên</h2><p className="text-xs text-brand-text-variant mt-1">Thêm từng môn học, năng lực và chứng chỉ minh chứng tương ứng.</p></div>{current && <StatusBadge status={uiStatus(current.status)} />}</header>
    {current?.status === "APPROVED" && <div className="border border-emerald-200 bg-emerald-50 p-5 rounded-xl flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-700" /><div><p className="text-sm text-emerald-800 font-bold">Hồ sơ giảng viên của bạn đã được duyệt.</p>{current.reviewNote && <p className="text-xs mt-1 text-emerald-700">Ghi chú: {current.reviewNote}</p>}</div></div>}
    {["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(current?.status || "") && <div className="border border-amber-200 bg-amber-50 p-5 rounded-xl"><p className="text-sm text-amber-800 font-bold">Hồ sơ đã được gửi và đang chờ quản trị viên xét duyệt.</p><p className="text-xs mt-1 text-amber-700">Bạn có thể xem lại toàn bộ nội dung trong lịch sử nộp hồ sơ.</p></div>}
    {current?.status === "REJECTED" && <div className="border border-red-200 bg-red-50 p-5 rounded-xl"><p className="text-sm text-red-800 font-bold">Hồ sơ gần nhất đã bị từ chối.</p><p className="text-xs mt-1 text-red-700">{current.reviewNote || current.rejectionReason} · Xem đầy đủ trong lịch sử bên dưới.</p></div>}
    <section className="space-y-4">
      {subjects.map((subject, index) => <article key={subject.clientId || subject._id || index} className="rounded-2xl border border-brand-secondary/20 bg-white overflow-hidden"><button type="button" className="w-full p-4 flex justify-between items-center text-left" onClick={() => toggle(index)}><b className="text-sm">Môn học {index + 1}{subject.subjectId ? ` · ${subjectLabelVi(subject.subjectId)}` : ""}</b>{open.includes(index) ? <ChevronUp /> : <ChevronDown />}</button>{open.includes(index) && <TeachingSubjectCard index={index} value={subject} onChange={x => updateSubject(index, x)} onRemove={() => setSubjects(old => old.filter((_, i) => i !== index))} disabled={!editable || submitting} errors={errors(subject)} />}</article>)}
      {editable && <button type="button" onClick={add} className="w-full py-3 border-2 border-dashed rounded-xl text-xs font-black text-brand-secondary inline-flex justify-center gap-2"><Plus className="w-4 h-4" /> Thêm môn học</button>}
      {editable && <div className="flex justify-end"><button type="button" disabled={!valid || submitting} onClick={submit} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-xs font-black disabled:opacity-40">{submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gửi hồ sơ</button></div>}
    </section>
    {message && <p className="text-xs font-semibold text-brand-primary" role="status">{message}</p>}
    <section className="bg-white border border-brand-border/30 rounded-xl p-5 space-y-3"><h3 className="font-black text-sm">Lịch sử nộp hồ sơ</h3>{!applications.length ? <p className="text-xs text-brand-text-variant">Chưa có hồ sơ nào.</p> : applications.map(item => <button key={item.id} onClick={() => setDetail(item)} className="w-full text-left p-3 rounded-lg border border-brand-border/30 flex justify-between"><span className="text-xs">{item.submittedAt ? new Date(item.submittedAt).toLocaleString("vi-VN") : "Bản nháp"}</span><StatusBadge status={uiStatus(item.status)} /></button>)}</section>
    {detail && <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"><div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-auto p-6 space-y-4"><div className="flex justify-between"><h3 className="font-black">Chi tiết hồ sơ</h3><button onClick={() => setDetail(null)} aria-label="Đóng"><X /></button></div><div className="flex flex-wrap items-end justify-between gap-3"><p className="text-xs"><b>Ngày nộp:</b> {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString("vi-VN") : "Chưa nộp"}<br /><b>Ngày duyệt:</b> {detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleString("vi-VN") : "—"}</p><StatusBadge status={uiStatus(detail.status)} /></div>{detail.reviewNote && <p className={`p-3 rounded-lg border text-xs ${detail.status === "REJECTED" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}><b>Ghi chú của quản trị viên:</b> {detail.reviewNote}</p>}{detail.teachingSubjects.map((subject, index) => <section key={subject.id} className="border rounded-xl p-4 text-xs space-y-3"><h4 className="font-black text-sm">Môn học {index + 1}: {subjectLabelVi(subject.subjectName)}</h4><div className="grid sm:grid-cols-2 gap-2"><p><b>Cấp bậc:</b> {levelGroupLabelVi(subject.levelGroup)}</p><p><b>Lớp / trình độ:</b> {subject.teachingLevel.split(",").map(levelLabelVi).join(", ")}</p></div><p><b>Giới thiệu theo môn:</b> {subject.bio}</p><p><b>Kinh nghiệm giảng dạy / làm việc:</b> {subject.experience}</p><div className="space-y-2"><b>Chứng chỉ / bằng cấp ({subject.certificates.length}):</b>{subject.certificates.map(certificate => <div key={certificate.id} className="p-3 rounded-lg bg-slate-50 border"><b className="block">{certificate.name}</b><p className="mt-1"><b>Tên file:</b> {certificate.originalFileName}</p><p><b>Ngày cấp:</b> {certificate.issueDate}</p><p><b>Thời hạn:</b> {certificate.expiryDate ? `Có thời hạn · hết hạn ngày ${certificate.expiryDate}` : "Không thời hạn"}</p><p><b>Định dạng / dung lượng:</b> {certificate.contentType} · {(certificate.fileSize / 1024).toFixed(0)} KB</p></div>)}</div></section>)}</div></div>}
  </div>;
}
