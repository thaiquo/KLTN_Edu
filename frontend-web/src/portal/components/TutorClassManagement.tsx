import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  PlusCircle,
  Clock,
  Calendar,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  BookOpen,
  Info,
  ChevronRight,
} from "lucide-react";
import { classroomApi } from "../../api/classroom";
import { tutorAvailabilityApi } from "../../api/tutorAvailability";
import { useAuth } from "../../hooks/useAuth";
import { levelGroupLabelVi, levelLabelVi, subjectLabelVi } from "../tutorApplication";

interface ApprovedSubject {
  teachingRegistrationId: string;
  levelGroup: string;
  subjectName: string;
  teachingLevel: string;
}

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface ScheduleItem {
  dayOfWeek: string;
  startTime: string;
}

interface ClassRoom {
  id: string;
  tutorId: string;
  teachingRegistrationId: string;
  subjectName: string;
  teachingLevel: string;
  name: string;
  description: string;
  maxStudents: number;
  currentStudents: number;
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  durationValue: number;
  durationUnit: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  pricePerSession: number;
  averageHourlyRate: number;
  totalSessions: number;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "CANCELLED" | "COMPLETED";
  schedules: Array<{
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>;
  sessions: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
  createdAt: string;
}

interface TutorClassManagementProps {
  isAdmin?: boolean;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Thứ 2",
  TUESDAY: "Thứ 3",
  WEDNESDAY: "Thứ 4",
  THURSDAY: "Thứ 5",
  FRIDAY: "Thứ 6",
  SATURDAY: "Thứ 7",
  SUNDAY: "Chủ nhật",
};

export function TutorClassManagement({ isAdmin = false }: TutorClassManagementProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [classRooms, setClassRooms] = useState<ClassRoom[]>([]);
  const [approvedSubjects, setApprovedSubjects] = useState<ApprovedSubject[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedSubjectName, setSelectedSubjectName] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState<number>(20);

  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(3);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(90);
  const [durationValue, setDurationValue] = useState<number>(3);
  const [durationUnit, setDurationUnit] = useState<"MONTH" | "WEEK">("MONTH");
  const [startDate, setStartDate] = useState<string>("");

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<string>("3900000");

  useEffect(() => {
    loadData();
  }, [userId, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const rooms = await classroomApi.getAllForAdmin();
        setClassRooms(rooms || []);
      } else {
        const [rooms, subjects, slots] = await Promise.all([
          classroomApi.getMyClassRooms(userId).catch(() => []),
          classroomApi.getApprovedSubjects(userId).catch(() => []),
          tutorAvailabilityApi.getMine(userId).catch(() => []),
        ]);
        setClassRooms(rooms || []);
        setApprovedSubjects(subjects || []);
        setAvailabilities((slots || []).filter((s: AvailabilitySlot) => s.status === "AVAILABLE"));
      }
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu lớp học");
    } finally {
      setLoading(false);
    }
  };

  // Group approved subjects by Subject Name
  const uniqueSubjects = Array.from(new Set(approvedSubjects.map((s) => s.subjectName)));

  // Available levels for selected subject - flattened and split
  const availableLevels = approvedSubjects
    .filter((s) => s.subjectName === selectedSubjectName)
    .flatMap((s) => {
      const levels = s.teachingLevel.split(",").filter(Boolean);
      return levels.map((lvl) => ({
        teachingRegistrationId: s.teachingRegistrationId,
        levelGroup: s.levelGroup,
        levelId: lvl,
        levelName: levelLabelVi(lvl),
        levelGroupLabel: levelGroupLabelVi(s.levelGroup),
      }));
    });

  const handleSubjectChange = (subjName: string) => {
    setSelectedSubjectName(subjName);
    setSelectedRegistrationId("");
    setSelectedLevelId("");
  };

  const handleScheduleChange = (index: number, field: "dayOfWeek" | "startTime", value: string) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const syncScheduleCount = (count: number) => {
    setSessionsPerWeek(count);
    if (schedules.length < count) {
      const added: ScheduleItem[] = [];
      const days = ["MONDAY", "WEDNESDAY", "FRIDAY", "SATURDAY", "TUESDAY", "THURSDAY", "SUNDAY"];
      for (let i = schedules.length; i < count; i++) {
        added.push({ dayOfWeek: days[i % days.length], startTime: "08:00" });
      }
      setSchedules([...schedules, ...added]);
    } else if (schedules.length > count) {
      setSchedules(schedules.slice(0, count));
    }
  };

