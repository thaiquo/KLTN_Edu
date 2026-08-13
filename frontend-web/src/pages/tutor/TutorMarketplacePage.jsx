import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Filter, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { subjectApi } from '../../api/subjects';
import { tutorApi } from '../../api/tutors';
import { HomeHeader } from '../../components/home/HomeHeader';

export function TutorMarketplacePage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    subjectId: searchParams.get('subjectId') || '',
    minRate: searchParams.get('minRate') || '',
    maxRate: searchParams.get('maxRate') || ''
  });
  const [subjects, setSubjects] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSubjects() {
      setSubjectLoading(true);
      try {
        const data = await subjectApi.list({ limit: 20 });
        if (active) setSubjects(data);
      } catch {
        if (active) setSubjects([]);
      } finally {
        if (active) setSubjectLoading(false);
      }
    }

    loadSubjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTutors() {
      setLoading(true);
      setError('');
      try {
        const data = await tutorApi.searchPublic({
          ...filters,
          limit: 24
        });
        if (active) setTutors(data);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Không thể tải danh sách gia sư.');
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = window.setTimeout(loadTutors, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters]);

  const selectedSubjectId = filters.subjectId ? Number(filters.subjectId) : null;
  const hasFilter = Object.values(filters).some(Boolean);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    setFilters({ keyword: '', subjectId: '', minRate: '', maxRate: '' });
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />
      <main className="container-app pt-[calc(80px+48px)] pb-20">
        <section className="rounded-[28px] bg-slate-900 px-6 py-8 text-white shadow-[0_26px_70px_rgba(15,23,42,.16)] md:px-9 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-100">
                <Search size={14} /> Marketplace gia sư
              </p>
              <h1 className="mt-5 font-display text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.02] tracking-tight">
                Tìm gia sư đã được xác minh
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
                Xem hồ sơ gia sư đã được Staff phê duyệt, môn nhận dạy và học phí 1:1 theo từng môn.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-5">
              <p className="text-sm font-bold text-slate-200">
                Giá hiển thị là học phí 1:1 theo môn, không phải giá lớp nhóm hay hợp đồng cuối cùng.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,.06)]">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_.75fr_.75fr_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-extrabold text-slate-800">
              Từ khóa
              <span className="flex min-h-[48px] items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-slate-500">
                <Search size={18} />
                <input
                  name="keyword"
                  value={filters.keyword}
                  onChange={updateFilter}
                  className="w-full border-0 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Tên gia sư hoặc môn học"
                  type="search"
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-extrabold text-slate-800">
              Môn học
              <select
                name="subjectId"
                value={filters.subjectId}
                onChange={updateFilter}
                className="min-h-[48px] rounded-[14px] border border-slate-200 bg-slate-50 px-3 font-bold text-slate-900 outline-none focus:border-primary"
              >
                <option value="">{subjectLoading ? 'Đang tải môn...' : 'Tất cả môn'}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <RateInput name="minRate" value={filters.minRate} label="Từ" onChange={updateFilter} />
            <RateInput name="maxRate" value={filters.maxRate} label="Đến" onChange={updateFilter} />

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilter}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SlidersHorizontal size={17} />
              Xóa lọc
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Tutor catalog</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">
                Gia sư phù hợp
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-500">
              <Filter size={14} /> {loading ? 'Đang lọc...' : `${tutors.length} hồ sơ`}
            </span>
          </div>

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <TutorGridSkeleton />
          ) : tutors.length === 0 ? (
            <EmptyTutors onReset={resetFilters} hasFilter={hasFilter} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tutors.map((tutor) => (
                <TutorMarketplaceCard key={tutor.id} tutor={tutor} selectedSubjectId={selectedSubjectId} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RateInput({ name, value, label, onChange }) {
  return (
    <label className="grid gap-2 text-sm font-extrabold text-slate-800">
      {label}
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="min-h-[48px] rounded-[14px] border border-slate-200 bg-slate-50 px-3 font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary"
        min="0"
        placeholder="VNĐ/giờ"
        type="number"
      />
    </label>
  );
}

function TutorMarketplaceCard({ tutor, selectedSubjectId }) {
  const priceSubject = selectedSubjectId
    ? tutor.subjects.find((subject) => Number(subject.subjectId) === selectedSubjectId)
    : getLowestRateSubject(tutor.subjects);
  const visibleSubjects = tutor.subjects.slice(0, 3);
  const remaining = Math.max(tutor.subjects.length - visibleSubjects.length, 0);

  return (
    <article className="flex min-h-[320px] flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,.06)] transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_56px_rgba(15,23,42,.1)]">
      <div className="flex items-start gap-4">
        <TutorAvatar name={tutor.fullName} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-extrabold text-slate-950">{tutor.fullName}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">
            {tutor.bio || 'Gia sư đã được xác minh trên Kết Nối Học.'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {visibleSubjects.map((subject) => (
          <span key={subject.subjectId} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary">
            {subject.name}
          </span>
        ))}
        {remaining > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-500">
            +{remaining} môn
          </span>
        )}
      </div>

      <div className="mt-auto pt-6">
        <div className="rounded-[18px] bg-slate-50 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {selectedSubjectId && priceSubject ? priceSubject.name : 'Học phí 1:1'}
          </p>
          <strong className="mt-1 block font-display text-2xl font-extrabold text-slate-950">
            {priceSubject ? `${selectedSubjectId ? '' : 'Từ '}${formatMoney(priceSubject.oneToOneHourlyRate)}/giờ` : 'Liên hệ'}
          </strong>
          {priceSubject && (
            <p className="mt-1 text-xs font-bold text-slate-500">
              {priceSubject.experienceYears || 0} năm kinh nghiệm với môn này
            </p>
          )}
          {priceSubject?.levels?.length > 0 && (
            <p className="mt-2 text-xs font-bold text-slate-500">
              {priceSubject.levels.map((level) => levelLabels[level] || level).join(' · ')}
            </p>
          )}
        </div>

        <Link
          to={`/tutors/${tutor.id}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary"
        >
          Xem hồ sơ <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}

function TutorAvatar({ name }) {
  return (
    <span className="grid h-14 w-14 flex-none place-items-center rounded-[18px] bg-slate-900 text-base font-extrabold text-white shadow-[0_12px_24px_rgba(15,23,42,.16)]">
      {getInitials(name)}
    </span>
  );
}

function TutorGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải gia sư">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-[320px] animate-pulse rounded-[22px] border border-slate-200 bg-white p-5">
          <div className="h-14 w-14 rounded-[18px] bg-slate-100" />
          <div className="mt-5 h-4 w-2/3 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyTutors({ hasFilter, onReset }) {
  return (
    <div className="grid place-items-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-primary">
        <BookOpen size={24} />
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold text-slate-950">Chưa có gia sư phù hợp</h3>
      <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        {hasFilter
          ? 'Thử nới lỏng bộ lọc hoặc tìm theo môn học khác.'
          : 'Khi Staff phê duyệt hồ sơ gia sư, các hồ sơ đang hoạt động sẽ xuất hiện tại đây.'}
      </p>
      {hasFilter && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-[14px] bg-primary px-5 py-3 text-sm font-extrabold text-white hover:bg-primary-dark"
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}

function getLowestRateSubject(subjects = []) {
  return subjects.reduce((lowest, subject) => {
    if (!lowest) return subject;
    return Number(subject.oneToOneHourlyRate) < Number(lowest.oneToOneHourlyRate) ? subject : lowest;
  }, null);
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0)) + 'đ';
}

function getInitials(value) {
  return (value || 'Tutor')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};
