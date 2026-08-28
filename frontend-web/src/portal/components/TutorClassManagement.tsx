import React, { useState, useEffect } from "react";
import { 
  GraduationCap, Plus, Calendar, Clock, DollarSign, Users, 
  Video, MapPin, AlertCircle, CheckCircle2, XCircle, Search, 
  ChevronRight, Trash2, Eye, FileText, Sparkles, Key, Lock, Settings2, Globe, EyeOff, Copy, Check, Info, Layers
} from "lucide-react";
import { classApi } from "../../api/classes";
import { CreateClassWizard } from "./CreateClassWizard";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";

interface ChapterItem {
  id?: number | string;
  title: string;
  description: string;
  expectedSessions: number;
  orderIndex?: number;
}

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
  syllabusMode: "FORM" | "FILE" | "BOTH";
  syllabusFileUrl?: string;
  joinMode?: "OPEN_REQUEST" | "INVITE_KEY";
  joinKey?: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PRIVATE" | "PUBLISHED" | "LOCKED" | "REJECTED" | "CLOSED" | "CANCELLED";
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
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [classes, setClasses] = useState<ClassRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  // Unified Class Detail & Settings Modal State
  const [detailModalClass, setDetailModalClass] = useState<ClassRoomItem | null>(null);
  const [modalTab, setModalTab] = useState<"OVERVIEW" | "EDIT" | "SETTINGS">("OVERVIEW");

  // Edit details form state
  const [editDescription, setEditDescription] = useState("");
  const [editMeetingLink, setEditMeetingLink] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSyllabusMode, setEditSyllabusMode] = useState<"FORM" | "FILE" | "BOTH">("FORM");
  const [editSyllabusFileUrl, setEditSyllabusFileUrl] = useState("");
  const [editChapters, setEditChapters] = useState<ChapterItem[]>([]);
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);

  // Visibility / JoinMode settings state
  const [targetStatus, setTargetStatus] = useState<"PRIVATE" | "PUBLISHED">("PUBLISHED");
  const [targetJoinMode, setTargetJoinMode] = useState<"OPEN_REQUEST" | "INVITE_KEY">("OPEN_REQUEST");
  const [targetJoinKey, setTargetJoinKey] = useState<string>("");
  const [targetRatioPercent, setTargetRatioPercent] = useState<number>(150);
  const [visibilitySubmitting, setVisibilitySubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Enrollment Requests tab state
  const [enrollmentRequests, setEnrollmentRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestActionMsg, setRequestActionMsg] = useState("");

  const loadRequestsForClass = async (classId: number) => {
    setRequestsLoading(true);
    setRequestActionMsg("");
    try {
      const data = await classApi.getRequestsForClass(classId);
      setEnrollmentRequests(data || []);
    } catch (err: any) {
      console.error("Failed to load requests", err);
      setEnrollmentRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: number, studentName?: string) => {
    const name = studentName || "học viên này";
    if (!window.confirm(`XÁC NHẬN CHẤP NHẬN:\nBạn có chắc chắn muốn nhận ${name} vào lớp học này không?`)) {
      return;
    }
    setRequestActionMsg("");
    try {
      await classApi.acceptEnrollmentRequest(requestId);
      setRequestActionMsg("Đã chấp nhận yêu cầu tham gia thành công!");
      if (detailModalClass) loadRequestsForClass(detailModalClass.id);
      loadClasses();
    } catch (err: any) {
      setRequestActionMsg(err?.message || "Không thể chấp nhận yêu cầu.");
    }
  };

  const handleRejectRequest = async (requestId: number, studentName?: string) => {
    const name = studentName || "học viên này";
    if (!window.confirm(`XÁC NHẬN TỪ CHỐI:\nBạn có chắc chắn muốn từ chối yêu cầu tham gia của ${name} không?`)) {
      return;
    }
    setRequestActionMsg("");
    try {
      await classApi.rejectEnrollmentRequest(requestId, undefined);
      setRequestActionMsg("Đã từ chối yêu cầu tham gia!");
      if (detailModalClass) loadRequestsForClass(detailModalClass.id);
      loadClasses();
    } catch (err: any) {
      setRequestActionMsg(err?.message || "Không thể từ chối yêu cầu.");
    }
  };

  const [tutorApp, setTutorApp] = useState<any>(null);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classApi.getMyClasses();
      const nextClasses = data || [];
      setClasses(nextClasses);
      setDetailModalClass(prev => {
        if (!prev) return prev;
        return nextClasses.find((item: ClassRoomItem) => item.id === prev.id) || prev;
      });
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 401) {
        setClasses([]);
      } else {
        console.error("Failed to load classes", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh(["CLASS_REVIEWED"], loadClasses);

  useEffect(() => {
    loadClasses();
    import("../../api/tutorApplications").then(({ tutorApplicationApi }) => {
      tutorApplicationApi.getMyTutorApplication()
        .then(data => setTutorApp(data))
        .catch(() => setTutorApp(null));
    });
  }, []);

  const handleCreateClick = () => {
    if (tutorApp && tutorApp.status !== "APPROVED") {
      alert("Hồ sơ cá nhân và xác minh danh tính của bạn đang trong trạng thái " + (tutorApp.status === "PENDING" ? "CHỜ BAN QUẢN TRỊ DUYỆT" : "CHƯA ĐƯỢC PHÊ DUYỆT") + ".\n\nBạn tạm thời chưa thể tạo lớp học mới lúc này. Các lớp học đã tạo trước đó vẫn hoạt động và giảng dạy bình thường.");
      return;
    }
    setViewMode("create");
  };

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

  // Open Unified Detail Modal
  const openDetailModal = (cls: ClassRoomItem, initialTab: "OVERVIEW" | "EDIT" | "SETTINGS" | "REQUESTS" = "OVERVIEW") => {
    setDetailModalClass(cls);
    setModalTab(initialTab);
    loadRequestsForClass(cls.id);

    // Populate Edit details state
    setEditDescription(cls.description || "");
    setEditMeetingLink(cls.meetingLink || "");
    setEditAddress(cls.address || "");
    setEditSyllabusMode(cls.syllabusMode || "FORM");
    setEditSyllabusFileUrl(cls.syllabusFileUrl || "");
    setEditChapters(cls.chapters && cls.chapters.length > 0 ? cls.chapters.map(ch => ({ ...ch })) : [
      { title: "Chương 1: Kiến thức nền tảng", description: "", expectedSessions: 2 }
    ]);

    // Populate Settings state (only PRIVATE or PUBLISHED can be chosen by tutor)
    const initialStatus = cls.status === "PUBLISHED" ? "PUBLISHED" : "PRIVATE";
    setTargetStatus(initialStatus as any);
    setTargetJoinMode(cls.joinMode || "OPEN_REQUEST");
    setTargetJoinKey(cls.joinKey || "");
    setTargetRatioPercent((cls as any).bufferPoolRatioPercent || 150);
  };

  // Generate Random Key
  const handleGenerateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "KEY";
    for (let i = 0; i < 4; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTargetJoinKey(key);
  };

  // Copy Key to Clipboard
  const handleCopyKey = () => {
    if (!targetJoinKey) return;
    navigator.clipboard.writeText(targetJoinKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Submit Visibility Config
  const handleSaveVisibility = async () => {
    if (!detailModalClass) return;
    if (targetJoinMode === "INVITE_KEY" && !targetJoinKey.trim()) {
      alert("Vui lòng nhập Mã mời (Invite Key) hoặc nhấn 'Tạo ngẫu nhiên'.");
      return;
    }

    setVisibilitySubmitting(true);
    try {
      await classApi.updateVisibility(detailModalClass.id, {
        status: targetStatus,
        joinMode: targetJoinMode,
        joinKey: targetJoinMode === "INVITE_KEY" ? targetJoinKey.trim().toUpperCase() : null,
        bufferPoolRatioPercent: targetRatioPercent,
        maxPendingRequests: Math.ceil(detailModalClass.maxStudents * (targetRatioPercent / 100))
      });
      await loadClasses();
      setModalTab("OVERVIEW");
      // Update local modal instance
      setDetailModalClass(prev => prev ? {
        ...prev,
        status: targetStatus,
        joinMode: targetJoinMode,
        joinKey: targetJoinMode === "INVITE_KEY" ? targetJoinKey.trim().toUpperCase() : undefined,
        maxPendingRequests: Math.ceil(detailModalClass.maxStudents * (targetRatioPercent / 100)),
        bufferPoolRatioPercent: targetRatioPercent
      } as any : null);
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật trạng thái mở bán.");
    } finally {
      setVisibilitySubmitting(false);
    }
  };

  // Submit Details Edit
  const handleSaveDetails = async () => {
    if (!detailModalClass) return;
    if (!editDescription.trim()) {
      alert("Mô tả chi tiết không được để trống.");
      return;
    }

    setDetailsSubmitting(true);
    try {
      await classApi.updateClassDetails(detailModalClass.id, {
        description: editDescription.trim(),
        meetingLink: editMeetingLink.trim(),
        address: editAddress.trim(),
        syllabusMode: editSyllabusMode,
        syllabusFileUrl: editSyllabusFileUrl.trim(),
        chapters: editChapters.map((ch, i) => ({
          title: ch.title.trim(),
          description: ch.description ? ch.description.trim() : "",
          expectedSessions: Number(ch.expectedSessions),
          orderIndex: i + 1
        }))
      });
      await loadClasses();
      setModalTab("OVERVIEW");
      // Update local modal instance
      setDetailModalClass(prev => prev ? {
        ...prev,
        description: editDescription.trim(),
        meetingLink: editMeetingLink.trim(),
        address: editAddress.trim(),
        syllabusMode: editSyllabusMode,
        syllabusFileUrl: editSyllabusFileUrl.trim(),
        chapters: editChapters.map((ch, i) => ({
          id: ch.id ? Number(ch.id) : i + 1,
          title: ch.title.trim(),
          description: ch.description ? ch.description.trim() : "",
          expectedSessions: Number(ch.expectedSessions),
          orderIndex: i + 1
        }))
      } : null);
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật thông tin mô tả/lộ trình.");
    } finally {
      setDetailsSubmitting(false);
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
    published: classes.filter(c => c.status === "PUBLISHED").length,
    privateCount: classes.filter(c => c.status === "PRIVATE").length,
    pending: classes.filter(c => c.status === "PENDING_APPROVAL").length,
    locked: classes.filter(c => c.status === "LOCKED").length,
    closed: classes.filter(c => c.status === "CLOSED").length,
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

  const renderStatusBadge = (status: string, joinMode?: string, joinKey?: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-600" /> Đang Mở Bán
            </span>
            {joinMode === "INVITE_KEY" ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                <Key className="w-3 h-3 text-sky-600" /> Key: {joinKey || "MATH20A"}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                Tự do đăng ký
              </span>
            )}
          </div>
        );
      case "PRIVATE":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
            <EyeOff className="w-3 h-3 text-slate-500" /> Chưa mở bán (PRIVATE)
          </span>
        );
      case "LOCKED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <Lock className="w-3 h-3 text-purple-600" /> Đã Khóa Lớp (Tự động)
          </span>
        );
      case "CLOSED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-300 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-zinc-500" /> Đã Đóng Lớp (Tự động)
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> Chờ Staff duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Bị từ chối
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
              Bấm vào <strong>"Xem chi tiết & Cài đặt"</strong> để xem đầy đủ thông tin, chỉnh sửa mô tả/lộ trình hoặc chuyển đổi giữa <strong>PRIVATE</strong> và <strong>PUBLISHED</strong>.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateClick}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-white font-black text-xs hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Lớp Học Mới</span>
        </button>
      </div>

      {/* Pending Re-Approval Warning Banner */}
      {tutorApp?.status === "PENDING" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 flex items-start gap-3 shadow-xs">
          <span className="text-xl">⏳</span>
          <div className="text-xs leading-5">
            <p className="font-extrabold text-sm text-amber-950">Hồ sơ cá nhân & xác minh của bạn đang chờ Ban quản trị xét duyệt</p>
            <p className="mt-0.5 font-semibold text-amber-800">
              Bạn tạm thời không thể tạo thêm lớp học mới lúc này. Tất cả các lớp học hiện tại đã tạo của bạn vẫn hoạt động, tuyển sinh và giảng dạy bình thường.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
            {stats.total}
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Tổng số lớp</span>
            <span className="text-xs font-black text-slate-800 block">Tất cả</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs">
            {stats.published}
          </div>
          <div>
            <span className="text-[9px] font-bold text-emerald-600 uppercase">Mở bán</span>
            <span className="text-xs font-black text-slate-800 block">PUBLISHED</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
            {stats.privateCount}
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Tạm ngưng</span>
            <span className="text-xs font-black text-slate-800 block">PRIVATE</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-xs">
            {stats.locked}
          </div>
          <div>
            <span className="text-[9px] font-bold text-purple-600 uppercase">Khóa lớp</span>
            <span className="text-xs font-black text-slate-800 block">LOCKED</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xs">
            {stats.pending}
          </div>
          <div>
            <span className="text-[9px] font-bold text-amber-500 uppercase">Chờ duyệt</span>
            <span className="text-xs font-black text-slate-800 block">Staff</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black text-xs">
            {stats.rejected}
          </div>
          <div>
            <span className="text-[9px] font-bold text-rose-500 uppercase">Bị từ chối</span>
            <span className="text-xs font-black text-slate-800 block">REJECTED</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-brand-border/30 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "PUBLISHED", label: `Đang mở bán (${stats.published})` },
            { id: "PRIVATE", label: `Tạm ngưng (${stats.privateCount})` },
            { id: "LOCKED", label: `Đã khóa (${stats.locked})` },
            { id: "CLOSED", label: `Đã đóng (${stats.closed})` },
            { id: "PENDING_APPROVAL", label: `Chờ duyệt (${stats.pending})` },
            { id: "REJECTED", label: `Từ chối (${stats.rejected})` }
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

      {/* Class List Grid */}
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClasses.map(cls => (
            <div 
              key={cls.id} 
              className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/50 hover:shadow-md transition-all flex flex-col justify-between gap-4 cursor-pointer group"
              onClick={() => openDetailModal(cls, "OVERVIEW")}
            >
              <div className="space-y-3">
                {/* Subject & Status Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-[11px] font-black uppercase tracking-wider">
                    {cls.registration?.subjectName || "Môn học"} &bull; {cls.level?.name || "Cấp độ"}
                  </span>
                  {renderStatusBadge(cls.status, cls.joinMode, cls.joinKey)}
                </div>

                {/* Class Title */}
                <div>
                  <h3 className="font-display font-black text-base text-slate-900 group-hover:text-brand-primary transition-colors line-clamp-1">
                    {cls.name}
                  </h3>
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
                      {cls.learningMode === "ONLINE" ? (cls.meetingLink ? "Online (Đã tạo Link)" : "Online") : (cls.address || "Offline")}
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

              {/* Card Footer Actions */}
              <div 
                className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-slate-400 font-semibold text-[11px]">
                  Tổng {cls.totalSessions} buổi &bull; {cls.totalPrice?.toLocaleString("vi-VN")} đ
                </span>

                <div className="flex items-center gap-2">
                  {/* Primary Unified Action: Xem chi tiết & Cài đặt */}
                  <button
                    onClick={() => openDetailModal(cls, "OVERVIEW")}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center gap-1.5"
                    title="Xem chi tiết, chỉnh sửa & cài đặt"
                  >
                    <Eye className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Xem chi tiết & Cài đặt</span>
                  </button>

                  {/* Direct Publish shortcut */}
                  {(cls.status === "PRIVATE" || cls.status === "PUBLISHED") && (
                    <button
                      onClick={() => openDetailModal(cls, "SETTINGS")}
                      className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>{cls.status === "PUBLISHED" ? "Cấu hình" : "Mở bán (Publish)"}</span>
                    </button>
                  )}

                  {(cls.status === "DRAFT" || cls.status === "REJECTED" || cls.status === "PENDING_APPROVAL") && (
                    <button
                      onClick={() => handleDeleteClass(cls)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Xóa lớp"
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

      {/* ------------------------------------------------------------- */}
      {/* UNIFIED MODAL: XEM CHI TIẾT, CHỈNH SỬA MÔ TẢ & CÀI ĐẶT MỞ BÁN */}
      {/* ------------------------------------------------------------- */}
      {detailModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-lg text-slate-900">
                    {detailModalClass.name}
                  </h3>
                  {renderStatusBadge(detailModalClass.status, detailModalClass.joinMode, detailModalClass.joinKey)}
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Môn: <strong className="text-brand-primary">{detailModalClass.registration?.subjectName}</strong> &bull; Cấp độ: <strong>{detailModalClass.level?.name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setDetailModalClass(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab("OVERVIEW")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "OVERVIEW"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>👁️ 1. Tổng quan & Chi tiết</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab("REQUESTS" as any);
                  loadRequestsForClass(detailModalClass.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === ("REQUESTS" as any)
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>📋 2. Yêu cầu tham gia lớp</span>
              </button>

              {(detailModalClass.status === "PRIVATE" || detailModalClass.status === "PUBLISHED" || detailModalClass.status === "PENDING_APPROVAL") && (
                <button
                  type="button"
                  onClick={() => setModalTab("EDIT")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    modalTab === "EDIT"
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>✏️ 3. Chỉnh sửa mô tả</span>
                </button>
              )}

              {(detailModalClass.status === "PRIVATE" || detailModalClass.status === "PUBLISHED") && (
                <button
                  type="button"
                  onClick={() => setModalTab("SETTINGS")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    modalTab === "SETTINGS"
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>⚙️ 4. Cài đặt Mở bán</span>
                </button>
              )}
            </div>

            {/* ========================================================= */}
            {/* TAB 1: OVERVIEW & DETAILS VIEW                            */}
            {/* ========================================================= */}
            {modalTab === "OVERVIEW" && (
              <div className="space-y-4 text-xs">
                {/* Status Notice */}
                {detailModalClass.status === "PRIVATE" && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 space-y-1">
                    <span className="font-black text-xs flex items-center gap-1.5 text-sky-800">
                      <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      Lớp ở trạng thái PRIVATE (Chưa mở bán)
                    </span>
                    <p className="text-[11px] font-semibold text-sky-700">
                      Lớp đã được Admin/Staff duyệt thành công! Bạn hãy kiểm tra lại thông tin, chỉnh sửa Mô tả/Lộ trình hoặc chuyển sang tab <strong>"Cài đặt Mở bán"</strong> để Publish công khai.
                    </p>
                  </div>
                )}

                {detailModalClass.status === "LOCKED" && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 space-y-1">
                    <span className="font-black text-xs flex items-center gap-1.5 text-purple-800">
                      <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                      Lớp đã Khóa (LOCKED - Hệ thống tự động)
                    </span>
                    <p className="text-[11px] font-semibold text-purple-700">
                      Lớp học đã tự động khóa không nhận thêm đăng ký do đã đủ sĩ số tối đa ({detailModalClass.maxStudents} học viên) hoặc đã đến ngày bắt đầu ({detailModalClass.startDate}).
                    </p>
                  </div>
                )}

                {detailModalClass.status === "CLOSED" && (
                  <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-2xl text-zinc-800 space-y-1">
                    <span className="font-black text-xs flex items-center gap-1.5 text-zinc-700">
                      <XCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                      Lớp đã Đóng (CLOSED - Hệ thống tự động)
                    </span>
                    <p className="text-[11px] font-semibold text-zinc-600">
                      Lớp học đã tự động đóng tuyển sinh do đến ngày bắt đầu ({detailModalClass.startDate}) mà không có học viên nào đăng ký (0 học viên).
                    </p>
                  </div>
                )}

                {/* Reject Reason Banner if any */}
                {detailModalClass.status === "REJECTED" && detailModalClass.rejectReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
                    <strong>Lý do từ chối duyệt:</strong> {detailModalClass.rejectReason}
                  </div>
                )}

                {/* Grid Summary of Approved Specifications */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Thông số cốt lõi đã qua kiểm duyệt:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700 font-medium">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Học phí / buổi</span>
                      <strong className="text-brand-primary text-sm font-black">{detailModalClass.pricePerSession?.toLocaleString("vi-VN")} đ</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng số buổi / Khóa</span>
                      <strong className="text-slate-900 font-bold">{detailModalClass.totalSessions} buổi ({detailModalClass.totalPrice?.toLocaleString("vi-VN")} đ)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Sĩ số tối đa</span>
                      <strong className="text-slate-900 font-bold">{detailModalClass.maxStudents} học viên</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tần suất & Thời lượng</span>
                      <strong className="text-slate-900 font-bold">{detailModalClass.sessionsPerWeek} buổi/tuần ({detailModalClass.durationPerSessionMinutes} phút)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Hình thức học</span>
                      <strong className="text-slate-900 font-bold">{detailModalClass.learningMode === "ONLINE" ? "Học Online" : "Học Offline"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời gian khóa</span>
                      <strong className="text-slate-900 font-bold">{detailModalClass.startDate} ➔ {detailModalClass.endDate}</strong>
                    </div>
                  </div>
                </div>

                {/* Schedules */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Lịch học cố định trong tuần:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {detailModalClass.schedules.map(s => {
                      const dayLabel = VIETNAMESE_DAYS.find(d => d.value === s.dayOfWeek)?.label || `T${s.dayOfWeek}`;
                      return (
                        <span key={s.id} className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                          {dayLabel}: {s.startTime} - {s.endTime}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mô tả chi tiết lớp học:
                  </label>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed font-medium">
                    {detailModalClass.description || "Chưa có mô tả chi tiết."}
                  </p>
                </div>

                {/* Meeting Link or Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {detailModalClass.learningMode === "ONLINE" ? "Link phòng học Online:" : "Địa điểm học Offline:"}
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                    {detailModalClass.learningMode === "ONLINE" ? (
                      detailModalClass.meetingLink ? (
                        <a href={detailModalClass.meetingLink} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" /> {detailModalClass.meetingLink}
                        </a>
                      ) : <span className="text-slate-400 italic">Chưa điền link phòng học (Google Meet/Zoom)</span>
                    ) : (
                      detailModalClass.address || <span className="text-slate-400 italic">Chưa điền địa chỉ học Offline</span>
                    )}
                  </div>
                </div>

                {/* Syllabus Chapters */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Lộ trình giảng dạy ({detailModalClass.chapters?.length || 0} chương):
                  </label>
                  {detailModalClass.chapters && detailModalClass.chapters.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {detailModalClass.chapters.map((ch, i) => (
                        <div key={ch.id || i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span>{ch.title}</span>
                            <span className="text-[11px] text-slate-500 font-semibold">{ch.expectedSessions} buổi</span>
                          </div>
                          {ch.description && <p className="text-[11px] text-slate-600 font-medium">{ch.description}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">Chưa nhập chương trình dạy.</p>
                  )}
                </div>

                {/* Modal Footer Quick Navigation */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDetailModalClass(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalTab("EDIT")}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 text-xs font-bold hover:bg-slate-100 flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Sửa mô tả & lộ trình</span>
                    </button>
                    {(detailModalClass.status === "PRIVATE" || detailModalClass.status === "PUBLISHED") && (
                      <button
                        type="button"
                        onClick={() => setModalTab("SETTINGS")}
                        className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 flex items-center gap-1 shadow-sm"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Cài đặt Mở bán (Publish)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: EDIT DESCRIPTION & SYLLABUS                        */}
            {/* ========================================================= */}
            {modalTab === "EDIT" && (
              <div className="space-y-4">
                {/* Readonly Banner for Approved Immutable Fields */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                  <span className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    Thông số đã duyệt (Khóa - Không thể chỉnh sửa):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-bold text-amber-900">
                    <div>• Học phí: {detailModalClass.pricePerSession?.toLocaleString("vi-VN")} đ/buổi</div>
                    <div>• Số học viên: Tối đa {detailModalClass.maxStudents}</div>
                    <div>• Số buổi: {detailModalClass.sessionsPerWeek} buổi/tuần ({detailModalClass.durationPerSessionMinutes}p)</div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mô tả chi tiết lớp học <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Mô tả mục tiêu, đối tượng học viên, cam kết đầu ra..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  {/* Meeting Link / Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {detailModalClass.learningMode === "ONLINE" ? "Link phòng học Online (Google Meet/Zoom)" : "Địa điểm học Offline"}
                    </label>
                    {detailModalClass.learningMode === "ONLINE" ? (
                      <input
                        type="url"
                        value={editMeetingLink}
                        onChange={(e) => setEditMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Nhập địa điểm lớp..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                      />
                    )}
                  </div>

                  {/* Syllabus Chapters */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        Lộ trình học theo Chương:
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditChapters([
                          ...editChapters,
                          { title: `Chương ${editChapters.length + 1}: `, description: "", expectedSessions: 2 }
                        ])}
                        className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm chương
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {editChapters.map((ch, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={ch.title}
                              onChange={(e) => setEditChapters(editChapters.map((c, i) => i === idx ? { ...c, title: e.target.value } : c))}
                              placeholder="Tiêu đề chương..."
                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => setEditChapters(editChapters.filter((_, i) => i !== idx))}
                              className="text-rose-600 p-1 hover:bg-rose-50 rounded-lg text-xs font-bold"
                            >
                              Xóa
                            </button>
                          </div>
                          <input
                            type="text"
                            value={ch.description}
                            onChange={(e) => setEditChapters(editChapters.map((c, i) => i === idx ? { ...c, description: e.target.value } : c))}
                            placeholder="Mô tả nội dung chương..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab("OVERVIEW")}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    Quay lại Xem Chi tiết
                  </button>
                  <button
                    type="button"
                    disabled={detailsSubmitting}
                    onClick={handleSaveDetails}
                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 disabled:opacity-50"
                  >
                    {detailsSubmitting ? "Đang lưu..." : "Lưu Thông Tin Chi Tiết"}
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: ENROLLMENT REQUESTS MANAGEMENT                    */}
            {/* ========================================================= */}
            {modalTab === ("REQUESTS" as any) && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand-primary" /> Danh sách yêu cầu tham gia ({enrollmentRequests.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => loadRequestsForClass(detailModalClass.id)}
                    className="text-xs font-bold text-brand-primary hover:underline"
                  >
                    Làm mới
                  </button>
                </div>

                {requestActionMsg && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-bold">
                    {requestActionMsg}
                  </div>
                )}

                {requestsLoading ? (
                  <div className="p-6 text-center text-slate-400 font-medium">Đang tải danh sách...</div>
                ) : enrollmentRequests.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-medium">
                    Chưa có học viên nào gửi yêu cầu tham gia lớp này.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {enrollmentRequests.map((req) => {
                      const displayName = req.studentName && req.studentName.toLowerCase() !== req.studentEmail?.toLowerCase()
                        ? req.studentName
                        : "Học viên";

                      return (
                        <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs font-display">{displayName}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                req.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                                req.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" :
                                req.status === "REJECTED" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-700"
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <span>Email:</span>
                              <strong className="text-slate-700 font-bold">{req.studentEmail}</strong>
                            </div>
                          </div>

                          {req.status === "PENDING" && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRejectRequest(req.id, displayName)}
                                className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all"
                              >
                                Từ chối
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptRequest(req.id, displayName)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-black transition-all shadow-sm"
                              >
                                Chấp nhận
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: VISIBILITY & JOIN MODE SETTINGS                     */}
            {/* ========================================================= */}
            {modalTab === "SETTINGS" && (
              <div className="space-y-5">
                {/* Notice for System Auto Statuses */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <span className="font-black text-slate-800 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-brand-primary" /> Lưu ý về Trạng thái Khóa & Đóng lớp tự động:
                  </span>
                  <div className="space-y-1 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <div>• 🔒 <strong>LOCKED (Khóa lớp)</strong>: Hệ thống tự động khóa không nhận thêm đăng ký khi lớp đạt sĩ số tối đa ({detailModalClass.maxStudents} học viên) hoặc đến ngày học bắt đầu ({detailModalClass.startDate}).</div>
                    <div>• 🚫 <strong>CLOSED (Đóng lớp)</strong>: Hệ thống tự động đóng tuyển sinh khi đến ngày học bắt đầu ({detailModalClass.startDate}) mà không có học viên nào tham gia (0 học viên).</div>
                  </div>
                </div>

                {/* Step 1: Visibility Status Selection (Tutor can toggle PRIVATE <-> PUBLISHED) */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    1. Trạng thái hiển thị tuyển sinh của Gia sư:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetStatus("PUBLISHED")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        targetStatus === "PUBLISHED"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-xs text-emerald-700 mb-1">
                        <Globe className="w-4 h-4" /> PUBLISHED (Mở bán)
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 block leading-tight">
                        Mở bán công khai trên danh mục cho học viên đăng ký
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetStatus("PRIVATE")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        targetStatus === "PRIVATE"
                          ? "border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-400/20"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 mb-1">
                        <EyeOff className="w-4 h-4" /> PRIVATE (Tạm ngưng)
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 block leading-tight">
                        Tạm ẩn lớp, ngưng nhận đăng ký mới
                      </span>
                    </button>
                  </div>
                </div>

                {/* Step 2: Join Mode Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    2. Chế độ gửi yêu cầu tham gia (Join Mode):
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetJoinMode("OPEN_REQUEST")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        targetJoinMode === "OPEN_REQUEST"
                          ? "border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/20"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="font-black text-xs block text-brand-primary mb-1">1. Tự do gửi yêu cầu</span>
                      <span className="text-[11px] font-medium text-slate-500 block leading-tight">
                        Mọi học viên tìm thấy lớp đều có thể bấm Tham gia.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetJoinMode("INVITE_KEY");
                        if (!targetJoinKey) handleGenerateKey();
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        targetJoinMode === "INVITE_KEY"
                          ? "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="font-black text-xs block text-sky-700 mb-1">2. Bắt buộc nhập Mã mời (Key)</span>
                      <span className="text-[11px] font-medium text-slate-500 block leading-tight">
                        Chỉ học viên có đúng Key mới được gửi yêu cầu.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Step 3: Invite Key Input if INVITE_KEY selected */}
                {targetJoinMode === "INVITE_KEY" && (
                  <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-sky-900 flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-sky-600" /> Mã mời (Invite Key):
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateKey}
                        className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Tạo ngẫu nhiên
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={targetJoinKey}
                        onChange={(e) => setTargetJoinKey(e.target.value.toUpperCase())}
                        placeholder="VD: ABC123 hoặc MATH20A"
                        className="flex-1 px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-black text-sky-900 tracking-wider focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="px-3 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 flex items-center gap-1 shrink-0"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? "Đã chép" : "Sao chép"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-sky-700 font-medium">
                      💡 Gửi Mã mời này cho học viên 1-1 hoặc nhóm 20 bạn qua tin nhắn/zalo để họ tham gia.
                    </p>
                  </div>
                )}

                {/* Step 3: Buffer Pool Ratio Percentage */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    3. Cấu hình Tỷ lệ trần danh sách chờ (Buffer Pool %):
                  </label>
                  <select
                    value={targetRatioPercent}
                    onChange={(e) => setTargetRatioPercent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value={100}>100% (1.0x - {detailModalClass.maxStudents} hồ sơ)</option>
                    <option value={150}>150% (1.5x - {Math.ceil(detailModalClass.maxStudents * 1.5)} hồ sơ)</option>
                    <option value={160}>160% (1.6x - {Math.ceil(detailModalClass.maxStudents * 1.6)} hồ sơ)</option>
                    <option value={200}>200% (2.0x - {detailModalClass.maxStudents * 2} hồ sơ)</option>
                    <option value={250}>250% (2.5x - {Math.ceil(detailModalClass.maxStudents * 2.5)} hồ sơ)</option>
                    <option value={300}>300% (3.0x - {detailModalClass.maxStudents * 3} hồ sơ)</option>
                  </select>
                  <span className="text-[11px] text-brand-primary font-bold block">
                    ➡️ Giới hạn hồ sơ chờ cùng lúc: {Math.ceil(detailModalClass.maxStudents * (targetRatioPercent / 100))} hồ sơ
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab("OVERVIEW")}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    Quay lại Xem Chi tiết
                  </button>
                  <button
                    type="button"
                    disabled={visibilitySubmitting}
                    onClick={handleSaveVisibility}
                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 disabled:opacity-50"
                  >
                    {visibilitySubmitting ? "Đang lưu..." : "Lưu Cài Đặt Mở Bán"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
