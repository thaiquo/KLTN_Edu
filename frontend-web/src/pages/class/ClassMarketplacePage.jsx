import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import {
  BookOpen, Calendar, Clock, DollarSign, Eye, Filter, Globe, Key, MapPin,
  Search, SlidersHorizontal, Users, Video, ShieldCheck, ArrowRight
} from 'lucide-react';
import { classApi } from '../../api/classes';
import { teachingCatalogApi } from '../../api/teachingRegistrations';
import { HomeHeader } from '../../components/home/HomeHeader';
import { PublicClassDetailModal } from './PublicClassDetailModal';

const VIETNAMESE_DAYS = [
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 8, label: 'CN' }
];

export function ClassMarketplacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Real DB Filter State
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    programTypeId: searchParams.get('programTypeId') || '',
    educationLevelId: searchParams.get('educationLevelId') || '',
    categoryId: searchParams.get('categoryId') || '',
    subjectId: searchParams.get('subjectId') || '',
    levelId: searchParams.get('levelId') || '',
    mode: searchParams.get('mode') || '',
    tutorEmail: searchParams.get('tutorEmail') || ''
  });

  // Dynamic Catalog Dropdowns from DB via teachingCatalogApi
  const [programTypes, setProgramTypes] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [levels, setLevels] = useState([]);

  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Class Modal
  const [selectedClass, setSelectedClass] = useState(null);

  // 1. Fetch Program Types & Education Levels on Mount
  useEffect(() => {
    Promise.all([
      teachingCatalogApi.programTypes().catch(() => []),
      teachingCatalogApi.educationLevels().catch(() => [])
    ]).then(([progData, eduData]) => {
      setProgramTypes(progData || []);
      setEducationLevels(eduData || []);
    });
  }, []);

  // 2. Fetch Categories when Program Type or Education Level changes
  useEffect(() => {
    if (!filters.programTypeId) {
      setCategories([]);
      return;
    }
    teachingCatalogApi.categories(filters.programTypeId, filters.educationLevelId || undefined)
      .then((data) => setCategories(data || []))
      .catch(() => setCategories([]));
  }, [filters.programTypeId, filters.educationLevelId]);

  // 3. Fetch Subjects when Category changes
  useEffect(() => {
    if (!filters.categoryId) {
      setSubjects([]);
      return;
    }
    teachingCatalogApi.subjects(filters.categoryId)
      .then((data) => setSubjects(data || []))
      .catch(() => setSubjects([]));
  }, [filters.categoryId]);

  // 4. Fetch Levels when Subject changes
  useEffect(() => {
    if (!filters.subjectId) {
      setLevels([]);
      return;
    }
    teachingCatalogApi.levels(filters.subjectId)
      .then((data) => setLevels(data || []))
      .catch(() => setLevels([]));
  }, [filters.subjectId]);

  // 5. Load Published Classes from DB
  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await classApi.getPublicClasses({
        keyword: filters.keyword.trim(),
        programTypeId: filters.programTypeId ? Number(filters.programTypeId) : undefined,
        educationLevelId: filters.educationLevelId ? Number(filters.educationLevelId) : undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
        subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
        levelId: filters.levelId ? Number(filters.levelId) : undefined,
        mode: filters.mode || undefined,
        tutorEmail: filters.tutorEmail.trim() || undefined
      });

      setClassList(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách lớp học.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadClasses, 280);
    return () => window.clearTimeout(timer);
  }, [loadClasses]);

  // Real-time refresh when a class is reviewed (approved/rejected) or mutated (visibility/details changed)
  useRealtimeRefresh(['CLASS_REVIEWED', 'CLASS_MUTATED'], loadClasses);

  const selectedProgram = programTypes.find((p) => String(p.id) === String(filters.programTypeId));
  const isAcademic = selectedProgram?.code === 'ACADEMIC';
  const hasFilter = Object.values(filters).some(Boolean);

  function updateFilter(e) {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
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
      }
      return next;
    });
  }

  function resetFilters() {
    setFilters({
      keyword: '',
      programTypeId: '',
      educationLevelId: '',
      categoryId: '',
      subjectId: '',
      levelId: '',
      mode: '',
      tutorEmail: ''
    });
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />

      <main className="container-app pt-[calc(80px+36px)] pb-20 space-y-7">
        
        {/* Banner */}
        <section className="rounded-[28px] bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-8 text-white shadow-[0_26px_70px_rgba(15,23,42,.16)] md:px-9 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-100 border border-white/10">
                <BookOpen size={14} /> Danh mục Lớp học Công khai
              </p>
              <h1 className="mt-4 font-display text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.05] tracking-tight">
                Tìm lớp học phù hợp cho bạn
              </h1>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-300">
                Lọc các lớp học theo Loại chương trình, Cấp học, Lĩnh vực chuyên môn, Môn học và Lớp trình độ trực tiếp từ Database.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-5 space-y-1 backdrop-blur-xs">
              <p className="text-xs font-bold text-slate-200">
                💡 Dữ liệu môn học và chương trình được đồng bộ thời gian thực từ Database hệ thống.
              </p>
            </div>
          </div>
        </section>

        {/* Real Hierarchical Catalog Filter Section */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,.06)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-display font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-primary" /> Bộ lọc danh mục giảng dạy thực tế:
            </span>
            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Keyword */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Từ khóa tìm kiếm
              <span className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500">
                <Search size={16} />
                <input
                  name="keyword"
                  value={filters.keyword}
                  onChange={updateFilter}
                  className="w-full border-0 bg-transparent text-xs font-bold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="Tên lớp, mô tả, gia sư..."
                  type="search"
                />
              </span>
            </label>

            {/* 2. Program Type */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Loại chương trình
              <select
                name="programTypeId"
                value={filters.programTypeId}
                onChange={updateFilter}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary"
              >
                <option value="">Tất cả chương trình</option>
                {programTypes.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 3. Education Level (only if Academic) */}
            {isAcademic && (
              <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
                Cấp học
                <select
                  name="educationLevelId"
                  value={filters.educationLevelId}
                  onChange={updateFilter}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary"
                >
                  <option value="">Tất cả cấp học</option>
                  {educationLevels.map((edu) => (
                    <option key={edu.id} value={edu.id}>
                      {edu.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* 4. Category */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Lĩnh vực / Nhóm môn
              <select
                name="categoryId"
                value={filters.categoryId}
                onChange={updateFilter}
                disabled={!filters.programTypeId && categories.length === 0}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary disabled:opacity-50"
              >
                <option value="">Tất cả lĩnh vực</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 5. Subject */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Môn học
              <select
                name="subjectId"
                value={filters.subjectId}
                onChange={updateFilter}
                disabled={!filters.categoryId && subjects.length === 0}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary disabled:opacity-50"
              >
                <option value="">Tất cả môn học</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 6. Level */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Trình độ / Lớp học
              <select
                name="levelId"
                value={filters.levelId}
                onChange={updateFilter}
                disabled={!filters.subjectId && levels.length === 0}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary disabled:opacity-50"
              >
                <option value="">Tất cả lớp / trình độ</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 7. Mode */}
            <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              Hình thức học
              <select
                name="mode"
                value={filters.mode}
                onChange={updateFilter}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary"
              >
                <option value="">Tất cả hình thức</option>
                <option value="ONLINE">Học Online (Google Meet/Zoom)</option>
                <option value="OFFLINE">Học Offline (Tại địa điểm)</option>
              </select>
            </label>

          </div>
        </section>

        {/* Classes Grid */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-primary">Class Catalog</p>
              <h2 className="mt-0.5 font-display text-2xl font-extrabold text-slate-950">
                Danh sách lớp học mở bán
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 shadow-2xs">
              <Filter size={14} /> {loading ? 'Đang lọc...' : `${classList.length} lớp học`}
            </span>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[300px] animate-pulse rounded-[22px] border border-slate-200 bg-white p-5 space-y-4">
                  <div className="h-6 w-1/3 rounded-full bg-slate-100" />
                  <div className="h-5 w-3/4 rounded bg-slate-100" />
                  <div className="h-12 w-full rounded-2xl bg-slate-100" />
                  <div className="h-10 w-full rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : classList.length === 0 ? (
            <div className="grid place-items-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center space-y-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-brand-primary">
                <BookOpen size={24} />
              </span>
              <h3 className="font-display text-xl font-extrabold text-slate-950">Không tìm thấy lớp học nào</h3>
              <p className="max-w-md text-xs font-semibold leading-6 text-slate-500">
                {hasFilter
                  ? 'Thử nới lỏng từ khóa hoặc chọn bộ lọc môn học khác.'
                  : 'Hiện chưa có lớp học nào mở bán công khai. Vui lòng quay lại sau!'}
              </p>
              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-[14px] bg-brand-primary px-5 py-2.5 text-xs font-extrabold text-white hover:bg-brand-primary/90"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {classList.map((cls) => {
                const tutorName = getTutorDisplayName(cls);
                const VND_PER_USDC = 25000;
                const pricePerSession = Number(cls.pricePerSession) || 0;
                const totalSessionsFromChapters = Array.isArray(cls.chapters)
                  ? cls.chapters.reduce((sum, ch) => sum + (Number(ch.sessionCount) || 0), 0)
                  : 0;
                const totalSessions = cls.totalSessions || totalSessionsFromChapters || 0;
                const totalCoursePriceVnd = pricePerSession * totalSessions;
                const totalCoursePriceUsdc = (totalCoursePriceVnd / VND_PER_USDC).toFixed(2);

                return (
                  <article 
                    key={cls.id} 
                    className="flex flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,.06)] transition-all hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-[0_24px_56px_rgba(15,23,42,.1)] group cursor-pointer"
                    onClick={() => setSelectedClass(cls)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-[11px] font-black uppercase tracking-wider">
                          {cls.registration?.subjectName || 'Môn học'} &bull; {cls.level?.name || 'Cấp độ'}
                        </span>
                        {cls.joinMode === 'INVITE_KEY' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                            <Key className="w-3 h-3 text-sky-600" /> Cần Mã Mời
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-display font-black text-lg text-slate-900 group-hover:text-brand-primary transition-colors line-clamp-1">
                          {cls.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1">
                          {cls.description || 'Lớp học chất lượng cao.'}
                        </p>
                      </div>

                      {/* Tutor Owner Header Card */}
                      <div 
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cls.tutorProfileId) {
                            navigate(`/tutors/${cls.tutorProfileId}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {tutorName.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-black text-slate-800 truncate">{tutorName}</span>
                        </div>
                        <span className="text-[10px] font-bold text-brand-primary flex items-center gap-0.5 shrink-0">
                          {cls.tutorProfileId ? 'Xem hồ sơ' : 'Thiếu hồ sơ'} <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          {cls.learningMode === 'ONLINE' ? (
                            <Video className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold truncate">
                            {cls.learningMode === 'ONLINE' ? 'Học Online' : (cls.address || 'Học Offline')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold">Tối đa {cls.maxStudents} HV</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Lịch:</span>
                        {cls.schedules && cls.schedules.map((s) => {
                          const dayLabel = VIETNAMESE_DAYS.find((d) => d.value === s.dayOfWeek)?.label || `T${s.dayOfWeek}`;
                          return (
                            <span key={s.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {dayLabel} ({s.startTime}-{s.endTime})
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Học phí {totalSessions > 0 ? `(${totalSessions} buổi)` : '/ buổi'}
                        </span>
                        <strong className="font-display text-base font-black text-brand-primary">
                          {pricePerSession.toLocaleString('vi-VN')} đ <span className="text-[10px] text-slate-500 font-semibold">/ buổi</span>
                        </strong>
                        {totalCoursePriceVnd > 0 && (
                          <span className="block text-[10px] font-bold text-emerald-600">
                            Khóa: {totalCoursePriceVnd.toLocaleString('vi-VN')} đ (~{totalCoursePriceUsdc} USDC)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClass(cls);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-brand-primary transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-white" />
                        <span>Xem chi tiết</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Detail Modal */}
      {selectedClass && (
        <PublicClassDetailModal
          classRoom={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

function getTutorDisplayName(classRoom) {
  return classRoom.tutorFullName || 'Chưa đồng bộ tên giảng viên';
}
