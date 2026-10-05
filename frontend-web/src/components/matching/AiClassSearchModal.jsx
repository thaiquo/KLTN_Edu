import React, { useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Loader2, Sparkles, X } from 'lucide-react';
import { aiClassSearchApi } from '../../api/aiClassSearch';
import { AiRequirementReviewLayout } from './AiRequirementReviewLayout';

const EXAMPLE_PROMPT = 'Em muốn tìm lớp Toán lớp 12 online, học tối thứ 2, 4, 6, khoảng 250k một buổi để ôn thi tốt nghiệp.';

export function AiClassSearchModal({ onClose, onMatched }) {
  const [message, setMessage] = useState('');
  const [step, setStep] = useState('input');
  const [analysis, setAnalysis] = useState(null);
  const [grounding, setGrounding] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [optionalInputs, setOptionalInputs] = useState({});

  const blockingClarifications = useMemo(() => (
    (grounding?.clarifications || []).filter((item) => item.blocking)
  ), [grounding]);

  async function handleAnalyze() {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Bạn hãy mô tả nhu cầu tìm lớp rõ hơn một chút.');
      return;
    }
    setLoading(true);
    setError('');
    setOptionalInputs({});
    try {
      const nextAnalysis = await aiClassSearchApi.analyze(trimmed);
      setAnalysis(nextAnalysis);
      if (nextAnalysis.status === 'INVALID') {
        setStep('clarify');
        setGrounding(null);
        return;
      }
      await groundRequirement(nextAnalysis.requirement);
    } catch (err) {
      setError(err?.message || 'Chưa thể phân tích nhu cầu tìm lớp.');
    } finally {
      setLoading(false);
    }
  }

  async function groundRequirement(requirement) {
    const nextGrounding = await aiClassSearchApi.ground(requirement);
    setGrounding(nextGrounding);
    setStep(nextGrounding.coreSearchReady ? 'review' : 'clarify');
  }

  async function applyClarification(clarification, option) {
    if (!analysis?.requirement) return;
    const requirement = { ...analysis.requirement };
    if (clarification.field === 'SUBJECT') {
      requirement.subjectHint = option?.name || option?.code || option?.value || requirement.subjectHint;
    } else if (clarification.field === 'LEVEL') {
      requirement.levelHint = option?.name || option?.code || option?.value || requirement.levelHint;
    } else if (clarification.field === 'TEACHING_MODE') {
      requirement.teachingMode = option?.value || option?.code || requirement.teachingMode;
      if (requirement.teachingMode === 'ONLINE') requirement.locationHint = null;
    } else if (clarification.field === 'LOCATION') {
      requirement.locationHint = option?.name || option?.value || option?.code || requirement.locationHint;
    }
    setLoading(true);
    setError('');
    try {
      const nextAnalysis = { ...analysis, requirement };
      setAnalysis(nextAnalysis);
      await groundRequirement(requirement);
    } catch (err) {
      setError(err?.message || 'Chưa thể kiểm tra lại lựa chọn.');
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setAnalysis(null);
    setGrounding(null);
    setStep('input');
    setError('');
    setOptionalInputs({});
  }

  async function handleMatch() {
    const requirement = grounding?.requirement;
    if (!grounding?.coreSearchReady || !requirement?.subject?.id || !requirement?.level?.id || !requirement?.teachingMode) {
      setError('Bạn cần bổ sung môn học, trình độ và hình thức học trước khi tìm lớp phù hợp.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const finalRequirement = mergeClassOptionalEnrichment(requirement, optionalInputs);
      const response = await aiClassSearchApi.match(finalRequirement, 20);
      onMatched?.(response, {
        originalMessage: message.trim(),
        analyzedRequirement: analysis?.requirement || null,
        groundedRequirement: finalRequirement
      });
    } catch {
      setError('Không thể tìm lớp phù hợp lúc này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <Sparkles size={14} /> Tìm lớp bằng AI
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Bạn đang muốn tìm một lớp học như thế nào?</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 md:px-6">
          {error && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {step === 'input' && (
            <div className="grid gap-4">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-44 w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder={EXAMPLE_PROMPT}
              />
              <button type="button" onClick={() => setMessage(EXAMPLE_PROMPT)} className="justify-self-start rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200">
                Dùng ví dụ
              </button>
            </div>
          )}

          {step === 'clarify' && (
            <div className="space-y-4">
              {analysis?.status === 'INVALID' && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-800">
                  AI chưa nhận ra đây là nhu cầu tìm lớp học. Bạn hãy mô tả môn học, trình độ và hình thức học mong muốn.
                </div>
              )}
              {blockingClarifications.map((clarification) => (
                <div key={`${clarification.field}-${clarification.reason}`} className="rounded-3xl border border-slate-200 p-4">
                  <p className="text-sm font-black text-slate-950">{clarification.question}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(clarification.options || []).map((option) => (
                      <button
                        key={`${clarification.field}-${option.id || option.value || option.code || option.name}`}
                        type="button"
                        onClick={() => applyClarification(clarification, option)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                      >
                        {option.name || option.value || option.code}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={resetFlow} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Nhập lại nhu cầu
              </button>
            </div>
          )}

          {step === 'review' && grounding?.requirement && (
            <ClassAiReviewStage
              requirement={grounding.requirement}
              optionalInputs={optionalInputs}
              setOptionalInputs={setOptionalInputs}
            />
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-between md:px-6">
          <button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50">
            Đóng
          </button>
          {step === 'input' && (
            <button type="button" onClick={handleAnalyze} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              Phân tích nhu cầu
            </button>
          )}
          {step === 'review' && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={resetFlow} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                <CalendarDays size={17} /> Tìm nhu cầu khác
              </button>
              <button type="button" onClick={handleMatch} disabled={loading || !grounding?.coreSearchReady} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {loading ? 'Đang tìm lớp phù hợp...' : 'Tìm lớp phù hợp'}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function ClassAiReviewStage({ requirement, optionalInputs, setOptionalInputs }) {
  const missingFields = classMissingOptionalFields(requirement);

  return (
    <AiRequirementReviewLayout
      leftTitle="AI đã hiểu nhu cầu tìm lớp"
      leftDescription="Nhu cầu đã được phân tích và đối chiếu với danh mục thật. Hãy kiểm tra lại trước khi tìm lớp phù hợp."
      leftContent={<ClassAiRequirementReview requirement={requirement} />}
      rightTitle="Bổ sung nếu bạn muốn"
      rightDescription="Chỉ những thông tin còn thiếu mới được hỏi thêm. Bạn có thể bỏ trống và tiếp tục."
      rightContent={missingFields.length > 0 ? (
        <ClassAiMissingFields
          fields={missingFields}
          values={optionalInputs}
          onChange={setOptionalInputs}
        />
      ) : null}
      emptyRightText="Thông tin đã khá đầy đủ. Bạn có thể tiếp tục tìm lớp phù hợp."
    />
  );
}

function ClassAiRequirementReview({ requirement }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ReviewItem label="Môn học" value={requirement.subject?.name} />
      <ReviewItem label="Trình độ" value={requirement.level?.name} />
      <ReviewItem label="Hình thức" value={formatMode(requirement.teachingMode)} />
      <ReviewItem label="Ngân sách" value={formatBudget(requirement.budget)} />
      <ReviewItem label="Lịch có thể học" value={formatSchedules(requirement.availableSchedules)} wide />
      <ReviewItem label="Mục tiêu" value={requirement.learningGoal} wide />
      <ReviewItem label="Nội dung cần cải thiện" value={formatList(requirement.weakTopics)} wide />
      <ReviewItem label="Ưu tiên lớp học" value={formatList(requirement.classPreferences)} wide />
    </div>
  );
}

function ClassAiMissingFields({ fields, values, onChange }) {
  return (
    <section className="space-y-4">
      {fields.map((field) => (
        <label key={field.name} className="grid gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
          <span className="text-sm font-extrabold leading-6 text-slate-800">{field.label}</span>
          <textarea
            value={values[field.name] || ''}
            onChange={(event) => onChange((current) => ({ ...current, [field.name]: event.target.value }))}
            className="min-h-20 resize-y rounded-[8px] border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-emerald-500"
            placeholder={field.placeholder}
          />
        </label>
      ))}
    </section>
  );
}

function ReviewItem({ label, value, wide = false }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-slate-50 p-4 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-extrabold leading-6 text-slate-950">{value || 'Chưa có'}</p>
    </div>
  );
}

function formatMode(value) {
  if (value === 'ONLINE') return 'Trực tuyến';
  if (value === 'OFFLINE') return 'Trực tiếp';
  return null;
}

function formatBudget(budget) {
  if (!budget) return null;
  const money = (value) => value == null ? null : `${Number(value).toLocaleString('vi-VN')}đ`;
  if (budget.min && budget.max) return `${money(budget.min)} - ${money(budget.max)} / buổi`;
  if (budget.max) return `Tối đa ${money(budget.max)} / buổi`;
  if (budget.min) return `Từ ${money(budget.min)} / buổi`;
  if (budget.target) return `${budget.approximate ? 'Khoảng ' : ''}${money(budget.target)} / buổi`;
  return null;
}

function formatSchedules(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return null;
  return schedules.map((item) => {
    const day = item.dayOfWeek ? weekdayLabel(item.dayOfWeek) : 'Ngày linh hoạt';
    if (item.startTime && item.endTime) return `${day} ${item.startTime}-${item.endTime}`;
    if (item.timeOfDayHint) return `${day} ${timeOfDayLabel(item.timeOfDayHint)}`;
    return day;
  }).join(', ');
}

function weekdayLabel(day) {
  if (Number(day) === 8) return 'Chủ nhật';
  return `Thứ ${day}`;
}

function timeOfDayLabel(value) {
  const labels = {
    MORNING: 'buổi sáng',
    AFTERNOON: 'buổi chiều',
    EVENING: 'buổi tối',
    NIGHT: 'buổi đêm'
  };
  return labels[value] || value;
}

function formatList(values = []) {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : null;
}

function classMissingOptionalFields(requirement) {
  if (!requirement) return [];
  const fields = [];
  if (!hasText(requirement.learningGoal)) {
    fields.push({
      name: 'learningGoal',
      label: 'Bạn có muốn bổ sung mục tiêu học không?',
      placeholder: 'Ví dụ: ôn thi tốt nghiệp, lấy lại gốc, chuẩn bị kiểm tra...'
    });
  }
  if (!hasList(requirement.weakTopics)) {
    fields.push({
      name: 'weakTopics',
      label: 'Bạn có muốn bổ sung nội dung cần cải thiện không?',
      placeholder: 'Ví dụ: hình học không gian, bài vận dụng cao...'
    });
  }
  if (!hasList(requirement.classPreferences)) {
    fields.push({
      name: 'classPreferences',
      label: 'Bạn có muốn bổ sung ưu tiên cho lớp học không?',
      placeholder: 'Ví dụ: giải thích chậm, nhiều bài tập, lớp ít người...'
    });
  }
  return fields;
}

function mergeClassOptionalEnrichment(requirement, optionalInputs = {}) {
  const next = { ...requirement };
  const learningGoal = cleanText(optionalInputs.learningGoal);
  const weakTopics = splitTextList(optionalInputs.weakTopics);
  const classPreferences = splitTextList(optionalInputs.classPreferences);

  if (!hasText(next.learningGoal) && learningGoal) {
    next.learningGoal = learningGoal;
  }
  if (!hasList(next.weakTopics) && weakTopics.length > 0) {
    next.weakTopics = weakTopics;
  }
  if (!hasList(next.classPreferences) && classPreferences.length > 0) {
    next.classPreferences = classPreferences;
  }
  return next;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasList(value) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitTextList(value) {
  return cleanText(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}