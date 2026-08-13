import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Save } from 'lucide-react';
import { tutorApplicationApi } from '../../../api/tutorApplications';

export function EducationExperienceStep({ application, readOnly, onApplicationUpdated, onBack, onNext }) {
  const [form, setForm] = useState(() => ({
    educationLevel: application?.educationLevel || '',
    institution: application?.institution || '',
    major: application?.major || '',
    experienceSummary: application?.experienceSummary || ''
  }));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [localErrors, setLocalErrors] = useState({});

  const errors = useMemo(
    () => ({ ...validationErrors, ...localErrors }),
    [validationErrors, localErrors]
  );

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (localErrors[name]) {
      setLocalErrors((current) => ({ ...current, [name]: '' }));
    }
  }

  async function saveAndContinue(event) {
    event.preventDefault();
    if (readOnly) {
      onNext();
      return;
    }

    const nextErrors = validateEducation(form);
    if (Object.keys(nextErrors).length > 0) {
      setLocalErrors(nextErrors);
      return;
    }

    setSaving(true);
    setApiError('');
    setValidationErrors({});

    try {
      const updated = await tutorApplicationApi.updateMyTutorApplication({
        educationLevel: form.educationLevel,
        institution: form.institution,
        major: form.major,
        experienceSummary: form.experienceSummary
      });
      onApplicationUpdated?.(updated);
      onNext();
    } catch (error) {
      setValidationErrors(toValidationMap(error));
      setApiError(toFriendlyMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <StepHeader
        icon={<GraduationCap size={22} />}
        eyebrow="Bước 2"
        title="Học vấn & kinh nghiệm"
        description="Cho học viên biết nền tảng học vấn và kinh nghiệm giảng dạy của bạn. Bản nháp được phép chưa hoàn chỉnh; submit sẽ kiểm tra đầy đủ sau."
      />

      <form onSubmit={saveAndContinue} className="mt-7 rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Trình độ học vấn" error={errors.educationLevel}>
            <input
              name="educationLevel"
              value={form.educationLevel}
              onChange={change}
              placeholder="Ví dụ: Đại học, Thạc sĩ..."
              disabled={readOnly || saving}
              maxLength="120"
            />
          </Field>

          <Field label="Trường / cơ sở đào tạo" error={errors.institution}>
            <input
              name="institution"
              value={form.institution}
              onChange={change}
              placeholder="Ví dụ: Đại học Công nghiệp TP.HCM"
              disabled={readOnly || saving}
              maxLength="255"
            />
          </Field>

          <Field label="Chuyên ngành" error={errors.major}>
            <input
              name="major"
              value={form.major}
              onChange={change}
              placeholder="Ví dụ: Công nghệ phần mềm"
              disabled={readOnly || saving}
              maxLength="160"
            />
          </Field>
        </div>

        <label className="field mt-5">
          <span>Kinh nghiệm giảng dạy</span>
          <div>
            <textarea
              name="experienceSummary"
              value={form.experienceSummary}
              onChange={change}
              rows="5"
              maxLength="1000"
              placeholder="Tóm tắt kinh nghiệm dạy học, trợ giảng, mentoring hoặc hướng dẫn dự án..."
              disabled={readOnly || saving}
            />
          </div>
          <small className={errors.experienceSummary ? 'field-error' : 'field-hint'}>
            {errors.experienceSummary || `${form.experienceSummary.length}/1000 ký tự`}
          </small>
        </label>

        {apiError && <div className="error mt-5" role="alert">{apiError}</div>}

        <StepActions
          onBack={onBack}
          saving={saving}
          readOnly={readOnly}
          submitLabel={readOnly ? 'Tiếp tục' : 'Lưu và tiếp tục'}
        />
      </form>
    </section>
  );
}

function StepHeader({ icon, eyebrow, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>{children}</div>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function StepActions({ onBack, saving, readOnly, submitLabel }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#147b77] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {readOnly ? <ArrowRight size={16} /> : <Save size={16} />}
        {saving ? 'Đang lưu...' : submitLabel}
      </button>
    </div>
  );
}

function validateEducation(form) {
  const errors = {};
  if (form.educationLevel.length > 120) errors.educationLevel = 'Trình độ học vấn tối đa 120 ký tự.';
  if (form.institution.length > 255) errors.institution = 'Tên trường tối đa 255 ký tự.';
  if (form.major.length > 160) errors.major = 'Chuyên ngành tối đa 160 ký tự.';
  if (form.experienceSummary.length > 1000) errors.experienceSummary = 'Kinh nghiệm tối đa 1000 ký tự.';
  return errors;
}

function toValidationMap(error) {
  if (!Array.isArray(error?.validationErrors)) return {};
  return error.validationErrors.reduce((acc, item) => {
    const field = item.field || item.name;
    if (field) acc[field] = item.message || 'Dữ liệu không hợp lệ.';
    return acc;
  }, {});
}

function toFriendlyMessage(error) {
  if (error?.status === 409) return error.message || 'Hồ sơ hiện không cho phép chỉnh sửa.';
  if (error?.status === 404) return error.message || 'Không tìm thấy hồ sơ gia sư.';
  return error?.message || 'Không thể lưu dữ liệu. Vui lòng thử lại.';
}
