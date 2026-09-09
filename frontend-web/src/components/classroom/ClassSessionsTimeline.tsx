import React, { useState, useEffect } from "react";
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
  Unlock
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
  finalOutcome?: "BOTH_PRESENT" | "STUDENT_ABSENT_TUTOR_PRESENT" | "TUTOR_ABSENT";
}

interface Props {
  classRoomId: number;
  classRoomName?: string;
  meetingLink?: string;
  currentUserRole?: "TUTOR" | "STUDENT" | "ADMIN" | "STAFF";
  currentUserId?: number;
  currentUserEmail?: string;
  onUpdateMeetingLink?: (newLink: string) => Promise<void>;
  onDisputeClick?: (session: ClassSessionItem) => void;
}

export const ClassSessionsTimeline: React.FC<Props> = ({
  classRoomId,
  classRoomName,
  meetingLink,
  currentUserRole = "STUDENT",
  currentUserId,
  currentUserEmail,
  onUpdateMeetingLink,
  onDisputeClick
}) => {
  const [sessions, setSessions] = useState<ClassSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSession, setActiveSession] = useState<ClassSessionItem | null>(null);

  // Modal states
  const [showEditMeetingModal, setShowEditMeetingModal] = useState<boolean>(false);
  const [newMeetingLink, setNewMeetingLink] = useState<string>(meetingLink || "");
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<ClassSessionItem | null>(null);
  const [assignmentTopic, setAssignmentTopic] = useState<string>("");
  const [assignmentTitle, setAssignmentTitle] = useState<string>("");
  const [assignmentDesc, setAssignmentDesc] = useState<string>("");
  const [assignmentFileUrl, setAssignmentFileUrl] = useState<string>("");

  // Attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [selectedPresentIds, setSelectedPresentIds] = useState<number[]>([]);
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
    try {
      const data = await apiRequest(`/api/learning/classes/${classRoomId}/sessions`);
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
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
    const today = new Date().toISOString().split("T")[0];
    if (session.sessionDate !== today) return false;

    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentMinutes = currentH * 60 + currentM;

    const [startH, startM] = session.startTime.split(":").map(Number);
    const [endH, endM] = session.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  };

  const handleStudentCheckin = async (sessionId: number) => {
    setActionLoading(true);
    try {
      await apiRequest(`/api/learning/sessions/${sessionId}/student-checkin`, {
        method: "POST"
      });
      showToast("Điểm danh vào học thành công!", "success");
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Không thể điểm danh ngoài khung giờ học!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openAttendancePanel = async (session: ClassSessionItem) => {
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
      console.error("Failed to load attendances:", err);
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
      showToast("Đã cập nhật link phòng học của lớp thành công!", "success");
      setShowEditMeetingModal(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.message || "Lỗi cập nhật link phòng học", "error");
    } finally {
      setActionLoading(false);
    }
  };

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
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header with Classroom Meeting Link */}
      <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Lịch Học Cuốn Chiếu Theo Tuần
            </span>
          </div>
          <h2 className="text-xl font-bold">{classRoomName || "Chi Tiết Tiến Trình Buổi Học"}</h2>
          <p className="text-indigo-200 text-sm mt-0.5">
            Điểm danh độc lập 2 bên trong đúng khung giờ học & tự động giải ngân Smart Contract Escrow
          </p>
        </div>

        {/* Meeting Link Action Card */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div className="max-w-[220px]">
            <div className="text-xs text-indigo-200 font-medium">Link Phòng Học Cố Định</div>
            <div className="text-sm font-semibold truncate text-white">
              {meetingLink || "Chưa thiết lập"}
            </div>
          </div>
          {meetingLink && (
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
          {currentUserRole === "TUTOR" && (
            <button
              onClick={() => {
                setNewMeetingLink(meetingLink || "");
                setShowEditMeetingModal(true);
              }}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
              title="Đổi link phòng học"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm">Đang tải lịch học chi tiết...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
            <h3 className="text-base font-bold text-slate-800">
              {currentUserRole === "STUDENT" ? "Lớp học chưa bắt đầu buổi học nào" : "Chưa mở các buổi học tuần đầu"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              {currentUserRole === "STUDENT"
                ? "Gia sư đang chuẩn bị giáo án cho tuần học đầu tiên. Lịch học sẽ tự động hiển thị tại đây khi đến ngày khai giảng."
                : "Hệ thống sẽ tự động mở khi đến ngày khai giảng hoặc bạn có thể bấm nút bên dưới để mở ngay 3 buổi đầu tiên để soạn trước bài tập và giáo án."}
            </p>
            {currentUserRole === "TUTOR" && (
              <button
                disabled={actionLoading}
                onClick={handleGenerateInitialSessions}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-2 transition-all active:scale-95"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>Mở 3 Buổi Học Tuần Đầu Tiên Ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const active = isStrictSessionActive(session);
              const isCompleted = session.status === "COMPLETED";

              return (
                <div
                  key={session.id}
                  className={`p-5 rounded-xl border transition-all ${
                    active
                      ? "bg-amber-50/60 border-amber-300 shadow-sm"
                      : isCompleted
                      ? "bg-slate-50/70 border-slate-200"
                      : "bg-white border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Sequence & Basic Info */}
                    <div className="flex items-start gap-4">
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

                      <div>
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
                            <span>{session.sessionDate}</span>
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
                                Có mặt: {session.presentCount || 0}/{session.totalAttendees}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Assignment Section (Gated by Attendance for Students) */}
                        {session.assignmentTitle && (() => {
                          const isTutorOrAdmin = currentUserRole === "TUTOR" || currentUserRole === "ADMIN" || currentUserRole === "STAFF";
                          const isStudentUnlocked = session.myCheckedIn || (session.status === "COMPLETED" && (session.presentCount || 0) > 0);
                          const canAccessAssignment = isTutorOrAdmin || isStudentUnlocked;

                          if (canAccessAssignment) {
                            return (
                              <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3">
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
                            );
                          } else {
                            // Locked State for Student who hasn't checked in yet
                            return (
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
                                    🔒 <i>Bạn cần bấm <b>"Điểm Danh Vào Học"</b> trong khung giờ ({session.startTime} - {session.endTime}) để mở khóa hướng dẫn làm bài và tài liệu đính kèm của gia sư.</i>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
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
                          )}

                          <button
                            onClick={() => openAttendancePanel(session)}
                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                            title="Xem danh sách học viên trong lớp"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Xem Danh Sách Lớp</span>
                          </button>
                        </>
                      )}

                      {/* Student Actions */}
                      {currentUserRole === "STUDENT" && (
                        <>
                          {!isCompleted && (
                            <button
                              disabled={!active || actionLoading}
                              onClick={() => handleStudentCheckin(session.id)}
                              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                active
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              }`}
                              title={
                                active
                                  ? "Bấm để điểm danh vào học"
                                  : "Chỉ mở điểm danh trong khung giờ học " + session.startTime + " - " + session.endTime
                              }
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{active ? "Điểm Danh Vào Học" : "Chưa Đến Giờ Điểm Danh"}</span>
                            </button>
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

      {/* Modal 1: Edit Classroom Meeting Link */}
      {showEditMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Cập Nhật Link Phòng Học Lớp</h3>
            <p className="text-xs text-slate-500 mb-4">
              Link này áp dụng cho toàn bộ học viên và gia sư xuyên suốt tất cả các buổi học.
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

      {/* Modal 2: Edit Session Topic & Assignment */}
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
                  Đường dẫn File tài liệu / Đề bài (Drive URL / S3)
                </label>
                <input
                  type="text"
                  value={assignmentFileUrl}
                  onChange={(e) => setAssignmentFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
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

      {/* Modal 3: Tutor Attendance Roster & Finalize */}
      {showAttendanceModal && activeSession && (() => {
        const checkedInCount = attendanceList.filter((a) => a.studentChecked || selectedPresentIds.includes(a.studentId)).length;
        const absentCount = attendanceList.length - checkedInCount;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      Danh Sách Điểm Danh — Buổi #{activeSession.sequenceNumber}
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
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Tổng Sĩ Số</span>
                  <strong className="text-lg font-black text-indigo-950">{attendanceList.length}</strong>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Đã Check-in / Có Mặt</span>
                  <strong className="text-lg font-black text-emerald-700">{checkedInCount}</strong>
                </div>
                <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Chưa Check-in / Vắng</span>
                  <strong className="text-lg font-black text-rose-700">{absentCount}</strong>
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
                <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[300px]">
                  {attendanceList.map((att) => {
                    const isPresent = selectedPresentIds.includes(att.studentId);
                    return (
                      <div
                        key={att.id}
                        onClick={() => {
                          if (activeSession.status === "COMPLETED") return;
                          if (isPresent) {
                            setSelectedPresentIds(selectedPresentIds.filter((id) => id !== att.studentId));
                          } else {
                            setSelectedPresentIds([...selectedPresentIds, att.studentId]);
                          }
                        }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                          isPresent
                            ? "bg-emerald-50/90 border-emerald-300 shadow-xs"
                            : "bg-slate-50 border-slate-200 opacity-90"
                        } ${activeSession.status !== "COMPLETED" ? "cursor-pointer hover:border-indigo-300" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isPresent}
                            disabled={activeSession.status === "COMPLETED"}
                            onChange={() => {}}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>{att.studentName || `Học viên #${att.studentId}`}</span>
                              {att.studentChecked && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Học viên đã tự Check-in
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{att.studentEmail}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          {isPresent ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              CÓ MẶT (85%)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              VẮNG MẶT (45%)
                            </span>
                          )}
                          {att.finalOutcome && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 font-medium">
                              {att.finalOutcome}
                            </div>
                          )}
                        </div>
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
                      ⏳ Hệ thống sẽ tự động chốt kết quả và hoàn tất lúc <b>{activeSession.endTime}</b>
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
