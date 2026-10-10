import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Edit3,
  Save,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BookOpen,
  Video,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  CalendarDays,
  Layers,
  ArrowRight,
  X,
  UserCheck,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { classApi } from "../../api/classes";
import { apiRequest } from "../../api/client";

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number; // 2 -> Thứ 2, 3 -> Thứ 3, ..., 8 -> Chủ nhật
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

interface OccupiedClassSlot {
  id: string;
  classRoomId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  subjectName?: string;
  status: string;
  learningMode: string;
  maxStudents?: number;
  currentStudents?: number;
  address?: string;
  meetingLink?: string;
  startDate?: string;
  endDate?: string;
}

interface NetFreeSegment {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMins: number;
}

interface TutorAvailabilitySchedulerProps {
  onNavigate?: (tab: string, meta?: any) => void;
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

const BLOCKING_CLASS_STATUSES = new Set([
  "PENDING_APPROVAL",
  "ACTIVE",
  "PRIVATE",
  "PUBLISHED",
  "LOCKED"
]);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getClassStatusLabel(status: string): string {
  switch (status) {
    case "PUBLISHED": return "Đang mở bán";
    case "ACTIVE": return "Đang hoạt động";
    case "PRIVATE": return "Đã duyệt";
    case "LOCKED": return "Đã khóa";
    case "PENDING_APPROVAL": return "Chờ duyệt";
    default: return status;
  }
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function toIsoDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

function computeNetFreeIntervals(rawSlots: AvailabilitySlot[], occupiedSlots: OccupiedClassSlot[]): NetFreeSegment[] {
  const result: NetFreeSegment[] = [];

  for (const raw of rawSlots) {
    const dayOccupied = occupiedSlots
      .filter(o => o.dayOfWeek === raw.dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let curr = timeToMinutes(raw.startTime);
    const winEnd = timeToMinutes(raw.endTime);

    for (const occ of dayOccupied) {
      const occStart = timeToMinutes(occ.startTime);
      const occEnd = timeToMinutes(occ.endTime);

      if (occEnd <= curr) continue;
      if (occStart >= winEnd) break;

      if (occStart > curr) {
        const segEnd = Math.min(occStart, winEnd);
        if (segEnd > curr) {
          result.push({
            id: `net-${raw.dayOfWeek}-${curr}-${segEnd}`,
            dayOfWeek: raw.dayOfWeek,
            startTime: minutesToTime(curr),
            endTime: minutesToTime(segEnd),
            durationMins: segEnd - curr
          });
        }
      }
      curr = Math.min(winEnd, Math.max(curr, occEnd));
    }

    if (curr < winEnd) {
      result.push({
        id: `net-${raw.dayOfWeek}-${curr}-${winEnd}`,
        dayOfWeek: raw.dayOfWeek,
        startTime: minutesToTime(curr),
        endTime: minutesToTime(winEnd),
        durationMins: winEnd - curr
      });
    }
  }

  return result;
}

function TimeInput24h({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [h, m] = (value || "00:00").split(":");
  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <select
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className="px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary appearance-none text-center w-[58px]"
      >
        {HOURS.map((hr) => <option key={hr} value={hr}>{hr}</option>)}
      </select>
      <span className="text-sm font-black text-slate-400">:</span>
      <select
        value={MINUTES.includes(m) ? m : "00"}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className="px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary appearance-none text-center w-[58px]"
      >
        {MINUTES.map((min) => <option key={min} value={min}>{min}</option>)}
      </select>
    </div>
  );
}

export function TutorAvailabilityScheduler({ onNavigate }: TutorAvailabilitySchedulerProps) {
  // Main view tab: 'AVAILABILITY' | 'TEACHING_CALENDAR'
  const [activeTab, setActiveTab] = useState<"AVAILABILITY" | "TEACHING_CALENDAR">("AVAILABILITY");

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [occupiedClasses, setOccupiedClasses] = useState<OccupiedClassSlot[]>([]);
  const [rawClassList, setRawClassList] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Teaching Calendar Week Offset
  const [weekOffset, setWeekOffset] = useState(0);

  // Modal detail for occupied class or session
  const [selectedClassModal, setSelectedClassModal] = useState<OccupiedClassSlot | null>(null);
  const [selectedSessionModal, setSelectedSessionModal] = useState<any | null>(null);

  // Load availability, created classes and sessions from API
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError("");
      try {
        const [dbSlots, myClasses] = await Promise.all([
          classApi.getAvailability().catch(() => []),
          classApi.getMyClasses().catch(() => [])
        ]);

        if (Array.isArray(dbSlots)) {
          setSlots(dbSlots.map((s: any) => ({
            id: String(s.id || Math.random()),
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime
          })));
        }

        const occupied: OccupiedClassSlot[] = [];
        const classes = Array.isArray(myClasses) ? myClasses : [];
        setRawClassList(classes);

        // Fetch sessions for all classes to support Teaching Calendar
        const sessionPromises = classes.map(async (cls) => {
          try {
            const sessList = await apiRequest(`/api/learning/classes/${cls.id}/sessions`);
            if (Array.isArray(sessList)) {
              return sessList.map((s: any) => ({
                ...s,
                classRoomId: cls.id,
                className: cls.name,
                subjectName: cls.subjectName,
                learningMode: cls.learningMode,
                meetingLink: cls.meetingLink,
                classStatus: cls.status
              }));
            }
          } catch (e) {
            // ignore
          }
          return [];
        });

        const nestedSessions = await Promise.all(sessionPromises);
        const flattenedSessions = nestedSessions.flat();
        setAllSessions(flattenedSessions);

        for (const cls of classes) {
          // LOCKED includes a class being settled/terminated. Its teaching slot
          // remains reserved until the whole-class cancellation is complete.
          if (BLOCKING_CLASS_STATUSES.has(cls.status)) {
            if (Array.isArray(cls.schedules)) {
              for (const sch of cls.schedules) {
                occupied.push({
                  id: `occ-${cls.id}-${sch.id}`,
                  classRoomId: cls.id,
                  dayOfWeek: sch.dayOfWeek,
                  startTime: sch.startTime,
                  endTime: sch.endTime,
                  className: cls.name,
                  subjectName: cls.subjectName,
                  status: cls.status,
                  learningMode: cls.learningMode,
                  maxStudents: cls.maxStudents,
                  currentStudents: cls.currentStudents,
                  address: cls.address,
                  meetingLink: cls.meetingLink,
                  startDate: cls.startDate,
                  endDate: cls.endDate
                });
              }
            }
          }
        }
        setOccupiedClasses(occupied);

      } catch (err: any) {
        console.error("Load availability error", err);
        setSlots([]);
        setLoadError(err?.message || "Không thể tải lịch rảnh từ hệ thống.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute net free intervals after excluding occupied class slots
  const netFreeSegments = useMemo(() => {
    return computeNetFreeIntervals(slots, occupiedClasses);
  }, [slots, occupiedClasses]);

  // Helper: check duration is at least 90 minutes
  const getDurationInMinutes = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  // Live validation
  const validateSlots = (currentSlots: AvailabilitySlot[]): string[] => {
    const currentErrors: string[] = [];

    const dayGroups: Record<number, AvailabilitySlot[]> = {};
    currentSlots.forEach(slot => {
      if (!dayGroups[slot.dayOfWeek]) {
        dayGroups[slot.dayOfWeek] = [];
      }
      dayGroups[slot.dayOfWeek].push(slot);
    });

    let hasInvalidTimeRange = false;
    let hasOverlap = false;
    let hasLessThan90Mins = false;

    Object.keys(dayGroups).forEach(dayKey => {
      const daySlots = dayGroups[Number(dayKey)];
      
      daySlots.forEach(slot => {
        const duration = getDurationInMinutes(slot.startTime, slot.endTime);
        if (duration <= 0) {
          hasInvalidTimeRange = true;
        } else if (duration < 90) {
          hasLessThan90Mins = true;
        }
      });

      const sorted = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].endTime.localeCompare(sorted[i + 1].startTime) > 0) {
          hasOverlap = true;
        }
      }
    });

    if (hasInvalidTimeRange) {
      currentErrors.push("Thời gian kết thúc phải sau thời gian bắt đầu");
    }
    if (hasLessThan90Mins) {
      currentErrors.push("Mỗi buổi rảnh phải kéo dài tối thiểu 90 phút");
    }
    if (hasOverlap) {
      currentErrors.push("Các khung giờ trong cùng một ngày không được trùng nhau");
    }

    const uniqueDays = new Set(currentSlots.map(s => s.dayOfWeek)).size;
    if (uniqueDays < 3) {
      currentErrors.push(`Cần đăng ký tối thiểu 3 buổi ở 3 thứ khác nhau (Hiện tại: ${uniqueDays} thứ)`);
    }

    return currentErrors;
  };

  const handleAddSlot = () => {
    const newSlot: AvailabilitySlot = {
      id: `slot-${Date.now()}`,
      dayOfWeek: 2,
      startTime: "08:00",
      endTime: "10:00"
    };
    const updated = [...slots, newSlot];
    setSlots(updated);
    setErrors(validateSlots(updated));
  };

  const handleAddFullDay = () => {
    const existingDays = new Set(slots.map(s => s.dayOfWeek));
    let targetDay = 2;
    for (let d = 2; d <= 8; d++) {
      if (!existingDays.has(d)) {
        targetDay = d;
        break;
      }
    }
    const fullDaySlot: AvailabilitySlot = {
      id: `slot-full-${Date.now()}`,
      dayOfWeek: targetDay,
      startTime: "07:00",
      endTime: "22:00"
    };
    const updated = [...slots, fullDaySlot];
    setSlots(updated);
    setErrors(validateSlots(updated));
  };

  const handleRemoveSlot = (id: string) => {
    const updated = slots.filter(s => s.id !== id);
    setSlots(updated);
    setErrors(validateSlots(updated));
  };

  const handleUpdateSlot = (id: string, updates: Partial<AvailabilitySlot>) => {
    const updated = slots.map(s => s.id === id ? { ...s, ...updates } : s);
    setSlots(updated);
    setErrors(validateSlots(updated));
  };

  const handleSave = async () => {
    const validationErrors = validateSlots(slots);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const savedSlots = await classApi.saveAvailability(slots.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      })));

