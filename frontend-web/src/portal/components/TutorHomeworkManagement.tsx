import React, { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Filter,
  ExternalLink,
  Edit3,
  Award,
  Sparkles,
  ChevronRight,
  Loader2,
  Send,
  X,
  FileCheck,
  AlertTriangle,
  UploadCloud,
  CheckSquare,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Table,
  UserX,
  UserCheck,
  MessageSquare,
  ArrowRight,
  CornerDownRight,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { classApi } from "../../api/classes";

export interface SessionFileItem {
  id: number;
  sessionId: number;
  fileCategory: "ASSIGNMENT" | "MATERIAL";
  fileName: string;
  fileSize: number;
  contentType: string;
  fileOrder: number;
  createdAt: string;
}

export interface AttendanceItem {
  id: number;
  sessionId: number;
  studentId: number;
  studentName?: string;
  studentEmail?: string;
  tutorChecked?: boolean;
  tutorCheckedAt?: string;
  studentChecked?: boolean;
  studentCheckedAt?: string;
  submissionText?: string;
  submissionFileUrl?: string;
  submittedAt?: string;
  gradeScore?: string;
  tutorFeedback?: string;
  gradedAt?: string;
  gradedByTutorEmail?: string;
  isLateSubmission?: boolean;
  submissionFileName?: string;
  submissionFileSize?: number;
}

export interface HomeworkSessionItem {
  sessionId: number;
  classRoomId: number;
  classTitle: string;
  sequenceNumber: number;
  topic?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  assignmentTitle?: string;
  assignmentDescription?: string;
  assignmentFileUrl?: string;
  assignmentDueAt?: string;
  submissionRequired?: boolean;
  lateSubmissionAllowed?: boolean;
  materialUrl?: string;
  materialDescription?: string;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  submissions: AttendanceItem[];
  assignmentFiles?: SessionFileItem[];
  materialFiles?: SessionFileItem[];
  assignmentExternalUrl?: string;
  materialExternalUrl?: string;
}

interface Props {
  onNavigate?: (page: string) => void;
}

export const TutorHomeworkManagement: React.FC<Props> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<HomeworkSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [gradingSession, setGradingSession] = useState<HomeworkSessionItem | null>(null);
  const [editingSession, setEditingSession] = useState<HomeworkSessionItem | null>(null);
  const [viewingAssignmentSession, setViewingAssignmentSession] = useState<HomeworkSessionItem | null>(null);
  const [expandedDescSessionIds, setExpandedDescSessionIds] = useState<Record<number, boolean>>({});
  const [showAssignmentReviewInGrading, setShowAssignmentReviewInGrading] = useState<boolean>(true);

  // In-modal student filtering and view mode
  const [studentFilterTab, setStudentFilterTab] = useState<"ALL" | "PENDING" | "GRADED" | "UNSUBMITTED" | "LATE">("ALL");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [modalViewMode, setModalViewMode] = useState<"SPLIT" | "TABLE">("SPLIT");

  // Grading form state for active student
  const [activeAttendanceId, setActiveAttendanceId] = useState<number | null>(null);
  const [gradeScoreInput, setGradeScoreInput] = useState<string>("");
  const [tutorFeedbackInput, setTutorFeedbackInput] = useState<string>("");
  const [gradingSubmitting, setGradingSubmitting] = useState<boolean>(false);
  const [gradingSuccessMsg, setGradingSuccessMsg] = useState<string | null>(null);

  // Edit Assignment Form state
  const [editTopic, setEditTopic] = useState<string>("");
  const [editAssignmentTitle, setEditAssignmentTitle] = useState<string>("");
  const [editAssignmentDescription, setEditAssignmentDescription] = useState<string>("");
  const [editAssignmentFileUrl, setEditAssignmentFileUrl] = useState<string>("");
  const [editAssignmentDueAt, setEditAssignmentDueAt] = useState<string>("");
  const [editSubmissionRequired, setEditSubmissionRequired] = useState<boolean>(true);
  const [editLateSubmissionAllowed, setEditLateSubmissionAllowed] = useState<boolean>(true);
  const [editMaterialUrl, setEditMaterialUrl] = useState<string>("");
  const [editMaterialDescription, setEditMaterialDescription] = useState<string>("");
  const [editSaving, setEditSaving] = useState<boolean>(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await classApi.getTutorHomeworkOverview();
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
    } catch (err: any) {
      console.error("Failed to load tutor homework overview:", err);
      setError("Không thể tải danh sách bài tập. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // Distinct classes list for filter
  const classOptions = useMemo(() => {
    const map = new Map<number, string>();
    sessions.forEach((s) => {
      if (!map.has(s.classRoomId)) {
        map.set(s.classRoomId, s.classTitle || `Lớp #${s.classRoomId}`);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [sessions]);

  // Helper: A session has homework if tutor assigned title, description, files or students submitted
  const hasHomeworkContent = (session: HomeworkSessionItem) => {
    return Boolean(
      (session.assignmentTitle && session.assignmentTitle.trim().length > 0) ||
      (session.assignmentDescription && session.assignmentDescription.trim().length > 0) ||
      (session.assignmentFiles && session.assignmentFiles.length > 0) ||
      (session.assignmentFileUrl && session.assignmentFileUrl.trim().length > 0) ||
      session.submittedCount > 0
    );
  };

  // Only sessions that actually have homework content
  const homeworkSessions = useMemo(() => {
    return sessions.filter(hasHomeworkContent);
  }, [sessions]);

  // Overall Statistics calculated strictly on sessions with homework
  const stats = useMemo(() => {
    const totalHomeworks = homeworkSessions.length;
    const totalSubmissions = homeworkSessions.reduce((acc, s) => acc + s.submittedCount, 0);
    const totalGraded = homeworkSessions.reduce((acc, s) => acc + s.gradedCount, 0);
    const pendingGrading = Math.max(0, totalSubmissions - totalGraded);
    const lateSubmissions = homeworkSessions.reduce(
      (acc, s) => acc + (s.submissions || []).filter((sub) => sub.isLateSubmission).length,
      0
    );
    return {
      totalHomeworks,
      totalSubmissions,
      pendingGrading,
      totalGraded,
      lateSubmissions
    };
  }, [homeworkSessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const hasHW = hasHomeworkContent(session);
      // By default, only show sessions with homework. If tutor explicitly chooses "SHOW_ALL_SESSIONS", then show all.
      if (selectedStatusFilter !== "SHOW_ALL_SESSIONS" && !hasHW) {
        return false;
      }

      if (selectedClassId !== "ALL" && session.classRoomId !== Number(selectedClassId)) {
        return false;
      }
      if (selectedStatusFilter === "PENDING_GRADE" && (session.submittedCount <= session.gradedCount || session.submittedCount === 0)) {
        return false;
      }
      if (selectedStatusFilter === "COMPLETED" && (session.submittedCount === 0 || session.gradedCount < session.submittedCount)) {
        return false;
      }
      if (selectedStatusFilter === "NO_SUBMISSION" && session.submittedCount > 0) {
        return false;
      }
      if (selectedStatusFilter === "LATE_SUBMISSION" && !session.submissions?.some((sub) => sub.isLateSubmission)) {
        return false;
      }
      if (selectedStatusFilter === "PRACTICE_ONLY" && session.submissionRequired !== false) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = session.classTitle?.toLowerCase().includes(query);
        const matchTopic = session.topic?.toLowerCase().includes(query);
        const matchAssignment = session.assignmentTitle?.toLowerCase().includes(query);
        if (!matchTitle && !matchTopic && !matchAssignment) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, selectedClassId, selectedStatusFilter, searchQuery]);

  const QUICK_FEEDBACK_TEMPLATES = [
    "Bài làm rất tốt, làm bài đúng hạn và hiểu bài sâu sắc.",
    "Đã nắm được kiến thức trọng tâm, cần rèn luyện tính toán cẩn thận hơn.",
    "Trình bày rõ ràng, sạch đẹp, lập luận logic.",
    "Cần xem lại bài giảng và bổ sung câu trả lời còn thiếu.",
    "Học viên chưa nộp bài tập, cần hoàn thành trước buổi học tiếp theo."
  ];

  const handleOpenGrading = (
    session: HomeworkSessionItem,
    initialTab: "ALL" | "PENDING" | "GRADED" | "UNSUBMITTED" = "ALL",
    initialMode: "SPLIT" | "TABLE" = "SPLIT"
  ) => {
    setGradingSession(session);
    setGradingSuccessMsg(null);
    setStudentFilterTab(initialTab);
    setStudentSearchQuery("");
    setModalViewMode(initialMode);

    if (session.submissions && session.submissions.length > 0) {
      if (initialTab === "UNSUBMITTED") {
        const firstUnsub = session.submissions.find((s) => !s.submittedAt && !s.submissionText && !s.submissionFileUrl);
        if (firstUnsub) {
          selectStudentForGrading(firstUnsub);
          return;
        }
      }
      // Pick first student with pending submission, or first submitted, or simply first student
      const firstPending = session.submissions.find((s) => (s.submittedAt || s.submissionText || s.submissionFileUrl) && (!s.gradeScore || !s.gradeScore.trim()));
      const firstSubmitted = session.submissions.find((s) => s.submittedAt || s.submissionText || s.submissionFileUrl);
      selectStudentForGrading(firstPending || firstSubmitted || session.submissions[0]);
    } else {
      setActiveAttendanceId(null);
    }
  };

  const selectStudentForGrading = (att: AttendanceItem) => {
    setActiveAttendanceId(att.id);
    setGradeScoreInput(att.gradeScore || "");
    setTutorFeedbackInput(att.tutorFeedback || "");
    setGradingSuccessMsg(null);
  };

  const studentCounts = useMemo(() => {
    if (!gradingSession) return { total: 0, pending: 0, graded: 0, unsubmitted: 0, late: 0 };
    const subs = gradingSession.submissions || [];
    const total = subs.length;
    const submitted = subs.filter((s) => s.submittedAt || s.submissionText || s.submissionFileUrl);
    const graded = subs.filter((s) => s.gradeScore && s.gradeScore.trim().length > 0).length;
    const pending = Math.max(0, submitted.length - graded);
    const unsubmitted = Math.max(0, total - submitted.length);
    const late = subs.filter((s) => s.isLateSubmission).length;
    return { total, pending, graded, unsubmitted, late };
  }, [gradingSession]);

  const modalFilteredStudents = useMemo(() => {
    if (!gradingSession) return [];
    let list = gradingSession.submissions || [];

    if (studentFilterTab === "PENDING") {
      list = list.filter((s) => (s.submittedAt || s.submissionText || s.submissionFileUrl) && (!s.gradeScore || !s.gradeScore.trim()));
    } else if (studentFilterTab === "GRADED") {
      list = list.filter((s) => Boolean(s.gradeScore && s.gradeScore.trim().length > 0));
    } else if (studentFilterTab === "UNSUBMITTED") {
      list = list.filter((s) => !s.submittedAt && !s.submissionText && !s.submissionFileUrl);
    } else if (studentFilterTab === "LATE") {
      list = list.filter((s) => s.isLateSubmission);
    }

    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase();
      list = list.filter((s) =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.studentEmail && s.studentEmail.toLowerCase().includes(q)) ||
        String(s.studentId).includes(q)
      );
    }

    return list;
  }, [gradingSession, studentFilterTab, studentSearchQuery]);

  const handleSaveGrade = async (goToNext: boolean = false) => {
    if (!gradingSession || !activeAttendanceId) return;
    const gradeValue = gradeScoreInput.trim();
    const feedbackValue = tutorFeedbackInput.trim();
    if (!gradeValue) {
      alert("Vui lòng nhập điểm hoặc đánh giá Đạt/Chưa đạt.");
      return;
    }
    const normalizedGrade = gradeValue.toLowerCase().replace(/đ/g, "d").replace(/\s+/g, " ");
    const isPassFailGrade = ["dat", "chua dat", "pass", "fail"].includes(normalizedGrade);
    const numericGrade = Number.parseFloat(gradeValue.replace(",", "."));
    if (!isPassFailGrade && (Number.isNaN(numericGrade) || numericGrade < 0 || numericGrade > 10)) {
      alert("Điểm không hợp lệ. Hãy nhập số từ 0 đến 10 hoặc Đạt/Chưa đạt.");
      return;
    }
    if (!feedbackValue) {
      alert("Vui lòng nhập nhận xét để học viên biết cần cải thiện gì.");
      return;
    }
    setGradingSubmitting(true);
    setGradingSuccessMsg(null);
    try {
      const updatedAttendance = await classApi.gradeSessionHomework(
        gradingSession.sessionId,
        activeAttendanceId,
        {
          gradeScore: gradeValue,
          tutorFeedback: feedbackValue
        }
      );

      // Update in local state
      setSessions((prev) =>
        prev.map((s) => {
          if (s.sessionId !== gradingSession.sessionId) return s;
          const updatedSubs = s.submissions.map((sub) =>
            sub.id === activeAttendanceId
              ? { ...sub, gradeScore: updatedAttendance.gradeScore, tutorFeedback: updatedAttendance.tutorFeedback, gradedAt: updatedAttendance.gradedAt }
              : sub
          );
          const newGradedCount = updatedSubs.filter((sub) => sub.gradeScore && sub.gradeScore.trim().length > 0).length;
          return { ...s, submissions: updatedSubs, gradedCount: newGradedCount };
        })
      );

      let nextStudentToSelect: AttendanceItem | null = null;

      // Update in active modal state
      setGradingSession((prev) => {
        if (!prev) return null;
        const updatedSubs = prev.submissions.map((sub) =>
          sub.id === activeAttendanceId
            ? { ...sub, gradeScore: updatedAttendance.gradeScore, tutorFeedback: updatedAttendance.tutorFeedback, gradedAt: updatedAttendance.gradedAt }
            : sub
        );
        const newGradedCount = updatedSubs.filter((sub) => sub.gradeScore && sub.gradeScore.trim().length > 0).length;

        if (goToNext) {
          // Find next student who has submitted but not yet graded, or simply next student in list
          const remainingPending = updatedSubs.find((s) => s.id !== activeAttendanceId && (s.submittedAt || s.submissionText || s.submissionFileUrl) && (!s.gradeScore || !s.gradeScore.trim()));
          if (remainingPending) {
            nextStudentToSelect = remainingPending;
          } else {
            const currentIndex = updatedSubs.findIndex((s) => s.id === activeAttendanceId);
            if (currentIndex !== -1 && currentIndex < updatedSubs.length - 1) {
              nextStudentToSelect = updatedSubs[currentIndex + 1];
            }
          }
        }

        return { ...prev, submissions: updatedSubs, gradedCount: newGradedCount };
      });

      setGradingSuccessMsg("Đã lưu chấm điểm và nhận xét thành công!");
      setTimeout(() => setGradingSuccessMsg(null), 3000);

      if (goToNext && nextStudentToSelect) {
        selectStudentForGrading(nextStudentToSelect);
      }
    } catch (err: any) {
      console.error("Grading failed:", err);
      alert(err.message || "Không thể lưu chấm điểm. Vui lòng thử lại.");
    } finally {
      setGradingSubmitting(false);
    }
  };

  const [selectedAssignmentFiles, setSelectedAssignmentFiles] = useState<File[]>([]);
  const [selectedMaterialFiles, setSelectedMaterialFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<number | null>(null);
  const [downloadingSessionFileId, setDownloadingSessionFileId] = useState<number | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const toDateTimeLocalValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const normalizeDateTimeForApi = (value: string) => value.length === 16 ? `${value}:00` : value;

  const getDeadlineBaseDate = (currentValue?: string | null) => {
    const parsed = currentValue ? new Date(currentValue) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    return tomorrow;
  };

  const setEditDeadlinePlusDays = (days: number) => {
    const base = getDeadlineBaseDate(editAssignmentDueAt);
    base.setDate(base.getDate() + days);
    setEditAssignmentDueAt(toDateTimeLocalValue(base));
  };

  const handleQuickExtendDeadline = async (session: HomeworkSessionItem, days: number) => {
    const nextDue = getDeadlineBaseDate(session.assignmentDueAt);
    nextDue.setDate(nextDue.getDate() + days);
    const nextDueValue = toDateTimeLocalValue(nextDue);
    try {
      await classApi.updateSessionDetails(session.sessionId, {
        topic: session.topic || "",
        assignmentTitle: session.assignmentTitle || "",
        assignmentDescription: session.assignmentDescription || "",
        assignmentFileUrl: session.assignmentExternalUrl || session.assignmentFileUrl || "",
        assignmentExternalUrl: session.assignmentExternalUrl || session.assignmentFileUrl || "",
        submissionRequired: true,
        lateSubmissionAllowed: session.lateSubmissionAllowed !== false,
        materialUrl: session.materialExternalUrl || session.materialUrl || "",
        materialExternalUrl: session.materialExternalUrl || session.materialUrl || "",
        materialDescription: session.materialDescription || "",
        assignmentDueAt: normalizeDateTimeForApi(nextDueValue)
      });
      setSessions((prev) => prev.map((item) => item.sessionId === session.sessionId
        ? {
          ...item,
          assignmentDueAt: normalizeDateTimeForApi(nextDueValue),
          submissionRequired: true,
          lateSubmissionAllowed: session.lateSubmissionAllowed !== false
        }
        : item
      ));
    } catch (err: any) {
      alert(err?.message || "Không thể gia hạn nộp bài. Vui lòng thử lại.");
    }
  };

  const handleOpenEdit = (session: HomeworkSessionItem) => {
    setEditingSession(session);
    setEditTopic(session.topic || "");
    setEditAssignmentTitle(session.assignmentTitle || "");
    setEditAssignmentDescription(session.assignmentDescription || "");
    setEditAssignmentFileUrl(session.assignmentExternalUrl || session.assignmentFileUrl || "");
    setEditAssignmentDueAt(session.assignmentDueAt ? session.assignmentDueAt.slice(0, 16) : "");
    setEditSubmissionRequired(session.submissionRequired === true);
    setEditLateSubmissionAllowed(session.lateSubmissionAllowed !== false);
    setEditMaterialUrl(session.materialExternalUrl || session.materialUrl || "");
    setEditMaterialDescription(session.materialDescription || "");
    setSelectedAssignmentFiles([]);
    setSelectedMaterialFiles([]);
  };

  const handleUploadAssignmentFiles = async () => {
    if (!editingSession || selectedAssignmentFiles.length === 0) return;
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedAssignmentFiles.forEach((file) => formData.append("files", file));
      const uploaded = await classApi.uploadSessionAssignmentFiles(editingSession.sessionId, formData);
      setEditingSession((prev) => prev ? {
        ...prev,
        assignmentFiles: [...(prev.assignmentFiles || []), ...uploaded]
      } : null);
      setSessions((prev) => prev.map((s) => s.sessionId === editingSession.sessionId ? {
        ...s,
        assignmentFiles: [...(s.assignmentFiles || []), ...uploaded]
      } : s));
      setSelectedAssignmentFiles([]);
    } catch (err: any) {
      alert(err?.message || "Không thể tải lên file bài tập.");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleUploadMaterialFiles = async () => {
    if (!editingSession || selectedMaterialFiles.length === 0) return;
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedMaterialFiles.forEach((file) => formData.append("files", file));
      const uploaded = await classApi.uploadSessionMaterialFiles(editingSession.sessionId, formData);
      setEditingSession((prev) => prev ? {
        ...prev,
        materialFiles: [...(prev.materialFiles || []), ...uploaded]
      } : null);
      setSessions((prev) => prev.map((s) => s.sessionId === editingSession.sessionId ? {
        ...s,
        materialFiles: [...(s.materialFiles || []), ...uploaded]
      } : s));
      setSelectedMaterialFiles([]);
    } catch (err: any) {
      alert(err?.message || "Không thể tải lên file slide / tài liệu.");
    } finally {
      setUploadingFiles(false);
    }
  };

  const uploadSelectedSessionFilesOnSave = async (sessionId: number) => {
    let uploadedAssignmentFiles: SessionFileItem[] = [];
    let uploadedMaterialFiles: SessionFileItem[] = [];

    if (selectedAssignmentFiles.length > 0) {
      const formData = new FormData();
      selectedAssignmentFiles.forEach((file) => formData.append("files", file));
      uploadedAssignmentFiles = await classApi.uploadSessionAssignmentFiles(sessionId, formData);
    }

    if (selectedMaterialFiles.length > 0) {
      const formData = new FormData();
      selectedMaterialFiles.forEach((file) => formData.append("files", file));
      uploadedMaterialFiles = await classApi.uploadSessionMaterialFiles(sessionId, formData);
    }

    return { uploadedAssignmentFiles, uploadedMaterialFiles };
  };

  const handleDeleteSessionFile = async (fileId: number, category: "ASSIGNMENT" | "MATERIAL") => {
    if (!editingSession) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa file này khỏi buổi học?")) return;
    try {
      await classApi.deleteSessionFile(editingSession.sessionId, fileId);
      if (category === "ASSIGNMENT") {
        setEditingSession((prev) => prev ? {
          ...prev,
          assignmentFiles: (prev.assignmentFiles || []).filter((f) => f.id !== fileId)
        } : null);
        setSessions((prev) => prev.map((s) => s.sessionId === editingSession.sessionId ? {
          ...s,
          assignmentFiles: (s.assignmentFiles || []).filter((f) => f.id !== fileId)
        } : s));
      } else {
        setEditingSession((prev) => prev ? {
          ...prev,
          materialFiles: (prev.materialFiles || []).filter((f) => f.id !== fileId)
        } : null);
        setSessions((prev) => prev.map((s) => s.sessionId === editingSession.sessionId ? {
          ...s,
          materialFiles: (s.materialFiles || []).filter((f) => f.id !== fileId)
        } : s));
      }
    } catch (err: any) {
      alert(err?.message || "Không thể xóa file.");
    }
  };

  const handleDownloadStudentSubmission = async (attendanceId: number) => {
    if (!gradingSession) return;
    setDownloadingSubmissionId(attendanceId);
    try {
      const res = await classApi.getSubmissionDownloadUrl(gradingSession.sessionId, attendanceId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert(err?.message || "Không thể tải file bài làm của học viên.");
    } finally {
      setDownloadingSubmissionId(null);
    }
  };

  const handleDownloadSessionFile = async (sessionId: number, fileId: number) => {
    setDownloadingSessionFileId(fileId);
    try {
      const res = await classApi.getSessionFileDownloadUrl(sessionId, fileId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert(err?.message || "Không thể tải file buổi học.");
    } finally {
      setDownloadingSessionFileId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    if (editSubmissionRequired && !editAssignmentDueAt) {
      alert("Vui lòng chọn hạn nộp khi yêu cầu học viên nộp bài.");
      return;
    }
    setEditSaving(true);
    setUploadingFiles(true);
    try {
      const payload: any = {
        topic: editTopic,
        assignmentTitle: editAssignmentTitle,
        assignmentDescription: editAssignmentDescription,
        assignmentFileUrl: editAssignmentFileUrl,
        assignmentExternalUrl: editAssignmentFileUrl,
        submissionRequired: editSubmissionRequired,
        lateSubmissionAllowed: editLateSubmissionAllowed,
        materialUrl: editMaterialUrl,
        materialExternalUrl: editMaterialUrl,
        materialDescription: editMaterialDescription
      };
      if (editSubmissionRequired && editAssignmentDueAt) {
        payload.assignmentDueAt = normalizeDateTimeForApi(editAssignmentDueAt);
      }

      await classApi.updateSessionDetails(editingSession.sessionId, payload);
      const { uploadedAssignmentFiles, uploadedMaterialFiles } =
        await uploadSelectedSessionFilesOnSave(editingSession.sessionId);

      // Update locally
      setSessions((prev) =>
        prev.map((s) => {
          if (s.sessionId !== editingSession.sessionId) return s;
          return {
            ...s,
            topic: editTopic,
            assignmentTitle: editAssignmentTitle,
            assignmentDescription: editAssignmentDescription,
            assignmentFileUrl: editAssignmentFileUrl,
            assignmentExternalUrl: editAssignmentFileUrl,
            assignmentDueAt: editSubmissionRequired && editAssignmentDueAt ? normalizeDateTimeForApi(editAssignmentDueAt) : null,
            submissionRequired: editSubmissionRequired,
            lateSubmissionAllowed: editLateSubmissionAllowed,
            materialUrl: editMaterialUrl,
            materialExternalUrl: editMaterialUrl,
            materialDescription: editMaterialDescription,
            assignmentFiles: [...(s.assignmentFiles || []), ...uploadedAssignmentFiles],
            materialFiles: [...(s.materialFiles || []), ...uploadedMaterialFiles]
          };
        })
      );

      setSelectedAssignmentFiles([]);
      setSelectedMaterialFiles([]);
      setEditingSession(null);
    } catch (err: any) {
      console.error("Failed to update session details:", err);
      alert(err.message || "Không thể cập nhật buổi học.");
    } finally {
      setEditSaving(false);
      setUploadingFiles(false);
    }
  };

  const activeStudent = gradingSession?.submissions.find((s) => s.id === activeAttendanceId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              Theo Dõi & Chấm Điểm
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Quản Lý Bài Tập & Tài Liệu Buổi Học
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Quản lý bài tập về nhà theo từng buổi của các lớp, kiểm tra bài làm đã nộp của học viên, chấm điểm và nhận xét chi tiết.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadOverview}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 border border-white/10"
            >
              <Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới dữ liệu
            </button>
          </div>
        </div>
      </div>

      {/* 2. Statistical Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.totalHomeworks}</div>
            <div className="text-xs font-semibold text-slate-500">Buổi đã giao bài tập</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.totalSubmissions}</div>
            <div className="text-xs font-semibold text-slate-500">Tổng bài học viên đã nộp</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">{stats.pendingGrading}</div>
            <div className="text-xs font-semibold text-slate-500">Bài đang chờ chấm điểm</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{stats.totalGraded}</div>
            <div className="text-xs font-semibold text-slate-500">Bài đã chấm điểm xong</div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Class selector */}
          <div className="min-w-[200px]">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả lớp học ({classOptions.length})</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả bài tập đã giao ({homeworkSessions.length})</option>
              <option value="PENDING_GRADE">Chờ chấm điểm ({stats.pendingGrading})</option>
              <option value="COMPLETED">Đã chấm xong ({stats.totalGraded})</option>
              {stats.lateSubmissions > 0 && (
                <option value="LATE_SUBMISSION">Có bài nộp muộn ({stats.lateSubmissions})</option>
              )}
              <option value="SHOW_ALL_SESSIONS">Xem tất cả buổi học (kể cả chưa giao bài)</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo lớp, buổi hoặc tên bài..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* 4. Homework Sessions List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
          <p className="text-sm font-bold">Đang tải dữ liệu bài tập và tài liệu...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 font-bold text-sm">
          {error}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-slate-800">Không tìm thấy bài tập nào</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md mx-auto">
            Chưa có bài tập nào phù hợp với bộ lọc hiện tại. Bạn có thể mở chi tiết buổi học để soạn bài tập mới.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const hasAssignment = Boolean(session.assignmentTitle && session.assignmentTitle.trim().length > 0);
            const hasDue = Boolean(session.assignmentDueAt);
            const isDuePassed = hasDue ? new Date() > new Date(session.assignmentDueAt!) : false;
            const pendingGradeCount = Math.max(0, session.submittedCount - session.gradedCount);

            return (
              <div
                key={session.sessionId}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Class and Session info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-black">
                      {session.classTitle}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                      Buổi #{session.sequenceNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {session.sessionDate} ({session.startTime} - {session.endTime})
                    </span>
                  </div>

                  <div>
                    <h3
                      onClick={() => setViewingAssignmentSession(session)}
                      className="text-base font-black text-slate-900 flex items-center gap-2 cursor-pointer hover:text-emerald-600 transition group"
                      title="Nhấn để xem toàn bộ chi tiết đề bài, yêu cầu và ghi chú"
                    >
                      <span>
                        {session.assignmentTitle || (
                          <span className="text-slate-600 font-semibold">
                            Bài tập buổi học (Chủ đề: {session.topic || `Buổi #${session.sequenceNumber}`})
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-emerald-600 opacity-80 group-hover:opacity-100 flex items-center gap-1 font-bold">
                        <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                      </span>
                    </h3>

                    {session.assignmentDescription && (
                      <div className="mt-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                        <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-500">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            Yêu cầu & Ghi chú bài tập:
                          </span>
                          {session.assignmentDescription.length > 100 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDescSessionIds((prev) => ({
                                  ...prev,
                                  [session.sessionId]: !prev[session.sessionId]
                                }));
                              }}
                              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                            >
                              {expandedDescSessionIds[session.sessionId] ? "Thu gọn" : "Xem toàn bộ"}
                            </button>
                          )}
                        </div>
                        <p
                          className={`leading-relaxed whitespace-pre-wrap ${
                            expandedDescSessionIds[session.sessionId] ? "" : "line-clamp-2"
                          }`}
                        >
                          {session.assignmentDescription}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Materials & Assignment attachment badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {/* Assignment files */}
                    {session.assignmentFiles && session.assignmentFiles.length > 0 && session.assignmentFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handleDownloadSessionFile(session.sessionId, file.id)}
                        disabled={downloadingSessionFileId === file.id}
                        title="Nhấn để tải về hoặc xem file đề bài này"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition border border-blue-200 group"
                      >
                        {downloadingSessionFileId === file.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3 text-blue-600 group-hover:scale-110 transition-transform" />
                        )}
                        <span>{file.fileName}</span>
                        <span className="text-[10px] text-blue-500 font-normal">({formatFileSize(file.fileSize)})</span>
                      </button>
                    ))}

                    {/* Material files (Slides) */}
                    {session.materialFiles && session.materialFiles.length > 0 && session.materialFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handleDownloadSessionFile(session.sessionId, file.id)}
                        disabled={downloadingSessionFileId === file.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition border border-emerald-200"
                      >
                        {downloadingSessionFileId === file.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <BookOpen className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{file.fileName}</span>
                        <span className="text-[10px] text-emerald-500 font-normal">({formatFileSize(file.fileSize)})</span>
                      </button>
                    ))}

                    {/* Auxiliary external links */}
                    {(session.assignmentExternalUrl || (!session.assignmentFiles?.length && session.assignmentFileUrl)) && (
                      <a
                        href={session.assignmentExternalUrl || session.assignmentFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 transition border border-slate-200"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-500" /> Link bài tập ngoài
                      </a>
                    )}
                    {(session.materialExternalUrl || (!session.materialFiles?.length && session.materialUrl)) && (
                      <a
                        href={session.materialExternalUrl || session.materialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 transition border border-slate-200"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-500" /> Link slide ngoài
                      </a>
                    )}

                    {hasDue && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 font-bold ${isDuePassed ? "text-red-600" : "text-slate-500"}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Hạn nộp: {new Date(session.assignmentDueAt!).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          {isDuePassed && " (Đã hết hạn)"}
                        </span>
                        {session.submissionRequired !== false && (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
                            {[1, 3, 7].map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => handleQuickExtendDeadline(session, days)}
                                className="rounded-md px-2 py-0.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-50"
                                title={`Gia hạn thêm ${days} ngày`}
                              >
                                +{days} ngày
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!hasDue && session.submissionRequired !== false && (
                      <button
                        type="button"
                        onClick={() => handleQuickExtendDeadline(session, 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800 hover:bg-emerald-100"
                        title="Đặt hạn nộp mặc định vào tối mai"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Đặt hạn nộp
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: Submission progress & Actions */}
                {(() => {
                  const hasHW = hasHomeworkContent(session);
                  const unsubmittedStudents = (session.submissions || []).filter((s) => !s.submittedAt && !s.submissionText && !s.submissionFileUrl);
                  const unsubmittedCount = unsubmittedStudents.length;

                  if (!hasHW) {
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:border-l lg:pl-6 border-slate-100 min-w-[260px] justify-end">
                        <div className="text-xs text-slate-400 font-medium italic">
                          Chưa giao bài tập buổi này
                        </div>
                        <button
                          onClick={() => handleOpenEdit(session)}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Giao bài tập</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:border-l lg:pl-6 border-slate-100 min-w-[300px]">
                      <div className="space-y-1.5 flex-1 min-w-[160px]">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-600">Đã nộp bài:</span>
                          <span className="text-slate-900 font-black">
                            {session.submittedCount} / {session.totalStudents} học viên
                          </span>
                        </div>
                        {/* Multi-segment progress bar */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all"
                            style={{
                              width: `${session.totalStudents > 0 ? (session.gradedCount / session.totalStudents) * 100 : 0}%`
                            }}
                            title={`Đã chấm: ${session.gradedCount}`}
                          />
                          <div
                            className="bg-amber-400 h-full transition-all"
                            style={{
                              width: `${session.totalStudents > 0 ? (pendingGradeCount / session.totalStudents) * 100 : 0}%`
                            }}
                            title={`Chờ chấm: ${pendingGradeCount}`}
                          />
                          <div
                            className="bg-rose-300 h-full transition-all"
                            style={{
                              width: `${session.totalStudents > 0 ? (unsubmittedCount / session.totalStudents) * 100 : 0}%`
                            }}
                            title={`Chưa nộp: ${unsubmittedCount}`}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold gap-1 pt-0.5">
                          <span className="text-emerald-700 font-bold">Đã chấm: {session.gradedCount}</span>
                          {pendingGradeCount > 0 ? (
                            <span className="text-amber-600 font-bold">Cần chấm: {pendingGradeCount}</span>
                          ) : session.submittedCount > 0 ? (
                            <span className="text-emerald-600 font-bold">Đã chấm xong</span>
                          ) : null}
                          {unsubmittedCount > 0 && session.submittedCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenGrading(session, "UNSUBMITTED", "SPLIT")}
                              className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer inline-flex items-center gap-0.5"
                              title="Bấm để xem danh sách học viên chưa nộp bài"
                            >
                              Chưa nộp: {unsubmittedCount}
                            </button>
                          ) : session.submittedCount > 0 ? (
                            <span className="text-emerald-600 font-bold">100% đã nộp</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenGrading(session, pendingGradeCount > 0 ? "PENDING" : "ALL", "SPLIT")}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                            pendingGradeCount > 0
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Chấm bài ({session.submittedCount})</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenGrading(session, "ALL", "TABLE")}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Xem bảng điểm danh sách tất cả học viên của buổi học"
                          >
                            <Table className="w-3.5 h-3.5 text-indigo-600" />
                            <span>DS cả lớp</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(session)}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Chỉnh sửa nội dung đề bài, slide hoặc đổi hạn nộp"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sửa bài</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: Chấm bài & Theo dõi danh sách học viên buổi học */}
      {gradingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Chấm bài & Theo dõi lớp học
                  </span>
                  <span className="text-xs text-slate-400">
                    {gradingSession.classTitle}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black mt-1 truncate text-white">
                  Buổi #{gradingSession.sequenceNumber}: {gradingSession.assignmentTitle || gradingSession.topic || "Bài tập buổi học"}
                </h2>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ngày học: {gradingSession.sessionDate}</span>
                  {gradingSession.assignmentDueAt && (
                    <span className="text-amber-300 font-semibold">
                      • Hạn nộp: {new Date(gradingSession.assignmentDueAt).toLocaleString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>

              {/* View Switcher & Close */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setModalViewMode("SPLIT")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      modalViewMode === "SPLIT"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Giao diện danh sách bên trái và form chấm chi tiết bên phải"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Chấm chi tiết</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalViewMode("TABLE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      modalViewMode === "TABLE"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Bảng tổng hợp danh sách toàn bộ học viên trong lớp"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Bảng điểm cả lớp ({studentCounts.total})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setGradingSession(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                  title="Đóng modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar across entire classroom */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider mr-1">
                  Thống kê buổi học:
                </span>

                <button
                  type="button"
                  onClick={() => setStudentFilterTab("ALL")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    studentFilterTab === "ALL"
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Sĩ số: {studentCounts.total}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentFilterTab("PENDING")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    studentFilterTab === "PENDING"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Cần chấm: {studentCounts.pending}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentFilterTab("GRADED")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    studentFilterTab === "GRADED"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Đã chấm: {studentCounts.graded}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentFilterTab("UNSUBMITTED")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    studentFilterTab === "UNSUBMITTED"
                      ? "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200"
                      : studentCounts.unsubmitted > 0
                      ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 animate-pulse"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                  title="Danh sách học viên chưa làm hoặc chưa nộp bài"
                >
                  <UserX className="w-3 h-3 text-rose-600" />
                  <span className="font-black">Chưa làm bài: {studentCounts.unsubmitted}</span>
                </button>

                {studentCounts.late > 0 && (
                  <button
                    type="button"
                    onClick={() => setStudentFilterTab("LATE")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                      studentFilterTab === "LATE"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span>Nộp muộn: {studentCounts.late}</span>
                  </button>
                )}
              </div>

              {/* Progress percentage */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Tiến độ chấm:</span>
                <span className="font-black text-slate-900">
                  {studentCounts.total > 0
                    ? Math.round((studentCounts.graded / studentCounts.total) * 100)
                    : 0}%
                </span>
                <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${studentCounts.total > 0 ? (studentCounts.graded / studentCounts.total) * 100 : 0}%`
                    }}
                  />
                  <div
                    className="bg-amber-400 h-full"
                    style={{
                      width: `${studentCounts.total > 0 ? (studentCounts.pending / studentCounts.total) * 100 : 0}%`
                    }}
                  />
                  <div
                    className="bg-rose-300 h-full"
                    style={{
                      width: `${studentCounts.total > 0 ? (studentCounts.unsubmitted / studentCounts.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Body: Switch between SPLIT view and TABLE view */}
            {modalViewMode === "TABLE" ? (
              /* Full Classroom Table View */
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-slate-800">
                      Bảng tổng hợp học viên buổi học #{gradingSession.sequenceNumber}
                    </span>
                    <span className="text-xs text-slate-500">
                      (Hiển thị {modalFilteredStudents.length} / {gradingSession.submissions.length} học viên)
                    </span>
                  </div>

                  <div className="relative max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="Tìm tên, email học viên..."
                      className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3 text-center w-12">STT</th>
                        <th className="py-3 px-4">Học viên</th>
                        <th className="py-3 px-3 text-center">Điểm danh</th>
                        <th className="py-3 px-4">Tình trạng nộp bài</th>
                        <th className="py-3 px-4">File / Bài làm</th>
                        <th className="py-3 px-3 text-center">Điểm số</th>
                        <th className="py-3 px-4">Nhận xét của gia sư</th>
                        <th className="py-3 px-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalFilteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                            {studentSearchQuery
                              ? "Không tìm thấy học viên nào phù hợp với từ khóa."
                              : "Không có học viên nào trong danh mục này."}
                          </td>
                        </tr>
                      ) : (
                        modalFilteredStudents.map((att, idx) => {
                          const hasSubmitted = Boolean(att.submittedAt || att.submissionText || att.submissionFileUrl);
                          const hasGraded = Boolean(att.gradeScore && att.gradeScore.trim().length > 0);

                          return (
                            <tr
                              key={att.id}
                              className={`hover:bg-slate-50/80 transition ${
                                !hasSubmitted ? "bg-rose-50/20" : ""
                              }`}
                            >
                              <td className="py-3.5 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                <div className="text-slate-900 font-black">
                                  {att.studentName || att.studentEmail || `Học viên #${att.studentId}`}
                                </div>
                                <div className="text-[11px] text-slate-400 font-normal">
                                  {att.studentEmail}
                                </div>
                              </td>

                              <td className="py-3.5 px-3 text-center">
                                {att.studentChecked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Có mặt</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                    <UserX className="w-3 h-3 text-slate-400" />
                                    <span>Vắng / Chưa điểm danh</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {hasSubmitted ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Đã nộp bài
                                    </span>
                                    {att.submittedAt && (
                                      <div className="text-[10px] text-slate-500">
                                        {new Date(att.submittedAt).toLocaleString("vi-VN")}
                                      </div>
                                    )}
                                    {att.isLateSubmission && (
                                      <span className="inline-block px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[9px] font-black">
                                        Nộp muộn
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black border border-rose-200">
                                      <UserX className="w-3 h-3 text-rose-600" />
                                      Chưa làm / Chưa nộp bài
                                    </span>
                                    <div className="text-[10px] text-rose-500 font-medium">
                                      Chưa có dữ liệu bài nộp
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {att.submissionFileName ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadStudentSubmission(att.id)}
                                    disabled={downloadingSubmissionId === att.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition border border-blue-200 cursor-pointer"
                                  >
                                    <Download className="w-3 h-3 text-blue-600" />
                                    <span className="truncate max-w-[140px]">{att.submissionFileName}</span>
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      ({formatFileSize(att.submissionFileSize)})
                                    </span>
                                  </button>
                                ) : att.submissionText ? (
                                  <span className="text-slate-600 truncate block max-w-[160px] italic">
                                    "{att.submissionText}"
                                  </span>
                                ) : (
                                  <span className="text-slate-300 italic">— Không có —</span>
                                )}
                              </td>

                              <td className="py-3.5 px-3 text-center">
                                {hasGraded ? (
                                  <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-300">
                                    {att.gradeScore}
                                  </span>
                                ) : hasSubmitted ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                                    Chờ chấm
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px]">
                                    Chưa chấm
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                {att.tutorFeedback ? (
                                  <p className="text-slate-700 line-clamp-2 leading-relaxed">
                                    {att.tutorFeedback}
                                  </p>
                                ) : (
                                  <span className="text-slate-300 italic">— Chưa có nhận xét —</span>
                                )}
                              </td>

                              <td className="py-3.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectStudentForGrading(att);
                                    setModalViewMode("SPLIT");
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{hasGraded ? "Sửa điểm" : "Chấm bài"}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* SPLIT View: Student roster list on left, Active student submission details & grading on right */
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left column: Student list with Filter & Search */}
                <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                  {/* Search box & Tab controls */}
                  <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="Tìm tên hoặc email học viên..."
                        className="w-full text-xs font-medium pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {studentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab("ALL")}
                        className={`px-2 py-1 rounded-lg font-bold shrink-0 transition ${
                          studentFilterTab === "ALL"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Tất cả ({studentCounts.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab("PENDING")}
                        className={`px-2 py-1 rounded-lg font-bold shrink-0 transition ${
                          studentFilterTab === "PENDING"
                            ? "bg-amber-600 text-white"
                            : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        Cần chấm ({studentCounts.pending})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab("UNSUBMITTED")}
                        className={`px-2 py-1 rounded-lg font-bold shrink-0 transition ${
                          studentFilterTab === "UNSUBMITTED"
                            ? "bg-rose-600 text-white"
                            : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                        }`}
                      >
                        Chưa nộp ({studentCounts.unsubmitted})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab("GRADED")}
                        className={`px-2 py-1 rounded-lg font-bold shrink-0 transition ${
                          studentFilterTab === "GRADED"
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        Đã chấm ({studentCounts.graded})
                      </button>
                    </div>
                  </div>

                  {/* Student list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {modalFilteredStudents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        {studentSearchQuery
                          ? "Không có học viên nào khớp với tìm kiếm."
                          : "Không có học viên nào trong mục này."}
                      </div>
                    ) : (
                      modalFilteredStudents.map((att) => {
                        const isSelected = att.id === activeAttendanceId;
                        const hasSubmitted = Boolean(att.submittedAt || att.submissionText || att.submissionFileUrl);
                        const hasGraded = Boolean(att.gradeScore && att.gradeScore.trim().length > 0);

                        return (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => selectStudentForGrading(att)}
                            className={`w-full text-left p-3 rounded-2xl transition text-xs flex flex-col gap-1.5 border cursor-pointer ${
                              isSelected
                                ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                                : !hasSubmitted
                                ? "bg-rose-50/40 border-rose-200/80 hover:bg-white"
                                : "bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-slate-900 truncate">
                                {att.studentName || att.studentEmail || `Học viên #${att.studentId}`}
                              </span>
                              {att.studentChecked ? (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Có mặt
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  Vắng
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 truncate">
                              {att.studentEmail}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                              {hasSubmitted ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Đã nộp bài
                                  {att.isLateSubmission && (
                                    <span className="text-[9px] px-1 rounded bg-red-100 text-red-700 font-black">
                                      Muộn
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-rose-600 font-black flex items-center gap-1">
                                  <UserX className="w-3 h-3 text-rose-500" />
                                  Chưa nộp bài
                                </span>
                              )}

                              {hasGraded ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black border border-emerald-200">
                                  {att.gradeScore}
                                </span>
                              ) : hasSubmitted ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                                  Chờ chấm
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Chưa chấm</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right column: Student submission details and Grade form */}
                <div className="flex-1 p-6 overflow-y-auto space-y-5">
                  {/* Collapsible Assignment prompt review for tutor reference */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        Đề bài & Yêu cầu gia sư đã giao:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAssignmentReviewInGrading(!showAssignmentReviewInGrading)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                      >
                        {showAssignmentReviewInGrading ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Thu gọn
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Xem lại đề bài & file
                          </>
                        )}
                      </button>
                    </div>

                    {showAssignmentReviewInGrading && (
                      <div className="pt-2 border-t border-emerald-200/60 space-y-2 text-xs">
                        <div className="font-bold text-slate-900">
                          {gradingSession.assignmentTitle || "Bài tập buổi học"}
                        </div>
                        {gradingSession.assignmentDescription && (
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-white/80 p-3 rounded-xl border border-emerald-100">
                            {gradingSession.assignmentDescription}
                          </p>
                        )}
                        {gradingSession.assignmentFiles && gradingSession.assignmentFiles.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[11px] font-bold text-slate-600">File đề bài đã gửi:</span>
                            {gradingSession.assignmentFiles.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => handleDownloadSessionFile(gradingSession.sessionId, file.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-emerald-800 font-bold hover:bg-emerald-100 transition border border-emerald-300 text-xs shadow-xs cursor-pointer"
                              >
                                <Download className="w-3 h-3 text-emerald-600" />
                                <span>{file.fileName}</span>
                                <span className="text-[10px] text-emerald-600 font-normal">({formatFileSize(file.fileSize)})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!activeStudent ? (
                    <div className="py-20 text-center text-slate-400 text-sm">
                      Chọn học viên ở cột bên trái để xem bài làm và chấm điểm
                    </div>
                  ) : (
                    <>
                      {/* Active Student Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-slate-900">
                              {activeStudent.studentName || activeStudent.studentEmail || `Học viên #${activeStudent.studentId}`}
                            </h4>
                            {activeStudent.studentChecked ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                Đã điểm danh
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                Chưa điểm danh
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{activeStudent.studentEmail}</p>
                        </div>

                        {/* Submission status tag */}
                        <div>
                          {activeStudent.submittedAt ? (
                            <div className="text-right">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Đã nộp bài
                              </span>
                              {activeStudent.isLateSubmission && (
                                <span className="ml-1.5 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-black">
                                  NỘP MUỘN
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black inline-flex items-center gap-1 border border-rose-200">
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                              Chưa làm / Chưa nộp bài
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unsubmitted Warning Alert if not submitted */}
                      {!activeStudent.submittedAt && !activeStudent.submissionText && !activeStudent.submissionFileUrl && (
                        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-1 text-xs text-rose-900">
                            <div className="font-black text-rose-800">
                              Học viên này chưa nộp bài tập buổi này
                            </div>
                            <p className="text-rose-700 leading-relaxed">
                              Học viên chưa tải file bài làm hoặc gửi câu trả lời. Gia sư có thể chấm điểm trực tiếp (nếu học viên trả lời bài tại lớp / vấn đáp) hoặc để lại lời nhắc nhở học viên hoàn thành trước buổi kế tiếp.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Submission text & file */}
                      {(activeStudent.submittedAt || activeStudent.submissionText || activeStudent.submissionFileUrl) && (
                        <div className="space-y-3">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Nội dung bài làm của học viên:
                          </div>

                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                Nộp lúc: {new Date(activeStudent.submittedAt).toLocaleString("vi-VN")}
                              </span>
                              {activeStudent.isLateSubmission && (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-black text-[10px]">
                                  NỘP MUỘN
                                </span>
                              )}
                            </div>

                            {activeStudent.submissionText ? (
                              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                                {activeStudent.submissionText}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Không có nội dung văn bản kèm theo.</p>
                            )}

                            {/* File submission */}
                            {activeStudent.submissionFileName && (
                              <div className="pt-2 border-t border-slate-200/60">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-slate-800 truncate">
                                        {activeStudent.submissionFileName}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {formatFileSize(activeStudent.submissionFileSize)} • File bài làm học viên đã nộp
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadStudentSubmission(activeStudent.id)}
                                    disabled={downloadingSubmissionId === activeStudent.id}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                                  >
                                    {downloadingSubmissionId === activeStudent.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                    Tải bài nộp
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeStudent.submissionFileUrl && (
                              <div className="pt-2 border-t border-slate-200/60">
                                <a
                                  href={activeStudent.submissionFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Mở link bài làm trực tuyến
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Grading Form */}
                      <div className="space-y-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                            Chấm điểm & Nhận xét của gia sư:
                          </span>
                          {activeStudent.gradeScore && (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Điểm hiện tại: <span className="font-black text-sm">{activeStudent.gradeScore}</span>
                            </span>
                          )}
                        </div>

                        {/* Quick score chips */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Điểm số nhanh:</label>
                          <div className="flex flex-wrap gap-1.5">
                            {["10", "9.5", "9", "8.5", "8", "7.5", "7", "6.5", "6", "5", "Đạt", "Chưa đạt"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setGradeScoreInput(chip)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  gradeScoreInput === chip
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Score input */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Điểm số / Đánh giá:
                          </label>
                          <input
                            type="text"
                            value={gradeScoreInput}
                            onChange={(e) => setGradeScoreInput(e.target.value)}
                            placeholder="Ví dụ: 9.5 hoặc Đạt..."
                            className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Quick feedback templates */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            Gợi ý nhận xét nhanh:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_FEEDBACK_TEMPLATES.map((tmpl, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (!tutorFeedbackInput.trim()) {
                                    setTutorFeedbackInput(tmpl);
                                  } else {
                                    setTutorFeedbackInput((prev) => `${prev}. ${tmpl}`);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 text-[11px] font-medium transition border border-slate-200 cursor-pointer"
                                title="Bấm để đưa mẫu nhận xét vào ô bên dưới"
                              >
                                + {tmpl}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Feedback textarea */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Nhận xét, đánh giá chi tiết cho học viên:
                          </label>
                          <textarea
                            rows={3}
                            value={tutorFeedbackInput}
                            onChange={(e) => setTutorFeedbackInput(e.target.value)}
                            placeholder="Nhận xét ưu điểm, phần cần cải thiện, hoặc lời nhắc nhở học viên hoàn thành bài..."
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                          />
                        </div>

                        {gradingSuccessMsg && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {gradingSuccessMsg}
                          </div>
                        )}

                        {/* Action buttons: Save & Save and Go to next */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveGrade(false)}
                            disabled={gradingSubmitting}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {gradingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Lưu điểm
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveGrade(true)}
                            disabled={gradingSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                            title="Lưu điểm học viên hiện tại và tự động chuyển sang học viên tiếp theo cần chấm"
                          >
                            {gradingSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <span>Lưu & Sang học viên tiếp theo</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: Sửa bài tập, hạn nộp & slide buổi học */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Cập nhật bài tập & Tài liệu buổi học
                </div>
                <h2 className="text-lg font-black mt-1">
                  Buổi #{editingSession.sequenceNumber} - {editingSession.classTitle}
                </h2>
              </div>
              <button
                onClick={() => setEditingSession(null)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chủ đề buổi học</label>
                <input
                  type="text"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Nhập chủ đề buổi học..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề bài tập về nhà</label>
                <input
                  type="text"
                  value={editAssignmentTitle}
                  onChange={(e) => setEditAssignmentTitle(e.target.value)}
                  placeholder="Ví dụ: Bài tập ôn tập chương 1..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editSubmissionRequired}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditSubmissionRequired(checked);
                      if (checked && !editAssignmentDueAt) {
                        setEditAssignmentDueAt(toDateTimeLocalValue(getDeadlineBaseDate(null)));
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Yêu cầu học viên nộp bài
                </label>
                <p className="text-[11px] text-slate-500">
                  Tắt lựa chọn này nếu bài tập chỉ để luyện tập, không cần học viên gửi bài lên hệ thống.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hạn nộp bài tập</label>
                <input
                  type="datetime-local"
                  value={editAssignmentDueAt}
                  disabled={!editSubmissionRequired}
                  onChange={(e) => setEditAssignmentDueAt(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!editSubmissionRequired}
                    onClick={() => setEditAssignmentDueAt(toDateTimeLocalValue(getDeadlineBaseDate(null)))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tối mai 23:59
                  </button>
                  {[1, 3, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={!editSubmissionRequired}
                      onClick={() => setEditDeadlinePlusDays(days)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Dời thêm {days} ngày
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editLateSubmissionAllowed}
                    disabled={!editSubmissionRequired}
                    onChange={(e) => setEditLateSubmissionAllowed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  Cho phép nộp trễ sau hạn
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  Có thể chỉnh lại hạn nhiều lần. Nếu tắt nộp trễ, học viên sẽ không thể gửi/cập nhật bài sau hạn; khi dời hạn rộng ra, bài chưa chấm sẽ tự mở lại theo hạn mới.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Yêu cầu / Hướng dẫn làm bài</label>
                <textarea
                  rows={3}
                  value={editAssignmentDescription}
                  onChange={(e) => setEditAssignmentDescription(e.target.value)}
                  placeholder="Mô tả các bài toán, link đề hoặc lưu ý khi nộp bài..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-amber-600 font-semibold mt-1">
                  * Bảo mật: Học viên chỉ có thể mở khóa xem nội dung này sau khi đã điểm danh vào buổi học.
                </p>
              </div>

              {/* Assignment files (up to 5 files) */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    File đề bài / Bài tập về nhà (Tối đa 5 file):
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    {(editingSession.assignmentFiles?.length || 0)}/5 file
                  </span>
                </div>

                {/* Existing files list */}
                {editingSession.assignmentFiles && editingSession.assignmentFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editingSession.assignmentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{file.fileName}</span>
                          <span className="text-[10px] text-slate-400">({formatFileSize(file.fileSize)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSessionFile(file.id, "ASSIGNMENT")}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded text-xs font-bold transition shrink-0"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload new assignment files */}
                {(editingSession.assignmentFiles?.length || 0) < 5 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const remaining = 5 - (editingSession.assignmentFiles?.length || 0);
                          if (files.length > remaining) {
                            alert(`Bạn chỉ có thể thêm tối đa ${remaining} file nữa (tối đa 5 file/buổi).`);
                            setSelectedAssignmentFiles(files.slice(0, remaining));
                          } else {
                            setSelectedAssignmentFiles(files);
                          }
                        }
                      }}
                      className="flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                  </div>
                )}
                {selectedAssignmentFiles.length > 0 && (
                  <p className="text-[11px] font-bold text-blue-700">
                    {selectedAssignmentFiles.length} file sẽ tự tải lên khi bấm Lưu thay đổi.
                  </p>
                )}

                {/* Auxiliary External Link */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Link ngoài bổ sung (Google Drive / GitHub nếu cần):
                  </label>
                  <input
                    type="text"
                    value={editAssignmentFileUrl}
                    onChange={(e) => setEditAssignmentFileUrl(e.target.value)}
                    placeholder="https://drive.google.com/... hoặc link đề bài ngoài"
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Lecture slides & materials */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Slide / Bài giảng buổi học:
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    {editingSession.materialFiles?.length || 0} file
                  </span>
                </div>

                {/* Existing slides list */}
                {editingSession.materialFiles && editingSession.materialFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editingSession.materialFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{file.fileName}</span>
                          <span className="text-[10px] text-slate-400">({formatFileSize(file.fileSize)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSessionFile(file.id, "MATERIAL")}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded text-xs font-bold transition shrink-0"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload new slide files */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedMaterialFiles(Array.from(e.target.files));
                      }
                    }}
                    className="flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
                {selectedMaterialFiles.length > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700">
                    {selectedMaterialFiles.length} file sẽ tự tải lên khi bấm Lưu thay đổi.
                  </p>
                )}

                {/* Auxiliary External Link */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Link slide ngoài bổ sung (Google Slides / Canva nếu có):
                  </label>
                  <input
                    type="text"
                    value={editMaterialUrl}
                    onChange={(e) => setEditMaterialUrl(e.target.value)}
                    placeholder="https://drive.google.com/... hoặc link slide bài giảng"
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Ghi chú tài liệu buổi học</label>
                  <input
                    type="text"
                    value={editMaterialDescription}
                    onChange={(e) => setEditMaterialDescription(e.target.value)}
                    placeholder="Ví dụ: Đọc từ trang 12 đến 25 trước khi làm bài tập..."
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Xem chi tiết toàn bộ Đề bài & Yêu cầu gia sư đã giao */}
      {viewingAssignmentSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Chi Tiết Đề Bài & Yêu Cầu Đã Giao
                </div>
                <h2 className="text-xl font-black mt-1">
                  Buổi #{viewingAssignmentSession.sequenceNumber}: {viewingAssignmentSession.assignmentTitle || viewingAssignmentSession.topic || "Bài tập buổi học"}
                </h2>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{viewingAssignmentSession.classTitle}</span>
                  <span>•</span>
                  <span>Ngày {viewingAssignmentSession.sessionDate} ({viewingAssignmentSession.startTime} - {viewingAssignmentSession.endTime})</span>
                </div>
              </div>
              <button
                onClick={() => setViewingAssignmentSession(null)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              {/* Meta stats banner */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hạn nộp bài</div>
                  <div className="text-xs font-black text-slate-900 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {viewingAssignmentSession.assignmentDueAt
                      ? new Date(viewingAssignmentSession.assignmentDueAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
                      : "Không giới hạn"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tiến độ nộp</div>
                  <div className="text-xs font-black text-slate-900 mt-1">
                    {viewingAssignmentSession.submittedCount} / {viewingAssignmentSession.totalStudents} học viên
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái chấm</div>
                  <div className="text-xs font-black text-emerald-600 mt-1">
                    Đã chấm {viewingAssignmentSession.gradedCount} bài
                  </div>
                </div>
              </div>

              {/* Requirement & Description */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Nội dung đề bài, Hướng dẫn & Yêu cầu ghi chú:
                </div>
                {viewingAssignmentSession.assignmentDescription ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {viewingAssignmentSession.assignmentDescription}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-400 italic">
                    Chưa nhập nội dung hướng dẫn hoặc ghi chú cho bài tập này.
                  </div>
                )}
              </div>

              {/* Assignment Files */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600" />
                    File đề bài đính kèm:
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {viewingAssignmentSession.assignmentFiles?.length || 0} file
                  </span>
                </div>

                {viewingAssignmentSession.assignmentFiles && viewingAssignmentSession.assignmentFiles.length > 0 ? (
                  <div className="space-y-2">
                    {viewingAssignmentSession.assignmentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{file.fileName}</div>
                            <div className="text-[11px] text-slate-500">{formatFileSize(file.fileSize)}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadSessionFile(viewingAssignmentSession.sessionId, file.id)}
                          disabled={downloadingSessionFileId === file.id}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs shrink-0"
                        >
                          {downloadingSessionFileId === file.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Tải về xem
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                    Không có file đề bài đính kèm.
                  </div>
                )}

                {/* External link if any */}
                {(viewingAssignmentSession.assignmentExternalUrl || (!viewingAssignmentSession.assignmentFiles?.length && viewingAssignmentSession.assignmentFileUrl)) && (
                  <div className="pt-1">
                    <a
                      href={viewingAssignmentSession.assignmentExternalUrl || viewingAssignmentSession.assignmentFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Link đề bài ngoài bổ sung: {viewingAssignmentSession.assignmentExternalUrl || viewingAssignmentSession.assignmentFileUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Lecture Slides / Materials */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    Slide bài giảng & Tài liệu buổi học:
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {viewingAssignmentSession.materialFiles?.length || 0} file
                  </span>
                </div>

                {viewingAssignmentSession.materialFiles && viewingAssignmentSession.materialFiles.length > 0 ? (
                  <div className="space-y-2">
                    {viewingAssignmentSession.materialFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{file.fileName}</div>
                            <div className="text-[11px] text-slate-500">{formatFileSize(file.fileSize)}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadSessionFile(viewingAssignmentSession.sessionId, file.id)}
                          disabled={downloadingSessionFileId === file.id}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs shrink-0"
                        >
                          {downloadingSessionFileId === file.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Tải slide về
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                    Chưa đính kèm file slide / tài liệu buổi học.
                  </div>
                )}

                {viewingAssignmentSession.materialDescription && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    <span className="font-bold text-slate-700">Ghi chú slide: </span>
                    {viewingAssignmentSession.materialDescription}
                  </div>
                )}

                {(viewingAssignmentSession.materialExternalUrl || (!viewingAssignmentSession.materialFiles?.length && viewingAssignmentSession.materialUrl)) && (
                  <div className="pt-1">
                    <a
                      href={viewingAssignmentSession.materialExternalUrl || viewingAssignmentSession.materialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Link slide ngoài: {viewingAssignmentSession.materialExternalUrl || viewingAssignmentSession.materialUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Footer action buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewingAssignmentSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sess = viewingAssignmentSession;
                    setViewingAssignmentSession(null);
                    handleOpenEdit(sess);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  Sửa bài / Đổi hạn nộp
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const sess = viewingAssignmentSession;
                    setViewingAssignmentSession(null);
                    handleOpenGrading(sess);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Award className="w-3.5 h-3.5" />
                  Xem & Chấm bài học viên ({viewingAssignmentSession.submittedCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
