import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { isConflict, isUnauthorized } from '../../api/client';
import { tutorApplicationApi } from '../../api/tutorApplications';
import { HomeHeader } from '../home/HomeHeader';
import { TutorApplicationStatusBanner } from './TutorApplicationStatusBanner';
import { TutorApplicationStepper } from './TutorApplicationStepper';
import { WizardNavigation } from './WizardNavigation';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { EducationExperienceStep } from './steps/EducationExperienceStep';
import { TeachingSubjectsStep } from './steps/TeachingSubjectsStep';
import { IntroductionStep } from './steps/IntroductionStep';
import { VerificationDocumentsStep } from './steps/VerificationDocumentsStep';
import { ReviewSubmitStep } from './steps/ReviewSubmitStep';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';

const STEPS = [
  { id: 'basic', title: 'Thông tin cá nhân' },
  { id: 'education', title: 'Học vấn & kinh nghiệm' },
  { id: 'subjects', title: 'Môn học nhận dạy' },
  { id: 'intro', title: 'Giới thiệu hồ sơ' },
  { id: 'documents', title: 'Tài liệu xác minh' },
  { id: 'review', title: 'Xem lại & gửi duyệt' }
];

export function TutorApplicationWizard({ mode = 'INITIAL_TUTOR_REGISTRATION', onSuccessRedirect = '/tutor-next-step' }) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [application, setApplication] = useState(null);
  const [subjectCount, setSubjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const isBecomeTutorMode = mode === 'BECOME_TUTOR';
  const pageTitle = isBecomeTutorMode ? 'Trở thành gia sư' : 'Hoàn tất hồ sơ gia sư';
  const pageDescription = isBecomeTutorMode
    ? 'Khai báo năng lực giảng dạy và minh chứng để Admin xét duyệt quyền trở thành gia sư.'
    : 'Điền thông tin cần thiết để Admin xét duyệt hồ sơ trước khi bạn hoạt động với vai trò gia sư.';
  const backRoute = isBecomeTutorMode ? '/profile' : '/';
  const backLabel = isBecomeTutorMode ? 'Quay lại hồ sơ cá nhân' : 'Quay lại trang chủ';

  const currentIndex = useMemo(
    () => normalizeStep(searchParams.get('step')),
    [searchParams]
  );
  const readOnly = application?.status === 'PENDING' || application?.status === 'APPROVED';

  const handleSubjectsChanged = useCallback((nextSubjects) => {
    setSubjectCount(Array.isArray(nextSubjects) ? nextSubjects.length : 0);
  }, []);

  const handleApplicationUpdated = useCallback((nextApplication) => {
    setApplication(nextApplication);
  }, []);

  const handleSubmitSuccess = useCallback(async () => {
    await refreshUser().catch(() => null);
    navigate(onSuccessRedirect, { replace: true });
  }, [refreshUser, navigate, onSuccessRedirect]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setError('');

      try {
        const currentApplication = await loadOrCreateApplication();
        if (!active) return;

        setApplication(currentApplication);
        await loadSubjectCount(active);
      } catch (bootstrapError) {
        if (!active) return;

        if (isUnauthorized(bootstrapError)) {
          await refreshUser().catch(() => null);
          navigate('/login', { replace: true });
          return;
        }

        setError(bootstrapError.message || 'Không thể tải hồ sơ gia sư.');
      } finally {
        if (active) {
          setCreating(false);
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [navigate, refreshUser]);

  async function loadOrCreateApplication() {
    try {
      return await tutorApplicationApi.getMyTutorApplication();
    } catch (loadError) {
      if (loadError.status !== 404) {
        throw loadError;
      }

      setCreating(true);

      try {
        return await tutorApplicationApi.createTutorApplication();
      } catch (createError) {
        if (isConflict(createError)) {
          return tutorApplicationApi.getMyTutorApplication();
        }

        throw createError;
      }
    }
  }

  async function loadSubjectCount(active = true) {
    try {
      const subjects = await tutorApplicationApi.getMyTutorApplicationSubjects();
      if (active) setSubjectCount(Array.isArray(subjects) ? subjects.length : 0);
    } catch (subjectError) {
      if (subjectError.status === 404) {
        if (active) setSubjectCount(0);
        return;
      }
      throw subjectError;
    }
  }

  useRealtimeRefresh(['TUTOR_APPLICATION_REVIEWED'], async () => {
    const currentApplication = await tutorApplicationApi.getMyTutorApplication();
    setApplication(currentApplication);
    await refreshUser().catch(() => null);
  });

  async function retry() {
    setLoading(true);
    setError('');
    try {
      const currentApplication = await loadOrCreateApplication();
      setApplication(currentApplication);
      await loadSubjectCount(true);
    } catch (retryError) {
      if (isUnauthorized(retryError)) {
        await refreshUser().catch(() => null);
        navigate('/login', { replace: true });
        return;
      }
      setError(retryError.message || 'Không thể tải hồ sơ gia sư.');
    } finally {
      setCreating(false);
      setLoading(false);
    }
  }

  function setStep(index) {
    const next = Math.min(Math.max(index, 0), STEPS.length - 1);
    setSearchParams({ step: String(next + 1) }, { replace: true });
  }

  function renderStep() {
    const props = {
      application,
      readOnly,
      subjectCount,
      onApplicationUpdated: handleApplicationUpdated,
      onBack: () => setStep(currentIndex - 1),
      onNext: () => setStep(currentIndex + 1),
      onStepChange: setStep,
      onSubjectsChanged: handleSubjectsChanged,
      onSubmitSuccess: handleSubmitSuccess
    };
    switch (STEPS[currentIndex].id) {
      case 'basic':
        return <BasicInfoStep {...props} />;
      case 'education':
        return <EducationExperienceStep {...props} />;
      case 'subjects':
        return <TeachingSubjectsStep {...props} />;
      case 'intro':
        return <IntroductionStep {...props} />;
      case 'documents':
        return <VerificationDocumentsStep {...props} />;
      case 'review':
        return <ReviewSubmitStep {...props} />;
      default:
        return <BasicInfoStep {...props} />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <HomeHeader />

      <main className="container-app pt-28 pb-16">
        <Link
          to={backRoute}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,.07)]">
          <div className="bg-slate-900 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-100">
                  <Sparkles size={16} />
                  Tutor onboarding
                </p>
                <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
                  {pageTitle}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
                  {pageDescription}
                </p>
              </div>
              {application && (
                <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
                  {application.status}
                </span>
              )}
            </div>
          </div>
        </section>

        {loading ? (
          <WizardSkeleton creating={creating} />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <TutorApplicationStepper
              steps={STEPS}
              currentIndex={currentIndex}
              onStepChange={setStep}
              readOnly={readOnly}
            />

            <div className="grid gap-6">
              <TutorApplicationStatusBanner application={application} />

              {readOnly ? (
                <ReadOnlyState application={application} />
              ) : null}

              <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)] sm:p-8">
                {renderStep()}
                {['subjects', 'documents'].includes(STEPS[currentIndex].id) && (
                  <WizardNavigation
                    currentIndex={currentIndex}
                    totalSteps={STEPS.length}
                    onBack={() => setStep(currentIndex - 1)}
                    onNext={() => setStep(currentIndex + 1)}
                    disabled={false}
                  />
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function normalizeStep(value) {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 1), STEPS.length) - 1;
}

function WizardSkeleton({ creating }) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="hidden h-[460px] animate-pulse rounded-[8px] bg-white lg:block" />
      <div className="grid gap-6">
        <div className="rounded-[8px] border border-slate-200 bg-white p-6">
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="rounded-[8px] border border-slate-200 bg-white p-8">
          <div className="h-10 w-72 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <p className="mt-8 text-sm font-bold text-slate-500">
            {creating ? 'Đang tạo hồ sơ nháp...' : 'Đang tải hồ sơ gia sư...'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <section className="mt-8 rounded-[8px] border border-red-100 bg-red-50 p-6 text-red-800">
      <div className="flex items-start gap-3">
        <AlertCircle size={22} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-display text-xl font-extrabold">Không thể tải hồ sơ gia sư</h2>
          <p className="mt-2 text-sm font-semibold leading-6">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-3 text-sm font-extrabold text-red-800 hover:bg-red-100"
          >
            <RefreshCw size={16} />
            Thử lại
          </button>
        </div>
      </div>
    </section>
  );
}

function ReadOnlyState({ application }) {
  const approved = application?.status === 'APPROVED';
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5">
      <h2 className="font-display text-xl font-extrabold text-slate-950">
        {approved ? 'Hồ sơ đã được phê duyệt' : 'Hồ sơ đang chờ xét duyệt'}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {approved
          ? 'Hồ sơ và các môn/trình độ đã khai báo được kích hoạt. Khi tạo lớp, bạn chỉ dùng các nội dung đã được Admin duyệt.'
          : 'Bạn vẫn có thể xem các bước, nhưng không thể chỉnh sửa cho đến khi Admin phản hồi.'}
      </p>
    </section>
  );
}
