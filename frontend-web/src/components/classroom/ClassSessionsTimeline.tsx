import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Video,
  FileText,
  CheckCircle2,
  AlertCircle,
  Edit3,
  ExternalLink,
  Users,
  ShieldAlert,
  Loader2,
  ChevronRight,
  BookOpen,
  Send,
  PlusCircle,
  Lock,
  Unlock,
  UploadCloud,
  FileCheck,
  Eye,
  MessageSquare,
  History,
  Sparkles,
  BarChart3,
  Award,
  MapPin,
  Download,
  Ban,
  Trash2
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { classApi } from "../../api/classes";
import { contractsApi, type SettlementDto } from "../../api/contractsApi";

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

export interface ClassSessionItem {
  attendanceStopped?: boolean;
  id: number;
  classRoomId: number;
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
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  totalAttendees?: number;
  presentCount?: number;
  myAttendanceId?: number;
  myCheckedIn?: boolean;
  mySubmissionText?: string;
  mySubmissionFileUrl?: string;
  mySubmittedAt?: string;
  myGradeScore?: string;
  myTutorFeedback?: string;
  myGradedAt?: string;
  tutorCheckedIn?: boolean;
  myFinalOutcome?: "BOTH_PRESENT" | "STUDENT_ABSENT_TUTOR_PRESENT" | "TUTOR_ABSENT";
  bothPresentCount?: number;
  studentAbsentCount?: number;
  tutorAbsentCount?: number;
  settlementDispatched?: boolean;
  assignmentFiles?: SessionFileItem[];
  materialFiles?: SessionFileItem[];
  assignmentExternalUrl?: string;
  materialExternalUrl?: string;
  mySubmissionFileName?: string;
  mySubmissionFileSize?: number;
}

export interface AttendanceRecord {
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
  finalOutcome?: "BOTH_PRESENT" | "STUDENT_ABSENT_TUTOR_PRESENT" | "TUTOR_ABSENT";
  enrollmentStatus?: "PENDING" | "ACCEPTED" | "ENROLLED" | "EXPIRED" | "REJECTED" | "CANCELLED";
  attendanceLocked?: boolean;
  submissionFileName?: string;
  submissionFileSize?: number;
}

interface Props {
  classRoomId: number;
  classRoomName?: string;
  meetingLink?: string;
  learningMode?: "ONLINE" | "OFFLINE" | string;
  address?: string;
  currentUserRole?: "TUTOR" | "STUDENT" | "ADMIN" | "STAFF";
  currentUserId?: number;
  currentUserEmail?: string;
  historyMode?: boolean;
  onUpdateMeetingLink?: (newLink: string) => Promise<void>;
  onDisputeClick?: (session: ClassSessionItem) => void;
}

const getDayOfWeekName = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    const map = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return map[day] || '';
  } catch {
    return '';
  }
};

