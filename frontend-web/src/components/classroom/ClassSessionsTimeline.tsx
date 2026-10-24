import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Video,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Info,
  ShieldCheck,
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
import { learningCopilotApi } from "../../api/learningCopilot";
import { SessionNoteCard } from "./SessionNoteCard";

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

interface LessonDraftResponse {
  draftId: string;
  promptVersion: string;
  generatedAt: string;
  lessonPlan?: {
    title?: string;
    objectives?: string[];
    outline?: Array<{ title?: string; durationMinutes?: number; description?: string }>;
    warmup?: string;
    practiceActivities?: string[];
    keyPoints?: string[];
    homeworkSuggestion?: string;
    nextSessionSuggestion?: string;
  };
  sourceSummary?: {
    subject?: string;
    level?: string;
    durationMinutes?: number;
  };
  warnings?: string[];
}

interface Props {
  classRoomId: number;
  classRoomName?: string;
  totalSessions?: number;
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

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const vietnamDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getVietnamDateTime = (value: Date): { date: string; minutes: number } => {
  const parts = Object.fromEntries(
    vietnamDateTimeFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
  };
};

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
  totalSessions: propsTotalSessions,
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
  const [studentMeetingLinkState, setStudentMeetingLinkState] = useState<"IDLE" | "LOADING" | "READY" | "MISSING" | "ERROR">("IDLE");
  const [checkedInSessionIds, setCheckedInSessionIds] = useState<Set<number>>(() => new Set());
  const [currentMeetingLink, setCurrentMeetingLink] = useState(configuredMeetingLink || '');
  const [classDetail, setClassDetail] = useState<{
    learningMode?: string;
    meetingLink?: string;
    address?: string;
    totalSessions?: number;
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
            totalSessions: data.totalSessions,
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
  const [activeTab, setActiveTab] = useState<"ALL" | "UPCOMING" | "COMPLETED" | "DISPUTABLE" | "FOCUSED">("ALL");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const vietnamNow = useMemo(() => getVietnamDateTime(now), [now]);
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
  const [lessonDraft, setLessonDraft] = useState<LessonDraftResponse | null>(null);
  const [lessonDraftLoading, setLessonDraftLoading] = useState<boolean>(false);
  const [lessonDraftError, setLessonDraftError] = useState<string>("");

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
  const [myAgreementIdBySession, setMyAgreementIdBySession] = useState<Record<number, string>>({});

  // Student In-Place Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);
  const [disputingSession, setDisputingSession] = useState<ClassSessionItem | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputeEvidenceFile, setDisputeEvidenceFile] = useState<File | null>(null);
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState<string>("");
  const [disputeSubmitting, setDisputeSubmitting] = useState<boolean>(false);
  const [disputeError, setDisputeError] = useState<string>("");