      if (Array.isArray(savedSlots)) {
        setSlots(savedSlots.map((slot: any) => ({
          id: String(slot.id),
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        })));
      }
      setIsEditing(false);
      setLoadError("");
      setSuccessMessage("Đã lưu lịch rảnh thành công vào hệ thống!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      console.error("Save availability error", err);
      setErrors([err?.message || "Không thể lưu lịch rảnh vào hệ thống."]);
    } finally {
      setSaving(false);
    }
  };

  // Calendar dates for Teaching Calendar
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const start = getStartOfWeek(today);
    return addDays(start, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const date = addDays(currentWeekStart, i);
      const systemDay = i === 6 ? 8 : i + 2;
      return {
        date,
        isoDate: toIsoDate(date),
        label: VIETNAMESE_DAYS.find(d => d.value === systemDay)?.label || "Thứ",
        dateString: formatDateDisplay(date),
        isToday: toIsoDate(new Date()) === toIsoDate(date),
        systemDay
      };
    });
  }, [currentWeekStart]);

  const [selectedTeachingClassId, setSelectedTeachingClassId] = useState<string>("ALL");

  const filteredTeachingSessions = useMemo(() => {
    return (allSessions || []).filter(s => {
      if (selectedTeachingClassId !== "ALL" && String(s.classRoomId) !== selectedTeachingClassId) return false;
      return true;
    });
  }, [allSessions, selectedTeachingClassId]);

  // Group teaching sessions by ISO Date
  const teachingSessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredTeachingSessions.forEach(sess => {
      const d = sess.sessionDate;
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(sess);
      }
    });
    return map;
  }, [filteredTeachingSessions]);

  // Stats
  const distinctDaysCount = new Set(slots.map(s => s.dayOfWeek)).size;
  const totalSessions = slots.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 select-none font-sans">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 font-semibold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-slate-200/80 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className="p-3 rounded-2xl bg-brand-primary/10 text-brand-primary shrink-0">
            <Calendar className="w-6 h-6" />
          </span>
          <div>
            <h3 className="font-display font-black text-xl text-slate-900 tracking-tight">Lịch trống & Lịch dạy của gia sư</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Phân biệt rõ Lịch rảnh đã đăng ký, Khung giờ đã bị chiếm bởi các Lớp học và Lịch các buổi dạy thực tế.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "AVAILABILITY" && (
            isEditing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-brand-primary text-white hover:bg-brand-primary/95 text-xs font-display font-black tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "ĐANG LƯU..." : "LƯU LỊCH TRỐNG"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setSuccessMessage("");
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-display font-black tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                CHỈNH SỬA LỊCH RẢNH
              </button>
            )
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("AVAILABILITY")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === "AVAILABILITY"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers size={16} />
            Lịch trống & Khung giờ lớp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TEACHING_CALENDAR")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === "TEACHING_CALENDAR"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CalendarDays size={16} />
            Lịch dạy các buổi thực tế ({filteredTeachingSessions.length})
          </button>
        </div>

        {activeTab === "TEACHING_CALENDAR" && (
          <div className="flex items-center gap-2 flex-wrap">
            {rawClassList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                <BookOpen size={13} className="text-slate-400" />
                <select
                  value={selectedTeachingClassId}
                  onChange={(e) => setSelectedTeachingClassId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả lớp giảng dạy ({rawClassList.length})</option>
                  {rawClassList.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tuần trước"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tuần hiện tại
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tuần sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: AVAILABILITY & OCCUPIED SLOTS */}
      {activeTab === "AVAILABILITY" && (
        <div className="space-y-6">
          {/* Alert Rule & Stats Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-[#f0f5ff] border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-blue-900 text-xs font-semibold leading-relaxed shadow-xs">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-bold">Quy định cài đặt Lịch rảnh:</p>
                <p className="text-[11px] text-blue-800 mt-0.5 font-medium">
                  Tối thiểu 3 buổi/tuần (ở 3 thứ khác nhau); mỗi buổi tối thiểu 90 phút. Khi bạn tạo lớp học, khung giờ tương ứng sẽ tự động được đánh dấu là <strong>Đã bị chiếm</strong>.
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-center shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>LỊCH ĐÃ KHAI BÁO</span>
                <span className={distinctDaysCount >= 3 && totalSessions >= 3 ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold"}>
                  {distinctDaysCount}/3 buổi tối thiểu (ở {distinctDaysCount} thứ)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full transition-all ${distinctDaysCount >= 3 && totalSessions >= 3 ? "bg-emerald-500" : "bg-amber-500"}`} 
                  style={{ width: `${Math.min(100, (distinctDaysCount / 3) * 100)}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Legend Bar */}
          <div className="flex items-center gap-4 bg-white p-3 border border-slate-200 rounded-2xl text-xs font-bold shadow-xs">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-black">Chú thích màu sắc:</span>
            <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              🟢 Khoảng rảnh khả dụng (Sẵn sàng mở lớp)
            </span>
            <span className="flex items-center gap-1.5 text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              🔴 Đã bị chiếm bởi Lớp học (Bấm để xem chi tiết)
            </span>
          </div>

          {/* Weekday Grid with Occupied vs Free Slots */}
          <div className={`grid grid-cols-1 md:grid-cols-7 gap-3 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
            {VIETNAMESE_DAYS.map(day => {
              const dayRegistered = slots.filter(s => s.dayOfWeek === day.value)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              const dayOccupied = occupiedClasses.filter(o => o.dayOfWeek === day.value)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              const dayNetFree = netFreeSegments.filter(n => n.dayOfWeek === day.value);
              
              return (
                <div key={day.value} className="bg-white border border-slate-200/90 rounded-2xl p-3.5 min-h-[200px] flex flex-col gap-2 shadow-xs">
                  <h4 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2 text-center flex items-center justify-center gap-1">
                    <span>{day.label}</span>
                    {dayOccupied.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                        {dayOccupied.length} lớp
                      </span>
                    )}
                  </h4>

                  <div className="flex-1 flex flex-col gap-2 justify-start mt-1">
                    {/* Render Occupied Class Slots with FULL name and click modal */}
                    {dayOccupied.map(occ => (
                      <div 
                        key={occ.id}
                        onClick={() => setSelectedClassModal(occ)}
                        className="p-2.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 flex flex-col gap-1 text-[11px] font-bold cursor-pointer hover:border-rose-400 hover:shadow-xs transition-all"
                        title={`Bấm để xem chi tiết lớp: ${occ.className}`}
                      >
                        <div className="flex items-center justify-between text-[10px] gap-1">
                          <span className="font-black text-rose-900 leading-tight break-words">{occ.className}</span>
                          <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 text-[8px] font-extrabold shrink-0">
                            {getClassStatusLabel(occ.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-rose-700 font-semibold">
                          <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{occ.startTime} - {occ.endTime}</span>
                        </div>
                      </div>
                    ))}

                    {/* Render Net Free Intervals */}
                    {dayNetFree.map(seg => (
                      <div 
                        key={seg.id}
                        className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold"
                      >
                        <div className="flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Rảnh: {seg.startTime} - {seg.endTime}</span>
                        </div>
                        <span className="text-[9px] text-emerald-600 font-semibold">({seg.durationMins} phút)</span>
                      </div>
                    ))}

                    {dayRegistered.length === 0 && dayOccupied.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-semibold text-center italic mt-6">Chưa có lịch</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* List of Free Slots / Editor */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="font-display font-black text-sm text-slate-800 uppercase tracking-wider">
                {isEditing ? "Chỉnh sửa Khung Giờ Rảnh Đăng Ký" : "Danh sách Lịch Rảnh & Lớp Học Đã Tạo"}
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleAddFullDay}
                    className="px-3.5 py-2 rounded-xl border border-brand-primary/30 text-brand-primary text-xs font-bold hover:bg-brand-primary/5 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Cả ngày
                  </button>
                  <button 
                    onClick={handleAddSlot}
                    className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Thêm buổi
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {slots.map((slot) => (
                  <div 
                    key={slot.id} 
                    className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-4 items-end p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-brand-primary/20 transition-all"
                  >
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">NGÀY</label>
                      <select 
                        value={slot.dayOfWeek} 
                        onChange={(e) => handleUpdateSlot(slot.id, { dayOfWeek: Number(e.target.value) })}
                        className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary"
                      >
                        {VIETNAMESE_DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">BẮT ĐẦU</label>
                      <div className="mt-1.5">
                        <TimeInput24h
                          value={slot.startTime}
                          onChange={(v) => handleUpdateSlot(slot.id, { startTime: v })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">KẾT THÚC</label>
                      <div className="mt-1.5">
                        <TimeInput24h
                          value={slot.endTime}
                          onChange={(v) => handleUpdateSlot(slot.id, { endTime: v })}
                        />
                      </div>
                    </div>
                    <div>
                      <button 
                        onClick={() => handleRemoveSlot(slot.id)}
                        className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Xóa buổi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {slots.length === 0 && (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-semibold">
                    Chưa có buổi rảnh nào được tạo. Hãy click "Thêm buổi" để bắt đầu.
                  </div>
                )}

                {/* Error alerts banner inside edit mode */}
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-red-700 font-semibold shadow-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Thời gian kết thúc phải sau thời gian bắt đầu và không được trùng lịch</span>
                    </div>
                    <ul className="list-disc pl-5 font-medium space-y-0.5">
                      {errors.map((error, idx) => <li key={idx}>{error}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Occupied slots by created classes */}
                {occupiedClasses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">
                      1. Khung giờ đã bị chiếm bởi Lớp học đã tạo ({occupiedClasses.length} buổi):
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {occupiedClasses.map((occ) => {
                        const dayName = VIETNAMESE_DAYS.find(d => d.value === occ.dayOfWeek)?.label || "Thứ";
                        return (
                          <div 
                            key={occ.id} 
                            onClick={() => setSelectedClassModal(occ)}
                            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-900 hover:border-rose-400 hover:shadow-xs transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-lg bg-rose-200 text-rose-900 text-[11px] font-black shrink-0">{dayName}</span>
                              <div>
                                <p className="font-extrabold text-sm">{occ.className}</p>
                                <p className="text-[11px] text-rose-700 mt-0.5 font-semibold">{occ.startTime} - {occ.endTime}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-200 text-rose-900">
                                {getClassStatusLabel(occ.status)}
                              </span>
                              <span className="text-[10px] text-rose-700 font-bold hover:underline">Chi tiết →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Free slots summary */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    2. Các khung giờ rảnh đã khai báo ({slots.length} buổi):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {slots.map((s) => {
                      const dayName = VIETNAMESE_DAYS.find(d => d.value === s.dayOfWeek)?.label || "Thứ";
                      return (
                        <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="font-black text-slate-900">{dayName}</span>
                          <span className="text-indigo-600 font-bold">{s.startTime} - {s.endTime}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEACHING SESSIONS CALENDAR */}
      {activeTab === "TEACHING_CALENDAR" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              Thời gian: {weekDays[0].dateString} - {weekDays[6].dateString}
            </span>
            <span className="text-[11px] text-slate-400">
              * Lịch các buổi giảng dạy thực tế được sinh tự động theo hợp đồng & thời khóa biểu của lớp học
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
            {weekDays.map((day) => {
              const daySessions = teachingSessionsByDate[day.isoDate] || [];

              return (
                <div
                  key={day.isoDate}
                  className={`flex flex-col rounded-2xl border p-3.5 transition-all ${
                    day.isToday
                      ? "border-brand-primary/50 bg-blue-50/40 shadow-xs"
                      : "border-slate-200 bg-white shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div>
                      <p className={`text-xs font-black ${day.isToday ? "text-brand-primary" : "text-slate-900"}`}>
                        {day.label}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400">{day.dateString}</p>
                    </div>
                    {day.isToday && (
                      <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-black text-white">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {daySessions.length > 0 ? (
                      daySessions.map((session) => {
                        const isCancelled = session.status === "CANCELLED" || session.classStatus === "CANCELLED";
                        return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedSessionModal(session)}
                          className={`p-2.5 rounded-xl border shadow-2xs space-y-1.5 cursor-pointer transition-all ${
                            isCancelled ? "border-rose-100 bg-rose-50/50 opacity-75" : "border-indigo-100 bg-white hover:border-indigo-400 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-black text-slate-900 line-clamp-1">
                              {session.className || "Lớp học"}
                            </span>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              Buổi {session.sequenceNumber}
                            </span>
                          </div>

                          <p className="text-[11px] font-bold text-brand-primary flex items-center gap-1">
                            <Clock size={12} /> {session.startTime} - {session.endTime}
                          </p>

                          {session.topic && (
                            <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                              📖 {session.topic}
                            </p>
                          )}

                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400">
                              {session.status || "SCHEDULED"}
                            </span>
                            {onNavigate && !isCancelled && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate("sessions");
                                }}
                                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800"
                              >
                                Vào điểm danh →
                              </button>
                            )}
                            {isCancelled && <span className="text-[10px] font-black text-rose-600">Đã hủy</span>}
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <div className="flex h-20 items-center justify-center text-center">
                        <span className="text-[11px] font-medium text-slate-300">Không có buổi dạy</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: OCCUPIED CLASS DETAIL */}
      {selectedClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                  Thông tin Lớp học đã chiếm lịch
                </span>
                <h3 className="text-lg font-black text-slate-900 font-display mt-0.5">
                  {selectedClassModal.className}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassModal(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Thứ trong tuần</span>
                  <p className="font-extrabold text-slate-800 text-sm">
                    {VIETNAMESE_DAYS.find(d => d.value === selectedClassModal.dayOfWeek)?.label || "Thứ"}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Khung giờ</span>
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Clock size={14} className="text-brand-primary" />
                    {selectedClassModal.startTime} - {selectedClassModal.endTime}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 rounded-2xl space-y-2 border border-rose-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">
                    Trạng thái tuyển sinh: <strong>{getClassStatusLabel(selectedClassModal.status)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-200 text-rose-900">
                    ĐÃ KHÓA LỊCH
                  </span>
                </div>
                {selectedClassModal.subjectName && (
                  <p className="text-xs text-rose-950 font-medium">
                    Môn học: <strong>{selectedClassModal.subjectName}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2 text-slate-600">
                <p className="flex items-center gap-2">
                  <BookOpen size={14} className="text-slate-400 shrink-0" />
                  <span>Hình thức học: <strong>{selectedClassModal.learningMode === "ONLINE" ? "Trực tuyến (Online)" : "Tại chỗ (Offline)"}</strong></span>
                </p>
                {selectedClassModal.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span>Địa chỉ: {selectedClassModal.address}</span>
                  </p>
                )}
                {selectedClassModal.meetingLink && (
                  <p className="flex items-center gap-2">
                    <Video size={14} className="text-indigo-500 shrink-0" />
                    <span>Link phòng học: <a href={selectedClassModal.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">{selectedClassModal.meetingLink}</a></span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedClassModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              {onNavigate && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassModal(null);
                      onNavigate("class-management");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Quản lý lớp học
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassModal(null);
                      onNavigate("sessions");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-xs cursor-pointer"
                  >
                    <Video size={13} />
                    Điểm danh & Buổi học
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TEACHING SESSION DETAIL */}
      {selectedSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                  Chi tiết Buổi dạy
                </span>
                <h3 className="text-lg font-black text-slate-900 font-display mt-0.5">
                  {selectedSessionModal.className} — Buổi {selectedSessionModal.sequenceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionModal(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Ngày dạy</span>
                  <p className="font-extrabold text-slate-800 text-sm">
                    {selectedSessionModal.sessionDate}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Khung giờ</span>
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Clock size={14} className="text-brand-primary" />
                    {selectedSessionModal.startTime} - {selectedSessionModal.endTime}
                  </p>
                </div>
              </div>

              {selectedSessionModal.topic && (
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Chủ đề bài giảng</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedSessionModal.topic}</p>
                </div>
              )}

              {selectedSessionModal.status === "CANCELLED" || selectedSessionModal.classStatus === "CANCELLED" ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-medium leading-relaxed">
                  Buổi học này đã bị hủy hoặc dừng theo quy trình thanh lý; không thể điểm danh hay tạo quyết toán mới.
                </div>
              ) : (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-[11px] font-medium leading-relaxed">
                  💡 <strong>Điểm danh & Quyết toán:</strong> Gia sư vui lòng tự điểm danh trong đúng khung giờ dạy. Sau khi kết thúc buổi học, hệ thống sẽ đề xuất quyết toán học phí tự động qua Smart Contract Escrow.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSessionModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              {onNavigate && selectedSessionModal.status !== "CANCELLED" && selectedSessionModal.classStatus !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionModal(null);
                    onNavigate("sessions");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-black text-white hover:bg-brand-primary/95 transition-all shadow-xs cursor-pointer"
                >
                  <Video size={13} />
                  Vào trang Điểm danh Buổi học
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
