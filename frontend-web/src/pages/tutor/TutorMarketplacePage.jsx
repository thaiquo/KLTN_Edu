import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Laptop,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound,
  WalletCards,
  X
} from 'lucide-react';
import { tutorApi } from '../../api/tutors';
import { teachingCatalogApi } from '../../api/teachingRegistrations';
import { referenceApi } from '../../api/reference';
import { HomeHeader } from '../../components/home/HomeHeader';

const DEFAULT_PAGE_SIZE = 9;
const DAY_OPTIONS = [
  { value: '2', label: 'Thứ 2', short: 'T2' },
  { value: '3', label: 'Thứ 3', short: 'T3' },
  { value: '4', label: 'Thứ 4', short: 'T4' },
  { value: '5', label: 'Thứ 5', short: 'T5' },
  { value: '6', label: 'Thứ 6', short: 'T6' },
  { value: '7', label: 'Thứ 7', short: 'T7' },
  { value: '8', label: 'Chủ nhật', short: 'CN' }
];

const SORT_OPTIONS = [
  { value: 'name,asc', label: 'Tên A-Z' },
  { value: 'rating,desc', label: 'Đánh giá cao' },
  { value: 'reviewCount,desc', label: 'Nhiều đánh giá' },
  { value: 'price,asc', label: 'Mức nhận dạy thấp' },
  { value: 'experience,desc', label: 'Kinh nghiệm nhiều' }
];

const INITIAL_FILTERS = {
  keyword: '',
  programTypeId: '',
  educationLevelId: '',
  categoryId: '',
  subjectId: '',
  levelId: '',
  teachingMode: '',
  provinceCode: '',
  communeCode: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  minExperience: '',
  dayOfWeek: '',
  startTime: '',
  endTime: ''
};

