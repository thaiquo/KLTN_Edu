import React, { useState, useEffect, useMemo } from "react";
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
  Award
} from "lucide-react";
import { apiRequest } from "../../api/client";

export interface ClassSessionItem {
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
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  totalAttendees?: number;
  presentCount?: number;
  myCheckedIn?: boolean;
  mySubmissionText?: string;
  mySubmissionFileUrl?: string;
  mySubmittedAt?: string;
  tutorCheckedIn?: boolean;
  myFinalOutcome?: "BOTH_PRESENT" | "STUDENT_ABSENT_TUTOR_PRESENT" | "TUTOR_ABSENT";
  bothPresentCount?: number;
  studentAbsentCount?: number;
  tutorAbsentCount?: number;
  settlementDispatched?: boolean;
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
  finalOutcome?: "BOTH_PRESENT" | "STUDENT_ABSENT_TUTOR_PRESENT" | "TUTOR_ABSENT";
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

  // Student Homework Submission Modal
  const [showHomeworkModal, setShowHomeworkModal] = useState<boolean>(false);
  const [submittingSession, setSubmittingSession] = useState<ClassSessionItem | null>(null);
  const [studentSubmissionText, setStudentSubmissionText] = useState<string>("");
  const [studentSubmissionFileUrl, setStudentSubmissionFileUrl] = useState<string>("");

  // Attendance modal (Tutor)
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [selectedPresentIds, setSelectedPresentIds] = useState<number[]>([]);
  const [expandedSubmissionStudentId, setExpandedSubmissionStudentId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [classRoomId]);

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

