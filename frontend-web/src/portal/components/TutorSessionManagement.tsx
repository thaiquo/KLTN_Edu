import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  Video,
  Users,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { classApi } from "../../api/classes";
import { ClassSessionsTimeline } from "../../components/classroom/ClassSessionsTimeline";

export const TutorSessionManagement: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMyClasses();
  }, []);

  const loadMyClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await classApi.getMyClasses();
      const list = Array.isArray(data) ? data : [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load tutor classes:", err);
      setError("Không thể tải danh sách lớp học của bạn.");
    } finally {
      setLoading(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Tiến Trình & Buổi Học Cuốn Chiếu
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Quản Lý Buổi Học & Điểm Danh
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl font-medium">
              Theo dõi lịch học theo tuần, giao bài tập/tài liệu trước nhiều ngày, điểm danh vào dạy 1 chạm và kiểm tra sĩ số lớp học trực tiếp.
            </p>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-indigo-200 font-semibold">Tổng Số Lớp Đang Dạy</div>
              <div className="text-xl font-black text-white">{classes.length} Lớp Học</div>
            </div>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      {/* 2. Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-slate-500 text-sm font-semibold">Đang tải danh sách lớp học và buổi học...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="text-rose-800 text-sm font-bold">{error}</p>
          <button
            onClick={loadMyClasses}
            className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700"
          >
            Thử Lại
          </button>
        </div>
      ) : classes.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-3xl text-center">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Bạn chưa tạo lớp học nào</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Vui lòng vào mục "My Classes" để tạo lớp học mới và bắt đầu mở tuyển sinh.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Selector Tabs */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 px-3 uppercase tracking-wider shrink-0">
              Chọn Lớp:
            </span>
            {classes.map((cls) => {
              const isSelected = cls.id === selectedClassId;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shrink-0 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  <span className="truncate max-w-[200px]">{cls.name || `Lớp học #${cls.id}`}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {cls.status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Class Info Header Card */}
          {selectedClass && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {selectedClass.registration?.subjectName || "Môn học"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                      Hình thức: {selectedClass.learningMode === "ONLINE" ? "Trực tuyến (Online)" : "Trực tiếp (Offline)"}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{selectedClass.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{selectedClass.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Khai Giảng</span>
                    <span className="font-bold text-slate-800">{selectedClass.startDate || "Chưa có"}</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng Số Buổi</span>
                    <span className="font-bold text-slate-800">{selectedClass.totalSessions} buổi ({selectedClass.sessionsPerWeek} buổi/tuần)</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Sĩ Số Lớp</span>
                    <span className="font-black text-emerald-800">
                      {selectedClass.acceptedCount || 0} / {selectedClass.maxStudents} Học viên
                    </span>
                  </div>
                </div>
              </div>

              {/* Sessions Timeline Component */}
              <div className="mt-6">
                <ClassSessionsTimeline
                  classRoomId={selectedClass.id}
                  classRoomName={selectedClass.name}
                  meetingLink={selectedClass.meetingLink}
                  currentUserRole="TUTOR"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
