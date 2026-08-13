import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageSquareText, Save } from 'lucide-react';
import { tutorApplicationApi } from '../../../api/tutorApplications';

export function IntroductionStep({ application, readOnly, onApplicationUpdated, onBack, onNext }) {
  const [bio, setBio] = useState(application?.bio || '');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [localError, setLocalError] = useState('');

  const bioError = useMemo(
    () => validationErrors.bio || localError,
    [validationErrors, localError]
  );

  function change(event) {
    setBio(event.target.value);
    if (localError) setLocalError('');
  }

  async function saveAndContinue(event) {
    event.preventDefault();
    if (readOnly) {
      onNext();
      return;
    }

    if (bio.length > 3000) {
      setLocalError('Giới thiệu không được vượt quá 3000 ký tự.');
      return;
    }

    setSaving(true);
    setApiError('');
    setValidationErrors({});

    try {
      const updated = await tutorApplicationApi.updateMyTutorApplication({ bio });
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
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
          <MessageSquareText size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Bước 4</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            Giới thiệu hồ sơ
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
            Viết một đoạn ngắn để học viên hiểu phong cách dạy, kinh nghiệm và đối tượng bạn phù hợp.
          </p>
        </div>
      </div>

      <form onSubmit={saveAndContinue} className="mt-7 rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
        <label className="field">
          <span>Giới thiệu bản thân với học viên</span>
          <div>
            <textarea
              value={bio}
              onChange={change}
              rows="9"
              maxLength="3000"
              placeholder="Ví dụ: Tôi thường dạy theo hướng thực hành, giải thích từ nền tảng và điều chỉnh tốc độ theo từng học viên..."
              disabled={readOnly || saving}
            />
          </div>
          <small className={bioError ? 'field-error' : 'field-hint'}>
            {bioError || `${bio.length}/3000 ký tự`}
          </small>
        </label>

        <div className="mt-5 rounded-[8px] bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
          Gợi ý: nhắc đến môn bạn mạnh nhất, cách bạn hỗ trợ học viên, và kiểu học viên phù hợp với bạn. Không cần viết quá dài.
        </div>

        {apiError && <div className="error mt-5" role="alert">{apiError}</div>}

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
            {saving ? 'Đang lưu...' : readOnly ? 'Tiếp tục' : 'Lưu và tiếp tục'}
          </button>
        </div>
      </form>
    </section>
  );
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
  return error?.message || 'Không thể lưu giới thiệu. Vui lòng thử lại.';
}
