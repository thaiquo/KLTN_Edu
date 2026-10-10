import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Filter, Search, ShieldCheck, X, Users, Sparkles } from 'lucide-react';
import { tutorApi } from '../../api/tutors';
import { communityApi } from '../../api/community';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../components/feedback/useFeedback';
import { HomeHeader } from '../../components/home/HomeHeader';

export function TutorMarketplacePage() {
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTutors() {
      setLoading(true);
      setError('');
      try {
        const data = await tutorApi.searchPublic({
          keyword: keyword.trim(),
          limit: 50
        });
        if (active) setTutors(data || []);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Không thể tải danh sách gia sư.');
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = window.setTimeout(loadTutors, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  const hasKeyword = Boolean(keyword.trim());

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />

      <main className="container-app pt-[calc(80px+36px)] pb-20 space-y-7">
        <section className="rounded-[28px] bg-slate-900 px-6 py-8 text-white shadow-[0_26px_70px_rgba(15,23,42,.16)] md:px-9 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-100 border border-white/10">
                <Search size={14} /> Marketplace gia sư
              </p>
              <h1 className="mt-4 font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-tight">
                Tìm gia sư đã qua xác minh
              </h1>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-300">
                Tìm theo tên gia sư, mở hồ sơ để xem thông tin giảng dạy và các lớp đang publish.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-5 backdrop-blur-xs">
              <p className="text-xs font-bold text-slate-200">
                Chế độ hiển thị: Tất cả gia sư đã được duyệt.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,.06)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-display font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-primary" /> Bộ lọc gia sư
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-brand-primary border border-blue-100">
              Tất cả
            </span>
          </div>

          <label className="grid gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
            Tìm theo tên gia sư
            <span className="flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500">
              <Search size={16} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full border-0 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="Nhập tên gia sư..."
                type="search"
              />
              {hasKeyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                  aria-label="Xóa từ khóa"
                >
                  <X size={15} />
                </button>
              )}
            </span>
          </label>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-primary">Tutor Catalog</p>
              <h2 className="mt-0.5 font-display text-2xl font-extrabold text-slate-950">
                Danh sách gia sư
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 shadow-2xs">
              <Filter size={14} /> {loading ? 'Đang tải...' : `${tutors.length} hồ sơ`}
            </span>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <TutorGridSkeleton />
          ) : tutors.length === 0 ? (
            <EmptyTutors hasKeyword={hasKeyword} onReset={() => setKeyword('')} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tutors.map((tutor) => (
                <TutorMarketplaceCard key={tutor.id} tutor={tutor} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TutorMarketplaceCard({ tutor }) {
  const { user, authenticated } = useAuth();
  const feedback = useFeedback();
  const [followStatus, setFollowStatus] = useState({ isFollowed: false, followerCount: 0 });
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!tutor?.userId) return;
    let active = true;
    async function loadFollow() {
      try {
        const res = await communityApi.getTutorFollowStatus(tutor.userId);
        if (active && res) setFollowStatus(res);
      } catch {}
    }
    loadFollow();
    return () => { active = false; };
  }, [tutor?.userId]);

  const handleToggleFollow = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authenticated) {
      feedback.info({ title: 'Cần đăng nhập', message: 'Vui lòng đăng nhập để theo dõi gia sư.' });
      return;
    }
    if (user?.activeRole !== 'STUDENT' && user?.role !== 'STUDENT') {
      feedback.warning('Chỉ tài khoản Học viên mới có thể theo dõi gia sư.');
      return;
    }
    if (String(user?.id) === String(tutor?.userId)) {
      feedback.warning('Bạn không thể tự theo dõi chính mình.');
      return;
    }
    setFollowLoading(true);
    try {
      if (followStatus.isFollowed) {
        const res = await communityApi.unfollowTutor(tutor.userId);
        setFollowStatus(res || { isFollowed: false, followerCount: Math.max(0, followStatus.followerCount - 1) });
        feedback.success(`Đã hủy theo dõi gia sư ${tutor.fullName}`);
      } else {
        const res = await communityApi.followTutor(tutor.userId);
        setFollowStatus(res || { isFollowed: true, followerCount: followStatus.followerCount + 1 });
        feedback.success(`Đã theo dõi gia sư ${tutor.fullName}`);
      }
    } catch (err) {
      feedback.error(err.message || 'Không thể theo dõi gia sư.');
    } finally {
      setFollowLoading(false);
    }
  };

  const lowestRateSubject = getLowestRateSubject(tutor.subjects || []);
  const visibleSubjects = (tutor.subjects || []).slice(0, 3);
  const remaining = Math.max((tutor.subjects || []).length - visibleSubjects.length, 0);
  const fullName = tutor.fullName || 'Gia sư Kết Nối Học';

  return (
    <article className="flex min-h-[300px] flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,.06)] transition-all hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-[0_24px_56px_rgba(15,23,42,.1)]">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-[18px] bg-slate-900 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(15,23,42,.16)]">
            {getInitials(fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="truncate font-display text-xl font-extrabold text-slate-950">{fullName}</h3>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              {followStatus.followerCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                  <Users size={11} /> {followStatus.followerCount}
                </span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
              {tutor.bio || 'Gia sư đã qua xác minh hồ sơ trên Kết Nối Học.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {visibleSubjects.map((subject) => (
            <span key={subject.subjectId} className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-brand-primary border border-blue-100">
              {subject.name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-500 border border-slate-200">
              +{remaining} môn
            </span>
          )}
        </div>
      </div>

      <div className="pt-5 border-t border-slate-100 mt-4 space-y-3">
        <div className="rounded-[18px] bg-slate-50 p-3.5 space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Học phí 1:1 tham khảo
          </p>
          <strong className="block font-display text-xl font-extrabold text-slate-950">
            {lowestRateSubject ? `Từ ${formatMoney(lowestRateSubject.oneToOneHourlyRate)}/giờ` : 'Liên hệ'}
          </strong>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/tutors/${tutor.id}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-slate-900 px-4 py-3 text-xs font-black text-white transition-colors hover:bg-brand-primary shadow-sm"
          >
            <span>Xem hồ sơ</span> <ArrowRight size={15} />
          </Link>
          {authenticated && (user?.activeRole === 'STUDENT' || user?.role === 'STUDENT') && String(user?.id) !== String(tutor?.userId) && (
            <button
              type="button"
              disabled={followLoading}
              onClick={handleToggleFollow}
              title={followStatus.isFollowed ? 'Bỏ theo dõi gia sư' : 'Theo dõi gia sư'}
              className={`px-3.5 py-3 rounded-[14px] text-xs font-bold transition border cursor-pointer ${
                followStatus.isFollowed
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {followLoading ? '...' : followStatus.isFollowed ? '✓ Đang theo dõi' : '+ Theo dõi'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function TutorGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải gia sư">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-[300px] animate-pulse rounded-[22px] border border-slate-200 bg-white p-5 space-y-4">
          <div className="h-12 w-12 rounded-[18px] bg-slate-100" />
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-4/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyTutors({ hasKeyword, onReset }) {
  return (
    <div className="grid place-items-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center space-y-3">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-brand-primary">
        <BookOpen size={24} />
      </span>
      <h3 className="font-display text-xl font-extrabold text-slate-950">Chưa có gia sư phù hợp</h3>
      <p className="max-w-md text-xs font-semibold leading-6 text-slate-500">
        {hasKeyword
          ? 'Thử nhập tên gia sư khác.'
          : 'Khi Staff phê duyệt hồ sơ gia sư, hồ sơ sẽ xuất hiện tại đây.'}
      </p>
      {hasKeyword && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-[14px] bg-brand-primary px-5 py-2.5 text-xs font-extrabold text-white hover:bg-brand-primary/90"
        >
          Xóa tìm kiếm
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
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
