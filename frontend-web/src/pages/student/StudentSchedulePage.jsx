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
  ListOrdered
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
  const [scheduleData, setScheduleData] = useState({ recurringSchedules: [], upcomingSessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'recurring' | 'sessions'
  const [weekOffset, setWeekOffset] = useState(0);

  const loadSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await classApi.getStudentSchedule();
      setScheduleData(res || { recurringSchedules: [], upcomingSessions: [] });
    } catch (err) {
      setError(err?.message || 'Không thể tải lịch học của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  useRealtimeRefresh(['ENROLLMENT_ACCEPTED', 'CLASS_MUTATED', 'ATTENDANCE_MARKED'], loadSchedule);

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

  // Sessions grouped by ISO Date string
  const sessionsByDate = useMemo(() => {
    const map = {};
    (scheduleData.upcomingSessions || []).forEach((session) => {
      const d = session.sessionDate;
      if (!map[d]) map[d] = [];
      map[d].push(session);
    });
    return map;
  }, [scheduleData.upcomingSessions]);

  // Recurring schedules grouped by dayOfWeek (2..8)
  const recurringByDay = useMemo(() => {
    const map = { 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
    (scheduleData.recurringSchedules || []).forEach((item) => {
      const d = Number(item.dayOfWeek);
      if (map[d]) {
        map[d].push(item);
      }
    });
    return map;
  }, [scheduleData.recurringSchedules]);

  const uniqueClassesCount = useMemo(() => {
    const set = new Set();
    (scheduleData.recurringSchedules || []).forEach((s) => set.add(s.classRoomId));
    (scheduleData.upcomingSessions || []).forEach((s) => set.add(s.classRoomId));
    return set.size;
  }, [scheduleData]);

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
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-800 transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
          >
            <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <Link
            to="/classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition-colors hover:bg-brand-primary"
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
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Buổi học kế tiếp</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CalendarIcon size={18} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-black text-slate-900">
            {scheduleData.upcomingSessions?.length || 0} buổi đã lên lịch
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'sessions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ListOrdered size={16} />
            Tất cả buổi học ({scheduleData.upcomingSessions?.length || 0})
          </button>
        </div>

        {activeTab === 'calendar' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              title="Tuần trước"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Tuần hiện tại
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              title="Tuần sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
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
              * Nhấp vào buổi học để xem chi tiết hoặc tham gia phòng họp
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

                  {/* Sessions on this day */}
                  <div className="space-y-2 flex-1">
                    {daySessions.length > 0 ? (
                      daySessions.map((session) => {
                        const statusMeta = STATUS_SESSION_META[session.status] || STATUS_SESSION_META.SCHEDULED;
                        return (
                          <div
                            key={session.id}
                            className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs hover:border-brand-primary/60 transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-black text-slate-900 line-clamp-1">
                                {session.classRoomTitle || 'Buổi học'}
                              </span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                            </div>

                            <p className="text-[11px] font-bold text-brand-primary flex items-center gap-1">
                              <Clock size={12} /> {formatTimeSlot(session.startTime, session.endTime)}
                            </p>

                            {session.topic && (
                              <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                                📖 {session.topic}
                              </p>
                            )}

                            {session.tutorName && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <User size={11} /> {session.tutorName}
                              </p>
                            )}

                            {session.meetingLink && (
                              <a
                                href={session.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-700 transition-colors mt-1"
                              >
                                <Video size={11} /> Vào phòng học
                              </a>
                            )}
                          </div>
                        );
                      })
                    ) : dayRecurring.length > 0 ? (
                      // Display recurring slot placeholder if no specific session instance
                      dayRecurring.map((slot, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 space-y-1"
                        >
                          <p className="text-[11px] font-black text-slate-700 line-clamp-1">
                            {slot.classRoomTitle}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Clock size={11} /> {formatTimeSlot(slot.startTime, slot.endTime)}
                          </p>
                          <span className="text-[9px] font-semibold text-slate-400">
                            Khung giờ định kỳ
                          </span>
                        </div>
                      ))
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
                        {slots.length} lớp
                      </span>
                    </div>

                    <div className="space-y-3">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-900 line-clamp-1">{slot.classRoomTitle}</h4>
                            <span className="text-[10px] font-extrabold text-brand-primary">
                              {slot.subjectName}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Clock size={13} className="text-brand-primary" />
                            {formatTimeSlot(slot.startTime, slot.endTime)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Gia sư: {slot.tutorName || 'Chưa cập nhật'}</span>
                            <span className="text-[10px] text-slate-400">
                              {slot.startDate ? `${slot.startDate} → ${slot.endDate || '...'}` : ''}
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

      {/* Tab 3: All Upcoming Sessions List */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Danh sách chi tiết từng buổi học theo lịch trình của khóa học.
            </p>
          </div>

          {scheduleData.upcomingSessions?.length === 0 ? (
            <StudentEmptyState
              title="Chưa có buổi học nào được lên lịch"
              description="Các buổi học sẽ tự động hiển thị tại đây khi gia sư bắt đầu mở lớp và lên lịch giảng dạy."
              actionLabel="Xem lớp học của tôi"
              actionHref="/my-classes"
            />
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              {scheduleData.upcomingSessions.map((session) => {
                const statusMeta = STATUS_SESSION_META[session.status] || STATUS_SESSION_META.SCHEDULED;
                return (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-sm font-black text-slate-900">
                          {session.classRoomTitle || 'Buổi học'}
                        </span>
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
                        {session.tutorName && (
                          <span className="flex items-center gap-1">
                            <User size={14} /> Gia sư: {session.tutorName}
                          </span>
                        )}
                      </div>

                      {session.topic && (
                        <p className="text-xs text-slate-600 font-medium">
                          Chủ đề: <span className="font-bold">{session.topic}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {session.meetingLink ? (
                        <a
                          href={session.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                        >
                          <Video size={14} /> Vào lớp học
                        </a>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 italic">
                          Chưa có link phòng
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
    </StudentPageScaffold>
  );
}
