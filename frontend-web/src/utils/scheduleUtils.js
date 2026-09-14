export const DAY_OF_WEEK_LABELS = {
  1: 'Chủ nhật',
  2: 'Thứ 2',
  3: 'Thứ 3',
  4: 'Thứ 4',
  5: 'Thứ 5',
  6: 'Thứ 6',
  7: 'Thứ 7',
  8: 'Chủ nhật'
};

export const SHORT_DAY_LABELS = {
  1: 'CN',
  2: 'T2',
  3: 'T3',
  4: 'T4',
  5: 'T5',
  6: 'T6',
  7: 'T7',
  8: 'CN'
};

export function formatShortDay(day) {
  const num = Number(day);
  if (num === 1 || num === 8) return 'CN';
  return SHORT_DAY_LABELS[num] || `T${num}`;
}

export function formatDayOfWeek(day) {
  const num = Number(day);
  if (num === 1 || num === 8) return 'Chủ nhật';
  return DAY_OF_WEEK_LABELS[num] || `Thứ ${num}`;
}

export function formatDayOfWeekFormal(day) {
  const num = Number(day);
  if (num === 1 || num === 8) return 'Chủ Nhật';
  const formal = {
    2: 'Thứ Hai',
    3: 'Thứ Ba',
    4: 'Thứ Tư',
    5: 'Thứ Năm',
    6: 'Thứ Sáu',
    7: 'Thứ Bảy'
  };
  return formal[num] || `Thứ ${num}`;
}

export function formatTimeSlot(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const s = startTime.substring(0, 5);
  const e = endTime.substring(0, 5);
  return `${s} - ${e}`;
}

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  if (typeof timeStr !== 'string') {
    if (timeStr instanceof Date) {
      return timeStr.getHours() * 60 + timeStr.getMinutes();
    }
    return null;
  }
  if (timeStr.includes('T')) {
    const timePart = timeStr.split('T')[1];
    return parseTimeToMinutes(timePart);
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function timeToMinutes(timeStr) {
  const m = parseTimeToMinutes(timeStr);
  return m !== null ? m : 0;
}

/**
 * Checks if a class or session is currently happening right now (or starts within earlyBufferMinutes).
 * @param {Object} options
 * @param {Array} [options.schedules] - recurring weekly schedules [{ dayOfWeek, startTime, endTime }]
 * @param {Array} [options.sessions] - concrete session list [{ sessionDate, startTime, endTime, status }]
 * @param {Date} [options.currentDate] - default new Date()
 * @param {number} [options.earlyBufferMinutes] - allow entering X minutes early, default 15
 * @param {number} [options.lateBufferMinutes] - allow staying X minutes after end, default 10
 * @returns {{ isLive: boolean, reason?: string, currentSession?: Object, currentSchedule?: Object }}
 */
export function isClassLiveNow({
  schedules = [],
  sessions = [],
  currentDate = new Date(),
  earlyBufferMinutes = 15,
  lateBufferMinutes = 10
} = {}) {
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Check actual concrete sessions if available
  if (Array.isArray(sessions) && sessions.length > 0) {
    const todayY = now.getFullYear();
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;

    for (const session of sessions) {
      const status = String(session.status || '').toUpperCase();
      if (status === 'IN_PROGRESS') {
        return { isLive: true, reason: 'Buổi học đang diễn ra', currentSession: session };
      }
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        continue;
      }
      if (session.sessionDate === todayStr && session.startTime && session.endTime) {
        const startMin = parseTimeToMinutes(session.startTime);
        const endMin = parseTimeToMinutes(session.endTime);
        if (startMin !== null && endMin !== null) {
          if (nowMinutes >= startMin - earlyBufferMinutes && nowMinutes <= endMin + lateBufferMinutes) {
            const isEarly = nowMinutes < startMin;
            return {
              isLive: true,
              reason: isEarly ? 'Sắp đến giờ học (đã mở vào lớp)' : 'Buổi học đang diễn ra',
              currentSession: session
            };
          }
        }
      }
    }
  }

  // 2. Check weekly recurring schedules
  if (Array.isArray(schedules) && schedules.length > 0) {
    const jsDay = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const currentDayNum = jsDay === 0 ? 8 : jsDay + 1; // 2=T2, ..., 7=T7, 8=CN

    for (const sched of schedules) {
      const schedDay = Number(sched.dayOfWeek);
      const isToday =
        schedDay === currentDayNum ||
        (currentDayNum === 8 && schedDay === 1) ||
        (currentDayNum === 1 && schedDay === 8);

      if (isToday && sched.startTime && sched.endTime) {
        const startMin = parseTimeToMinutes(sched.startTime);
        const endMin = parseTimeToMinutes(sched.endTime);
        if (startMin !== null && endMin !== null) {
          if (nowMinutes >= startMin - earlyBufferMinutes && nowMinutes <= endMin + lateBufferMinutes) {
            const isEarly = nowMinutes < startMin;
            return {
              isLive: true,
              reason: isEarly ? 'Sắp đến giờ học (đã mở vào lớp)' : 'Lớp học đang diễn ra theo lịch',
              currentSchedule: sched
            };
          }
        }
      }
    }
  }

  return { isLive: false };
}

function datesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return true;
  return !(endA < startB || endB < startA);
}

function timesOverlap(startA, endA, startB, endB) {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
}

/**
 * Checks if targetClass schedules conflict with any of student's active recurring schedules.
 * @param {Object} targetClass - Class object with recurringSchedules, startDate, endDate
 * @param {Array} activeSchedules - Array of student's active recurring schedule items
 * @returns {Object|null} Conflict details object if conflict exists, otherwise null
 */
export function checkClassScheduleConflict(targetClass, activeSchedules) {
  if (!targetClass || !Array.isArray(activeSchedules) || activeSchedules.length === 0) {
    return null;
  }

  const targetSlots = targetClass.recurringSchedules || targetClass.schedules || [];
  if (!Array.isArray(targetSlots) || targetSlots.length === 0) {
    return null;
  }

  const targetStart = targetClass.startDate;
  const targetEnd = targetClass.endDate;

  for (const tSlot of targetSlots) {
    const tDay = Number(tSlot.dayOfWeek);
    const tStartTime = tSlot.startTime;
    const tEndTime = tSlot.endTime;

    for (const aSlot of activeSchedules) {
      if (aSlot.classRoomId === targetClass.id) continue;

      const aDay = Number(aSlot.dayOfWeek);
      if (tDay !== aDay && !(tDay === 8 && aDay === 1) && !(tDay === 1 && aDay === 8)) {
        continue;
      }

      const aStart = aSlot.startDate;
      const aEnd = aSlot.endDate;

      if (datesOverlap(targetStart, targetEnd, aStart, aEnd)) {
        if (timesOverlap(tStartTime, tEndTime, aSlot.startTime, aSlot.endTime)) {
          return {
            conflictingClassTitle: aSlot.classRoomTitle || 'Lớp đã đăng ký',
            dayOfWeek: tDay,
            dayLabel: formatDayOfWeek(tDay),
            targetTime: formatTimeSlot(tStartTime, tEndTime),
            activeTime: formatTimeSlot(aSlot.startTime, aSlot.endTime),
            activeClassId: aSlot.classRoomId
          };
        }
      }
    }
  }

  return null;
}
