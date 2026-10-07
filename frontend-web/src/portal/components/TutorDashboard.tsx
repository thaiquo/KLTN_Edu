import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  HelpCircle,
  Loader2,
  MapPin,
  RefreshCw,
  User,
  Users,
  Video,
  X
} from "lucide-react";
import { classApi } from "../../api/classes";

type EnrollmentRequestItem = {
  id: number;
  classRoomId: number;
  className?: string;
  studentId?: number;
  studentEmail?: string;
  studentName?: string;
  status?: string;
  note?: string;
};

type TutorClassItem = {
  id: number;
  name?: string;
  status?: string;
  learningMode?: "ONLINE" | "OFFLINE";
  meetingLink?: string;
  address?: string;
  acceptedCount?: number;
  durationPerSessionMinutes?: number;
  schedules?: Array<{
    id?: number;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
  }>;
  registration?: {
    subjectName?: string;
  };
};

type HomeworkItem = {
  assignmentTitle?: string;
  assignmentDescription?: string;
  assignmentFileUrl?: string;
  assignmentFiles?: unknown[];
  submittedCount?: number;
  gradedCount?: number;
};

type TodayScheduleItem = {
  id: string;
  time: string;
  period: string;
  title: string;
  detailType: "students" | "location" | "virtual";
  detailValue: string;
  status: "active" | "past";
};

interface TutorDashboardProps {
  userName: string;
  onNavigate: (page: string) => void;
}

const ACTIVE_CLASS_STATUSES = new Set(["ACTIVE"]);
const ACTIVE_STUDENT_REQUEST_STATUSES = new Set(["ACCEPTED", "ENROLLED"]);

function projectDayOfWeek(date = new Date()) {
  return date.getDay() === 0 ? 8 : date.getDay() + 1;
}

function timeLabel(value?: string) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function periodLabel(start?: string, end?: string) {
  const from = timeLabel(start);
  const to = timeLabel(end);
  return to === "--:--" ? "" : `${from} - ${to}`;
}

