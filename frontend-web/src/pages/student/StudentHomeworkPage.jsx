import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
  XCircle,
  Download,
  MessageSquare,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

export function StudentHomeworkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlClassId = searchParams.get('classId');
  const urlSessionId = searchParams.get('sessionId');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState(urlClassId || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active submission modal state
  const [submittingItem, setSubmittingItem] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submittingLoading, setSubmittingLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [downloadingSubmissionSessionId, setDownloadingSubmissionSessionId] = useState(null);

  const highlightedRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getRemainingTimeBadge = (dueAtStr, isSubmitted, isLate) => {
    if (!dueAtStr) return null;
    const now = new Date();
    const due = new Date(dueAtStr);
    const diffMs = due.getTime() - now.getTime();

    if (diffMs < 0) {
      return {
        label: isSubmitted ? (isLate ? 'Đã nộp muộn' : 'Hết hạn nộp') : 'Đã quá hạn',
        className: 'bg-rose-100 text-rose-800 border-rose-200',
        isOverdue: true
      };
    }

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 0) {
      return {
        label: `Còn ${diffDays} ngày ${diffHrs % 24} giờ`,
        className: diffDays <= 1 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-900 border-blue-200',
        isOverdue: false
      };
    }

    if (diffHrs > 0) {
      return {
        label: `Còn ${diffHrs} giờ ${diffMins} phút`,
        className: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
        isOverdue: false
      };
    }

    return {
      label: `Còn ${diffMins} phút (Sắp hết hạn!)`,
      className: 'bg-rose-100 text-rose-900 border-rose-300 animate-bounce',
      isOverdue: false
    };
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
      
      // Filter out empty sessions where tutor has NOT assigned any homework or material
      const validList = list.filter((item) => {
        const hasTitle = Boolean(item.assignmentTitle && item.assignmentTitle.trim() && !item.assignmentTitle.startsWith('Buổi học #') && item.assignmentTitle !== `Buổi #${item.sequenceNumber}`);
        const hasDesc = Boolean(item.assignmentDescription && item.assignmentDescription.trim());
        const hasFiles = Boolean(item.assignmentFiles && item.assignmentFiles.length > 0);
        const hasExternal = Boolean(item.assignmentExternalUrl || item.assignmentFileUrl);
        const hasMaterials = Boolean(item.materialFiles && item.materialFiles.length > 0);
        const hasMaterialNote = Boolean(item.materialDescription && item.materialDescription.trim());
        const hasMaterialExt = Boolean(item.materialExternalUrl || item.materialUrl);
        const hasSubmitted = Boolean(item.submittedAt || item.submissionText || item.submissionFileUrl || item.submissionFileName);
        return hasTitle || hasDesc || hasFiles || hasExternal || hasMaterials || hasMaterialNote || hasMaterialExt || hasSubmitted;
      });

      setItems(validList);

      // If urlSessionId exists, auto open or scroll to that item
      if (urlSessionId) {
        const target = validList.find((i) => String(i.sessionId) === String(urlSessionId));
        if (target && target.studentCheckedIn !== false) {
          setSubmittingItem(target);
          setSubmissionText(target.submissionText || '');
          setSubmissionFileUrl(target.submissionFileUrl || target.submissionExternalUrl || '');
        }
      }
    } catch (err) {
      console.error('Failed to load student homework overview:', err);
      setError('Không thể tải danh sách bài tập. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Sync selected class when URL param changes
  useEffect(() => {
    if (urlClassId) {
      setSelectedClassId(urlClassId);
    }
  }, [urlClassId]);

  // Auto scroll to target session when navigating from classroom timeline
  useEffect(() => {
    if (urlSessionId && !loading && items.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`homework-session-${urlSessionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [urlSessionId, loading, items]);

  // Distinct classes list for filter
  const classOptions = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.classRoomId)) {
        map.set(item.classRoomId, {
          id: item.classRoomId,
          title: item.classTitle || `Lớp #${item.classRoomId}`,
          count: 0
        });
      }
      map.get(item.classRoomId).count += 1;
    });
    return Array.from(map.values());
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedClassId !== 'ALL' && String(item.classRoomId) !== String(selectedClassId)) {
        return false;
      }
      if (selectedStatus === 'TODO') {
        if (item.status !== 'TODO' && item.status !== 'OVERDUE') return false;
      } else if (selectedStatus === 'SUBMITTED') {
        if (item.status !== 'SUBMITTED' && item.status !== 'LATE_SUBMITTED') return false;
      } else if (selectedStatus === 'GRADED') {
        if (item.status !== 'GRADED' && !item.gradeScore) return false;
      } else if (selectedStatus === 'OVERDUE') {
        if (item.status !== 'OVERDUE' && item.status !== 'CLOSED') return false;
      } else if (selectedStatus === 'LOCKED') {
        if (item.studentCheckedIn !== false && item.status !== 'LOCKED') return false;
      } else if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.classTitle?.toLowerCase().includes(query);
        const matchTopic = item.topic?.toLowerCase().includes(query);
        const matchAssignment = item.assignmentTitle?.toLowerCase().includes(query);
        const matchDesc = item.assignmentDescription?.toLowerCase().includes(query);
        const matchTutor = item.tutorName?.toLowerCase().includes(query);
        if (!matchTitle && !matchTopic && !matchAssignment && !matchDesc && !matchTutor) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedClassId, selectedStatus, searchQuery]);

  // Statistics calculated from real assignments
  const stats = useMemo(() => {
    const total = items.length;
    const todo = items.filter((i) => (i.status === 'TODO') && i.studentCheckedIn !== false).length;
    const submitted = items.filter((i) => (i.status === 'SUBMITTED' || i.status === 'LATE_SUBMITTED') && !i.gradeScore).length;
    const graded = items.filter((i) => i.status === 'GRADED' || Boolean(i.gradeScore)).length;
    const overdue = items.filter((i) => (i.status === 'OVERDUE' || i.status === 'CLOSED') && !i.submittedAt).length;
    const locked = items.filter((i) => i.studentCheckedIn === false || i.status === 'LOCKED').length;
    return { total, todo, submitted, graded, overdue, locked };
  }, [items]);

  const handleOpenSubmit = (item) => {
    setSubmittingItem(item);
    setSubmissionText(item.submissionText || '');
    setSubmissionFileUrl(item.submissionFileUrl || item.submissionExternalUrl || '');
    setSubmissionFile(null);
    setSubmitSuccess(null);
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
      alert('Vui lòng chọn file, dán link GitHub/Google Drive hoặc nhập nội dung bài làm.');
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

      setSubmitSuccess('Nộp bài tập thành công!');
      setTimeout(() => {
        setSubmittingItem(null);
        setSubmitSuccess(null);
        setSubmissionFile(null);
      }, 1200);
    } catch (err) {
      console.error('Submit homework failed:', err);
      alert(err.message || 'Không thể nộp bài tập. Vui lòng thử lại.');
    } finally {
      setSubmittingLoading(false);
    }
  };

  const handleDeleteSubmissionFile = async () => {
    if (!submittingItem) return;
    if (!window.confirm('Bạn có chắc chắn muốn gỡ toàn bộ bài làm đã nộp không? File và ghi chú đã gửi sẽ được dọn dẹp sạch sẽ.')) return;
    setSubmittingLoading(true);
    try {
      await classApi.deleteHomeworkSubmission(submittingItem.sessionId);
      setItems((prev) =>
        prev.map((i) => {
          if (i.sessionId !== submittingItem.sessionId) return i;
          return {
            ...i,
            submissionFileName: null,
            submissionFileSize: null,
            submissionFileUrl: null,
            submissionText: null,
            submittedAt: null,
            status: 'TODO',
            isLateSubmission: false
          };
        })
      );
      setSubmittingItem((prev) => ({
        ...prev,
        submissionFileName: null,
        submissionFileSize: null,
        submissionFileUrl: null,
        submissionText: null,
        submittedAt: null,
        status: 'TODO'
      }));
      setSubmissionFile(null);
      setSubmissionFileUrl('');
      setSubmissionText('');
      alert('Đã gỡ bài làm đã nộp thành công.');
    } catch (err) {
      alert(err?.message || 'Không thể gỡ bài nộp.');
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
      description="Theo dõi tất cả bài tập do gia sư giao theo từng buổi học, mở khóa khi điểm danh có mặt, theo dõi hạn chót và xem kết quả chấm điểm cùng nhận xét chi tiết."
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/my-classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 shadow-sm transition-all"
          >
            <BookOpen size={16} />
            <span>Lớp học của tôi</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 1. Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`p-4 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
              selectedStatus === 'ALL' ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">{stats.total}</div>
                <div className="text-[11px] font-bold text-slate-500">Tổng bài đã giao</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('TODO')}
            className={`p-4 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
              selectedStatus === 'TODO' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-slate-200 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-amber-600">{stats.todo}</div>
                <div className="text-[11px] font-bold text-slate-500">Cần nộp (Còn hạn)</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('SUBMITTED')}
            className={`p-4 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
              selectedStatus === 'SUBMITTED' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-blue-600">{stats.submitted}</div>
                <div className="text-[11px] font-bold text-slate-500">Đã nộp chờ chấm</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('GRADED')}
            className={`p-4 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
              selectedStatus === 'GRADED' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-600">{stats.graded}</div>
                <div className="text-[11px] font-bold text-slate-500">Đã chấm điểm</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('OVERDUE')}
            className={`p-4 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
              selectedStatus === 'OVERDUE' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' : 'bg-white border-slate-200 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-rose-600">{stats.overdue}</div>
                <div className="text-[11px] font-bold text-slate-500">Quá hạn nộp</div>
              </div>
            </div>
          </button>
        </div>

        {/* 2. Filter Tabs by Class & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          {/* Class Select Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
              Chọn Lớp:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedClassId('ALL');
                setSearchParams({});
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedClassId === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Tất cả bài tập ({items.length})
            </button>

            {classOptions.map((c) => {
              const isSelected = String(c.id) === String(selectedClassId);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClassId(String(c.id));
                    setSearchParams({ classId: c.id });
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[200px]">{c.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.count} bài
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Status filters */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">
                Trạng thái:
              </span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="TODO">Cần làm (Còn hạn)</option>
                <option value="SUBMITTED">Đã nộp chờ chấm</option>
                <option value="GRADED">Đã chấm điểm</option>
                <option value="OVERDUE">Quá hạn nộp</option>
                <option value="LOCKED">Chưa mở khóa (Chưa điểm danh)</option>
              </select>
            </div>

            <div className="relative sm:w-72 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo môn, tên bài, đề bài..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* 3. Items List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm font-bold">Đang tải danh sách bài tập của bạn...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 font-bold text-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <StudentEmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="Không có bài tập nào"
            description="Hiện tại các buổi học chưa có bài tập nào được giao hoặc không khớp với bộ lọc tìm kiếm."
            actionTo="/my-classes"
            actionLabel="Vào không gian lớp học của tôi"
          />
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isLocked = item.studentCheckedIn === false || item.status === 'LOCKED';
              const isGraded = item.status === 'GRADED' || Boolean(item.gradeScore);
              const isSubmitted = item.status === 'SUBMITTED';
              const isLateSubmitted = item.status === 'LATE_SUBMITTED' || item.isLateSubmission;
              const isOverdue = item.status === 'OVERDUE';
              const isClosed = item.status === 'CLOSED' || item.submissionBlockedByDeadline;
              const hasDue = Boolean(item.assignmentDueAt);
              const remainingTime = getRemainingTimeBadge(item.assignmentDueAt, isSubmitted || isLateSubmitted || isGraded, isLateSubmitted);
              const isHighlighted = urlSessionId && String(item.sessionId) === String(urlSessionId);
              const hasAssignmentContent = Boolean(
                item.assignmentTitle ||
                item.assignmentDescription ||
                item.assignmentFiles?.length ||
                item.assignmentExternalUrl ||
                item.assignmentFileUrl ||
                item.assignmentDueAt
              );
              const displayTitle = item.assignmentTitle
                || (hasAssignmentContent ? `Bài tập Buổi #${item.sequenceNumber}` : `Tài liệu Buổi #${item.sequenceNumber}`);

              return (
                <div
                  key={item.sessionId}
                  id={`homework-session-${item.sessionId}`}
                  className={`bg-white rounded-2xl border p-5 sm:p-6 transition shadow-xs ${
                    isHighlighted
                      ? 'ring-4 ring-blue-400/30 border-blue-400 shadow-md'
                      : isLocked
                      ? 'border-slate-200 bg-slate-50/60'
                      : isGraded
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : isOverdue || isClosed
                      ? 'border-rose-200 hover:border-rose-300'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    {/* Left: Session and Homework info */}
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
                          {item.classTitle}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-black">
                          Buổi #{item.sequenceNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {item.sessionDate} ({item.startTime} - {item.endTime})
                        </span>
                        {item.tutorName && (
                          <span className="text-xs font-semibold text-slate-500">
                            • Gia sư: <strong className="text-slate-800">{item.tutorName}</strong>
                          </span>
                        )}
                      </div>

                      {/* Title & Deadline badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 font-display flex items-center gap-2">
                          {hasAssignmentContent ? (
                            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                          ) : (
                            <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          <span>{displayTitle}</span>
                        </h3>

                        {remainingTime && (
                          <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shadow-2xs ${remainingTime.className}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{remainingTime.label}</span>
                          </span>
                        )}
                      </div>

                      {/* GATED ACCESS / UNLOCKED CONTENT */}
                      {isLocked ? (
                        <div className="mt-3 p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
                          <div className="p-2 rounded-xl bg-amber-200/80 text-amber-800 shrink-0 mt-0.5">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-sm text-amber-950">
                              Nội dung bài tập và tài liệu buổi học đang bị khóa
                            </p>
                            <p className="mt-1 text-amber-800 leading-relaxed font-medium">
                              Theo quy định lớp học, bạn cần tham gia và thực hiện <strong>điểm danh vào học</strong> trong khung giờ ({item.startTime} - {item.endTime} ngày {item.sessionDate}) để mở khóa xem đề bài, tải tài liệu và nộp bài tập.
                            </p>
                            <div className="mt-2.5">
                              <Link
                                to={`/my-classes?classId=${item.classRoomId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-xs"
                              >
                                <span>Vào phòng học để điểm danh</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          {/* 1. Assignment Description */}
                          {item.assignmentDescription && (
                            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 text-xs shadow-2xs">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Nội dung đề bài & hướng dẫn:</span>
                              </div>
                              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                                {item.assignmentDescription}
                              </p>
                            </div>
                          )}

                          {/* 2. Files & Auxiliary Links */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            {/* Assignment files */}
                            {item.assignmentFiles && item.assignmentFiles.length > 0 && item.assignmentFiles.map((file) => (
                              <div
                                key={file.id}
                                className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 font-bold border border-blue-200 shadow-2xs hover:border-blue-300 transition"
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="truncate">{file.fileName}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">({formatFileSize(file.fileSize)})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSessionFile(item.sessionId, file.id)}
                                  disabled={downloadingFileId === file.id}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                >
                                  {downloadingFileId === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  <span>Tải về</span>
                                </button>
                              </div>
                            ))}

                            {/* Material files (Slides) */}
                            {item.materialFiles && item.materialFiles.length > 0 && item.materialFiles.map((file) => (
                              <div
                                key={file.id}
                                className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-slate-800 font-bold border border-emerald-200 shadow-2xs hover:border-emerald-300 transition"
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{file.fileName}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">({formatFileSize(file.fileSize)})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSessionFile(item.sessionId, file.id)}
                                  disabled={downloadingFileId === file.id}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                >
                                  {downloadingFileId === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  <span>Tải Slide</span>
                                </button>
                              </div>
                            ))}

                            {/* External Links */}
                            {(item.assignmentExternalUrl || (!item.assignmentFiles?.length && item.assignmentFileUrl)) && (
                              <a
                                href={item.assignmentExternalUrl || item.assignmentFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition border border-blue-200 shadow-2xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Link đề bài ngoài</span>
                              </a>
                            )}
                            {(item.materialExternalUrl || (!item.materialFiles?.length && item.materialUrl)) && (
                              <a
                                href={item.materialExternalUrl || item.materialUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-xs"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Slide link ngoài</span>
                                <ExternalLink className="w-3 h-3 ml-0.5" />
                              </a>
                            )}

                            {hasDue && (
                              <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Hạn nộp: {new Date(item.assignmentDueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </span>
                            )}
                          </div>

                          {/* 3. Tutor Lecture Notes (Slide Notes) */}
                          {item.materialDescription && (
                            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs flex items-start gap-2 text-amber-950">
                              <MessageSquare className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-[11px] uppercase text-amber-900 block">
                                  Ghi chú bài giảng từ gia sư:
                                </span>
                                <p className="font-semibold mt-0.5 italic leading-relaxed">
                                  "{item.materialDescription}"
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 4. Tutor Grade & Feedback */}
                          {isGraded && (
                            <div className="p-4 bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-100 border border-emerald-300 rounded-xl space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase text-emerald-900 flex items-center gap-1.5">
                                  <Award className="w-4 h-4 text-emerald-700" />
                                  Kết quả chấm điểm từ Gia sư:
                                </span>
                                <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-black text-sm shadow-xs">
                                  Điểm: {item.gradeScore}
                                </span>
                              </div>

                              {item.tutorFeedback && (
                                <div className="text-xs text-slate-800 bg-white/95 p-3 rounded-lg border border-emerald-200 font-medium leading-relaxed">
                                  <span className="font-bold text-slate-900 block mb-0.5">Nhận xét của gia sư:</span>
                                  "{item.tutorFeedback}"
                                </div>
                              )}

                              {item.gradedAt && (
                                <div className="text-[11px] text-emerald-800 font-semibold">
                                  Đã chấm lúc: {new Date(item.gradedAt).toLocaleString('vi-VN')}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 5. Student Submitted Preview */}
                          {(isSubmitted || isLateSubmitted || isGraded) && item.submittedAt && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                              <div className="flex items-center gap-1.5 font-black text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Bạn đã hoàn thành nộp bài tập</span>
                                <span className="font-normal text-slate-500 text-[11px]">
                                  (lúc {new Date(item.submittedAt).toLocaleString('vi-VN')})
                                </span>
                                {isLateSubmitted && (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[10px]">
                                    NỘP MUỘN
                                  </span>
                                )}
                              </div>

                              {item.submissionText && (
                                <p className="text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200">
                                  "{item.submissionText}"
                                </p>
                              )}

                              {item.submissionFileName && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadMySubmission(item.sessionId, item.attendanceId)}
                                    disabled={!item.attendanceId || downloadingSubmissionSessionId === item.sessionId}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition border border-blue-200"
                                  >
                                    {downloadingSubmissionSessionId === item.sessionId ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5 text-blue-600" />
                                    )}
                                    <span>Tải file bài làm đã nộp: {item.submissionFileName} ({formatFileSize(item.submissionFileSize)})</span>
                                  </button>
                                </div>
                              )}

                              {item.submissionFileUrl && (
                                <div>
                                  <a
                                    href={item.submissionFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Link bài làm ngoài đã nộp</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Status badge & Action buttons */}
                    <div className="flex flex-col sm:items-end justify-between gap-3 lg:border-l lg:pl-5 border-slate-100 min-w-[200px] shrink-0">
                      <div>
                        {isLocked ? (
                          <span className="px-3 py-1.5 rounded-full bg-slate-200 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Chưa mở khóa
                          </span>
                        ) : isGraded ? (
                          <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black inline-flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-emerald-600" /> Đã chấm điểm
                          </span>
                        ) : isLateSubmitted ? (
                          <span className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black inline-flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Đã nộp muộn
                          </span>
                        ) : isSubmitted ? (
                          <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black inline-flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-blue-600" /> Đã nộp chờ chấm
                          </span>
                        ) : isClosed ? (
                          <span className="px-3 py-1.5 rounded-full bg-slate-200 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Đã đóng hạn nộp
                          </span>
                        ) : isOverdue ? (
                          <span className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black inline-flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Quá hạn nộp
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Cần làm bài
                          </span>
                        )}
                      </div>

                      {!isLocked ? (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenSubmit(item)}
                            disabled={isClosed}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 ${
                              isClosed
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : isGraded
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                                : isSubmitted || isLateSubmitted
                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300'
                            }`}
                          >
                            <UploadCloud className="w-4 h-4" />
                            <span>
                              {isClosed
                                ? 'Đã đóng hạn'
                                : isGraded
                                ? 'Xem bài đã nộp'
                                : isSubmitted || isLateSubmitted
                                ? 'Sửa / Nộp lại bài'
                                : 'Nộp bài tập ngay'}
                            </span>
                          </button>

                          <Link
                            to={`/my-classes?classId=${item.classRoomId}`}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 text-center transition border border-slate-200 flex items-center justify-center gap-1"
                          >
                            <span>Xem buổi học ở lớp</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ) : (
                        <Link
                          to={`/my-classes?classId=${item.classRoomId}`}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Đến lớp học</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Homework Submission Modal */}
      {submittingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                  {submittingItem.classTitle} • Buổi #{submittingItem.sequenceNumber}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 font-display">
                  Nộp Bài Tập: {submittingItem.assignmentTitle || `Buổi #${submittingItem.sequenceNumber}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubmittingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-black text-emerald-900 text-sm">{submitSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {submittingItem.assignmentDescription && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-600 block mb-0.5">Yêu cầu đề bài:</span>
                    <p className="text-slate-800 leading-relaxed">{submittingItem.assignmentDescription}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. File bài làm đính kèm:
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setSubmissionFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer bg-slate-50 p-1.5 rounded-xl border border-slate-200"
                  />
                  {submissionFile && (
                    <p className="text-emerald-700 font-bold mt-1.5 flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>File mới đã chọn: <strong>{submissionFile.name}</strong> ({formatFileSize(submissionFile.size)})</span>
                    </p>
                  )}
                  {submittingItem.submissionFileName && !submissionFile && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 mt-1.5 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate font-semibold text-slate-800">
                          {submittingItem.submissionFileName}
                        </span>
                        {submittingItem.submissionFileSize && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({formatFileSize(submittingItem.submissionFileSize)})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteSubmissionFile}
                        className="text-rose-600 hover:text-rose-800 font-bold text-xs flex items-center gap-1 shrink-0 ml-2 px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 bg-white transition cursor-pointer"
                        title="Gỡ bỏ bài nộp này"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Gỡ file</span>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Link bài làm bổ sung (GitHub / Google Drive / Figma / CodeSandbox):
                  </label>
                  <input
                    type="text"
                    value={submissionFileUrl}
                    onChange={(e) => setSubmissionFileUrl(e.target.value)}
                    placeholder="https://github.com/... hoặc https://drive.google.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Ghi chú / Nội dung bài làm trực tiếp:
                  </label>
                  <textarea
                    rows={3}
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Nhập câu trả lời, lời nhắn cho gia sư..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittingItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={submittingLoading}
                    onClick={handleSubmitHomework}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    {submittingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    <span>{hasSubmission(submittingItem) ? 'Cập Nhật Bài Nộp' : 'Xác Nhận Nộp Bài'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </StudentPageScaffold>
  );
}
