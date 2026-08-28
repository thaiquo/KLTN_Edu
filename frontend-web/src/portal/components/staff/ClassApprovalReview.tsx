import React, { useState, useEffect, useMemo } from "react";
import { 
  GraduationCap, CheckCircle2, XCircle, Clock, Eye, 
  Search, Filter, Video, MapPin, DollarSign, Users, 
  FileText, ExternalLink, RefreshCw, AlertCircle, 
  ChevronRight, Calendar, UserCheck, X 
} from "lucide-react";
import { classApi } from "../../../api/classes";
import { useRealtimeRefresh } from "../../../realtime/useRealtimeRefresh";

interface ClassItem {
  id: number;
  name: string;
  description: string;
  tutorEmail: string;
  tutorProfileId?: number;
  tutorFullName?: string;
  registration?: {
    id: number;
    subjectName: string;
    tuitionMin: number;
    tuitionMax: number;
  };
  level?: {
    id: number;
    name: string;
  };
  learningMode: "ONLINE" | "OFFLINE";
  meetingLink?: string;
  address?: string;
  maxStudents: number;
  pricePerSession: number;
  totalPrice: number;
  sessionsPerWeek: number;
  durationPerSessionMinutes: number;
  durationValue: number;
  durationUnit: "WEEK" | "MONTH";
  startDate: string;
  endDate: string;
  totalSessions: number;
  syllabusMode: "FORM" | "FILE" | "BOTH";
  syllabusFileUrl?: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "CLOSED" | "CANCELLED";
  rejectReason?: string;
  schedules: Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string }>;
  chapters: Array<{ id: number; title: string; description: string; expectedSessions: number; orderIndex: number }>;
  createdAt: string;
}

const VIETNAMESE_DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" }
];

