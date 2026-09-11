import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Video,
  Wallet,
  FileText,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  Filter
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { useFeedback } from '../../components/feedback/useFeedback';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';
import { ClassSessionsTimeline } from '../../components/classroom/ClassSessionsTimeline';

const STATUS_META = {
  ENROLLED: { label: 'Đang học', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Đang chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED: { label: 'Đã chấp nhận (Cần nạp cọc)', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

const DAY_LABELS = {
  1: 'Chủ Nhật',
  2: 'Thứ Hai',
  3: 'Thứ Ba',
  4: 'Thứ Tư',
  5: 'Thứ Năm',
  6: 'Thứ Sáu',
  7: 'Thứ Bảy'
};

export function StudentMyClassesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const feedback = useFeedback();

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const data = await classApi.getMyEnrollmentRequests();
      setRequests(normalizeRequests(data));
    } catch (err) {
      setError(err?.message || 'Không thể tải yêu cầu học của bạn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useRealtimeRefresh(['ENROLLMENT_ACCEPTED', 'ENROLLMENT_REJECTED', 'AGREEMENT_FUNDED'], loadRequests);

  const stats = useMemo(() => {
    return requests.reduce((acc, item) => {
      const status = normalizeStatus(item.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const status = normalizeStatus(req.status);
      const matchFilter =
        activeFilter === 'ALL' ||
        (activeFilter === 'HISTORY' ? (status === 'CANCELLED' || status === 'REJECTED') : status === activeFilter);

      if (!matchFilter) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const name = (req.className || '').toLowerCase();
      const tutor = (req.tutorEmail || '').toLowerCase();
      const note = (req.note || '').toLowerCase();
      return name.includes(query) || tutor.includes(query) || note.includes(query);
    });
  }, [requests, activeFilter, searchQuery]);

  async function handleCancel(requestId) {
    const accepted = await feedback.confirm({
      title: 'Hủy yêu cầu học?',
      message: 'Bạn có chắc muốn hủy yêu cầu tham gia lớp này?',
      confirmText: 'Hủy yêu cầu',
      cancelText: 'Giữ lại',
      variant: 'destructive'
    });
    if (!accepted) return;
    setCancellingId(requestId);
    setError('');
    try {
      await classApi.cancelEnrollmentRequest(requestId);
      await loadRequests();
      feedback.success('Đã hủy yêu cầu học.');
    } catch (err) {
      setError(err?.message || 'Không thể hủy yêu cầu học này.');
      feedback.error(err?.message || 'Không thể hủy yêu cầu học này.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <StudentPageScaffold
      eyebrow="Student Web"
      title="Lớp học của tôi"
      description="Theo dõi các lớp đang học, xem lịch học cuốn chiếu, làm bài tập về nhà và điểm danh trong đúng khung giờ để nhận giải ngân minh bạch từ Smart Contract Escrow."
      actions={
        <div className="flex items-center gap-2.5">
          <Link
            to="/tutors"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:border-primary/40 hover:text-primary shadow-xs"
          >
            <Search size={16} />
            Tìm gia sư
          </Link>
          <Link
            to="/classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-primary shadow-xs"
          >
            <BookOpen size={16} />
            Tìm lớp mới
          </Link>
        </div>
      }
    >
      {/* 1. Quick Stats Row */}
      <section className="grid gap-3 sm:grid-cols-5">
        {['ENROLLED', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'].map((status) => (
          <StatCard
            key={status}
            status={status}
            value={stats[status] || 0}
            active={activeFilter === status}
            onClick={() => setActiveFilter(activeFilter === status ? 'ALL' : status)}
          />
        ))}
      </section>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ENROLLED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'ENROLLED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Đang học ({stats['ENROLLED'] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Chờ duyệt ({stats['PENDING'] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ACCEPTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'ACCEPTED'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Cần nạp cọc ({stats['ACCEPTED'] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('HISTORY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              activeFilter === 'HISTORY'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History size={13} />
            <span>Lịch sử cũ ({(stats['CANCELLED'] || 0) + (stats['REJECTED'] || 0)})</span>
          </button>
        </div>

        {/* Search box */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên lớp, gia sư..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Class List */}
      {loading ? (
        <section className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="inline-flex items-center gap-3 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Đang tải danh sách lớp học của bạn...
          </div>
        </section>
      ) : filteredRequests.length > 0 ? (
        <section className="grid gap-5">
          {filteredRequests.map((request) => (
            <EnrollmentRequestCard
              key={request.id}
              request={request}
              cancelling={cancellingId === request.id}
              onCancel={handleCancel}
            />
          ))}
        </section>
      ) : (
        <StudentEmptyState
          icon={<BookOpen size={24} />}
          title={searchQuery ? "Không tìm thấy lớp học phù hợp" : "Chưa có lớp học nào trong mục này"}
          description={searchQuery ? "Hãy thử tìm với từ khóa khác hoặc xóa bộ lọc." : "Khi bạn gửi yêu cầu học từ trang tìm lớp, trạng thái lớp và lịch học sẽ xuất hiện tại đây."}
          actionTo="/classes"
          actionLabel="Tìm lớp phù hợp"
        />
      )}
    </StudentPageScaffold>
  );
}

function StatCard({ status, value, active, onClick }) {
  const meta = STATUS_META[status] || { label: status, className: '' };
  return (
    <article
      onClick={onClick}
      className={`rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
        active
          ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-md'
          : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      <p className={`text-[11px] font-extrabold uppercase tracking-wider ${active ? 'text-slate-300' : 'text-slate-400'}`}>
        {meta.label}
      </p>
      <p className={`mt-1 font-display text-2xl font-black ${active ? 'text-white' : 'text-slate-950'}`}>
        {value}
      </p>
    </article>
  );
}

function EnrollmentRequestCard({ request, cancelling, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const [classroomDetails, setClassroomDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const status = normalizeStatus(request.status);
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  useEffect(() => {
    if (!request.classRoomId) return;
    let cancelled = false;
    setLoadingDetails(true);
    classApi
      .getPublicClassById(request.classRoomId)
      .then((room) => {
        if (!cancelled && room) {
          setClassroomDetails(room);
        }
      })
      .catch(() => {
        // Fallback gracefully if public details unavailable
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request.classRoomId]);

  const schedulesText = useMemo(() => {
    if (!classroomDetails?.schedules || classroomDetails.schedules.length === 0) return null;
    return classroomDetails.schedules
      .map((s) => `${DAY_LABELS[s.dayOfWeek] || `T${s.dayOfWeek}`}: ${s.startTime?.slice(0, 5)} - ${s.endTime?.slice(0, 5)}`)
      .join(' • ');
  }, [classroomDetails]);

  const meetingLink = classroomDetails?.meetingLink || '';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${meta.className}`}>
              {meta.label}
            </span>

            {status === 'ENROLLED' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Smart Contract Escrow Bảo Vệ
              </span>
            )}

            {request.createdAt && (
              <span className="text-xs font-medium text-slate-400">
                Gửi ngày {formatDateTime(request.createdAt)}
              </span>
            )}
          </div>

          <h2 className="mt-2.5 font-display text-xl font-bold tracking-tight text-slate-950">
            {request.className || `Lớp học #${request.classRoomId || request.id}`}
          </h2>

          {/* Quick Schedule & Class Info Grid */}
          <div className="mt-3 grid gap-2 text-xs font-medium text-slate-600 sm:grid-cols-2 lg:grid-cols-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
            {request.tutorEmail && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Gia sư:</span>
                <span className="font-semibold text-slate-800">{request.tutorEmail}</span>
              </div>
            )}

            {classroomDetails?.totalSessions && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Quy mô:</span>
                <span className="font-semibold text-slate-800">{classroomDetails.totalSessions} buổi học</span>
              </div>
            )}

            {classroomDetails?.pricePerSession !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Học phí:</span>
                <span className="font-bold text-indigo-700">{classroomDetails.pricePerSession} USDC / buổi</span>
              </div>
            )}

            {classroomDetails?.startDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">Bắt đầu:</span>
                <span className="font-semibold text-slate-800">{classroomDetails.startDate}</span>
              </div>
            )}

            {schedulesText && (
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0">Lịch học:</span>
                <span className="font-bold text-slate-800 truncate">{schedulesText}</span>
              </div>
            )}

            {request.note && (
              <div className="sm:col-span-2 lg:col-span-3 text-slate-500 italic">
                Ghi chú: {request.note}
              </div>
            )}

            {request.rejectReason && (
              <div className="sm:col-span-2 lg:col-span-3 text-red-600 font-semibold">
                Lý do từ chối: {request.rejectReason}
              </div>
            )}
          </div>
        </div>

        {/* Top Right Action (Cancel / Room Link) */}
        <div className="flex items-center gap-2 self-start shrink-0">
          {status === 'PENDING' && (
            <button
              type="button"
              onClick={() => onCancel(request.id)}
              disabled={cancelling}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Hủy yêu cầu
            </button>
          )}

          {status === 'ENROLLED' && meetingLink && (
            <a
              href={meetingLink.startsWith('http') ? meetingLink : `https://${meetingLink}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs font-bold text-white transition-all shadow-xs"
            >
              <Video size={14} />
              Vào phòng học
              <ExternalLink size={12} className="opacity-80" />
            </a>
          )}
        </div>
      </div>

      {/* Classroom Timeline Accordion */}
      {status === 'ENROLLED' && request.classRoomId && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                expanded
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              }`}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{expanded ? 'Thu gọn lịch học & bài tập' : 'Xem chi tiết lịch học, điểm danh & bài tập'}</span>
            </button>

            <div className="flex items-center gap-3 text-xs font-bold text-indigo-700">
              <Link to="/contracts" className="inline-flex items-center gap-1 hover:underline">
                <FileText size={14} />
                <span>Hợp đồng & Ký quỹ</span>
              </Link>
              <span className="text-slate-300">•</span>
              <Link to="/student/wallet" className="inline-flex items-center gap-1 hover:underline">
                <Wallet size={14} />
                <span>Ví & Lịch sử USDC</span>
              </Link>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 animate-fadeIn">
              <ClassSessionsTimeline
                key={request.classRoomId}
                classRoomId={request.classRoomId}
                classRoomName={request.className}
                meetingLink={meetingLink}
                currentUserRole="STUDENT"
              />
            </div>
          )}
        </div>
      )}

      {status === 'ACCEPTED' && (
        <div className="mt-4 flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs">
          <span className="text-blue-800 font-semibold">
            Gia sư đã chấp nhận yêu cầu của bạn! Vui lòng ký hợp đồng và nạp cọc để bắt đầu vào lớp.
          </span>
          <Link
            to="/contracts"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shrink-0 transition-colors shadow-xs"
          >
            Đến Hợp Đồng & Ký Quỹ
          </Link>
        </div>
      )}
    </article>
  );
}

function normalizeRequests(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeStatus(status) {
  return String(status || 'UNKNOWN').trim().toUpperCase();
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}
