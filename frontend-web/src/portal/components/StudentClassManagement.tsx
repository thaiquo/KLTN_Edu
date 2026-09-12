import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  GraduationCap,
  ShieldCheck,
  FileText,
  Search,
  ArrowUpDown
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { classApi } from "../../api/classes";
import { contractsApi } from "../../api/contractsApi";
import { ClassSessionsTimeline } from "../../components/classroom/ClassSessionsTimeline";

interface StudentClassManagementProps {
  onNavigate?: (tab: string) => void;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

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

const fallbackNextSession = (cls: any) => {
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

const compareClassesByUpcoming = (a: any, b: any) => {
  const aTime = a?.nextSession?.startsAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
  const bTime = b?.nextSession?.startsAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
};

const dateValue = (value?: string) => {
  const time = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

export const StudentClassManagement: React.FC<StudentClassManagementProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [pendingContractsCount, setPendingContractsCount] = useState<number>(0);
  const [classFilter, setClassFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [classSearch, setClassSearch] = useState<string>("");
  const [classSort, setClassSort] = useState<'UPCOMING' | 'NAME' | 'START_DATE'>('UPCOMING');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadMyClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const studentEmail = (user.email || "").trim().toLowerCase();
      const studentId = user.id;
      const classMap = new Map<number, any>();
      let pendingCount = 0;

      // 1. Lấy từ Hợp đồng & Ký quỹ Escrow (Chỉ lấy ACTIVE và COMPLETED cho lớp đang học)
      try {
        const contractsData = await contractsApi.listAgreements({
          size: 50
        });
        const agreements = Array.isArray(contractsData)
          ? contractsData
          : contractsData?.content || [];

        // Lọc nghiêm ngặt hợp đồng của học viên này
        const myAgreements = agreements.filter((agr: any) => {
          const agrEmail = (agr.studentEmail || "").trim().toLowerCase();
          const agrId = agr.studentId;
          const matchEmail = studentEmail && agrEmail && agrEmail === studentEmail;
          const matchId = studentId && agrId && Number(agrId) === Number(studentId);
          return matchEmail || matchId;
        });

        for (const agr of myAgreements) {
          // Đếm các hợp đồng đang chờ xử lý
          if (agr.status === 'WAITING_PAYMENT' || agr.status === 'PENDING_STUDENT_ACCEPTANCE') {
            pendingCount++;
          }

          // Chỉ thêm vào Lớp học của tôi nếu đã nạp cọc (ACTIVE) hoặc đã kết thúc (COMPLETED)
          if ((agr.status === 'ACTIVE' || agr.status === 'COMPLETED') && agr.classroomId) {
            try {
              const cls = await classApi.getPublicClassById(agr.classroomId);
              if (cls && cls.id) {
                classMap.set(cls.id, {
                  ...cls,
                  agreementId: agr.id,
                  agreementStatus: agr.status,
                  escrowDeposit: agr.totalAmountUsdc
                });
              }
            } catch {
              classMap.set(agr.classroomId, {
                id: agr.classroomId,
                name: agr.className || `Lớp học #${agr.classroomId}`,
                tutorFullName: agr.tutorName,
                tutorEmail: agr.tutorEmail,
                status: agr.status,
                agreementId: agr.id,
                agreementStatus: agr.status,
                escrowDeposit: agr.totalAmountUsdc
              });
            }
          }
        }
      } catch (e) {
        console.warn("Could not load agreements for student:", e);
      }

      // 2. Lấy từ Danh sách yêu cầu ghi danh của riêng học viên này
      try {
        const requests = await classApi.getMyEnrollmentRequests();
        if (Array.isArray(requests)) {
          const myRequests = requests.filter((r: any) => {
            const reqEmail = (r.studentEmail || "").trim().toLowerCase();
            const matchEmail = studentEmail && reqEmail && reqEmail === studentEmail;
            return matchEmail;
          });

          for (const req of myRequests) {
            if (req.status === 'ACCEPTED') {
              // Yêu cầu đã chấp nhận nhưng chưa thành ACTIVE
              pendingCount++;
            } else if ((req.status === "ENROLLED" || req.status === "COMPLETED") && req.classRoomId) {
              // Chỉ thêm vào lớp học nếu ENROLLED hoặc COMPLETED
              if (!classMap.has(req.classRoomId)) {
                try {
                  const cls = await classApi.getPublicClassById(req.classRoomId);
                  if (cls && cls.id) {
                    classMap.set(cls.id, {
                      ...cls,
                      enrollmentStatus: req.status
                    });
                  }
                } catch {
                  classMap.set(req.classRoomId, {
                    id: req.classRoomId,
                    name: req.className || `Lớp học #${req.classRoomId}`,
                    tutorEmail: req.tutorEmail,
                    status: req.status,
                    enrollmentStatus: req.status
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("Could not load enrollment requests for student:", e);
      }

      let list = Array.from(classMap.values());
      try {
        const scheduleData = await classApi.getStudentSchedule();
        const upcomingByClassId = new Map<number, any>();
        const now = new Date();
        const sessions = Array.isArray(scheduleData?.sessions) ? scheduleData.sessions : [];
        sessions
          .filter((session: any) => String(session.status || "").toUpperCase() !== "COMPLETED")
          .map((session: any) => ({
            ...session,
            startsAt: sessionDateTime(session.sessionDate, session.startTime)
          }))
          .filter((session: any) => session.startsAt && session.startsAt.getTime() >= now.getTime() - 30 * 60 * 1000)
          .sort((a: any, b: any) => a.startsAt.getTime() - b.startsAt.getTime())
          .forEach((session: any) => {
            const classId = Number(session.classRoomId);
            if (classId && !upcomingByClassId.has(classId)) {
              upcomingByClassId.set(classId, {
                ...session,
                label: `${formatUpcomingLabel(session.startsAt)} - Buổi ${session.sequenceNumber || ""}`.trim(),
                timeLabel: `${formatUpcomingLabel(session.startsAt)} ${session.startTime || ""}`.trim()
              });
            }
          });

        list = list.map((cls) => ({
          ...cls,
          nextSession: upcomingByClassId.get(Number(cls.id)) || fallbackNextSession(cls)
        }));
      } catch (e) {
        console.warn("Could not load student schedule for class ordering:", e);
        list = list.map((cls) => ({
          ...cls,
          nextSession: fallbackNextSession(cls)
        }));
      }

      list.sort(compareClassesByUpcoming);
      setPendingContractsCount(pendingCount);
      setClasses(list);
      if (list.length > 0) {
        setSelectedClassId((prev) => (prev && list.some((cls) => cls.id === prev) ? prev : list[0].id));
      } else {
        setSelectedClassId(null);
      }
    } catch (err: any) {
      console.error("Failed to load student classes:", err);
      setError("Không thể tải danh sách lớp học của bạn.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      loadMyClasses();
    }
  }, [user?.email, loadMyClasses]);

  const filteredClasses = useMemo(() => {
    const keyword = normalizeText(classSearch);
    const result = classes.filter((cls) => {
      const isCompleted = cls.agreementStatus === 'COMPLETED' || cls.enrollmentStatus === 'COMPLETED' || cls.status === 'COMPLETED';
      if (classFilter === 'COMPLETED') return isCompleted;
      if (classFilter === 'ACTIVE' && isCompleted) return false;
      if (!keyword) return true;
      const searchText = normalizeText([
        cls.name,
        cls.className,
        cls.tutorFullName,
        cls.tutorName,
        cls.tutorEmail,
        cls.subjectName,
        cls.registration?.subjectName,
        cls.nextSession?.label,
        cls.nextSession?.timeLabel
      ].filter(Boolean).join(" "));
      return searchText.includes(keyword);
    });

    return [...result].sort((a, b) => {
      if (classSort === 'NAME') {
        return String(a.name || "").localeCompare(String(b.name || ""), "vi");
      }
      if (classSort === 'START_DATE') {
        return dateValue(a.startDate) - dateValue(b.startDate);
      }
      return compareClassesByUpcoming(a, b);
    });
  }, [classes, classFilter, classSearch, classSort]);

  const selectedClass = useMemo(() => {
    if (selectedClassId) {
      const match = filteredClasses.find((c) => c.id === selectedClassId);
      if (match) return match;
    }
    return filteredClasses[0] || null;
  }, [filteredClasses, selectedClassId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
              Không Gian Học Tập Trực Tuyến
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Lớp Học Của Tôi & Lịch Học Cuốn Chiếu
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl font-medium">
              Không gian học tập chính thức: theo dõi lịch học theo tuần, điểm danh vào học 1 chạm trong khung giờ học, mở khóa bài tập và tham gia phòng học trực tuyến.
            </p>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-blue-200 font-semibold">Lớp Học Đã Tham Gia</div>
              <div className="text-xl font-black text-white">{classes.length} Lớp Học</div>
            </div>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      {/* 2. Pending Contracts Banner */}
      {pendingContractsCount > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-blue-950 font-display">
                Bạn có {pendingContractsCount} lớp học đang chờ ký hợp đồng & nạp cọc Escrow
              </h3>
              <p className="text-xs text-blue-800 mt-0.5 leading-relaxed font-medium">
                Gia sư đã chấp thuận yêu cầu. Bạn cần hoàn tất ký xác nhận hợp đồng điện tử và nạp cọc bảo vệ để chính thức xuất hiện tại không gian lớp học này.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate ? onNavigate('contracts') : (window.location.href = '/contracts')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Ký quỹ vào lớp ngay</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 text-sm font-semibold">Đang tải danh sách lớp học của bạn...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="text-rose-800 text-sm font-bold">{error}</p>
          <button
            onClick={loadMyClasses}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
          >
            Thử Lại
          </button>
        </div>
      ) : classes.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-3xl text-center">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Bạn chưa tham gia lớp học nào</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {pendingContractsCount > 0
              ? `Bạn đang có ${pendingContractsCount} hợp đồng chờ ký quỹ. Sau khi ký quỹ thành công, lớp học sẽ hiển thị tại đây.`
              : "Khám phá các lớp học chất lượng cao từ các gia sư uy tín và đăng ký để bắt đầu lộ trình học tập."}
          </p>
          {pendingContractsCount > 0 ? (
            <button
              onClick={() => onNavigate ? onNavigate('contracts') : (window.location.href = '/contracts')}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Đi Đến Hợp Đồng & Ký Quỹ</span>
            </button>
          ) : (
            <a
              href="/classes"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Khám Phá Tìm Lớp Ngay</span>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Selector Tabs & Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
                Lọc:
              </span>
              <button
                onClick={() => setClassFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  classFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({classes.length})
              </button>
              <button
                onClick={() => setClassFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  classFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Đang học ({classes.filter(c => c.agreementStatus !== 'COMPLETED' && c.enrollmentStatus !== 'COMPLETED').length})
              </button>
              <button
                onClick={() => setClassFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  classFilter === 'COMPLETED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Đã hoàn thành ({classes.filter(c => c.agreementStatus === 'COMPLETED' || c.enrollmentStatus === 'COMPLETED').length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={classSearch}
                  onChange={(event) => setClassSearch(event.target.value)}
                  placeholder="Tìm tên lớp, gia sư, môn..."
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </label>
              <label className="relative sm:w-[220px]">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={classSort}
                  onChange={(event) => setClassSort(event.target.value as typeof classSort)}
                  className="w-full h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="UPCOMING">Sắp diễn ra trước</option>
                  <option value="NAME">Theo tên lớp</option>
                  <option value="START_DATE">Theo ngày khai giảng</option>
                </select>
              </label>
            </div>

            {/* Class buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 sm:pt-0">
              <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
                Chọn lớp:
              </span>
              {filteredClasses.length === 0 ? (
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500">
                  Không có lớp phù hợp bộ lọc.
                </div>
              ) : filteredClasses.map((cls) => {
                const isSelected = selectedClass?.id === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span className="truncate max-w-[190px]">{cls.name || `Lớp học #${cls.id}`}</span>
                    {cls.nextSession?.timeLabel && (
                      <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {cls.nextSession.timeLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Class Info Header Card */}
          {selectedClass && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {selectedClass.registration?.subjectName || selectedClass.subjectName || "Môn học"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                      Gia sư: <b>{selectedClass.tutorFullName || "Gia sư"}</b>
                      {selectedClass.tutorEmail && (
                        <span className="ml-1 text-slate-500 font-normal">({selectedClass.tutorEmail})</span>
                      )}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Smart Contract Escrow Bảo Vệ
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{selectedClass.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{selectedClass.description}</p>
                  {selectedClass.nextSession && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>
                        Buổi gần nhất: {selectedClass.nextSession.label}
                        {selectedClass.nextSession.startTime ? ` · ${selectedClass.nextSession.startTime}${selectedClass.nextSession.endTime ? ` - ${selectedClass.nextSession.endTime}` : ""}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Khai Giảng</span>
                    <span className="font-bold text-slate-800">{selectedClass.startDate || "Chưa có"}</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng Số Buổi</span>
                    <span className="font-bold text-slate-800">{selectedClass.totalSessions || 12} buổi</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Hình Thức</span>
                    <span className="font-black text-emerald-800">
                      {selectedClass.learningMode === "OFFLINE" ? "Học Trực Tiếp (Offline)" : "Trực Tuyến (Google Meet)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sessions Timeline Component directly for enrolled students */}
              <div className="mt-6">
                <ClassSessionsTimeline
                  classRoomId={selectedClass.id}
                  classRoomName={selectedClass.name}
                  meetingLink={selectedClass.meetingLink}
                  currentUserRole="STUDENT"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentClassManagement;