  const selectedRegistration = approvedSubjects.find(
    (s) => s.teachingRegistrationId === selectedRegistrationId
  );

  const calculateEndTime = (startTime: string, durationMins: number) => {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const totalMins = h * 60 + m + durationMins;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  };

  // Calculate estimated total sessions & end date for UI Preview
  const estimateTotalSessions = () => {
    if (!startDate || schedules.length === 0) return { totalSessions: 0, endDate: "" };
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return { totalSessions: 0, endDate: "" };

    const cutoff = new Date(start);
    if (durationUnit === "MONTH") {
      cutoff.setMonth(cutoff.getMonth() + durationValue);
    } else {
      cutoff.setDate(cutoff.getDate() + durationValue * 7);
    }

    let count = 0;
    let lastDate = new Date(start);
    const scheduledDays = schedules.map((s) => s.dayOfWeek);

    const curr = new Date(start);
    const dayMap: Record<number, string> = {
      0: "SUNDAY",
      1: "MONDAY",
      2: "TUESDAY",
      3: "WEDNESDAY",
      4: "THURSDAY",
      5: "FRIDAY",
      6: "SATURDAY",
    };

    while (curr < cutoff) {
      const dayStr = dayMap[curr.getDay()];
      if (scheduledDays.includes(dayStr)) {
        count++;
        lastDate = new Date(curr);
      }
      curr.setDate(curr.getDate() + 1);
    }

    const y = lastDate.getFullYear();
    const m = String(lastDate.getMonth() + 1).padStart(2, "0");
    const d = String(lastDate.getDate()).padStart(2, "0");

    return { totalSessions: count, endDate: `${y}-${m}-${d}` };
  };

  const { totalSessions: estimatedSessions, endDate: estimatedEndDate } = estimateTotalSessions();

  const numTotalPrice = parseFloat(totalPrice) || 0;
  const estimatedPricePerSession =
    estimatedSessions > 0 ? Math.round(numTotalPrice / estimatedSessions) : 0;

