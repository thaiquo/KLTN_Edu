import React, { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Trophy,
  Save,
  Pencil,
  X
} from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
  { value: 7, label: 'Chủ nhật', short: 'CN' }
];

const PERIODS = [
  { value: 'MORNING', label: 'Sáng', time: '07:00 – 12:59', icon: '🌅' },
  { value: 'AFTERNOON', label: 'Chiều', time: '13:00 – 17:59', icon: '☀️' },
  { value: 'EVENING', label: 'Tối', time: '18:00 – 22:59', icon: '🌙' }
];

export function PollWeeklyCalendar({
  poll,
  isTutorView = false,
  userRole = '',
  authenticated = false,
  onSaveVotes = undefined,
  isVoting = false,
  onConvert = undefined,
  canConvert = false,
  defaultExpanded = true
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const allOpts = poll?.options || [];
  const userVotedIds = poll?.userVotedOptionIds || (poll?.userVotedOptionId ? [poll.userVotedOptionId] : []);
  const savedSelectionKey = userVotedIds.map(id => String(id)).sort().join('|');
  const [draftSelectedIds, setDraftSelectedIds] = useState(() => userVotedIds.map(id => String(id)));
  const [isEditingSelection, setIsEditingSelection] = useState(userVotedIds.length === 0);
  const maxVotes = poll?.maxVotesPerUser || poll?.sessionsPerWeek || 2;
  const selectionLimitReached = draftSelectedIds.length >= maxVotes;
  const targetMilestone = poll?.minVotesTarget || 10;
  const reachedTarget = (poll?.participantCount || 0) >= targetMilestone;
  const isClosed = Boolean(poll?.isClosed || (poll?.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now()));

  useEffect(() => {
    const savedIds = savedSelectionKey ? savedSelectionKey.split('|') : [];
    setDraftSelectedIds(savedIds);
    setIsEditingSelection(savedIds.length === 0 && !isClosed);
  }, [poll?.id, savedSelectionKey, isClosed]);

  const draftSelectedIdSet = useMemo(() => new Set(draftSelectedIds), [draftSelectedIds]);
  const hasSelectionChanges = useMemo(
    () => [...draftSelectedIds].sort().join('|') !== savedSelectionKey,
    [draftSelectedIds, savedSelectionKey]
  );

  const toggleDraftOption = (optionId) => {
    const id = String(optionId);
    setDraftSelectedIds(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (current.length >= maxVotes) return current;
      return [...current, id];
    });
  };

  const cancelEditing = () => {
    setDraftSelectedIds(savedSelectionKey ? savedSelectionKey.split('|') : []);
    setIsEditingSelection(false);
  };

  const saveSelection = async () => {
    if (!onSaveVotes || !hasSelectionChanges || isVoting) return;
    try {
      await onSaveVotes(draftSelectedIds.map(Number));
      setIsEditingSelection(false);
    } catch {
      // Keep the draft editable so the student can retry without reselecting.
    }
  };

  // Map option period safely
  const getPeriod = (opt) => {
    if (opt.timePeriod) return opt.timePeriod;
    const hour = Number(String(opt.startTime || '00:00').slice(0, 2));
    if (hour < 13) return 'MORNING';
    if (hour < 18) return 'AFTERNOON';
    return 'EVENING';
  };

  const optionsBySlot = useMemo(() => {
    const map = new Map();
    allOpts.forEach(opt => {
      const key = `${opt.dayOfWeek}-${getPeriod(opt)}`;
      const options = map.get(key) || [];
      options.push(opt);
      map.set(key, options);
    });
    map.forEach(options => options.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || ''))));
    return map;
  }, [allOpts]);

  // Top ranked options by vote count
  const topRankedOptions = useMemo(() => {
    return [...allOpts]
      .filter(o => (o.voteCount || 0) > 0)
      .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
      .slice(0, 3);
  }, [allOpts]);

  const highestVoteCount = topRankedOptions[0]?.voteCount || 0;

  const dayLabelMap = {
    1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật'
  };
  const periodLabelMap = {
    MORNING: 'Sáng', AFTERNOON: 'Chiều', EVENING: 'Tối'
  };

  if (!poll) return null;

  return (
    <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-4 transition-all">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold">
              <Clock className="w-4 h-4" />
            </span>
            <h5 className="font-bold text-slate-900 text-sm md:text-base">
              {poll.question || 'Khảo sát ca học mong muốn'}
            </h5>
            {isClosed && (
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                Đã khóa bình chọn
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">
              Lớp dự kiến: <b className="text-indigo-600">{poll.sessionsPerWeek || 2} buổi/tuần</b> ({poll.durationMinutes || 90} phút/buổi)
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-600">
              <b className="text-indigo-600">{poll.participantCount || 0}</b> học viên tham gia, <b className="text-slate-800">{poll.totalVotes || 0}</b> lượt chọn ca
            </span>
          </div>
        </div>

        {/* Voting guide badge */}
        <div className="flex items-center gap-2">
          {isTutorView && (
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
              Chỉ xem thống kê
            </span>
          )}
          {userRole === 'STUDENT' && authenticated && !isClosed && (
            <span className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-bold shadow-xs">
              {isEditingSelection ? 'Đang chọn' : 'Đã lưu'}: <b className="text-indigo-600">{draftSelectedIds.length}/{maxVotes}</b> ca
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            title={isExpanded ? 'Thu gọn lịch' : 'Xem lịch đầy đủ'}
          >
            <span>{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Progress Bar for Milestone */}
      <div className="mb-4">
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${reachedTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(100, (((poll.participantCount || 0) / targetMilestone) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
          <span>
            {reachedTarget
              ? `✅ Đã đạt mốc quan tâm tham khảo của gia sư (${poll.participantCount || 0}/${targetMilestone} học viên)`
              : `Còn ${Math.max(0, targetMilestone - (poll.participantCount || 0))} học viên để đạt mốc tham khảo (${poll.participantCount || 0}/${targetMilestone} học viên)`}
          </span>
          <span>{poll.totalVotes || 0} lượt vote</span>
        </div>
      </div>

      {userRole === 'STUDENT' && authenticated && !isClosed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-600">
            {isEditingSelection
              ? `Chọn tối đa ${maxVotes} ca rồi lưu một lần.`
              : 'Lựa chọn đã được lưu. Bấm chỉnh sửa nếu bạn muốn thay đổi.'}
          </p>
          <div className="flex items-center gap-2">
            {!isEditingSelection ? (
              <button
                type="button"
                onClick={() => setIsEditingSelection(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Chỉnh sửa lựa chọn
              </button>
            ) : (
              <>
                {userVotedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isVoting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Hủy
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveSelection}
                  disabled={isVoting || !hasSelectionChanges}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isVoting ? 'Đang lưu...' : 'Lưu lựa chọn'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tutor Statistical Report & Recommendation Box */}
      {isTutorView && (
        <div className="mb-4 p-3.5 rounded-2xl bg-white border border-indigo-100/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Trophy className="w-4 h-4" />
              </span>
              <div>
                <h6 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <span>Thống kê nhu cầu & Đề xuất mở lớp</span>
                  {topRankedOptions.length > 0 && (
                    <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                      Hot
                    </span>
                  )}
                </h6>
                <p className="text-[11px] text-slate-500">
                  Hệ thống phân tích ca học được vote nhiều nhất để đề xuất lịch khớp với lịch rảnh của bạn
                </p>
              </div>
            </div>

            {canConvert && onConvert && (
              <button
                type="button"
                onClick={onConvert}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md hover:shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>🚀 Mở lớp theo đề xuất</span>
              </button>
            )}
          </div>

          {/* Top Options List */}
          <div className="mt-3">
            {topRankedOptions.length === 0 ? (
              <div className="py-2 text-center text-xs text-slate-500 italic">
                Chưa có lượt bình chọn nào. Các ca học dưới đây đang chờ học viên vào vote.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topRankedOptions.map((opt, idx) => {
                  const rankBadge = idx === 0 ? '🥇 Top 1' : idx === 1 ? '🥈 Top 2' : '🥉 Top 3';
                  const rankColor = idx === 0
                    ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                    : idx === 1
                      ? 'border-indigo-200 bg-indigo-50/60 text-indigo-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800';

                  return (
                    <div
                      key={opt.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${rankColor}`}
                    >
                      <div>
                        <span className="inline-block text-[10px] font-black uppercase tracking-wider mb-0.5">
                          {rankBadge}
                        </span>
                        <div className="font-bold">
                          {dayLabelMap[opt.dayOfWeek]} • {periodLabelMap[getPeriod(opt)]}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm block">
                          {opt.voteCount || 0} vote
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          ({opt.votePercentage || 0}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7-DAY WEEKLY CALENDAR (Collapsible or Full) */}
      {isExpanded && (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[700px] grid grid-cols-7 gap-2">
            {DAYS.map(day => (
              <div
                key={day.value}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col"
              >
                {/* Day Column Header */}
                <div className="bg-slate-100/80 px-2 py-2 text-center border-b border-slate-200/80">
                  <span className="text-xs font-black text-slate-800 block">{day.label}</span>
                </div>

                {/* 3 Period Option Cards for this day */}
                <div className="p-2 space-y-2 flex-1 flex flex-col justify-between">
                  {PERIODS.map(period => {
                    const periodOptions = optionsBySlot.get(`${day.value}-${period.value}`) || [];
                    if (periodOptions.length === 0) {
                      return (
                        <div
                          key={period.value}
                          className="w-full min-h-[72px] rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-2 text-left opacity-60 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                              <span>{period.icon}</span>
                              <span>{period.label}</span>
                            </div>
                            <span className="block text-[10px] text-slate-400 mt-0.5 leading-tight">
                              {period.time}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 italic">Chưa mở khảo sát</span>
                        </div>
                      );
                    }

                    return (
                      <div key={period.value} className="space-y-1.5">
                        {periodOptions.map(opt => {
                          const isUserChoice = draftSelectedIdSet.has(String(opt.id));
                          const isTop = highestVoteCount > 0 && (opt.voteCount || 0) === highestVoteCount;
                          const canParticipate = !isClosed && userRole === 'STUDENT' && authenticated;
                          const canToggleOption = canParticipate
                            && isEditingSelection
                            && (isUserChoice || !selectionLimitReached);
                          const isLegacySlot = periodOptions.length > 1;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                if (canToggleOption) toggleDraftOption(opt.id);
                              }}
                              disabled={isVoting || !canToggleOption}
                              aria-pressed={isUserChoice}
                              title={isEditingSelection && selectionLimitReached && !isUserChoice
                                ? `Bạn đã chọn đủ ${maxVotes} ca. Hãy bỏ chọn một ca trước khi đổi.`
                                : undefined}
                              className={`w-full min-h-[72px] relative overflow-hidden rounded-xl border p-2 text-left transition-all flex flex-col justify-between ${canToggleOption ? 'cursor-pointer active:scale-98' : 'cursor-default'
                                } ${isUserChoice
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50'
                                  : isTop
                                    ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-slate-900'
                                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 text-slate-800'
                                } ${selectionLimitReached && !isUserChoice && canParticipate ? 'opacity-55' : ''}`}
                            >
                              {!isUserChoice && (
                                <div
                                  className={`absolute left-0 top-0 bottom-0 opacity-15 transition-all duration-500 ${isTop ? 'bg-amber-500' : 'bg-indigo-600'
                                    }`}
                                  style={{ width: `${opt.votePercentage || 0}%` }}
                                />
                              )}

                              <div className="relative z-10">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-[11px] font-bold flex items-center gap-1">
                                    <span>{period.icon}</span>
                                    <span>{period.label}</span>
                                  </span>
                                  {isUserChoice ? (
                                    <span className="w-3.5 h-3.5 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold text-[9px]">
                                      ✓
                                    </span>
                                  ) : isTop ? (
                                    <span className="px-1 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] shadow-2xs">
                                      Hot
                                    </span>
                                  ) : null}
                                </div>

                                <span className={`block text-[10px] leading-tight mb-1.5 ${isUserChoice ? 'text-indigo-100' : 'text-slate-400'}`}>
                                  {isLegacySlot && opt.startTime && opt.endTime
                                    ? `${opt.startTime} – ${opt.endTime}`
                                    : period.time}
                                </span>

                                <div className="flex items-center justify-between text-[10px] font-semibold border-t pt-1 border-current/15">
                                  <span>{opt.voteCount || 0} vote</span>
                                  <span>{opt.votePercentage || 0}%</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PollWeeklyCalendar;
