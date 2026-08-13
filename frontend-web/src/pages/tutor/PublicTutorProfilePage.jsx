import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import { tutorApi } from '../../api/tutors';
import { HomeHeader } from '../../components/home/HomeHeader';

export function PublicTutorProfilePage() {
  const { id } = useParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTutor() {
      setLoading(true);
      setError('');
      try {
        const data = await tutorApi.getPublicProfile(id);
        if (active) setTutor(data);
      } catch (loadError) {
        if (active) setError(loadError.status === 404 ? 'Không tìm thấy hồ sơ gia sư.' : loadError.message || 'Không thể tải hồ sơ gia sư.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTutor();
    return () => {
      active = false;
    };
  }, [id]);

  const lowestRateSubject = useMemo(() => getLowestRateSubject(tutor?.subjects || []), [tutor]);

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />
      <main className="container-app pt-[calc(80px+42px)] pb-20">
        <Link
          to="/tutors"
          className="mb-5 inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={17} /> Quay lại danh sách gia sư
        </Link>

        {loading ? (
          <ProfileSkeleton />
        ) : error ? (
          <div className="grid place-items-center rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_18px_42px_rgba(15,23,42,.06)]">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-[#b83333]">
              <UserRound size={24} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-950">{error}</h1>
            <Link
              to="/tutors"
              className="mt-6 rounded-[14px] bg-primary px-5 py-3 text-sm font-extrabold text-white hover:bg-primary-dark"
            >
              Xem gia sư khác
            </Link>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_26px_70px_rgba(15,23,42,.08)]">
              <div className="h-36 bg-slate-900" />
              <div className="px-6 pb-7 md:px-8">
                <div className="-mt-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <span className="grid h-28 w-28 place-items-center rounded-[28px] border-4 border-white bg-slate-900 text-3xl font-extrabold text-white shadow-[0_18px_36px_rgba(15,23,42,.18)]">
                      {getInitials(tutor.fullName)}
                    </span>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold tracking-tight text-slate-950">
                          {tutor.fullName}
                        </h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                          <ShieldCheck size={14} /> Đã xác minh
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
                        <GraduationCap size={17} />
                        {tutor.subjects.length} môn nhận dạy
                        {lowestRateSubject && (
                          <>
                            <span aria-hidden="true">·</span>
                            Từ {formatMoney(lowestRateSubject.oneToOneHourlyRate)}/giờ
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Học phí 1:1 tham khảo</p>
                    <strong className="mt-1 block font-display text-2xl font-extrabold text-slate-950">
                      {lowestRateSubject ? `Từ ${formatMoney(lowestRateSubject.oneToOneHourlyRate)}/giờ` : 'Liên hệ'}
                    </strong>
                  </div>
                </div>

                <p className="mt-7 max-w-3xl text-base font-semibold leading-8 text-slate-600">
                  {tutor.bio || 'Gia sư đã được phê duyệt trên Kết Nối Học. Thông tin học phí bên dưới là giá 1:1 theo từng môn.'}
                </p>
              </div>
            </section>

            <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]">
              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Teaching catalog</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">Môn nhận dạy</h2>
                <div className="mt-6 grid gap-4">
                  {tutor.subjects.map((subject) => (
                    <article key={subject.subjectId} className="rounded-[18px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-xl font-extrabold text-slate-950">{subject.name}</h3>
                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {subject.category?.name || 'Môn học'} · {subject.experienceYears || 0} năm kinh nghiệm
                          </p>
                          {subject.levels?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {subject.levels.map((level) => (
                                <span key={level} className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-primary shadow-sm">
                                  {levelLabels[level] || level}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <strong className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-primary shadow-sm">
                          {formatMoney(subject.oneToOneHourlyRate)}/giờ
                        </strong>
                      </div>
                      {subject.description && (
                        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{subject.description}</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <aside className="grid content-start gap-5">
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-primary">
                    <BookOpen size={22} />
                  </span>
                  <h2 className="mt-4 font-display text-xl font-extrabold text-slate-950">Thông tin học phí</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Mỗi môn có học phí 1:1 riêng. Giá lớp nhóm, hợp đồng và lịch học sẽ thuộc các bước học tập sau.
                  </p>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Clock size={22} />
                  </span>
                  <h2 className="mt-4 font-display text-xl font-extrabold text-slate-950">Đặt lịch học</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Request, booking, nhắn tin và hợp đồng điện tử sẽ được kết nối ở các phase sau.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
      <div className="h-32 rounded-[22px] bg-slate-100" />
      <div className="mt-6 h-8 w-1/2 rounded bg-slate-100" />
      <div className="mt-4 h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="h-28 rounded-[18px] bg-slate-100" />
        <div className="h-28 rounded-[18px] bg-slate-100" />
      </div>
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