export const ClassSessionsTimeline: React.FC<Props> = ({
  classRoomId,
  classRoomName,
  meetingLink: configuredMeetingLink,
  learningMode,
  address,
  currentUserRole = "STUDENT",
  currentUserId,
  currentUserEmail,
  historyMode = false,
  onUpdateMeetingLink,
  onDisputeClick
}) => {
  const [sessions, setSessions] = useState<ClassSessionItem[]>([]);
  const [unlockedMeetingLink, setUnlockedMeetingLink] = useState<string>('');
  const [currentMeetingLink, setCurrentMeetingLink] = useState(configuredMeetingLink || '');
  const [classDetail, setClassDetail] = useState<{
    learningMode?: string;
    meetingLink?: string;
    address?: string;
  } | null>(null);

  useEffect(() => {
    setCurrentMeetingLink(configuredMeetingLink || '');
  }, [configuredMeetingLink]);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/api/learning/public/classes/${classRoomId}`)
      .then((data) => {
        if (!cancelled && data) {
          setClassDetail({
            learningMode: data.learningMode,
            meetingLink: data.meetingLink,
            address: data.address,
          });
          if (data.meetingLink && !configuredMeetingLink) {
            setCurrentMeetingLink(data.meetingLink);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [classRoomId, configuredMeetingLink]);

  const effectiveLearningMode = (learningMode || classDetail?.learningMode || "ONLINE").toUpperCase();
  const isOffline = effectiveLearningMode === "OFFLINE";
  const effectiveAddress = address || classDetail?.address || "";
  const baseClassMeetingLink = currentMeetingLink || configuredMeetingLink || classDetail?.meetingLink || "";
  const navigate = useNavigate();
  const meetingLink = isOffline ? "" : (unlockedMeetingLink || baseClassMeetingLink);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<"FOCUSED" | "ALL" | "UPCOMING" | "COMPLETED">("FOCUSED");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [activeSession, setActiveSession] = useState<ClassSessionItem | null>(null);

  // Modal states
  const [showEditMeetingModal, setShowEditMeetingModal] = useState<boolean>(false);
  const [newMeetingLink, setNewMeetingLink] = useState<string>(configuredMeetingLink || "");

  // Tutor Assignment Modal
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<ClassSessionItem | null>(null);
  const [assignmentTopic, setAssignmentTopic] = useState<string>("");
  const [assignmentTitle, setAssignmentTitle] = useState<string>("");
  const [assignmentDesc, setAssignmentDesc] = useState<string>("");
  const [assignmentFileUrl, setAssignmentFileUrl] = useState<string>("");
  const [assignmentDueAt, setAssignmentDueAt] = useState<string>("");
  const [assignmentMaterialUrl, setAssignmentMaterialUrl] = useState<string>("");
  const [assignmentMaterialDesc, setAssignmentMaterialDesc] = useState<string>("");

  // Quick grading state in attendance roster
  const [gradingScoreMap, setGradingScoreMap] = useState<Record<number, string>>({});
  const [gradingFeedbackMap, setGradingFeedbackMap] = useState<Record<number, string>>({});
  const [gradingSavingMap, setGradingSavingMap] = useState<Record<number, boolean>>({});

  // Student Homework Submission Modal
  const [showHomeworkModal, setShowHomeworkModal] = useState<boolean>(false);
  const [submittingSession, setSubmittingSession] = useState<ClassSessionItem | null>(null);
  const [studentSubmissionText, setStudentSubmissionText] = useState<string>("");
  const [studentSubmissionFileUrl, setStudentSubmissionFileUrl] = useState<string>("");
  const [studentSubmissionFile, setStudentSubmissionFile] = useState<File | null>(null);
  const [selectedAssignmentFiles, setSelectedAssignmentFiles] = useState<File[]>([]);
  const [selectedMaterialFiles, setSelectedMaterialFiles] = useState<File[]>([]);
  const [uploadingSessionFiles, setUploadingSessionFiles] = useState<boolean>(false);
  const [downloadingSessionFileId, setDownloadingSessionFileId] = useState<number | null>(null);
  const [downloadingSubmissionSessionId, setDownloadingSubmissionSessionId] = useState<number | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Attendance modal (Tutor)
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [expandedSubmissionStudentId, setExpandedSubmissionStudentId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [mySettlementBySession, setMySettlementBySession] = useState<Record<number, SettlementDto>>({});

  useEffect(() => {
    fetchSessions();
    const refresh = () => { if (!document.hidden) fetchSessions(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [classRoomId]);

  useEffect(() => {
    let cancelled = false;
    if (currentUserRole !== "STUDENT") {
      setMySettlementBySession({});
      return () => { cancelled = true; };
    }

    contractsApi.listAgreements({ page: 0, size: 100 })
      .then(async (page) => {
        const agreements = page.content.filter((agreement) => agreement.classroomId === classRoomId);
        const groups = await Promise.all(agreements.map(async (agreement) => ({
          settlements: await contractsApi.getSettlements(agreement.id),
        })));
        if (cancelled) return;

        const latestBySession: Record<number, SettlementDto> = {};
        for (const group of groups) {
          for (const settlement of group.settlements) {
            const previous = latestBySession[settlement.sessionId];
            const currentTime = new Date(settlement.updatedAt || settlement.createdAt).getTime();
            const previousTime = previous
              ? new Date(previous.updatedAt || previous.createdAt).getTime()
              : Number.NEGATIVE_INFINITY;
            if (!previous || currentTime >= previousTime) {
              latestBySession[settlement.sessionId] = settlement;
            }
          }
        }
        setMySettlementBySession(latestBySession);
      })
      .catch(() => {
        if (!cancelled) setMySettlementBySession({});
      });

    return () => { cancelled = true; };
  }, [classRoomId, currentUserRole]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchSessions = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest(`/api/learning/classes/${classRoomId}/sessions`);
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err) {
      setSessions([]);
      setLoadError(err instanceof Error ? err.message : 'Không thể tải lịch học.');
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh(['TERMINATION_UPDATED', 'TERMINATION_COMPLETED', 'CLASS_MUTATED'], fetchSessions);

  const handleGenerateInitialSessions = async () => {
    setActionLoading(true);
    try {
      const data = await apiRequest(`/api/learning/classes/${classRoomId}/generate-initial-sessions`, {
        method: "POST"
      });
      if (Array.isArray(data) && data.length > 0) {
        setSessions(data);
        showToast("Đã mở thành công các buổi học của tuần đầu tiên!", "success");
      } else {
        await fetchSessions();
        showToast("Đã cập nhật danh sách buổi học!", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi mở buổi học", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const isSessionAvailable = (session: ClassSessionItem) => !historyMode && !session.attendanceStopped
    && (session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS');

  const isStrictSessionActive = (session: ClassSessionItem): boolean => {
    if (!isSessionAvailable(session)) return false;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (session.sessionDate !== today) return false;

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentMinutes = currentH * 60 + currentM;

    const [startH, startM] = session.startTime.split(":").map(Number);
    const [endH, endM] = session.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  useEffect(() => {
    if (currentUserRole !== 'STUDENT' || isOffline) return;
    const checkedSession = sessions.find((session) => session.myCheckedIn && isStrictSessionActive(session));
    if (!checkedSession) {
      setUnlockedMeetingLink('');
      return;
    }
    let cancelled = false;
    apiRequest(`/api/learning/sessions/${checkedSession.id}/student-meeting-link`)
      .then((result) => {
        if (!cancelled && result?.meetingLink) {
          setUnlockedMeetingLink(result.meetingLink);
        } else if (!cancelled && baseClassMeetingLink) {
          setUnlockedMeetingLink(baseClassMeetingLink);
        }
      })
      .catch(() => {
        if (!cancelled && baseClassMeetingLink) {
          setUnlockedMeetingLink(baseClassMeetingLink);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserRole, isOffline, sessions, now, baseClassMeetingLink]);

  const handleStudentCheckin = async (sessionId: number) => {
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${sessionId}/student-checkin`, {
        method: "POST"
      });
      if (!isOffline) {
        try {
          const linkResult = await apiRequest(`/api/learning/sessions/${sessionId}/student-meeting-link`);
          setUnlockedMeetingLink(linkResult?.meetingLink || baseClassMeetingLink);
          showToast("Điểm danh vào học thành công! Đã mở khóa link vào phòng học và bài tập.", "success");
        } catch {
          if (baseClassMeetingLink) {
            setUnlockedMeetingLink(baseClassMeetingLink);
          }
          showToast("Điểm danh vào học thành công! Đã mở khóa link vào phòng học.", "success");
        }
      } else {
        showToast("Điểm danh vào học thành công! Chúc bạn có buổi học hiệu quả.", "success");
      }
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể điểm danh ngoài khung giờ học!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openAttendancePanel = async (session: ClassSessionItem) => {
    setAttendanceList([]);
    setExpandedSubmissionStudentId(null);
    setActiveSession(session);
    setShowAttendanceModal(true);
    try {
      const data: AttendanceRecord[] = await apiRequest(`/api/learning/sessions/${session.id}/attendances`);
      if (Array.isArray(data)) {
        setAttendanceList(data);
        const scoreInit: Record<number, string> = {};
        const feedbackInit: Record<number, string> = {};
        data.forEach((att) => {
          if (att.gradeScore) scoreInit[att.id] = att.gradeScore;
          if (att.tutorFeedback) feedbackInit[att.id] = att.tutorFeedback;
        });
        setGradingScoreMap(scoreInit);
        setGradingFeedbackMap(feedbackInit);
      }
    } catch (err: any) {
      setShowAttendanceModal(false);
      showToast(err.message || 'Không thể tải danh sách điểm danh.', 'error');
    }
  };

  const handleGradeStudentHomework = async (attId: number) => {
    if (!activeSession) return;
    setGradingSavingMap((prev) => ({ ...prev, [attId]: true }));
    try {
      const score = gradingScoreMap[attId] || "";
      const feedback = gradingFeedbackMap[attId] || "";
      const updated = await classApi.gradeSessionHomework(activeSession.id, attId, {
        gradeScore: score,
        tutorFeedback: feedback
      });
      setAttendanceList((prev) =>
        prev.map((a) => (a.id === attId ? { ...a, gradeScore: updated.gradeScore, tutorFeedback: updated.tutorFeedback, gradedAt: updated.gradedAt } : a))
      );
      showToast("Đã lưu điểm và nhận xét thành công!", "success");
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi lưu chấm điểm", "error");
    } finally {
      setGradingSavingMap((prev) => ({ ...prev, [attId]: false }));
    }
  };

  const handleTutorDirectCheckin = async (sessionId: number) => {
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${sessionId}/tutor-attendance`, {
        method: "POST",
        body: JSON.stringify({})
      });
      showToast("Điểm danh vào dạy thành công!", "success");
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể điểm danh ngoài khung giờ học!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTutorFinalizeAttendance = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${activeSession.id}/tutor-attendance`, {
        method: "POST",
        body: JSON.stringify({})
      });
      showToast("Đã ghi nhận gia sư vào dạy. Học viên tự điểm danh trên tài khoản của mình.", "success");
      setShowAttendanceModal(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật điểm danh", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSessionDetails = async () => {
    if (!editingSession) return;
    const normalizedAssignmentDueAt = assignmentDueAt ? (assignmentDueAt.length === 16 ? `${assignmentDueAt}:00` : assignmentDueAt) : undefined;
    const submissionRequired = Boolean(normalizedAssignmentDueAt);
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${editingSession.id}/details`, {
        method: "PUT",
        body: JSON.stringify({
          topic: assignmentTopic,
          assignmentTitle: assignmentTitle,
          assignmentDescription: assignmentDesc,
          assignmentFileUrl: assignmentFileUrl,
          assignmentDueAt: normalizedAssignmentDueAt,
          submissionRequired,
          lateSubmissionAllowed: true,
          materialUrl: assignmentMaterialUrl,
          materialDescription: assignmentMaterialDesc
        })
      });
      showToast("Đã cập nhật bài tập và tài liệu buổi học!", "success");
      setShowAssignmentModal(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenHomeworkSubmission = (session: ClassSessionItem) => {
    setSubmittingSession(session);
    setStudentSubmissionText(session.mySubmissionText || "");
    setStudentSubmissionFileUrl(session.mySubmissionFileUrl || session.assignmentExternalUrl || "");
    setStudentSubmissionFile(null);
    setShowHomeworkModal(true);
  };

  const hasMySubmission = (session?: ClassSessionItem | null) =>
    Boolean(session?.mySubmittedAt || session?.mySubmissionText || session?.mySubmissionFileUrl || session?.mySubmissionFileName);

  const canMutateMySubmission = (session?: ClassSessionItem | null) => {
    if (!session || session.myCheckedIn !== true || session.submissionRequired === false) return false;
    if (session.myGradedAt || session.myGradeScore) return false;
    if (session.assignmentDueAt && new Date() > new Date(session.assignmentDueAt) && session.lateSubmissionAllowed === false) return false;
    return true;
  };

  const handleSubmitHomework = async () => {
    if (!submittingSession) return;
    if (!canMutateMySubmission(submittingSession)) {
      showToast("Bài đã được chấm hoặc đã đóng hạn nên không thể cập nhật bài nộp.", "error");
      return;
    }
    if (!studentSubmissionFile && !studentSubmissionFileUrl.trim() && !studentSubmissionText.trim()) {
      showToast("Vui lòng chọn file, dán link GitHub/Google Drive hoặc nhập nội dung bài làm.", "error");
      return;
    }
    setActionLoading(true);
    try {
      if (studentSubmissionFile) {
        const formData = new FormData();
        formData.append("file", studentSubmissionFile);
        if (studentSubmissionText.trim()) formData.append("submissionText", studentSubmissionText.trim());
        if (studentSubmissionFileUrl.trim()) formData.append("submissionFileUrl", studentSubmissionFileUrl.trim());
        await classApi.submitHomeworkWithFile(submittingSession.id, formData);
      } else {
        await classApi.submitHomework(submittingSession.id, {
          submissionText: studentSubmissionText.trim(),
          submissionFileUrl: studentSubmissionFileUrl.trim()
        });
      }
      showToast("Đã nộp bài tập thành công.", "success");
      setShowHomeworkModal(false);
      setStudentSubmissionFile(null);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể nộp bài tập.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveHomeworkSubmission = async () => {
    if (!submittingSession || !hasMySubmission(submittingSession)) return;
    if (!canMutateMySubmission(submittingSession)) {
      showToast("Bài đã được chấm hoặc đã đóng hạn nên không thể gỡ bài nộp.", "error");
      return;
    }
    if (!window.confirm("Gỡ bài nộp hiện tại? File đã nộp sẽ được xóa khỏi hệ thống sau khi cập nhật thành công.")) {
      return;
    }
    setActionLoading(true);
    try {
      await classApi.deleteHomeworkSubmission(submittingSession.id);
      showToast("Đã gỡ bài nộp. File cũ sẽ được dọn sau khi cập nhật thành công.", "success");
      setStudentSubmissionText("");
      setStudentSubmissionFileUrl("");
      setStudentSubmissionFile(null);
      setShowHomeworkModal(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể gỡ bài nộp.", "error");
    } finally {
      setActionLoading(false);
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
      showToast(err?.message || "Không thể tải file buổi học. Vui lòng đảm bảo bạn đã điểm danh buổi học này.", "error");
    } finally {
      setDownloadingSessionFileId(null);
    }
  };

  const handleDownloadSubmission = async (sessionId: number, attendanceId?: number) => {
    setDownloadingSubmissionSessionId(sessionId);
    try {
      const resolvedAttendanceId = attendanceId || sessions.find((s) => s.id === sessionId)?.myAttendanceId;
      if (!resolvedAttendanceId) {
        throw new Error("Không tìm thấy mã bài nộp để tải xuống.");
      }
      const res = await classApi.getSubmissionDownloadUrl(sessionId, resolvedAttendanceId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      showToast(err?.message || "Không thể tải bài làm đã nộp.", "error");
    } finally {
      setDownloadingSubmissionSessionId(null);
    }
  };

  const handleUploadAssignmentFiles = async () => {
    if (!editingSession || selectedAssignmentFiles.length === 0) return;
    setUploadingSessionFiles(true);
    try {
      const formData = new FormData();
      selectedAssignmentFiles.forEach((file) => formData.append("files", file));
      const uploaded = await classApi.uploadSessionAssignmentFiles(editingSession.id, formData);
      setEditingSession((prev) => prev ? {
        ...prev,
        assignmentFiles: [...(prev.assignmentFiles || []), ...uploaded]
      } : null);
      setSessions((prev) => prev.map((s) => s.id === editingSession.id ? {
        ...s,
        assignmentFiles: [...(s.assignmentFiles || []), ...uploaded]
      } : s));
      setSelectedAssignmentFiles([]);
      showToast("Đã tải lên các file bài tập!", "success");
    } catch (err: any) {
      showToast(err?.message || "Không thể tải lên file bài tập.", "error");
    } finally {
      setUploadingSessionFiles(false);
    }
  };

  const handleUploadMaterialFiles = async () => {
    if (!editingSession || selectedMaterialFiles.length === 0) return;
    setUploadingSessionFiles(true);
    try {
      const formData = new FormData();
      selectedMaterialFiles.forEach((file) => formData.append("files", file));
      const uploaded = await classApi.uploadSessionMaterialFiles(editingSession.id, formData);
      setEditingSession((prev) => prev ? {
        ...prev,
        materialFiles: [...(prev.materialFiles || []), ...uploaded]
      } : null);
      setSessions((prev) => prev.map((s) => s.id === editingSession.id ? {
        ...s,
        materialFiles: [...(s.materialFiles || []), ...uploaded]
      } : s));
      setSelectedMaterialFiles([]);
      showToast("Đã tải lên slide / bài giảng!", "success");
    } catch (err: any) {
      showToast(err?.message || "Không thể tải lên file slide.", "error");
    } finally {
      setUploadingSessionFiles(false);
    }
  };

  const handleDeleteSessionFile = async (sessionId: number, fileId: number, category: "ASSIGNMENT" | "MATERIAL") => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file này?")) return;
    try {
      await classApi.deleteSessionFile(sessionId, fileId);
      if (editingSession) {
        if (category === "ASSIGNMENT") {
          setEditingSession((prev) => prev ? {
            ...prev,
            assignmentFiles: (prev.assignmentFiles || []).filter((f) => f.id !== fileId)
          } : null);
        } else {
          setEditingSession((prev) => prev ? {
            ...prev,
            materialFiles: (prev.materialFiles || []).filter((f) => f.id !== fileId)
          } : null);
        }
      }
      setSessions((prev) => prev.map((s) => {
        if (s.id !== sessionId) return s;
        return category === "ASSIGNMENT"
          ? { ...s, assignmentFiles: (s.assignmentFiles || []).filter((f) => f.id !== fileId) }
          : { ...s, materialFiles: (s.materialFiles || []).filter((f) => f.id !== fileId) };
      }));
      showToast("Đã xóa file thành công!", "success");
    } catch (err: any) {
      showToast(err?.message || "Không thể xóa file.", "error");
    }
  };

  const handleSaveClassMeetingLink = async () => {
    if (!newMeetingLink.trim()) {
      showToast("Vui lòng nhập link phòng học", "error");
      return;
    }
    setActionLoading(true);
    try {
      if (onUpdateMeetingLink) {
        await onUpdateMeetingLink(newMeetingLink);
      } else {
        await apiRequest(`/api/learning/classes/${classRoomId}/meeting-link`, {
          method: "PUT",
          body: JSON.stringify({ meetingLink: newMeetingLink.trim() })
        });
      }
      showToast("Đã cập nhật link phòng học hiện hành; các buổi tiếp theo sẽ dùng link mới!", "success");
      setCurrentMeetingLink(newMeetingLink.trim());
      setShowEditMeetingModal(false);
      await fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Lỗi cập nhật link phòng học", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered sessions & Statistics
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "COMPLETED"),
    [sessions]
  );
  const upcomingSessions = useMemo(
    () => sessions.filter(isSessionAvailable),
    [sessions]
  );

  // 2 buổi trọng tâm mặc định: buổi gần nhất đã qua và buổi tiếp theo
  const focusedSessions = useMemo(() => {
    const lastCompleted = completedSessions.length > 0 ? completedSessions[completedSessions.length - 1] : null;
    const nextUpcoming = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

    if (lastCompleted && nextUpcoming) {
      return [lastCompleted, nextUpcoming];
    }
    if (!lastCompleted && nextUpcoming) {
      return upcomingSessions.slice(0, 2);
    }
    if (lastCompleted && !nextUpcoming) {
      return completedSessions.slice(-2);
    }
    return sessions.slice(0, 2);
  }, [completedSessions, upcomingSessions, sessions]);

  const filteredSessions = useMemo(() => {
    if (activeTab === "FOCUSED") return focusedSessions;
    if (activeTab === "UPCOMING") return upcomingSessions;
    if (activeTab === "COMPLETED") return completedSessions;
    return sessions;
  }, [sessions, activeTab, focusedSessions, upcomingSessions, completedSessions]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header with Classroom Meeting Link */}
      {(() => {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const activeSessionForStudent = sessions.find((s) => isStrictSessionActive(s));
        const todaySessionForStudent = sessions.find(
          (s) => s.sessionDate === todayStr && isSessionAvailable(s)
        );
        const nextUpcomingForStudent = sessions
          .filter((s) => isSessionAvailable(s) && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
         ;
        const isStudentCheckedInForCurrent = Boolean(activeSessionForStudent?.myCheckedIn);
        const isSessionActiveNow = Boolean(activeSessionForStudent);
        const canAccessMeetingLink = !historyMode && Boolean(activeSessionForStudent) && (currentUserRole === 'TUTOR' || (currentUserRole === 'STUDENT' && isStudentCheckedInForCurrent));

        return (
          <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Lịch Học & Lịch Sử Buổi Học
                </span>
              </div>
              <h2 className="text-xl font-bold">{classRoomName || "Chi Tiết Tiến Trình Buổi Học"}</h2>
              <p className="text-indigo-200 text-sm mt-0.5">
                Điểm danh độc lập 2 bên trong khung giờ • Nộp bài tập • Tự động giải ngân Smart Contract Escrow
              </p>
            </div>

            {/* Meeting Link Action Card (Online) or Address Card (Offline) */}
            {historyMode ? (
              <div className="flex items-center gap-3 bg-white/10 p-3.5 rounded-2xl border border-white/20">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 text-slate-300">
                  <History className="w-5 h-5" />
                </div>
                <div className="max-w-[280px]">
                  <div className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Chế Độ Xem Lịch Sử</div>
                  <div className="text-xs font-semibold text-white">Phòng học và điểm danh mới đã khóa</div>
                </div>
              </div>
            ) : isOffline ? (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-600 text-white shadow-xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="max-w-[260px]">
                  <div className="text-xs text-indigo-200 font-medium">Địa Điểm Học Trực Tiếp</div>
                  <div className="text-sm font-semibold truncate text-white" title={effectiveAddress || "Tại địa chỉ của lớp học"}>
                    {effectiveAddress || "Tại lớp học trực tiếp"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  !canAccessMeetingLink
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                    : "bg-indigo-600 text-white"
                }`}>
                  {!canAccessMeetingLink ? <Lock className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <div className="max-w-[230px]">
                  <div className="text-xs text-indigo-200 font-medium">Link Phòng Học Trực Tuyến</div>
                  <div className="text-sm font-semibold truncate text-white">
                    {!canAccessMeetingLink ? (
                      <span className="text-amber-200 text-xs font-bold flex items-center gap-1">
                        {isSessionActiveNow ? (
                          "Cần điểm danh để mở link"
                        ) : todaySessionForStudent ? (
                          `Mở lúc ${todaySessionForStudent.startTime}`
                        ) : nextUpcomingForStudent ? (
                          `Mở lúc ${nextUpcomingForStudent.startTime} ngày ${nextUpcomingForStudent.sessionDate}`
                        ) : (
                          "Chưa mở điểm danh"
                        )}
                      </span>
                    ) : (
                      <span className="text-white text-xs font-semibold break-all">
                        {meetingLink || (effectiveLearningMode === "ONLINE" ? `https://meet.google.com/edu-class-${classRoomId}` : "Chưa thiết lập")}
                      </span>
                    )}
                  </div>
                </div>
                {canAccessMeetingLink && meetingLink && (
                  <a
                    href={meetingLink.startsWith("http") ? meetingLink : `https://${meetingLink}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0"
                  >
                    <span>Vào Lớp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {!canAccessMeetingLink && currentUserRole === "STUDENT" && (
                  isSessionActiveNow ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = activeSessionForStudent ? `session-${activeSessionForStudent.id}` : "sessions-timeline-list";
                        const el = document.getElementById(targetId);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 animate-bounce"
                      title="Buổi học đang diễn ra. Bấm để điểm danh ngay"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Điểm Danh Ngay</span>
                    </button>
                  ) : (
                    <div
                      className="px-3.5 py-2 bg-white/10 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border border-white/10"
                      title="Chưa đến giờ học. Điểm danh chỉ mở trong khung giờ học."
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-300" />
                      <span>Chưa mở điểm danh</span>
                    </div>
                  )
                )}
                {currentUserRole === "TUTOR" && !historyMode && sessions.some(isSessionAvailable) && (
                  <button
                    onClick={() => {
                      setNewMeetingLink(currentMeetingLink || "");
                      setShowEditMeetingModal(true);
                    }}
                    className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
                    title="Đổi link phòng học"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 1. Hero Spotlight Card: Buổi Học Hôm Nay / Buổi Học Kế Tiếp */}
      {sessions.length > 0 && !historyMode && (() => {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const activeSession = sessions.find((s) => isStrictSessionActive(s));
        const todaySession = sessions.find(
          (s) => s.sessionDate === todayStr && isSessionAvailable(s)
        );
        const upcomingSessionsList = sessions
          .filter((s) => isSessionAvailable(s) && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber);
        const nextUpcomingSession = upcomingSessionsList[0];
        const spotlight = activeSession || todaySession || nextUpcomingSession;

        if (!spotlight && completedSessions.length === sessions.length && sessions.length > 0) {
          return (
            <div className="p-5 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white border-b border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-emerald-300 border border-white/20">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-white">Khóa học đã hoàn tất toàn bộ {sessions.length} buổi học!</h3>
                  <p className="text-emerald-200 text-xs mt-0.5">Bạn có thể xem lại toàn bộ lịch sử điểm danh, bài giảng và bài tập đã hoàn thành bên dưới.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("COMPLETED")}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all shadow-md shrink-0"
              >
                Xem lịch sử khóa học
              </button>
            </div>
          );
        }

        if (!spotlight) return null;

        const isToday = spotlight.sessionDate === todayStr;
        const isActiveNow = isStrictSessionActive(spotlight);
        const isCheckedIn = spotlight.myCheckedIn === true;
        const dayName = getDayOfWeekName(spotlight.sessionDate);

        return (
          <div className={`p-5 sm:p-6 border-b transition-all ${
            isActiveNow
              ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-amber-300 ring-2 ring-amber-400/20"
              : isToday
              ? "bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-indigo-50/90 border-indigo-200"
              : "bg-slate-50/90 border-slate-200"
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left side: Sequence & Info */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                  isActiveNow
                    ? "bg-rose-600 text-white animate-pulse"
                    : isToday
                    ? "bg-amber-500 text-white"
                    : "bg-indigo-600 text-white"
                }`}>
                  <span className="text-[10px] uppercase font-semibold opacity-90">Buổi</span>
                  <span className="text-lg sm:text-xl leading-none font-black font-display">{spotlight.sequenceNumber}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {isActiveNow ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1.5 shadow-xs animate-bounce">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        BUỔI HỌC HÔM NAY · ĐANG DIỄN RA
                      </span>
                    ) : isToday ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white flex items-center gap-1.5 shadow-xs">
                        <Clock className="w-3.5 h-3.5" />
                        BUỔI HỌC HÔM NAY
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        BUỔI HỌC KẾ TIẾP
                      </span>
                    )}

                    <span className="text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dayName ? `${dayName}, ` : ""}{spotlight.sessionDate}</span>
                    </span>
                    <span className="text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{spotlight.startTime} - {spotlight.endTime}</span>
                    </span>
                  </div>

                  <h3 className="font-display font-black text-slate-950 text-base sm:text-lg">
                    {spotlight.topic || `Buổi học #${spotlight.sequenceNumber}`}
                  </h3>

                  {spotlight.assignmentTitle && (
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Bài tập về nhà: <strong className="text-slate-900">{spotlight.assignmentTitle}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              {/* Right side: Attendance Check-in & Meeting Link Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                {currentUserRole === 'STUDENT' ? (
                  isCheckedIn ? (
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Đã Điểm Danh Có Mặt
                      </span>
                      {!isOffline && meetingLink && isActiveNow && (
                        <a
                          href={(meetingLink).startsWith("http") ? (meetingLink) : `https://${meetingLink}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 animate-pulse"
                        >
                          <Video className="w-4 h-4" />
                          <span>Vào Phòng Học</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ) : isActiveNow ? (
                    <div className="flex flex-col sm:items-end gap-1.5">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleStudentCheckin(spotlight.id)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md ring-2 ring-emerald-400 ring-offset-1 animate-bounce"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Điểm Danh Vào Học Ngay</span>
                      </button>
                      <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                        {!isOffline ? (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            Điểm danh có mặt để mở link phòng học
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5" />
                            Điểm danh có mặt tại lớp học
                          </>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold shadow-2xs">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span>{isToday ? `Mở điểm danh lúc ${spotlight.startTime}` : `Mở điểm danh lúc ${spotlight.startTime} ngày ${spotlight.sessionDate}`}</span>
                    </div>
                  )
                ) : (
                  /* Tutor Quick Action */
                  <div className="flex items-center gap-2 flex-wrap">
                    {spotlight.myCheckedIn ? (
                      <span className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1.5 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Gia sư đã điểm danh
                      </span>
                    ) : (
                      <button
                        disabled={currentUserRole !== 'TUTOR' || !isActiveNow || actionLoading}
                        onClick={() => handleTutorDirectCheckin(spotlight.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
                          isActiveNow ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isActiveNow ? "Điểm Danh Vào Dạy" : "Chưa Đến Giờ Dạy"}</span>
                      </button>
                    )}
                    {!isOffline && meetingLink && isActiveNow && currentUserRole === 'TUTOR' && (
                      <a
                        href={meetingLink.startsWith("http") ? meetingLink : `https://${meetingLink}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Vào Phòng Dạy</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Lộ Trình Các Buổi Học & Lịch Trình Chi Tiết (Không dùng %, hiển thị ngày giờ cụ thể) */}
      {sessions.length > 0 && (() => {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const activeSession = sessions.find((s) => isStrictSessionActive(s));
        const todaySession = sessions.find(
          (s) => s.sessionDate === todayStr && isSessionAvailable(s)
        );
        const nextSession = sessions
          .filter((s) => isSessionAvailable(s) && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
         ;
        const currentStep = (activeSession || todaySession || nextSession)?.sequenceNumber || 0;
        const remainingCount = upcomingSessions.length;
        const cancelledCount = sessions.filter((s) => s.status === 'CANCELLED').length;
        const heldCount = sessions.filter((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED' && s.attendanceStopped).length;

        return (
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200">
            {/* Header: rõ ràng thông tin số buổi, buổi đang học, không dùng % */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display">
                    Lộ Trình Buổi Học Khóa Này
                  </h4>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Tổng số: <strong className="text-slate-900 font-black">{sessions.length} buổi</strong>
                    <span className="mx-1.5 text-slate-300">•</span>
                    Đã hoàn thành: <strong className="text-emerald-700 font-black">{completedSessions.length} buổi</strong>
                    {cancelledCount > 0 && (
                      <>
                        <span className="mx-1.5 text-slate-300">•</span>
                        Đã hủy: <strong className="text-rose-700 font-black">{cancelledCount} buổi</strong>
                      </>
                    )}
                    {heldCount > 0 && <span> • Đang dừng tham gia: {heldCount} buổi</span>}
                    {currentStep > 0 && !historyMode && (
                      <>
                        <span className="mx-1.5 text-slate-300">•</span>
                        {activeSession ? 'Đang học' : 'Buổi tiếp theo'}: <strong className="text-indigo-700 font-black">Buổi {currentStep}</strong>
                      </>
                    )}
                    <span className="mx-1.5 text-slate-300">•</span>
                    Còn lại: <strong className="text-amber-700 font-black">{remainingCount} buổi</strong>
                  </p>
                </div>
              </div>

              {/* Status pill badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                  historyMode
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : currentStep > 0
                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}>
                  {historyMode ? "Lớp đã dừng (Chế độ xem lịch sử)" : currentStep > 0 ? `Buổi hiện tại: Buổi ${currentStep}/${sessions.length}` : "Lớp chưa có buổi kế tiếp"}
                </span>
              </div>
            </div>

            {/* Stepper nodes track */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {sessions.map((s) => {
                const isPassed = s.status === 'COMPLETED';
                const isCancelled = s.status === 'CANCELLED' || (!isPassed && Boolean(s.attendanceStopped));
                const isCurrent = !isPassed && !isCancelled && s.sequenceNumber === currentStep;
                const dayName = getDayOfWeekName(s.sessionDate);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (activeTab === "FOCUSED") setActiveTab("ALL");
                      setTimeout(() => {
                        const el = document.getElementById(`session-${s.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 50);
                    }}
                    title={`Buổi ${s.sequenceNumber}: ${dayName ? `${dayName}, ` : ""}${s.sessionDate} (${s.startTime} - ${s.endTime})${isCancelled ? " [ĐÃ HỦY / DỪNG]" : ""}`}
                    className="flex flex-col items-center min-w-[78px] text-center group cursor-pointer transition-all shrink-0"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shadow-2xs ${
                        isPassed
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : isCancelled
                          ? "bg-rose-100 text-rose-700 border border-rose-300"
                          : isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-200 scale-105 shadow-md"
                          : "bg-slate-50 text-slate-600 border border-slate-200 group-hover:border-indigo-300 group-hover:bg-indigo-50/50"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : isCancelled ? <Ban className="w-4 h-4" /> : s.sequenceNumber}
                    </div>
                    <span className={`text-[11px] font-bold mt-1 truncate max-w-[80px] ${isCancelled ? "text-rose-700 line-through" : isCurrent ? "text-indigo-700 font-black" : "text-slate-700"}`}>
                      Buổi {s.sequenceNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {s.sessionDate?.slice(5)}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mt-0.5 ${
                        isPassed
                          ? "bg-emerald-100 text-emerald-800"
                          : isCancelled
                          ? "bg-rose-100 text-rose-800"
                          : isCurrent
                          ? "bg-indigo-100 text-indigo-800 font-black"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isPassed ? "Đã xong" : isCancelled ? "Đã dừng" : isCurrent ? "Đang học" : "Sắp tới"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Chi tiết lịch trình các buổi học tiếp theo với ngày giờ thời gian cụ thể */}
            {upcomingSessions.length > 0 && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Lịch trình các buổi học tiếp theo (Ngày & Giờ cụ thể):</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingSessions.map((s) => {
                    const isNext = s.id === (activeSession || todaySession || nextSession)?.id;
                    const dayName = getDayOfWeekName(s.sessionDate);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (activeTab === "FOCUSED") setActiveTab("ALL");
                          setTimeout(() => {
                            document.getElementById(`session-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 50);
                        }}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isNext
                            ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200 hover:bg-indigo-100/70"
                            : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-slate-900 font-display text-xs">
                            Buổi {s.sequenceNumber}: {s.topic || `Buổi học #${s.sequenceNumber}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isNext ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}>
                            {isNext ? "Kế tiếp" : "Chưa tới"}
                          </span>
                        </div>
                        <div className="text-slate-800 font-bold flex items-center gap-1 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{dayName ? `${dayName}, ` : ""}{s.sessionDate}</span>
                        </div>
                        <div className="text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Thời gian: <b className="text-slate-900">{s.startTime} - {s.endTime}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. Tab Filter Bar (Mặc định hiển thị 2 buổi: gần nhất đã qua & buổi tiếp theo) */}
      {sessions.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/80 p-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Danh Sách Buổi Học</span>
            {activeTab === "FOCUSED" && (
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                (Đang hiển thị 2 buổi: gần nhất đã qua & tiếp theo)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("FOCUSED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "FOCUSED"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gần nhất & Tiếp theo ({focusedSessions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("UPCOMING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "UPCOMING"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sắp tới ({upcomingSessions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "COMPLETED"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Lịch sử buổi đã học ({completedSessions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "ALL"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({sessions.length})
            </button>
          </div>
        </div>
      )}

      {/* Focus Mode Notice when only 2 sessions are shown */}
      {activeTab === "FOCUSED" && sessions.length > focusedSessions.length && (
        <div className="mx-6 mt-4 p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-950 shadow-2xs">
          <span>💡 Mặc định hiển thị 2 buổi trọng tâm (buổi gần nhất đã qua và buổi tiếp theo).</span>
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className="font-bold underline text-indigo-700 hover:text-indigo-900 ml-2 shrink-0 cursor-pointer"
          >
            Xem tất cả ({sessions.length} buổi) →
          </button>
        </div>
      )}

      {/* Timeline Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm">Đang tải lịch học chi tiết...</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="p-6 text-red-700">
            <p>{loadError}</p>
            <button type="button" onClick={fetchSessions} className="mt-2 underline font-bold">Thử lại</button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
            <h3 className="text-base font-bold text-slate-800">
              {currentUserRole === "STUDENT" ? "Lớp học chưa bắt đầu buổi học nào" : "Chưa mở các buổi học tuần đầu"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              {currentUserRole === "STUDENT"
                ? "Gia sư đang chuẩn bị giáo án cho tuần học đầu tiên. Lịch học sẽ tự động hiển thị tại đây khi đến ngày khai giảng hoặc khi gia sư mở buổi học."
                : "Hệ thống sẽ tự động mở các buổi học khi đến ngày khai giảng hoặc bạn có thể bấm nút bên dưới để mở ngay các buổi đầu tiên để soạn bài tập."}
            </p>
            {currentUserRole === "TUTOR" && (
              <button
                disabled={actionLoading}
                onClick={handleGenerateInitialSessions}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-2 transition-all active:scale-95"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>Mở Buổi Học Tuần Đầu Tiên Ngay</span>
              </button>
            )}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">
            {activeTab === "COMPLETED"
              ? "Chưa có buổi học nào hoàn thành trong lịch sử."
              : "Không có buổi học nào trong danh mục này."}
          </div>
        ) : (
          <div className="space-y-4" id="sessions-timeline-list">
            {filteredSessions.map((session) => {
              const active = isStrictSessionActive(session);
              const isCancelled = session.status === "CANCELLED" || (session.status !== "COMPLETED" && Boolean(session.attendanceStopped));
              const isCompleted = session.status === "COMPLETED";
              const isPassedOrDone = isCompleted || isCancelled;
              const isTutorOrAdmin = currentUserRole === "TUTOR" || currentUserRole === "ADMIN" || currentUserRole === "STAFF";
              const isStudentUnlocked = session.myCheckedIn === true;
              const canAccessAssignment = isTutorOrAdmin || isStudentUnlocked;
              const hasSubmittedHomework = !!(session.mySubmissionText || session.mySubmissionFileUrl || session.mySubmissionFileName);
              const hasAssignmentContent = Boolean(
                session.assignmentTitle ||
                session.assignmentDescription ||
                session.assignmentFiles?.length ||
                session.assignmentExternalUrl ||
                session.assignmentFileUrl ||
                session.assignmentDueAt
              );
              const hasMaterialContent = Boolean(
                session.materialFiles?.length ||
                session.materialUrl ||
                session.materialExternalUrl ||
                session.materialDescription
              );
              const mySettlement = mySettlementBySession[session.sequenceNumber];
              const tutorWasPresent = session.tutorCheckedIn === true;
              const finalizedOutcomeCount = (session.bothPresentCount || 0)
                + (session.studentAbsentCount || 0)
                + (session.tutorAbsentCount || 0);
              const completedOutcomeLabel = currentUserRole === "STUDENT" && session.myFinalOutcome
                ? session.myFinalOutcome === "BOTH_PRESENT"
                  ? "Bạn và gia sư cùng có mặt (BOTH_PRESENT)"
                  : session.myFinalOutcome === "STUDENT_ABSENT_TUTOR_PRESENT"
                    ? "Bạn vắng, gia sư có mặt (STUDENT_ABSENT_TUTOR_PRESENT)"
                    : "Gia sư vắng (TUTOR_ABSENT)"
                : (session.totalAttendees || 0) === 0
                  ? "Không có học viên trong sổ điểm danh"
                  : finalizedOutcomeCount === 0
                    ? "Chưa có dữ liệu kết quả điểm danh"
                : (session.tutorAbsentCount || 0) > 0
                  ? `Gia sư vắng: ${session.tutorAbsentCount}/${session.totalAttendees || 0} học viên bị ảnh hưởng (TUTOR_ABSENT)`
                  : (session.studentAbsentCount || 0) > 0
                    ? `Cùng có mặt: ${session.bothPresentCount || 0} • Học viên vắng: ${session.studentAbsentCount || 0}`
                    : `Cùng có mặt: ${session.bothPresentCount || 0}/${session.totalAttendees || 0} (BOTH_PRESENT)`;

              return (
                <div
                  key={session.id}
                  id={`session-${session.id}`}
                  className={`p-5 rounded-xl border transition-all ${
                    active
                      ? "bg-amber-50/60 border-amber-300 shadow-sm ring-2 ring-amber-400/20"
                      : isCompleted
                      ? "bg-slate-50/80 border-slate-200"
                      : "bg-white border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Sequence & Basic Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs shrink-0 ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : active
                            ? "bg-amber-500 text-white animate-pulse"
                            : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-normal">Buổi</span>
                        <span className="text-base leading-none">{session.sequenceNumber}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-base">
                            {session.topic || `Buổi học #${session.sequenceNumber}`}
                          </h4>
                          {active && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              ĐANG DIỄN RA
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              ĐÃ HOÀN THÀNH
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-700">{session.sessionDate}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-700">
                              {session.startTime} - {session.endTime}
                            </span>
                          </div>
                          {session.totalAttendees !== undefined && session.totalAttendees > 0 && (
                            <div className="flex items-center gap-1 text-indigo-600 font-medium">
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                Điểm danh: {session.presentCount || 0}/{session.totalAttendees}
                              </span>
                            </div>
                          )}
                          {currentUserRole === "STUDENT" && session.myCheckedIn && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Bạn đã điểm danh
                            </span>
                          )}
                          {currentUserRole === "TUTOR" && session.myCheckedIn && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Bạn đã điểm danh vào dạy
                            </span>
                          )}
                        </div>

                        {/* Completed Session Detailed Summary */}
                        {isCompleted && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                {session.tutorCheckedIn === true
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                                Gia sư:{" "}
                                <strong className={`font-bold ${session.tutorCheckedIn === true ? "text-emerald-700" : "text-rose-700"}`}>
                                  {session.tutorCheckedIn === true ? "Đã vào dạy" : session.tutorCheckedIn === false ? "Vắng" : "Chưa có dữ liệu"}
                                </strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                {(session.presentCount || 0) > 0
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                                Học viên:{" "}
                                <strong className={`font-bold ${(session.presentCount || 0) > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                  {session.presentCount || 0}/{session.totalAttendees || 0} có mặt
                                </strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tutorWasPresent && finalizedOutcomeCount > 0 && (session.studentAbsentCount || 0) === 0
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}>
                                Kết quả: {completedOutcomeLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {mySettlement ? (
                                <div className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                  mySettlement.status === "REFUNDED"
                                    ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                                    : mySettlement.status === "SETTLED"
                                      ? "text-blue-800 bg-blue-50 border-blue-200"
                                      : mySettlement.status === "DISPUTED" || mySettlement.status === "DISPUTE_OPENING"
                                        ? "text-rose-800 bg-rose-50 border-rose-200"
                                        : "text-indigo-700 bg-white/80 border-indigo-200"
                                }`}>
                                  {mySettlement.status === "REFUNDED" || mySettlement.status === "SETTLED"
                                    ? <CheckCircle2 className="w-3 h-3" />
                                    : <Clock className="w-3 h-3" />}
                                  <span>
                                    {mySettlement.status === "REFUNDED"
                                      ? `Đã hoàn ${mySettlement.studentRefundUsdc.toLocaleString("vi-VN")} USDC về ví học viên`
                                      : mySettlement.status === "SETTLED" && mySettlement.studentRefundUsdc > 0
                                        ? `Đã quyết toán và hoàn ${mySettlement.studentRefundUsdc.toLocaleString("vi-VN")} USDC`
                                        : mySettlement.status === "SETTLED"
                                          ? "Đã quyết toán on-chain"
                                          : mySettlement.status === "DISPUTED" || mySettlement.status === "DISPUTE_OPENING"
                                            ? "Đang giữ tiền chờ xử lý khiếu nại"
                                            : mySettlement.status === "FINALIZE_PENDING" || mySettlement.status === "FAILED_RETRYABLE"
                                              ? "Đang chuyển tiền on-chain"
                                              : `Đề xuất quyết toán · chờ đến ${mySettlement.disputeDeadline ? new Date(mySettlement.disputeDeadline).toLocaleString("vi-VN") : "hết 24 giờ"}`}
                                  </span>
                                </div>
                              ) : session.settlementDispatched && (
                                <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">
                                  <Clock className="w-3 h-3 text-indigo-500" />
                                  <span>Đã gửi quyết toán</span>
                                </div>
                              )}
                              <a
                                href={currentUserRole === "STUDENT"
                                  ? `/student/complaints?classroomId=${session.classRoomId}&sessionId=${session.sequenceNumber}`
                                  : "/dashboard?tab=complaints"}
                                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-200 transition-colors"
                              >
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                <span>Khiếu nại / Lịch sử phản ánh</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Assignment & Lecture Materials Section */}
                        {Boolean(hasAssignmentContent || hasMaterialContent) ? (
                          canAccessAssignment ? (
                            <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-b from-emerald-50/90 to-teal-50/40 border border-emerald-200/90 shadow-xs flex flex-col gap-3.5">
                              {/* 1. Phần Đề Bài & Yêu Cầu Bài Tập */}
                              {hasAssignmentContent && (
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                                  <Unlock className="w-4 h-4" />
                                </div>
                                <div className="text-xs flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                    <span className="font-black text-emerald-950 text-sm font-display flex items-center gap-1.5">
                                      <FileText className="w-4 h-4 text-emerald-700" />
                                      Bài tập: {session.assignmentTitle || "Yêu cầu bài tập buổi học"}
                                    </span>
                                    {currentUserRole === "STUDENT" && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-200/90 text-emerald-900 flex items-center gap-1 border border-emerald-300">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                        ĐÃ MỞ KHÓA BÀI TẬP
                                      </span>
                                    )}
                                  </div>

                                  {/* Nội dung đề bài & hướng dẫn chi tiết */}
                                  {session.assignmentDescription && (
                                    <div className="mt-2 p-3 bg-white/95 rounded-xl border border-emerald-200/80 shadow-2xs">
                                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-emerald-600" />
                                        Nội dung đề bài & hướng dẫn:
                                      </div>
                                      <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                                        {session.assignmentDescription}
                                      </p>
                                    </div>
                                  )}

                                  {/* File đề bài đính kèm */}
                                  {session.assignmentFiles && session.assignmentFiles.length > 0 && (
                                    <div className="mt-2.5">
                                      <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                        <Download className="w-3 h-3 text-blue-600" />
                                        <span>File đề bài đính kèm ({session.assignmentFiles.length} file):</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {session.assignmentFiles.map((file) => (
                                          <div
                                            key={file.id}
                                            className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 bg-white text-slate-800 font-bold border border-blue-200 rounded-xl shadow-2xs hover:border-blue-300 text-xs transition-all"
                                          >
                                            <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                                              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                              <span className="truncate">{file.fileName}</span>
                                              <span className="text-[10px] text-slate-400 font-normal">({formatFileSize(file.fileSize)})</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadSessionFile(session.id, file.id)}
                                              disabled={downloadingSessionFileId === file.id}
                                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer shrink-0"
                                            >
                                              {downloadingSessionFileId === file.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Download className="w-3 h-3" />
                                              )}
                                              <span>Tải về xem</span>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Link đề bài ngoài bổ sung */}
                                  {(session.assignmentExternalUrl || (!session.assignmentFiles?.length && session.assignmentFileUrl)) && (
                                    <div className="mt-2">
                                      <a
                                        href={session.assignmentExternalUrl || session.assignmentFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 font-bold hover:bg-blue-50 border border-blue-200 rounded-xl shadow-2xs transition-all text-xs"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Đề bài link ngoài / bổ sung</span>
                                      </a>
                                    </div>
                                  )}

                                  {/* Hạn nộp bài tập */}
                                  {session.assignmentDueAt && (
                                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-200/70 inline-flex">
                                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>
                                        Hạn nộp bài: <strong className="text-emerald-950 font-black">{new Date(session.assignmentDueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              )}

                              {/* 2. Phần Slide Bài Giảng & Tài Liệu Buổi Học */}
                              {hasMaterialContent ? (
                                <div className={hasAssignmentContent ? "pt-3 border-t border-emerald-200/70" : ""}>
                                  <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4 text-emerald-700" />
                                        <span>Slide bài giảng & Tài liệu buổi học</span>
                                      </div>
                                      {session.materialFiles && session.materialFiles.length > 0 && (
                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                          {session.materialFiles.length} file
                                        </span>
                                      )}
                                    </div>

                                    {/* Danh sách file slide */}
                                    {session.materialFiles && session.materialFiles.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {session.materialFiles.map((file) => (
                                          <div
                                            key={file.id}
                                            className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 bg-emerald-50/70 text-slate-800 font-bold border border-emerald-200 rounded-xl shadow-2xs hover:border-emerald-300 text-xs transition-all"
                                          >
                                            <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                                              <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                              <span className="truncate">{file.fileName}</span>
                                              <span className="text-[10px] text-slate-400 font-normal">({formatFileSize(file.fileSize)})</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadSessionFile(session.id, file.id)}
                                              disabled={downloadingSessionFileId === file.id}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer shrink-0"
                                            >
                                              {downloadingSessionFileId === file.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Download className="w-3 h-3" />
                                              )}
                                              <span>Tải về xem</span>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Link slide ngoài */}
                                    {(session.materialExternalUrl || (!session.materialFiles?.length && session.materialUrl)) && (
                                      <div className="pt-1">
                                        <a
                                          href={session.materialExternalUrl || session.materialUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl shadow-xs transition-all text-xs"
                                        >
                                          <BookOpen className="w-3.5 h-3.5 text-white" />
                                          <span>Mở Slide / Tài liệu link ngoài</span>
                                          <ExternalLink className="w-3 h-3 ml-0.5" />
                                        </a>
                                      </div>
                                    )}

                                    {/* Ghi chú slide & dặn dò từ gia sư */}
                                    {session.materialDescription && (
                                      <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs flex items-start gap-2">
                                        <MessageSquare className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-black text-amber-900 block text-[11px] uppercase tracking-wider">
                                            Ghi chú bài giảng từ gia sư:
                                          </span>
                                          <p className="text-amber-950 font-semibold mt-0.5 leading-relaxed italic">
                                            "{session.materialDescription}"
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {/* 3. Phần Nộp Bài Tập & Đánh Giá Của Gia Sư (Dành cho Học Viên) */}
                              {currentUserRole === "STUDENT" && (
                                <div className="pt-3 border-t border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
                                  <div className="text-xs flex-1">
                                    {hasSubmittedHomework ? (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 font-black text-emerald-800 text-xs">
                                          <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <span>Bạn đã hoàn thành nộp bài tập</span>
                                          {session.mySubmittedAt && (
                                            <span className="font-semibold text-slate-500 text-[11px]">
                                              (Lúc {new Date(session.mySubmittedAt).toLocaleString('vi-VN')})
                                            </span>
                                          )}
                                        </div>
                                        {session.mySubmissionText && (
                                          <p className="text-slate-800 text-xs italic bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
                                            "{session.mySubmissionText}"
                                          </p>
                                        )}
                                        {session.mySubmissionFileName && (
                                          <div>
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadSubmission(session.id)}
                                              disabled={downloadingSubmissionSessionId === session.id}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 border border-blue-200 rounded-xl text-xs transition"
                                            >
                                              {downloadingSubmissionSessionId === session.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Download className="w-3.5 h-3.5 text-blue-600" />
                                              )}
                                              <span>File bài làm đã nộp: {session.mySubmissionFileName}</span>
                                              {session.mySubmissionFileSize ? <span className="text-[10px] text-blue-500 font-normal">({formatFileSize(session.mySubmissionFileSize)})</span> : null}
                                            </button>
                                          </div>
                                        )}

                                        {session.mySubmissionFileUrl && (
                                          <div>
                                            <a
                                              href={session.mySubmissionFileUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold underline text-xs"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              Xem link bài làm / hình ảnh đã nộp
                                            </a>
                                          </div>
                                        )}

                                        {session.myGradeScore && (
                                          <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-100 border border-emerald-300 text-xs shadow-2xs">
                                            <div className="flex items-center justify-between">
                                              <span className="font-black text-emerald-950 flex items-center gap-1.5 text-xs">
                                                <Award className="w-4 h-4 text-emerald-700" />
                                                Kết quả chấm bài từ Gia Sư:
                                              </span>
                                              <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-black text-xs shadow-xs">
                                                Điểm: {session.myGradeScore}
                                              </span>
                                            </div>
                                            {session.myTutorFeedback && (
                                              <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-slate-800 font-medium italic">
                                                Lời nhận xét: "{session.myTutorFeedback}"
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-amber-800 font-bold">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Chưa nộp bài tập cho buổi học này</span>
                                      </div>
                                    )}
                                  </div>

                                  {isCancelled ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                                      <Lock className="h-3.5 w-3.5" />
                                      Buổi học đã hủy
                                    </span>
                                  ) : historyMode ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                                      <Lock className="h-3.5 w-3.5" />
                                      Chỉ xem lịch sử
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => navigate(`/my-homework?classId=${classRoomId}&sessionId=${session.id}`)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shrink-0 active:scale-95 ${
                                        hasSubmittedHomework
                                          ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                                          : "bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300"
                                      }`}
                                    >
                                      <UploadCloud className="w-4 h-4" />
                                      <span>{hasSubmittedHomework ? "Sửa / Nộp Lại Bài Tập" : "Nộp Bài Tập"}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Locked State for Student who hasn't checked in yet */
                            <div className="mt-3.5 p-4 rounded-2xl bg-slate-100/90 border border-slate-300/80 flex items-start gap-3 shadow-2xs">
                              <div className="p-2.5 rounded-xl bg-slate-200 text-slate-600 shrink-0 mt-0.5">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="text-xs flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800 text-sm">
                                    Bài tập & Tài liệu Buổi #{session.sequenceNumber}: {session.assignmentTitle || "Bài tập về nhà"}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-200">
                                    <Lock className="w-3 h-3 text-amber-700" />
                                    KHÓA ĐỀ BÀI & TÀI LIỆU
                                  </span>
                                </div>
                                <p className="text-slate-600 mt-1 leading-relaxed">
                                  🔒 <i>{historyMode
                                    ? "Buổi này không thuộc phần lịch sử đã tham gia hoặc trước đây bạn chưa điểm danh để mở khóa nội dung."
                                    : <>Bạn cần bấm <b>"Điểm Danh Vào Học"</b> trong khung giờ ({session.startTime} - {session.endTime}) để mở khóa hướng dẫn làm bài, tài liệu slide và nộp bài tập cho gia sư.</>}</i>
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          currentUserRole === "TUTOR" && (
                            <div className="mt-2 text-xs text-slate-400 italic">
                              Chưa có bài tập cho buổi học này. Bấm "Giao Bài" để soạn đề bài và đính kèm tài liệu slide.
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start">
                      {/* Tutor Actions */}
                      {currentUserRole === "TUTOR" && (
                        <>
                          {!historyMode && !isCancelled && (
                            <button
                              onClick={() => {
                                setEditingSession(session);
                                setAssignmentTopic(session.topic || "");
                                setAssignmentTitle(session.assignmentTitle || "");
                                setAssignmentDesc(session.assignmentDescription || "");
                                setAssignmentFileUrl(session.assignmentFileUrl || "");
                                setAssignmentDueAt(session.assignmentDueAt ? session.assignmentDueAt.slice(0, 16) : "");
                                setAssignmentMaterialUrl(session.materialUrl || "");
                                setAssignmentMaterialDesc(session.materialDescription || "");
                                setShowAssignmentModal(true);
                              }}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Giao Bài / Sửa</span>
                            </button>
                          )}

                          {!isCompleted && (
                            (historyMode || isCancelled) ? (
                              <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1">
                                <Ban className="w-3.5 h-3.5" />
                                Buổi học đã dừng/hủy
                              </span>
                            ) : session.myCheckedIn ? (
                              <button
                                disabled={actionLoading}
                                onClick={() => handleTutorDirectCheckin(session.id)}
                                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                title="Gia sư đã điểm danh vào dạy thành công. Bấm nếu muốn xác nhận lại."
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Đã Điểm Danh Vào Dạy</span>
                              </button>
                            ) : (
                              <button
                                disabled={!active || actionLoading}
                                onClick={() => handleTutorDirectCheckin(session.id)}
                                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                  active
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                                title={
                                  active
                                    ? "Bấm để điểm danh vào dạy"
                                    : "Chỉ mở điểm danh trong khung giờ học " + session.startTime + " - " + session.endTime
                                }
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{active ? "Điểm Danh Vào Dạy" : "Chưa Đến Giờ Dạy"}</span>
                              </button>
                            )
                          )}

                          <button
                            onClick={() => openAttendancePanel(session)}
                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                            title="Xem danh sách học viên & bài tập đã nộp"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Xem Danh Sách Lớp</span>
                          </button>
                        </>
                      )}

                      {/* Student Actions */}
                      {currentUserRole === "STUDENT" && (
                        <>
                          {(historyMode || isCancelled) ? (
                            <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5" />
                              {Boolean(session.attendanceStopped)
                                ? "Đã dừng học theo thỏa thuận/quyết định"
                                : "Buổi học đã dừng/hủy"}
                            </span>
                          ) : (
                            <>
                              {!isPassedOrDone && !session.myCheckedIn && (
                                <div className="flex flex-col items-end gap-1.5">
                                  <button
                                    disabled={!active || actionLoading}
                                    onClick={() => handleStudentCheckin(session.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                      active
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce ring-2 ring-emerald-400 ring-offset-1"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    }`}
                                    title={
                                      active
                                        ? "Bấm để điểm danh vào học và nhận link phòng học"
                                        : "Chỉ mở điểm danh trong khung giờ học " + session.startTime + " - " + session.endTime
                                    }
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{active ? "Điểm Danh Vào Học" : "Chưa Đến Giờ Điểm Danh"}</span>
                                  </button>
                                  <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Điểm danh có mặt để lấy link vào phòng học
                                  </span>
                                </div>
                              )}

                              {!isCompleted && session.myCheckedIn && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Đã Điểm Danh Có Mặt</span>
                                  </span>
                                  {meetingLink && (
                                    <a
                                      href={meetingLink.startsWith("http") ? meetingLink : `https://${meetingLink}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md animate-pulse"
                                      title="Mở link Google Meet / Zoom để vào phòng học"
                                    >
                                      <Video className="w-4 h-4" />
                                      <span>Vào Phòng Học</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {isCompleted && onDisputeClick && (
                            <button
                              onClick={() => onDisputeClick(session)}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                              title="Khiếu nại nếu gia sư không dạy thật trong buổi này"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Khiếu Nại (24h)</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Admin / Staff Actions */}
                      {(currentUserRole === "ADMIN" || currentUserRole === "STAFF") && (
                        <button
                          onClick={() => openAttendancePanel(session)}
                          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                          title="Xem danh sách điểm danh & bài tập học viên"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Xem Điểm Danh & Bài Tập</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Edit current classroom meeting link */}
      {showEditMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Cập Nhật Link Phòng Học Hiện Hành</h3>
            <p className="text-xs text-slate-500 mb-4">
              Khi link hỏng, gia sư đổi tại đây; buổi hiện tại và các buổi tiếp theo sẽ dùng link mới.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đường dẫn phòng học (Google Meet / Zoom / MS Teams)
                </label>
                <input
                  type="text"
                  value={newMeetingLink}
                  onChange={(e) => setNewMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/abc-xyz..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowEditMeetingModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                disabled={actionLoading}
                onClick={handleSaveClassMeetingLink}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Lưu Link Phòng Học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Tutor Edit Session Topic & Assignment */}
      {showAssignmentModal && editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Soạn Bài Tập / Chủ Đề (Buổi #{editingSession.sequenceNumber})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ngày học: {editingSession.sessionDate} ({editingSession.startTime} - {editingSession.endTime})
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chủ đề bài giảng buổi học
                </label>
                <input
                  type="text"
                  value={assignmentTopic}
                  onChange={(e) => setAssignmentTopic(e.target.value)}
                  placeholder="Ví dụ: Cấu trúc điều kiện If-Else..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề bài tập về nhà
                </label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="Ví dụ: Giải 5 bài toán thực hành chương 1"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả chi tiết yêu cầu bài tập
                </label>
                <textarea
                  rows={3}
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  placeholder="Nhập hướng dẫn làm bài, hạn nộp..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Assignment files (up to 5 files) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    File bài tập đính kèm (Tối đa 5 file):
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    {(editingSession.assignmentFiles?.length || 0)}/5 file
                  </span>
                </div>

                {editingSession.assignmentFiles && editingSession.assignmentFiles.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {editingSession.assignmentFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs">
                        <span className="truncate text-slate-700 font-semibold">{file.fileName} ({formatFileSize(file.fileSize)})</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSessionFile(editingSession.id, file.id, "ASSIGNMENT")}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-1"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
                            alert(`Chỉ được tải thêm tối đa ${remaining} file.`);
                            setSelectedAssignmentFiles(files.slice(0, remaining));
                          } else {
                            setSelectedAssignmentFiles(files);
                          }
                        }
                      }}
                      className="flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer"
                    />
                    {selectedAssignmentFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={handleUploadAssignmentFiles}
                        disabled={uploadingSessionFiles}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
                      >
                        {uploadingSessionFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                        Tải {selectedAssignmentFiles.length} file
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Link đề bài ngoài bổ sung (tùy chọn):</label>
                  <input
                    type="text"
                    value={assignmentFileUrl}
                    onChange={(e) => setAssignmentFileUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn nộp bài tập (Deadline)
                </label>
                <input
                  type="datetime-local"
                  value={assignmentDueAt}
                  onChange={(e) => setAssignmentDueAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Lecture slides / materials */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Slide / Bài giảng buổi học:
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    {editingSession.materialFiles?.length || 0} file
                  </span>
                </div>

                {editingSession.materialFiles && editingSession.materialFiles.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {editingSession.materialFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs">
                        <span className="truncate text-slate-700 font-semibold">{file.fileName} ({formatFileSize(file.fileSize)})</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSessionFile(editingSession.id, file.id, "MATERIAL")}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-1"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedMaterialFiles(Array.from(e.target.files));
                      }
                    }}
                    className="flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                  {selectedMaterialFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUploadMaterialFiles}
                      disabled={uploadingSessionFiles}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      {uploadingSessionFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                      Tải {selectedMaterialFiles.length} file
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Link slide ngoài bổ sung (tùy chọn):</label>
                  <input
                    type="text"
                    value={assignmentMaterialUrl}
                    onChange={(e) => setAssignmentMaterialUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Ghi chú tài liệu buổi học:</label>
                  <input
                    type="text"
                    value={assignmentMaterialDesc}
                    onChange={(e) => setAssignmentMaterialDesc(e.target.value)}
                    placeholder="Ví dụ: Đọc từ trang 12 đến 25..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                disabled={actionLoading}
                onClick={handleSaveSessionDetails}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Lưu Buổi Học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Student Submit Homework */}
      {showHomeworkModal && submittingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Nộp Bài Tập — Buổi #{submittingSession.sequenceNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Chủ đề: <b>{submittingSession.assignmentTitle || submittingSession.topic || "Bài tập buổi học"}</b>
            </p>

            {/* Reference of Tutor Assignment */}
            {submittingSession.assignmentDescription && (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="font-bold block text-slate-900 mb-1">Đề bài & Hướng dẫn từ gia sư:</span>
                <p className="leading-relaxed">{submittingSession.assignmentDescription}</p>
                {submittingSession.assignmentFiles && submittingSession.assignmentFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 block">File đề bài từ gia sư:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {submittingSession.assignmentFiles.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => handleDownloadSessionFile(submittingSession.id, file.id)}
                          disabled={downloadingSessionFileId === file.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 border border-indigo-200"
                        >
                          {downloadingSessionFileId === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          <span className="truncate max-w-[200px]">{file.fileName}</span>
                          <span className="text-[10px] text-indigo-500 font-normal">({formatFileSize(file.fileSize)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {submittingSession.assignmentFileUrl && (
                  <a
                    href={submittingSession.assignmentFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline mt-2 font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Xem link đề bài ngoài bổ sung
                  </a>
                )}
              </div>
            )}

            {/* Previously submitted file if any */}
            {submittingSession.mySubmissionFileName && (
              <div className="mb-3.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-800 block">Bạn đã nộp file: {submittingSession.mySubmissionFileName}</span>
                    {submittingSession.mySubmissionFileSize && (
                      <span className="text-[10px] text-emerald-600 font-medium">Kích thước: {formatFileSize(submittingSession.mySubmissionFileSize)}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadSubmission(submittingSession.id)}
                  disabled={downloadingSubmissionSessionId === submittingSession.id}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1 transition shadow-xs"
                >
                  {downloadingSubmissionSessionId === submittingSession.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Tải về xem lại
                </button>
              </div>
            )}

            {hasMySubmission(submittingSession) && canMutateMySubmission(submittingSession) && (
              <div className="mb-3.5">
                <button
                  type="button"
                  onClick={handleRemoveHomeworkSubmission}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Gỡ bài nộp hiện tại
                </button>
              </div>
            )}

            <div className="space-y-3.5">
              {/* File Upload Input */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  File bài làm đính kèm <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="file"
                  onChange={(e) => setStudentSubmissionFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                />
                {studentSubmissionFile ? (
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã chọn: {studentSubmissionFile.name} ({formatFileSize(studentSubmissionFile.size)})
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Hỗ trợ file PDF, Word, Excel, hình ảnh, mã nguồn hoặc file nén .ZIP/.RAR.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung bài làm / Lời giải / Ghi chú cho gia sư
                </label>
                <textarea
                  rows={4}
                  value={studentSubmissionText}
                  onChange={(e) => setStudentSubmissionText(e.target.value)}
                  placeholder="Nhập câu trả lời, lời giải hoặc tóm tắt bài tập..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link bài làm ngoài bổ sung (Google Drive, Imgur, OneDrive - Tùy chọn)
                </label>
                <input
                  type="text"
                  value={studentSubmissionFileUrl}
                  onChange={(e) => setStudentSubmissionFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc https://imgur.com/..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mẹo: Bạn có thể dán link ngoài dự phòng hoặc driver nếu file quá lớn.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowHomeworkModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                disabled={actionLoading || !canMutateMySubmission(submittingSession)}
                onClick={handleSubmitHomework}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Xác Nhận Nộp Bài</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Tutor Attendance Roster & Submissions */}
      {showAttendanceModal && activeSession && (() => {
        const checkedInCount = attendanceList.filter((a) => a.studentChecked).length;
        const absentCount = attendanceList.length - checkedInCount;
        const submittedCount = attendanceList.filter((a) => a.submissionText || a.submissionFileUrl || a.submissionFileName).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      Danh Sách Điểm Danh & Bài Nộp — Buổi #{activeSession.sequenceNumber}
                    </h3>
                    {activeSession.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        ĐÃ CHỐT SỔ
                      </span>
                    ) : activeSession.status === "CANCELLED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                        ĐÃ HỦY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                        ĐANG ĐIỂM DANH
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeSession.topic || "Buổi học"} • Ngày {activeSession.sessionDate} ({activeSession.startTime} - {activeSession.endTime})
                  </p>
                </div>
              </div>

              {/* Statistics & Quick Actions Bar */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Sĩ Số Lớp</span>
                  <strong className="text-lg font-black text-indigo-950">{attendanceList.length}</strong>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Đã Có Mặt</span>
                  <strong className="text-lg font-black text-emerald-700">{checkedInCount}</strong>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Đã Nộp Bài</span>
                  <strong className="text-lg font-black text-blue-700">{submittedCount}/{attendanceList.length}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-500 pb-2 mb-1">Học viên tự điểm danh; gia sư chỉ xem trạng thái và không thể điểm danh hộ.</p>

              {/* Student Roster List */}
              {attendanceList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Chưa có học viên nào đăng ký chính thức (ENROLLED) trong lớp.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[350px]">
                  {attendanceList.map((att) => {
                    const isPresent = !!att.studentChecked;
                    const hasSubmitted = !!(att.submissionText || att.submissionFileUrl || att.submissionFileName);
                    const isExpanded = expandedSubmissionStudentId === att.studentId;

                    return (
                      <div
                        key={att.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isPresent
                            ? "bg-emerald-50/90 border-emerald-300 shadow-xs"
                            : "bg-slate-50 border-slate-200 opacity-90"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center ${isPresent ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`} aria-label={isPresent ? "Đã điểm danh" : "Chưa điểm danh"}>
                              {isPresent && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span>{att.studentName || `Học viên #${att.studentId}`}</span>
                                {att.attendanceLocked && (
                                  <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                    <Lock className="h-3 w-3" /> Đã chấm dứt hợp đồng
                                  </span>
                                )}
                                {att.studentChecked && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Đã tự Check-in
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{att.studentEmail}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasSubmitted ? (
                              <button
                                type="button"
                                onClick={() => setExpandedSubmissionStudentId(isExpanded ? null : att.studentId)}
                                className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 flex items-center gap-1 transition-all"
                              >
                                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>{isExpanded ? "Ẩn bài nộp" : "Xem bài nộp"}</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-600">
                                Chưa nộp bài
                              </span>
                            )}

                            {isPresent ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                CÓ MẶT
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                VẮNG
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expandable Homework Submission Preview for Tutor */}
                        {isExpanded && hasSubmitted && (
                          <div className="mt-3 pt-3 border-t border-slate-200 bg-white p-3 rounded-lg text-xs space-y-2">
                            <div className="flex items-center justify-between text-slate-500 font-medium">
                              <span>Bài tập của học viên:</span>
                              {att.submittedAt && (
                                <span>Nộp lúc: {new Date(att.submittedAt).toLocaleString('vi-VN')}</span>
                              )}
                            </div>
                            {att.submissionText && (
                              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800">
                                <p className="font-semibold text-[11px] text-slate-500 mb-1">Nội dung / Lời giải:</p>
                                <p className="whitespace-pre-wrap">{att.submissionText}</p>
                              </div>
                            )}
                            {att.submissionFileName && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSubmission(activeSession.id, att.id)}
                                  disabled={downloadingSubmissionSessionId === activeSession.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 rounded-lg transition-all"
                                >
                                  {downloadingSubmissionSessionId === activeSession.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  <span>Tải file bài nộp: {att.submissionFileName}</span>
                                  {att.submissionFileSize && (
                                    <span className="text-[10px] text-emerald-600 font-normal">({formatFileSize(att.submissionFileSize)})</span>
                                  )}
                                </button>
                              </div>
                            )}
                            {att.submissionFileUrl && (
                              <div>
                                <a
                                  href={att.submissionFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Mở đường dẫn file / ảnh ngoài bổ sung</span>
                                </a>
                              </div>
                            )}

                            {/* Tutor Grading & Feedback Section */}
                            <div className="mt-3 pt-3 border-t border-slate-200 bg-slate-50/80 p-3 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                                  Chấm điểm & Nhận xét của Gia sư:
                                </span>
                                {att.gradedAt && (
                                  <span className="text-[10px] text-emerald-700 font-semibold">
                                    Đã chấm: <b>{att.gradeScore}</b> ({new Date(att.gradedAt).toLocaleString('vi-VN')})
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col sm:flex-row gap-2">
                                <div className="w-full sm:w-36">
                                  <input
                                    type="text"
                                    value={gradingScoreMap[att.id] ?? att.gradeScore ?? ""}
                                    onChange={(e) => setGradingScoreMap((prev) => ({ ...prev, [att.id]: e.target.value }))}
                                    placeholder="Điểm (0-10, Đạt...)"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={gradingFeedbackMap[att.id] ?? att.tutorFeedback ?? ""}
                                    onChange={(e) => setGradingFeedbackMap((prev) => ({ ...prev, [att.id]: e.target.value }))}
                                    placeholder="Nhận xét bài làm..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={gradingSavingMap[att.id]}
                                  onClick={() => handleGradeStudentHomework(att.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                                >
                                  {gradingSavingMap[att.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Lưu điểm
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <span>Có mặt: <b className="text-emerald-700">{checkedInCount}</b>/{attendanceList.length} học viên</span>
                  {isSessionAvailable(activeSession) && currentUserRole === "TUTOR" && (
                    <span className="block text-[11px] text-amber-700 mt-0.5">
                      ⏳ Hệ thống sẽ tự động chốt kết quả và giải ngân sau buổi học
                    </span>
                  )}
                </div>

                <div className="flex gap-2.5 shrink-0">
                  <button
                    onClick={() => setShowAttendanceModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  {isSessionAvailable(activeSession) && currentUserRole === "TUTOR" && (
                    <button
                      disabled={actionLoading}
                      onClick={handleTutorFinalizeAttendance}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Ghi Nhận Gia Sư Vào Dạy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
