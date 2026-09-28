import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  LocateFixed,
  MapPin,
  Sparkles,
  Target,
  WalletCards,
  X
} from 'lucide-react';
import { aiMatchingApi } from '../../api/aiMatching';
import { ApiError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

const INITIAL_MESSAGE = '';
const EXAMPLE_PROMPT = 'Em đang học lớp 12, muốn tìm gia sư Toán online để ôn thi tốt nghiệp. Em yếu hình học, rảnh tối thứ 2 và thứ 4, ngân sách khoảng 250.000đ mỗi buổi.';
const HINTS = ['Ôn thi', 'Cải thiện môn yếu', 'Học online', 'Học trực tiếp', 'Buổi tối', 'Cuối tuần'];

export function AiTutorMatchingModal({ onClose, onMatched }) {
  const { user } = useAuth();
  const [step, setStep] = useState('INPUT');
  const [message, setMessage] = useState(INITIAL_MESSAGE);
  const [analyzedRequirement, setAnalyzedRequirement] = useState(null);
  const [grounding, setGrounding] = useState(null);
  const [error, setError] = useState('');
  const [freeText, setFreeText] = useState({});

  const requirement = grounding?.requirement || null;
  const blockingClarifications = (grounding?.clarifications || []).filter((item) => item.blocking);
  const optionalClarifications = (grounding?.clarifications || []).filter((item) => !item.blocking);
  const readyForMatching = Boolean(grounding?.coreMatchingReady && requirement?.subject?.id && requirement?.level?.id && requirement?.teachingMode);

  const profileLocationLabel = useMemo(() => {
    if (!user?.provinceCode && !user?.province) return '';
    return [user?.commune, user?.province].filter(Boolean).join(', ') || user?.provinceCode;
  }, [user]);

  function appendHint(hint) {
    setMessage((current) => {
      const next = current.trim();
      return next ? `${next} ${hint.toLowerCase()}.` : `${hint}. `;
    });
  }

  async function analyze() {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Bạn hãy mô tả nhu cầu học tập rõ hơn một chút trước khi phân tích.');
      return;
    }
    setError('');
    setStep('ANALYZING');
    try {
      const analysis = await aiMatchingApi.analyze(trimmed);
      if (analysis?.status === 'INVALID' || !analysis?.requirement) {
        setStep('INPUT');
        setError('Nội dung này chưa giống nhu cầu tìm gia sư. Bạn hãy mô tả môn học, trình độ hoặc mục tiêu học tập.');
        return;
      }
      setAnalyzedRequirement(analysis.requirement);
      await groundRequirement(analysis.requirement);
    } catch (analysisError) {
      setStep('INPUT');
      setError(userFriendlyError(analysisError, 'analyze'));
    }
  }

  async function groundRequirement(nextRequirement) {
    setError('');
    setStep('GROUNDING');
    try {
      const response = await aiMatchingApi.ground(nextRequirement);
      setGrounding(response);
      setStep('REVIEW');
    } catch (groundError) {
      setStep('REVIEW');
      setError(userFriendlyError(groundError, 'ground'));
    }
  }

  async function applyClarification(clarification, option) {
    const nextRequirement = patchRequirement(analyzedRequirement, clarification, option);
    setAnalyzedRequirement(nextRequirement);
    await groundRequirement(nextRequirement);
  }

  async function applyFreeText(clarification) {
    const value = (freeText[clarification.field] || '').trim();
    if (!value) return;
    await applyClarification(clarification, { name: value, value });
    setFreeText((current) => ({ ...current, [clarification.field]: '' }));
  }

  async function useProfileLocation() {
    if (!profileLocationLabel) return;
    const nextRequirement = {
      ...analyzedRequirement,
      teachingMode: analyzedRequirement?.teachingMode || 'OFFLINE',
      locationHint: profileLocationLabel
    };
    setAnalyzedRequirement(nextRequirement);
    await groundRequirement(nextRequirement);
  }

  async function confirmAndMatch() {
    if (!readyForMatching) {
      setError('Bạn cần bổ sung các thông tin bắt buộc trước khi tìm gia sư phù hợp.');
      return;
    }
    setError('');
    setStep('MATCHING');
    try {
      const response = await aiMatchingApi.matchTutors(buildMatchingPayload(requirement));
      onMatched?.(response, {
        requirement,
        originalMessage: message.trim(),
        analyzedRequirement,
        grounding
      });
    } catch (matchingError) {
      setStep('REVIEW');
      setError(userFriendlyError(matchingError, 'matching'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ai-matching-title">
      <div className="mx-auto flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[8px] bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-primary">
              <Sparkles size={14} /> Tìm gia sư bằng AI
            </p>
            <h2 id="ai-matching-title" className="mt-1 font-display text-xl font-extrabold text-slate-950 sm:text-2xl">
              Bạn đang cần một gia sư như thế nào?
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Mô tả tự nhiên bằng tiếng Việt, EduConnect sẽ kiểm tra lại với dữ liệu môn học và gia sư thật.
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Đóng tìm gia sư bằng AI">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {step === 'INPUT' || step === 'ANALYZING' || step === 'GROUNDING' ? (
            <InputStep
              message={message}
              setMessage={setMessage}
              appendHint={appendHint}
              analyze={analyze}
              busy={step === 'ANALYZING' || step === 'GROUNDING'}
              busyLabel={step === 'ANALYZING' ? 'AI đang phân tích nhu cầu của bạn...' : 'Đang kiểm tra môn học và thông tin phù hợp...'}
              error={error}
            />
          ) : (
            <ReviewStep
              requirement={requirement}
              clarifications={grounding?.clarifications || []}
              blockingClarifications={blockingClarifications}
              optionalClarifications={optionalClarifications}
              readyForMatching={readyForMatching}
              freeText={freeText}
              setFreeText={setFreeText}
              applyClarification={applyClarification}
              applyFreeText={applyFreeText}
              useProfileLocation={useProfileLocation}
              profileLocationLabel={profileLocationLabel}
              onBack={() => setStep('INPUT')}
              error={error}
              matching={step === 'MATCHING'}
            />
          )}
        </div>

        {step === 'REVIEW' || step === 'MATCHING' ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button type="button" onClick={() => setStep('INPUT')} disabled={step === 'MATCHING'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeft size={16} /> Sửa mô tả
            </button>
            <button type="button" onClick={confirmAndMatch} disabled={!readyForMatching || step === 'MATCHING'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 text-sm font-black text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50">
              {step === 'MATCHING' ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {step === 'MATCHING' ? 'Đang tìm gia sư phù hợp...' : 'Tìm gia sư phù hợp'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InputStep({ message, setMessage, appendHint, analyze, busy, busyLabel, error }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)] sm:p-6">
        <label className="grid gap-3">
          <span className="font-display text-lg font-extrabold text-slate-950">Mô tả nhu cầu học tập của bạn</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={busy}
            className="min-h-[220px] resize-y rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-primary focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            maxLength={3000}
            placeholder="Ví dụ: Em đang học lớp 12, muốn tìm gia sư Toán online để ôn thi tốt nghiệp..."
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {HINTS.map((hint) => (
            <button key={hint} type="button" onClick={() => appendHint(hint)} disabled={busy} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary hover:bg-blue-100 disabled:opacity-50">
              {hint}
            </button>
          ))}
        </div>
        <p className="mt-3 text-right text-xs font-bold text-slate-400">{message.length}/3000</p>
        {error && <InlineMessage tone="error" text={error} />}
        {busy && <InlineMessage tone="info" icon={<Loader2 size={18} className="animate-spin" />} text={busyLabel} />}
        <button type="button" onClick={analyze} disabled={busy} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-6 text-sm font-black text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          Phân tích nhu cầu
        </button>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)]">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Gợi ý nội dung</p>
          <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-slate-600">
            <p>Bạn có thể nói về môn học, trình độ, mục tiêu, phần đang gặp khó khăn, hình thức học, ngân sách, thời gian rảnh và khu vực nếu học trực tiếp.</p>
            <blockquote className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-700">
              “{EXAMPLE_PROMPT}”
            </blockquote>
          </div>
        </section>
      </aside>
    </div>
  );
}

function ReviewStep({
  requirement,
  clarifications,
  blockingClarifications,
  optionalClarifications,
  readyForMatching,
  freeText,
  setFreeText,
  applyClarification,
  applyFreeText,
  useProfileLocation,
  profileLocationLabel,
  onBack,
  error,
  matching
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={21} />
          </span>
          <div>
            <h3 className="font-display text-xl font-extrabold text-slate-950">AI đã hiểu nhu cầu của bạn</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Hãy kiểm tra lại thông tin trước khi tìm gia sư phù hợp.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ReviewItem icon={<BookOpen size={16} />} label="Môn học" value={requirement?.subject?.name || 'Cần bổ sung'} />
          <ReviewItem icon={<Target size={16} />} label="Trình độ" value={requirement?.level?.name || 'Cần bổ sung'} />
          <ReviewItem icon={<MapPin size={16} />} label="Hình thức" value={modeLabel(requirement?.teachingMode)} />
          <ReviewItem icon={<WalletCards size={16} />} label="Ngân sách" value={budgetLabel(requirement?.budget)} />
          <ReviewItem icon={<Clock size={16} />} label="Thời gian" value={scheduleLabel(requirement?.preferredSchedules)} />
          <ReviewItem icon={<LocateFixed size={16} />} label="Khu vực" value={locationLabel(requirement)} />
        </div>

        <div className="mt-5 grid gap-3">
          <TextBlock label="Mục tiêu" values={[requirement?.learningGoal]} fallback="Chưa có mô tả mục tiêu cụ thể." />
          <TextBlock label="Nội dung cần cải thiện" values={requirement?.weakTopics} fallback="Chưa nêu phần cần cải thiện." />
          <TextBlock label="Mong muốn về gia sư" values={requirement?.tutorPreferences} fallback="Chưa nêu mong muốn riêng về gia sư." />
        </div>

        {error && <InlineMessage tone="error" text={error} />}
        {!readyForMatching && <InlineMessage tone="warning" text="Bạn cần trả lời các thông tin bắt buộc trước khi tìm gia sư phù hợp." />}
        {matching && <InlineMessage tone="info" icon={<Loader2 size={18} className="animate-spin" />} text="Đang tìm gia sư phù hợp..." />}
      </section>

      <aside className="space-y-4">
        <ClarificationPanel
          title="Thông tin cần bổ sung"
          emptyText={readyForMatching ? 'Các thông tin bắt buộc đã sẵn sàng.' : 'Chưa có dữ liệu để xác nhận.'}
          clarifications={blockingClarifications}
          freeText={freeText}
          setFreeText={setFreeText}
          applyClarification={applyClarification}
          applyFreeText={applyFreeText}
        />
        <ClarificationPanel
          title="Có thể bổ sung để kết quả tốt hơn"
          emptyText="Không có gợi ý bổ sung."
          clarifications={optionalClarifications}
          freeText={freeText}
          setFreeText={setFreeText}
          applyClarification={applyClarification}
          applyFreeText={applyFreeText}
          profileLocationLabel={profileLocationLabel}
          useProfileLocation={useProfileLocation}
        />
        <button type="button" onClick={onBack} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={16} /> Sửa mô tả ban đầu
        </button>
      </aside>
    </div>
  );
}

function ClarificationPanel({ title, emptyText, clarifications, freeText, setFreeText, applyClarification, applyFreeText, profileLocationLabel, useProfileLocation }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)]">
      <h3 className="font-display text-base font-extrabold text-slate-950">{title}</h3>
      {clarifications.length === 0 ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {clarifications.map((clarification, index) => (
            <div key={`${clarification.field}-${clarification.reason}-${index}`} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-extrabold text-slate-800">{clarification.question || fallbackQuestion(clarification)}</p>
              {clarification.options?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {clarification.options.map((option) => (
                    <button key={option.value || option.code || option.id || option.name} type="button" onClick={() => applyClarification(clarification, option)} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-extrabold text-primary hover:bg-blue-50">
                      {option.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {clarification.freeTextAllowed && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={freeText[clarification.field] || ''}
                    onChange={(event) => setFreeText((current) => ({ ...current, [clarification.field]: event.target.value }))}
                    className="min-h-10 flex-1 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-primary"
                    placeholder={clarification.field === 'LOCATION' ? 'Ví dụ: Phường Sài Gòn, TP.HCM' : 'Nhập bổ sung'}
                  />
                  <button type="button" onClick={() => applyFreeText(clarification)} className="inline-flex min-h-10 items-center justify-center rounded-[8px] bg-slate-900 px-4 text-xs font-black text-white hover:bg-primary">
                    Bổ sung
                  </button>
                </div>
              )}
              {clarification.field === 'LOCATION' && profileLocationLabel && (
                <button type="button" onClick={useProfileLocation} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                  <LocateFixed size={15} /> Dùng khu vực của tôi
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-slate-100 bg-slate-50 p-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <span className="mt-1 block break-words text-sm font-extrabold text-slate-800">{value}</span>
      </span>
    </div>
  );
}

function TextBlock({ label, values, fallback }) {
  const items = Array.isArray(values) ? values.filter(Boolean) : values ? [values] : [];
  return (
    <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-800">{items.length ? items.join(', ') : fallback}</p>
    </div>
  );
}

function InlineMessage({ tone = 'info', icon, text }) {
  const classes = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800'
  }[tone] || 'border-blue-200 bg-blue-50 text-blue-800';
  return (
    <div className={`mt-4 flex items-start gap-2 rounded-[8px] border p-4 text-sm font-extrabold ${classes}`}>
      {icon || <AlertCircle size={18} />}
      <span>{text}</span>
    </div>
  );
}

function patchRequirement(requirement, clarification, option) {
  const name = option?.name || option?.value || '';
  if (clarification.field === 'SUBJECT') {
    return { ...requirement, subjectHint: name };
  }
  if (clarification.field === 'LEVEL') {
    return { ...requirement, levelHint: name };
  }
  if (clarification.field === 'TEACHING_MODE') {
    return { ...requirement, teachingMode: option?.code || option?.value || name };
  }
  if (clarification.field === 'LOCATION') {
    return { ...requirement, locationHint: name };
  }
  return requirement;
}

function buildMatchingPayload(requirement) {
  const budget = requirement?.budget || {};
  const target = budget.target ?? null;
  return {
    subjectId: requirement.subject.id,
    levelId: requirement.level.id,
    teachingMode: requirement.teachingMode,
    budgetMin: budget.min ?? target,
    budgetMax: budget.max ?? target,
    provinceCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.provinceCode || null : null,
    communeCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.communeCode || null : null,
    preferredSchedules: (requirement.preferredSchedules || [])
      .filter((slot) => slot?.dayOfWeek && slot?.startTime && slot?.endTime)
      .map((slot) => ({
        dayOfWeek: Number(slot.dayOfWeek),
        startTime: slot.startTime,
        endTime: slot.endTime
      })),
    learningGoal: requirement.learningGoal || null
  };
}

function userFriendlyError(error, stage) {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối hoặc thử lại.';
    if (error.status === 401) return 'Bạn cần đăng nhập bằng tài khoản học viên để dùng tính năng này.';
    if (error.status === 403) return 'Tính năng này chỉ dành cho học viên.';
    if (error.status === 429) return 'Dịch vụ AI đã đạt giới hạn sử dụng tạm thời. Vui lòng thử lại sau.';
    if (error.status === 503) return 'Dịch vụ AI đang tạm thời bận. Vui lòng thử lại sau.';
    if (error.status === 400) return 'Nội dung gửi lên chưa hợp lệ. Bạn hãy kiểm tra lại phần mô tả hoặc thông tin đã chọn.';
    if (error.status >= 500) {
      if (stage === 'analyze') return 'Hiện chưa thể phân tích nhu cầu bằng AI. Nội dung của bạn vẫn được giữ lại, vui lòng thử lại sau.';
      if (stage === 'ground') return 'Đang tạm thời không kiểm tra được dữ liệu môn học hoặc khu vực. Vui lòng thử lại sau.';
      return 'Đang tạm thời không tìm được gia sư phù hợp. Vui lòng thử lại sau.';
    }
  }
  return error?.message || 'Yêu cầu chưa thực hiện được. Vui lòng thử lại.';
}

function fallbackQuestion(clarification) {
  if (clarification.field === 'SUBJECT') return 'Bạn đang muốn học môn nào?';
  if (clarification.field === 'LEVEL') return 'Bạn muốn học ở trình độ nào?';
  if (clarification.field === 'TEACHING_MODE') return 'Bạn muốn học online hay trực tiếp?';
  if (clarification.field === 'LOCATION') return 'Bạn muốn học trực tiếp ở khu vực nào?';
  return 'Bạn có muốn bổ sung thông tin này không?';
}

function modeLabel(mode) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return 'Cần bổ sung';
}

function budgetLabel(budget) {
  if (!budget) return 'Chưa nêu ngân sách';
  if (budget.min && budget.max && Number(budget.min) !== Number(budget.max)) return `${formatMoney(budget.min)} - ${formatMoney(budget.max)} / buổi`;
  if (budget.target) return `${budget.approximate ? 'Khoảng ' : ''}${formatMoney(budget.target)} / buổi`;
  if (budget.min) return `Từ ${formatMoney(budget.min)} / buổi`;
  if (budget.max) return `Đến ${formatMoney(budget.max)} / buổi`;
  return 'Chưa nêu ngân sách';
}

function scheduleLabel(schedules = []) {
  const labels = schedules
    .filter(Boolean)
    .map((slot) => {
      const day = dayLabel(slot.dayOfWeek);
      if (slot.startTime && slot.endTime) return `${day} · ${slot.startTime} - ${slot.endTime}`;
      if (slot.timeOfDayHint) return `${day} · ${timeOfDayLabel(slot.timeOfDayHint)}`;
      return day;
    });
  return labels.length ? labels.join('; ') : 'Chưa nêu thời gian';
}

function locationLabel(requirement) {
  if (requirement?.teachingMode === 'ONLINE') return 'Không yêu cầu cho Online';
  const location = requirement?.location;
  if (location?.provinceName || location?.communeName) {
    return [location.communeName, location.provinceName].filter(Boolean).join(', ');
  }
  return requirement?.locationHint || 'Có thể bổ sung để kết quả phù hợp hơn';
}

function dayLabel(value) {
  const number = Number(value);
  if (number === 8) return 'Chủ nhật';
  if (number >= 2 && number <= 7) return `Thứ ${number}`;
  return 'Thời gian linh hoạt';
}

function timeOfDayLabel(value) {
  if (value === 'MORNING') return 'Buổi sáng';
  if (value === 'AFTERNOON') return 'Buổi chiều';
  if (value === 'EVENING') return 'Buổi tối';
  if (value === 'NIGHT') return 'Buổi đêm';
  return 'Thời gian linh hoạt';
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))}đ`;
}
