import React, { useState, useEffect } from "react";
import { 
  GraduationCap, Plus, Calendar, Clock, DollarSign, Users, 
  Video, MapPin, AlertCircle, CheckCircle2, XCircle, Search, 
  ChevronRight, Trash2, Eye, FileText, Sparkles 
} from "lucide-react";
import { classApi } from "../../api/classes";
import { CreateClassWizard } from "./CreateClassWizard";

interface ClassRoomItem {
  id: number;
  name: string;
  description: string;
  registration?: {
    subjectName: string;
    tuitionMin: number;
    tuitionMax: number;
  };
  level?: {
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
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "CLOSED" | "CANCELLED";
  rejectReason?: string;
  schedules: Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string }>;
  chapters: Array<{ id: number; title: string; description: string; expectedSessions: number; orderIndex: number }>;
  createdAt: string;
}

const VIETNAMESE_DAYS = [
  { value: 2, label: "T2" },
  { value: 3, label: "T3" },
  { value: 4, label: "T4" },
  { value: 5, label: "T5" },
  { value: 6, label: "T6" },
  { value: 7, label: "T7" },
  { value: 8, label: "CN" }
];

export function TutorClassManagement() {
  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedClass, setSelectedClass] = useState<ClassRoomItem | null>(null);
  const [classes, setClasses] = useState<ClassRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classApi.getMyClasses();
      setClasses(data || []);
    } catch (err) {
      console.error("Failed to load classes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleDeleteClass = async (classRoom: ClassRoomItem) => {
    const confirmation = classRoom.status === "PENDING_APPROVAL"
      ? "Lớp đang chờ duyệt. Bạn có chắc muốn rút và xóa lớp này?"
      : "Bạn có chắc chắn muốn xóa lớp học này?";
    if (!window.confirm(confirmation)) return;
    try {
      await classApi.deleteClass(classRoom.id);
      await loadClasses();
    } catch (err: any) {
      alert(err?.message || "Không thể xóa lớp học.");
    }
  };

  // Filtered classes
  const filteredClasses = classes.filter(c => {
    if (activeFilter !== "ALL" && c.status !== activeFilter) return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchSubject = c.registration?.subjectName?.toLowerCase().includes(q);
      const matchLevel = c.level?.name?.toLowerCase().includes(q);
      return matchName || matchSubject || matchLevel;
    }
    return true;
  });

  // Statistics
  const stats = {
    total: classes.length,
    active: classes.filter(c => c.status === "ACTIVE").length,
    pending: classes.filter(c => c.status === "PENDING_APPROVAL").length,
    rejected: classes.filter(c => c.status === "REJECTED").length
  };

  if (viewMode === "create") {
    return (
      <CreateClassWizard 
        onBack={() => setViewMode("list")} 
        onSuccess={() => {
          setViewMode("list");
          loadClasses();
        }} 
      />
    );
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đang mở lớp
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Chờ Admin duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Bị từ chối
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white border border-brand-border/30 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-brand-text">Quản lý Lớp học của tôi</h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Tạo và quản lý các khóa học dựa trên danh mục môn & cấp độ đã được Admin duyệt.
            </p>
          </div>
        </div>

        <button
          onClick={() => setViewMode("create")}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-white font-black text-xs hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Lớp Học Mới</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm">
            {stats.total}
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Tổng số lớp</span>
            <span className="text-xs font-black text-slate-800 block">Đã tạo</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-sm">
            {stats.pending}
          </div>
          <div>
            <span className="text-[11px] font-bold text-amber-500 uppercase">Chờ duyệt</span>
            <span className="text-xs font-black text-slate-800 block">Đang chờ xử lý</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm">
            {stats.active}
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-500 uppercase">Đang mở</span>
            <span className="text-xs font-black text-slate-800 block">Được phê duyệt</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black text-sm">
            {stats.rejected}
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-500 uppercase">Bị từ chối</span>
            <span className="text-xs font-black text-slate-800 block">Cần điều chỉnh</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-brand-border/30 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "PENDING_APPROVAL", label: `Chờ duyệt (${stats.pending})` },
            { id: "ACTIVE", label: `Đang mở (${stats.active})` },
            { id: "REJECTED", label: `Bị từ chối (${stats.rejected})` },
            { id: "DRAFT", label: "Bản nháp" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === tab.id
                  ? "bg-brand-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên lớp, môn..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      {/* Class List */}
      {loading ? (
        <div className="bg-white border border-brand-border/30 rounded-3xl p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xs font-bold text-slate-500">Đang tải danh sách lớp học...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white border border-brand-border/30 rounded-3xl p-12 text-center space-y-4">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-display font-black text-base text-slate-800">Không tìm thấy lớp học nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {classes.length === 0 
              ? "Bạn chưa tạo lớp học nào. Hãy nhấn 'Tạo Lớp Học Mới' để mở khóa học đầu tiên!"
              : "Không có lớp học nào khớp với bộ lọc hiện tại."}
          </p>
          {classes.length === 0 && (
            <button
              onClick={() => setViewMode("create")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Tạo lớp ngay
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClasses.map(cls => (
            <div 
              key={cls.id} 
              className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/40 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                {/* Subject & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-[11px] font-black uppercase tracking-wider">
                    {cls.registration?.subjectName || "Môn học"} &bull; {cls.level?.name || "Cấp độ"}
                  </span>
                  {renderStatusBadge(cls.status)}
                </div>

                {/* Class Title */}
                <div>
                  <h3 className="font-display font-black text-base text-slate-900 line-clamp-1">{cls.name}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1">{cls.description}</p>
                </div>

                {/* Reject Reason Banner if any */}
                {cls.status === "REJECTED" && cls.rejectReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                    <strong>Lý do từ chối:</strong> {cls.rejectReason}
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    {cls.learningMode === "ONLINE" ? (
                      <Video className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                    <span className="font-bold truncate">
                      {cls.learningMode === "ONLINE" ? "Học Online" : (cls.address || "Học Offline")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-bold">Tối đa {cls.maxStudents} học viên</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-bold">{cls.sessionsPerWeek} buổi/tuần &bull; {cls.durationPerSessionMinutes}p</span>
                  </div>

                  <div className="flex items-center gap-2 text-brand-primary font-black">
                    <DollarSign className="w-4 h-4 flex-shrink-0" />
                    <span>{cls.pricePerSession.toLocaleString("vi-VN")} đ / buổi</span>
                  </div>
                </div>

                {/* Schedule Days Badges */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Lịch học:</span>
                  {cls.schedules.map(s => {
                    const dayLabel = VIETNAMESE_DAYS.find(d => d.value === s.dayOfWeek)?.label || `T${s.dayOfWeek}`;
                    return (
                      <span key={s.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {dayLabel} ({s.startTime} - {s.endTime})
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold text-[11px]">
                  Tổng {cls.totalSessions} buổi &bull; {cls.totalPrice?.toLocaleString("vi-VN")} đ
                </span>

                <div className="flex items-center gap-2">
                  {(cls.status === "DRAFT" || cls.status === "REJECTED" || cls.status === "PENDING_APPROVAL") && (
                    <button
                      onClick={() => handleDeleteClass(cls)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title={cls.status === "PENDING_APPROVAL" ? "Rút và xóa lớp chờ duyệt" : "Xóa lớp"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
