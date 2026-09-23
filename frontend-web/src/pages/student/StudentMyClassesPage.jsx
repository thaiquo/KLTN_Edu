import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Mail,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Video,
  Wallet,
  FileText,
  XCircle,
  History,
  Sparkles,
  Filter,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Radio,
  Star
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { contractsApi } from '../../api/contractsApi';
import { reviewApi } from '../../api/reviews';
import { useFeedback } from '../../components/feedback/useFeedback';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';
import { ClassSessionsTimeline } from '../../components/classroom/ClassSessionsTimeline';
import { isClassLiveNow } from '../../utils/scheduleUtils';

const STATUS_META = {
  ENROLLED: { label: 'Đang học', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Đang chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED: { label: 'Đã chấp nhận (Cần nạp cọc)', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  EXPIRED: { label: 'Quá hạn thanh toán', className: 'bg-red-50 text-red-700 border-red-200' },
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
  7: 'Thứ Bảy',
  8: 'Chủ Nhật'
};

const SHORT_DAY_LABELS = {
  1: 'CN',
  2: 'T2',
  3: 'T3',
  4: 'T4',
  5: 'T5',
  6: 'T6',
  7: 'T7',
  8: 'CN'
};

function formatDayLabel(day) {
  const d = Number(day);
  if (d === 1 || d === 8) return 'Chủ Nhật';
  return DAY_LABELS[d] || `Thứ ${d}`;
}

function formatShortDayLabel(day) {
  const d = Number(day);
  if (d === 1 || d === 8) return 'CN';
  return SHORT_DAY_LABELS[d] || `T${d}`;
}

export function StudentMyClassesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const feedback = useFeedback();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClassId = searchParams.get('classId');

  const [agreementsMap, setAgreementsMap] = useState({});
  const [scheduleData, setScheduleData] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const [data, agreementsData, sched] = await Promise.all([
        classApi.getMyEnrollmentRequests(),
        contractsApi.listAgreements({ size: 100 }).catch(() => []),
        classApi.getStudentSchedule().catch(() => null)
      ]);
      setRequests(normalizeRequests(data));
      setScheduleData(sched);
      const agrContent = Array.isArray(agreementsData) ? agreementsData : (agreementsData?.content || []);
      const map = {};
      agrContent.forEach((agr) => {
        if (agr && agr.classroomId) {
          map[agr.classroomId] = agr;
        }
      });
      setAgreementsMap(map);
    } catch (err) {
      setError(err?.message || 'Không thể tải yêu cầu học của bạn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useRealtimeRefresh(['ENROLLMENT_ACCEPTED', 'ENROLLMENT_REJECTED', 'AGREEMENT_FUNDED', 'AGREEMENT_EXPIRED'], loadRequests);

  // Calculate counts
  const enrolledClasses = useMemo(() => {
    return requests.filter((r) => {
      const s = normalizeStatus(r.status);
      return s === 'ENROLLED' || s === 'COMPLETED';
    });
  }, [requests]);

  const sessionsByClassId = useMemo(() => {
    const map = new Map();
    const list = scheduleData?.upcomingSessions || scheduleData?.sessions;
    if (Array.isArray(list)) {
      list.forEach((s) => {
        const cid = Number(s.classRoomId);
        if (!map.has(cid)) map.set(cid, []);
        map.get(cid).push(s);
      });
    }
    return map;
  }, [scheduleData]);

  const schedulesByClassId = useMemo(() => {
    const map = new Map();
    if (Array.isArray(scheduleData?.recurringSchedules)) {
      scheduleData.recurringSchedules.forEach((s) => {
        const cid = Number(s.classRoomId);
        if (!map.has(cid)) map.set(cid, []);
        map.get(cid).push(s);
      });
    }
    return map;
  }, [scheduleData]);

  const isLiveMap = useMemo(() => {
    const map = new Map();
    enrolledClasses.forEach((req) => {
      const cid = Number(req.classRoomId);
      const classSessions = sessionsByClassId.get(cid) || [];
      const classSchedules = schedulesByClassId.get(cid) || [];
      const liveCheck = isClassLiveNow({
        schedules: classSchedules,
        sessions: classSessions,
        currentDate: currentTime
      });
      if (liveCheck.isLive) {
        map.set(cid, liveCheck);
      }
    });
    return map;
  }, [enrolledClasses, sessionsByClassId, schedulesByClassId, currentTime]);

  const activeLiveClasses = useMemo(() => {
    return enrolledClasses.filter((req) => isLiveMap.has(Number(req.classRoomId)));
  }, [enrolledClasses, isLiveMap]);

  const pendingEscrowCount = useMemo(() => {
    return requests.filter((r) => normalizeStatus(r.status) === 'ACCEPTED').length;
  }, [requests]);

  const pendingApprovalCount = useMemo(() => {
    return requests.filter((r) => normalizeStatus(r.status) === 'PENDING').length;
  }, [requests]);

  const stats = useMemo(() => {
    return enrolledClasses.reduce((acc, item) => {
      const status = normalizeStatus(item.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [enrolledClasses]);

  const filteredRequests = useMemo(() => {
    return enrolledClasses.filter((req) => {
      const status = normalizeStatus(req.status);
      const isLive = isLiveMap.has(Number(req.classRoomId));

      let matchFilter = true;
      if (activeFilter === 'LIVE') {
        matchFilter = isLive;
      } else if (activeFilter === 'COMPLETED') {
        matchFilter = status === 'COMPLETED' || req.isCompleted;
      } else if (activeFilter === 'ENROLLED') {
        matchFilter = status === 'ENROLLED';
      } else if (activeFilter !== 'ALL') {
        matchFilter = status === activeFilter;
      }

      if (!matchFilter) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const name = (req.className || '').toLowerCase();
      const tutor = (req.tutorEmail || '').toLowerCase();
      const note = (req.note || '').toLowerCase();
      return name.includes(query) || tutor.includes(query) || note.includes(query);
    });
  }, [enrolledClasses, activeFilter, searchQuery, isLiveMap]);

  const sortedFilteredRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aLive = isLiveMap.has(Number(a.classRoomId)) ? 1 : 0;
      const bLive = isLiveMap.has(Number(b.classRoomId)) ? 1 : 0;
      if (aLive !== bLive) {
        return bLive - aLive;
      }
      return 0;
    });
  }, [filteredRequests, isLiveMap]);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return requests.find((r) => String(r.classRoomId) === String(selectedClassId));
  }, [requests, selectedClassId]);

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

  const handleSelectClass = (classRoomId) => {
    searchParams.set('classId', String(classRoomId));
    setSearchParams(searchParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    searchParams.delete('classId');
    setSearchParams(searchParams);
  };

  return (
    <StudentPageScaffold
      eyebrow="Student Web"
      title={selectedClass ? (selectedClass.className || `Lớp học #${selectedClass.classRoomId}`) : "Lớp học của tôi"}
      description={
        selectedClass
          ? "Không gian học tập chính thức: theo dõi buổi học hôm nay, xem lộ trình các buổi học, lịch sử điểm danh và bài tập."
          : "Không gian học tập chính thức: theo dõi lịch học cuốn chiếu, tham gia phòng học trực tuyến, điểm danh và nộp bài tập theo từng buổi học."
      }
      actions={
        <div className="flex items-center gap-2.5">
          {selectedClass ? (
            <>
              <Link
                to="/student/complaints"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-100 shadow-xs"
              >
                <ShieldAlert size={16} />
                Khiếu nại buổi học
              </Link>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-100 shadow-xs"
              >
                <ArrowLeft size={16} />
                Quay lại danh sách lớp
              </button>
            </>
          ) : (
            <>
              <Link
                to="/student/complaints"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-100 shadow-xs"
              >
                <ShieldAlert size={16} />
                Khiếu nại của tôi
              </Link>
              <Link
                to="/contracts"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 text-xs font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100/70 shadow-xs"
              >
                <ShieldCheck size={16} />
                Hợp đồng & Ký quỹ
              </Link>
              <Link
                to="/classes"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-extrabold text-white transition-colors hover:bg-primary shadow-xs"
              >
                <BookOpen size={16} />
                Tìm lớp mới
              </Link>
            </>
          )}
        </div>
      }
    >
      {/* Live Class Alert Banner (only shown in list view if any class is currently live) */}
      {!selectedClassId && activeLiveClasses.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 sm:p-5 text-white shadow-lg shadow-emerald-600/20">
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white shrink-0 shadow-sm">
                <Radio className="animate-pulse" size={22} />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-emerald-700"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    Đang Diễn Ra
                  </span>
                  <h3 className="text-sm sm:text-base font-black font-display text-white">
                    {activeLiveClasses.length === 1
                      ? `Lớp "${activeLiveClasses[0].className || `Lớp #${activeLiveClasses[0].classRoomId}`}" đang diễn ra!`
                      : `Bạn có ${activeLiveClasses.length} lớp học đang diễn ra ngay lúc này!`}
                  </h3>
                </div>
                <p className="text-xs text-emerald-100 mt-1 leading-relaxed font-medium">
                  {activeLiveClasses.length === 1 && isLiveMap.get(Number(activeLiveClasses[0].classRoomId))?.message
                    ? `${isLiveMap.get(Number(activeLiveClasses[0].classRoomId)).message}. Nhấn "Vào Lớp Ngay" để tham gia và điểm danh buổi học.`
                    : 'Hãy vào lớp ngay để không bỏ lỡ kiến thức và điểm danh buổi học trực tuyến cùng gia sư.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeLiveClasses.length === 1 ? (
                <button
                  type="button"
                  onClick={() => handleSelectClass(activeLiveClasses[0].classRoomId)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-900 shadow-md transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
                >
                  <Video size={15} className="text-emerald-700 animate-pulse" />
                  <span>Vào Lớp Ngay</span>
                  <ArrowRight size={14} className="text-emerald-700" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveFilter('LIVE')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-900 shadow-md transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
                >
                  <span>Xem {activeLiveClasses.length} lớp đang diễn ra</span>
                  <ArrowRight size={14} className="text-emerald-700" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Contracts & Escrow Banner (only shown in list view) */}
      {!selectedClassId && pendingEscrowCount > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-blue-950 font-display">
                Bạn có {pendingEscrowCount} lớp học đang chờ ký hợp đồng & nạp cọc Escrow
              </h3>
              <p className="text-xs text-blue-800 mt-0.5 leading-relaxed font-medium">
                Gia sư đã chấp thuận yêu cầu. Bạn cần hoàn tất ký xác nhận hợp đồng điện tử và nạp cọc bảo vệ để chính thức xuất hiện tại không gian lớp học này.
              </p>
            </div>
          </div>
          <Link
            to="/contracts"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all shrink-0"
          >
            <FileText size={14} />
            <span>Ký quỹ vào lớp ngay</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      )}

      {/* VIEW A: DEDICATED CLASS WORKSPACE VIEW */}
      {selectedClassId ? (
        <StudentClassWorkspaceView
          classRoomId={Number(selectedClassId)}
          request={selectedClass}
          agreement={agreementsMap[selectedClassId]}
          onBack={handleBackToList}
        />
      ) : (
        /* VIEW B: CLASS CATALOG LIST VIEW */
        <>
          {/* 1. Quick Stats Row (Only Enrolled & Completed) */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article
              onClick={() => setActiveFilter('ALL')}
              className={`rounded-2xl border p-4 shadow-xs cursor-pointer transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
                Tất cả lớp đã tham gia
              </p>
              <p className={`mt-1 font-display text-2xl font-black ${activeFilter === 'ALL' ? 'text-white' : 'text-slate-950'}`}>
                {enrolledClasses.length}
              </p>
            </article>

            <article
              onClick={() => setActiveFilter('ENROLLED')}
              className={`rounded-2xl border p-4 shadow-xs cursor-pointer transition-all ${
                activeFilter === 'ENROLLED'
                  ? 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-700/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-emerald-300'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${activeFilter === 'ENROLLED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Lớp đang học chính thức
              </p>
              <p className={`mt-1 font-display text-2xl font-black ${activeFilter === 'ENROLLED' ? 'text-white' : 'text-emerald-950'}`}>
                {stats['ENROLLED'] || 0}
              </p>
            </article>

            <article
              onClick={() => setActiveFilter('COMPLETED')}
              className={`rounded-2xl border p-4 shadow-xs cursor-pointer transition-all ${
                activeFilter === 'COMPLETED'
                  ? 'bg-blue-700 text-white border-blue-700 ring-2 ring-blue-700/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${activeFilter === 'COMPLETED' ? 'text-blue-100' : 'text-blue-700'}`}>
                Khóa học đã hoàn tất
              </p>
              <p className={`mt-1 font-display text-2xl font-black ${activeFilter === 'COMPLETED' ? 'text-white' : 'text-slate-950'}`}>
                {stats['COMPLETED'] || 0}
              </p>
            </article>
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
                Tất cả lớp ({enrolledClasses.length})
              </button>
              {activeLiveClasses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('LIVE')}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                    activeFilter === 'LIVE'
                      ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/40'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                  <span>Đang diễn ra ({activeLiveClasses.length})</span>
                </button>
              )}
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
                onClick={() => setActiveFilter('COMPLETED')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeFilter === 'COMPLETED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Đã hoàn thành ({stats['COMPLETED'] || 0})
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

          {/* 3. Class List as Grid of Cards */}
          {loading ? (
            <section className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="inline-flex items-center gap-3 text-sm font-bold text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Đang tải danh sách lớp học của bạn...
              </div>
            </section>
          ) : sortedFilteredRequests.length > 0 ? (
            <section className="grid gap-5 sm:grid-cols-2">
              {sortedFilteredRequests.map((request) => (
                <ClassSummaryCard
                  key={request.id}
                  request={request}
                  agreement={agreementsMap[request.classRoomId]}
                  liveCheckFromParent={isLiveMap.get(Number(request.classRoomId))}
                  sessions={sessionsByClassId.get(Number(request.classRoomId))}
                  recurringSchedules={schedulesByClassId.get(Number(request.classRoomId))}
                  currentTime={currentTime}
                  onSelectClass={() => handleSelectClass(request.classRoomId)}
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
        </>
      )}
    </StudentPageScaffold>
  );
}

/**
 * Clean Class Card for List View (NO inline dropdowns!)
 */
function ClassSummaryCard({
  request,
  agreement,
  onSelectClass,
  liveCheckFromParent,
  sessions,
  recurringSchedules,
  currentTime
}) {
  const [classroomDetails, setClassroomDetails] = useState(null);

  const status = normalizeStatus(request.status);
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  useEffect(() => {
    if (!request.classRoomId) return;
    let cancelled = false;
    classApi
      .getPublicClassById(request.classRoomId)
      .then((room) => {
        if (!cancelled && room) {
          setClassroomDetails(room);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [request.classRoomId]);

  const liveCheck = useMemo(() => {
    if (liveCheckFromParent?.isLive) {
      return liveCheckFromParent;
    }
    const classSchedules = classroomDetails?.schedules || recurringSchedules || [];
    const classSessions = sessions || [];
    return isClassLiveNow({
      schedules: classSchedules,
      sessions: classSessions,
      currentDate: currentTime || new Date()
    });
  }, [liveCheckFromParent, classroomDetails, recurringSchedules, sessions, currentTime]);

  const isLive = Boolean(liveCheck?.isLive);

  const weeklyDaysSummary = useMemo(() => {
    if (!classroomDetails?.schedules || classroomDetails.schedules.length === 0) return null;
    const sorted = [...classroomDetails.schedules].sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek));
    const days = sorted.map((s) => formatShortDayLabel(s.dayOfWeek));
    return Array.from(new Set(days)).join(' • ');
  }, [classroomDetails]);

  const weeklyScheduleSummary = useMemo(() => {
    const sessionsCount = classroomDetails?.sessionsPerWeek || classroomDetails?.schedules?.length;
    if (!sessionsCount && !weeklyDaysSummary) return null;
    if (sessionsCount && weeklyDaysSummary) return `${sessionsCount} buổi/tuần (${weeklyDaysSummary})`;
    if (sessionsCount) return `${sessionsCount} buổi/tuần`;
    return weeklyDaysSummary;
  }, [classroomDetails, weeklyDaysSummary]);

  const schedulesText = useMemo(() => {
    if (!classroomDetails?.schedules || classroomDetails.schedules.length === 0) return null;
    return [...classroomDetails.schedules]
      .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.startTime).localeCompare(String(a.startTime)))
      .map((s) => `${formatDayLabel(s.dayOfWeek)}: ${s.startTime?.slice(0, 5)} - ${s.endTime?.slice(0, 5)}`)
      .join(' • ');
  }, [classroomDetails]);

  const tutorName =
    classroomDetails?.tutorFullName ||
    request.tutorFullName ||
    agreement?.tutorName ||
    (request.tutorEmail ? request.tutorEmail.split('@')[0] : 'Gia sư');

  const price = classroomDetails?.pricePerSession ?? agreement?.pricePerSessionUsdc ?? 0;
  const totalSessions = classroomDetails?.totalSessions || agreement?.totalSessions || 12;

  return (
    <article
      onClick={onSelectClass}
      className={`group relative rounded-2xl p-5 md:p-6 transition-all cursor-pointer flex flex-col justify-between ${
        isLive
          ? 'live-class-card-pulse border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/70 via-white to-white ring-2 ring-emerald-500 shadow-xl shadow-emerald-500/20 hover:shadow-2xl'
          : 'border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-indigo-300'
      }`}
    >
      <div>
        {/* Active Live Banner inside Card Header */}
        {isLive && (
          <div className="mb-3.5 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 px-3.5 py-2 text-white shadow-md shadow-emerald-600/25 animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-400"></span>
              </span>
              <span className="text-[11px] font-black tracking-wide uppercase font-display truncate">
                Lớp học đang diễn ra ngay lúc này!
              </span>
            </div>
            <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md text-white shrink-0">
              {liveCheck.message ? liveCheck.message.split('(')[0].trim() : 'Vào học ngay'}
            </span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100/90 px-2.5 py-0.5 text-xs font-black text-rose-800 animate-pulse shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                </span>
                LIVE
              </span>
            )}
            <span className={`rounded-full border px-3 py-0.5 text-xs font-black ${meta.className}`}>
              {meta.label}
            </span>
            {status === 'ENROLLED' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Escrow Bảo Vệ
              </span>
            )}
          </div>

          <span className="text-[11px] font-semibold text-slate-400">
            Mã lớp #{request.classRoomId}
          </span>
        </div>

        {/* Class Name */}
        <h3 className={`font-display text-lg font-black transition-colors line-clamp-1 ${
          isLive ? 'text-emerald-950 group-hover:text-emerald-700' : 'text-slate-900 group-hover:text-indigo-600'
        }`}>
          {request.className || `Lớp học #${request.classRoomId}`}
        </h3>

        {/* Tutor info */}
        <div className={`mt-3.5 flex items-center gap-3 p-3 rounded-xl border transition-colors ${
          isLive ? 'bg-white/90 border-emerald-200/80 shadow-xs' : 'bg-slate-50/80 border-slate-200/80'
        }`}>
          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
            isLive ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-indigo-600 to-blue-700'
          }`}>
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className={`text-[10px] uppercase font-bold block tracking-wider ${
              isLive ? 'text-emerald-700' : 'text-indigo-700'
            }`}>
              Gia sư phụ trách:
            </span>
            <strong className="text-slate-900 font-black text-sm block truncate">
              {tutorName}
            </strong>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5 truncate">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span>{classroomDetails?.tutorEmail || request.tutorEmail}</span>
            </span>
          </div>
        </div>

        {/* Class Meta Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
            isLive ? 'bg-white border-emerald-100' : 'bg-slate-50 border-slate-100'
          }`}>
            <BookOpen size={15} className={isLive ? 'text-emerald-600 shrink-0' : 'text-indigo-600 shrink-0'} />
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">Quy mô:</span>
              <span className="font-bold text-slate-900">{totalSessions} buổi học</span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
            isLive ? 'bg-white border-emerald-100' : 'bg-slate-50 border-slate-100'
          }`}>
            <Wallet size={15} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">Học phí:</span>
              <span className="font-bold text-emerald-700 font-mono">${Number(price).toFixed(2)} USDC</span>
            </div>
          </div>

          {(schedulesText || weeklyScheduleSummary) && (
            <div className={`col-span-2 p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
              isLive
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950 shadow-2xs'
                : 'bg-slate-50 border-slate-100 text-slate-700'
            }`}>
              <Clock size={16} className={`shrink-0 mt-0.5 ${isLive ? 'text-emerald-700 animate-pulse' : 'text-amber-600'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-emerald-800' : 'text-slate-400'}`}>
                    Lịch học hàng tuần:
                  </span>
                  {weeklyScheduleSummary && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                      isLive
                        ? 'text-emerald-900 bg-white border-emerald-300 shadow-2xs'
                        : 'text-indigo-700 bg-indigo-50 border-indigo-200/80'
                    }`}>
                      {weeklyScheduleSummary}
                    </span>
                  )}
                </div>
                {schedulesText && (
                  <span className={`font-bold text-xs truncate block ${isLive ? 'text-emerald-950 font-black' : 'text-slate-900'}`} title={schedulesText}>
                    {schedulesText}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className={`mt-4 pt-3 border-t flex items-center justify-between gap-3 ${
        isLive ? 'border-emerald-200' : 'border-slate-100'
      }`}>
        <span className={`text-xs font-bold flex items-center gap-1 ${
          isLive ? 'text-emerald-700 font-black' : 'text-indigo-600 group-hover:underline'
        }`}>
          <span>Xem chi tiết buổi học & điểm danh</span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectClass();
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs shadow-md transition-all ${
            isLive
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white ring-4 ring-emerald-500/30 scale-[1.03] hover:scale-105 animate-pulse cursor-pointer'
              : 'bg-slate-900 text-white hover:bg-primary shadow-xs group-hover:translate-x-0.5 cursor-pointer'
          }`}
        >
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>Vào Lớp Ngay</span>
              <ArrowRight size={14} />
            </>
          ) : (
            <>
              <span>Vào Lớp Học</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </article>
  );
}

/**
 * Dedicated Class Workspace View for Selected Class
 */
function StudentClassWorkspaceView({ classRoomId, request, agreement, onBack }) {
  const [classroomDetails, setClassroomDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const feedback = useFeedback();

  const [reviewStatus, setReviewStatus] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingDetails(true);
    classApi
      .getPublicClassById(classRoomId)
      .then((room) => {
        if (!cancelled && room) {
          setClassroomDetails(room);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classRoomId]);

  async function loadReviewStatus() {
    setReviewLoading(true);
    setReviewError('');
    try {
      const status = await reviewApi.getMyClassReviewStatus(classRoomId);
      setReviewStatus(status);
      setRating(status?.review?.rating || 0);
      setComment(status?.review?.comment || '');
    } catch (err) {
      setReviewError(err?.message || 'Không thể tải trạng thái đánh giá gia sư.');
    } finally {
      setReviewLoading(false);
    }
  }

  useEffect(() => {
    loadReviewStatus();
  }, [classRoomId]);

  async function handleSubmitReview(event) {
    event.preventDefault();
    const normalizedComment = comment.trim();
    if (rating < 1 || rating > 5) {
      setReviewError('Vui lòng chọn số sao đánh giá.');
      return;
    }
    if (normalizedComment.length < 10 || normalizedComment.length > 1000) {
      setReviewError('Nhận xét phải có từ 10 đến 1000 ký tự.');
      return;
    }

    setReviewSaving(true);
    setReviewError('');
    try {
      if (reviewStatus?.reviewExists) {
        await reviewApi.updateMyClassReview(classRoomId, { rating, comment: normalizedComment });
        feedback.success('Đã cập nhật đánh giá gia sư.');
      } else {
        await reviewApi.createMyClassReview(classRoomId, { rating, comment: normalizedComment });
        feedback.success('Đã gửi đánh giá gia sư.');
      }
      await loadReviewStatus();
    } catch (err) {
      const message = err?.message || 'Không thể lưu đánh giá gia sư.';
      setReviewError(message);
      feedback.error(message);
    } finally {
      setReviewSaving(false);
    }
  }

  const weeklyDaysSummary = useMemo(() => {
    if (!classroomDetails?.schedules || classroomDetails.schedules.length === 0) return null;
    const sorted = [...classroomDetails.schedules].sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek));
    const days = sorted.map((s) => formatShortDayLabel(s.dayOfWeek));
    return Array.from(new Set(days)).join(' • ');
  }, [classroomDetails]);

  const weeklyScheduleSummary = useMemo(() => {
    const sessions = classroomDetails?.sessionsPerWeek || classroomDetails?.schedules?.length;
    if (!sessions && !weeklyDaysSummary) return null;
    if (sessions && weeklyDaysSummary) return `${sessions} buổi/tuần (${weeklyDaysSummary})`;
    if (sessions) return `${sessions} buổi/tuần`;
    return weeklyDaysSummary;
  }, [classroomDetails, weeklyDaysSummary]);

  const schedulesText = useMemo(() => {
    if (!classroomDetails?.schedules || classroomDetails.schedules.length === 0) return null;
    return [...classroomDetails.schedules]
      .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.startTime).localeCompare(String(a.startTime)))
      .map((s) => `${formatDayLabel(s.dayOfWeek)}: ${s.startTime?.slice(0, 5)} - ${s.endTime?.slice(0, 5)}`)
      .join(' • ');
  }, [classroomDetails]);

  const tutorName =
    classroomDetails?.tutorFullName ||
    request?.tutorFullName ||
    agreement?.tutorName ||
    (request?.tutorEmail ? request.tutorEmail.split('@')[0] : 'Gia sư');

  const meetingLink = classroomDetails?.meetingLink || request?.meetingLink || '';

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 transition-all shadow-2xs self-start"
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách lớp học</span>
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

      {/* Class Overview Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                Đang học chính thức
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Smart Contract Escrow Bảo Vệ
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-950 font-display">
              {request?.className || classroomDetails?.name || `Lớp học #${classRoomId}`}
            </h2>

            {classroomDetails?.description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-3xl">
                {classroomDetails.description}
              </p>
            )}

            {/* Quick badges */}
            <div className="mt-3.5 flex items-center gap-2.5 flex-wrap text-xs">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800">
                <GraduationCap size={15} className="text-indigo-600" />
                <span>Gia sư: {tutorName}</span>
                <span className="text-slate-400 font-normal">({classroomDetails?.tutorEmail || request?.tutorEmail})</span>
              </div>

              {weeklyScheduleSummary && (
                <div className="flex items-center gap-2 bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-200 font-bold text-indigo-900">
                  <Calendar size={15} className="text-indigo-600" />
                  <span>Lịch học tuần: <b className="text-indigo-950 font-black">{weeklyScheduleSummary}</b></span>
                </div>
              )}

              {schedulesText && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800">
                  <Clock size={15} className="text-amber-600" />
                  <span>{schedulesText}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Khai Giảng</span>
              <span className="font-bold text-slate-900">{classroomDetails?.startDate || "Chưa có"}</span>
            </div>
            {weeklyScheduleSummary && (
              <div className="px-4 py-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs">
                <span className="text-indigo-600 block text-[10px] uppercase font-bold">Số Buổi Trong Tuần</span>
                <span className="font-bold text-indigo-950">
                  {classroomDetails?.sessionsPerWeek || classroomDetails?.schedules?.length || 1} buổi/tuần
                </span>
                {weeklyDaysSummary && (
                  <span className="text-[11px] font-black text-indigo-700 block mt-0.5">
                    {weeklyDaysSummary}
                  </span>
                )}
              </div>
            )}
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Quy Mô Khóa Học</span>
              <span className="font-bold text-slate-900">{classroomDetails?.totalSessions || agreement?.totalSessions || 12} buổi</span>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Học Phí / Buổi</span>
              <span className="font-mono font-black text-emerald-800">
                ${Number(classroomDetails?.pricePerSession ?? agreement?.pricePerSessionUsdc ?? 0).toFixed(2)} USDC
              </span>
            </div>
          </div>
        </div>
      </div>

      <TutorReviewPanel
        status={reviewStatus}
        loading={reviewLoading}
        saving={reviewSaving}
        error={reviewError}
        rating={rating}
        comment={comment}
        tutorName={tutorName}
        onRatingChange={setRating}
        onCommentChange={setComment}
        onSubmit={handleSubmitReview}
      />

      {/* Main Class Sessions Timeline with Hero Spotlight, Roadmap & History */}
      <ClassSessionsTimeline
        key={classRoomId}
        classRoomId={classRoomId}
        classRoomName={request?.className || classroomDetails?.name}
        meetingLink={meetingLink}
        learningMode={classroomDetails?.learningMode || request?.learningMode}
        address={classroomDetails?.address || request?.address}
        currentUserRole="STUDENT"
      />
    </div>
  );
}

function TutorReviewPanel({
  status,
  loading,
  saving,
  error,
  rating,
  comment,
  tutorName,
  onRatingChange,
  onCommentChange,
  onSubmit
}) {
  const trimmedLength = comment.trim().length;
  const canReview = Boolean(status?.canReview);
  const reviewExists = Boolean(status?.reviewExists);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Đánh giá gia sư</p>
          <h3 className="mt-1 font-display text-xl font-black text-slate-950">
            {reviewExists ? 'Đánh giá của bạn' : `Bạn đánh giá ${tutorName} thế nào?`}
          </h3>
          <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
            Bạn có thể đánh giá sau khi đã tham gia ít nhất một buổi học hoàn tất với kết quả có mặt đầy đủ.
          </p>
        </div>
        {reviewExists && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            <ShieldCheck size={14} /> Đã gửi
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Đang tải trạng thái đánh giá...
        </div>
      ) : !canReview && !reviewExists ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800">
          {status?.reason || 'Bạn có thể đánh giá gia sư sau khi hoàn thành ít nhất một buổi học.'}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onRatingChange(value)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-amber-400 transition-colors hover:bg-amber-50"
                  aria-label={`${value} sao`}
                >
                  <Star size={21} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <span className="text-sm font-black text-slate-800">{rating ? `${rating}/5` : 'Chưa chọn sao'}</span>
          </div>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
            Nhận xét của bạn
            <textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              rows={4}
              className="min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold normal-case leading-6 text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white"
              placeholder="Chia sẻ trải nghiệm học tập của bạn..."
              maxLength={1000}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className={`text-xs font-bold ${trimmedLength < 10 || trimmedLength > 1000 ? 'text-amber-700' : 'text-slate-500'}`}>
              {trimmedLength}/1000 ký tự, tối thiểu 10 ký tự.
            </span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-black text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {reviewExists ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </form>
      )}
    </section>
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
