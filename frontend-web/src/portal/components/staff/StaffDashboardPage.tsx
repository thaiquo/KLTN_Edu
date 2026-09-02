import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Eye, FileText, X, BookOpen, GraduationCap, UserCheck } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { DashboardStats } from "./DashboardStats";
import { TeachingRegistrationReview } from "./TeachingRegistrationReview";
import { ClassApprovalReview } from "./ClassApprovalReview";
import { TutorProfileApprovalReview } from "./TutorProfileApprovalReview";
import { teachingRegistrationApi } from "../../../api/teachingRegistrations";

export function StaffDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.activeRole === "ADMIN";
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [teachingPendingCount, setTeachingPendingCount] = useState(0);
  const [tutorProfilePendingCount, setTutorProfilePendingCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<"TUTOR_PROFILES" | "TEACHING_REGISTRATION" | "CLASS_ROOMS">("CLASS_ROOMS");

  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await teachingRegistrationApi.adminHistory();
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải lịch sử duyệt.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function load() {
    setRefreshTrigger((prev) => prev + 1);
  }

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const approvedToday = historyItems.filter((item) => {
    if (item.status !== "APPROVED" || !item.reviewedAt) return false;
    const date = new Date(item.reviewedAt);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }).length;

  const rejectedToday = historyItems.filter((item) => {
    if (item.status !== "REJECTED" || !item.reviewedAt) return false;
    const date = new Date(item.reviewedAt);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }).length;

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#f3f6f9] p-0 font-sans text-[#073554]">
      <header className="mb-5 flex flex-col gap-4 border border-[#d7dde6] bg-white px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Quản trị / <span className="text-[#073554]">Phê duyệt hồ sơ & Lớp học</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">
            Admin Duyệt Hồ Sơ & Lớp Học
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isAdmin
              ? "Bạn đang duyệt với quyền Admin, bao gồm toàn bộ quyền quản lý của Staff."
              : "Staff có thể duyệt hồ sơ và lớp học theo quyền vận hành được phân công."}
          </p>
        </div>

        <button onClick={load} className="inline-flex w-fit items-center gap-2 border border-[#d7dde6] bg-[#f7f9fc] px-3 py-2 text-xs font-bold text-slate-500 hover:border-[#ff695f]">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {/* Main Mode Navigation Tabs */}
      <div className="mb-5 flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab("CLASS_ROOMS")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === "CLASS_ROOMS"
              ? "bg-[#073554] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Quản lý & Duyệt Lớp học</span>
        </button>

        <button
          onClick={() => setActiveTab("TUTOR_PROFILES")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === "TUTOR_PROFILES"
              ? "bg-[#073554] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Duyệt Hồ sơ & CCCD Gia sư</span>
          {tutorProfilePendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
              {tutorProfilePendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("TEACHING_REGISTRATION")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === "TEACHING_REGISTRATION"
              ? "bg-[#073554] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Duyệt Đăng ký Môn dạy</span>
          {teachingPendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
              {teachingPendingCount}
            </span>
          )}
        </button>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
          <button onClick={() => setToast("")} className="ml-auto text-emerald-900">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === "CLASS_ROOMS" ? (
        <ClassApprovalReview key={`classes-${refreshTrigger}`} />
      ) : activeTab === "TUTOR_PROFILES" ? (
        <TutorProfileApprovalReview
          key={`tutor-profiles-${refreshTrigger}`}
          onNotice={setToast}
          onError={setError}
          onPendingCountChange={setTutorProfilePendingCount}
          onActionSuccess={loadHistory}
        />
      ) : (
        <>
          <DashboardStats 
            pendingCount={teachingPendingCount} 
            approvedToday={approvedToday} 
            rejectedToday={rejectedToday} 
            averageReviewTime="--" 
          />

          <TeachingRegistrationReview 
            key={`review-${refreshTrigger}`}
            onNotice={setToast} 
            onError={setError} 
            onPendingCountChange={setTeachingPendingCount} 
            onActionSuccess={loadHistory}
          />

          <TeachingRegistrationHistorySection 
            items={historyItems}
            loading={historyLoading}
            onReload={loadHistory}
          />
        </>
      )}
    </div>
  );
}