  const isStrictSessionActive = (session: ClassSessionItem): boolean => {
    if (session.status !== 'SCHEDULED' && session.status !== 'IN_PROGRESS') return false;
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
    const checkedSession = sessions.find((session) => session.myCheckedIn && (isStrictSessionActive(session) || session.status === 'IN_PROGRESS'))
      || sessions.find((session) => session.myCheckedIn);
    if (!checkedSession) {
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
    setSelectedPresentIds([]);
    setExpandedSubmissionStudentId(null);
    setActiveSession(session);
    setShowAttendanceModal(true);
    try {
      const data: AttendanceRecord[] = await apiRequest(`/api/learning/sessions/${session.id}/attendances`);
      if (Array.isArray(data)) {
        setAttendanceList(data);
        setSelectedPresentIds(
          data.filter((a) => a.studentChecked || a.finalOutcome === "BOTH_PRESENT").map((a) => a.studentId)
        );
      }
    } catch (err: any) {
      setShowAttendanceModal(false);
      showToast(err.message || 'Không thể tải danh sách điểm danh.', 'error');
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
        body: JSON.stringify({ presentStudentIds: selectedPresentIds })
      });
      showToast("Đã cập nhật danh sách điểm danh lớp!", "success");
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
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${editingSession.id}/details`, {
        method: "PUT",
        body: JSON.stringify({
          topic: assignmentTopic,
          assignmentTitle: assignmentTitle,
          assignmentDescription: assignmentDesc,
          assignmentFileUrl: assignmentFileUrl
        })
      });
      showToast("Đã cập nhật bài tập và chủ đề buổi học!", "success");
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
    setStudentSubmissionFileUrl(session.mySubmissionFileUrl || "");
    setShowHomeworkModal(true);
  };

  const handleSubmitHomework = async () => {
    if (!submittingSession) return;
    if (!studentSubmissionText.trim() && !studentSubmissionFileUrl.trim()) {
      showToast("Vui lòng nhập nội dung bài nộp hoặc đường dẫn link file/hình ảnh.", "error");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${submittingSession.id}/homework-submission`, {
        method: "POST",
        body: JSON.stringify({
          submissionText: studentSubmissionText.trim(),
          submissionFileUrl: studentSubmissionFileUrl.trim()
        })
      });
      showToast("Nộp bài tập thành công!", "success");
      setShowHomeworkModal(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể nộp bài tập.", "error");
    } finally {
      setActionLoading(false);
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
  const completedSessions = useMemo(() => sessions.filter((s) => s.status === "COMPLETED"), [sessions]);
  const upcomingSessions = useMemo(() => sessions.filter((s) => s.status !== "COMPLETED"), [sessions]);

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
          (s) => s.sessionDate === todayStr && (s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS')
        );
        const nextUpcomingForStudent = sessions
          .filter((s) => s.status !== 'COMPLETED' && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
          || sessions.find((s) => s.status !== 'COMPLETED');
        const isStudentCheckedInForCurrent = Boolean(
          activeSessionForStudent?.myCheckedIn ||
          todaySessionForStudent?.myCheckedIn ||
          sessions.some((s) => s.status === 'IN_PROGRESS' && s.myCheckedIn)
        );
        const isSessionActiveNow = Boolean(activeSessionForStudent);
        const canAccessMeetingLink = currentUserRole !== 'STUDENT' || isStudentCheckedInForCurrent;

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
            {isOffline ? (
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
                      meetingLink || "Chưa thiết lập"
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
                {currentUserRole === "TUTOR" && (
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
      {sessions.length > 0 && (() => {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const activeSession = sessions.find((s) => isStrictSessionActive(s));
        const todaySession = sessions.find(
          (s) => s.sessionDate === todayStr && (s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS')
        );
        const upcomingSessionsList = sessions
          .filter((s) => s.status !== 'COMPLETED' && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber);
        const nextUpcomingSession = upcomingSessionsList[0] || sessions.find((s) => s.status !== 'COMPLETED');
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
                      {!isOffline && meetingLink && (
                        <a
                          href={meetingLink.startsWith("http") ? meetingLink : `https://${meetingLink}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95"
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
                        disabled={!isActiveNow || actionLoading}
                        onClick={() => handleTutorDirectCheckin(spotlight.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
                          isActiveNow ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isActiveNow ? "Điểm Danh Vào Dạy" : "Chưa Đến Giờ Dạy"}</span>
                      </button>
                    )}
                    {!isOffline && meetingLink && (
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
          (s) => s.sessionDate === todayStr && (s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS')
        );
        const nextSession = sessions
          .filter((s) => s.status !== 'COMPLETED' && s.sessionDate >= todayStr)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sequenceNumber - b.sequenceNumber)[0]
          || sessions.find((s) => s.status !== 'COMPLETED');
        const currentStep = (activeSession || todaySession || nextSession)?.sequenceNumber || sessions.length;
        const remainingCount = Math.max(0, sessions.length - completedSessions.length);

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
                    <span className="mx-1.5 text-slate-300">•</span>
                    Đang học: <strong className="text-indigo-700 font-black">Buổi {currentStep}</strong>
                    <span className="mx-1.5 text-slate-300">•</span>
                    Còn lại: <strong className="text-amber-700 font-black">{remainingCount} buổi</strong>
                  </p>
                </div>
              </div>

              {/* Status pill badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 text-xs font-black border border-indigo-200">
                  Buổi hiện tại: Buổi {currentStep}/{sessions.length}
                </span>
              </div>
            </div>

            {/* Stepper nodes track */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {sessions.map((s) => {
                const isPassed = s.status === 'COMPLETED';
                const isCurrent = s.sequenceNumber === currentStep;
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
                    title={`Buổi ${s.sequenceNumber}: ${dayName ? `${dayName}, ` : ""}${s.sessionDate} (${s.startTime} - ${s.endTime})`}
                    className="flex flex-col items-center min-w-[78px] text-center group cursor-pointer transition-all shrink-0"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shadow-2xs ${
                        isPassed
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-200 scale-105 shadow-md"
                          : "bg-slate-50 text-slate-600 border border-slate-200 group-hover:border-indigo-300 group-hover:bg-indigo-50/50"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : s.sequenceNumber}
                    </div>
                    <span className={`text-[11px] font-bold mt-1 truncate max-w-[80px] ${isCurrent ? "text-indigo-700 font-black" : "text-slate-700"}`}>
                      Buổi {s.sequenceNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {s.sessionDate?.slice(5)}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mt-0.5 ${
                        isPassed
                          ? "bg-emerald-100 text-emerald-800"
                          : isCurrent
                          ? "bg-indigo-100 text-indigo-800 font-black"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isPassed ? "Đã xong" : isCurrent ? "Đang học" : "Sắp tới"}
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
              const isCompleted = session.status === "COMPLETED";
              const isTutorOrAdmin = currentUserRole === "TUTOR" || currentUserRole === "ADMIN" || currentUserRole === "STAFF";
              const isStudentUnlocked = session.myCheckedIn === true;
              const canAccessAssignment = isTutorOrAdmin || isStudentUnlocked;
              const hasSubmittedHomework = !!(session.mySubmissionText || session.mySubmissionFileUrl);
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
                              {session.settlementDispatched && (
                                <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">
                                  <Clock className="w-3 h-3 text-indigo-500" />
                                  <span>Đã gửi quyết toán</span>
                                </div>
                              )}
                              <a
                                href={currentUserRole === "STUDENT" ? "/student/complaints" : "/dashboard?tab=complaints"}
                                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-200 transition-colors"
                              >
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                <span>Khiếu nại / Lịch sử phản ánh</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Assignment Section */}
                        {session.assignmentTitle ? (
                          canAccessAssignment ? (
                            <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-2.5">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                                  <Unlock className="w-4 h-4" />
                                </div>
                                <div className="text-xs flex-1">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="font-bold text-emerald-950 text-sm">
                                      Bài tập: {session.assignmentTitle}
                                    </span>
                                    {currentUserRole === "STUDENT" && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                        ĐÃ MỞ KHÓA BÀI TẬP
                                      </span>
                                    )}
                                  </div>

                                  {session.assignmentDescription && (
                                    <p className="text-emerald-900/90 mt-1 leading-relaxed">
                                      {session.assignmentDescription}
                                    </p>
                                  )}

                                  {session.assignmentFileUrl && (
                                    <div className="mt-2 pt-2 border-t border-emerald-200/60">
                                      <a
                                        href={session.assignmentFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-800 font-bold hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs transition-all"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Tải đề bài & tài liệu đính kèm</span>
                                        <ExternalLink className="w-3 h-3 ml-0.5 text-emerald-500" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Student Homework Submission Status & Action */}
                              {currentUserRole === "STUDENT" && (
                                <div className="mt-2 pt-2.5 border-t border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-3 rounded-lg">
                                  <div className="text-xs">
                                    {hasSubmittedHomework ? (
                                      <div>
                                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                                          <FileCheck className="w-4 h-4 text-emerald-600" />
                                          <span>Đã nộp bài tập</span>
                                          {session.mySubmittedAt && (
                                            <span className="font-normal text-slate-500 text-[11px]">
                                              (lúc {new Date(session.mySubmittedAt).toLocaleString('vi-VN')})
                                            </span>
                                          )}
                                        </div>
                                        {session.mySubmissionText && (
                                          <p className="text-slate-700 mt-1 text-xs italic bg-slate-50 p-2 rounded border border-slate-200">
                                            "{session.mySubmissionText}"
                                          </p>
                                        )}
                                        {session.mySubmissionFileUrl && (
                                          <div className="mt-1">
                                            <a
                                              href={session.mySubmissionFileUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold underline text-xs"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              Xem bài làm / hình ảnh đã nộp
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        <span>Chưa nộp bài tập cho buổi học này</span>
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleOpenHomeworkSubmission(session)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                                      hasSubmittedHomework
                                        ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    }`}
                                  >
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>{hasSubmittedHomework ? "Sửa / Nộp Lại" : "Nộp Bài Tập"}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Locked State for Student who hasn't checked in yet */
                            <div className="mt-3 p-3.5 rounded-xl bg-slate-100/90 border border-slate-300/80 flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-slate-200 text-slate-600 shrink-0 mt-0.5">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="text-xs flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-700">
                                    Bài tập Buổi #{session.sequenceNumber}: {session.assignmentTitle}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-200">
                                    <Lock className="w-3 h-3 text-amber-700" />
                                    KHÓA ĐỀ BÀI
                                  </span>
                                </div>
                                <p className="text-slate-500 mt-1 leading-relaxed">
                                  🔒 <i>Bạn cần bấm <b>"Điểm Danh Vào Học"</b> trong khung giờ ({session.startTime} - {session.endTime}) để mở khóa hướng dẫn làm bài và nộp bài tập cho gia sư.</i>
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          currentUserRole === "TUTOR" && (
                            <div className="mt-2 text-xs text-slate-400 italic">
                              Chưa có bài tập cho buổi học này. Bấm "Giao Bài" để soạn đề bài.
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
                          <button
                            onClick={() => {
                              setEditingSession(session);
                              setAssignmentTopic(session.topic || "");
                              setAssignmentTitle(session.assignmentTitle || "");
                              setAssignmentDesc(session.assignmentDescription || "");
                              setAssignmentFileUrl(session.assignmentFileUrl || "");
                              setShowAssignmentModal(true);
                            }}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Giao Bài / Sửa</span>
                          </button>

                          {!isCompleted && (
                            session.myCheckedIn ? (
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
                          {!isCompleted && !session.myCheckedIn && (
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đường dẫn File tài liệu / Đề bài (Google Drive / S3 / Dropbox)
                </label>
                <input
                  type="text"
                  value={assignmentFileUrl}
                  onChange={(e) => setAssignmentFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
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
                {submittingSession.assignmentFileUrl && (
                  <a
                    href={submittingSession.assignmentFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline mt-2 font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Xem file đính kèm của gia sư
                  </a>
                )}
              </div>
            )}

            <div className="space-y-3.5">
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
                  Link bài làm / File bài nộp / Hình ảnh bài giải (Google Drive, Imgur, OneDrive)
                </label>
                <input
                  type="text"
                  value={studentSubmissionFileUrl}
                  onChange={(e) => setStudentSubmissionFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc https://imgur.com/..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mẹo: Bạn có thể tải ảnh chụp bài làm lên Google Drive hoặc Imgur rồi dán link vào đây.
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
                disabled={actionLoading}
                onClick={handleSubmitHomework}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5"
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
        const checkedInCount = attendanceList.filter((a) => a.studentChecked || selectedPresentIds.includes(a.studentId)).length;
        const absentCount = attendanceList.length - checkedInCount;
        const submittedCount = attendanceList.filter((a) => a.submissionText || a.submissionFileUrl).length;

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

              {/* Quick Select All Button */}
              {activeSession.status !== "COMPLETED" && attendanceList.length > 0 && (
                <div className="flex items-center justify-between pb-2 mb-1 text-xs">
                  <span className="text-slate-500">Tích chọn để xác nhận có mặt:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPresentIds(attendanceList.map((a) => a.studentId))}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs hover:underline"
                    >
                      Chọn Tất Cả Có Mặt
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={() => setSelectedPresentIds([])}
                      className="text-slate-500 hover:text-slate-700 font-semibold text-xs hover:underline"
                    >
                      Bỏ Chọn Hết
                    </button>
                  </div>
                </div>
              )}

              {/* Student Roster List */}
              {attendanceList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Chưa có học viên nào đăng ký chính thức (ENROLLED) trong lớp.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[350px]">
                  {attendanceList.map((att) => {
                    const isPresent = selectedPresentIds.includes(att.studentId);
                    const hasSubmitted = !!(att.submissionText || att.submissionFileUrl);
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
                            <input
                              type="checkbox"
                              checked={isPresent}
                              disabled={activeSession.status === "COMPLETED"}
                              onChange={() => {
                                if (activeSession.status === "COMPLETED") return;
                                if (isPresent) {
                                  setSelectedPresentIds(selectedPresentIds.filter((id) => id !== att.studentId));
                                } else {
                                  setSelectedPresentIds([...selectedPresentIds, att.studentId]);
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span>{att.studentName || `Học viên #${att.studentId}`}</span>
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
                            {att.submissionFileUrl && (
                              <div>
                                <a
                                  href={att.submissionFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Mở đường dẫn file / ảnh bài nộp</span>
                                </a>
                              </div>
                            )}
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
                  <span>Có mặt: <b className="text-emerald-700">{selectedPresentIds.length}</b>/{attendanceList.length} học viên</span>
                  {activeSession.status !== "COMPLETED" && (
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
                  {activeSession.status !== "COMPLETED" && (
                    <button
                      disabled={actionLoading}
                      onClick={handleTutorFinalizeAttendance}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Lưu Điểm Danh Trong Giờ</span>
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
