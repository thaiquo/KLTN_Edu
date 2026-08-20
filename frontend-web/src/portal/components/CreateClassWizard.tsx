import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, BookOpen, Clock, Calendar, DollarSign, Users, Video, 
  MapPin, FileText, Plus, Trash2, CheckCircle2, AlertCircle, 
  Upload, Sparkles, HelpCircle, ChevronRight, Info, ShieldAlert, Check
} from "lucide-react";
import { teachingRegistrationApi } from "../../api/teachingRegistrations";
import { classApi } from "../../api/classes";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { tutorApi } from "../../api/tutors";
import { useAuth } from "../../hooks/useAuth";

interface CreateClassWizardProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface ApprovedRegistration {
  id: number;
  subject?: { id: number; name: string; code: string };
  proposedSubjectName?: string;
  levels: Array<{ id: number; name: string; code: string }>;
  tuitionMin: number;
  tuitionMax: number;
  status: string;
}

interface ChapterItem {
  id: string;
  title: string;
  description: string;
  expectedSessions: number;
}

interface SavedSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface OccupiedSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  status: string;
}

interface NetFreeInterval {
  id: string;
  dayOfWeek: number;
  dayLabel: string;
  slotName: string;
  startTime: string;
  endTime: string;
  durationMins: number;
}

interface ConfiguredSession {
  sessionId: number;
  freeIntervalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

// Time conversion helpers
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

function addMinutesToTime(t: string, mins: number): string {
  return minutesToTime(timeToMinutes(t) + mins);
}

function normalize24hTime(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (/^\d{1,4}$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      const h = Math.min(23, Math.max(0, parseInt(trimmed, 10)));
      return `${String(h).padStart(2, "0")}:00`;
    } else {
      const h = Math.min(23, Math.max(0, parseInt(trimmed.slice(0, -2), 10)));
      const m = Math.min(59, Math.max(0, parseInt(trimmed.slice(-2), 10)));
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return trimmed;
}

function checkIntervalOverlap(
  startA: string, endA: string,
  startB: string, endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

// Generate valid start time options (step 15m) within an interval for a given duration
function generateStartTimeOptions(intervalStart: string, intervalEnd: string, durationMins: number): string[] {
  const options: string[] = [];
  const startMins = timeToMinutes(intervalStart);
  const endMins = timeToMinutes(intervalEnd);
  const maxStartMins = endMins - durationMins;

  if (maxStartMins < startMins) return options;

  for (let m = startMins; m <= maxStartMins; m += 15) {
    options.push(minutesToTime(m));
  }
  return options;
}

// Compute Net Free Intervals sorted by day & time
function computeNetFreeIntervals(rawSlots: SavedSlot[], occupiedSlots: OccupiedSlot[]): NetFreeInterval[] {
  const result: NetFreeInterval[] = [];

  const rawByDay: Record<number, SavedSlot[]> = {};
  for (const raw of rawSlots) {
    if (!rawByDay[raw.dayOfWeek]) rawByDay[raw.dayOfWeek] = [];
    rawByDay[raw.dayOfWeek].push(raw);
  }

  Object.keys(rawByDay).forEach(dayKey => {
    const dayNum = Number(dayKey);
    const dayRawSlots = rawByDay[dayNum].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayOccupied = occupiedSlots
      .filter(o => o.dayOfWeek === dayNum)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let slotCounter = 1;
    const baseDayLabel = VIETNAMESE_DAYS.find(d => d.value === dayNum)?.label || `Thứ ${dayNum}`;

    for (const raw of dayRawSlots) {
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
            const hasMultipleOnDay = dayRawSlots.length > 1 || dayOccupied.length > 0;
            const slotName = hasMultipleOnDay ? `${baseDayLabel} (Khung ${slotCounter})` : baseDayLabel;
            result.push({
              id: `free-${dayNum}-${curr}-${segEnd}`,
              dayOfWeek: dayNum,
              dayLabel: baseDayLabel,
              slotName: `${slotName}: ${minutesToTime(curr)} - ${minutesToTime(segEnd)}`,
              startTime: minutesToTime(curr),
              endTime: minutesToTime(segEnd),
              durationMins: segEnd - curr
            });
            slotCounter++;
          }
        }
        curr = Math.min(winEnd, Math.max(curr, occEnd));
      }

      if (curr < winEnd) {
        const hasMultipleOnDay = dayRawSlots.length > 1 || dayOccupied.length > 0;
        const slotName = hasMultipleOnDay ? `${baseDayLabel} (Khung ${slotCounter})` : baseDayLabel;
        result.push({
          id: `free-${dayNum}-${curr}-${winEnd}`,
          dayOfWeek: dayNum,
          dayLabel: baseDayLabel,
          slotName: `${slotName}: ${minutesToTime(curr)} - ${minutesToTime(winEnd)}`,
          startTime: minutesToTime(curr),
          endTime: minutesToTime(winEnd),
          durationMins: winEnd - curr
        });
        slotCounter++;
      }
    }
  });

