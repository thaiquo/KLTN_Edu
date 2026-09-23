import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Laptop,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { tutorApi } from '../../api/tutors';
import { classApi } from '../../api/classes';
import { reviewApi } from '../../api/reviews';
import { HomeHeader } from '../../components/home/HomeHeader';
import { PublicClassDetailModal } from '../class/PublicClassDetailModal';

const REVIEW_PAGE_SIZE = 4;

const DAY_LABELS = {
  1: 'Chủ nhật',
  2: 'Thứ 2',
  3: 'Thứ 3',
  4: 'Thứ 4',
  5: 'Thứ 5',
  6: 'Thứ 6',
  7: 'Thứ 7',
  8: 'Chủ nhật'
};

export function PublicTutorProfilePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const subjectContextId = Number(searchParams.get('subjectId')) || null;

  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publicClasses, setPublicClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [reviewsPage, setReviewsPage] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewPageIndex, setReviewPageIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadTutor() {
      setLoading(true);
      setError('');
      try {
        const data = await tutorApi.getPublicProfileV2(id);
        if (active) setTutor(data);
      } catch (loadError) {
        if (active) {
          setError(loadError.status === 404 ? 'Không tìm thấy hồ sơ gia sư.' : loadError.message || 'Không thể tải hồ sơ gia sư.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTutor();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!tutor?.tutorId) return;
    let active = true;

    async function loadClasses() {
      setClassesLoading(true);
      try {
        const data = await classApi.getPublicClasses({ tutorProfileId: tutor.tutorId });
        if (active) setPublicClasses(Array.isArray(data) ? data : []);
      } catch {
        if (active) setPublicClasses([]);
      } finally {
        if (active) setClassesLoading(false);
      }
    }

    loadClasses();
    return () => {
      active = false;
    };
  }, [tutor?.tutorId]);

  useEffect(() => {
    if (!tutor?.userId) return;
    let active = true;

    setReviewsLoading(true);
    reviewApi
      .getTutorReviews(tutor.userId, { page: reviewPageIndex, size: REVIEW_PAGE_SIZE })
      .then((data) => {
        if (active) setReviewsPage(data);
      })
      .catch(() => {
        if (active) {
          setReviewsPage({ content: [], page: reviewPageIndex, size: REVIEW_PAGE_SIZE, totalElements: 0, totalPages: 0, last: true });
        }
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tutor?.userId, reviewPageIndex]);

  const capabilities = useMemo(() => {
    const subjects = tutor?.subjects || [];
    if (!subjectContextId) return subjects;
    return [...subjects].sort((left, right) => {
      if (Number(left.subjectId) === subjectContextId) return -1;
      if (Number(right.subjectId) === subjectContextId) return 1;
      return 0;
    });
  }, [subjectContextId, tutor?.subjects]);

  const availabilityByDay = useMemo(() => groupAvailability(tutor?.availability || []), [tutor?.availability]);
  const subjectSummary = useMemo(() => summarizeSubjects(capabilities), [capabilities]);
  const safeLocation = formatLocation(tutor?.location);

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <HomeHeader />

      <main className="container-app pt-[calc(80px+42px)] pb-20">
        <Link
          to="/tutors"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft size={17} /> Quay lại 
        </Link>

        {loading ? (
          <ProfileSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="mt-6 space-y-7">
            <section className="border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,.06)]">
              <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Avatar tutor={tutor} sizeClass="h-28 w-28 text-3xl" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-[clamp(30px,4vw,48px)] font-extrabold leading-tight text-slate-950">
                        {tutor.fullName}
                      </h1>
                      {tutor.approvedOrVerified && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                          <ShieldCheck size={14} /> Đã được xét duyệt
                        </span>
                      )}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-600">
                      {subjectSummary}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                      <RatingPill averageRating={tutor.averageRating} reviewCount={tutor.reviewCount} />
                      {safeLocation && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                          <MapPin size={15} className="text-rose-500" /> {safeLocation}
                        </span>
                      )}
                      {normalizeTeachingModes(tutor.teachingModes).map((mode) => (
                        <span key={mode} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                          {mode === 'ONLINE' ? <Laptop size={15} className="text-primary" /> : <MapPin size={15} className="text-emerald-600" />}
                          {teachingModeLabel(mode)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Mức nhận dạy từ</p>
                  <strong className="mt-1 block font-display text-2xl font-extrabold text-slate-950">
                    {formatMoneyOrContact(tutor.startingTuition)}
                  </strong>
                  
                </div>
              </div>
            </section>

            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-7">
                <section className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                  <SectionHeader eyebrow="Hồ sơ công khai" title="Giới thiệu" />
                  <p className="mt-4 text-base font-semibold leading-8 text-slate-600">
                    {tutor.bio || 'Gia sư chưa cập nhật phần giới thiệu công khai.'}
                  </p>
                </section>

                <section id="capabilities" className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                  <SectionHeader eyebrow="Teaching capabilities" title="Môn học & năng lực giảng dạy" />
                  <div className="mt-5 grid gap-4">
                    {capabilities.length ? capabilities.map((capability) => (
                      <CapabilityCard
                        key={capability.registrationId || capability.subjectId}
                        capability={capability}
                        highlighted={Number(capability.subjectId) === subjectContextId}
                      />
                    )) : (
                      <EmptyState icon={BookOpen} message="Hồ sơ này chưa có môn học công khai được duyệt." />
                    )}
                  </div>
                </section>

                <section id="availability" className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                  <SectionHeader eyebrow="Weekly availability" title="Lịch có thể giảng dạy" />
                  {availabilityByDay.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {availabilityByDay.map((day) => (
                        <article key={day.dayOfWeek} className="border border-slate-200 bg-slate-50 p-4">
                          <h3 className="text-sm font-extrabold text-slate-950">{DAY_LABELS[day.dayOfWeek] || `Thứ ${day.dayOfWeek}`}</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {day.slots.map((slot) => (
                              <span key={slot.id || `${slot.startTime}-${slot.endTime}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700">
                                <Clock3 size={13} className="text-primary" /> {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5">
                      <EmptyState icon={CalendarDays} message="Gia sư chưa công khai khung giờ có thể giảng dạy." />
                    </div>
                  )}
                </section>

                <section id="classes" className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                  <SectionHeader
                    eyebrow="Published classes"
                    title="Các lớp đang mở"
                    description="Chỉ hiển thị lớp công khai hiện có của gia sư này."
                  />
                  <div className="mt-5">
                    {classesLoading ? (
                      <LoadingRow label="Đang tải lớp công khai..." />
                    ) : publicClasses.length ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {publicClasses.map((classRoom) => (
                          <PublicClassCard key={classRoom.id} classRoom={classRoom} onOpen={() => setSelectedClass(classRoom)} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={BookOpen} message="Gia sư hiện chưa có lớp công khai." />
                    )}
                  </div>
                </section>

                <section id="reviews" className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)] md:p-7">
                  <SectionHeader eyebrow="Student reviews" title="Đánh giá từ học viên" />
                  <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="border border-slate-200 bg-slate-50 p-5">
                      <p className="font-display text-4xl font-extrabold text-slate-950">
                        {formatRating(tutor.averageRating)}
                      </p>
                      <StarRow rating={Number(tutor.averageRating || 0)} />
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        {Number(tutor.reviewCount || 0)} đánh giá đã công khai
                      </p>
                    </div>

                    <div>
                      {reviewsLoading ? (
                        <LoadingRow label="Đang tải đánh giá..." />
                      ) : reviewsPage?.content?.length ? (
                        <div className="space-y-3">
                          {reviewsPage.content.map((review) => (
                            <ReviewCard key={review.id} review={review} />
                          ))}
                          <ReviewPager page={reviewsPage} onChange={setReviewPageIndex} />
                        </div>
                      ) : (
                        <EmptyState icon={Star} message="Gia sư này chưa có đánh giá công khai từ học viên." />
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="grid content-start gap-5 lg:sticky lg:top-24">
                <section className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
                  <h2 className="font-display text-xl font-extrabold text-slate-950">Thông tin nhanh</h2>
                  <div className="mt-5 space-y-4">
                    <QuickInfo icon={WalletCards} label="Mức nhận dạy từ" value={formatMoneyOrContact(tutor.startingTuition)} />
                    <QuickInfo icon={GraduationCap} label="Môn đã duyệt" value={`${capabilities.length} môn`} />
                    <QuickInfo icon={BookOpen} label="Lớp công khai" value={`${Number(tutor.publishedClassCount || publicClasses.length || 0)} lớp`} />
                    <QuickInfo icon={UsersRound} label="Đánh giá" value={`${Number(tutor.reviewCount || 0)} lượt`} />
                    {safeLocation && <QuickInfo icon={MapPin} label="Khu vực" value={safeLocation} />}
                    <QuickInfo icon={CalendarDays} label="Lịch dạy" value={summarizeAvailability(availabilityByDay)} />
                  </div>
                </section>

                <section className="border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
                  <h2 className="font-display text-xl font-extrabold text-slate-950">Hành động</h2>
                  <div className="mt-4 grid gap-3">
                    <a
                      href="#classes"
                      className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark"
                    >
                      Xem lớp đang mở <ArrowRight size={16} />
                    </a>
                    <a
                      href="#reviews"
                      className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 transition-colors hover:border-primary hover:text-primary"
                    >
                      Xem đánh giá <Star size={16} />
                    </a>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>

      {selectedClass && (
        <PublicClassDetailModal
          classRoom={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

function Avatar({ tutor, sizeClass }) {
  if (tutor.avatarUrl) {
    return (
      <img
        src={tutor.avatarUrl}
        alt={tutor.fullName}
        className={`${sizeClass} shrink-0 border border-slate-200 object-cover`}
      />
    );
  }
  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center border border-slate-200 bg-slate-950 font-display font-extrabold text-white`}>
      {getInitials(tutor.fullName)}
    </span>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function CapabilityCard({ capability, highlighted }) {
  return (
    <article className={`border p-5 ${highlighted ? 'border-primary bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-extrabold text-slate-950">{capability.subjectName}</h3>
            {highlighted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-white">
                <CheckCircle2 size={13} /> Môn bạn đang xem
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {capability.categoryName || 'Danh mục môn học'} · {Number(capability.experienceYears || 0)} năm kinh nghiệm
          </p>
          {capability.levels?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {capability.levels.map((level) => (
                <span key={level.levelId || level.levelName} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-700">
                  {level.levelName}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3 text-left sm:text-right">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Mức nhận dạy</p>
          <strong className="mt-1 block text-sm font-extrabold text-slate-950">{formatTuitionRange(capability.tuitionMin, capability.tuitionMax)}</strong>
        </div>
      </div>
      {capability.description && (
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{capability.description}</p>
      )}
    </article>
  );
}

function PublicClassCard({ classRoom, onOpen }) {
  const subjectName = classRoom.registration?.subjectName || classRoom.subjectName || 'Lớp học';
  const levelName = classRoom.level?.name || classRoom.levelName;

  return (
    <article className="flex min-h-[260px] flex-col justify-between border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-primary">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-extrabold text-primary">
            {subjectName}{levelName ? ` · ${levelName}` : ''}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
            Đang công khai
          </span>
        </div>
        <h3 className="mt-3 font-display text-lg font-extrabold leading-6 text-slate-950">{classRoom.name}</h3>
        <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{classRoom.description || 'Lớp học chưa có mô tả công khai.'}</p>

        <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600">
          <span className="inline-flex items-center gap-2">
            {classRoom.learningMode === 'ONLINE' ? <Laptop size={14} className="text-primary" /> : <MapPin size={14} className="text-emerald-600" />}
            {learningModeLabel(classRoom.learningMode, classRoom.address)}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" />
            {Number(classRoom.sessionsPerWeek || 0)} buổi/tuần
          </span>
        </div>

        {classRoom.schedules?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {classRoom.schedules.map((schedule) => (
              <span key={schedule.id || `${schedule.dayOfWeek}-${schedule.startTime}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                {shortDayLabel(schedule.dayOfWeek)} {formatTime(schedule.startTime)}-{formatTime(schedule.endTime)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
        <strong className="font-display text-base font-extrabold text-primary">
          {formatClassPrice(classRoom.pricePerSession)}
        </strong>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-800 transition-colors hover:text-primary"
        >
          Xem chi tiết <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRow rating={Number(review.rating || 0)} />
        <span className="text-[11px] font-bold text-slate-400">{formatDate(review.createdAt)}</span>
      </div>
      {review.comment && <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">{review.comment}</p>}
    </article>
  );
}

function ReviewPager({ page, onChange }) {
  const totalPages = Number(page.totalPages || 0);
  const currentPage = Number(page.page ?? page.number ?? 0);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        disabled={currentPage <= 0}
        onClick={() => onChange(Math.max(currentPage - 1, 0))}
        className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={14} /> Trước
      </button>
      <span className="text-xs font-extrabold text-slate-500">
        Trang {currentPage + 1}/{totalPages}
      </span>
      <button
        type="button"
        disabled={currentPage >= totalPages - 1}
        onClick={() => onChange(Math.min(currentPage + 1, totalPages - 1))}
        className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Sau <ChevronRight size={14} />
      </button>
    </div>
  );
}

function RatingPill({ averageRating, reviewCount }) {
  const count = Number(reviewCount || 0);
  if (!count) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
        <Star size={15} className="text-slate-400" /> Chưa có đánh giá
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
      <Star size={15} fill="currentColor" /> {formatRating(averageRating)} ({count} đánh giá)
    </span>
  );
}

function StarRow({ rating }) {
  const value = Number(rating || 0);
  return (
    <span className="inline-flex items-center gap-1 text-amber-400">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={16} fill={star <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

function QuickInfo({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center border border-slate-200 bg-slate-50 text-primary">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-500">{message}</p>
    </div>
  );
}

function LoadingRow({ label }) {
  return (
    <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <section className="mt-6 grid place-items-center border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_18px_42px_rgba(15,23,42,.06)]">
      <span className="grid h-14 w-14 place-items-center border border-red-100 bg-red-50 text-[#b83333]">
        <AlertCircle size={24} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-950">{message}</h1>
      <Link
        to="/tutors"
        className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-extrabold text-white hover:bg-primary-dark"
      >
        Xem gia sư khác <ArrowRight size={16} />
      </Link>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-7">
      <div className="border border-slate-200 bg-white p-8 shadow-[0_18px_42px_rgba(15,23,42,.06)]">
        <div className="flex gap-5">
          <div className="h-28 w-28 bg-slate-100" />
          <div className="flex-1 space-y-4">
            <div className="h-9 w-2/3 bg-slate-100" />
            <div className="h-4 w-3/4 bg-slate-100" />
            <div className="h-4 w-1/2 bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="h-44 border border-slate-200 bg-white" />
          <div className="h-64 border border-slate-200 bg-white" />
        </div>
        <div className="h-72 border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

function groupAvailability(slots) {
  const grouped = new Map();
  [...slots]
    .filter((slot) => slot?.dayOfWeek)
    .sort((left, right) => Number(left.dayOfWeek) - Number(right.dayOfWeek) || String(left.startTime).localeCompare(String(right.startTime)))
    .forEach((slot) => {
      const day = Number(slot.dayOfWeek);
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(slot);
    });
  return Array.from(grouped, ([dayOfWeek, daySlots]) => ({ dayOfWeek, slots: daySlots }));
}

function summarizeSubjects(subjects) {
  if (!subjects.length) return 'Hồ sơ chưa có môn học công khai.';
  const names = subjects.slice(0, 3).map((subject) => subject.subjectName).filter(Boolean);
  const suffix = subjects.length > 3 ? ` và ${subjects.length - 3} môn khác` : '';
  return `${names.join(' · ')}${suffix}`;
}

function summarizeAvailability(days) {
  if (!days.length) return 'Chưa công khai';
  const labels = days.slice(0, 3).map((day) => DAY_LABELS[day.dayOfWeek] || `Thứ ${day.dayOfWeek}`);
  return `${days.length} ngày/tuần: ${labels.join(', ')}${days.length > 3 ? '...' : ''}`;
}

function normalizeTeachingModes(modes) {
  return Array.from(new Set(modes || [])).filter(Boolean).sort();
}

function teachingModeLabel(mode) {
  if (mode === 'ONLINE') return 'Dạy online';
  if (mode === 'OFFLINE') return 'Dạy trực tiếp';
  return mode;
}

function learningModeLabel(mode, address) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'OFFLINE') return address || 'Trực tiếp';
  return mode || 'Chưa cập nhật';
}

function formatLocation(location) {
  if (!location) return '';
  return [location.communeName, location.provinceName].filter(Boolean).join(', ');
}

function formatTuitionRange(min, max) {
  if (min && max && Number(min) !== Number(max)) return `${formatMoney(min)} - ${formatMoney(max)} / buổi`;
  if (min) return `${formatMoney(min)} / buổi`;
  if (max) return `${formatMoney(max)} / buổi`;
  return 'Liên hệ';
}

function formatMoneyOrContact(value) {
  return value ? `${formatMoney(value)} / buổi` : 'Liên hệ';
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))}đ`;
}

function formatClassPrice(value) {
  return value ? `${formatMoney(value)} / buổi` : 'Liên hệ';
}

function formatRating(value) {
  return Number(value || 0).toFixed(1);
}

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortDayLabel(dayOfWeek) {
  const value = Number(dayOfWeek);
  if (value === 1 || value === 8) return 'CN';
  return `T${value}`;
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
