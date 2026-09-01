import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, Loader2, RotateCcw, Search, XCircle } from 'lucide-react';
import { classApi } from '../../api/classes';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

const STATUS_META = {
  PENDING: { label: 'Đang chờ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED: { label: 'Đã chấp nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export function StudentMyClassesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

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

  const stats = useMemo(() => {
    return requests.reduce((acc, item) => {
      const status = normalizeStatus(item.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  async function handleCancel(requestId) {
    setCancellingId(requestId);
    setError('');
    try {
      await classApi.cancelEnrollmentRequest(requestId);
      await loadRequests();
    } catch (err) {
      setError(err?.message || 'Không thể hủy yêu cầu học này.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <StudentPageScaffold
      eyebrow="Student Web"
      title="Lớp học của tôi"
      description="Theo dõi các yêu cầu tham gia lớp đang được backend hỗ trợ. Buổi học, điểm danh và bài tập sẽ được nối ở phase sau khi API sẵn sàng."
      actions={
        <>
          <Link
            to="/tutors"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Search size={16} />
            Tìm gia sư
          </Link>
          <Link
            to="/classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-4 text-sm font-extrabold text-white transition-colors hover:bg-primary"
          >
            <BookOpen size={16} />
            Tìm lớp
          </Link>
        </>
      }
    >
      <section className="grid gap-4 sm:grid-cols-4">
        {['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'].map((status) => (
          <StatCard key={status} status={status} value={stats[status] || 0} />
        ))}
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <section className="grid min-h-64 place-items-center rounded-[8px] border border-slate-200 bg-white">
          <div className="inline-flex items-center gap-3 text-sm font-extrabold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Đang tải yêu cầu học
          </div>
        </section>
      ) : requests.length > 0 ? (
        <section className="grid gap-4">
          {requests.map((request) => (
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
          title="Bạn chưa có yêu cầu tham gia lớp"
          description="Khi bạn gửi yêu cầu học từ trang tìm lớp hoặc hồ sơ gia sư, trạng thái thật từ API sẽ xuất hiện tại đây."
          actionTo="/classes"
          actionLabel="Tìm lớp phù hợp"
        />
      )}
    </StudentPageScaffold>
  );
}

function StatCard({ status, value }) {
  const meta = STATUS_META[status];
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,.04)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{meta.label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold text-slate-950">{value}</p>
    </article>
  );
}

function EnrollmentRequestCard({ request, cancelling, onCancel }) {
  const status = normalizeStatus(request.status);
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,.04)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${meta.className}`}>
              {meta.label}
            </span>
            {request.createdAt && (
              <span className="text-xs font-bold text-slate-400">
                Gửi lúc {formatDateTime(request.createdAt)}
              </span>
            )}
          </div>
          <h2 className="mt-3 font-display text-xl font-extrabold tracking-tight text-slate-950">
            {request.className || `Lớp #${request.classRoomId || request.id}`}
          </h2>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-500 sm:grid-cols-2">
            {request.tutorEmail && <p>Gia sư: {request.tutorEmail}</p>}
            {request.studentName && <p>Học viên: {request.studentName}</p>}
            {request.note && <p className="sm:col-span-2">Ghi chú: {request.note}</p>}
            {request.rejectReason && <p className="sm:col-span-2 text-red-600">Lý do từ chối: {request.rejectReason}</p>}
          </div>
        </div>

        {status === 'PENDING' && (
          <button
            type="button"
            onClick={() => onCancel(request.id)}
            disabled={cancelling}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-red-200 px-4 text-sm font-extrabold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Hủy yêu cầu
          </button>
        )}
      </div>
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