  const formatRemainingTime = (deadline: string, nowMs: number): string => {
    const remainingMs = Math.max(0, new Date(deadline).getTime() - nowMs);
    const totalMinutes = Math.ceil(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
  };

  const formatExactTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const lastFocusTimeRef = useRef(0);

  useEffect(() => {
    fetchSessions(false);
    const refresh = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastFocusTimeRef.current < 30000) return;
      lastFocusTimeRef.current = now;
      fetchSessions(true);
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [classRoomId]);

  const reloadSettlements = useCallback(async () => {
    if (currentUserRole !== "STUDENT") {
      setMySettlementBySession({});
      setMyAgreementIdBySession({});
      return;
    }

    try {
      const page = await contractsApi.listAgreements({ page: 0, size: 100 });
      const agreements = (page?.content || []).filter((agreement) => agreement.classroomId === classRoomId);
      const groups = await Promise.all(agreements.map(async (agreement) => ({
        agreement,
        settlements: await contractsApi.getSettlements(agreement.id).catch(() => []),
      })));

      const latestBySession: Record<number, SettlementDto> = {};
      const agreementBySession: Record<number, string> = {};
      for (const group of groups) {
        for (const settlement of group.settlements) {
          const previous = latestBySession[settlement.sessionId];
          const currentTime = new Date(settlement.updatedAt || settlement.createdAt).getTime();
          const previousTime = previous
            ? new Date(previous.updatedAt || previous.createdAt).getTime()
            : Number.NEGATIVE_INFINITY;
          if (!previous || currentTime >= previousTime) {
            latestBySession[settlement.sessionId] = settlement;
            agreementBySession[settlement.sessionId] = group.agreement.id;
          }
        }
      }
      setMySettlementBySession(latestBySession);
      setMyAgreementIdBySession(agreementBySession);
    } catch {
      setMySettlementBySession({});
      setMyAgreementIdBySession({});
    }
  }, [classRoomId, currentUserRole]);

  useEffect(() => {
    reloadSettlements();
  }, [reloadSettlements]);

  const handleOpenDisputeModal = (session: ClassSessionItem) => {
    setDisputingSession(session);
    setDisputeReason("");
    setDisputeEvidenceFile(null);
    setDisputeEvidenceUrl("");
    setDisputeError("");
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingSession) return;
    if (!disputeReason.trim()) {
      setDisputeError("Vui lòng nhập lý do khiếu nại cụ thể.");
      return;
    }
    const resolvedAgreementId = myAgreementIdBySession[disputingSession.sequenceNumber];
    if (!resolvedAgreementId) {
      setDisputeError("Buổi học này chưa có đề xuất quyết toán còn hiệu lực để khiếu nại.");
      return;
    }

    setDisputeSubmitting(true);
    setDisputeError("");
    try {
      if (disputeEvidenceFile) {
        await contractsApi.openDisputeWithFile(
          resolvedAgreementId,
          disputingSession.sequenceNumber,
          disputeReason.trim(),
          disputeEvidenceFile
        );
      } else {
        await contractsApi.openDispute(
          resolvedAgreementId,
          disputingSession.sequenceNumber,
          {
            reason: disputeReason.trim(),
            evidenceObjectKey: disputeEvidenceUrl.trim() || undefined,
          }
        );
      }
      showToast("Đã ghi nhận khiếu nại buổi học. Hệ thống sẽ giữ quy trình quyết toán và thông báo cho gia sư nộp minh chứng đối chất.", "success");
      setShowDisputeModal(false);
      setDisputingSession(null);
      await reloadSettlements();
      fetchSessions(true);
    } catch (err: any) {
      setDisputeError(err?.message || "Lỗi khi gửi khiếu nại buổi học.");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchSessions = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setLoadError('');
    try {
      const data = await apiRequest(`/api/learning/classes/${classRoomId}/sessions`);
      if (Array.isArray(data)) {
        setSessions(data);
        setActiveSession((prev) => {
          if (!prev) return null;
          const updated = data.find((s) => s.id === prev.id);
          return updated ? { ...prev, ...updated } : prev;
        });
      }
    } catch (err) {
      if (!isBackground) {
        setSessions([]);
        setLoadError(err instanceof Error ? err.message : 'Không thể tải lịch học.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useRealtimeRefresh([
    'TERMINATION_UPDATED',
    'TERMINATION_COMPLETED',
    'CLASS_MUTATED',
    'SETTLEMENT_PROPOSED',
    'SESSION_SETTLED',
    'DISPUTE_MUTATED',
    'DISPUTE_OPENED',
    'DISPUTE_UPDATED',
    'DISPUTE_RESOLVED'
  ], () => {
    fetchSessions(true);
    reloadSettlements();
  });

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
        await fetchSessions(sessions.length > 0);
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
    if (session.sessionDate !== vietnamNow.date) return false;

    const [startH, startM] = session.startTime.split(":").map(Number);
    const [endH, endM] = session.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return vietnamNow.minutes >= startMinutes && vietnamNow.minutes < endMinutes;
  };

  const isSessionPastEndTime = (session?: ClassSessionItem | null): boolean => {
    if (!session || !session.sessionDate || !session.endTime) return false;
    if (session.sessionDate < vietnamNow.date) return true;
    if (session.sessionDate > vietnamNow.date) return false;

    const [endH, endM] = session.endTime.split(":").map(Number);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    return vietnamNow.minutes >= endMinutes;
  };

  const isStudentCheckedInForSession = useCallback((session?: ClassSessionItem | null): boolean => {
    return Boolean(session?.myCheckedIn || (session?.id && checkedInSessionIds.has(session.id)));
  }, [checkedInSessionIds]);

  useEffect(() => {
    if (currentUserRole !== 'STUDENT' || isOffline) {
      setStudentMeetingLinkState('IDLE');
      return;
    }
    const checkedSession = sessions.find((session) => isStudentCheckedInForSession(session) && isStrictSessionActive(session));
    if (!checkedSession) {
      setUnlockedMeetingLink('');
      setStudentMeetingLinkState('IDLE');
      return;
    }
    let cancelled = false;
    setStudentMeetingLinkState('LOADING');
    apiRequest(`/api/learning/sessions/${checkedSession.id}/student-meeting-link`)
      .then((result) => {
        if (!cancelled && result?.meetingLink) {
          setUnlockedMeetingLink(result.meetingLink);
          setStudentMeetingLinkState('READY');
        } else if (!cancelled) {
          setUnlockedMeetingLink('');
          setStudentMeetingLinkState('MISSING');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnlockedMeetingLink('');
          setStudentMeetingLinkState('ERROR');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserRole, isOffline, sessions, now, isStudentCheckedInForSession]);

  const handleStudentCheckin = async (sessionId: number) => {
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${sessionId}/student-checkin`, {
        method: "POST"
      });
      setCheckedInSessionIds((prev) => {
        const next = new Set(prev);
        next.add(sessionId);
        return next;
      });
      setSessions((prev) => prev.map((session) => (
        session.id === sessionId ? { ...session, myCheckedIn: true } : session
      )));
      setActiveSession((prev) => (prev && prev.id === sessionId ? { ...prev, myCheckedIn: true } : prev));
      if (!isOffline) {
        setStudentMeetingLinkState('LOADING');
        try {
          const linkResult = await apiRequest(`/api/learning/sessions/${sessionId}/student-meeting-link`);
          setUnlockedMeetingLink(linkResult?.meetingLink || '');
          setStudentMeetingLinkState(linkResult?.meetingLink ? 'READY' : 'MISSING');
          showToast("Điểm danh vào học thành công! Đã mở khóa link vào phòng học và bài tập.", "success");
        } catch {
          setUnlockedMeetingLink('');
          setStudentMeetingLinkState('ERROR');
          showToast("Điểm danh vào học thành công! Chưa lấy được link phòng học, vui lòng thử tải lại danh sách buổi học.", "success");
        }
      } else {
        showToast("Điểm danh vào học thành công! Chúc bạn có buổi học hiệu quả.", "success");
      }
      await fetchSessions(true);
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
      fetchSessions(true);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi lưu chấm điểm", "error");
    } finally {
      setGradingSavingMap((prev) => ({ ...prev, [attId]: false }));
    }
  };

  const handleTutorDirectCheckin = async (sessionId: number) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession || !isStrictSessionActive(targetSession)) {
      showToast("Chỉ có thể điểm danh gia sư trong đúng ngày và khung giờ của buổi học.", "error");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${sessionId}/tutor-attendance`, {
        method: "POST",
        body: JSON.stringify({})
      });
      showToast("Điểm danh vào dạy thành công!", "success");
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, myCheckedIn: true, tutorCheckedIn: true } : s))
      );
      setActiveSession((prev) => (prev && prev.id === sessionId ? { ...prev, myCheckedIn: true, tutorCheckedIn: true } : prev));
      fetchSessions(true);
    } catch (err: any) {
      showToast(err.message || "Không thể điểm danh ngoài khung giờ học!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTutorFinalizeAttendance = async () => {
    if (!activeSession) return;
    const targetSession = sessions.find((s) => s.id === activeSession.id) || activeSession;
    if (!isStrictSessionActive(targetSession)) {
      showToast("Chỉ có thể điểm danh gia sư trong đúng ngày và khung giờ của buổi học.", "error");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${activeSession.id}/tutor-attendance`, {
        method: "POST",
        body: JSON.stringify({})
      });
      showToast("Đã ghi nhận gia sư vào dạy. Học viên tự điểm danh trên tài khoản của mình.", "success");
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, myCheckedIn: true, tutorCheckedIn: true } : s))
      );
      setActiveSession((prev) => (prev ? { ...prev, myCheckedIn: true, tutorCheckedIn: true } : prev));
      fetchSessions(true);
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
      fetchSessions(true);
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const formatLessonDraftForNotes = (draft: LessonDraftResponse | null) => {
    const plan = draft?.lessonPlan;
    if (!plan) return "";
    const sections: string[] = [];
    if (plan.objectives?.length) {
      sections.push(`Mục tiêu:\n${plan.objectives.map((item) => `- ${item}`).join("\n")}`);
    }
    if (plan.warmup) {
      sections.push(`Khởi động:\n${plan.warmup}`);
    }
    if (plan.outline?.length) {
      sections.push(`Tiến trình:\n${plan.outline.map((item) => {
        const duration = item.durationMinutes ? ` (${item.durationMinutes} phút)` : "";
        return `- ${item.title || "Hoạt động"}${duration}: ${item.description || ""}`;
      }).join("\n")}`);
    }
    if (plan.practiceActivities?.length) {
      sections.push(`Hoạt động luyện tập:\n${plan.practiceActivities.map((item) => `- ${item}`).join("\n")}`);
    }
    if (plan.keyPoints?.length) {
      sections.push(`Trọng tâm cần chốt:\n${plan.keyPoints.map((item) => `- ${item}`).join("\n")}`);
    }
    if (plan.homeworkSuggestion) {
      sections.push(`Gợi ý bài tập tham khảo (chưa tự động giao):\n${plan.homeworkSuggestion}`);
    }
    if (plan.nextSessionSuggestion) {
      sections.push(`Gợi ý buổi sau:\n${plan.nextSessionSuggestion}`);
    }
    return sections.join("\n\n");
  };

  const formatLessonDraftForSavedNotes = (draft: LessonDraftResponse | null) => {
    const plan = draft?.lessonPlan;
    if (!plan) return "";

    const sections: string[] = [];
    const usedItems = new Set<string>();
    const normalizeItem = (item: string) => item.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
    const toBullets = (value?: string, limit = 1) => {
      const bullets: string[] = [];
      for (const rawItem of (value || "").split(/\r?\n/)) {
        if (bullets.length >= limit) break;
        const item = rawItem.replace(/^[-•]\s*/, "").trim();
        if (!item) continue;
        const key = normalizeItem(item);
        if (usedItems.has(key)) continue;
        usedItems.add(key);
        bullets.push(item);
      }
      return bullets;
    };
    const collectBullets = (values: Array<string | undefined>, limit: number) => {
      const bullets: string[] = [];
      for (const value of values) {
        bullets.push(...toBullets(value, limit - bullets.length));
        if (bullets.length >= limit) break;
      }
      return bullets;
    };
    const addSection = (heading: string, items: string[]) => {
      if (items.length) sections.push(`${heading}:\n${items.map((item) => `- ${item}`).join("\n")}`);
    };

    addSection("Mục tiêu", collectBullets(plan.objectives || [], 3));
    addSection("Khởi động", toBullets(plan.warmup, 2));
    addSection("Tiến trình buổi học", collectBullets((plan.outline || []).map((item) => {
      const duration = item.durationMinutes ? `: ${item.durationMinutes} phút` : "";
      return `${item.title || "Hoạt động"}${duration}`;
    }), 3));
    addSection("Hoạt động luyện tập", collectBullets(plan.practiceActivities || [], 3));
    addSection("Trọng tâm cần đạt", collectBullets(plan.keyPoints || [], 3));
    addSection("Bài tập sau buổi học", toBullets(plan.homeworkSuggestion, 2));
    addSection("Buổi học tiếp theo", toBullets(plan.nextSessionSuggestion, 2));

    return sections.join("\n\n");
  };

  const handleGenerateLessonDraft = async () => {
    if (!editingSession) return;
    setLessonDraftLoading(true);
    setLessonDraftError("");
    setLessonDraft(null);
    try {
      const draft = await learningCopilotApi.generateLessonDraft({
        classId: classRoomId,
        sessionId: editingSession.id
      });
      setLessonDraft(draft as LessonDraftResponse);
    } catch (err: any) {
      setLessonDraftError(err?.message || "Không thể tạo giáo án AI lúc này.");
    } finally {
      setLessonDraftLoading(false);
    }
  };

  const handleApplyLessonDraftToForm = () => {
    const plan = lessonDraft?.lessonPlan;
    if (!plan) return;
    if (plan.title) {
      setAssignmentTopic(plan.title);
    }
    const notes = formatLessonDraftForSavedNotes(lessonDraft);
    if (notes) {
      setAssignmentMaterialDesc(notes);
    }
    showToast("Đã chèn bản nháp AI vào form. Gia sư vẫn cần kiểm tra và bấm lưu.", "success");
  };

  const handleCopyLessonDraft = async () => {
    const notes = formatLessonDraftForNotes(lessonDraft);
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notes);
      showToast("Đã sao chép giáo án AI.", "success");
    } catch {
      showToast("Trình duyệt không cho phép sao chép tự động.", "error");
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
      fetchSessions(true);
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
      fetchSessions(true);
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
      await fetchSessions(true);
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

  // Buổi học có thể khiếu nại (dành riêng cho học viên khi buổi BOTH_PRESENT đang trong thời hạn 24 giờ)
  const disputableSessions = useMemo(() => {
    if (currentUserRole !== "STUDENT") return [];
    return sessions.filter((s) => {
      if (s.status !== "COMPLETED") return false;
      const settlement = mySettlementBySession[s.sequenceNumber];
      if (!settlement) return false;
      return settlement.status === "PROPOSED"
        && settlement.outcome === "BOTH_PRESENT"
        && Boolean(settlement.disputeDeadline)
        && new Date(settlement.disputeDeadline).getTime() > now.getTime();
    });
  }, [currentUserRole, sessions, mySettlementBySession, now]);

  // 2 buổi trọng tâm: buổi gần nhất đã qua và buổi tiếp theo
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
    if (activeTab === "DISPUTABLE") return disputableSessions;
    return sessions;
  }, [sessions, activeTab, focusedSessions, upcomingSessions, completedSessions, disputableSessions]);

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
        const todayStr = vietnamNow.date;
        const activeSessionForStudent = sessions.find((s) => isStrictSessionActive(s));
        const todaySessionForStudent = sessions.find(
          (s) => s.sessionDate === todayStr && isSessionAvailable(s)
        );
        const nextUpcomingForStudent = sessions
          .filter((s) => isSessionAvailable(s) && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
         ;
        const isStudentCheckedInForCurrent = isStudentCheckedInForSession(activeSessionForStudent);
        const isSessionActiveNow = Boolean(activeSessionForStudent);
        const accessibleMeetingLink = currentUserRole === 'STUDENT' ? unlockedMeetingLink : meetingLink;
        const canAccessMeetingLink = !historyMode && Boolean(activeSessionForStudent)
          && (currentUserRole === 'TUTOR' || (currentUserRole === 'STUDENT' && isStudentCheckedInForCurrent));
        const studentCheckedInNoLinkLabel = studentMeetingLinkState === 'LOADING'
          ? 'Đang lấy link phòng học...'
          : studentMeetingLinkState === 'ERROR'
            ? 'Chưa lấy được link phòng học'
            : 'Gia sư chưa cập nhật link phòng học';

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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 max-w-full">
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 max-w-full">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  !canAccessMeetingLink
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                    : "bg-indigo-600 text-white"
                }`}>
                  {!canAccessMeetingLink ? <Lock className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <div className="min-w-0 max-w-[280px]">
                  <div className="text-xs text-indigo-200 font-medium">Link Phòng Học Trực Tuyến</div>
                  <div className="text-sm font-semibold text-white min-w-0">
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
                      <span className="text-white text-xs font-semibold break-all [overflow-wrap:anywhere]">
                        {accessibleMeetingLink || (currentUserRole === 'TUTOR' && effectiveLearningMode === "ONLINE" ? `https://meet.google.com/edu-class-${classRoomId}` : studentCheckedInNoLinkLabel)}
                      </span>
                    )}
                  </div>
                </div>
                {canAccessMeetingLink && accessibleMeetingLink && (
                  <a
                    href={accessibleMeetingLink.startsWith("http") ? accessibleMeetingLink : `https://${accessibleMeetingLink}`}
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
        const todayStr = vietnamNow.date;
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
        const isCheckedIn = isStudentCheckedInForSession(spotlight);
        const dayName = getDayOfWeekName(spotlight.sessionDate);
        const studentCheckedInNoLinkLabel = studentMeetingLinkState === 'LOADING'
          ? 'Đang lấy link phòng học...'
          : studentMeetingLinkState === 'ERROR'
            ? 'Chưa lấy được link phòng học'
            : 'Gia sư chưa cập nhật link phòng học';

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

                  {spotlight.assignmentTitle && (currentUserRole !== 'STUDENT' || isCheckedIn) && (
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
                      {!isOffline && unlockedMeetingLink && isActiveNow && (
                        <a
                          href={unlockedMeetingLink.startsWith("http") ? unlockedMeetingLink : `https://${unlockedMeetingLink}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 animate-pulse"
                        >
                          <Video className="w-4 h-4" />
                          <span>Vào Phòng Học</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {!isOffline && !unlockedMeetingLink && isActiveNow && (
                        <span className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>{studentCheckedInNoLinkLabel}</span>
                        </span>
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
                      <span>
                        {isToday
                          ? isSessionPastEndTime(spotlight)
                            ? "Khung giờ học đã kết thúc (Đang chờ chốt buổi)"
                            : `Mở điểm danh lúc ${spotlight.startTime}`
                          : `Mở điểm danh lúc ${spotlight.startTime} ngày ${spotlight.sessionDate}`}
                      </span>
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
                        <span>{isActiveNow ? "Điểm Danh Vào Dạy" : isSessionPastEndTime(spotlight) ? "Đã Hết Giờ Dạy" : "Chưa Đến Giờ Dạy"}</span>
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
        const todayStr = vietnamNow.date;
        const activeSession = sessions.find((s) => isStrictSessionActive(s));
        const todaySession = sessions.find(
          (s) => s.sessionDate === todayStr && isSessionAvailable(s)
        );
        const nextSession = sessions
          .filter((s) => isSessionAvailable(s) && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
         ;
        const totalCourseSessions = propsTotalSessions || classDetail?.totalSessions || sessions.length;
        const hasRollingSessions = totalCourseSessions > sessions.length;
        const currentStep = (activeSession || todaySession || nextSession)?.sequenceNumber || 0;
        const cancelledCount = sessions.filter((s) => s.status === 'CANCELLED').length;
        const remainingCount = Math.max(0, totalCourseSessions - completedSessions.length - cancelledCount);
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
                    Tổng khóa: <strong className="text-slate-900 font-black">{totalCourseSessions} buổi</strong>
                    {hasRollingSessions && (
                      <>
                        <span className="mx-1.5 text-slate-300">•</span>
                        Đã mở lịch: <strong className="text-indigo-700 font-black">{sessions.length}/{totalCourseSessions} buổi</strong>
                      </>
                    )}
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
                  {historyMode ? "Lớp đã dừng (Chế độ xem lịch sử)" : currentStep > 0 ? `Buổi hiện tại: Buổi ${currentStep}/${totalCourseSessions}` : "Lớp chưa có buổi kế tiếp"}
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
              {hasRollingSessions && (
                <div className="flex flex-col items-center justify-center min-w-[78px] text-center shrink-0 opacity-60">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-400 border border-dashed border-slate-300">
                    +{totalCourseSessions - sessions.length}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Buổi {sessions.length + 1}-{totalCourseSessions}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">Cuốn chiếu</span>
                </div>
              )}
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

      {/* 3. Tab Filter Bar */}
      {sessions.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/80 p-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Danh Sách Buổi Học</span>
            <span className="text-[11px] text-slate-400 font-medium">({filteredSessions.length}/{sessions.length} buổi)</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Tất cả ({sessions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("UPCOMING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "UPCOMING"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sắp tới ({upcomingSessions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "COMPLETED"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Đã diễn ra ({completedSessions.length})</span>
            </button>
            {currentUserRole === "STUDENT" && (
              <button
                type="button"
                onClick={() => setActiveTab("DISPUTABLE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "DISPUTABLE"
                    ? "bg-rose-600 text-white shadow-xs font-black"
                    : disputableSessions.length > 0
                    ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold hover:bg-rose-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Trong hạn khiếu nại ({disputableSessions.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("FOCUSED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "FOCUSED"
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Chỉ hiển thị 2 buổi trọng tâm (buổi gần nhất vừa qua và buổi kế tiếp)"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gần đây & Kế tiếp ({focusedSessions.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Disputable Notice Banner */}
      {currentUserRole === "STUDENT" && disputableSessions.length > 0 && activeTab !== "DISPUTABLE" && (
        <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Bạn có <strong>{disputableSessions.length} buổi học</strong> đã hoàn thành đang trong thời hạn 24 giờ có thể gửi khiếu nại bảo vệ học phí.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("DISPUTABLE")}
            className="font-black text-rose-700 hover:text-rose-900 underline ml-2 shrink-0 cursor-pointer"
          >
            Lọc các buổi này ngay →
          </button>
        </div>
      )}

      {/* Focus Mode Notice when only 2 sessions are shown */}
      {activeTab === "FOCUSED" && sessions.length > focusedSessions.length && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-950 shadow-2xs">
          <span>💡 Đang hiển thị 2 buổi trọng tâm (buổi gần nhất đã qua và buổi tiếp theo).</span>
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
            <button type="button" onClick={() => fetchSessions(false)} className="mt-2 underline font-bold">Thử lại</button>
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
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs p-6">
            {activeTab === "DISPUTABLE"
              ? "Hiện tại không có buổi học nào đang trong thời hạn 24 giờ khiếu nại."
              : activeTab === "COMPLETED"
              ? "Chưa có buổi học nào hoàn thành trong lịch sử khóa học."
              : activeTab === "UPCOMING"
              ? "Không có buổi học nào sắp tới. Tất cả buổi học đã hoàn thành."
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
              const isStudentUnlocked = isStudentCheckedInForSession(session);
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
                          {currentUserRole === "STUDENT" && isStudentUnlocked && (
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
                        {isCompleted && (() => {
                          const isDisputable = currentUserRole === "STUDENT"
                            && mySettlement?.status === "PROPOSED"
                            && mySettlement?.outcome === "BOTH_PRESENT"
                            && Boolean(mySettlement?.disputeDeadline)
                            && new Date(mySettlement.disputeDeadline).getTime() > now.getTime();
                          const isDisputed = currentUserRole === "STUDENT"
                            && (mySettlement?.status === "DISPUTED" || mySettlement?.status === "DISPUTE_OPENING");
                          const isDisputeExpired = currentUserRole === "STUDENT"
                            && mySettlement?.status === "PROPOSED"
                            && Boolean(mySettlement?.disputeDeadline)
                            && new Date(mySettlement.disputeDeadline).getTime() <= now.getTime();
                          const isSettled = mySettlement?.status === "SETTLED";
                          const isRefunded = mySettlement?.status === "REFUNDED";

                          return (
                            <div className={`mt-3 p-3.5 rounded-2xl border transition-all ${
                              isDisputable
                                ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20"
                                : isDisputed
                                ? "bg-rose-50/60 border-rose-200"
                                : "bg-indigo-50/50 border-indigo-100"
                            }`}>
                              <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
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

                                {/* Status Badge */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {mySettlement ? (
                                    <div className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                                      isRefunded
                                        ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                                        : isSettled
                                        ? "text-blue-800 bg-blue-50 border-blue-200"
                                        : isDisputed
                                        ? "text-rose-800 bg-rose-50 border-rose-200 font-black animate-pulse"
                                        : isDisputable
                                        ? "text-amber-900 bg-amber-100/90 border-amber-300 font-black"
                                        : "text-indigo-700 bg-white border-indigo-200"
                                    }`}>
                                      {isRefunded || isSettled ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : isDisputed ? (
                                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                      ) : (
                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      )}
                                      <span>
                                        {isRefunded
                                          ? `Đã hoàn ${mySettlement.studentRefundUsdc.toLocaleString("vi-VN")} USDC về ví học viên`
                                          : isSettled && mySettlement.studentRefundUsdc > 0
                                          ? `Đã quyết toán và hoàn ${mySettlement.studentRefundUsdc.toLocaleString("vi-VN")} USDC`
                                          : isSettled
                                          ? "Đã quyết toán on-chain"
                                          : isDisputed
                                          ? "Đang giữ tiền on-chain chờ phân xử khiếu nại"
                                          : isDisputable
                                          ? `Còn hạn khiếu nại (còn ${formatRemainingTime(mySettlement.disputeDeadline!, now.getTime())})`
                                          : isDisputeExpired
                                          ? "Đã hết hạn khiếu nại 24h · Chờ giải ngân on-chain"
                                          : `Đề xuất quyết toán · Chờ đến ${mySettlement.disputeDeadline ? formatExactTime(mySettlement.disputeDeadline) : "hết 24 giờ"}`}
                                      </span>
                                    </div>
                                  ) : session.settlementDispatched ? (
                                    <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>Đã gửi quyết toán</span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {/* Action Bar for Completed Session: Complaint / Settlement Actions */}
                              {currentUserRole === "STUDENT" && (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
                                  {isDisputable ? (
                                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDisputeModal(session)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer active:scale-95"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        <span>Gửi khiếu nại buổi này (Còn {formatRemainingTime(mySettlement.disputeDeadline!, now.getTime())})</span>
                                      </button>
                                      <a
                                        href={`/student/complaints?classroomId=${session.classRoomId}&sessionId=${session.sequenceNumber}`}
                                        className="text-[11px] font-bold text-rose-700 hover:underline inline-flex items-center gap-1"
                                      >
                                        <span>Xem trang khiếu nại & đối chất</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ) : isDisputed ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                        Buổi học đang trong quy trình phân xử
                                      </span>
                                      <a
                                        href={`/student/complaints?classroomId=${session.classRoomId}&sessionId=${session.sequenceNumber}`}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                                      >
                                        <span>Xem tiến độ khiếu nại</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between w-full text-[11px] text-slate-500 font-medium">
                                      <span>
                                        {isSettled
                                          ? "Buổi học đã hoàn tất quyết toán hợp đồng on-chain."
                                          : isDisputeExpired
                                          ? "Đã hết thời hạn 24 giờ để gửi khiếu nại cho buổi học này."
                                          : "Thông tin quyết toán buổi học"}
                                      </span>
                                      <a
                                        href={`/student/complaints?classroomId=${session.classRoomId}`}
                                        className="text-slate-600 hover:text-slate-900 font-bold hover:underline inline-flex items-center gap-1"
                                      >
                                        <span>Lịch sử khiếu nại</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <SessionNoteCard note={session.materialDescription} className="mt-3.5" />

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
                                    Bài tập & Tài liệu Buổi #{session.sequenceNumber}
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
                                setLessonDraft(null);
                                setLessonDraftError("");
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
                                    : isSessionPastEndTime(session)
                                    ? "Khung giờ dạy " + session.startTime + " - " + session.endTime + " đã kết thúc. Đang chờ hệ thống chốt buổi."
                                    : "Chỉ mở điểm danh trong khung giờ học " + session.startTime + " - " + session.endTime
                                }
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{active ? "Điểm Danh Vào Dạy" : isSessionPastEndTime(session) ? "Đã Hết Giờ Dạy" : "Chưa Đến Giờ Dạy"}</span>
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
                              {!isPassedOrDone && !isStudentUnlocked && (
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
                                        : isSessionPastEndTime(session)
                                        ? "Khung giờ điểm danh " + session.startTime + " - " + session.endTime + " đã kết thúc. Đang chờ hệ thống chốt buổi."
                                        : "Chỉ mở điểm danh trong khung giờ học " + session.startTime + " - " + session.endTime
                                    }
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{active ? "Điểm Danh Vào Học" : isSessionPastEndTime(session) ? "Đã Hết Giờ Điểm Danh" : "Chưa Đến Giờ Điểm Danh"}</span>
                                  </button>
                                  <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    {isSessionPastEndTime(session)
                                      ? "Đã qua giờ học • Chờ hệ thống tự động xử lý giải ngân/hoàn tiền"
                                      : "Điểm danh có mặt để lấy link vào phòng học"}
                                  </span>
                                </div>
                              )}

                              {!isCompleted && isStudentUnlocked && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Đã Điểm Danh Có Mặt</span>
                                  </span>
                                  {unlockedMeetingLink && (
                                    <a
                                      href={unlockedMeetingLink.startsWith("http") ? unlockedMeetingLink : `https://${unlockedMeetingLink}`}
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
                                  {!isOffline && active && !unlockedMeetingLink && (
                                    <span className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                      <AlertCircle className="w-4 h-4 text-amber-600" />
                                      <span>
                                        {studentMeetingLinkState === 'LOADING'
                                          ? 'Đang lấy link phòng học...'
                                          : studentMeetingLinkState === 'ERROR'
                                            ? 'Chưa lấy được link phòng học'
                                            : 'Gia sư chưa cập nhật link phòng học'}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {isCompleted && (() => {
                            const isDisputable = mySettlement?.status === "PROPOSED"
                              && mySettlement?.outcome === "BOTH_PRESENT"
                              && Boolean(mySettlement?.disputeDeadline)
                              && new Date(mySettlement.disputeDeadline).getTime() > now.getTime();
                            const isDisputed = mySettlement?.status === "DISPUTED" || mySettlement?.status === "DISPUTE_OPENING";

                            if (isDisputable) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => onDisputeClick ? onDisputeClick(session) : handleOpenDisputeModal(session)}
                                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                                  title="Gửi khiếu nại buổi học này trong thời hạn 24 giờ"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  <span>Gửi Khiếu Nại (24h)</span>
                                </button>
                              );
                            }

                            if (isDisputed) {
                              return (
                                <a
                                  href={`/student/complaints?classroomId=${session.classRoomId}&sessionId=${session.sequenceNumber}`}
                                  className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Đang Khiếu Nại</span>
                                </a>
                              );
                            }

                            if (onDisputeClick) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => onDisputeClick(session)}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Khiếu Nại</span>
                                </button>
                              );
                            }

                            return null;
                          })()}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm animate-fadeIn sm:p-4">
          <div className="flex max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:max-h-[calc(100vh-32px)] sm:w-[min(820px,calc(100vw-32px))]">
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-slate-900">
                Soạn Bài Tập / Chủ Đề (Buổi #{editingSession.sequenceNumber})
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Ngày học: {editingSession.sessionDate} ({editingSession.startTime} - {editingSession.endTime})
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] sm:px-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
              <section className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-black text-indigo-950">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      Soạn buổi học với AI
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-indigo-800">
                      AI dùng context lớp và buổi học hiện tại để tạo bản nháp giáo án. Gia sư cần kiểm tra trước khi lưu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateLessonDraft}
                    disabled={lessonDraftLoading}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {lessonDraftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span>{lessonDraftLoading ? "Đang soạn..." : "Gợi ý giáo án với AI"}</span>
                  </button>
                </div>

                {lessonDraftError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{lessonDraftError}</span>
                  </div>
                )}

                {lessonDraft?.lessonPlan && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Bản nháp AI</p>
                        <h5 className="mt-1 text-base font-black text-slate-900">{lessonDraft.lessonPlan.title || "Giáo án buổi học"}</h5>
                        <p className="mt-1 text-xs text-slate-500">
                          {lessonDraft.sourceSummary?.subject || "Môn học"} · {lessonDraft.sourceSummary?.level || "Cấp độ"} · {lessonDraft.sourceSummary?.durationMinutes || "?"} phút
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleApplyLessonDraftToForm}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Chèn vào form
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyLessonDraft}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Sao chép
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
                      {lessonDraft.lessonPlan.objectives?.length ? (
                        <div>
                          <p className="mb-1 font-black text-slate-900">Mục tiêu</p>
                          <ul className="space-y-1">
                            {lessonDraft.lessonPlan.objectives.map((item, index) => <li key={index}>- {item}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {lessonDraft.lessonPlan.keyPoints?.length ? (
                        <div>
                          <p className="mb-1 font-black text-slate-900">Trọng tâm</p>
                          <ul className="space-y-1">
                            {lessonDraft.lessonPlan.keyPoints.map((item, index) => <li key={index}>- {item}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {lessonDraft.lessonPlan.outline?.length ? (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-black text-slate-900">Tiến trình buổi học</p>
                        <div className="space-y-2">
                          {lessonDraft.lessonPlan.outline.map((item, index) => (
                            <div key={index} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2 font-bold text-slate-900">
                                <span>{item.title || "Hoạt động"}</span>
                                {item.durationMinutes ? <span className="text-indigo-600">{item.durationMinutes} phút</span> : null}
                              </div>
                              {item.description ? <p className="mt-1 text-slate-600">{item.description}</p> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(lessonDraft.lessonPlan.warmup || lessonDraft.lessonPlan.homeworkSuggestion || lessonDraft.lessonPlan.nextSessionSuggestion) && (
                      <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                        {lessonDraft.lessonPlan.warmup ? <div className="rounded-lg bg-amber-50 p-3 text-amber-900"><b>Khởi động:</b> {lessonDraft.lessonPlan.warmup}</div> : null}
                        {lessonDraft.lessonPlan.homeworkSuggestion ? <div className="rounded-lg bg-blue-50 p-3 text-blue-900"><b>Gợi ý bài tập:</b> {lessonDraft.lessonPlan.homeworkSuggestion}</div> : null}
                        {lessonDraft.lessonPlan.nextSessionSuggestion ? <div className="rounded-lg bg-slate-50 p-3 text-slate-700"><b>Buổi sau:</b> {lessonDraft.lessonPlan.nextSessionSuggestion}</div> : null}
                      </div>
                    )}

                    {lessonDraft.warnings?.length ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {lessonDraft.warnings.map((warning, index) => <p key={index}>- {warning}</p>)}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h4 className="mb-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Nội dung buổi học
                </h4>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chủ đề bài giảng buổi học
                </label>
                <input
                  type="text"
                  value={assignmentTopic}
                  onChange={(e) => setAssignmentTopic(e.target.value)}
                  placeholder="Ví dụ: Cấu trúc điều kiện If-Else..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Bài tập về nhà
                </h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề bài tập về nhà
                </label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="Ví dụ: Giải 5 bài toán thực hành chương 1"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả chi tiết yêu cầu bài tập
                </label>
                <textarea
                  rows={4}
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  placeholder="Nhập hướng dẫn làm bài, yêu cầu nộp bài..."
                  className="min-h-[96px] w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                      className="min-w-0 flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer"
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn nộp bài tập
                </label>
                <input
                  type="datetime-local"
                  value={assignmentDueAt}
                  onChange={(e) => setAssignmentDueAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              </div>
              </section>

              {/* Lecture slides / materials */}
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Tài liệu buổi học
                </h4>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)]">
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

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedMaterialFiles(Array.from(e.target.files));
                      }
                    }}
                    className="min-w-0 flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
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

              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú tài liệu buổi học</label>
                <textarea
                  rows={5}
                  value={assignmentMaterialDesc}
                  onChange={(e) => setAssignmentMaterialDesc(e.target.value)}
                  placeholder="Ví dụ: Đọc từ trang 12 đến 25..."
                  className="min-h-[112px] w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  setLessonDraft(null);
                  setLessonDraftError("");
                }}
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
        const currentSession = sessions.find((s) => s.id === activeSession.id) || activeSession;
        const isTutorCheckedIn = Boolean(currentSession.myCheckedIn || currentSession.tutorCheckedIn);
        const isTutorCheckinOpen = isStrictSessionActive(currentSession);
        const canShowTutorAttendanceAction = isSessionAvailable(currentSession) && currentUserRole === "TUTOR";
        const checkedInCount = attendanceList.filter((a) => a.studentChecked).length;
        const absentCount = attendanceList.length - checkedInCount;
        const submittedCount = attendanceList.filter((a) => a.submissionText || a.submissionFileUrl || a.submissionFileName).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">
                      Danh Sách Điểm Danh & Bài Nộp — Buổi #{currentSession.sequenceNumber}
                    </h3>
                    {currentSession.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        ĐÃ CHỐT SỔ
                      </span>
                    ) : currentSession.status === "CANCELLED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                        ĐÃ HỦY
                      </span>
                    ) : isTutorCheckinOpen ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                        ĐANG ĐIỂM DANH
                      </span>
                    ) : isSessionPastEndTime(currentSession) ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
                        ĐÃ HẾT GIỜ (CHỜ CHỐT)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        CHƯA ĐẾN GIỜ
                      </span>
                    )}
                    {currentUserRole === "TUTOR" && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isTutorCheckedIn
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        <CheckCircle2 className={`w-3 h-3 ${isTutorCheckedIn ? "text-emerald-600" : "text-amber-600"}`} />
                        <span>Gia sư: {isTutorCheckedIn ? "Đã điểm danh vào dạy" : "Chưa điểm danh vào dạy"}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentSession.topic || "Buổi học"} • Ngày {currentSession.sessionDate} ({currentSession.startTime} - {currentSession.endTime})
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
                  {canShowTutorAttendanceAction && (
                    isTutorCheckinOpen ? (
                      <span className="block text-[11px] text-amber-700 mt-0.5">
                        ⏳ Hệ thống sẽ tự động chốt kết quả và giải ngân sau buổi học
                      </span>
                    ) : (
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Điểm danh gia sư chỉ mở vào đúng ngày {currentSession.sessionDate}, khung giờ {currentSession.startTime} - {currentSession.endTime}.
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setShowAttendanceModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  {canShowTutorAttendanceAction && (
                    isTutorCheckedIn ? (
                      <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Gia Sư Đã Điểm Danh Vào Dạy</span>
                      </span>
                    ) : isTutorCheckinOpen ? (
                      <button
                        disabled={actionLoading}
                        onClick={handleTutorFinalizeAttendance}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Ghi Nhận Gia Sư Vào Dạy</span>
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-not-allowed">
                        <Clock className="w-4 h-4" />
                        <span>Chưa Đến Giờ Dạy</span>
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Student In-Place Dispute Modal */}
      {showDisputeModal && disputingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
            <div className="bg-gradient-to-r from-rose-600 to-red-700 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">Gửi Khiếu Nại Buổi Học #{disputingSession.sequenceNumber}</h3>
                  <p className="text-xs text-rose-100 font-semibold">{classRoomName || `Lớp học #${classRoomId}`}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>
                    Thời hạn khiếu nại còn lại: {mySettlementBySession[disputingSession.sequenceNumber]?.disputeDeadline ? formatRemainingTime(mySettlementBySession[disputingSession.sequenceNumber].disputeDeadline!, now.getTime()) : 'Trong vòng 24 giờ'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Khi gửi khiếu nại, hệ thống sẽ giữ quy trình quyết toán của buổi học và thông báo cho gia sư nộp minh chứng đối chất trong 24 giờ. Staff/Admin xử lý theo minh chứng hiện có sau khi gia sư phản hồi hoặc hết hạn.
                </p>
              </div>

              {disputeError && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{disputeError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Lý do khiếu nại chi tiết <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Mô tả cụ thể sự việc (ví dụ: gia sư không vào dạy, điểm danh không chính xác, thời lượng dạy không đúng...)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500 bg-slate-50 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Tải file minh chứng (ảnh, video, audio, tài liệu)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setDisputeEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-1.5 file:font-bold file:text-rose-700 file:cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">Hỗ trợ tối đa 50 MB. Mã băm SHA-256 sẽ được bảo chứng an toàn trên blockchain.</p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Hoặc đường dẫn bằng chứng
                </label>
                <input
                  type="text"
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  disabled={!!disputeEvidenceFile}
                  placeholder="Link Google Drive, video quay lại buổi học..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500 disabled:bg-slate-100 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  disabled={disputeSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={disputeSubmitting || !disputeReason.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all cursor-pointer"
                >
                  {disputeSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{disputeSubmitting ? "Đang gửi khiếu nại..." : "Xác nhận gửi khiếu nại"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
