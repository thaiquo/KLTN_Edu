import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Globe2,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { classApi } from "../../../api/classes";

type PortalRole = "student" | "tutor" | "staff" | "admin";

interface ClassItem {
  id: number;
  name: string;
  description?: string;
  tutorEmail: string;
  tutorFullName?: string;
  registration?: {
    subjectName?: string;
    categoryName?: string;
    educationLevelName?: string;
    programTypeName?: string;
  };
  level?: { name?: string };
  learningMode: "ONLINE" | "OFFLINE";
  meetingLink?: string;
  address?: string;
  maxStudents: number;
  pendingCount?: number;
  acceptedCount?: number;
  availableSlots?: number;
  pricePerSession: number;
  totalPrice: number;
  sessionsPerWeek: number;
  durationPerSessionMinutes: number;
  startDate: string;
  endDate: string;
  totalSessions: number;
  syllabusMode: "FORM" | "FILE" | "BOTH";
  syllabusFileUrl?: string;
  joinMode?: "OPEN_REQUEST" | "INVITE_KEY";
  joinKey?: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "PRIVATE" | "PUBLISHED" | "ACTIVE" | "LOCKED" | "REJECTED" | "CLOSED" | "CANCELLED";
  rejectReason?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  schedules?: Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string }>;
  chapters?: Array<{ id: number; title: string; description?: string; expectedSessions: number; orderIndex: number }>;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { id: "ALL", label: "Tất cả" },
  { id: "PUBLISHED", label: "Public" },
  { id: "PRIVATE", label: "Private" },
  { id: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { id: "REJECTED", label: "Từ chối" },
  { id: "LOCKED", label: "Đã khóa" },
  { id: "CLOSED", label: "Đã đóng" },
];