export function ClassApprovalReview() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [rejectingClass, setRejectingClass] = useState<ClassItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_APPROVAL");
  const [selectedTutor, setSelectedTutor] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classApi.adminGetAllClasses();
      setClasses(data || []);
    } catch (err: any) {
      console.error("Failed to load classes for admin", err);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh(["CLASS_SUBMITTED", "CLASS_REVIEWED"], loadClasses);

  useEffect(() => {
    loadClasses();
  }, []);

  // Distinct lists for filters
  const distinctTutors = useMemo(() => {
    const tutors = new Map<string, string>();
    classes.forEach((classRoom) => {
      if (classRoom.tutorEmail) {
        tutors.set(classRoom.tutorEmail, getTutorDisplayName(classRoom));
      }
    });
    return Array.from(tutors, ([email, fullName]) => ({ email, fullName }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "vi"));
  }, [classes]);

  const distinctSubjects = useMemo(() => {
    const subs = Array.from(new Set(classes.map(c => c.registration?.subjectName).filter(Boolean))) as string[];
    return subs.sort();
  }, [classes]);

  // Filtered list
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (selectedTutor !== "ALL" && c.tutorEmail.toLowerCase() !== selectedTutor.toLowerCase()) return false;
      if (selectedSubject !== "ALL" && c.registration?.subjectName !== selectedSubject) return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchTutorName = getTutorDisplayName(c).toLowerCase().includes(q);
        const matchEmail = c.tutorEmail.toLowerCase().includes(q);
        const matchSub = c.registration?.subjectName?.toLowerCase().includes(q);
        const matchLevel = c.level?.name?.toLowerCase().includes(q);
        return matchName || matchTutorName || matchEmail || matchSub || matchLevel;
      }
      return true;
    });
  }, [classes, statusFilter, selectedTutor, selectedSubject, searchKeyword]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: classes.length,
      pending: classes.filter(c => c.status === "PENDING_APPROVAL").length,
      active: classes.filter(c => c.status === "ACTIVE").length,
      rejected: classes.filter(c => c.status === "REJECTED").length
    };
  }, [classes]);

  // Actions
  const handleApprove = async (cls: ClassItem) => {
    if (!window.confirm(`Xác nhận PHÊ DUYỆT lớp học: "${cls.name}"?`)) return;
    setActionBusy(true);
    try {
      await classApi.adminApproveClass(cls.id);
      setToastMessage(`Đã phê duyệt thành công lớp: "${cls.name}"`);
      if (selectedClass?.id === cls.id) setSelectedClass(null);
      loadClasses();
    } catch (err: any) {
      alert(err?.message || "Không thể phê duyệt lớp học.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingClass) return;
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối cụ thể.");
      return;
    }
    setActionBusy(true);
    try {
      await classApi.adminRejectClass(rejectingClass.id, rejectReason.trim());
      setToastMessage(`Đã từ chối lớp: "${rejectingClass.name}"`);
      setRejectingClass(null);
      setRejectReason("");
      if (selectedClass?.id === rejectingClass.id) setSelectedClass(null);
      loadClasses();
    } catch (err: any) {
      alert(err?.message || "Không thể từ chối lớp học.");
    } finally {
      setActionBusy(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đang Mở Bán
          </span>
        );
      case "PRIVATE":
      case "ACTIVE":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đã duyệt (Chờ Mở bán)
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Chờ duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Bị từ chối
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Reload */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e4e8ee] pb-4">
        <div>
          <h2 className="font-display text-lg font-black text-[#073554] uppercase tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-primary" />
            <span>Quản lý & Phê duyệt Lớp học</span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Duyệt các lớp học do Gia sư tạo từ các môn & cấp độ đã được phê duyệt.
          </p>
        </div>

        <button 
          onClick={loadClasses}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-brand-primary transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Stats Summary Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter("PENDING_APPROVAL")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "PENDING_APPROVAL"
              ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/20 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">Chờ phê duyệt</span>
          <span className="text-xl font-black text-amber-900 mt-1 block">{stats.pending}</span>
        </button>

        <button
          onClick={() => setStatusFilter("ACTIVE")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "ACTIVE"
              ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-400/20 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">Đã duyệt (Đang mở)</span>
          <span className="text-xl font-black text-emerald-900 mt-1 block">{stats.active}</span>
        </button>

        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "REJECTED"
              ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/20 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider block">Bị từ chối</span>
          <span className="text-xl font-black text-rose-900 mt-1 block">{stats.rejected}</span>
        </button>

        <button
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "ALL"
              ? "border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Tất cả lớp học</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">{stats.total}</span>
        </button>
      </div>

      {/* Filter Bar (By Tutor, By Subject, Search) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Tutor Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Lọc theo Giảng viên / Gia sư
          </label>
          <select 
            value={selectedTutor}
            onChange={(e) => setSelectedTutor(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary"
          >
            <option value="ALL">-- Tất cả Giảng viên ({distinctTutors.length}) --</option>
            {distinctTutors.map(tutor => {
              const count = classes.filter(c => c.tutorEmail.toLowerCase() === tutor.email.toLowerCase()).length;
              return (
                <option key={tutor.email} value={tutor.email}>
                  {tutor.fullName} ({count} lớp)
                </option>
              );
            })}
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Lọc theo Môn học
          </label>
          <select 
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary"
          >
            <option value="ALL">-- Tất cả Môn học ({distinctSubjects.length}) --</option>
            {distinctSubjects.map(sub => {
              const count = classes.filter(c => c.registration?.subjectName === sub).length;
              return (
                <option key={sub} value={sub}>
                  {sub} ({count} lớp)
                </option>
              );
            })}
          </select>
        </div>

        {/* Keyword Search */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Tìm kiếm tên lớp / từ khóa
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tên lớp, môn học, cấp độ..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-xs font-bold text-slate-500">Đang tải danh sách lớp học...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Không có lớp học nào khớp với bộ lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Tên lớp & Môn học</th>
                  <th className="py-3 px-4">Gia sư</th>
                  <th className="py-3 px-4">Hình thức & Lịch</th>
                  <th className="py-3 px-4">Học phí</th>
                  <th className="py-3 px-4">Lộ trình</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredClasses.map(cls => (
                  <tr key={cls.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <div className="font-black text-slate-900 truncate" title={cls.name}>{cls.name}</div>
                      <div className="text-[11px] text-brand-primary font-bold mt-0.5">
                        {cls.registration?.subjectName} &bull; {cls.level?.name}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[180px]">
                      <div className="font-bold text-slate-800 truncate" title={getTutorDisplayName(cls)}>{getTutorDisplayName(cls)}</div>
                      <div className="text-[10px] text-slate-500 truncate" title={cls.tutorEmail}>{cls.tutorEmail}</div>
                      <div className="text-[10px] text-slate-400">{new Date(cls.createdAt).toLocaleDateString("vi-VN")}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        {cls.learningMode === "ONLINE" ? (
                          <span className="text-brand-primary flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Online</span>
                        ) : (
                          <span className="text-emerald-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Offline</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {cls.sessionsPerWeek} buổi/tuần ({cls.schedules.map(s => `T${s.dayOfWeek}`).join(", ")})
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900">{cls.pricePerSession?.toLocaleString("vi-VN")} đ/buổi</div>
                      <div className="text-[10px] text-slate-400">Tổng {cls.totalSessions} buổi</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600">
                        {cls.syllabusMode === "FORM" ? `${cls.chapters.length} chương` : cls.syllabusMode === "FILE" ? "File tài liệu" : `${cls.chapters.length} ch. + File`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {renderStatusBadge(cls.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedClass(cls)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-brand-primary hover:text-brand-primary text-[11px] font-bold inline-flex items-center gap-1 shadow-sm transition-all"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem
                        </button>

                        {cls.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleApprove(cls)}
                              disabled={actionBusy}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                              title="Duyệt lớp"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => {
                                setRejectingClass(cls);
                                setRejectReason("");
                              }}
                              disabled={actionBusy}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                              title="Từ chối lớp"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                  {selectedClass.registration?.subjectName} &bull; {selectedClass.level?.name}
                </span>
                <h3 className="font-display font-black text-xl text-slate-900 mt-1">{selectedClass.name}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Gia sư: <strong>{getTutorDisplayName(selectedClass)}</strong>
                  <span className="ml-1 text-slate-400">({selectedClass.tutorEmail})</span>
                </p>
              </div>

              <button 
                onClick={() => setSelectedClass(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Hình thức</span>
                <span className="font-black text-slate-800 mt-0.5 block">{selectedClass.learningMode}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Học phí / buổi</span>
                <span className="font-black text-brand-primary mt-0.5 block">{selectedClass.pricePerSession?.toLocaleString("vi-VN")} đ</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Tổng học phí</span>
                <span className="font-black text-slate-800 mt-0.5 block">{selectedClass.totalPrice?.toLocaleString("vi-VN")} đ</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Số buổi / tuần</span>
                <span className="font-black text-slate-800 mt-0.5 block">{selectedClass.sessionsPerWeek} buổi ({selectedClass.durationPerSessionMinutes} phút)</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Thời gian học</span>
                <span className="font-black text-slate-800 mt-0.5 block">{selectedClass.startDate} → {selectedClass.endDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Sĩ số tối đa</span>
                <span className="font-black text-slate-800 mt-0.5 block">{selectedClass.maxStudents} học viên</span>
              </div>
            </div>

            {/* Meeting Link or Address */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                {selectedClass.learningMode === "ONLINE" ? "Link phòng học trực tuyến:" : "Địa chỉ học trực tiếp:"}
              </span>
              {selectedClass.learningMode === "ONLINE" ? (
                <a 
                  href={selectedClass.meetingLink || "#"} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-bold text-brand-primary underline break-all inline-flex items-center gap-1"
                >
                  {selectedClass.meetingLink || "Chưa có link"} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="font-bold text-slate-800">{selectedClass.address || "Chưa có địa chỉ"}</span>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Mô tả khóa học</span>
              <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                {selectedClass.description}
              </p>
            </div>

            {/* Schedules */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Lịch học hàng tuần</span>
              <div className="flex flex-wrap gap-2">
                {selectedClass.schedules.map(s => {
                  const day = VIETNAMESE_DAYS.find(d => d.value === s.dayOfWeek)?.label || `Thứ ${s.dayOfWeek}`;
                  return (
                    <div key={s.id} className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20 font-bold">
                      {day}: {s.startTime} - {s.endTime}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Syllabus */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Lộ trình học (Syllabus)</span>
              
              {selectedClass.chapters && selectedClass.chapters.length > 0 && (
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  {selectedClass.chapters.map((ch, idx) => (
                    <div key={ch.id} className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>#{idx + 1}. {ch.title}</span>
                        <span className="text-[10px] text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md font-black">
                          {ch.expectedSessions} buổi
                        </span>
                      </div>
                      {ch.description && (
                        <p className="text-[11px] text-slate-500 mt-1">{ch.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedClass.syllabusFileUrl && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>File lộ trình chi tiết</span>
                  </div>
                  <a 
                    href={selectedClass.syllabusFileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 transition-all inline-flex items-center gap-1"
                  >
                    Xem / Tải file <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Đóng
              </button>

              {selectedClass.status === "PENDING_APPROVAL" && (
                <>
                  <button 
                    onClick={() => handleApprove(selectedClass)}
                    disabled={actionBusy}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    Phê duyệt lớp học
                  </button>
                  <button 
                    onClick={() => {
                      setRejectingClass(selectedClass);
                      setRejectReason("");
                    }}
                    disabled={actionBusy}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-md shadow-rose-600/20 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-display font-black text-lg text-slate-900">Từ chối duyệt lớp học</h3>
            <p className="text-xs text-slate-500 font-semibold">
              Lớp học: <strong>{rejectingClass.name}</strong> - Gia sư: <strong>{getTutorDisplayName(rejectingClass)}</strong>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Lý do từ chối cụ thể <span className="text-rose-500">*</span>
              </label>
              <textarea 
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Học phí chưa phù hợp, link phòng học không hợp lệ, lộ trình chưa đủ chi tiết..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button 
                onClick={() => setRejectingClass(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Hủy
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTutorDisplayName(classRoom: ClassItem) {
  return classRoom.tutorFullName?.trim() || classRoom.tutorEmail;
}
