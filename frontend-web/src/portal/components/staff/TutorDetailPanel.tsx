import React, { useState } from "react";
import { CalendarDays, Eye, FileText, GraduationCap, Mail, MapPin, Phone, UserRoundCheck } from "lucide-react";
import { TutorApprovalItem } from "../../types";
import { TutorStatusBadge } from "./TutorStatusBadge";

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatMoney(value?: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ/giờ`;
}

function formatSize(value?: number) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function TutorDetailPanel({
  tutor,
  loading,
  busy,
  onApprove,
  onReject,
  onViewDocument,
}: {
  tutor?: TutorApprovalItem;
  loading?: boolean;
  busy: boolean;
  onApprove: (tutor: TutorApprovalItem, note?: string) => void;
  onReject: (tutor: TutorApprovalItem) => void;
  onViewDocument: (tutor: TutorApprovalItem, documentId: string) => void;
}) {
  const [approveNote, setApproveNote] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);

  if (loading) {
    return <aside className="h-[620px] animate-pulse border border-[#d7dde6] bg-white shadow-sm" />;
  }

  if (!tutor) {
    return (
      <aside className="border border-dashed border-[#d7dde6] bg-white p-8 text-center shadow-sm">
        <UserRoundCheck className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 font-display text-sm font-black text-[#073554]">Chọn một hồ sơ gia sư</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Thông tin chi tiết, môn đăng ký và hành động duyệt sẽ hiển thị tại đây.</p>
      </aside>
    );
  }

  const initials = tutor.fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-24 border border-[#d7dde6] bg-white shadow-sm">
      <div className="border-b border-[#e4e8ee] p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden bg-[#073554] font-display text-2xl font-black text-white">
            {tutor.avatarUrl ? <img src={tutor.avatarUrl} alt={`Ảnh đại diện của ${tutor.fullName}`} className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-black text-[#073554]">{tutor.fullName}</h3>
            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500"><Mail className="h-3.5 w-3.5" />{tutor.email}</p>
            {tutor.phone && <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500"><Phone className="h-3.5 w-3.5" />{tutor.phone}</p>}
            <div className="mt-3"><TutorStatusBadge status={tutor.status} /></div>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-320px)] space-y-5 overflow-y-auto p-6 custom-scrollbar">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Thông tin người đăng ký</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold text-[#073554]">
            <InfoTile label="Ngày sinh" value={formatDate(tutor.dateOfBirth)} />
            <InfoTile label="Giới tính" value={genderLabel(tutor.gender)} />
            <InfoTile label="Email" value={tutor.email || "--"} />
            <InfoTile label="Điện thoại" value={tutor.phone || "--"} />
          </div>
          <p className="mt-3 flex gap-2 bg-[#f7f9fc] p-3 text-xs font-semibold leading-5 text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 flex-none text-[#ff695f]" />
            {formatAddress(tutor)}
          </p>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Học vấn & kinh nghiệm</p>
          <p className="mt-2 flex gap-2 text-sm font-bold leading-6 text-[#073554]">
            <GraduationCap className="mt-0.5 h-4 w-4 flex-none text-[#ff695f]" />
            {tutor.institution || tutor.education || "Chưa cập nhật"} {tutor.major ? `· ${tutor.major}` : ""}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{tutor.experienceSummary || "Chưa có tóm tắt kinh nghiệm."}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-[#f7f9fc] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Account</p>
            <strong className="mt-2 block text-xs font-black text-[#073554]">{tutor.accountStatus || "--"}</strong>
          </div>
          <div className="bg-[#f7f9fc] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted</p>
            <strong className="mt-2 flex items-center gap-2 text-xs font-black text-[#073554]"><CalendarDays className="h-4 w-4 text-[#ff695f]" />{formatDate(tutor.submittedAt || tutor.createdAt)}</strong>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Môn nhận dạy</p>
          <div className="mt-3 space-y-2">
            {tutor.subjects.map((subject) => (
              <div key={subject.id} className="border border-[#d7dde6] bg-[#eff4f8] p-3 text-xs font-bold text-[#073554]">
                <p className="font-black">{subject.name}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {[subject.category, subject.group].filter(Boolean).join(" · ")}
                </p>
                {subject.levels?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {subject.levels.map((level) => (
                      <span key={level} className="bg-white px-2 py-1 text-[10px] font-black text-[#073554]">
                        {levelLabels[level] || level}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1 text-slate-600">{formatMoney(subject.oneToOneHourlyRate)} · {subject.experienceYears ?? 0} năm kinh nghiệm</p>
                {subject.description && <p className="mt-2 leading-5 text-slate-600">{subject.description}</p>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Giới thiệu</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{tutor.bio || "Tutor chưa nhập bio."}</p>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tài liệu xác minh</p>
          <div className="mt-3 space-y-2">
            {tutor.documents?.length ? tutor.documents.map((document) => (
              <div key={document.id} className="flex items-start gap-3 border border-[#d7dde6] p-3 text-xs font-bold text-[#073554]">
                <FileText className="h-4 w-4 text-[#ff695f]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">
                    {documentLabel(document.type)} · {document.title || document.name}
                    {document.expired ? <span className="ml-2 bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">Hết hạn</span> : null}
                  </span>
                  <span className="mt-1 block truncate text-slate-500">
                    {document.issuer || "Chưa có đơn vị cấp"} · {formatDate(document.issueDate)} · {formatValidity(document)}
                  </span>
                  <span className="mt-1 block truncate text-slate-400">
                    {document.name} · {formatSize(document.fileSize)} · {document.verificationStatus}
                  </span>
                </span>
                <button type="button" onClick={() => onViewDocument(tutor, document.id)} className="inline-flex items-center gap-1 bg-[#073554] px-2 py-1 text-[10px] font-black uppercase text-white">
                  <Eye className="h-3 w-3" /> Xem
                </button>
              </div>
            )) : (
              <p className="border border-dashed border-[#d7dde6] p-3 text-xs font-semibold text-slate-500">Chưa có tài liệu đính kèm.</p>
            )}
          </div>
        </section>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ghi chú phê duyệt</span>
          <textarea
            value={approveNote}
            onChange={(event) => setApproveNote(event.target.value)}
            rows={3}
            placeholder="Ghi chú nội bộ, có thể để trống..."
            className="mt-2 w-full resize-none border border-[#d7dde6] bg-[#f7f9fc] p-3 text-xs font-semibold text-[#073554] outline-none focus:border-[#ff695f]"
          />
        </label>
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-[#e4e8ee] p-5">
        <button type="button" disabled={busy} onClick={() => onReject(tutor)} className="border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-100 disabled:opacity-50">Từ chối</button>
        <button type="button" disabled={busy} onClick={() => setConfirmApprove(true)} className="bg-[#ff695f] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#ef5c52] disabled:opacity-50">Phê duyệt</button>
      </footer>

      {confirmApprove && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#061827]/60 p-4">
          <div className="w-full max-w-md border border-[#d7dde6] bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff695f]">Approve Tutor Application</p>
            <h3 className="mt-2 font-display text-xl font-black text-[#073554]">Phê duyệt hồ sơ gia sư?</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Sau khi phê duyệt, người dùng sẽ được cấp quyền Gia sư và hồ sơ giảng dạy được kích hoạt.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setConfirmApprove(false)} className="border border-[#d7dde6] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmApprove(false);
                  onApprove(tutor, approveNote);
                }}
                className="bg-[#ff695f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#ef5c52] disabled:opacity-50"
              >
                {busy ? "Đang phê duyệt..." : "Phê duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function InfoTile({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-[#f7f9fc] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-black text-[#073554]">{value || "--"}</p>
    </div>
  );
}

const levelLabels: Record<string, string> = {
  PRIMARY: "Tiểu học",
  LOWER_SECONDARY: "THCS",
  UPPER_SECONDARY: "THPT",
  UNIVERSITY: "Đại học",
  ADULT: "Người lớn / Người đi làm",
  EXAM_PREPARATION: "Luyện thi / Chứng chỉ",
};

function formatValidity(document: any) {
  if (document.validityType === "DOES_NOT_EXPIRE") return "Không thời hạn";
  if (document.expiryDate) return `Hết hạn ${formatDate(document.expiryDate)}`;
  return "Có thời hạn";
}

function genderLabel(value?: string) {
  const labels: Record<string, string> = {
    FEMALE: "Nữ",
    MALE: "Nam",
    OTHER: "Khác",
    PREFER_NOT_TO_SAY: "Không muốn chia sẻ",
  };
  return value ? labels[value] || value : "--";
}

function formatAddress(tutor: TutorApprovalItem) {
  const administrativeLine = [tutor.commune, tutor.province].filter(Boolean).join(", ");
  return [tutor.addressDetail, administrativeLine].filter(Boolean).join(" - ") || "Chưa cập nhật địa chỉ";
}

function documentLabel(type?: string) {
  const labels: Record<string, string> = {
    IDENTITY_FRONT: "CCCD mặt trước",
    IDENTITY_BACK: "CCCD mặt sau",
    PASSPORT: "Hộ chiếu",
    DEGREE: "Bằng cấp",
    CERTIFICATE: "Chứng chỉ",
  };
  return type ? labels[type] || type : "Tài liệu";
}
