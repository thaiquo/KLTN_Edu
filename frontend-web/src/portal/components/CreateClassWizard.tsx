import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, BookOpen, Clock, Calendar, DollarSign, Users, Video, 
  MapPin, FileText, Plus, Trash2, CheckCircle2, AlertCircle, 
  Upload, Sparkles, HelpCircle, ChevronRight, Info
} from "lucide-react";
import { teachingRegistrationApi } from "../../api/teachingRegistrations";
import { classApi } from "../../api/classes";
import { tutorApplicationApi } from "../../api/tutorApplications";

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

const VIETNAMESE_DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" }
];

export function CreateClassWizard({ onBack, onSuccess }: CreateClassWizardProps) {

  // Data states
  const [registrations, setRegistrations] = useState<ApprovedRegistration[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SavedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form states
  const [selectedRegId, setSelectedRegId] = useState<number | "">("");
  const [selectedLevelId, setSelectedLevelId] = useState<number | "">("");
  const [className, setClassName] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState<number>(20);
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

  // Selected schedule slots from availability
  const [selectedSlots, setSelectedSlots] = useState<SavedSlot[]>([]);

  // Syllabus states
  const [syllabusMode, setSyllabusMode] = useState<"FORM" | "FILE" | "BOTH">("FORM");
  const [syllabusFileUrl, setSyllabusFileUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const [chapters, setChapters] = useState<ChapterItem[]>([
    { id: "1", title: "Chương 1: Kiến thức nền tảng", description: "Làm quen với các khái niệm căn bản", expectedSessions: 3 },
    { id: "2", title: "Chương 2: Luyện tập chuyên sâu", description: "Thực hành giải bài tập và ứng dụng", expectedSessions: 5 }
  ]);

  // Fetch approved registrations and local tutor availability
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const regs = await teachingRegistrationApi.mine();
        const approved = (regs || []).filter((r: any) => r.status === "APPROVED");
        setRegistrations(approved);

        if (approved.length > 0) {
          setSelectedRegId(approved[0].id);
          if (approved[0].levels && approved[0].levels.length > 0) {
            setSelectedLevelId(approved[0].levels[0].id);
          }
          setPricePerSession(approved[0].tuitionMin || 150000);
        }

        const dbSlots = await classApi.getAvailability();
        if (Array.isArray(dbSlots)) {
          const mapped = dbSlots.map((s: any) => ({
            id: String(s.id),
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime
          }));
          setAvailableSlots(mapped);
          if (mapped.length >= 3) {
            setSelectedSlots(mapped.slice(0, 3));
          }
        }
      } catch (err: any) {
        console.error("Failed to load approved registrations", err);
        setErrorBanner("Không thể tải danh sách môn học đã duyệt. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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

  // Toggle slot selection
  const handleToggleSlot = (slot: SavedSlot) => {
    const isSelected = selectedSlots.some(s => s.id === slot.id);
    if (isSelected) {
      setSelectedSlots(selectedSlots.filter(s => s.id !== slot.id));
    } else {
      if (selectedSlots.length >= sessionsPerWeek) {
        setErrorBanner(`Bạn đã chọn đủ ${sessionsPerWeek} buổi theo số buổi/tuần. Hãy bỏ chọn buổi khác trước.`);
        return;
      }
      setErrorBanner(null);
      setSelectedSlots([...selectedSlots, slot]);
    }
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
      // Upload via tutor document service
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
    const isSchedule = selectedSlots.length === sessionsPerWeek && selectedSlots.length > 0;
    
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
    meetingLink, address, pricePerSession, activeRegistration, selectedSlots, 
    sessionsPerWeek, syllabusMode, chapters, syllabusFileUrl
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
      name: className.trim(),
      description: description.trim(),
      learningMode,
      meetingLink: learningMode === "ONLINE" ? meetingLink.trim() : null,
      address: learningMode === "OFFLINE" ? address.trim() : null,
      maxStudents: Number(maxStudents),
      pricePerSession: price,
      sessionsPerWeek: Number(sessionsPerWeek),
      durationPerSessionMinutes: Number(durationPerSession),
      durationValue: Number(durationValue),
      durationUnit,
      startDate,
      schedules: selectedSlots.map(s => ({
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
        <p className="text-xs font-bold text-slate-500">Đang tải danh mục môn học đã duyệt...</p>
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
          Tạo lớp mới &bull; Chỉ môn đã duyệt
        </span>
      </div>

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="bg-white border border-brand-border/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
        {/* Header Title */}
        <div className="border-b border-slate-100 pb-5">
          <h2 className="font-display font-black text-xl text-brand-text">Tạo Lớp Học Dành Cho Tutor</h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            Điền đầy đủ thông tin chi tiết để gửi lớp học lên ban quản trị phê duyệt.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số lượng học viên tối đa <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number"
                min={1}
                max={100}
                value={maxStudents}
                onChange={(e) => setMaxStudents(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary transition-all"
              />
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
            <span>3. Thiết lập thời gian học & Lịch từ lịch rảnh</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số buổi học / tuần <span className="text-rose-500">*</span>
              </label>
              <select 
                value={sessionsPerWeek}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  setSessionsPerWeek(num);
                  if (selectedSlots.length > num) {
                    setSelectedSlots(selectedSlots.slice(0, num));
                  }
                }}
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

          {/* Pick Schedule from Tutor Availability Slots */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Chọn {sessionsPerWeek} buổi học trong tuần từ Lịch rảnh của bạn: <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                selectedSlots.length === sessionsPerWeek 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                Đã chọn: {selectedSlots.length} / {sessionsPerWeek} buổi
              </span>
            </div>

            {availableSlots.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                Bạn chưa thiết lập <strong>Lịch rảnh</strong> trong tuần. Hãy vào mục <strong>Lịch rảnh</strong> trong menu để tạo lịch trước khi mở lớp.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {availableSlots.map(slot => {
                  const dayName = VIETNAMESE_DAYS.find(d => d.value === slot.dayOfWeek)?.label || `Thứ ${slot.dayOfWeek}`;
                  const isSelected = selectedSlots.some(s => s.id === slot.id);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleToggleSlot(slot)}
                      className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                        isSelected 
                          ? "border-brand-primary bg-brand-primary/10 ring-2 ring-brand-primary/20 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-900">{dayName}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" />}
                      </div>
                      <span className="text-[11px] font-bold text-brand-primary">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </button>
                  );
                })}
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
              {validationChecks.isSchedule ? "✓" : "○"} Đã chọn đủ {sessionsPerWeek} buổi từ Lịch rảnh ({selectedSlots.length}/{sessionsPerWeek} buổi)
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
