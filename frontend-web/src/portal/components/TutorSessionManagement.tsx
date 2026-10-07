import React, { useState, useEffect, useMemo } from "react";
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
  ExternalLink,
  Radio,
  Search,
  ArrowUpDown,
  Filter,
  GraduationCap
} from "lucide-react";
import { classApi } from "../../api/classes";
import { ClassSessionsTimeline } from "../../components/classroom/ClassSessionsTimeline";
import { isClassLiveNow } from "../../utils/scheduleUtils";

const sessionDateTime = (dateValue?: string, timeValue?: string) => {
  if (!dateValue) return null;
  const [year, month, day] = String(dateValue).split("-").map(Number);
  if (!year || !month || !day) return null;
  const [hour = 0, minute = 0] = String(timeValue || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
};

const formatUpcomingLabel = (startsAt: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()).getTime();
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Ngày mai";
  return startsAt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
};

const getNextUpcomingSession = (cls: any) => {
  const schedules = Array.isArray(cls?.schedules) ? cls.schedules : [];
  if (schedules.length === 0) return null;
  const now = new Date();
  let best: any = null;

  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const projectDay = day.getDay() === 0 ? 8 : day.getDay() + 1;
    for (const schedule of schedules) {
      if (Number(schedule.dayOfWeek) !== projectDay) continue;
      const startsAt = sessionDateTime(
        `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
        schedule.startTime
      );
      if (!startsAt || startsAt.getTime() < now.getTime() - 30 * 60 * 1000) continue;
      if (!best || startsAt.getTime() < best.startsAt.getTime()) {
        best = {
          startsAt,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          label: formatUpcomingLabel(startsAt),
          timeLabel: `${formatUpcomingLabel(startsAt)} ${schedule.startTime || ""}`.trim()
        };
      }
    }
    if (best) break;
  }
  return best;
};

export const TutorSessionManagement: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "LIVE" | "ACTIVE">("ALL");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadMyClasses();
  }, []);

  const loadMyClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await classApi.getMyClasses();
      const list = Array.isArray(data) ? data : [];
      
      // Calculate live status and upcoming session for each class
      const enrichedList = list.map((cls) => {
        const liveInfo = isClassLiveNow({
          schedules: cls.schedules,
          currentDate: new Date()
        });
        const nextSession = getNextUpcomingSession(cls);
        return {
          ...cls,
          isLive: liveInfo.isLive,
          liveReason: liveInfo.reason,
          nextSession
        };
      });

      // Sort: Live classes first, then nearest upcoming sessions, then by name
      enrichedList.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        const aTime = a.nextSession?.startsAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.nextSession?.startsAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.name || "").localeCompare(String(b.name || ""), "vi");
      });

      setClasses(enrichedList);

      // Auto-select the live class if available, or first class
      const liveClass = enrichedList.find((c) => c.isLive);
      if (liveClass) {
        setSelectedClassId(liveClass.id);
      } else if (enrichedList.length > 0) {
        setSelectedClassId((prev) => (prev && enrichedList.some((c) => c.id === prev) ? prev : enrichedList[0].id));
      }
    } catch (err: any) {
      console.error("Failed to load tutor classes:", err);
      setError("Không thể tải danh sách lớp học của bạn.");
    } finally {
      setLoading(false);
    }
  };

  const activeLiveClasses = useMemo(() => {
    return classes.filter((cls) => {
      const live = isClassLiveNow({ schedules: cls.schedules, currentDate: currentTime });
      return live.isLive;
    });
  }, [classes, currentTime]);

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (activeFilter === "LIVE" && !cls.isLive) return false;
      if (activeFilter === "ACTIVE" && cls.status !== "ACTIVE" && cls.status !== "PUBLISHED") return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchName = String(cls.name || "").toLowerCase().includes(q);
        const matchSubject = String(cls.registration?.subjectName || "").toLowerCase().includes(q);
        if (!matchName && !matchSubject) return false;
      }
      return true;
    });
  }, [classes, activeFilter, searchKeyword]);

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
              Theo dõi lịch học theo tuần, tự động đẩy lớp đang diễn ra lên đầu, điểm danh vào dạy 1 chạm và kiểm tra sổ điểm danh học viên trực tiếp.
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

      {/* 2. Live Class Spotlight Banner (Khi đến giờ dạy lớp nào thì nháy thông báo & đẩy lên) */}
      {activeLiveClasses.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 sm:p-5 text-white shadow-lg shadow-emerald-600/20 animate-fadeIn">
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white shrink-0 shadow-sm">
                <Radio className="animate-pulse" size={22} />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-emerald-700"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    Đang Diễn Ra · Đến Giờ Dạy
                  </span>
                  <h3 className="text-sm sm:text-base font-black font-display text-white">
                    {activeLiveClasses.length === 1
                      ? `Lớp "${activeLiveClasses[0].name || `Lớp #${activeLiveClasses[0].id}`}" đang trong khung giờ dạy!`
                      : `Bạn có ${activeLiveClasses.length} lớp học đang diễn ra ngay lúc này!`}
                  </h3>
                </div>
                <p className="text-xs text-emerald-100 mt-1 leading-relaxed font-medium">
                  Hệ thống đã tự động đẩy lớp học này lên đầu. Bấm "Vào Lớp & Điểm Danh Ngay" để mở sổ điểm danh và vào phòng dạy trực tuyến.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId(activeLiveClasses[0].id);
                  setTimeout(() => {
                    const el = document.getElementById("sessions-timeline-list") || document.getElementById("active-classroom-section");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-900 shadow-md transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
              >
                <Video size={15} className="text-emerald-700 animate-pulse" />
                <span>Vào Lớp & Điểm Danh Ngay</span>
                <ChevronRight size={14} className="text-emerald-700" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Content Area */}
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
            Vui lòng vào mục "Quản lý Lớp học" để tạo lớp học mới và bắt đầu mở tuyển sinh.
          </p>
        </div>
      ) : (
        <div className="space-y-6" id="active-classroom-section">
          {/* Class Filter & Selection Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
                  Lọc Lớp:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({classes.length})
                </button>
                {activeLiveClasses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("LIVE")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                      activeFilter === "LIVE"
                        ? "bg-rose-600 text-white shadow-xs animate-pulse"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Đang diễn ra ({activeLiveClasses.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeFilter === "ACTIVE"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Đang hoạt động ({classes.filter((c) => c.status === "ACTIVE" || c.status === "PUBLISHED").length})
                </button>
              </div>

              {/* Search box */}
              <div className="relative sm:w-64 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm theo tên lớp, môn học..."
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                />
              </div>
            </div>

            {/* Class Cards Selector Grid */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-thin">
              <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
                Chọn Lớp:
              </span>
              {filteredClasses.length === 0 ? (
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500">
                  Không có lớp phù hợp bộ lọc.
                </div>
              ) : (
                filteredClasses.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  const isLive = cls.isLive;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? isLive
                            ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-300"
                            : "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                          : isLive
                          ? "bg-rose-50 text-rose-800 border-2 border-rose-300 hover:bg-rose-100 animate-pulse"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {isLive && (
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                      )}
                      <span className="truncate max-w-[200px]">{cls.name || `Lớp học #${cls.id}`}</span>

                      {isLive ? (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          isSelected ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900"
                        }`}>
                          ĐANG DẠY
                        </span>
                      ) : cls.nextSession?.timeLabel ? (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        }`}>
                          {cls.nextSession.timeLabel}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        }`}>
                          {cls.status}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Class Workspace & Info Card */}
          {selectedClass && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {selectedClass.registration?.subjectName || "Môn học"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                      Hình thức: {selectedClass.learningMode === "ONLINE" ? "Trực tuyến (Online)" : "Trực tiếp (Offline)"}
                    </span>
                    {selectedClass.isLive && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1.5 animate-pulse shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        ĐANG TRONG KHUNG GIỜ HỌC
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-slate-900 font-display">{selectedClass.name}</h2>
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
              <div className="mt-6" id="sessions-timeline-list">
                <ClassSessionsTimeline
                  classRoomId={selectedClass.id}
                  classRoomName={selectedClass.name}
                  meetingLink={selectedClass.meetingLink}
                  learningMode={selectedClass.learningMode}
                  address={selectedClass.address}
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