  const handleGoToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedRegistrationId) {
      setError("Vui lòng chọn Môn học và Lớp/Cấp độ đã được Admin duyệt.");
      return;
    }
    if (!name.trim()) {
      setError("Vui lòng nhập tên lớp học.");
      return;
    }
    if (!description.trim()) {
      setError("Vui lòng nhập mô tả lớp học.");
      return;
    }
    if (maxStudents <= 0) {
      setError("Sĩ số học viên tối đa phải lớn hơn 0.");
      return;
    }
    if (!startDate) {
      setError("Vui lòng chọn ngày bắt đầu.");
      return;
    }
    if (schedules.length !== sessionsPerWeek) {
      setError(`Số lượng lịch học phải đúng bằng ${sessionsPerWeek} buổi / tuần.`);
      return;
    }
    if (numTotalPrice <= 0) {
      setError("Vui lòng nhập tổng học phí hợp lệ.");
      return;
    }

    setIsPreviewing(true);
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        teachingRegistrationId: selectedRegistrationId,
        teachingLevel: selectedLevelId,
        name: name.trim(),
        description: description.trim(),
        maxStudents,
        sessionsPerWeek,
        sessionDurationMinutes,
        durationValue,
        durationUnit,
        startDate,
        schedules: schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
        })),
        totalPrice: numTotalPrice,
      };

      await classroomApi.createClassRoom(userId, payload);
      setSuccess("Tạo lớp học thành công! Lớp học đã được gửi tới Admin để duyệt.");
      setIsCreating(false);
      setIsPreviewing(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || "Không thể tạo lớp học. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSubjectName("");
    setSelectedRegistrationId("");
    setSelectedLevelId("");
    setName("");
    setDescription("");
    setMaxStudents(20);
    setSessionsPerWeek(3);
    setSessionDurationMinutes(90);
    setDurationValue(3);
    setDurationUnit("MONTH");
    setStartDate("");
    setSchedules([
      { dayOfWeek: "MONDAY", startTime: "08:00" },
      { dayOfWeek: "WEDNESDAY", startTime: "08:00" },
      { dayOfWeek: "FRIDAY", startTime: "10:00" },
    ]);
    setTotalPrice("3900000");
  };

  const handleApprove = async (classId: string) => {
    try {
      await classroomApi.approve(classId);
      setSuccess("Đã duyệt lớp học thành công.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Duyệt lớp thất bại.");
    }
  };

  const handleReject = async (classId: string) => {
    try {
      await classroomApi.reject(classId);
      setSuccess("Đã từ chối lớp học.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Từ chối lớp thất bại.");
    }
  };

  const handleCancelClass = async (classId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy/khóa lớp học này?")) return;
    try {
      await classroomApi.cancel(userId, classId);
      setSuccess("Đã khóa lớp học thành công.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Không thể khóa lớp học.");
    }
  };

  const renderStatusBadge = (status: ClassRoom["status"]) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" /> Chờ Admin duyệt
          </span>
        );
      case "ACTIVE":
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đang hoạt động
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <XCircle className="w-3.5 h-3.5" /> Bị từ chối
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <XCircle className="w-3.5 h-3.5" /> Đã khóa / Hủy
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn thành
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-brand-text-variant">
        <div className="w-8 h-8 border-4 border-brand-secondary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Đang tải thông tin lớp học...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-brand-border/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-brand-text">
              {isAdmin ? "Quản lý Lớp học (Admin)" : "Quản lý Lớp học của tôi"}
            </h2>
            <p className="text-xs text-brand-text-variant/70 mt-0.5">
              {isAdmin
                ? "Xem xét và phê duyệt các lớp học do Tutor đăng ký"
                : "Tạo và quản lý các khóa học dựa trên danh mục đã được Admin duyệt"}
            </p>
          </div>
        </div>

        {!isAdmin && !isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              resetForm();
            }}
            className="px-5 py-3 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-2xl font-display font-black text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Tạo Lớp Học Mới
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* CREATE FORM FLOW */}
      {!isAdmin && isCreating && (
        <div className="bg-white rounded-3xl border border-brand-border/30 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-brand-border/20 flex items-center justify-between bg-brand-low/30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isPreviewing) setIsPreviewing(false);
                  else setIsCreating(false);
                }}
                className="p-2 hover:bg-white rounded-xl text-brand-text-variant transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-display font-black text-base text-brand-text">
                {isPreviewing ? "Xác nhận & Xem trước thông tin lớp học" : "Tạo Lớp Học Dành Cho Tutor"}
              </h3>
            </div>
            <div className="text-xs font-bold text-brand-text-variant/60">
              {isPreviewing ? "Bước 2 / 2: Xem trước" : "Bước 1 / 2: Nhập thông tin"}
            </div>
          </div>

          {!isPreviewing ? (
            /* STEP 1: FORM INPUTS */
            <form onSubmit={handleGoToPreview} className="p-6 space-y-8">
              {/* 1. SELECTION: SUBJECT & LEVEL */}
              <div className="space-y-4">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> 1. Nội dung giảng dạy (Chỉ các môn/lớp đã được duyệt)
                </h4>

                {approvedSubjects.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    Bạn chưa có môn học nào được Admin duyệt. Vui lòng đăng ký môn giảng dạy trong Hồ sơ và chờ Admin duyệt trước khi tạo lớp.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1.5">
                        Môn học <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedSubjectName}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary bg-white"
                        required
                      >
                        <option value="">-- Chọn Môn Học --</option>
                        {uniqueSubjects.map((subj) => (
                          <option key={subj} value={subj}>
                            {subjectLabelVi(subj)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1.5">
                        Lớp / Cấp độ <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedRegistrationId && selectedLevelId ? `${selectedRegistrationId}|${selectedLevelId}` : ""}
                        onChange={(e) => {
                          const [regId, lvlId] = e.target.value.split("|");
                          setSelectedRegistrationId(regId || "");
                          setSelectedLevelId(lvlId || "");
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary bg-white"
                        disabled={!selectedSubjectName}
                        required
                      >
                        <option value="">-- Chọn Cấp Độ --</option>
                        {availableLevels.map((lvl) => (
                          <option key={`${lvl.teachingRegistrationId}|${lvl.levelId}`} value={`${lvl.teachingRegistrationId}|${lvl.levelId}`}>
                            {lvl.levelName} ({lvl.levelGroupLabel})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. CLASS DETAILS */}
              <div className="space-y-4 pt-4 border-t border-brand-border/20">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-2">
                  <Info className="w-4 h-4" /> 2. Thông tin chi tiết lớp học
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Tên lớp học <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ví dụ: Tiếng Anh lớp 10 - Luyện thi và củng cố kiến thức"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Mô tả chi tiết <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mô tả mục tiêu khóa học, đối tượng học viên, phương pháp giảng dạy..."
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary"
                      required
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Số lượng học viên tối đa <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxStudents}
                      onChange={(e) => setMaxStudents(parseInt(e.target.value) || 1)}
                      className="w-full md:w-64 px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. TIME CONFIGURATION */}
              <div className="space-y-4 pt-4 border-t border-brand-border/20">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 3. Thiết lập thời gian học
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Số buổi học / tuần
                    </label>
                    <select
                      value={sessionsPerWeek}
                      onChange={(e) => syncScheduleCount(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary bg-white"
                    >
                      <option value={1}>1 buổi / tuần</option>
                      <option value={2}>2 buổi / tuần</option>
                      <option value={3}>3 buổi / tuần</option>
                      <option value={4}>4 buổi / tuần</option>
                      <option value={5}>5 buổi / tuần</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Thời lượng mỗi buổi
                    </label>
                    <select
                      value={sessionDurationMinutes}
                      onChange={(e) => setSessionDurationMinutes(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary bg-white"
                    >
                      <option value={60}>60 phút</option>
                      <option value={90}>90 phút</option>
                      <option value={120}>120 phút</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Thời gian kéo dài khóa
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={durationValue}
                        onChange={(e) => setDurationValue(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold text-center focus:outline-none focus:border-brand-secondary"
                      />
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as "MONTH" | "WEEK")}
                        className="flex-1 px-3 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary bg-white"
                      >
                        <option value="MONTH">Tháng</option>
                        <option value="WEEK">Tuần</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1.5">
                    Ngày bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full md:w-64 px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary"
                    required
                  />
                  <p className="text-[11px] text-brand-text-variant/60 mt-1">
                    Ngày kết thúc và tổng số buổi học sẽ do hệ thống tự động tính toán.
                  </p>
                </div>
              </div>

              {/* 4. WEEKLY SCHEDULE SELECTION */}
              <div className="space-y-4 pt-4 border-t border-brand-border/20">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> 4. Chọn lịch học hàng tuần ({sessionsPerWeek} buổi)
                  </h4>
                </div>

                <div className="p-3 bg-brand-low/40 border border-brand-border/20 rounded-2xl text-xs text-brand-text-variant">
                  Chỉ được chọn thời gian nằm trong <strong>Lịch trống đã đăng ký</strong>. Thời gian kết thúc tự tính theo thời lượng ({sessionDurationMinutes} phút).
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {schedules.map((sch, idx) => {
                    const endTimeStr = calculateEndTime(sch.startTime, sessionDurationMinutes);
                    return (
                      <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                        <span className="text-xs font-black text-brand-secondary uppercase tracking-wider block">
                          Buổi thứ {idx + 1}
                        </span>

                        <div>
                          <label className="block text-[11px] font-bold text-brand-text mb-1">
                            Thứ trong tuần
                          </label>
                          <select
                            value={sch.dayOfWeek}
                            onChange={(e) => handleScheduleChange(idx, "dayOfWeek", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-brand-border/40 text-xs font-semibold bg-white"
                          >
                            <option value="MONDAY">Thứ 2</option>
                            <option value="TUESDAY">Thứ 3</option>
                            <option value="WEDNESDAY">Thứ 4</option>
                            <option value="THURSDAY">Thứ 5</option>
                            <option value="FRIDAY">Thứ 6</option>
                            <option value="SATURDAY">Thứ 7</option>
                            <option value="SUNDAY">Chủ nhật</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-brand-text mb-1">
                            Giờ bắt đầu
                          </label>
                          <input
                            type="time"
                            value={sch.startTime}
                            onChange={(e) => handleScheduleChange(idx, "startTime", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-brand-border/40 text-xs font-semibold bg-white"
                          />
                        </div>

                        <div className="text-[11px] font-bold text-brand-text-variant">
                          Hệ thống tính: <span className="text-brand-primary">{sch.startTime} - {endTimeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. TUITION FEE */}
              <div className="space-y-4 pt-4 border-t border-brand-border/20">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> 5. Học phí toàn khóa
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1.5">
                      Tổng học phí (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step={50000}
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      placeholder="3900000"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-xs font-semibold focus:outline-none focus:border-brand-secondary"
                      required
                    />
                  </div>

                  <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-brand-primary">
                      ≈ {estimatedPricePerSession.toLocaleString("vi-VN")} VNĐ / buổi
                    </p>
                    <p className="text-[11px] text-brand-text-variant/70">
                      Dựa trên ước tính {estimatedSessions} buổi học tổng cộng.
                    </p>
                  </div>
                </div>
              </div>

              {/* SUBMIT STEP 1 BUTTON */}
              <div className="pt-6 border-t border-brand-border/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-6 py-3 rounded-xl border border-brand-border/40 font-display font-bold text-xs text-brand-text-variant hover:bg-gray-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={approvedSubjects.length === 0}
                  className="px-6 py-3 rounded-xl bg-brand-secondary hover:bg-brand-secondary-hover text-white font-display font-black text-xs tracking-wider flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  Xem trước thông tin lớp <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: PREVIEW CONFIRMATION */
            <div className="p-6 space-y-8">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                Vui lòng kiểm tra kỹ thông tin lớp học bên dưới trước khi gửi Admin phê duyệt.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Information Box 1 */}
                <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                  <h5 className="font-display font-bold text-xs text-brand-secondary uppercase tracking-wider border-b border-gray-200 pb-2">
                    Thông tin lớp học
                  </h5>
                  <div className="text-xs space-y-2">
                    <p>
                      <strong className="text-brand-text">Môn học:</strong> {subjectLabelVi(selectedSubjectName)}
                    </p>
                    <p>
                      <strong className="text-brand-text">Cấp độ / Lớp:</strong> {levelLabelVi(selectedLevelId)} ({selectedRegistration ? levelGroupLabelVi(selectedRegistration.levelGroup) : ""})
                    </p>
                    <p>
                      <strong className="text-brand-text">Tên lớp:</strong> {name}
                    </p>
                    <p>
                      <strong className="text-brand-text">Mô tả:</strong> {description}
                    </p>
                    <p>
                      <strong className="text-brand-text">Sĩ số tối đa:</strong> {maxStudents} học viên
                    </p>
                  </div>
                </div>

                {/* Information Box 2 */}
                <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                  <h5 className="font-display font-bold text-xs text-brand-secondary uppercase tracking-wider border-b border-gray-200 pb-2">
                    Thời gian & Học phí
                  </h5>
                  <div className="text-xs space-y-2">
                    <p>
                      <strong className="text-brand-text">Tần suất:</strong> {sessionsPerWeek} buổi / tuần
                    </p>
                    <p>
                      <strong className="text-brand-text">Thời lượng:</strong> {sessionDurationMinutes} phút / buổi
                    </p>
                    <p>
                      <strong className="text-brand-text">Thời gian khóa:</strong> {durationValue}{" "}
                      {durationUnit === "MONTH" ? "tháng" : "tuần"}
                    </p>
                    <p>
                      <strong className="text-brand-text">Ngày bắt đầu:</strong> {startDate}
                    </p>
                    <p>
                      <strong className="text-brand-text">Ngày kết thúc (dự kiến):</strong>{" "}
                      <span className="text-brand-primary font-bold">{estimatedEndDate}</span>
                    </p>
                    <p>
                      <strong className="text-brand-text">Tổng số buổi (tính toán):</strong>{" "}
                      <span className="text-brand-primary font-bold">{estimatedSessions} buổi</span>
                    </p>
                    <p>
                      <strong className="text-brand-text">Tổng học phí:</strong>{" "}
                      <span className="text-brand-secondary font-black text-sm">
                        {numTotalPrice.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </p>
                    <p>
                      <strong className="text-brand-text">Trung bình / buổi:</strong> ≈{" "}
                      {estimatedPricePerSession.toLocaleString("vi-VN")} VNĐ
                    </p>
                  </div>
                </div>
              </div>

              {/* Schedule Summary Box */}
              <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                <h5 className="font-display font-bold text-xs text-brand-secondary uppercase tracking-wider border-b border-gray-200 pb-2">
                  Lịch học hàng tuần
                </h5>
                <ul className="text-xs space-y-1.5">
                  {schedules.map((sch, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-secondary"></span>
                      <strong>{DAY_LABELS[sch.dayOfWeek] || sch.dayOfWeek}:</strong> {sch.startTime} -{" "}
                      {calculateEndTime(sch.startTime, sessionDurationMinutes)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* PREVIEW BUTTONS */}
              <div className="pt-6 border-t border-brand-border/20 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setIsPreviewing(false)}
                  className="px-6 py-3 rounded-xl border border-brand-border/40 font-display font-bold text-xs text-brand-text hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại chỉnh sửa
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="px-8 py-3.5 rounded-xl bg-brand-secondary hover:bg-brand-secondary-hover text-white font-display font-black text-xs tracking-wider flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    "Đang gửi Admin..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Gửi Admin Duyệt
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLASSROOM LIST */}
      {!isCreating && (
        <div className="space-y-4">
          <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-text">
            Danh sách Lớp học ({classRooms.length})
          </h3>

          {classRooms.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-brand-border/30 max-w-xl mx-auto shadow-sm">
              <BookOpen className="w-12 h-12 text-brand-secondary mx-auto mb-4 opacity-40" />
              <h4 className="font-display font-black text-sm text-brand-text uppercase tracking-wider">
                Chưa có lớp học nào
              </h4>
              <p className="text-xs text-brand-text-variant mt-2 max-w-sm mx-auto leading-relaxed">
                {isAdmin
                  ? "Hiện tại chưa có lớp học nào được gửi để phê duyệt."
                  : "Bạn chưa tạo lớp học nào. Nhấp vào nút 'Tạo Lớp Học Mới' bên trên để bắt đầu."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {classRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white p-6 rounded-3xl border border-brand-border/30 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/20 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-low text-brand-secondary uppercase">
                          {subjectLabelVi(room.subjectName)} - {levelLabelVi(room.teachingLevel)}
                        </span>
                        {renderStatusBadge(room.status)}
                      </div>
                      <h4 className="font-display font-black text-base text-brand-text">{room.name}</h4>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-brand-secondary">
                        {room.totalPrice.toLocaleString("vi-VN")} VNĐ
                      </p>
                      <p className="text-[11px] text-brand-text-variant/70 font-semibold">
                        ≈ {room.pricePerSession.toLocaleString("vi-VN")} VNĐ / buổi ({room.totalSessions} buổi)
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-brand-text-variant line-clamp-2">{room.description}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-brand-text-variant bg-gray-50 p-4 rounded-2xl">
                    <div>
                      <span className="text-[10px] text-brand-text-variant/60 block uppercase font-bold">Sĩ số</span>
                      <span className="text-brand-text font-bold">
                        {room.currentStudents} / {room.maxStudents} học viên
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-text-variant/60 block uppercase font-bold">Thời gian</span>
                      <span className="text-brand-text font-bold">
                        {room.sessionsPerWeek} buổi/tuần ({room.sessionDurationMinutes}p)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-text-variant/60 block uppercase font-bold">Bắt đầu</span>
                      <span className="text-brand-text font-bold">{room.startDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-text-variant/60 block uppercase font-bold">Kết thúc</span>
                      <span className="text-brand-text font-bold">{room.endDate}</span>
                    </div>
                  </div>

                  {/* Schedules Display */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-brand-text">Lịch học:</span>
                    {room.schedules.map((sch) => (
                      <span
                        key={sch.id}
                        className="px-2.5 py-1 bg-brand-primary/5 text-brand-primary rounded-lg font-bold text-[11px]"
                      >
                        {DAY_LABELS[sch.dayOfWeek] || sch.dayOfWeek}: {sch.startTime} - {sch.endTime}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex justify-end items-center gap-3">
                    {isAdmin && room.status === "PENDING_APPROVAL" && (
                      <>
                        <button
                          onClick={() => handleReject(room.id)}
                          className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => handleApprove(room.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                          Phê duyệt Lớp
                        </button>
                      </>
                    )}

                    {!isAdmin && (room.status === "PENDING_APPROVAL" || room.status === "ACTIVE") && room.currentStudents === 0 && (
                      <button
                        onClick={() => handleCancelClass(room.id)}
                        className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                      >
                        Khóa / Hủy lớp
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
