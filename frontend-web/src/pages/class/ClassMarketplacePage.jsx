import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Calendar, ChevronDown, Clock, Eye, Filter,
  MapPin, RotateCcw, Search, Sparkles, Star, Users, Video
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { teachingCatalogApi } from '../../api/teachingRegistrations';
import { HomeHeader } from '../../components/home/HomeHeader';
import { AiClassSearchModal } from '../../components/matching/AiClassSearchModal';
import { PublicClassDetailModal } from './PublicClassDetailModal';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import { classMarketplaceSearchSessionStore } from '../../store/classMarketplaceSearchSessionStore';
import { formatDayOfWeek, formatTimeSlot } from '../../utils/scheduleUtils';

const PAGE_SIZE = 9;
const SELECT_CLASS = 'min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed';
const INPUT_CLASS = 'min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'soonest', label: 'Sắp khai giảng' },
  { value: 'price_asc', label: 'Học phí thấp trước' },
  { value: 'price_desc', label: 'Học phí cao trước' },
  { value: 'rating_desc', label: 'Gia sư được đánh giá cao' }
];

const WEEKDAY_OPTIONS = [
  { value: '2', label: 'T2' },
  { value: '3', label: 'T3' },
  { value: '4', label: 'T4' },
  { value: '5', label: 'T5' },
  { value: '6', label: 'T6' },
  { value: '7', label: 'T7' },
  { value: '8', label: 'CN' }
];

const DEFAULT_FILTERS = {
  keyword: '',
  levelIds: '',
  teachingMode: '',
  minPrice: '',
  maxPrice: '',
  programTypeId: '',
  educationLevelId: '',
  categoryId: '',
  weekdays: [],
  startTime: '',
  endTime: '',
  availableOnly: false
};

