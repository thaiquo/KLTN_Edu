import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  User,
  Video,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  CalendarDays,
  ListOrdered,
  X,
  MapPin,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { StudentPageScaffold, StudentEmptyState } from './StudentPageScaffold';
import { formatDayOfWeek, formatTimeSlot, DAY_OF_WEEK_LABELS } from '../../utils/scheduleUtils';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';

const STATUS_SESSION_META = {
  SCHEDULED: { label: 'Sắp diễn ra', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  IN_PROGRESS: { label: 'Đang diễn ra', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  ABSENT: { label: 'Vắng mặt', className: 'bg-amber-50 text-amber-700 border-amber-200' }
};

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateDisplay(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function toIsoDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

export function StudentSchedulePage() {
  const [scheduleData, setScheduleData] = useState({ recurringSchedules: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'recurring' | 'sessions'
  const [weekOffset, setWeekOffset] = useState(0);

  // Quick Detail Modal State
  const [detailModal, setDetailModal] = useState(null); // { type: 'SESSION' | 'RECURRING', data: any }

  const loadSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await classApi.getStudentSchedule();
      const rawSessions = res?.sessions || res?.upcomingSessions || [];
      const rawRecurring = res?.recurringSchedules || [];
      setScheduleData({
        recurringSchedules: Array.isArray(rawRecurring) ? rawRecurring : [],
        sessions: Array.isArray(rawSessions) ? rawSessions : []
      });
    } catch (err) {
      setError(err?.message || 'Không thể tải lịch học của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  useRealtimeRefresh(['TERMINATION_UPDATED', 'TERMINATION_COMPLETED', 'ENROLLMENT_ACCEPTED', 'CLASS_MUTATED', 'ATTENDANCE_MARKED'], loadSchedule);

  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const start = getStartOfWeek(today);
    return addDays(start, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const date = addDays(currentWeekStart, i);
      // Day of week in system: Mon=2, Tue=3, ..., Sat=7, Sun=8
      const systemDay = i === 6 ? 8 : i + 2;
      return {
        date,
        isoDate: toIsoDate(date),
        label: formatDayOfWeek(systemDay),
        dateString: formatDateDisplay(date),
        isToday: toIsoDate(new Date()) === toIsoDate(date),
        systemDay
      };
    });
  }, [currentWeekStart]);

  const [selectedClassId, setSelectedClassId] = useState('ALL');

  const distinctClasses = useMemo(() => {
    const map = new Map();
    (scheduleData.recurringSchedules || []).forEach((s) => {
      if (s.classRoomId && s.className) map.set(String(s.classRoomId), s.className);
    });
    (scheduleData.sessions || []).forEach((s) => {
      if (s.classRoomId && s.className) map.set(String(s.classRoomId), s.className);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [scheduleData]);

  const filteredSessions = useMemo(() => {
    return (scheduleData.sessions || []).filter((s) => {
      if (selectedClassId !== 'ALL' && String(s.classRoomId) !== selectedClassId) return false;
      return true;
    });
  }, [scheduleData.sessions, selectedClassId]);

  const filteredRecurring = useMemo(() => {
    return (scheduleData.recurringSchedules || []).filter((s) => {
      if (selectedClassId !== 'ALL' && String(s.classRoomId) !== selectedClassId) return false;
      return true;
    });
  }, [scheduleData.recurringSchedules, selectedClassId]);

  // Sessions grouped by ISO Date string
  const sessionsByDate = useMemo(() => {
    const map = {};
    filteredSessions.forEach((session) => {
      const d = session.sessionDate;
      if (!map[d]) map[d] = [];
      map[d].push(session);
    });
    return map;
  }, [filteredSessions]);

  // Recurring schedules grouped by dayOfWeek (2..8)
  const recurringByDay = useMemo(() => {
    const map = { 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
    filteredRecurring.forEach((item) => {
      const d = Number(item.dayOfWeek);
      if (map[d]) {
        map[d].push(item);
      }
    });
    return map;
  }, [filteredRecurring]);

  const uniqueClassesCount = useMemo(() => {
    const set = new Set();
    (scheduleData.recurringSchedules || []).forEach((s) => set.add(s.classRoomId));
    (scheduleData.sessions || []).forEach((s) => set.add(s.classRoomId));
    return set.size;
  }, [scheduleData]);

  const upcomingSessionsCount = useMemo(() => {
    return (scheduleData.sessions || []).filter(
      (s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED' && !s.attendanceStopped
    ).length;
  }, [scheduleData.sessions]);

  return (
    <StudentPageScaffold
      eyebrow="Thời khóa biểu & Lịch học"
      title="Lịch học của tôi"
      description="Quản lý thời khóa biểu trong tuần, theo dõi các buổi học sắp tới, kiểm tra phòng học và tránh trùng lịch khi đăng ký lớp mới."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSchedule}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-800 transition-colors hover:border-brand-primary/40 hover:text-brand-primary cursor-pointer shadow-xs"
          >
            <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <Link
            to="/classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition-colors hover:bg-brand-primary shadow-xs"
          >
            <BookOpen size={15} />
            Tìm thêm lớp
          </Link>
        </div>
      }
    >
      {/* Stats row */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Lớp đang theo học</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <BookOpen size={18} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900">{uniqueClassesCount} lớp</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Khung giờ cố định</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
              <Clock size={18} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900">
            {scheduleData.recurringSchedules?.length || 0} buổi/tuần
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Buổi học sắp tới</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CalendarIcon size={18} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900">
            {upcomingSessionsCount} buổi cần học
          </p>
        </div>
      </section>

      {/* Tabs & Class Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CalendarDays size={16} />
            Lịch theo tuần
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'recurring'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers size={16} />
            Khung giờ định kỳ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'sessions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ListOrdered size={16} />
            Tất cả buổi học ({filteredSessions.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Class Filter Dropdown */}
          {distinctClasses.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <BookOpen size={13} className="text-slate-400" />
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả lớp học ({distinctClasses.length})</option>
                {distinctClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tuần trước"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tuần hiện tại
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tuần sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Tab 1: Weekly Calendar Grid */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              Thời gian: {weekDays[0].dateString} - {weekDays[6].dateString}
            </span>
            <span className="text-[11px] text-slate-400">
              * Nhấp vào buổi học để xem chi tiết hoặc tham gia phòng học
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
            {weekDays.map((day) => {
              const daySessions = sessionsByDate[day.isoDate] || [];
              const dayRecurring = recurringByDay[day.systemDay] || [];

              return (
                <div
                  key={day.isoDate}
                  className={`flex flex-col rounded-2xl border p-3.5 transition-all ${
                    day.isToday
                      ? 'border-brand-primary/50 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div>
                      <p className={`text-xs font-black ${day.isToday ? 'text-brand-primary' : 'text-slate-900'}`}>
                        {day.label}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400">{day.dateString}</p>
                    </div>
                    {day.isToday && (
                      <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-black text-white">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Sessions or Recurring Slots on this day */}
                  <div className="space-y-2 flex-1">
                    {daySessions.length > 0 ? (
                      daySessions.map((session) => {
                        const isCancelled = session.status === 'CANCELLED' || Boolean(session.attendanceStopped);
                        const statusMeta = isCancelled
                          ? { label: Boolean(session.attendanceStopped) ? 'Đã dừng học' : 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' }
                          : (STATUS_SESSION_META[session.status] || STATUS_SESSION_META.SCHEDULED);
                        const title = session.className || session.classRoomTitle || 'Buổi học';
                        const tutor = session.tutorFullName || session.tutorName;

                        return (
                          <div
                            key={session.sessionId || session.id}
                            onClick={() => setDetailModal({ type: 'SESSION', data: session })}
                            className={`rounded-xl border p-2.5 shadow-2xs transition-all space-y-1.5 cursor-pointer hover:shadow-md ${
                              isCancelled
                                ? 'border-rose-200 bg-rose-50/30'
                                : 'border-indigo-100 bg-white hover:border-indigo-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[11px] font-black line-clamp-1 ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                {title}
                              </span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                            </div>

                            <p className="text-[11px] font-bold text-brand-primary flex items-center gap-1">
                              <Clock size={12} /> {formatTimeSlot(session.startTime, session.endTime)}
                            </p>

                            {session.sequenceNumber && (
                              <span className="inline-block px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                Buổi {session.sequenceNumber}
                              </span>
                            )}

                            {session.topic && (
                              <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                                📖 {session.topic}
                              </p>
                            )}

                            {tutor && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 line-clamp-1">
                                <User size={11} /> {tutor}
                              </p>
                            )}

                            <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailModal({ type: 'SESSION', data: session });
                                }}
                                className="text-[10px] font-bold text-slate-600 hover:text-brand-primary cursor-pointer"
                              >
                                Chi tiết
                              </button>

                              {!isCancelled && session.status !== 'COMPLETED' && (
                                <Link
                                  to={session.classRoomId ? `/my-classes?classId=${session.classRoomId}` : '/my-classes'}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                                  title="Vào lớp để điểm danh và nhận link phòng học"
                                >
                                  <Video size={10} /> Vào lớp
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : dayRecurring.length > 0 ? (
                      // Display recurring slot placeholder if no specific session instance
                      dayRecurring.map((slot, idx) => {
                        const title = slot.className || slot.classRoomTitle || 'Lớp học';
                        const tutor = slot.tutorFullName || slot.tutorName;

                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailModal({ type: 'RECURRING', data: slot })}
                            className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-2.5 space-y-1.5 hover:border-indigo-400 hover:bg-indigo-50/70 transition-all cursor-pointer"
                          >
                            <p className="text-[11px] font-black text-indigo-950 line-clamp-1">
                              {title}
                            </p>
                            <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                              <Clock size={11} /> {formatTimeSlot(slot.startTime, slot.endTime)}
                            </p>
                            {tutor && (
                              <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                                Gia sư: {tutor}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[9px] font-bold text-indigo-600 pt-0.5">
                              <span>Khung giờ định kỳ</span>
                              <span className="text-slate-400 hover:text-indigo-700">Xem lớp →</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-20 items-center justify-center text-center">
                        <span className="text-[11px] font-medium text-slate-300">Trống lịch</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Recurring Weekly Slots */}
      {activeTab === 'recurring' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Các khung giờ học định kỳ cố định hàng tuần theo hợp đồng của bạn. Hệ thống sẽ tự động đối soát và cảnh báo khi đăng ký lớp mới để tránh trùng lịch.
          </p>

          {scheduleData.recurringSchedules?.length === 0 ? (
            <StudentEmptyState
              title="Chưa có lịch học định kỳ"
              description="Bạn chưa tham gia lớp học nào có lịch định kỳ đang hoạt động."
              actionLabel="Tìm kiếm lớp học"
              actionHref="/classes"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[2, 3, 4, 5, 6, 7, 8].map((dayNum) => {
                const slots = recurringByDay[dayNum] || [];
                if (slots.length === 0) return null;

                return (
                  <div key={dayNum} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="font-display text-sm font-black text-slate-900">
                        {formatDayOfWeek(dayNum)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">
                        {slots.length} khung giờ
                      </span>
                    </div>

                    <div className="space-y-3">
                      {slots.map((slot, idx) => (
                        <div
                          key={idx}
                          onClick={() => setDetailModal({ type: 'RECURRING', data: slot })}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2 hover:border-brand-primary/40 hover:bg-white transition-all cursor-pointer shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-900 line-clamp-1">{slot.className || slot.classRoomTitle}</h4>
                            <span className="text-[10px] font-extrabold text-brand-primary">
                              {slot.learningMode === 'ONLINE' ? 'Trực tuyến' : 'Tại chỗ'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Clock size={13} className="text-brand-primary" />
                            {formatTimeSlot(slot.startTime, slot.endTime)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Gia sư: {slot.tutorFullName || slot.tutorName || 'Chưa cập nhật'}</span>
                            <span className="text-[10px] text-brand-primary font-bold">
                              Xem chi tiết →
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: All Sessions List */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Danh sách chi tiết từng buổi học theo lịch trình của các khóa học bạn đang tham gia.
            </p>
          </div>

          {scheduleData.sessions?.length === 0 ? (
            <StudentEmptyState
              title="Chưa có buổi học nào được lên lịch"
              description="Các buổi học sẽ tự động hiển thị tại đây khi gia sư bắt đầu mở lớp và lên lịch giảng dạy."
              actionLabel="Xem lớp học của tôi"
              actionHref="/my-classes"
            />
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              {scheduleData.sessions.map((session) => {
                const isCancelled = session.status === 'CANCELLED' || Boolean(session.attendanceStopped);
                const statusMeta = isCancelled
                  ? { label: Boolean(session.attendanceStopped) ? 'Đã dừng học' : 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' }
                  : (STATUS_SESSION_META[session.status] || STATUS_SESSION_META.SCHEDULED);
                const title = session.className || session.classRoomTitle || 'Buổi học';
                const tutor = session.tutorFullName || session.tutorName;

                return (
                  <div
                    key={session.sessionId || session.id}
                    onClick={() => setDetailModal({ type: 'SESSION', data: session })}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-display text-sm font-black ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {title}
                        </span>
                        {session.sequenceNumber && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                            Buổi {session.sequenceNumber}
                          </span>
                        )}
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-700 font-bold">
                          <CalendarIcon size={14} className="text-brand-primary" />
                          {session.sessionDate}
                        </span>
                        <span className="flex items-center gap-1 text-slate-700 font-bold">
                          <Clock size={14} className="text-brand-primary" />
                          {formatTimeSlot(session.startTime, session.endTime)}
                        </span>
                        {tutor && (
                          <span className="flex items-center gap-1">
                            <User size={14} /> Gia sư: {tutor}
                          </span>
                        )}
                      </div>

                      {session.topic && (
                        <p className="text-xs text-slate-600 font-medium">
                          Chủ đề: <span className="font-bold">{session.topic}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModal({ type: 'SESSION', data: session });
                        }}
                        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Chi tiết
                      </button>

                      {isCancelled ? (
                        <span className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700">
                          Buổi học đã dừng/hủy
                        </span>
                      ) : session.status !== 'COMPLETED' ? (
                        <Link
                          to={session.classRoomId ? `/my-classes?classId=${session.classRoomId}` : '/my-classes'}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                          title="Vào lớp để điểm danh và nhận link phòng học"
                        >
                          <Video size={14} /> Vào lớp & Điểm danh
                        </Link>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 italic">
                          Đã kết thúc
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK DETAIL MODAL */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                  {detailModal.type === 'SESSION' ? 'Chi tiết buổi học' : 'Chi tiết khung giờ học'}
                </span>
                <h3 className="text-lg font-black text-slate-900 font-display mt-0.5">
                  {detailModal.data.className || detailModal.data.classRoomTitle || 'Thông tin lớp học'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4 text-xs">
              {detailModal.type === 'SESSION' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Ngày học</span>
                      <p className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                        <CalendarIcon size={14} className="text-brand-primary" />
                        {detailModal.data.sessionDate}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Khung giờ</span>
                      <p className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                        <Clock size={14} className="text-brand-primary" />
                        {formatTimeSlot(detailModal.data.startTime, detailModal.data.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-50/60 rounded-2xl space-y-2 border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900">
                        {detailModal.data.sequenceNumber ? `Buổi học số ${detailModal.data.sequenceNumber}` : 'Buổi học'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-200 text-indigo-900">
                        {detailModal.data.status || 'SCHEDULED'}
                      </span>
                    </div>
                    {detailModal.data.topic && (
                      <p className="text-xs text-indigo-950 font-medium">
                        <strong>Chủ đề:</strong> {detailModal.data.topic}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-slate-600">
                    <p className="flex items-center gap-2">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span>Gia sư: <strong>{detailModal.data.tutorFullName || detailModal.data.tutorName || 'Chưa cập nhật'}</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                      <span>Hợp đồng Escrow: <strong>Đã bảo chứng trên Blockchain</strong></span>
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] font-medium leading-relaxed">
                    💡 <strong>Lưu ý điểm danh:</strong> Để nhận link phòng học trực tuyến (Google Meet/Zoom) và tải tài liệu buổi học, bạn cần điểm danh trong đúng khung giờ học tại trang Lớp học của tôi.
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Thứ trong tuần</span>
                      <p className="font-extrabold text-slate-800 text-sm">
                        {formatDayOfWeek(detailModal.data.dayOfWeek)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Khung giờ cố định</span>
                      <p className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                        <Clock size={14} className="text-brand-primary" />
                        {formatTimeSlot(detailModal.data.startTime, detailModal.data.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-slate-600">
                    <p className="flex items-center gap-2">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span>Gia sư giảng dạy: <strong>{detailModal.data.tutorFullName || detailModal.data.tutorName || 'Chưa cập nhật'}</strong></span>
                    </p>
                    {detailModal.data.learningMode && (
                      <p className="flex items-center gap-2">
                        <BookOpen size={14} className="text-slate-400 shrink-0" />
                        <span>Hình thức: <strong>{detailModal.data.learningMode === 'ONLINE' ? 'Trực tuyến' : 'Tại chỗ'}</strong></span>
                      </p>
                    )}
                    {detailModal.data.address && (
                      <p className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span>Địa điểm: {detailModal.data.address}</span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              {detailModal.data.classRoomId && (
                <Link
                  to={`/my-classes?classId=${detailModal.data.classRoomId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-black text-white hover:bg-brand-primary/95 transition-all shadow-xs"
                >
                  <Video size={13} />
                  Vào lớp học & Điểm danh
                  <ArrowRight size={13} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </StudentPageScaffold>
  );
}
