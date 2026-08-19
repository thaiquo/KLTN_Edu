import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Calendar, Clock, Eye, Filter, GraduationCap,
  MapPin, Search, ShieldCheck, UserRound, Video, Globe
} from 'lucide-react';
import { tutorApi } from '../../api/tutors';
import { classApi } from '../../api/classes';
import { HomeHeader } from '../../components/home/HomeHeader';
import { PublicClassDetailModal } from '../class/PublicClassDetailModal';

const VIETNAMESE_DAYS = [
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 8, label: 'CN' }
];

export function PublicTutorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Classes taught by this tutor
  const [tutorClasses, setTutorClasses] = useState([]);
  const [classLoading, setClassLoading] = useState(false);
  const [classFilterMode, setClassFilterMode] = useState('');
  const [classKeyword, setClassKeyword] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);

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

  // Load published classes taught by this tutor.
  useEffect(() => {
    if (!tutor?.id) return;
    let active = true;

    async function loadTutorClasses() {
      setClassLoading(true);
      try {
        const data = await classApi.getPublicClasses({
          tutorProfileId: tutor.id,
          keyword: classKeyword.trim(),
          mode: classFilterMode
        });
        if (active) setTutorClasses(data || []);
      } catch (err) {
        if (active) setTutorClasses([]);
      } finally {
        if (active) setClassLoading(false);
      }
    }

    loadTutorClasses();
    return () => {
      active = false;
    };
  }, [tutor?.id, classKeyword, classFilterMode]);

  const lowestRateSubject = useMemo(() => getLowestRateSubject(tutor?.subjects || []), [tutor]);

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />
      
      <main className="container-app pt-[calc(80px+42px)] pb-20 space-y-7">
        <Link
          to="/tutors"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary transition-colors"
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
            {/* Header Banner & Bio Card */}
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_26px_70px_rgba(15,23,42,.08)]">
              <div className="h-36 bg-gradient-to-r from-slate-900 to-indigo-950" />
              <div className="px-6 pb-7 md:px-8">
                <div className="-mt-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <span className="grid h-28 w-28 place-items-center rounded-[28px] border-4 border-white bg-slate-900 text-3xl font-extrabold text-white shadow-[0_18px_36px_rgba(15,23,42,.18)] shrink-0">
                      {getInitials(tutor.fullName)}
                    </span>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold tracking-tight text-slate-950">
                          {tutor.fullName}
                        </h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                          <ShieldCheck size={14} /> Đã xác minh
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
                        <GraduationCap size={17} />
                        {tutor.subjects.length} môn nhận dạy
                        {lowestRateSubject && (
                          <>
                            <span aria-hidden="true">&bull;</span>
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
                  {tutor.bio || 'Gia sư đã được phê duyệt trên Kết Nối Học. Xem danh sách môn nhận dạy và các lớp học mở bán bên dưới.'}
                </p>
              </div>
            </section>

            {/* Main Content Layout */}
            <div className="grid gap-7 lg:grid-cols-[1fr_340px]">
              
              <div className="space-y-7">
                {/* Section 1: Subjects Taught */}
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7 space-y-5">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-primary">Teaching catalog</p>
                    <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">Các môn nhận dạy 1:1</h2>
                  </div>

                  <div className="grid gap-4">
                    {tutor.subjects.map((subject) => (
                      <article key={subject.subjectId} className="rounded-[18px] border border-slate-200 bg-slate-50 p-5 hover:bg-slate-100/60 transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="font-display text-xl font-extrabold text-slate-950">{subject.name}</h3>
                            <p className="mt-1 text-sm font-bold text-slate-500">
                              {subject.category?.name || 'Môn học'} &bull; {subject.experienceYears || 0} năm kinh nghiệm
                            </p>
                            {subject.levels?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {subject.levels.map((level) => (
                                  <span key={level} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-brand-primary shadow-xs border border-slate-200">
                                    {levelLabels[level] || level}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <strong className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-primary shadow-xs border border-slate-200">
                            {formatMoney(subject.oneToOneHourlyRate)}/giờ
                          </strong>
                        </div>
                        {subject.description && (
                          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{subject.description}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                {/* Section 2: Tutor's Published Classes with Filter & Detail Modal */}
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">Opened Classes</p>
                      <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">
                        Lớp học do {tutor.fullName} mở dạy
                      </h2>
                    </div>

                    {/* Filter controls for Tutor's Classes */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={classFilterMode}
                        onChange={(e) => setClassFilterMode(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-primary"
                      >
                        <option value="">Tất cả hình thức</option>
                        <option value="ONLINE">Online</option>
                        <option value="OFFLINE">Offline</option>
                      </select>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={classKeyword}
                          onChange={(e) => setClassKeyword(e.target.value)}
                          placeholder="Tìm lớp của gia sư..."
                          className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {classLoading ? (
                    <div className="p-6 text-center text-xs font-bold text-slate-500">Đang tải danh sách lớp học...</div>
                  ) : tutorClasses.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">Chưa có lớp học nào khớp với bộ lọc của gia sư này.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {tutorClasses.map((cls) => (
                        <div
                          key={cls.id}
                          onClick={() => setSelectedClass(cls)}
                          className="p-4 border border-slate-200 rounded-2xl bg-white shadow-2xs hover:border-brand-primary hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-brand-primary/10 text-brand-primary text-[10px] font-black uppercase">
                                {cls.registration?.subjectName} &bull; {cls.level?.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-emerald-600" /> Đang tuyển
                              </span>
                            </div>

                            <h3 className="font-display font-black text-sm text-slate-900 group-hover:text-brand-primary transition-colors line-clamp-1">
                              {cls.name}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-2">
                              {cls.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-1 font-bold">
                              <span className="flex items-center gap-1">
                                {cls.learningMode === 'ONLINE' ? <Video className="w-3.5 h-3.5 text-brand-primary" /> : <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                                {cls.learningMode === 'ONLINE' ? 'Online' : (cls.address || 'Offline')}
                              </span>
                              <span>&bull;</span>
                              <span>{cls.sessionsPerWeek} buổi/tuần</span>
                            </div>

                            {/* Schedules */}
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              {cls.schedules && cls.schedules.map((s) => {
                                const dayLabel = VIETNAMESE_DAYS.find((d) => d.value === s.dayOfWeek)?.label || `T${s.dayOfWeek}`;
                                return (
                                  <span key={s.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-bold border border-slate-200">
                                    {dayLabel} ({s.startTime}-{s.endTime})
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <strong className="font-display font-black text-brand-primary text-sm">
                              {cls.pricePerSession?.toLocaleString('vi-VN')} đ <span className="text-[10px] font-normal text-slate-400">/ buổi</span>
                            </strong>
                            <span className="text-brand-primary font-bold flex items-center gap-1 text-[11px] group-hover:underline">
                              <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar Info Panels */}
              <aside className="grid content-start gap-5">
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] space-y-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-brand-primary">
                    <BookOpen size={22} />
                  </span>
                  <h2 className="font-display text-xl font-extrabold text-slate-950">Quy trình tra cứu</h2>
                  <p className="text-xs font-semibold leading-6 text-slate-500">
                    Bạn có thể xem trước môn học, lộ trình bài giảng và lịch học của gia sư này. Bấm vào chi tiết từng lớp để xem chương trình đào tạo.
                  </p>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] space-y-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Clock size={22} />
                  </span>
                  <h2 className="font-display text-xl font-extrabold text-slate-950">Các lớp khác</h2>
                  <button
                    type="button"
                    onClick={() => navigate('/classes')}
                    className="w-full py-2.5 bg-slate-900 hover:bg-brand-primary text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Khám phá toàn bộ danh mục lớp</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Class Details Modal */}
      {selectedClass && (
        <PublicClassDetailModal
          classRoom={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
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