function isPastTime(value?: string) {
  if (!value) return false;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
  const now = new Date();
  return hour * 60 + minute < now.getHours() * 60 + now.getMinutes();
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0";
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function hasHomeworkContent(item: HomeworkItem) {
  return Boolean(
    item.assignmentTitle ||
    item.assignmentDescription ||
    item.assignmentFileUrl ||
    (Array.isArray(item.assignmentFiles) && item.assignmentFiles.length > 0)
  );
}

function initials(name?: string, email?: string) {
  const source = (name || email || "H").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function TutorDashboard({ userName, onNavigate }: TutorDashboardProps) {
  const [classStats, setClassStats] = useState<{ activeCount?: number } | null>(null);
  const [classes, setClasses] = useState<TutorClassItem[]>([]);
  const [requests, setRequests] = useState<EnrollmentRequestItem[]>([]);
  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, classData, requestData, homeworkData] = await Promise.all([
        classApi.getMyClassStats(),
        classApi.getMyClasses(),
        classApi.getAllTutorRequests(),
        classApi.getTutorHomeworkOverview()
      ]);

      setClassStats(statsData || null);
      setClasses(Array.isArray(classData) ? classData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
      setHomeworkItems(Array.isArray(homeworkData) ? homeworkData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu bảng điều khiển.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeClasses = useMemo(
    () => classes.filter((item) => ACTIVE_CLASS_STATUSES.has(String(item.status || "").toUpperCase())),
    [classes]
  );

  const activeClassIds = useMemo(() => new Set(activeClasses.map((item) => Number(item.id))), [activeClasses]);

  const pendingRequests = useMemo(
    () => requests.filter((item) => String(item.status || "").toUpperCase() === "PENDING"),
    [requests]
  );

  const activeStudentCount = useMemo(() => {
    const unique = new Set<string>();
    requests.forEach((item) => {
      const status = String(item.status || "").toUpperCase();
      if (!ACTIVE_STUDENT_REQUEST_STATUSES.has(status)) return;
      if (activeClassIds.size && !activeClassIds.has(Number(item.classRoomId))) return;
      const key = item.studentId != null ? `id:${item.studentId}` : item.studentEmail ? `email:${item.studentEmail.toLowerCase()}` : null;
      if (key) unique.add(key);
    });
    return unique.size;
  }, [activeClassIds, requests]);

  const weeklyScheduledHours = useMemo(() => {
    return activeClasses.reduce((sum, classItem) => {
      const sessions = Array.isArray(classItem.schedules) ? classItem.schedules.length : 0;
      const minutes = Number(classItem.durationPerSessionMinutes || 0);
      return sum + (sessions * minutes) / 60;
    }, 0);
  }, [activeClasses]);

  const pendingHomeworkCount = useMemo(() => {
    return homeworkItems.reduce((sum, item) => {
      if (!hasHomeworkContent(item)) return sum;
      const submitted = Number(item.submittedCount || 0);
      const graded = Number(item.gradedCount || 0);
      return sum + Math.max(0, submitted - graded);
    }, 0);
  }, [homeworkItems]);

  const todaySchedule = useMemo<TodayScheduleItem[]>(() => {
    const today = projectDayOfWeek();
    return activeClasses
      .flatMap((classItem) => (classItem.schedules || [])
        .filter((schedule) => Number(schedule.dayOfWeek) === today)
        .map((schedule) => {
          const online = classItem.learningMode === "ONLINE";
          return {
            id: `${classItem.id}-${schedule.id || schedule.startTime}`,
            time: timeLabel(schedule.startTime),
            period: periodLabel(schedule.startTime, schedule.endTime),
            title: classItem.name || classItem.registration?.subjectName || "Lớp học",
            detailType: online ? "virtual" as const : classItem.address ? "location" as const : "students" as const,
            detailValue: online
              ? "Học trực tuyến"
              : classItem.address || `${Number(classItem.acceptedCount || 0)} học viên`,
            status: isPastTime(schedule.endTime || schedule.startTime) ? "past" as const : "active" as const
          };
        }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [activeClasses]);

  const stats = [
    {
      title: "Lớp học đang dạy",
      value: String(classStats?.activeCount ?? activeClasses.length),
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Học viên đang học",
      value: String(activeStudentCount),
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      title: "Giờ dạy theo lịch tuần này",
      value: formatHours(weeklyScheduledHours),
      icon: Calendar,
      color: "text-violet-600",
      bg: "bg-violet-50"
    },
    {
      title: "Bài chờ chấm",
      value: String(pendingHomeworkCount),
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50"
    }
  ];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleAccept = async (id: number) => {
    setActionId(id);
    try {
      await classApi.acceptEnrollmentRequest(id);
      showToast("Đã chấp nhận yêu cầu học");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chấp nhận yêu cầu học.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionId(id);
    try {
      await classApi.rejectEnrollmentRequest(id, "Gia sư đã từ chối yêu cầu từ bảng điều khiển.");
      showToast("Đã từ chối yêu cầu học");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể từ chối yêu cầu học.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-8 select-none font-sans max-w-7xl mx-auto pb-10">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-white/10 animate-slide-in">
          <Check className="w-5 h-5 text-emerald-300" />
          <p className="text-sm font-semibold">{toast}</p>
        </div>
      )}

      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] tracking-tight">
            Chào mừng trở lại, {userName}!
          </h2>
          <p className="text-slate-500 text-[15px] mt-1 font-medium">
            Bạn có <span className="text-blue-600 font-bold">{pendingRequests.length}</span> yêu cầu học đang chờ và{" "}
            <span className="text-blue-600 font-bold">{todaySchedule.length}</span> lịch dạy trong hôm nay.
          </p>
        </div>
        <button
          onClick={() => onNavigate("class-management")}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-[14px] font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0 inline-flex items-center gap-2"
        >
          Quản lý lớp học <ChevronRight size={16} />
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-red-700 shadow-sm hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors cursor-default"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{loading ? "..." : stat.value}</h3>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" /> Yêu cầu học mới
              </h3>
              <button
                onClick={() => onNavigate("requests")}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Xem tất cả
              </button>
            </div>
            <div className="p-6">
              {loading ? (
                <LoadingBlock text="Đang tải yêu cầu học..." />
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Không có yêu cầu học nào đang chờ duyệt.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border border-slate-100 rounded-xl hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-blue-600 shrink-0">
                          {initials(req.studentName, req.studentEmail)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#0F172A] text-[15px] truncate">
                            {req.studentName || req.studentEmail || "Học viên"}
                          </p>
                          <p className="text-sm text-slate-500 font-medium mt-0.5 truncate">
                            {req.className || `Lớp #${req.classRoomId}`}
                          </p>
                          {req.note && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{req.note}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={actionId === req.id}
                          className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
                        >
                          {actionId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Chấp nhận
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={actionId === req.id}
                          className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
                        >
                          <X className="w-4 h-4" /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0F172A] text-[16px] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" /> Lịch dạy hôm nay
              </h3>
            </div>
            <div className="p-5">
              {loading ? (
                <LoadingBlock text="Đang tải lịch dạy..." />
              ) : todaySchedule.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6 font-medium">
                  Hôm nay chưa có lịch dạy.
                </p>
              ) : (
                <div className="space-y-3">
                  {todaySchedule.map((item) => {
                    const past = item.status === "past";
                    const cardBg = past ? "bg-slate-50 border-transparent opacity-60 grayscale" : "bg-blue-50/50 border border-blue-100 shadow-sm";
                    const timeColor = past ? "text-slate-400" : "text-blue-600";

                    return (
                      <div
                        key={item.id}
                        className={`flex gap-3 p-3.5 rounded-xl transition-all ${cardBg}`}
                      >
                        <div className="text-center min-w-[56px] border-r border-slate-200/60 pr-3 flex flex-col justify-center">
                          <p className={`text-sm font-bold ${timeColor}`}>{item.time}</p>
                          {item.period && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.period}
                            </p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pl-1">
                          <p className="font-bold text-[#0F172A] text-[13px] truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium truncate">
                            {item.detailType === "students" && <User className="w-3.5 h-3.5 text-slate-400" />}
                            {item.detailType === "virtual" && <Video className="w-3.5 h-3.5 text-blue-400" />}
                            {item.detailType === "location" && <MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                            {item.detailValue}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-200" /> Cần trợ giúp?
              </h3>
              <p className="text-blue-100 text-sm mb-5 leading-relaxed font-medium">
                Tìm hiểu thêm về cách quản lý lớp học và yêu cầu học trên EduConnect.
              </p>
              <button
                onClick={() => onNavigate("help")}
                className="w-full py-2.5 bg-white text-blue-700 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors"
              >
                Xem hướng dẫn
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}