export function TutorMarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [keywordDraft, setKeywordDraft] = useState(searchParams.get('keyword') || '');
  const [page, setPage] = useState(toPositiveInt(searchParams.get('page'), 0));
  const [sort, setSort] = useState(searchParams.get('sort') || 'name,asc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [catalog, setCatalog] = useState({ programTypes: [], educationLevels: [], categories: [], subjects: [], levels: [] });
  const [locations, setLocations] = useState({ provinces: [], communes: [] });
  const [result, setResult] = useState(emptyPage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      teachingCatalogApi.programTypes().catch(() => []),
      teachingCatalogApi.educationLevels().catch(() => []),
      referenceApi.provinces().catch(() => [])
    ]).then(([programTypes, educationLevels, provinces]) => {
      setCatalog((current) => ({
        ...current,
        programTypes: Array.isArray(programTypes) ? programTypes : [],
        educationLevels: Array.isArray(educationLevels) ? educationLevels : []
      }));
      setLocations((current) => ({ ...current, provinces: Array.isArray(provinces) ? provinces : [] }));
    });
  }, []);

  useEffect(() => {
    if (!filters.programTypeId) {
      setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] }));
      return;
    }
    teachingCatalogApi
      .categories(filters.programTypeId, filters.educationLevelId || undefined)
      .then((categories) => setCatalog((current) => ({ ...current, categories: categories || [], subjects: [], levels: [] })))
      .catch(() => setCatalog((current) => ({ ...current, categories: [], subjects: [], levels: [] })));
  }, [filters.programTypeId, filters.educationLevelId]);

  useEffect(() => {
    if (!filters.categoryId) {
      setCatalog((current) => ({ ...current, subjects: [], levels: [] }));
      return;
    }
    teachingCatalogApi
      .subjects(filters.categoryId)
      .then((subjects) => setCatalog((current) => ({ ...current, subjects: subjects || [], levels: [] })))
      .catch(() => setCatalog((current) => ({ ...current, subjects: [], levels: [] })));
  }, [filters.categoryId]);

  useEffect(() => {
    if (!filters.subjectId) {
      setCatalog((current) => ({ ...current, levels: [] }));
      return;
    }
    teachingCatalogApi
      .levels(filters.subjectId)
      .then((levels) => setCatalog((current) => ({ ...current, levels: levels || [] })))
      .catch(() => setCatalog((current) => ({ ...current, levels: [] })));
  }, [filters.subjectId]);

  useEffect(() => {
    if (!filters.provinceCode) {
      setLocations((current) => ({ ...current, communes: [] }));
      return;
    }
    referenceApi
      .communes(filters.provinceCode)
      .then((communes) => setLocations((current) => ({ ...current, communes: Array.isArray(communes) ? communes : [] })))
      .catch(() => setLocations((current) => ({ ...current, communes: [] })));
  }, [filters.provinceCode]);

  useEffect(() => {
    setSearchParams(buildUrlParams(filters, page, sort), { replace: true });
  }, [filters, page, sort, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const data = await tutorApi.searchPublicV2({
          keyword: filters.keyword.trim() || undefined,
          programTypeId: numberOrUndefined(filters.programTypeId),
          educationLevelId: numberOrUndefined(filters.educationLevelId),
          categoryId: numberOrUndefined(filters.categoryId),
          subjectId: numberOrUndefined(filters.subjectId),
          levelId: numberOrUndefined(filters.levelId),
          teachingMode: filters.teachingMode || undefined,
          provinceCode: filters.provinceCode || undefined,
          communeCode: filters.communeCode || undefined,
          minPrice: numberOrUndefined(filters.minPrice),
          maxPrice: numberOrUndefined(filters.maxPrice),
          minRating: numberOrUndefined(filters.minRating),
          minExperience: numberOrUndefined(filters.minExperience),
          dayOfWeek: numberOrUndefined(filters.dayOfWeek),
          startTime: filters.startTime || undefined,
          endTime: filters.endTime || undefined,
          page,
          size: DEFAULT_PAGE_SIZE,
          sort
        });
        if (active) setResult(normalizePage(data));
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Không thể tải danh sách gia sư. Vui lòng thử lại.');
          setResult(emptyPage());
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, page, sort]);

  const activeChips = useMemo(() => buildActiveChips(filters, catalog, locations), [filters, catalog, locations]);
  const hasActiveFilters = activeChips.length > 0;
  const selectedSubjectId = filters.subjectId ? Number(filters.subjectId) : null;
  const selectedLevelId = filters.levelId ? Number(filters.levelId) : null;

  function updateFilter(name, value) {
    setFilters((current) => {
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
      } else if (name === 'provinceCode') {
        next.communeCode = '';
      }
      return next;
    });
    setPage(0);
  }

  function submitKeyword(event) {
    event.preventDefault();
    updateFilter('keyword', keywordDraft.trim());
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    setKeywordDraft('');
    setPage(0);
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />
      <main className="container-app pt-[calc(80px+32px)] pb-20">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,.08)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bg-slate-950 px-6 py-8 text-white md:px-9 md:py-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-100">
                <Search size={14} /> Marketplace gia sư
              </span>
              <h1 className="mt-5 max-w-4xl font-display text-[clamp(34px,5vw,58px)] font-extrabold leading-tight">
                Tìm gia sư phù hợp với mục tiêu học tập của bạn
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-slate-300">
                Khám phá đội ngũ gia sư đã được xét duyệt, so sánh môn học, kinh nghiệm,
                mức nhận dạy và lịch rảnh để lựa chọn phù hợp.
              </p>
              <form onSubmit={submitKeyword} className="mt-7 flex max-w-3xl flex-col gap-3 rounded-[8px] border border-white/15 bg-white p-2 shadow-[0_18px_48px_rgba(0,0,0,.22)] sm:flex-row">
                <label className="flex min-h-[52px] flex-1 items-center gap-3 rounded-[6px] bg-slate-50 px-4 text-slate-500">
                  <Search size={18} />
                  <span className="sr-only">Tìm theo tên gia sư</span>
                  <input
                    value={keywordDraft}
                    onChange={(event) => setKeywordDraft(event.target.value)}
                    className="w-full border-0 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Tìm theo tên gia sư..."
                    type="search"
                  />
                  {keywordDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeywordDraft('');
                        updateFilter('keyword', '');
                      }}
                      className="grid h-8 w-8 place-items-center rounded-[6px] text-slate-400 hover:bg-white hover:text-slate-700"
                      aria-label="Xóa từ khóa"
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <button type="submit" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[6px] bg-primary px-6 text-sm font-black text-white transition-colors hover:bg-primary-dark">
                  Tìm kiếm <ArrowRight size={17} />
                </button>
              </form>
            </div>
            <aside className="grid content-between gap-5 bg-slate-50 p-6 md:p-8">
              <div className="space-y-3">
                <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-indigo-100 text-indigo-700">
                  <BrainCircuit size={24} />
                </span>
                <h2 className="font-display text-2xl font-extrabold text-slate-950">Chưa biết nên chọn ai?</h2>
                <p className="text-sm font-semibold leading-7 text-slate-600">
                  EduConnect có thể hỗ trợ phân tích nhu cầu học tập và gợi ý gia sư dựa trên môn học,
                  lịch học, ngân sách và hình thức học. Tính năng AI Matching sẽ được giới thiệu khi có dữ liệu xếp hạng thật.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-extrabold text-slate-700">
                <HeroMetric icon={ShieldCheck} label="Hồ sơ xét duyệt" />
                <HeroMetric icon={Star} label="Đánh giá thật" />
                <HeroMetric icon={BookOpen} label="Môn và cấp độ" />
                <HeroMetric icon={WalletCards} label="Mức nhận dạy" />
              </div>
            </aside>
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <FilterPanel filters={filters} catalog={catalog} locations={locations} updateFilter={updateFilter} clearFilters={clearFilters} hasActiveFilters={hasActiveFilters} />
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,.05)] md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Kết quả tìm kiếm</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">
                  {loading ? 'Đang tìm gia sư phù hợp...' : hasActiveFilters ? `${result.totalElements} gia sư phù hợp với tiêu chí của bạn` : `${result.totalElements} gia sư phù hợp`}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 lg:hidden">
                  <SlidersHorizontal size={15} /> Bộ lọc
                </button>
                <label className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700">
                  Sắp xếp
                  <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} className="border-0 bg-transparent text-xs font-black text-slate-900 outline-none">
                    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {activeChips.length > 0 && <ActiveFilterChips chips={activeChips} onRemove={(key) => updateFilter(key, '')} onClear={clearFilters} />}

            {error ? (
              <ErrorState message={error} onRetry={() => setFilters((current) => ({ ...current }))} />
            ) : loading ? (
              <TutorGridSkeleton />
            ) : result.content.length === 0 ? (
              <EmptyTutors hasActiveFilters={hasActiveFilters} onReset={clearFilters} />
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  {result.content.map((tutor) => (
                    <TutorMarketplaceCard key={tutor.tutorId} tutor={tutor} selectedSubjectId={selectedSubjectId} selectedLevelId={selectedLevelId} />
                  ))}
                </div>
                <Pagination page={result.page} totalPages={result.totalPages} last={result.last} onPageChange={setPage} />
              </>
            )}
          </section>
        </div>
      </main>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 lg:hidden" role="dialog" aria-modal="true">
          <div className="ml-auto max-h-full w-full max-w-md overflow-y-auto rounded-[8px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 className="font-display text-lg font-extrabold text-slate-950">Bộ lọc gia sư</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="grid h-9 w-9 place-items-center rounded-[8px] bg-slate-100 text-slate-600" aria-label="Đóng bộ lọc">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <FilterPanel filters={filters} catalog={catalog} locations={locations} updateFilter={updateFilter} clearFilters={clearFilters} hasActiveFilters={hasActiveFilters} />
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="mt-4 inline-flex w-full items-center justify-center rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-black text-white">
                Xem kết quả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPanel({ filters, catalog, locations, updateFilter, clearFilters, hasActiveFilters }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <span className="inline-flex items-center gap-2 font-display text-sm font-extrabold text-slate-950"><Filter size={17} className="text-primary" /> Bộ lọc</span>
        {hasActiveFilters && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-rose-700"><RotateCcw size={13} /> Xóa</button>}
      </div>
      <div className="mt-5 grid gap-4">
        <Field label="Chương trình"><select value={filters.programTypeId} onChange={(event) => updateFilter('programTypeId', event.target.value)} className={controlClass()}><option value="">Tất cả chương trình</option>{catalog.programTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Cấp học"><select value={filters.educationLevelId} onChange={(event) => updateFilter('educationLevelId', event.target.value)} className={controlClass()}><option value="">Tất cả cấp học</option>{catalog.educationLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Lĩnh vực"><select value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)} className={controlClass()} disabled={!filters.programTypeId && catalog.categories.length === 0}><option value="">Tất cả lĩnh vực</option>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Môn học"><select value={filters.subjectId} onChange={(event) => updateFilter('subjectId', event.target.value)} className={controlClass()} disabled={!filters.categoryId && catalog.subjects.length === 0}><option value="">Tất cả môn học</option>{catalog.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Cấp độ"><select value={filters.levelId} onChange={(event) => updateFilter('levelId', event.target.value)} className={controlClass()} disabled={!filters.subjectId && catalog.levels.length === 0}><option value="">Tất cả cấp độ</option>{catalog.levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Hình thức học"><div className="grid grid-cols-2 gap-2"><SegmentButton active={filters.teachingMode === 'ONLINE'} onClick={() => updateFilter('teachingMode', filters.teachingMode === 'ONLINE' ? '' : 'ONLINE')} icon={Laptop}>Online</SegmentButton><SegmentButton active={filters.teachingMode === 'OFFLINE'} onClick={() => updateFilter('teachingMode', filters.teachingMode === 'OFFLINE' ? '' : 'OFFLINE')} icon={MapPin}>Trực tiếp</SegmentButton></div></Field>
        <Field label="Khu vực"><select value={filters.provinceCode} onChange={(event) => updateFilter('provinceCode', event.target.value)} className={controlClass()}><option value="">Tất cả tỉnh/thành</option>{locations.provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><select value={filters.communeCode} onChange={(event) => updateFilter('communeCode', event.target.value)} className={controlClass()} disabled={!filters.provinceCode}><option value="">Tất cả phường/xã</option>{locations.communes.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field>
        <Field label="Mức nhận dạy / buổi"><div className="grid grid-cols-2 gap-2"><input value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} className={controlClass()} inputMode="numeric" placeholder="Từ" /><input value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} className={controlClass()} inputMode="numeric" placeholder="Đến" /></div></Field>
        <Field label="Đánh giá"><select value={filters.minRating} onChange={(event) => updateFilter('minRating', event.target.value)} className={controlClass()}><option value="">Tất cả đánh giá</option><option value="4">Từ 4 sao trở lên</option><option value="3">Từ 3 sao trở lên</option><option value="2">Từ 2 sao trở lên</option></select></Field>
        <Field label="Kinh nghiệm"><select value={filters.minExperience} onChange={(event) => updateFilter('minExperience', event.target.value)} className={controlClass()}><option value="">Tất cả kinh nghiệm</option><option value="1">Từ 1 năm</option><option value="3">Từ 3 năm</option><option value="5">Từ 5 năm</option><option value="7">Từ 7 năm</option></select></Field>
        <Field label="Lịch có thể dạy"><select value={filters.dayOfWeek} onChange={(event) => updateFilter('dayOfWeek', event.target.value)} className={controlClass()}><option value="">Bất kỳ ngày nào</option>{DAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="time" value={filters.startTime} onChange={(event) => updateFilter('startTime', event.target.value)} className={controlClass()} aria-label="Giờ bắt đầu" /><input type="time" value={filters.endTime} onChange={(event) => updateFilter('endTime', event.target.value)} className={controlClass()} aria-label="Giờ kết thúc" /></div><p className="text-[11px] font-semibold normal-case leading-5 tracking-normal text-slate-500">Gia sư cần có một khung lịch bao phủ toàn bộ khoảng thời gian bạn chọn.</p></Field>
      </div>
    </div>
  );
}

function TutorMarketplaceCard({ tutor, selectedSubjectId, selectedLevelId }) {
  const capability = getDisplayCapability(tutor, selectedSubjectId);
  const hasSubjectFilter = Boolean(selectedSubjectId && capability);
  const location = formatLocation(tutor.location);
  const modes = Array.from(tutor.teachingModes || []);
  const subjects = tutor.subjects || [];
  const subjectPreview = subjects.slice(0, 4).map((item) => item.subjectName).filter(Boolean);
  const extraSubjects = Math.max(subjects.length - subjectPreview.length, 0);
  const title = hasSubjectFilter ? capability.subjectName : subjectPreview.join(' • ') || 'Gia sư EduConnect';
  const description = hasSubjectFilter ? capability.description : tutor.bio;

  return (
    <article className="group flex min-h-[360px] flex-col rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.06)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_22px_50px_rgba(15,23,42,.10)]">
      <div className="flex items-start gap-4">
        <Avatar tutor={tutor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-xl font-extrabold text-slate-950">{tutor.fullName || 'Gia sư EduConnect'}</h3>
            {tutor.approvedOrVerified && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700"><ShieldCheck size={12} /> Đã được xét duyệt</span>}
          </div>
          <RatingBadge averageRating={tutor.averageRating} reviewCount={tutor.reviewCount} />
        </div>
      </div>
      <div className="mt-5 flex-1 space-y-4">
        <section className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{hasSubjectFilter ? 'Môn phù hợp' : 'Môn nhận dạy'}</p>
              <h4 className="mt-1 font-display text-lg font-extrabold text-slate-950 line-clamp-2">{title}</h4>
            </div>
            {hasSubjectFilter && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-primary ring-1 ring-blue-100">Đúng môn lọc</span>}
          </div>
          {hasSubjectFilter ? (
            <CapabilityDetails capability={capability} selectedLevelId={selectedLevelId} />
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjectPreview.map((subject) => <span key={subject} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200">{subject}</span>)}
              {extraSubjects > 0 && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">+{extraSubjects} môn</span>}
            </div>
          )}
        </section>
        <div className="grid gap-2 sm:grid-cols-3">
          <InfoPill icon={BookOpen} label={hasSubjectFilter ? experienceLabel(capability.experienceYears) : subjectCountLabel(subjects.length)} />
          <InfoPill icon={MapPin} label={location || 'Khu vực linh hoạt'} />
          <InfoPill icon={CalendarDays} label={availabilitySummary(tutor.availability || [])} />
        </div>
        <div className="flex flex-wrap gap-2">
          {modes.length ? modes.map((mode) => (
            <span key={mode} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700">
              {mode === 'ONLINE' ? <Laptop size={13} className="text-blue-600" /> : <MapPin size={13} className="text-emerald-600" />}
              {teachingModeLabel(mode)}
            </span>
          )) : <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-500">Chưa công bố hình thức học</span>}
        </div>
        <p className="line-clamp-3 text-sm font-semibold leading-7 text-slate-600">{description || 'Gia sư đã được xét duyệt trên EduConnect. Xem hồ sơ để biết thêm thông tin giảng dạy và các lớp đang mở.'}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Mức nhận dạy / buổi</p>
          <strong className="mt-1 block font-display text-xl font-extrabold text-slate-950">{hasSubjectFilter ? formatTuitionRange(capability.tuitionMin, capability.tuitionMax) : startingTuitionLabel(tutor.startingTuition)}</strong>
        </div>
        <Link to={`/tutors/${tutor.tutorId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 text-sm font-black text-white transition-colors hover:bg-primary">
          Xem hồ sơ <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function CapabilityDetails({ capability, selectedLevelId }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(capability.levels || []).map((level) => {
          const selected = selectedLevelId && Number(level.levelId) === Number(selectedLevelId);
          return <span key={level.levelId} className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${selected ? 'bg-primary text-white ring-primary' : 'bg-white text-slate-700 ring-slate-200'}`}>{level.levelName}</span>;
        })}
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600"><Award size={14} className="text-amber-600" /> {experienceLabel(capability.experienceYears)}</span>
    </div>
  );
}

function ActiveFilterChips({ chips, onRemove, onClear }) {
  return <div className="flex flex-wrap items-center gap-2">{chips.map((chip) => <button key={chip.key} type="button" onClick={() => onRemove(chip.key)} className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary hover:border-blue-200 hover:bg-blue-100">{chip.label} <X size={13} /></button>)}<button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 hover:bg-slate-50">Xóa bộ lọc</button></div>;
}

function Pagination({ page, totalPages, last, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Phân trang gia sư">
      <button type="button" disabled={page <= 0} onClick={() => onPageChange(Math.max(page - 1, 0))} className="inline-flex min-h-10 items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /> Trước</button>
      {buildPageItems(page, totalPages).map((item, index) => item === '...' ? <span key={`ellipsis-${index}`} className="px-2 text-xs font-black text-slate-400">...</span> : <button key={item} type="button" onClick={() => onPageChange(item)} className={`grid h-10 w-10 place-items-center rounded-[8px] border text-xs font-black ${item === page ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{item + 1}</button>)}
      <button type="button" disabled={last} onClick={() => onPageChange(Math.min(page + 1, totalPages - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Sau <ChevronRight size={15} /></button>
    </nav>
  );
}

function TutorGridSkeleton() {
  return <div className="grid gap-4 xl:grid-cols-2" aria-label="Đang tải gia sư">{[1, 2, 3, 4].map((item) => <div key={item} className="h-[360px] animate-pulse rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.04)]"><div className="flex gap-4"><div className="h-16 w-16 rounded-[8px] bg-slate-100" /><div className="flex-1 space-y-3"><div className="h-5 w-2/3 rounded bg-slate-100" /><div className="h-4 w-1/2 rounded bg-slate-100" /></div></div><div className="mt-6 h-28 rounded-[8px] bg-slate-100" /><div className="mt-4 grid grid-cols-3 gap-2"><div className="h-12 rounded-[8px] bg-slate-100" /><div className="h-12 rounded-[8px] bg-slate-100" /><div className="h-12 rounded-[8px] bg-slate-100" /></div><div className="mt-5 h-12 rounded-[8px] bg-slate-100" /></div>)}</div>;
}

function EmptyTutors({ hasActiveFilters, onReset }) {
  return <div className="grid place-items-center rounded-[8px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-[0_14px_36px_rgba(15,23,42,.04)]"><span className="grid h-14 w-14 place-items-center rounded-[8px] bg-blue-50 text-primary"><UsersRound size={25} /></span><h3 className="mt-4 font-display text-2xl font-extrabold text-slate-950">{hasActiveFilters ? 'Chưa tìm thấy gia sư phù hợp' : 'Chưa có gia sư công khai'}</h3><p className="mt-2 max-w-md text-sm font-semibold leading-7 text-slate-500">{hasActiveFilters ? 'Chưa tìm thấy gia sư phù hợp với các tiêu chí đã chọn. Bạn có thể nới lỏng bộ lọc để xem thêm hồ sơ.' : 'Khi hồ sơ gia sư được xét duyệt và công khai, danh sách sẽ hiển thị tại đây.'}</p>{hasActiveFilters && <button type="button" onClick={onReset} className="mt-5 inline-flex items-center gap-2 rounded-[8px] bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-dark"><RotateCcw size={16} /> Xóa bộ lọc</button>}</div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-5 text-rose-800"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="inline-flex items-center gap-2 text-sm font-extrabold"><AlertCircle size={18} /> {message || 'Không thể tải danh sách gia sư. Vui lòng thử lại.'}</p><button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-rose-600 px-4 text-xs font-black text-white hover:bg-rose-700"><RotateCcw size={15} /> Thử lại</button></div></div>;
}

function Field({ label, children }) {
  return <label className="grid gap-2 text-xs font-black uppercase tracking-wider text-slate-800">{label}{children}</label>;
}

function SegmentButton({ active, onClick, icon: Icon, children }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 text-xs font-black transition-colors ${active ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}><Icon size={14} /> {children}</button>;
}

function InfoPill({ icon: Icon, label }) {
  return <span className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-[11px] font-extrabold text-slate-600"><Icon size={14} className="shrink-0 text-primary" /> <span className="line-clamp-2">{label}</span></span>;
}

function HeroMetric({ icon: Icon, label }) {
  return <span className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2"><Icon size={15} className="text-primary" /> {label}</span>;
}

function Avatar({ tutor }) {
  const name = tutor.fullName || 'Gia sư';
  if (tutor.avatarUrl) return <img src={tutor.avatarUrl} alt={`Ảnh đại diện của ${name}`} className="h-16 w-16 shrink-0 rounded-[8px] object-cover ring-1 ring-slate-200" loading="lazy" decoding="async" />;
  return <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[8px] bg-slate-900 font-display text-lg font-extrabold text-white shadow-[0_12px_28px_rgba(15,23,42,.18)]">{getInitials(name)}</span>;
}

function RatingBadge({ averageRating, reviewCount }) {
  const count = Number(reviewCount || 0);
  if (count < 1) return <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500"><Star size={13} /> Chưa có đánh giá</span>;
  return <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800"><Star size={13} fill="currentColor" /> {Number(averageRating || 0).toFixed(1)} ({count} đánh giá)</span>;
}

function readFilters(searchParams) {
  return { ...INITIAL_FILTERS, keyword: searchParams.get('keyword') || '', programTypeId: searchParams.get('programTypeId') || '', educationLevelId: searchParams.get('educationLevelId') || '', categoryId: searchParams.get('categoryId') || '', subjectId: searchParams.get('subjectId') || searchParams.get('subject') || '', levelId: searchParams.get('levelId') || searchParams.get('level') || '', teachingMode: searchParams.get('teachingMode') || searchParams.get('mode') || '', provinceCode: searchParams.get('provinceCode') || '', communeCode: searchParams.get('communeCode') || '', minPrice: searchParams.get('minPrice') || '', maxPrice: searchParams.get('maxPrice') || '', minRating: searchParams.get('minRating') || searchParams.get('rating') || '', minExperience: searchParams.get('minExperience') || '', dayOfWeek: searchParams.get('dayOfWeek') || '', startTime: searchParams.get('startTime') || '', endTime: searchParams.get('endTime') || '' };
}

function buildUrlParams(filters, page, sort) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });
  if (page > 0) params.set('page', String(page));
  if (sort && sort !== 'name,asc') params.set('sort', sort);
  return params;
}

function normalizePage(data) {
  return { content: Array.isArray(data?.content) ? data.content : [], page: Number(data?.page || 0), size: Number(data?.size || DEFAULT_PAGE_SIZE), totalElements: Number(data?.totalElements || 0), totalPages: Number(data?.totalPages || 0), last: Boolean(data?.last) };
}

function emptyPage() {
  return { content: [], page: 0, size: DEFAULT_PAGE_SIZE, totalElements: 0, totalPages: 0, last: true };
}

function buildActiveChips(filters, catalog, locations) {
  const chips = [];
  if (filters.keyword) chips.push({ key: 'keyword', label: `Từ khóa: ${filters.keyword}` });
  pushLookupChip(chips, 'programTypeId', 'Chương trình', filters.programTypeId, catalog.programTypes);
  pushLookupChip(chips, 'educationLevelId', 'Cấp học', filters.educationLevelId, catalog.educationLevels);
  pushLookupChip(chips, 'categoryId', 'Lĩnh vực', filters.categoryId, catalog.categories);
  pushLookupChip(chips, 'subjectId', 'Môn', filters.subjectId, catalog.subjects);
  pushLookupChip(chips, 'levelId', 'Cấp độ', filters.levelId, catalog.levels);
  if (filters.teachingMode) chips.push({ key: 'teachingMode', label: teachingModeLabel(filters.teachingMode) });
  pushLookupChip(chips, 'provinceCode', 'Khu vực', filters.provinceCode, locations.provinces, 'code');
  pushLookupChip(chips, 'communeCode', 'Phường/xã', filters.communeCode, locations.communes, 'code');
  if (filters.minPrice) chips.push({ key: 'minPrice', label: `Từ ${formatMoney(filters.minPrice)}` });
  if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Đến ${formatMoney(filters.maxPrice)}` });
  if (filters.minRating) chips.push({ key: 'minRating', label: `Từ ${filters.minRating} sao` });
  if (filters.minExperience) chips.push({ key: 'minExperience', label: `Từ ${filters.minExperience} năm` });
  if (filters.dayOfWeek) chips.push({ key: 'dayOfWeek', label: dayLabel(filters.dayOfWeek) });
  if (filters.startTime) chips.push({ key: 'startTime', label: `Sau ${filters.startTime}` });
  if (filters.endTime) chips.push({ key: 'endTime', label: `Trước ${filters.endTime}` });
  return chips;
}

function pushLookupChip(chips, key, prefix, value, items, idKey = 'id') {
  if (!value) return;
  const item = (items || []).find((entry) => String(entry[idKey]) === String(value));
  chips.push({ key, label: `${prefix}: ${item?.name || value}` });
}

function getDisplayCapability(tutor, selectedSubjectId) {
  const subjects = tutor.subjects || [];
  if (!selectedSubjectId) return subjects[0] || null;
  return subjects.find((item) => Number(item.subjectId) === Number(selectedSubjectId)) || subjects[0] || null;
}

function buildPageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index);
  const items = new Set([0, totalPages - 1, page, page - 1, page + 1]);
  const sorted = Array.from(items).filter((item) => item >= 0 && item < totalPages).sort((a, b) => a - b);
  return sorted.reduce((acc, item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) acc.push('...');
    acc.push(item);
    return acc;
  }, []);
}

function controlClass() {
  return 'min-h-10 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';
}

function numberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))}đ`;
}

function formatTuitionRange(min, max) {
  if (min && max && Number(min) !== Number(max)) return `${formatMoney(min)} - ${formatMoney(max)} / buổi`;
  if (min) return `${formatMoney(min)} / buổi`;
  if (max) return `${formatMoney(max)} / buổi`;
  return 'Liên hệ';
}

function startingTuitionLabel(value) {
  return value ? `Từ ${formatMoney(value)} / buổi` : 'Liên hệ';
}

function teachingModeLabel(mode) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return mode || 'Linh hoạt';
}

function formatLocation(location) {
  if (!location) return '';
  return [location.communeName, location.provinceName].filter(Boolean).join(', ');
}

function availabilitySummary(slots = []) {
  if (!slots.length) return 'Chưa công bố lịch';
  const days = [...new Set(slots.map((slot) => dayShort(slot.dayOfWeek)).filter(Boolean))];
  if (days.length && days.length <= 4) return `Rảnh ${days.join(', ')}`;
  if (days.length > 4) return `Rảnh ${days.length} ngày trong tuần`;
  return `Rảnh ${slots.length} khung giờ`;
}

function dayLabel(value) {
  return DAY_OPTIONS.find((day) => String(day.value) === String(value))?.label || `Thứ ${value}`;
}

function dayShort(value) {
  return DAY_OPTIONS.find((day) => String(day.value) === String(value))?.short;
}

function experienceLabel(value) {
  const number = Number(value || 0);
  return number > 0 ? `${number} năm kinh nghiệm` : 'Kinh nghiệm đang cập nhật';
}

function subjectCountLabel(count) {
  return count > 0 ? `${count} môn nhận dạy` : 'Chưa có môn công khai';
}

function getInitials(value) {
  return (value || 'Tutor').trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}
