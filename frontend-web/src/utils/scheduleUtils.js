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

export function formatDayOfWeek(day) {
  const num = Number(day);
  return DAY_OF_WEEK_LABELS[num] || `Thứ ${num}`;
}

export function formatTimeSlot(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const s = startTime.substring(0, 5);
  const e = endTime.substring(0, 5);
  return `${s} - ${e}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
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
