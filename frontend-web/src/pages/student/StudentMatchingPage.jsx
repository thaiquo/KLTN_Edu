import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Laptop,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  Target,
  WalletCards
} from 'lucide-react';
import { referenceApi } from '../../api/reference';
import { studentMatchingApi } from '../../api/studentMatching';
import { teachingCatalogApi } from '../../api/teachingRegistrations';
import { StudentPageScaffold } from './StudentPageScaffold';

const DAY_OPTIONS = [
  { value: '2', label: 'Thứ 2' },
  { value: '3', label: 'Thứ 3' },
  { value: '4', label: 'Thứ 4' },
  { value: '5', label: 'Thứ 5' },
  { value: '6', label: 'Thứ 6' },
  { value: '7', label: 'Thứ 7' },
  { value: '8', label: 'Chủ nhật' }
];

const INITIAL_FORM = {
  programTypeId: '',
  educationLevelId: '',
  categoryId: '',
  subjectId: '',
  levelId: '',
  teachingMode: '',
  budgetMin: '',
  budgetMax: '',
  provinceCode: '',
  communeCode: '',
  preferredSchedules: [
    { dayOfWeek: '2', startTime: '18:00', endTime: '20:00' }
  ],
  learningGoal: ''
};

export function StudentMatchingPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [catalog, setCatalog] = useState({ programTypes: [], educationLevels: [], categories: [], subjects: [], levels: [] });
  const [locations, setLocations] = useState({ provinces: [], communes: [] });
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [validatedInput, setValidatedInput] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    Promise.all([
      teachingCatalogApi.programTypes().catch(() => []),
      teachingCatalogApi.educationLevels().catch(() => []),
      referenceApi.provinces().catch(() => [])
    ]).then(([programTypes, educationLevels, provinces]) => {
      if (!active) return;
      setCatalog((current) => ({
        ...current,
        programTypes: Array.isArray(programTypes) ? programTypes : [],
        educationLevels: Array.isArray(educationLevels) ? educationLevels : []
      }));
      setLocations((current) => ({ ...current, provinces: Array.isArray(provinces) ? provinces : [] }));
    }).finally(() => {
      if (active) setLoadingCatalog(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!form.programTypeId) {
      setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] }));
      return;
    }
    teachingCatalogApi
      .categories(form.programTypeId, form.educationLevelId || undefined)
      .then((categories) => setCatalog((current) => ({ ...current, categories: categories || [], subjects: [], levels: [] })))
      .catch(() => setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] })));
  }, [form.programTypeId, form.educationLevelId]);

  useEffect(() => {
    if (!form.categoryId) {
      setCatalog((current) => ({ ...current, subjects: [], levels: [] }));
      return;
    }
    teachingCatalogApi
      .subjects(form.categoryId)
      .then((subjects) => setCatalog((current) => ({ ...current, subjects: subjects || [], levels: [] })))
      .catch(() => setCatalog((current) => ({ ...current, subjects: [], levels: [] })));
  }, [form.categoryId]);

  useEffect(() => {
    if (!form.subjectId) {
      setCatalog((current) => ({ ...current, levels: [] }));
      return;
    }
    teachingCatalogApi
      .levels(form.subjectId)
      .then((levels) => setCatalog((current) => ({ ...current, levels: levels || [] })))
      .catch(() => setCatalog((current) => ({ ...current, levels: [] })));
  }, [form.subjectId]);

  useEffect(() => {
    if (!form.provinceCode || form.teachingMode !== 'OFFLINE') {
      setLocations((current) => ({ ...current, communes: [] }));
      return;
    }
    referenceApi
      .communes(form.provinceCode)
      .then((communes) => setLocations((current) => ({ ...current, communes: Array.isArray(communes) ? communes : [] })))
      .catch(() => setLocations((current) => ({ ...current, communes: [] })));
  }, [form.provinceCode, form.teachingMode]);

  const selectedLabels = useMemo(() => ({
    subject: findById(catalog.subjects, form.subjectId)?.name,
    level: findById(catalog.levels, form.levelId)?.name,
    province: findByCode(locations.provinces, form.provinceCode)?.name,
    commune: findByCode(locations.communes, form.communeCode)?.name
  }), [catalog, locations, form]);

  function updateField(name, value) {
    setValidatedInput(null);
    setError('');
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'programTypeId') {
        next.educationLevelId = '';
        next.categoryId = '';
        next.subjectId = '';
        next.levelId = '';
      } else if (name === 'educationLevelId') {
        next.categoryId = '';
        next.subjectId = '';
        next.levelId = '';
      } else if (name === 'categoryId') {
        next.subjectId = '';
        next.levelId = '';
      } else if (name === 'subjectId') {
        next.levelId = '';
      } else if (name === 'teachingMode' && value === 'ONLINE') {
        next.provinceCode = '';
        next.communeCode = '';
      } else if (name === 'provinceCode') {
        next.communeCode = '';
      }
      return next;
    });
  }

  function updateSchedule(index, name, value) {
    setValidatedInput(null);
    setFieldErrors((current) => ({ ...current, schedules: undefined }));
    setForm((current) => ({
      ...current,
      preferredSchedules: current.preferredSchedules.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [name]: value } : slot
      )
    }));
  }

  function addSchedule() {
    setForm((current) => ({
      ...current,
      preferredSchedules: [...current.preferredSchedules, { dayOfWeek: '4', startTime: '18:00', endTime: '20:00' }]
    }));
  }

  function removeSchedule(index) {
    setValidatedInput(null);
    setForm((current) => ({
      ...current,
      preferredSchedules: current.preferredSchedules.filter((_, slotIndex) => slotIndex !== index)
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setValidatedInput(null);

    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Vui lòng kiểm tra lại các trường được đánh dấu.');
      return;
    }

    const payload = buildPayload(form);
    setSubmitting(true);
    try {
      const response = await studentMatchingApi.validateInput(payload);
      setValidatedInput(response);
    } catch (submitError) {
      setError(submitError.message || 'Không thể kiểm tra dữ liệu Matching lúc này.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudentPageScaffold
      eyebrow="Student Matching"
      title="Tìm gia sư phù hợp với nhu cầu của bạn"
      description="EduConnect sẽ sử dụng các tiêu chí bạn cung cấp để tìm những gia sư phù hợp với nhu cầu học tập. Thông tin càng đầy đủ, kết quả gợi ý sau này càng phù hợp."
    >
      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <FormSection
            icon={<BookOpen size={20} />}
            title="Bạn muốn học gì?"
            description="Chọn đúng môn và cấp độ từ danh mục giảng dạy hiện có."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Chương trình">
                <select value={form.programTypeId} onChange={(event) => updateField('programTypeId', event.target.value)} className={controlClass()}>
                  <option value="">{loadingCatalog ? 'Đang tải...' : 'Chọn chương trình'}</option>
                  {catalog.programTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Cấp học">
                <select value={form.educationLevelId} onChange={(event) => updateField('educationLevelId', event.target.value)} className={controlClass()}>
                  <option value="">Chọn cấp học</option>
                  {catalog.educationLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Lĩnh vực">
                <select value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)} className={controlClass()} disabled={!form.programTypeId}>
                  <option value="">{form.programTypeId ? 'Chọn lĩnh vực' : 'Chọn chương trình trước'}</option>
                  {catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Môn học" error={fieldErrors.subjectId}>
                <select value={form.subjectId} onChange={(event) => updateField('subjectId', event.target.value)} className={controlClass(Boolean(fieldErrors.subjectId))} disabled={!form.categoryId}>
                  <option value="">{form.categoryId ? 'Chọn môn học' : 'Chọn lĩnh vực trước'}</option>
                  {catalog.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Cấp độ muốn học" error={fieldErrors.levelId}>
                <select value={form.levelId} onChange={(event) => updateField('levelId', event.target.value)} className={controlClass(Boolean(fieldErrors.levelId))} disabled={!form.subjectId}>
                  <option value="">{form.subjectId ? 'Chọn cấp độ' : 'Chọn môn học trước'}</option>
                  {catalog.levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={<Sparkles size={20} />}
            title="Bạn muốn học như thế nào?"
            description="Hình thức học là tiêu chí bắt buộc cho Matching Input."
          >
            <Field label="Hình thức học" error={fieldErrors.teachingMode}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeButton
                  active={form.teachingMode === 'ONLINE'}
                  icon={<Laptop size={18} />}
                  title="Online"
                  description="Học qua phòng học trực tuyến."
                  onClick={() => updateField('teachingMode', 'ONLINE')}
                />
                <ModeButton
                  active={form.teachingMode === 'OFFLINE'}
                  icon={<MapPin size={18} />}
                  title="Trực tiếp"
                  description="Ưu tiên gia sư phù hợp với khu vực học."
                  onClick={() => updateField('teachingMode', 'OFFLINE')}
                />
              </div>
            </Field>
          </FormSection>

          <FormSection
            icon={<WalletCards size={20} />}
            title="Ngân sách mỗi buổi"
            description="Ngân sách được hiểu là VND cho một buổi học."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Từ" error={fieldErrors.budgetMin}>
                <input value={form.budgetMin} onChange={(event) => updateField('budgetMin', event.target.value)} className={controlClass(Boolean(fieldErrors.budgetMin))} inputMode="numeric" placeholder="200000" />
              </Field>
              <Field label="Đến" error={fieldErrors.budgetMax}>
                <input value={form.budgetMax} onChange={(event) => updateField('budgetMax', event.target.value)} className={controlClass(Boolean(fieldErrors.budgetMax))} inputMode="numeric" placeholder="300000" />
              </Field>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">Ví dụ: 200.000đ → 300.000đ / buổi.</p>
          </FormSection>

          {form.teachingMode === 'OFFLINE' && (
            <FormSection
              icon={<MapPin size={20} />}
              title="Khu vực học trực tiếp"
              description="Chọn khu vực mong muốn, không cần nhập địa chỉ nhà."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tỉnh / Thành phố">
                  <select value={form.provinceCode} onChange={(event) => updateField('provinceCode', event.target.value)} className={controlClass()}>
                    <option value="">Chọn tỉnh / thành phố</option>
                    {locations.provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Xã / Phường">
                  <select value={form.communeCode} onChange={(event) => updateField('communeCode', event.target.value)} className={controlClass()} disabled={!form.provinceCode}>
                    <option value="">{form.provinceCode ? 'Chọn xã / phường' : 'Chọn tỉnh trước'}</option>
                    {locations.communes.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
              </div>
            </FormSection>
          )}

          <FormSection
            icon={<CalendarDays size={20} />}
            title="Khi nào bạn có thể học?"
            description="Có thể thêm nhiều khung giờ ưu tiên trong tuần."
          >
            <div className="space-y-3">
              {form.preferredSchedules.map((slot, index) => (
                <div key={`${index}-${slot.dayOfWeek}`} className="grid gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <select value={slot.dayOfWeek} onChange={(event) => updateSchedule(index, 'dayOfWeek', event.target.value)} className={controlClass()}>
                    {DAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                  <input value={slot.startTime} onChange={(event) => updateSchedule(index, 'startTime', event.target.value)} className={controlClass()} type="time" aria-label="Giờ bắt đầu" />
                  <input value={slot.endTime} onChange={(event) => updateSchedule(index, 'endTime', event.target.value)} className={controlClass()} type="time" aria-label="Giờ kết thúc" />
                  <button type="button" onClick={() => removeSchedule(index)} disabled={form.preferredSchedules.length <= 1} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40">
                    <Minus size={15} /> Xóa
                  </button>
                </div>
              ))}
            </div>
            {fieldErrors.schedules && <p className="mt-2 text-xs font-bold text-rose-600">{fieldErrors.schedules}</p>}
            <button type="button" onClick={addSchedule} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-blue-100 bg-blue-50 px-4 text-sm font-black text-primary hover:bg-blue-100">
              <Plus size={16} /> Thêm khung giờ
            </button>
          </FormSection>

          <FormSection
            icon={<Target size={20} />}
            title="Mục tiêu học tập"
            description="Viết ngắn gọn nhu cầu cụ thể cho lần tìm gia sư này."
          >
            <Field label="Mục tiêu học tập" error={fieldErrors.learningGoal}>
              <textarea
                value={form.learningGoal}
                onChange={(event) => updateField('learningGoal', event.target.value)}
                className={`${controlClass(Boolean(fieldErrors.learningGoal))} min-h-32 py-3`}
                maxLength={1200}
                placeholder="Ôn thi tốt nghiệp THPT, cần củng cố phần hàm số và hình học."
              />
            </Field>
            <p className="mt-2 text-right text-xs font-bold text-slate-400">{form.learningGoal.length}/1200</p>
          </FormSection>

          {error && <Message tone="error" icon={<AlertCircle size={18} />} text={error} />}
          {validatedInput && <Message tone="success" icon={<CheckCircle2 size={18} />} text="Matching Input đã được kiểm tra và sẵn sàng cho Phase 4. Chưa có xếp hạng hoặc gợi ý gia sư trong phase này." />}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={submitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-6 text-sm font-black text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Đang kiểm tra...' : 'Kiểm tra Matching Input'} <ArrowRight size={17} />
            </button>
            <button type="button" onClick={() => { setForm(INITIAL_FORM); setValidatedInput(null); setError(''); setFieldErrors({}); }} className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 hover:bg-slate-50">
              Làm lại
            </button>
          </div>
        </div>

        <aside className="space-y-5">
          <SummaryCard form={form} labels={selectedLabels} validatedInput={validatedInput} />
          <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Ranh giới Phase 3.5.2</p>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-slate-600">
              <p>Trang này chỉ tạo và kiểm tra dữ liệu đầu vào cho Matching.</p>
              <p>Không xếp hạng gia sư, không tính điểm phù hợp, không gọi AI/LLM và không lưu Matching Input vào database.</p>
            </div>
          </section>
        </aside>
      </form>
    </StudentPageScaffold>
  );
}

function FormSection({ icon, title, description, children }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)] sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-primary">{icon}</span>
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
      {label}
      {children}
      {error && <span className="text-xs font-bold normal-case tracking-normal text-rose-600">{error}</span>}
    </label>
  );
}

function ModeButton({ active, icon, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-[92px] rounded-[8px] border p-4 text-left transition ${active ? 'border-primary bg-blue-50 text-primary shadow-[0_10px_24px_rgba(37,99,235,.10)]' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}>
      <span className="inline-flex items-center gap-2 text-sm font-black">{icon} {title}</span>
      <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{description}</span>
    </button>
  );
}

function SummaryCard({ form, labels, validatedInput }) {
  const schedules = form.preferredSchedules || [];
  return (
    <section className="sticky top-24 rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)]">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Matching Input Preview</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-950">Nhu cầu học tập</h2>
      <div className="mt-5 grid gap-3">
        <SummaryRow icon={<BookOpen size={15} />} label="Môn" value={labels.subject || 'Chưa chọn'} />
        <SummaryRow icon={<Target size={15} />} label="Cấp độ" value={labels.level || 'Chưa chọn'} />
        <SummaryRow icon={form.teachingMode === 'OFFLINE' ? <MapPin size={15} /> : <Laptop size={15} />} label="Hình thức" value={modeLabel(form.teachingMode)} />
        <SummaryRow icon={<WalletCards size={15} />} label="Ngân sách" value={budgetLabel(form.budgetMin, form.budgetMax)} />
        <SummaryRow icon={<MapPin size={15} />} label="Khu vực" value={form.teachingMode === 'OFFLINE' ? [labels.commune, labels.province].filter(Boolean).join(', ') || 'Chưa chọn' : 'Không yêu cầu cho Online'} />
        <SummaryRow icon={<Clock size={15} />} label="Lịch" value={schedules.length ? `${schedules.length} khung giờ` : 'Chưa chọn'} />
      </div>
      {validatedInput && (
        <div className="mt-5 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-800"><CheckCircle2 size={16} /> Đã validate</p>
          <pre className="mt-3 max-h-80 overflow-auto rounded-[8px] bg-white p-3 text-[11px] font-semibold leading-5 text-slate-700">{JSON.stringify(validatedInput, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

function SummaryRow({ icon, label, value }) {
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

function Message({ tone, icon, text }) {
  const classes = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`inline-flex w-full items-start gap-2 rounded-[8px] border p-4 text-sm font-extrabold ${classes}`}>{icon}<span>{text}</span></div>;
}

function validateForm(value) {
  const errors = {};
  if (!value.subjectId) errors.subjectId = 'Vui lòng chọn môn học.';
  if (!value.levelId) errors.levelId = 'Vui lòng chọn cấp độ muốn học.';
  if (!value.teachingMode) errors.teachingMode = 'Vui lòng chọn hình thức học.';

  const min = parseOptionalMoney(value.budgetMin);
  const max = parseOptionalMoney(value.budgetMax);
  if (value.budgetMin && min === null) errors.budgetMin = 'Ngân sách phải là số không âm.';
  if (value.budgetMax && max === null) errors.budgetMax = 'Ngân sách phải là số không âm.';
  if (min !== null && max !== null && min > max) {
    errors.budgetMin = 'Ngân sách tối thiểu không được lớn hơn tối đa.';
    errors.budgetMax = 'Ngân sách tối đa không hợp lệ.';
  }

  if ((value.learningGoal || '').length > 1200) {
    errors.learningGoal = 'Mục tiêu học tập tối đa 1200 ký tự.';
  }

  const scheduleError = validateSchedules(value.preferredSchedules || []);
  if (scheduleError) errors.schedules = scheduleError;
  return errors;
}

function validateSchedules(schedules) {
  const keys = new Set();
  const normalized = [];
  for (const slot of schedules) {
    if (!slot.dayOfWeek || !slot.startTime || !slot.endTime) return 'Mỗi khung giờ cần đủ ngày, giờ bắt đầu và giờ kết thúc.';
    if (slot.startTime >= slot.endTime) return 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc.';
    const key = `${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
    if (keys.has(key)) return 'Các khung giờ ưu tiên không được trùng nhau.';
    keys.add(key);
    normalized.push(slot);
  }
  normalized.sort((left, right) => Number(left.dayOfWeek) - Number(right.dayOfWeek) || left.startTime.localeCompare(right.startTime));
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    if (current.dayOfWeek === next.dayOfWeek && current.endTime > next.startTime) {
      return 'Các khung giờ trong cùng một ngày không được chồng lấn.';
    }
  }
  return '';
}

function buildPayload(value) {
  return {
    subjectId: Number(value.subjectId),
    levelId: Number(value.levelId),
    teachingMode: value.teachingMode,
    budgetMin: value.budgetMin ? Number(value.budgetMin) : null,
    budgetMax: value.budgetMax ? Number(value.budgetMax) : null,
    provinceCode: value.teachingMode === 'OFFLINE' ? value.provinceCode || null : null,
    communeCode: value.teachingMode === 'OFFLINE' ? value.communeCode || null : null,
    preferredSchedules: (value.preferredSchedules || []).map((slot) => ({
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime
    })),
    learningGoal: value.learningGoal.trim() || null
  };
}

function controlClass(hasError = false) {
  return `min-h-11 w-full rounded-[8px] border bg-slate-50 px-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${hasError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-primary'}`;
}

function parseOptionalMoney(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function findById(items, id) {
  return (items || []).find((item) => String(item.id) === String(id));
}

function findByCode(items, code) {
  return (items || []).find((item) => String(item.code) === String(code));
}

function modeLabel(mode) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return 'Chưa chọn';
}

function budgetLabel(min, max) {
  const hasMin = min !== '' && min !== null && min !== undefined;
  const hasMax = max !== '' && max !== null && max !== undefined;
  if (hasMin && hasMax) return `${formatMoney(min)} - ${formatMoney(max)} / buổi`;
  if (hasMin) return `Từ ${formatMoney(min)} / buổi`;
  if (hasMax) return `Đến ${formatMoney(max)} / buổi`;
  return 'Chưa nhập';
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))}đ`;
}