  return result.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

export function CreateClassWizard({ onBack, onSuccess }: CreateClassWizardProps) {
  const { user } = useAuth();

  // Data states
  const [registrations, setRegistrations] = useState<ApprovedRegistration[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SavedSlot[]>([]);
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const [tutorProfile, setTutorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form states
  const [selectedRegId, setSelectedRegId] = useState<number | "">("");
  const [selectedLevelId, setSelectedLevelId] = useState<number | "">("");
  const [className, setClassName] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState<number>(20);
  const [bufferPoolRatioPercent, setBufferPoolRatioPercent] = useState<number>(150);
  const [maxPendingRequests, setMaxPendingRequests] = useState<number | "">(30);
  const [learningMode, setLearningMode] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [meetingLink, setMeetingLink] = useState("");
  const [address, setAddress] = useState("");
  const [pricePerSession, setPricePerSession] = useState<number | "">("");

  // Time and duration states
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(3);
  const [durationPerSession, setDurationPerSession] = useState<number>(90);
  const [durationValue, setDurationValue] = useState<number>(3);
  const [durationUnit, setDurationUnit] = useState<"MONTH" | "WEEK">("MONTH");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default to next week
    return d.toISOString().split("T")[0];
  });

  // Configured class sessions
  const [configuredSessions, setConfiguredSessions] = useState<ConfiguredSession[]>([]);

  // Syllabus states
  const [syllabusMode, setSyllabusMode] = useState<"FORM" | "FILE" | "BOTH">("FORM");
  const [syllabusFileUrl, setSyllabusFileUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const [chapters, setChapters] = useState<ChapterItem[]>([
    { id: "1", title: "Chương 1: Kiến thức nền tảng", description: "Làm quen với các khái niệm căn bản", expectedSessions: 3 },
    { id: "2", title: "Chương 2: Luyện tập chuyên sâu", description: "Thực hành giải bài tập và ứng dụng", expectedSessions: 5 }
  ]);

  // Fetch approved registrations, tutor availability & existing classes
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [regs, dbSlots, myClasses, profile] = await Promise.all([
          teachingRegistrationApi.mine().catch(() => []),
          classApi.getAvailability().catch(() => []),
          classApi.getMyClasses().catch(() => []),
          tutorApi.getProfile().catch(() => null)
        ]);
        setTutorProfile(profile);

        const approved = (regs || []).filter((r: any) => r.status === "APPROVED");
        setRegistrations(approved);

        if (approved.length > 0) {
          setSelectedRegId(approved[0].id);
          if (approved[0].levels && approved[0].levels.length > 0) {
            setSelectedLevelId(approved[0].levels[0].id);
          }
          setPricePerSession(approved[0].tuitionMin || 150000);
        }

        // Available slots
        const mappedSlots: SavedSlot[] = Array.isArray(dbSlots) ? dbSlots.map((s: any) => ({
          id: String(s.id),
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime
        })) : [];
        setAvailableSlots(mappedSlots);

        // Occupied slots from existing active/pending classes
        const occupied: OccupiedSlot[] = [];
        if (Array.isArray(myClasses)) {
          for (const cls of myClasses) {
            if (BLOCKING_CLASS_STATUSES.has(cls.status)) {
              if (Array.isArray(cls.schedules)) {
                for (const sch of cls.schedules) {
                  occupied.push({
                    dayOfWeek: sch.dayOfWeek,
                    startTime: sch.startTime,
                    endTime: sch.endTime,
                    className: cls.name,
                    status: cls.status
                  });
                }
              }
            }
          }
        }
        setOccupiedSlots(occupied);

        // Compute net free intervals
        const netFree = computeNetFreeIntervals(mappedSlots, occupied);
        const validNetFree = netFree.filter(i => i.durationMins >= 90);

        const initialConfigured: ConfiguredSession[] = [];
        for (let i = 0; i < 3; i++) {
          const targetInterval = validNetFree[i % validNetFree.length] || netFree[0];
          if (targetInterval) {
            const stOptions = generateStartTimeOptions(targetInterval.startTime, targetInterval.endTime, 90);
            const st = stOptions[0] || targetInterval.startTime;
            const et = addMinutesToTime(st, 90);
            initialConfigured.push({
              sessionId: i + 1,
              freeIntervalId: targetInterval.id,
              dayOfWeek: targetInterval.dayOfWeek,
              startTime: st,
              endTime: et
            });
          } else {
            initialConfigured.push({
              sessionId: i + 1,
              freeIntervalId: "",
              dayOfWeek: 2,
              startTime: "08:00",
              endTime: "09:30"
            });
          }
        }
        setConfiguredSessions(initialConfigured);

      } catch (err: any) {
        console.error("Failed to load data for class creation", err);
        setErrorBanner("Không thể tải danh sách môn học đã duyệt hoặc lịch rảnh. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute net free intervals dynamically
  const netFreeIntervals = useMemo(() => {
    return computeNetFreeIntervals(availableSlots, occupiedSlots);
  }, [availableSlots, occupiedSlots]);

  // Available free intervals with duration >= durationPerSession
  const usableFreeIntervals = useMemo(() => {
    return netFreeIntervals.filter(i => i.durationMins >= durationPerSession);
  }, [netFreeIntervals, durationPerSession]);

  // Adjust configured sessions when sessionsPerWeek changes
  useEffect(() => {
    setConfiguredSessions(prev => {
      if (prev.length === sessionsPerWeek) return prev;
      if (prev.length > sessionsPerWeek) {
        return prev.slice(0, sessionsPerWeek);
      }
      const updated = [...prev];
      for (let i = prev.length; i < sessionsPerWeek; i++) {
        const interval = usableFreeIntervals[i % usableFreeIntervals.length] || netFreeIntervals[0];
        if (interval) {
          const stOptions = generateStartTimeOptions(interval.startTime, interval.endTime, durationPerSession);
          const st = stOptions[0] || interval.startTime;
          const et = addMinutesToTime(st, durationPerSession);
          updated.push({
            sessionId: i + 1,
            freeIntervalId: interval.id,
            dayOfWeek: interval.dayOfWeek,
            startTime: st,
            endTime: et
          });
        } else {
          updated.push({
            sessionId: i + 1,
            freeIntervalId: "",
            dayOfWeek: 2,
            startTime: "08:00",
            endTime: addMinutesToTime("08:00", durationPerSession)
          });
        }
      }
      return updated;
    });
  }, [sessionsPerWeek, usableFreeIntervals, netFreeIntervals, durationPerSession]);

  // Recalculate end times when durationPerSession changes
  useEffect(() => {
    setConfiguredSessions(prev => prev.map(s => {
      const interval = netFreeIntervals.find(i => i.id === s.freeIntervalId);
      let st = s.startTime;
      if (interval) {
        const startMins = timeToMinutes(interval.startTime);
        const maxStartMins = timeToMinutes(interval.endTime) - durationPerSession;
        const curMins = timeToMinutes(st);
        if (curMins < startMins || curMins > maxStartMins) {
          st = interval.startTime;
        }
      }
      return {
        ...s,
        startTime: st,
        endTime: addMinutesToTime(st, durationPerSession)
      };
    }));
  }, [durationPerSession, netFreeIntervals]);

  // Selected registration object
  const activeRegistration = useMemo(() => {
    return registrations.find(r => r.id === Number(selectedRegId)) || null;
  }, [registrations, selectedRegId]);

  // Handle registration change
  const handleRegistrationChange = (regId: number) => {
    setSelectedRegId(regId);
    const reg = registrations.find(r => r.id === regId);
    if (reg && reg.levels && reg.levels.length > 0) {
      setSelectedLevelId(reg.levels[0].id);
      setPricePerSession(reg.tuitionMin || 150000);
    } else {
      setSelectedLevelId("");
    }
  };

  // Handle interval selection for a session
  const handleSelectIntervalForSession = (sessionIndex: number, intervalId: string) => {
    const targetInterval = netFreeIntervals.find(i => i.id === intervalId);
    if (!targetInterval) return;

    const stOptions = generateStartTimeOptions(targetInterval.startTime, targetInterval.endTime, durationPerSession);
    const defaultStart = stOptions[0] || targetInterval.startTime;

    setConfiguredSessions(prev => prev.map((s, idx) => {
      if (idx !== sessionIndex) return s;
      return {
        ...s,
        freeIntervalId: intervalId,
        dayOfWeek: targetInterval.dayOfWeek,
        startTime: defaultStart,
        endTime: addMinutesToTime(defaultStart, durationPerSession)
      };
    }));
  };

  // Handle start time selection for a session
  const handleSelectStartTime = (sessionIndex: number, startTime: string) => {
    setConfiguredSessions(prev => prev.map((s, idx) => {
      if (idx !== sessionIndex) return s;
      return {
        ...s,
        startTime,
        endTime: addMinutesToTime(startTime, durationPerSession)
      };
    }));
  };

  // Calculations
  const calculatedStats = useMemo(() => {
    if (!startDate) return { endDateStr: "--", totalSessions: 0, totalPrice: 0 };

    const start = new Date(startDate);
    const end = new Date(start);

    let totalWeeks = 0;
    if (durationUnit === "WEEK") {
      end.setDate(end.getDate() + durationValue * 7);
      totalWeeks = durationValue;
    } else {
      end.setMonth(end.getMonth() + durationValue);
      totalWeeks = durationValue * 4;
    }

    const totalSessions = totalWeeks * sessionsPerWeek;
    const price = Number(pricePerSession) || 0;
    const totalPrice = price * totalSessions;

    const dd = String(end.getDate()).padStart(2, "0");
    const mm = String(end.getMonth() + 1).padStart(2, "0");
    const yyyy = end.getFullYear();

    return {
      endDateStr: `${dd}/${mm}/${yyyy}`,
      totalSessions,
      totalPrice
    };
  }, [startDate, durationValue, durationUnit, sessionsPerWeek, pricePerSession]);

  // Chapter management
  const handleAddChapter = () => {
    const newId = String(Date.now());
    setChapters([
      ...chapters,
      { id: newId, title: `Chương ${chapters.length + 1}: `, description: "", expectedSessions: 2 }
    ]);
  };

  const handleUpdateChapter = (id: string, field: keyof ChapterItem, val: any) => {
    setChapters(chapters.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleRemoveChapter = (id: string) => {
    if (chapters.length <= 1 && (syllabusMode === "FORM" || syllabusMode === "BOTH")) {
      setErrorBanner("Lộ trình học phải có ít nhất 1 chương.");
      return;
    }
    setChapters(chapters.filter(c => c.id !== id));
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrorBanner(null);
    try {
      const res = await tutorApplicationApi.uploadApplicationDocument({
        documentType: "OTHER",
        file,
        metadata: {
          title: `Lộ trình lớp: ${file.name}`,
          issuer: "Tutor Syllabus",
          issueDate: new Date().toISOString().split("T")[0],
          validityType: "DOES_NOT_EXPIRE"
        }
      });
      setFileName(file.name);
      setSyllabusFileUrl(res?.fileUrl || `/uploads/syllabus/${file.name}`);
    } catch (err: any) {
      console.warn("Upload fallback to local url", err);
      setFileName(file.name);
      setSyllabusFileUrl(`https://educonnect.local/uploads/${encodeURIComponent(file.name)}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const padTime = (timeStr: string) => {
    if (!timeStr) return "07:00";
    const [h, m] = timeStr.split(":");
    return `${String(h).padStart(2, "0")}:${String(m || "00").padStart(2, "0")}`;
  };

  // Check schedule errors live
  const scheduleValidation = useMemo(() => {
    const sessionErrors: string[] = [];
    if (configuredSessions.length !== sessionsPerWeek) {
      sessionErrors.push(`Cần thiết lập đúng ${sessionsPerWeek} buổi học.`);
    }

    configuredSessions.forEach((sess, idx) => {
      const interval = netFreeIntervals.find(i => i.id === sess.freeIntervalId);
      const dayLabel = VIETNAMESE_DAYS.find(d => d.value === sess.dayOfWeek)?.label || `Thứ ${sess.dayOfWeek}`;

      if (!interval) {
        sessionErrors.push(`Buổi ${idx + 1}: Chưa chọn Khung giờ rảnh khả dụng.`);
        return;
      }

      if (!sess.startTime || !/^\d{2}:\d{2}$/.test(sess.startTime)) {
        sessionErrors.push(`Buổi ${idx + 1}: Vui lòng nhập giờ bắt đầu hợp lệ (định dạng HH:mm).`);
        return;
      }

      // 1. Check bounds within chosen interval
      const fitsInInterval = timeToMinutes(sess.startTime) >= timeToMinutes(interval.startTime) &&
                             timeToMinutes(sess.endTime) <= timeToMinutes(interval.endTime);

      if (!fitsInInterval) {
        sessionErrors.push(`Buổi ${idx + 1} (${dayLabel} ${sess.startTime} - ${sess.endTime}): nằm ngoài Khung giờ rảnh (${interval.startTime} - ${interval.endTime}).`);
      }

      // 2. Check overlap with occupied slots of existing classes
      const matchedOcc = occupiedSlots.find(occ => {
        return occ.dayOfWeek === sess.dayOfWeek &&
               checkIntervalOverlap(sess.startTime, sess.endTime, occ.startTime, occ.endTime);
      });

      if (matchedOcc) {
        sessionErrors.push(`Buổi ${idx + 1} (${dayLabel} ${sess.startTime} - ${sess.endTime}): bị trùng giờ với lớp "${matchedOcc.className}" (${matchedOcc.startTime} - ${matchedOcc.endTime})!`);
      }

      // 3. Check overlap with other configured sessions in current class
      for (let j = idx + 1; j < configuredSessions.length; j++) {
        const other = configuredSessions[j];
        if (sess.dayOfWeek === other.dayOfWeek) {
          if (checkIntervalOverlap(sess.startTime, sess.endTime, other.startTime, other.endTime)) {
            sessionErrors.push(`Buổi ${idx + 1} và Buổi ${j + 1} bị trùng giờ nhau (${dayLabel}).`);
          }
        }
      }
    });

    return {
      isValid: sessionErrors.length === 0 && configuredSessions.length === sessionsPerWeek,
      errors: sessionErrors
    };
  }, [configuredSessions, sessionsPerWeek, netFreeIntervals, occupiedSlots]);

  // Real-time validation checklist
  const validationChecks = useMemo(() => {
    const isSubjectLevel = Boolean(selectedRegId && selectedLevelId);
    const isName = Boolean(className.trim().length >= 3);
    const isDesc = Boolean(description.trim().length >= 5);
    const isMode = learningMode === "ONLINE" ? Boolean(meetingLink.trim()) : Boolean(address.trim());
    const numPrice = Number(pricePerSession);
    const isPrice = Boolean(
      numPrice > 0 &&
      (!activeRegistration || (numPrice >= activeRegistration.tuitionMin && numPrice <= activeRegistration.tuitionMax))
    );
    const isSchedule = scheduleValidation.isValid;
    
    let isSyllabus = false;
    if (syllabusMode === "FORM") {
      isSyllabus = chapters.length >= 1 && chapters.every(c => c.title.trim().length > 0);
    } else if (syllabusMode === "FILE") {
      isSyllabus = Boolean(syllabusFileUrl);
    } else if (syllabusMode === "BOTH") {
      isSyllabus = chapters.length >= 1 && chapters.every(c => c.title.trim().length > 0) && Boolean(syllabusFileUrl);
    }

    const isAllValid = isSubjectLevel && isName && isDesc && isMode && isPrice && isSchedule && isSyllabus;

    return {
      isSubjectLevel,
      isName,
      isDesc,
      isMode,
      isPrice,
      isSchedule,
      isSyllabus,
      isAllValid
    };
  }, [
    selectedRegId, selectedLevelId, className, description, learningMode, 
    meetingLink, address, pricePerSession, activeRegistration, scheduleValidation, 
    syllabusMode, chapters, syllabusFileUrl
  ]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!validationChecks.isAllValid) {
      setErrorBanner("Vui lòng hoàn thành đầy đủ tất cả các thông tin yêu cầu theo danh sách kiểm tra bên dưới.");
      return;
    }

    const price = Number(pricePerSession);

    // Build payload
    const payload = {
      tutorSubjectRegistrationId: Number(selectedRegId),
      levelId: Number(selectedLevelId),
      tutorProfileId: tutorProfile?.id || null,
      tutorFullName: tutorProfile?.fullName?.trim() || user?.fullName?.trim() || null,
      name: className.trim(),
      description: description.trim(),
      learningMode,
      meetingLink: learningMode === "ONLINE" ? meetingLink.trim() : null,
      address: learningMode === "OFFLINE" ? address.trim() : null,
      maxStudents: Number(maxStudents),
      bufferPoolRatioPercent: Number(bufferPoolRatioPercent || 150),
      maxPendingRequests: maxPendingRequests ? Number(maxPendingRequests) : Math.ceil(Number(maxStudents) * (Number(bufferPoolRatioPercent || 150) / 100)),
      pricePerSession: price,
      sessionsPerWeek: Number(sessionsPerWeek),
      durationPerSessionMinutes: Number(durationPerSession),
      durationValue: Number(durationValue),
      durationUnit,
      startDate,
      schedules: configuredSessions.map(s => ({
        dayOfWeek: Number(s.dayOfWeek),
        startTime: padTime(s.startTime),
        endTime: padTime(s.endTime)
      })),
      syllabusMode,
      syllabusFileUrl: (syllabusMode === "FILE" || syllabusMode === "BOTH") ? syllabusFileUrl : null,
      chapters: (syllabusMode === "FORM" || syllabusMode === "BOTH") ? chapters.map((ch, idx) => ({
        title: ch.title.trim(),
        description: ch.description.trim(),
        expectedSessions: Number(ch.expectedSessions),
        orderIndex: idx + 1
      })) : []
    };

    setSubmitting(true);
    try {
      await classApi.createClass(payload);
      onSuccess();
    } catch (err: any) {
      console.error("Failed to create class", err);
      setErrorBanner(err?.message || "Không thể tạo lớp học. Vui lòng kiểm tra lại thông tin và đảm bảo Backend đang chạy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-brand-border/30 rounded-3xl p-12 text-center max-w-4xl mx-auto my-8">
        <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-xs font-bold text-slate-500">Đang tải danh mục môn học và lịch rảnh...</p>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="bg-white border border-brand-border/30 rounded-3xl p-12 text-center max-w-2xl mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="font-display font-black text-lg text-slate-900">Chưa có Môn dạy nào được Admin duyệt</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          Theo quy định, Gia sư chỉ được phép tạo lớp học từ các môn học và cấp độ đã được Admin duyệt. Vui lòng nộp đăng ký môn dạy và chờ phê duyệt.
        </p>
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-brand-primary transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-primary/40 shadow-sm">
            <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-brand-primary" />
          </div>
          <span>Quay lại Quản lý Lớp học</span>
        </button>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Tạo lớp mới &bull; Chọn giờ bắt đầu theo buổi rảnh
        </span>
      </div>

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="bg-white border border-brand-border/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
        {/* Header Title */}
        <div className="border-b border-slate-100 pb-5">
          <h2 className="font-display font-black text-xl text-brand-text">Tạo Lớp Học Dành Cho Tutor</h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            Chọn Buổi rảnh trong tuần và Giờ bắt đầu tương ứng, hệ thống tự tính Giờ kết thúc và đảm bảo không vượt quá khung rảnh.
          </p>
        </div>

        {/* SECTION 1: NỘI DUNG GIẢNG DẠY */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-brand-primary font-black text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>1. Nội dung giảng dạy (Chỉ các môn/lớp đã được duyệt)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Môn học <span className="text-rose-500">*</span>
              </label>
              <select 
                value={selectedRegId}
                onChange={(e) => handleRegistrationChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
              >
                {registrations.map(r => {
                  const subjectName = r.subject?.name || r.proposedSubjectName || "Môn học";
                  return (
                    <option key={r.id} value={r.id}>
                      {subjectName} ({r.levels.map(l => l.name).join(", ")})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Lớp / Cấp độ <span className="text-rose-500">* (Chọn 1 level cụ thể)</span>
              </label>
              <select 
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
              >
                {activeRegistration?.levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {activeRegistration && (
            <div className="p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-xl flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">
                Khoảng học phí đã được duyệt cho môn này:
              </span>
              <span className="font-black text-brand-primary">
                {activeRegistration.tuitionMin?.toLocaleString("vi-VN")} đ - {activeRegistration.tuitionMax?.toLocaleString("vi-VN")} đ / buổi
              </span>
            </div>
          )}
        </div>

        {/* SECTION 2: THÔNG TIN CHI TIẾT LỚP HỌC */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-brand-primary font-black text-xs uppercase tracking-wider">
            <Info className="w-4 h-4" />
            <span>2. Thông tin chi tiết lớp học</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tên lớp học <span className="text-rose-500">*</span>
            </label>
            <input 
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Ví dụ: Tiếng Anh lớp 10 - Luyện thi và củng cố kiến thức"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mô tả chi tiết <span className="text-rose-500">*</span>
            </label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả mục tiêu khóa học, phương pháp giảng dạy, đối tượng học viên phù hợp..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số học viên chính thức <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number"
                min={1}
                max={100}
                value={maxStudents}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxStudents(val);
                  if (bufferPoolRatioPercent) {
                    setMaxPendingRequests(Math.ceil(val * (bufferPoolRatioPercent / 100)));
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tỷ lệ trần danh sách chờ (%) <span className="text-rose-500">*</span>
              </label>
              <select
                value={bufferPoolRatioPercent}
                onChange={(e) => {
                  const ratio = Number(e.target.value);
                  setBufferPoolRatioPercent(ratio);
                  setMaxPendingRequests(Math.ceil(maxStudents * (ratio / 100)));
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
              >
                <option value={100}>100% (1.0x - {maxStudents} hồ sơ)</option>
                <option value={150}>150% (1.5x - {Math.ceil(maxStudents * 1.5)} hồ sơ)</option>
                <option value={160}>160% (1.6x - {Math.ceil(maxStudents * 1.6)} hồ sơ)</option>
                <option value={200}>200% (2.0x - {maxStudents * 2} hồ sơ)</option>
                <option value={250}>250% (2.5x - {Math.ceil(maxStudents * 2.5)} hồ sơ)</option>
                <option value={300}>300% (3.0x - {maxStudents * 3} hồ sơ)</option>
              </select>
              <span className="text-[10px] text-brand-primary font-bold block mt-1">
                ➡️ Trần chờ: {maxPendingRequests ? maxPendingRequests : Math.ceil(maxStudents * (bufferPoolRatioPercent / 100))} hồ sơ cùng lúc
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Học phí mỗi buổi (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number"
                step={10000}
                value={pricePerSession}
                onChange={(e) => setPricePerSession(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
              />
            </div>
          </div>

          {/* Learning Mode Selection */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-700">
              Hình thức học <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setLearningMode("ONLINE")}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-extrabold transition-all ${
                  learningMode === "ONLINE"
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Học Online (Trực tuyến)</span>
              </button>

              <button
                type="button"
                onClick={() => setLearningMode("OFFLINE")}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-extrabold transition-all ${
                  learningMode === "OFFLINE"
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Học Offline (Trực tiếp)</span>
              </button>
            </div>

            {learningMode === "ONLINE" ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link phòng học Online (Google Meet, Zoom, Teams) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij hoặc https://zoom.us/j/..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa chỉ học trực tiếp <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: THIẾT LẬP THỜI GIAN HỌC */}
        <div className="space-y-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-brand-primary font-black text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>3. Thiết lập thời gian học & Chọn giờ bắt đầu mỗi buổi từ Lịch rảnh</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số buổi học / tuần <span className="text-rose-500">*</span>
              </label>
              <select 
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} buổi / tuần</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Thời lượng mỗi buổi <span className="text-rose-500">*</span>
              </label>
              <select 
                value={durationPerSession}
                onChange={(e) => setDurationPerSession(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
              >
                {[60, 90, 120, 150, 180].map(m => (
                  <option key={m} value={m}>{m} phút</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Thời gian kéo dài khóa <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="number"
                  min={1}
                  max={52}
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number(e.target.value))}
                  className="w-20 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                />
                <select 
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as any)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="MONTH">Tháng</option>
                  <option value="WEEK">Tuần</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ngày bắt đầu khóa học <span className="text-rose-500">*</span>
            </label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Display Overview of Net Free Slots Organized by Day */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Chi tiết Lịch rảnh & Trạng thái chiếm dụng (Sắp xếp theo thứ):
              </h4>
              <span className="text-[11px] font-black text-brand-primary bg-brand-primary/10 px-2.5 py-1 rounded-lg">
                Yêu cầu thời lượng: {durationPerSession} phút / buổi
              </span>
            </div>

            {/* 1. Raw Registered Slots */}
            {availableSlots.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                  <span>📅</span> Lịch rảnh đã đăng ký ban đầu của bạn:
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot, idx) => {
                    const dayLabel = VIETNAMESE_DAYS.find(d => d.value === slot.dayOfWeek)?.label || `Thứ ${slot.dayOfWeek}`;
                    return (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-bold border border-sky-200">
                        {dayLabel}: {slot.startTime} - {slot.endTime}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Occupied Slots from Existing Classes */}
            {occupiedSlots.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                  <span>🔴</span> Khung giờ đã bị chiếm bởi các lớp học trước đó (Tự động loại trừ, không cho chọn trùng):
                </span>
                <div className="flex flex-wrap gap-2">
                  {occupiedSlots.map((occ, idx) => {
                    const dayLabel = VIETNAMESE_DAYS.find(d => d.value === occ.dayOfWeek)?.label || `T${occ.dayOfWeek}`;
                    return (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        {dayLabel}: {occ.startTime} - {occ.endTime} ({occ.className})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Net Free Intervals Available for New Class */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                <span>🟢</span> Khung giờ rảnh còn dư sẵn sàng cho bạn xếp lớp mới (Tự động trừ thời gian đã chiếm):
              </span>
              {netFreeIntervals.length === 0 ? (
                <p className="text-xs text-amber-700 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Bạn chưa có khung giờ rảnh nào khả dụng. Vui lòng vào mục Lịch Rảnh để thêm lịch trống trước khi tạo lớp.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {netFreeIntervals.map((free) => {
                    const usable = free.durationMins >= durationPerSession;
                    return (
                      <span key={free.id} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        usable 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-500 border-slate-200 line-through"
                      }`}>
                        {free.slotName} ({free.durationMins} phút) {!usable ? "- Không đủ thời lượng" : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Configuration Cards for Each Required Session */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Cấu hình thời gian cụ thể cho {sessionsPerWeek} buổi học trong tuần: <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                scheduleValidation.isValid 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {scheduleValidation.isValid ? "✓ Lịch học hợp lệ" : "Vui lòng chọn đúng khung rảnh & giờ bắt đầu"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {configuredSessions.map((sess, idx) => {
                const currentInterval = netFreeIntervals.find(i => i.id === sess.freeIntervalId);
                const startTimeOptions = currentInterval 
                  ? generateStartTimeOptions(currentInterval.startTime, currentInterval.endTime, durationPerSession)
                  : [];

                const minStart = currentInterval ? currentInterval.startTime : "00:00";
                const maxStartMins = currentInterval 
                  ? timeToMinutes(currentInterval.endTime) - durationPerSession 
                  : 0;
                const maxStart = currentInterval && maxStartMins >= timeToMinutes(currentInterval.startTime)
                  ? minutesToTime(maxStartMins)
                  : "23:59";

                return (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 hover:border-brand-primary/40 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-black text-brand-primary uppercase">Buổi #{idx + 1}</span>
                      {currentInterval && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {currentInterval.dayLabel}
                        </span>
                      )}
                    </div>

                    {/* Step 1: Select available free interval */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        1. Chọn Buổi / Khung giờ rảnh
                      </label>
                      <select 
                        value={sess.freeIntervalId}
                        onChange={(e) => handleSelectIntervalForSession(idx, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-primary"
                      >
                        <option value="">-- Chọn khung giờ rảnh --</option>
                        {netFreeIntervals.map(free => {
                          const usable = free.durationMins >= durationPerSession;
                          return (
                            <option key={free.id} value={free.id} disabled={!usable}>
                              {free.slotName} ({free.durationMins} phút) {!usable ? "- Không đủ thời lượng" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Step 2: Manually enter start time in strictly 24-hour format within interval */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500">
                          2. Nhập Giờ bắt đầu (24h)
                        </label>
                        {currentInterval && maxStartMins >= timeToMinutes(currentInterval.startTime) && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Khung hợp lệ: {minStart} ➔ {maxStart}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <input 
                          type="text"
                          placeholder="Ví dụ: 07:30 hoặc 14:00 (24h)"
                          maxLength={5}
                          value={sess.startTime || ""}
                          onChange={(e) => handleSelectStartTime(idx, e.target.value)}
                          onBlur={(e) => {
                            const formatted = normalize24hTime(e.target.value);
                            if (formatted && formatted !== e.target.value) {
                              handleSelectStartTime(idx, formatted);
                            }
                          }}
                          disabled={!currentInterval || maxStartMins < timeToMinutes(currentInterval.startTime)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-50 transition-all"
                        />

                        {currentInterval && startTimeOptions.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">Hoặc chọn mốc:</span>
                            <select 
                              value={startTimeOptions.includes(sess.startTime) ? sess.startTime : ""}
                              onChange={(e) => {
                                if (e.target.value) handleSelectStartTime(idx, e.target.value);
                              }}
                              disabled={!currentInterval}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none focus:border-brand-primary"
                            >
                              <option value="">-- Mốc giờ bắt đầu (24h) --</option>
                              {startTimeOptions.map(time => (
                                <option key={time} value={time}>
                                  Bắt đầu lúc {time}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Auto calculated End Time display card */}
                    <div className="p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Thời gian buổi học:</span>
                        <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded">
                          Tự động +{durationPerSession}p
                        </span>
                      </div>
                      <span className="text-sm font-black text-brand-primary block">
                        {sess.startTime || "--:--"} ➔ {sess.endTime || "--:--"}
                      </span>
                      {currentInterval && (
                        <span className="text-[10px] font-bold text-emerald-700 block">
                          ✓ Khung rảnh đăng ký: {currentInterval.startTime} - {currentInterval.endTime}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Validation errors list */}
            {scheduleValidation.errors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 text-xs text-rose-700">
                <span className="font-bold block">Vui lòng điều chỉnh lịch học:</span>
                <ul className="list-disc pl-5 font-semibold space-y-0.5">
                  {scheduleValidation.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Auto Calculation Preview Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Ngày kết thúc dự kiến</span>
              <span className="text-sm font-black text-emerald-400 mt-1 block">{calculatedStats.endDateStr}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tổng số buổi dự kiến</span>
              <span className="text-sm font-black text-sky-400 mt-1 block">{calculatedStats.totalSessions} buổi</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tổng học phí cả khóa</span>
              <span className="text-base font-black text-amber-400 mt-1 block">
                {calculatedStats.totalPrice.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 4: LỘ TRÌNH HỌC (SYLLABUS) */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-brand-primary font-black text-xs uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>4. Lộ trình học (Syllabus)</span>
          </div>

          {/* Syllabus Mode Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { mode: "FORM", label: "Nhập từng chương (FORM)" },
              { mode: "FILE", label: "Tải file lộ trình (FILE)" },
              { mode: "BOTH", label: "Cả hai (Nhập chương & File)" }
            ].map(tab => (
              <button
                key={tab.mode}
                type="button"
                onClick={() => setSyllabusMode(tab.mode as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  syllabusMode === tab.mode
                    ? "bg-brand-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* FORM MODE: Chapter List */}
          {(syllabusMode === "FORM" || syllabusMode === "BOTH") && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase">Danh sách các chương học</span>
                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-[11px] font-bold hover:bg-brand-primary/90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm chương
                </button>
              </div>

              <div className="space-y-2.5">
                {chapters.map((ch, index) => (
                  <div key={ch.id} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black text-slate-500 w-6">#{index + 1}</span>
                      <input 
                        type="text"
                        value={ch.title}
                        onChange={(e) => handleUpdateChapter(ch.id, "title", e.target.value)}
                        placeholder="Tên chương học..."
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-primary"
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Dự kiến:</span>
                        <input 
                          type="number"
                          min={1}
                          max={50}
                          value={ch.expectedSessions}
                          onChange={(e) => handleUpdateChapter(ch.id, "expectedSessions", Number(e.target.value))}
                          className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-brand-primary"
                        />
                        <span className="text-[11px] font-bold text-slate-500">buổi</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChapter(ch.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Xóa chương"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input 
                      type="text"
                      value={ch.description}
                      onChange={(e) => handleUpdateChapter(ch.id, "description", e.target.value)}
                      placeholder="Mô tả nội dung chương học..."
                      className="w-full px-3 py-1.5 border border-slate-100 bg-slate-50 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILE MODE: Uploader */}
          {(syllabusMode === "FILE" || syllabusMode === "BOTH") && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-black text-slate-700 uppercase block">Tải lên file lộ trình chi tiết</span>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-brand-primary hover:text-brand-primary transition-all shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>{uploadingFile ? "Đang tải file lên..." : "Chọn file lộ trình (PDF, Word, Excel)"}</span>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    disabled={uploadingFile}
                  />
                </label>
                {fileName && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    ✓ {fileName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Visual Readiness Checklist */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Kiểm tra điều kiện gửi duyệt lớp học:
            </span>
            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
              validationChecks.isAllValid 
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}>
              {validationChecks.isAllValid ? "✓ Đã đủ điều kiện" : "Chưa hoàn tất"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-2 font-bold ${validationChecks.isSubjectLevel ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isSubjectLevel ? "✓" : "○"} Đã chọn Môn học & 1 Cấp độ đã duyệt
            </div>

            <div className={`flex items-center gap-2 font-bold ${validationChecks.isName && validationChecks.isDesc ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isName && validationChecks.isDesc ? "✓" : "○"} Tên lớp (tối thiểu 3 ký tự) & Mô tả (tối thiểu 5 ký tự)
            </div>

            <div className={`flex items-center gap-2 font-bold ${validationChecks.isMode ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isMode ? "✓" : "○"} {learningMode === "ONLINE" ? "Đã nhập Link phòng học (Meet/Zoom)" : "Đã nhập Địa chỉ học trực tiếp"}
            </div>

            <div className={`flex items-center gap-2 font-bold ${validationChecks.isPrice ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isPrice ? "✓" : "○"} Học phí nằm trong khoảng đã duyệt ({activeRegistration ? `${activeRegistration.tuitionMin?.toLocaleString("vi-VN")} - ${activeRegistration.tuitionMax?.toLocaleString("vi-VN")} đ` : "hợp lệ"})
            </div>

            <div className={`flex items-center gap-2 font-bold ${validationChecks.isSchedule ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isSchedule ? "✓" : "○"} Đã chọn đủ {sessionsPerWeek} buổi từ Lịch rảnh ({configuredSessions.length}/{sessionsPerWeek} buổi hợp lệ)
            </div>

            <div className={`flex items-center gap-2 font-bold ${validationChecks.isSyllabus ? "text-emerald-700" : "text-slate-400"}`}>
              {validationChecks.isSyllabus ? "✓" : "○"} {
                syllabusMode === "FORM" 
                  ? `Đã nhập lộ trình (${chapters.length} chương)` 
                  : syllabusMode === "FILE" 
                  ? (syllabusFileUrl ? "Đã tải file lộ trình" : "Chưa tải file lộ trình") 
                  : (chapters.length >= 1 && syllabusFileUrl ? "Đã nhập chương & tải file" : "Chưa đủ chương hoặc file")
              }
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="font-bold">{errorBanner}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={!validationChecks.isAllValid || submitting}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all shadow-md ${
              validationChecks.isAllValid && !submitting
                ? "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/20 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Đang gửi duyệt...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Gửi Duyệt Lớp Học</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