function TeachingRegistrationHistorySection({ items, loading, onReload }: { items: any[]; loading: boolean; onReload: () => void }) {
  const [selected, setSelected] = useState<any>();

  return (
    <section className="mt-5 border border-[#d7dde6] bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e8ee] pb-4">
        <div>
          <h2 className="font-display text-lg font-black text-[#073554]">Lịch sử phê duyệt quyền dạy</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Xem lại các yêu cầu quyền dạy hoặc đề xuất môn mới đã được duyệt hoặc từ chối.</p>
        </div>
        <button type="button" onClick={onReload} className="border border-[#d7dde6] px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-[#147b77]">Tải lại</button>
      </header>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse bg-slate-100" />
      ) : items.length === 0 ? (
        <p className="mt-5 text-center text-xs font-semibold text-slate-400 py-6">Chưa có lịch sử phê duyệt.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-semibold text-slate-500">
            <thead>
              <tr className="border-b border-[#edf0f4] text-[#073554] font-black uppercase text-[10px]">
                <th className="py-3 px-2">Gia sư</th>
                <th className="py-3 px-2">Môn & Lớp</th>
                <th className="py-3 px-2">Thời gian duyệt</th>
                <th className="py-3 px-2">Người duyệt</th>
                <th className="py-3 px-2">Trạng thái</th>
                <th className="py-3 px-2 text-right font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {items.map((item) => {
                const isProposal = Boolean(item.proposedSubjectName);
                const isApproved = item.status === "APPROVED";
                const tutorName = tutorDisplayName(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-2 min-w-[150px]">
                      <p className="font-bold text-[#073554]" title={tutorName}>{tutorName}</p>
                      {item.tutorEmail && item.tutorEmail !== tutorName && (
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400" title={item.tutorEmail}>{item.tutorEmail}</p>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-bold text-[#073554]">
                        {isProposal ? `${item.proposedSubjectName} (Đề xuất mới)` : item.subject?.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {isProposal ? item.proposedLevelName : (item.levels || []).map((l: any) => l.name).join(", ")}
                      </p>
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("vi-VN") : "--"}
                    </td>
                    <td className="py-3 px-2 truncate max-w-[120px]" title={item.reviewedByEmail}>
                      {item.reviewedByEmail || "--"}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        isApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {isApproved ? "Đã duyệt" : "Bị từ chối"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button type="button" onClick={() => setSelected(item)} className="text-[#073554] hover:text-[#147b77]">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <HistoryDetailModal item={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function HistoryDetailModal({ item, onClose }: any) {
  const isApproved = item.status === "APPROVED";
  const isProposal = Boolean(item.proposedSubjectName);
  const tutorName = tutorDisplayName(item);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#061827]/65 p-4 sm:p-8" onClick={onClose}>
      <div className="my-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display text-lg font-black text-[#073554]">Chi tiết lịch sử phê duyệt</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{identityLabel(item)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-4 space-y-3 text-xs">
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Trạng thái:</strong> <span className={`font-black uppercase px-2 py-0.5 rounded ${isApproved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{isApproved ? "Đã duyệt" : "Bị từ chối"}</span></p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Gia sư:</strong> {tutorName}{item.tutorEmail && item.tutorEmail !== tutorName ? ` · ${item.tutorEmail}` : ""}</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Môn học:</strong> {isProposal ? `${item.proposedSubjectName} (Đề xuất)` : item.subject?.name}</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Nhóm môn:</strong> {item.category?.name || "--"}</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Lớp / Trình độ:</strong> {isProposal ? item.proposedLevelName : (item.levels || []).map((l: any) => l.name).join(", ")}</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Số năm kinh nghiệm:</strong> {item.experienceYears} năm</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Học phí đề xuất:</strong> {new Intl.NumberFormat("vi-VN").format(item.tuitionMin)} - {new Intl.NumberFormat("vi-VN").format(item.tuitionMax)}đ / buổi</p>
          <p className="text-xs font-semibold leading-5 text-slate-600"><strong className="text-[#073554]">Người duyệt:</strong> {item.reviewedByEmail || "--"} vào lúc {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("vi-VN") : "--"}</p>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
            <p className="font-bold text-[#073554]">Mô tả năng lực:</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-600 leading-relaxed">{item.description || "Không có mô tả"}</p>
          </div>

          {item.rejectReason && (
            <div className="rounded-lg border border-rose-200 p-3 bg-rose-50 text-rose-800">
              <p className="font-bold">Lý do từ chối:</p>
              <p className="mt-1">{item.rejectReason}</p>
            </div>
          )}

          {item.reviewNote && (
            <div className="rounded-lg border border-blue-200 p-3 bg-blue-50 text-blue-800">
              <p className="font-bold">Ghi chú duyệt:</p>
              <p className="mt-1">{item.reviewNote}</p>
            </div>
          )}

          <div className="pt-2">
            <p className="font-bold text-[#073554]">Minh chứng đính kèm ({item.evidence?.length || 0}):</p>
            <div className="mt-2 space-y-2">
              {(item.evidence || []).map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white p-2 text-xs">
                  <FileText className="h-4 w-4 text-[#147b77] shrink-0" />
                  <span className="font-bold text-[#073554] truncate flex-1">{ev.title}</span>
                  {ev.fileUrl && <a href={ev.fileUrl} target="_blank" rel="noreferrer" className="text-[#147b77] hover:underline shrink-0 font-bold">Xem file</a>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-200">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function tutorDisplayName(item: any) {
  return item?.tutorFullName?.trim()
    || item?.applicantFullName?.trim()
    || item?.fullName?.trim()
    || item?.tutorName?.trim()
    || item?.requestedByFullName?.trim()
    || item?.tutorEmail
    || "Gia sư chưa cập nhật họ tên";
}

function identityLabel(item: any) {
  const name = tutorDisplayName(item);
  const email = item?.tutorEmail || item?.requestedByEmail;
  return email && email !== name ? `${name} · ${email}` : name;
}