export function AdminClassManagement({ activeRole }: { activeRole: PortalRole }) {
  const isAdmin = activeRole === "admin";
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClassItem | null>(null);
  const [status, setStatus] = useState("ALL");
  const [keyword, setKeyword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await classApi.adminGetAllClasses({ reviewedByMe: !isAdmin });
      setClasses(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return classes.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (!q) return true;
      return [
        item.name,
        item.tutorEmail,
        item.tutorFullName,
        item.registration?.subjectName,
        item.registration?.categoryName,
        item.level?.name,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [classes, keyword, status]);

  const stats = useMemo(() => ({
    total: classes.length,
    published: classes.filter((item) => item.status === "PUBLISHED").length,
    privateCount: classes.filter((item) => item.status === "PRIVATE").length,
    pending: classes.filter((item) => item.status === "PENDING_APPROVAL").length,
    rejected: classes.filter((item) => item.status === "REJECTED").length,
    locked: classes.filter((item) => item.status === "LOCKED").length,
  }), [classes]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-slate-950">Quản lý lớp học</h1>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {isAdmin
                  ? "Admin xem toàn bộ lớp đã được tạo trên hệ thống, gồm public, private, chờ duyệt, bị từ chối và đã khóa."
                  : "Staff chỉ xem các lớp mình đã duyệt hoặc từ chối. Hàng chờ duyệt nằm trong màn Tutor Approval."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-blue-500 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Tải lại
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Tổng số lớp" value={stats.total} icon={<BookOpen className="h-4 w-4" />} active={status === "ALL"} onClick={() => setStatus("ALL")} />
        <StatCard label="Public" value={stats.published} icon={<Globe2 className="h-4 w-4" />} active={status === "PUBLISHED"} onClick={() => setStatus("PUBLISHED")} tone="emerald" />
        <StatCard label="Private" value={stats.privateCount} icon={<Lock className="h-4 w-4" />} active={status === "PRIVATE"} onClick={() => setStatus("PRIVATE")} tone="sky" />
        <StatCard label="Chờ duyệt" value={stats.pending} icon={<Calendar className="h-4 w-4" />} active={status === "PENDING_APPROVAL"} onClick={() => setStatus("PENDING_APPROVAL")} tone="amber" />
        <StatCard label="Bị từ chối" value={stats.rejected} icon={<XCircle className="h-4 w-4" />} active={status === "REJECTED"} onClick={() => setStatus("REJECTED")} tone="rose" />
        <StatCard label="Đã khóa" value={stats.locked} icon={<Lock className="h-4 w-4" />} active={status === "LOCKED"} onClick={() => setStatus("LOCKED")} tone="violet" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatus(option.id)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  status === option.id ? "bg-blue-700 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm lớp, môn, gia sư, email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm font-bold text-slate-500">Đang tải danh sách lớp học...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-black text-slate-800">Không có lớp học phù hợp</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {isAdmin ? "Hãy thử đổi bộ lọc hoặc tải lại dữ liệu." : "Staff chỉ thấy các lớp đã do chính tài khoản này xử lý."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lớp học</th>
                  <th className="px-4 py-3">Gia sư</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hình thức</th>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Học phí</th>
                  <th className="px-4 py-3">Người duyệt</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-black text-slate-950" title={item.name}>{item.name}</p>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-blue-700">
                        {item.registration?.subjectName || "Môn học"} · {item.level?.name || "Cấp độ"}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-black text-slate-800" title={tutorName(item)}>{tutorName(item)}</p>
                      <p className="truncate text-[11px] text-slate-400" title={item.tutorEmail}>{item.tutorEmail}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3">
                      {item.learningMode === "ONLINE" ? (
                        <span className="inline-flex items-center gap-1 font-bold text-blue-700"><Video className="h-3.5 w-3.5" /> Online</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><MapPin className="h-3.5 w-3.5" /> Offline</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.sessionsPerWeek} buổi/tuần</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-black text-slate-800">
                        <Users className="h-3.5 w-3.5" />
                        {item.acceptedCount || 0}/{item.maxStudents}
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-400">Chờ: {item.pendingCount || 0}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{money(item.pricePerSession)}/buổi</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.totalSessions} buổi</p>
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate font-bold text-slate-700" title={item.reviewedByEmail}>{item.reviewedByEmail || "--"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(item.reviewedAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-blue-500 hover:text-blue-700"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && <ClassDetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({ label, value, icon, active, onClick, tone = "slate" }: any) {
  const color = active ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300";
  const iconTone: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left shadow-sm transition ${color}`}>
      <span className={`inline-flex rounded-xl p-2 ${iconTone[tone] || iconTone.slate}`}>{icon}</span>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </button>
  );
}

function ClassDetailModal({ item, onClose }: { item: ClassItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-8" onClick={onClose}>
      <div className="my-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">{item.registration?.subjectName} · {item.level?.name}</p>
            <h2 className="mt-1 font-display text-xl font-black text-slate-950">{item.name}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{tutorName(item)} · {item.tutorEmail}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <Info label="Trạng thái" value={statusText(item.status)} />
          <Info label="Hình thức" value={item.learningMode === "ONLINE" ? "Online" : "Offline"} />
          <Info label="Sĩ số" value={`${item.acceptedCount || 0}/${item.maxStudents} học viên`} />
          <Info label="Học phí / buổi" value={money(item.pricePerSession)} />
          <Info label="Tổng buổi" value={`${item.totalSessions} buổi`} />
          <Info label="Thời gian" value={`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`} />
          <Info label="Người duyệt" value={item.reviewedByEmail || "--"} />
          <Info label="Thời gian duyệt" value={formatDate(item.reviewedAt)} />
          <Info label="Chế độ vào lớp" value={item.joinMode === "INVITE_KEY" ? `Mã mời: ${item.joinKey || "--"}` : "Gửi yêu cầu"} />
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <p className="font-black text-slate-900">Mô tả lớp học</p>
          <p className="mt-2 whitespace-pre-wrap font-semibold leading-6 text-slate-600">{item.description || "--"}</p>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4 text-xs">
          <p className="font-black text-slate-900">Lịch học</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(item.schedules || []).map((slot) => (
              <span key={slot.id} className="rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-700">
                {dayLabel(slot.dayOfWeek)} {slot.startTime} - {slot.endTime}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4 text-xs">
          <p className="font-black text-slate-900">Lộ trình</p>
          <div className="mt-2 space-y-2">
            {(item.chapters || []).length === 0 ? (
              <p className="font-semibold text-slate-400">Không có chương nhập trực tiếp.</p>
            ) : (
              (item.chapters || []).map((chapter, index) => (
                <div key={chapter.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-black text-slate-800">#{index + 1}. {chapter.title} · {chapter.expectedSessions} buổi</p>
                  {chapter.description && <p className="mt-1 font-semibold text-slate-500">{chapter.description}</p>}
                </div>
              ))
            )}
          </div>
          {item.syllabusFileUrl && (
            <a href={item.syllabusFileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 font-black text-white">
              <FileText className="h-4 w-4" />
              Xem file lộ trình
            </a>
          )}
        </section>

        {item.rejectReason && (
          <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
            <p className="font-black">Lý do từ chối</p>
            <p className="mt-1">{item.rejectReason}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-800">{value || "--"}</p>
    </div>
  );
}

function statusBadge(status: string) {
  const classes: Record<string, string> = {
    PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PRIVATE: "border-sky-200 bg-sky-50 text-sky-700",
    PENDING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
    LOCKED: "border-violet-200 bg-violet-50 text-violet-700",
    CLOSED: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${classes[status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
      {status === "PUBLISHED" && <CheckCircle2 className="h-3 w-3" />}
      {statusText(status)}
    </span>
  );
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    PUBLISHED: "Public",
    PRIVATE: "Private",
    PENDING_APPROVAL: "Chờ duyệt",
    REJECTED: "Bị từ chối",
    LOCKED: "Đã khóa",
    CLOSED: "Đã đóng",
    ACTIVE: "Đang học",
    DRAFT: "Nháp",
  };
  return labels[status] || status;
}

function tutorName(item: ClassItem) {
  return item.tutorFullName?.trim() || item.tutorEmail;
}

function money(value?: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: value.includes("T") ? "2-digit" : undefined, minute: value.includes("T") ? "2-digit" : undefined });
}

function dayLabel(day: number) {
  return day === 8 ? "Chủ nhật" : `Thứ ${day}`;
}
