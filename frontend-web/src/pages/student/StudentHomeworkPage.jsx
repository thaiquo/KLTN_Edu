import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  Lock,
  Search,
  Send,
  Sparkles,
  Trash2,
  Unlock,
  UploadCloud,
  XCircle
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

export function StudentHomeworkPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active submission modal / drawer state
  const [submittingItem, setSubmittingItem] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submittingLoading, setSubmittingLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [downloadingSubmissionSessionId, setDownloadingSubmissionSessionId] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await classApi.getStudentHomeworkOverview();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
    } catch (err) {
      console.error('Failed to load student homework overview:', err);
      setError('Không thể tải danh sách bài tập. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Distinct classes list for filter
  const classOptions = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.classRoomId)) {
        map.set(item.classRoomId, item.classTitle || `Lớp #${item.classRoomId}`);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedClassId !== 'ALL' && item.classRoomId !== Number(selectedClassId)) {
        return false;
      }
      if (selectedStatus === 'LATE_SUBMITTED') {
        if (!(item.status === 'LATE_SUBMITTED' || item.isLateSubmission)) {
          return false;
        }
      } else if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.classTitle?.toLowerCase().includes(query);
        const matchTopic = item.topic?.toLowerCase().includes(query);
        const matchAssignment = item.assignmentTitle?.toLowerCase().includes(query);
        const matchTutor = item.tutorName?.toLowerCase().includes(query);
        if (!matchTitle && !matchTopic && !matchAssignment && !matchTutor) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedClassId, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const todo = items.filter((i) => i.status === 'TODO').length;
    const submitted = items.filter((i) => i.status === 'SUBMITTED').length;
    const lateSubmitted = items.filter((i) => i.status === 'LATE_SUBMITTED' || i.isLateSubmission).length;
    const graded = items.filter((i) => i.status === 'GRADED').length;
    const overdue = items.filter((i) => i.status === 'OVERDUE').length;
    const locked = items.filter((i) => i.status === 'LOCKED').length;
    const practiceOnly = items.filter((i) => i.status === 'NO_SUBMISSION_REQUIRED').length;
    const closed = items.filter((i) => i.status === 'CLOSED').length;
    return { total, todo, submitted, lateSubmitted, graded, overdue, locked, practiceOnly, closed };
  }, [items]);

  const handleOpenSubmit = (item) => {
    setSubmittingItem(item);
    setSubmissionText(item.submissionText || '');
    setSubmissionFileUrl(item.submissionFileUrl || item.submissionExternalUrl || '');
    setSubmissionFile(null);
    setSubmitSuccess(null);
  };

  const getOpenSubmissionStatus = (item) => {
    if (item.submissionBlockedByDeadline) return 'CLOSED';
    if (item.assignmentDueAt && new Date() > new Date(item.assignmentDueAt)) return 'OVERDUE';
    return 'TODO';
  };

  const hasSubmission = (item) =>
    Boolean(item?.submittedAt || item?.submissionText || item?.submissionFileUrl || item?.submissionFileName);

  const canMutateSubmission = (item) =>
    Boolean(item)
      && item.studentCheckedIn !== false
      && item.submissionRequired !== false
      && !item.submissionBlockedByDeadline
      && item.status !== 'CLOSED'
      && item.status !== 'GRADED'
      && !item.gradeScore
      && !item.gradedAt;

  const handleSubmitHomework = async () => {
    if (!submittingItem) return;
    if (!canMutateSubmission(submittingItem)) {
      alert('Bài đã được chấm hoặc đã đóng hạn nên không thể cập nhật bài nộp.');
      return;
    }
    if (!submissionFile && !submissionFileUrl.trim() && !submissionText.trim()) {
      alert('Vui lòng chọn file S3, dán link GitHub/Google Drive hoặc nhập nội dung bài làm.');
      return;
    }

    setSubmittingLoading(true);
    setSubmitSuccess(null);
    try {
      let updatedAttendance;
      if (submissionFile) {
        const formData = new FormData();
        formData.append('file', submissionFile);
        if (submissionText.trim()) formData.append('submissionText', submissionText.trim());
        if (submissionFileUrl.trim()) formData.append('submissionFileUrl', submissionFileUrl.trim());
        updatedAttendance = await classApi.submitHomeworkWithFile(submittingItem.sessionId, formData);
      } else {
        updatedAttendance = await classApi.submitHomework(submittingItem.sessionId, {
          submissionText: submissionText.trim(),
          submissionFileUrl: submissionFileUrl.trim()
        });
      }

      // Update locally
      setItems((prev) =>
        prev.map((i) => {
          if (i.sessionId !== submittingItem.sessionId) return i;
          return {
            ...i,
            attendanceId: updatedAttendance?.id ?? i.attendanceId,
            submissionText: submissionText.trim(),
            submissionFileUrl: submissionFileUrl.trim(),
            submissionFileName: updatedAttendance?.submissionFileName ?? (submissionFile?.name || null),
            submissionFileSize: updatedAttendance?.submissionFileSize ?? (submissionFile?.size || null),
            submittedAt: updatedAttendance?.submittedAt ?? new Date().toISOString(),
            status: updatedAttendance?.isLateSubmission ? 'LATE_SUBMITTED' : (i.gradeScore ? 'GRADED' : 'SUBMITTED'),
            isLateSubmission: Boolean(updatedAttendance?.isLateSubmission)
          };
        })
      );

      setSubmitSuccess('Nộp bài tập thành công lên AWS S3!');
      setTimeout(() => {
        setSubmittingItem(null);
        setSubmitSuccess(null);
        setSubmissionFile(null);
      }, 1500);
    } catch (err) {
      console.error('Submit homework failed:', err);
      alert(err.message || 'Không thể nộp bài tập. Vui lòng thử lại.');
    } finally {
      setSubmittingLoading(false);
    }
  };

  const handleDownloadSessionFile = async (sessionId, fileId) => {
    setDownloadingFileId(fileId);
    try {
      const res = await classApi.getSessionFileDownloadUrl(sessionId, fileId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err?.message || 'Không thể tải file buổi học. Vui lòng đảm bảo bạn đã điểm danh buổi học này.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleRemoveSubmission = async (item = submittingItem) => {
    if (!item || !hasSubmission(item)) return;
    if (!canMutateSubmission(item)) {
      alert('Bài đã được chấm hoặc đã đóng hạn nên không thể gỡ bài nộp.');
      return;
    }
    if (!window.confirm('Gỡ bài nộp hiện tại? Nếu có file lưu trên S3, hệ thống sẽ xóa file đó sau khi cập nhật thành công.')) {
      return;
    }

    setSubmittingLoading(true);
    setSubmitSuccess(null);
    try {
      const updatedAttendance = await classApi.deleteHomeworkSubmission(item.sessionId);
      const nextStatus = getOpenSubmissionStatus(item);
      setItems((prev) =>
        prev.map((i) => {
          if (i.sessionId !== item.sessionId) return i;
          return {
            ...i,
            attendanceId: updatedAttendance?.id ?? i.attendanceId,
            submissionText: null,
            submissionFileUrl: null,
            submissionFileName: null,
            submissionFileSize: null,
            submittedAt: null,
            isLateSubmission: false,
            status: nextStatus
          };
        })
      );
      setSubmittingItem((prev) => prev && prev.sessionId === item.sessionId ? {
        ...prev,
        attendanceId: updatedAttendance?.id ?? prev.attendanceId,
        submissionText: null,
        submissionFileUrl: null,
        submissionFileName: null,
        submissionFileSize: null,
        submittedAt: null,
        isLateSubmission: false,
        status: nextStatus
      } : prev);
      setSubmissionText('');
      setSubmissionFileUrl('');
      setSubmissionFile(null);
      setSubmitSuccess('Đã gỡ bài nộp hiện tại. File S3 cũ sẽ được dọn sau khi cập nhật thành công.');
    } catch (err) {
      console.error('Remove homework submission failed:', err);
      alert(err.message || 'Không thể gỡ bài nộp. Vui lòng thử lại.');
    } finally {
      setSubmittingLoading(false);
    }
  };

  const handleDownloadMySubmission = async (sessionId, attendanceId) => {
    setDownloadingSubmissionSessionId(sessionId);
    try {
      const res = await classApi.getSubmissionDownloadUrl(sessionId, attendanceId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err?.message || 'Không thể tải bài làm đã nộp.');
    } finally {
      setDownloadingSubmissionSessionId(null);
    }
  };

  return (
    <StudentPageScaffold
      eyebrow="Bài tập & Tài liệu buổi học"
      title="Quản lý bài tập của tôi"
      description="Theo dõi bài tập theo từng lớp, từng buổi học, hoàn thành và nộp bài đúng hạn, đồng thời nhận điểm số và phản hồi chi tiết từ gia sư."
    >
      <div className="space-y-6">
        {/* 1. Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900">{stats.total}</div>
              <div className="text-[11px] font-semibold text-slate-500">Tổng bài tập</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-amber-600">{stats.todo}</div>
              <div className="text-[11px] font-semibold text-slate-500">Cần nộp (Còn hạn)</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-indigo-600">{stats.submitted}</div>
              <div className="text-[11px] font-semibold text-slate-500">Đã nộp chờ chấm</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-emerald-600">{stats.graded}</div>
              <div className="text-[11px] font-semibold text-slate-500">Đã chấm điểm</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-red-600">{stats.overdue}</div>
              <div className="text-[11px] font-semibold text-slate-500">Quá hạn nộp</div>
            </div>
          </div>
        </div>

        {/* 2. Filter & Search Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="min-w-[180px]">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">Tất cả lớp học ({classOptions.length})</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="TODO">Cần làm (Còn hạn)</option>
                <option value="SUBMITTED">Đã nộp chờ chấm</option>
                <option value="LATE_SUBMITTED">Đã nộp muộn</option>
                <option value="GRADED">Đã chấm điểm</option>
                <option value="OVERDUE">Quá hạn nộp</option>
                <option value="CLOSED">Đã đóng hạn nộp</option>
                <option value="NO_SUBMISSION_REQUIRED">Không yêu cầu nộp</option>
                <option value="LOCKED">Chưa mở khóa (Chưa điểm danh)</option>
              </select>
            </div>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo lớp, buổi, tên bài..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* 3. Items List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
            <p className="text-sm font-bold">Đang tải danh sách bài tập của bạn...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 font-bold text-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <StudentEmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="Không có bài tập nào"
            description="Bạn hiện không có bài tập nào phù hợp với bộ lọc tìm kiếm. Hãy chọn lớp học để xem lịch học và bài tập."
            actionTo="/my-classes"
            actionLabel="Vào lớp học của tôi"
          />
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isLocked = item.status === 'LOCKED';
              const isGraded = item.status === 'GRADED';
              const isSubmitted = item.status === 'SUBMITTED';
              const isLateSubmitted = item.status === 'LATE_SUBMITTED' || item.isLateSubmission;
              const isOverdue = item.status === 'OVERDUE';
              const isClosed = item.status === 'CLOSED' || item.submissionBlockedByDeadline;
              const isPracticeOnly = item.status === 'NO_SUBMISSION_REQUIRED' || item.submissionRequired === false;
              const hasDue = Boolean(item.assignmentDueAt);
              const hasCurrentSubmission = hasSubmission(item);
              const canRemoveSubmission = hasCurrentSubmission && canMutateSubmission(item);

              return (
                <div
                  key={item.sessionId}
                  className={`bg-white rounded-xl border p-5 transition shadow-sm ${
                    isLocked
                      ? 'border-slate-200 bg-slate-50/50'
                      : isGraded
                      ? 'border-emerald-200 hover:shadow-md'
                      : isOverdue || isClosed || isLateSubmitted
                      ? 'border-red-200 hover:shadow-md'
                      : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left: Session and Homework info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
                          {item.classTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                          Buổi #{item.sequenceNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.sessionDate} ({item.startTime} - {item.endTime})
                        </span>
                        {item.tutorName && (
                          <span className="text-xs font-medium text-slate-500">
                            • Gia sư: <strong className="text-slate-700">{item.tutorName}</strong>
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                          {item.assignmentTitle || (
                            <span className="text-slate-500 italic">
                              Bài tập buổi học: {item.topic || 'Chưa cập nhật tên bài'}
                            </span>
                          )}
                        </h3>
                      </div>

                      {/* GATED ACCESS WARNING */}
                      {isLocked ? (
                        <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Nội dung bài tập và tài liệu buổi học đang bị khóa</p>
                            <p className="mt-0.5 text-amber-700 font-medium">
                              Theo quy định lớp học, bạn cần tham gia và thực hiện <strong>điểm danh vào học</strong> trong khung giờ học của buổi này để mở khóa xem đề bài, tải tài liệu và nộp bài.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Assignment description */}
                          {item.assignmentDescription && (
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {item.assignmentDescription}
                            </p>
                          )}

                          {/* Assignment file & Materials download links */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            {/* S3 Assignment files */}
                            {item.assignmentFiles && item.assignmentFiles.length > 0 && item.assignmentFiles.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => handleDownloadSessionFile(item.sessionId, file.id)}
                                disabled={downloadingFileId === file.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition border border-blue-200"
                              >
                                {downloadingFileId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-600" />}
                                <span>{file.fileName}</span>
                                <span className="text-[10px] text-blue-500 font-normal">({formatFileSize(file.fileSize)})</span>
                              </button>
                            ))}

                            {/* S3 Material files (Slides) */}
                            {item.materialFiles && item.materialFiles.length > 0 && item.materialFiles.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => handleDownloadSessionFile(item.sessionId, file.id)}
                                disabled={downloadingFileId === file.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition border border-emerald-200"
                              >
                                {downloadingFileId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5 text-emerald-600" />}
                                <span>{file.fileName}</span>
                                <span className="text-[10px] text-emerald-500 font-normal">({formatFileSize(file.fileSize)})</span>
                              </button>
                            ))}

                            {/* Auxiliary external links */}
                            {(item.assignmentExternalUrl || (!item.assignmentFiles?.length && item.assignmentFileUrl)) && (
                              <a
                                href={item.assignmentExternalUrl || item.assignmentFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 transition border border-slate-200"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Link bài tập ngoài
                              </a>
                            )}
                            {(item.materialExternalUrl || (!item.materialFiles?.length && item.materialUrl)) && (
                              <a
                                href={item.materialExternalUrl || item.materialUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 transition border border-slate-200"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Link slide ngoài
                              </a>
                            )}

                            {hasDue && (
                              <span className={`inline-flex items-center gap-1 font-bold ${isOverdue || isClosed || isLateSubmitted ? 'text-red-600' : 'text-slate-500'}`}>
                                <Clock className="w-3.5 h-3.5" />
                                Hạn nộp: {new Date(item.assignmentDueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            )}
                            {item.lateSubmissionAllowed === false && item.submissionRequired !== false && (
                              <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                                Không nhận bài trễ
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {/* TUTOR GRADE & FEEDBACK CARD */}
                      {isGraded && (
                        <div className="mt-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-emerald-800 flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-emerald-600" />
                              Kết quả chấm điểm từ Gia sư
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-sm">
                              {item.gradeScore}
                            </span>
                          </div>

                          {item.tutorFeedback && (
                            <div className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-emerald-100 leading-relaxed">
                              <span className="font-bold text-slate-900 block mb-1">Nhận xét của gia sư:</span>
                              {item.tutorFeedback}
                            </div>
                          )}

                          {item.gradedAt && (
                            <div className="text-[11px] text-emerald-700/80 font-medium">
                              Chấm lúc: {new Date(item.gradedAt).toLocaleString('vi-VN')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Student submitted info preview */}
                      {(isSubmitted || isGraded) && item.submittedAt && (
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Đã nộp lúc: {new Date(item.submittedAt).toLocaleString('vi-VN')}
                          </span>

                          {item.submissionFileName && (
                            <button
                              type="button"
                              onClick={() => handleDownloadMySubmission(item.sessionId, item.attendanceId)}
                              disabled={!item.attendanceId || downloadingSubmissionSessionId === item.sessionId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition border border-blue-200"
                            >
                              {downloadingSubmissionSessionId === item.sessionId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>Bài nộp: {item.submissionFileName} ({formatFileSize(item.submissionFileSize)})</span>
                            </button>
                          )}

                          {item.submissionFileUrl && (
                            <a
                              href={item.submissionFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 font-bold hover:underline"
                            >
                              (Link ngoài đã gửi)
                            </a>
                          )}
                          {isLateSubmitted && (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-black text-[10px]">
                              NỘP MUỘN
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Status badge & Action buttons */}
                    <div className="flex flex-col sm:items-end justify-between gap-3 lg:border-l lg:pl-5 border-slate-100 min-w-[200px]">
                      <div>
                        {isLocked ? (
                          <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Chưa mở khóa
                          </span>
                        ) : isGraded ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-emerald-600" /> Đã chấm điểm
                          </span>
                        ) : isLateSubmitted ? (
                          <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Đã nộp muộn
                          </span>
                        ) : isSubmitted ? (
                          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center gap-1">
                            <FileCheck className="w-3.5 h-3.5 text-indigo-600" /> Đã nộp (Chờ chấm)
                          </span>
                        ) : isPracticeOnly ? (
                          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> Không yêu cầu nộp
                          </span>
                        ) : isClosed ? (
                          <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Đã đóng hạn nộp
                          </span>
                        ) : isOverdue ? (
                          <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Quá hạn nộp
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Cần làm bài
                          </span>
                        )}
                      </div>

                      {!isLocked && (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleOpenSubmit(item)}
                            disabled={isPracticeOnly || isClosed}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm ${
                              isPracticeOnly || isClosed
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : isGraded
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : isSubmitted || isLateSubmitted
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-primary hover:bg-primary/90 text-white'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {isPracticeOnly ? 'Không cần nộp' : isClosed ? 'Đã đóng hạn' : isGraded ? 'Xem bài đã nộp' : (isSubmitted || isLateSubmitted) ? 'Cập nhật bài nộp' : 'Nộp bài tập'}
                          </button>

                          {canRemoveSubmission && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSubmission(item)}
                              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Gỡ bài nộp
                            </button>
                          )}

                          <Link
                            to={`/my-classes?classId=${item.classRoomId}`}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold text-center transition"
                          >
                            Vào chi tiết lớp học
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MODAL: Nộp bài tập của học viên */}
      {submittingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-primary uppercase">Nộp bài tập về nhà</div>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  Buổi #{submittingItem.sequenceNumber} - {submittingItem.assignmentTitle || submittingItem.topic}
                </h3>
              </div>
              <button
                onClick={() => setSubmittingItem(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* S3 file picker */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  File bài làm đính kèm (Lưu trữ AWS S3) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="file"
                  onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {submissionFile ? (
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã chọn: {submissionFile.name} ({formatFileSize(submissionFile.size)})
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Hỗ trợ file PDF, Word, Excel, hình ảnh, mã nguồn hoặc file nén .ZIP/.RAR.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung trả lời / Lời giải / Ghi chú (Tùy chọn):
                </label>
                <textarea
                  rows={3}
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Nhập câu trả lời, ghi chú giải bài hoặc nội dung tóm tắt..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Link bài làm ngoài bổ sung (Google Drive / GitHub nếu có - Tùy chọn):
                </label>
                <input
                  type="text"
                  value={submissionFileUrl}
                  onChange={(e) => setSubmissionFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc link dự phòng"
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-slate-800"
                />
              </div>

              {hasSubmission(submittingItem) && (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Bài nộp hiện tại
                  </div>
                  {submittingItem.submittedAt && (
                    <div>Đã nộp lúc: {new Date(submittingItem.submittedAt).toLocaleString('vi-VN')}</div>
                  )}
                  {submittingItem.submissionFileName && (
                    <div>File S3: {submittingItem.submissionFileName} ({formatFileSize(submittingItem.submissionFileSize)})</div>
                  )}
                  {submittingItem.submissionFileUrl && (
                    <a href={submittingItem.submissionFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Link ngoài đã gửi
                    </a>
                  )}
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {submitSuccess}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubmittingItem(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSubmitHomework}
                disabled={submittingLoading || !canMutateSubmission(submittingItem)}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {submittingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentPageScaffold>
  );
}