export function ClassMarketplacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(Math.max(Number(searchParams.get('page') || 1), 1));
  const [activeMode, setActiveMode] = useState('MANUAL');
  const [sessionRestored, setSessionRestored] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [programTypes, setProgramTypes] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogSubjects, setCatalogSubjects] = useState([]);

  const [result, setResult] = useState({
    content: [],
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    sort: 'newest'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiClassResult, setAiClassResult] = useState(null);
  const isAiMode = activeMode === 'AI' && aiClassResult;
  const marketplaceReturnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (authLoading || sessionRestored) return;

    const session = classMarketplaceSearchSessionStore.loadSession(user);
    if (session?.manual) {
      setFilters({ ...DEFAULT_FILTERS, ...(session.manual.filters || {}) });
      setPage(Math.max(Number(session.manual.page || 1), 1));
      setSort(session.manual.sort || 'newest');
    }
    if (session?.activeMode === 'AI' && session.ai?.matchingResult) {
      setAiClassResult(session.ai.matchingResult);
      setActiveMode('AI');
    } else {
      setActiveMode('MANUAL');
      setAiClassResult(null);
    }
    setSessionRestored(true);
  }, [authLoading, sessionRestored, user]);

  useEffect(() => {
    function clearPersistedClassMarketplaceSession() {
      classMarketplaceSearchSessionStore.clearAllSessions();
    }

    window.addEventListener('auth:logout', clearPersistedClassMarketplaceSession);
    window.addEventListener('auth:unauthorized', clearPersistedClassMarketplaceSession);
    return () => {
      window.removeEventListener('auth:logout', clearPersistedClassMarketplaceSession);
      window.removeEventListener('auth:unauthorized', clearPersistedClassMarketplaceSession);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      teachingCatalogApi.programTypes().catch(() => []),
      teachingCatalogApi.educationLevels().catch(() => []),
      teachingCatalogApi.groundingSnapshot().catch(() => ({ subjects: [] }))
    ]).then(([programData, educationData, snapshot]) => {
      setProgramTypes(programData || []);
      setEducationLevels(educationData || []);
      setCatalogSubjects(snapshot?.subjects || []);
    });
  }, []);

  useEffect(() => {
    if (!filters.programTypeId) {
      setCategories([]);
      return;
    }
    teachingCatalogApi
      .categories(filters.programTypeId, filters.educationLevelId || undefined)
      .then((data) => setCategories(data || []))
      .catch(() => setCategories([]));
  }, [filters.programTypeId, filters.educationLevelId]);

  const scopedSubjects = useMemo(() => {
    return catalogSubjects
      .filter((subject) => {
        const category = subject.category || {};
        if (filters.programTypeId && String(category.programType?.id) !== String(filters.programTypeId)) return false;
        if (filters.educationLevelId && String(category.educationLevel?.id) !== String(filters.educationLevelId)) return false;
        if (filters.categoryId && String(category.id) !== String(filters.categoryId)) return false;
        return true;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
  }, [catalogSubjects, filters.programTypeId, filters.educationLevelId, filters.categoryId]);

  const levelOptions = useMemo(() => {
    const groups = new Map();
    scopedSubjects.forEach((subject) => {
      (subject.levels || []).forEach((level) => {
        const key = `${normalizeLabelKey(level.name)}|${level.code || ''}|${level.type || ''}`;
        const current = groups.get(key) || { key, label: level.name, code: level.code, ids: [] };
        if (!current.ids.includes(level.id)) current.ids.push(level.id);
        groups.set(key, current);
      });
    });
    return Array.from(groups.values())
      .map((item) => ({ ...item, value: item.ids.join(',') }))
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'vi', { numeric: true }));
  }, [scopedSubjects]);

  useEffect(() => {
    if (filters.levelIds && !levelOptions.some((item) => item.value === filters.levelIds)) {
      setFilters((prev) => ({ ...prev, levelIds: '' }));
      setPage(1);
    }
  }, [filters.levelIds, levelOptions]);

  const loadClasses = useCallback(async () => {
    if (activeMode === 'AI' && aiClassResult) {
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await classApi.getPublicClasses({
        ...normalizeRequestFilters(filters),
        page: page - 1,
        size: PAGE_SIZE,
        sort
      });
      if (Array.isArray(data)) {
        setResult({ content: data, page: 0, size: data.length, totalElements: data.length, totalPages: data.length > 0 ? 1 : 0, sort });
      } else {
        setResult({
          content: data?.content || [],
          page: data?.page ?? page - 1,
          size: data?.size ?? PAGE_SIZE,
          totalElements: data?.totalElements ?? 0,
          totalPages: data?.totalPages ?? 0,
          sort: data?.sort || sort
        });
      }
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách lớp học.');
      setResult((prev) => ({ ...prev, content: [], totalElements: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [activeMode, aiClassResult, filters, page, sort]);

  useEffect(() => {
    if (authLoading || !sessionRestored) return;
    const params = new URLSearchParams();
    const detailClassId = new URLSearchParams(location.search).get('classId');
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'weekdays' && Array.isArray(value) && value.length > 0) params.set(key, value.join(','));
      else if (value === true) params.set(key, 'true');
      else if (value && !Array.isArray(value)) params.set(key, String(value));
    });
    if (page > 1) params.set('page', String(page));
    if (sort !== 'newest') params.set('sort', sort);
    if (detailClassId) params.set('classId', detailClassId);
    setSearchParams(params, { replace: true });
  }, [authLoading, filters, location.search, page, sessionRestored, sort, setSearchParams]);

  useEffect(() => {
    if (authLoading || !sessionRestored) return;
    classMarketplaceSearchSessionStore.saveManualState(user, {
      filters,
      sort,
      page
    }, { activeMode });
  }, [activeMode, authLoading, filters, page, sessionRestored, sort, user]);

  useEffect(() => {
    if (authLoading || !sessionRestored) return;
    const timer = window.setTimeout(loadClasses, 260);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadClasses, sessionRestored]);

  useRealtimeRefresh(['CLASS_REVIEWED', 'CLASS_MUTATED'], loadClasses);

  useEffect(() => {
    if (!sessionRestored) return;
    const classId = new URLSearchParams(location.search).get('classId');
    if (!classId || !/^\d+$/.test(classId)) return;
    if (selectedClass && String(selectedClass.id) === classId) return;
    setDetailLoadingId(Number(classId));
    classApi.getPublicClassById(classId)
      .then((detail) => setSelectedClass(detail))
      .catch(() => setSelectedClass(null))
      .finally(() => setDetailLoadingId(null));
  }, [location.search, selectedClass, sessionRestored]);

  const hasFilter = useMemo(() => {
    return Object.values(filters).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)) || sort !== 'newest';
  }, [filters, sort]);

  function updateFilter(name, value) {
    setActiveMode('MANUAL');
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'programTypeId') {
        next.educationLevelId = '';
        next.categoryId = '';
        next.levelIds = '';
      }
      if (name === 'educationLevelId') {
        next.categoryId = '';
        next.levelIds = '';
      }
      if (name === 'categoryId') {
        next.levelIds = '';
      }
      return next;
    });
    setPage(1);
  }

  function toggleWeekday(value) {
    setActiveMode('MANUAL');
    setFilters((prev) => {
      const selected = prev.weekdays.includes(value);
      const weekdays = selected
        ? prev.weekdays.filter((item) => item !== value)
        : [...prev.weekdays, value].sort((a, b) => Number(a) - Number(b));
      return { ...prev, weekdays };
    });
    setPage(1);
  }

  function resetFilters() {
    setActiveMode('MANUAL');
    setFilters(DEFAULT_FILTERS);
    setSort('newest');
    setPage(1);
    setAdvancedOpen(false);
  }

  function openAiSearchModal() {
    if (!authenticated) {
      navigate('/login', { state: { from: { pathname: '/classes' } } });
      return;
    }
    if (user?.activeRole !== 'STUDENT') {
      setError('Tính năng tìm lớp bằng AI chỉ dành cho học viên.');
      return;
    }
    setError('');
    setAiModalOpen(true);
  }

  function handleAiMatched(response, context = {}) {
    setAiClassResult(response || null);
    setActiveMode('AI');
    setAiModalOpen(false);
    setPage(1);
    classMarketplaceSearchSessionStore.saveAiState(user, {
      originalMessage: context.originalMessage,
      analyzedRequirement: context.analyzedRequirement,
      groundedRequirement: context.groundedRequirement,
      matchingResult: response
    });
  }

  function showManualResults() {
    setActiveMode('MANUAL');
    classMarketplaceSearchSessionStore.setActiveMode(user, 'MANUAL');
  }

  async function openClassDetail(classRoom) {
    setDetailLoadingId(classRoom.id);
    try {
      const detail = await classApi.getPublicClassById(classRoom.id);
      setSelectedClass(detail);
    } catch {
      setSelectedClass(classRoom);
    } finally {
      setDetailLoadingId(null);
    }
  }

  function closeClassDetail() {
    setSelectedClass(null);
    if (searchParams.get('classId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('classId');
      setSearchParams(next, { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950 font-sans">
      <HomeHeader />

      <main className="container-app pt-[calc(80px+28px)] pb-16">
        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="px-5 py-6 md:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <BookOpen size={14} /> Lớp học đang mở
                </span>
                <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Tìm lớp học phù hợp với mục tiêu của bạn
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Tìm theo tên lớp, môn học hoặc gia sư; sau đó tinh chỉnh bằng hình thức học, học phí và lịch rảnh của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={openAiSearchModal}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700"
              >
                <Sparkles size={17} /> Tìm lớp bằng AI
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,.06)] md:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,1.2fr)]">
            <Field label="Từ khóa">
              <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500">
                <Search size={17} className="text-slate-400" />
                <input
                  value={filters.keyword}
                  onChange={(e) => updateFilter('keyword', e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  placeholder="Tên lớp, môn học, gia sư..."
                  type="search"
                />
              </div>
            </Field>

            <Field label="Hình thức">
              <select value={filters.teachingMode} onChange={(e) => updateFilter('teachingMode', e.target.value)} className={SELECT_CLASS}>
                <option value="">Tất cả</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </Field>

            <div className="grid min-w-0 grid-cols-2 gap-2">
              <Field label="Học phí / buổi">
                <input value={formatCurrencyInput(filters.minPrice)} onChange={(e) => updateFilter('minPrice', onlyDigits(e.target.value))} className={INPUT_CLASS} inputMode="numeric" placeholder="Từ 150.000đ" />
              </Field>
              <Field label=" ">
                <input value={formatCurrencyInput(filters.maxPrice)} onChange={(e) => updateFilter('maxPrice', onlyDigits(e.target.value))} className={INPUT_CLASS} inputMode="numeric" placeholder="Đến 300.000đ" />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:border-emerald-300">
              <Filter size={16} /> Bộ lọc thêm <ChevronDown size={16} className={advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {hasFilter && (
              <button type="button" onClick={resetFilters} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-200">
                <RotateCcw size={15} /> Xóa bộ lọc
              </button>
            )}
          </div>

          {advancedOpen && (
            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Chương trình">
                <select value={filters.programTypeId} onChange={(e) => updateFilter('programTypeId', e.target.value)} className={`${SELECT_CLASS} bg-white`}>
                  <option value="">Tất cả chương trình</option>
                  {programTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Cấp học">
                <select value={filters.educationLevelId} onChange={(e) => updateFilter('educationLevelId', e.target.value)} className={`${SELECT_CLASS} bg-white`}>
                  <option value="">Tất cả cấp học</option>
                  {educationLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Nhóm môn">
                <select value={filters.categoryId} onChange={(e) => updateFilter('categoryId', e.target.value)} disabled={!filters.programTypeId} className={`${SELECT_CLASS} bg-white disabled:opacity-50`}>
                  <option value="">Tất cả nhóm môn</option>
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Trình độ">
                <select value={filters.levelIds} onChange={(e) => updateFilter('levelIds', e.target.value)} className={`${SELECT_CLASS} bg-white`}>
                  <option value="">Tất cả trình độ</option>
                  {levelOptions.map((item) => <option key={item.key} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 lg:col-span-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Những ngày bạn có thể học</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((item) => {
                    const selected = filters.weekdays.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleWeekday(item.value)}
                        className={`min-h-10 rounded-2xl border px-4 text-sm font-black transition ${selected ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 md:col-span-2">
                <Field label="Khung giờ bạn có thể học">
                  <input type="time" value={filters.startTime} onChange={(e) => updateFilter('startTime', e.target.value)} className={`${INPUT_CLASS} bg-white`} />
                </Field>
                <Field label=" ">
                  <input type="time" value={filters.endTime} onChange={(e) => updateFilter('endTime', e.target.value)} className={`${INPUT_CLASS} bg-white`} />
                </Field>
              </div>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 lg:col-span-2">
                <input type="checkbox" checked={filters.availableOnly} onChange={(e) => updateFilter('availableOnly', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Chỉ hiện lớp còn chỗ
              </label>
            </div>
          )}
        </section>

        {isAiMode && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Gợi ý lớp phù hợp</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {`${aiClassResult.results?.length || 0} lớp phù hợp với nhu cầu của bạn`}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Được sắp xếp theo điểm phù hợp EduConnect từ hệ thống gợi ý lớp học.</p>
              </div>
              <button type="button" onClick={showManualResults} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
                <ArrowLeft size={15} /> Quay lại tìm thủ công
              </button>
            </div>

            {aiClassResult.results?.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {aiClassResult.results.map((match) => {
                  const classRoom = classCardFromAiMatch(match);
                  return (
                    <PublicClassCard
                      key={classRoom.id}
                      classRoom={classRoom}
                      isAiResult
                      detailLoading={detailLoadingId === classRoom.id}
                      onOpen={() => openClassDetail(classRoom)}
                      onTutorOpen={() => classRoom.tutorProfileId && navigate(`/tutors/${classRoom.tutorProfileId}`, { state: { marketplaceReturnTo } })}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyAiClassMatches onRetry={openAiSearchModal} onShowManual={showManualResults} />
            )}
          </section>
        )}

        <section className={isAiMode ? 'hidden' : 'space-y-4'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Kết quả tìm kiếm</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {loading ? 'Đang tải lớp học...' : `${result.totalElements.toLocaleString('vi-VN')} lớp đang mở`}
              </h2>
            </div>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Sắp xếp
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={`${SELECT_CLASS} min-w-56 bg-white`}>
                {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700" role="alert">{error}</div>}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
            </div>
          ) : result.content.length === 0 ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><BookOpen size={25} /></div>
              <h3 className="mt-4 text-xl font-black text-slate-950">Chưa tìm thấy lớp phù hợp</h3>
              <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">Thử mở rộng khoảng học phí, bỏ bớt điều kiện lịch học hoặc tìm bằng từ khóa khác.</p>
              {hasFilter && <button type="button" onClick={resetFilters} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Xóa bộ lọc</button>}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {result.content.map((classRoom) => (
                  <PublicClassCard
                    key={classRoom.id}
                    classRoom={classRoom}
                    detailLoading={detailLoadingId === classRoom.id}
                    onOpen={() => openClassDetail(classRoom)}
                    onTutorOpen={() => classRoom.tutorProfileId && navigate(`/tutors/${classRoom.tutorProfileId}`)}
                  />
                ))}
              </div>
              <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
            </>
          )}
        </section>
      </main>

      {selectedClass && (
        <PublicClassDetailModal
          classRoom={selectedClass}
          onClose={closeClassDetail}
          onRefreshClass={loadClasses}
        />
      )}
      {aiModalOpen && <AiClassSearchModal onClose={() => setAiModalOpen(false)} onMatched={handleAiMatched} />}
    </div>
  );
}

function EmptyAiClassMatches({ onRetry, onShowManual }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Sparkles size={25} /></div>
      <h3 className="mt-4 text-xl font-black text-slate-950">Chưa tìm thấy lớp phù hợp với yêu cầu này.</h3>
      <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">Bạn có thể chỉnh lại mô tả nhu cầu hoặc quay về tìm thủ công để mở rộng tiêu chí.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700">
          <Sparkles size={16} /> Thử nhu cầu khác
        </button>
        <button type="button" onClick={onShowManual} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">
          Tìm thủ công
        </button>
      </div>
    </div>
  );
}

function classCardFromAiMatch(match) {
  return {
    id: match.classId,
    tutorSubjectRegistrationId: match.tutorSubjectRegistrationId,
    tutorProfileId: match.tutorProfileId,
    tutorFullName: match.tutorFullName,
    name: match.name,
    description: match.description,
    learningMode: match.teachingMode,
    address: match.address,
    registration: {
      subjectId: match.subject?.subjectId,
      subjectName: match.subject?.subjectName,
      categoryId: match.subject?.categoryId,
      categoryName: match.subject?.categoryName
    },
    level: {
      id: match.level?.levelId,
      name: match.level?.levelName
    },
    pricePerSession: match.pricePerSession,
    sessionsPerWeek: match.sessionsPerWeek,
    durationPerSessionMinutes: match.durationPerSessionMinutes,
    startDate: match.startDate,
    endDate: match.endDate,
    totalSessions: match.totalSessions,
    availableSlots: match.availableSlots,
    averageRating: match.averageRating,
    reviewCount: match.reviewCount,
    schedules: Array.isArray(match.schedules) ? match.schedules : [],
    topicChips: Array.isArray(match.topicChips) ? match.topicChips : [],
    matchPercentage: match.matchPercentage,
    matchingReasons: Array.isArray(match.matchingReasons) ? match.matchingReasons : []
  };
}

function PublicClassCard({ classRoom, onOpen, onTutorOpen, detailLoading, isAiResult = false }) {
  const tutorName = classRoom.tutorFullName || 'Gia sư EduConnect';
  const price = Number(classRoom.pricePerSession) || 0;
  const availableSlots = Number(classRoom.availableSlots ?? Math.max(0, Number(classRoom.maxStudents || 0) - Number(classRoom.acceptedCount || 0)));
  const schedules = Array.isArray(classRoom.schedules) ? classRoom.schedules.slice(0, 2) : [];
  const topicChips = Array.isArray(classRoom.topicChips) ? classRoom.topicChips.slice(0, 3) : [];
  const matchPercentage = Number(classRoom.matchPercentage);
  const matchingReasons = Array.isArray(classRoom.matchingReasons) ? classRoom.matchingReasons : [];

  return (
    <article className="group flex min-h-[360px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.055)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_24px_60px_rgba(15,23,42,.09)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="emerald">{classRoom.registration?.subjectName || 'Môn học'}</Badge>
        <Badge tone="slate">{classRoom.level?.name || 'Trình độ'}</Badge>
        <Badge tone={classRoom.learningMode === 'ONLINE' ? 'blue' : 'amber'}>
          {classRoom.learningMode === 'ONLINE' ? 'Online' : 'Offline'}
        </Badge>
        {isAiResult && Number.isFinite(matchPercentage) && <Badge tone="emerald">{Math.round(matchPercentage)}% phù hợp</Badge>}
      </div>

      <button type="button" onClick={onOpen} className="mt-4 text-left">
        <h3 className="line-clamp-2 text-xl font-black leading-snug text-slate-950 group-hover:text-emerald-700">{classRoom.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{classRoom.description || 'Lớp học đang được cập nhật mô tả chi tiết.'}</p>
      </button>

      {topicChips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topicChips.map((chip) => <span key={chip} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{chip}</span>)}
        </div>
      )}

      {isAiResult && matchingReasons.length > 0 && (
        <section className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-emerald-700">Vì sao phù hợp</p>
          <ul className="space-y-1.5">
            {matchingReasons.slice(0, 3).map((reason) => (
              <li key={reason} className="text-xs font-bold leading-5 text-emerald-800">{reason}</li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={onTutorOpen} className="mt-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left hover:bg-emerald-50">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">{getInitials(tutorName)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900">{tutorName}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-500">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              {Number(classRoom.averageRating || 0).toFixed(1)} ({classRoom.reviewCount || 0} đánh giá)
            </span>
          </span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-slate-400" />
      </button>

      <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
        <InfoRow icon={classRoom.learningMode === 'ONLINE' ? Video : MapPin}>
          {classRoom.learningMode === 'ONLINE' ? 'Học trực tuyến' : classRoom.address || 'Địa điểm offline sẽ trao đổi sau'}
        </InfoRow>
        <InfoRow icon={Calendar}>
          {formatDate(classRoom.startDate)} - {formatDate(classRoom.endDate)}
        </InfoRow>
        <InfoRow icon={Clock}>
          {schedules.length > 0
            ? schedules.map((item) => `${formatDayOfWeek(item.dayOfWeek)} ${formatTimeSlot(item.startTime, item.endTime)}`).join(', ')
            : 'Lịch học linh hoạt'}
        </InfoRow>
        <InfoRow icon={Users}>
          {availableSlots > 0 ? `Còn ${availableSlots}/${classRoom.maxStudents || '?'} chỗ` : 'Tạm hết chỗ nhận thêm'}
        </InfoRow>
      </div>

      <div className="mt-auto flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-bold text-slate-500">Học phí</p>
          <p className="text-xl font-black text-slate-950">{price > 0 ? price.toLocaleString('vi-VN') : 'Miễn phí'} <span className="text-xs font-extrabold text-slate-500">đ / buổi</span></p>
        </div>
        <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-emerald-700">
          <Eye size={16} /> {detailLoading ? 'Đang mở...' : 'Xem chi tiết'}
        </button>
      </div>
    </article>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
        <ArrowLeft size={15} /> Trước
      </button>
      <span className="text-sm font-black text-slate-600">Trang {page} / {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
        Sau <ArrowRight size={15} />
      </button>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Badge({ children, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700'
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone] || tones.slate}`}>{children}</span>;
}

function InfoRow({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      <span className="line-clamp-2">{children}</span>
    </div>
  );
}

function filtersFromSearchParams(params) {
  return {
    keyword: params.get('keyword') || '',
    levelIds: params.get('levelIds') || params.get('levelId') || '',
    teachingMode: params.get('teachingMode') || params.get('mode') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    programTypeId: params.get('programTypeId') || '',
    educationLevelId: params.get('educationLevelId') || '',
    categoryId: params.get('categoryId') || '',
    weekdays: parseWeekdays(params),
    startTime: params.get('startTime') || '',
    endTime: params.get('endTime') || '',
    availableOnly: params.get('availableOnly') === 'true'
  };
}

function normalizeRequestFilters(filters) {
  const payload = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'levelIds') {
      const ids = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
      if (ids.length > 0) payload.levelIds = ids;
    } else if (key === 'weekdays') {
      if (Array.isArray(value) && value.length > 0) payload.weekdays = value;
    } else if (value === true) {
      payload[key] = true;
    } else if (value) {
      payload[key] = value;
    }
  });
  return payload;
}

function parseWeekdays(params) {
  const values = [
    ...params.getAll('weekdays').flatMap((value) => value.split(',')),
    ...params.getAll('weekday')
  ];
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => /^[2-8]$/.test(value))))
    .sort((a, b) => Number(a) - Number(b));
}

function onlyDigits(value) {
  return value.replace(/[^\d]/g, '');
}

function formatCurrencyInput(value) {
  if (!value) return '';
  const digits = onlyDigits(String(value));
  return digits ? `${Number(digits).toLocaleString('vi-VN')}đ` : '';
}

function normalizeLabelKey(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDate(value) {
  if (!value) return 'Đang cập nhật';
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function getInitials(value) {
  return (value || 'GS')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
