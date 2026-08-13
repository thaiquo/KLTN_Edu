import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';

export function ApplicationSubjectForm({
  subject,
  initialValue,
  mode = 'add',
  busy,
  apiError,
  validationErrors,
  onCancel,
  onSubmit
}) {
  const [form, setForm] = useState(() => ({
    levels: initialValue?.levels?.length ? initialValue.levels : [],
    oneToOneHourlyRate: initialValue?.oneToOneHourlyRate ? String(Number(initialValue.oneToOneHourlyRate)) : '',
    experienceYears: initialValue?.experienceYears ?? 0,
    description: initialValue?.description || ''
  }));
  const [localErrors, setLocalErrors] = useState({});

  const errors = useMemo(() => ({ ...validationErrors, ...localErrors }), [validationErrors, localErrors]);
  const categoryName = subject?.category?.name || subject?.category || 'Chưa phân loại';
  const groupName = subject?.group?.name || subject?.group;
  const supportedLevels = subject?.supportedLevels || [];

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (localErrors[name]) setLocalErrors((current) => ({ ...current, [name]: '' }));
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;

    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setLocalErrors(nextErrors);
      return;
    }

    onSubmit({
      levels: form.levels,
      oneToOneHourlyRate: Number(form.oneToOneHourlyRate),
      experienceYears: Number(form.experienceYears),
      description: form.description.trim() || null
    });
  }

  function toggleLevel(level) {
    setForm((current) => ({
      ...current,
      levels: current.levels.includes(level)
        ? current.levels.filter((item) => item !== level)
        : [...current.levels, level]
    }));
    if (localErrors.levels) setLocalErrors((current) => ({ ...current, levels: '' }));
  }

  return (
    <form onSubmit={submit} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">
            {mode === 'edit' ? 'Chỉnh sửa môn' : 'Thêm môn'}
          </p>
          <h3 className="mt-1 font-display text-2xl font-extrabold text-slate-950">{subject?.name}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {groupName ? `${categoryName} · ${groupName}` : categoryName}
          </p>
          {mode === 'edit' && (
            <p className="mt-2 text-xs font-bold text-slate-400">
              Môn học không đổi trong chế độ sửa. Muốn đổi môn, hãy xóa và thêm môn khác.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Cấp độ bạn muốn dạy</span>
          {supportedLevels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {supportedLevels.map((level) => {
                const selected = form.levels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    disabled={busy}
                    className={`rounded-full border px-3 py-2 text-xs font-extrabold transition-colors ${
                      selected
                        ? 'border-[#147b77] bg-[#147b77] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary/40 hover:text-primary'
                    } disabled:opacity-60`}
                    aria-pressed={selected}
                  >
                    {levelLabels[level] || level}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-[8px] bg-red-50 p-3 text-sm font-bold text-red-700">
              Môn này chưa có cấp độ hỗ trợ trong catalog.
            </p>
          )}
          {(errors.levels || errors['levels']) && (
            <small className="field-error mt-2 block">{errors.levels || errors['levels']}</small>
          )}
        </div>

        <FieldError label="Học phí 1:1 dự kiến / giờ" error={errors.oneToOneHourlyRate}>
          <input
            name="oneToOneHourlyRate"
            value={form.oneToOneHourlyRate}
            onChange={change}
            inputMode="numeric"
            placeholder="180000"
            disabled={busy}
          />
        </FieldError>

        <FieldError label="Kinh nghiệm với môn này" error={errors.experienceYears}>
          <div className="flex items-center">
            <input
              name="experienceYears"
              type="number"
              min="0"
              step="1"
              value={form.experienceYears}
              onChange={change}
              disabled={busy}
            />
            <span className="px-3 text-sm font-extrabold text-slate-500">năm</span>
          </div>
        </FieldError>
      </div>

      <label className="field mt-5">
        <span>Mô tả kinh nghiệm</span>
        <div>
          <textarea
            name="description"
            value={form.description}
            onChange={change}
            maxLength="1000"
            rows="4"
            placeholder="Ví dụ: Có kinh nghiệm hướng dẫn Java Core cho sinh viên năm 1-2..."
            disabled={busy}
          />
        </div>
        <small className={errors.description ? 'field-error' : 'field-hint'}>
          {errors.description || `${form.description.length}/1000 ký tự`}
        </small>
      </label>

      {apiError && <div className="error mt-5" role="alert">{apiError}</div>}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          <X size={16} />
          Hủy
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-5 py-3 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          <Save size={16} />
          {busy ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Thêm môn'}
        </button>
      </div>
    </form>
  );
}

function FieldError({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>{children}</div>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function validate(form) {
  const errors = {};
  const rate = Number(form.oneToOneHourlyRate);
  const years = Number(form.experienceYears);

  if (!Array.isArray(form.levels) || form.levels.length === 0) {
    errors.levels = 'Vui lòng chọn ít nhất một cấp độ dạy.';
  }
  if (!form.oneToOneHourlyRate || Number.isNaN(rate) || rate <= 0) {
    errors.oneToOneHourlyRate = 'Vui lòng nhập học phí lớn hơn 0.';
  }
  if (form.experienceYears === '' || Number.isNaN(years) || years < 0 || !Number.isInteger(years)) {
    errors.experienceYears = 'Kinh nghiệm phải là số nguyên không âm.';
  }
  if (form.description.length > 1000) {
    errors.description = 'Mô tả không được vượt quá 1000 ký tự.';
  }
  return errors;
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};
