import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { classApi } from '../api/classes';
import { teachingCatalogApi } from '../api/teachingRegistrations';
import { tutorApi } from '../api/tutors';
import { HomeHeader } from '../components/home/HomeHeader';
import { HeroSection } from '../components/home/HeroSection';
import { PathwaysSection } from '../components/home/PathwaysSection';
import { CommunitySection } from '../components/home/CommunitySection';
import { TrustSection } from '../components/home/TrustSection';
import { TestimonialSection } from '../components/home/TestimonialSection';
import { FinalCta } from '../components/home/FinalCta';
import { HomeFooter } from '../components/home/HomeFooter';
import { StudentWorkspaceSections } from '../components/home/StudentWorkspaceSections';
import { useAuth } from '../hooks/useAuth';

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const notice = location.state?.message;
  const isAuthenticated = Boolean(user);
  const isStudent = user?.activeRole === 'STUDENT';
  const [publicData, setPublicData] = useState({
    tutors: [],
    tutorTotal: 0,
    classes: [],
    classTotal: 0,
    subjects: [],
    loading: true,
    hasError: false
  });
  const [studentData, setStudentData] = useState({
    classes: [],
    schedule: { recurringSchedules: [], sessions: [] },
    loading: isStudent,
    hasError: false
  });

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      tutorApi.searchPublicV2({ page: 0, size: 3, sort: 'rating,desc' }),
      classApi.getPublicClasses({ page: 0, size: 3, sort: 'newest' }),
      teachingCatalogApi.groundingSnapshot()
    ]).then(([tutorsResult, classesResult, catalogResult]) => {
      if (!active) return;

      const tutorPage = tutorsResult.status === 'fulfilled' ? tutorsResult.value : null;
      const classPage = classesResult.status === 'fulfilled' ? classesResult.value : null;
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;

      setPublicData({
        tutors: Array.isArray(tutorPage?.content) ? tutorPage.content : [],
        tutorTotal: Number(tutorPage?.totalElements || 0),
        classes: Array.isArray(classPage?.content) ? classPage.content : [],
        classTotal: Number(classPage?.totalElements || 0),
        subjects: Array.isArray(catalog?.subjects) ? catalog.subjects : [],
        loading: false,
        hasError: [tutorsResult, classesResult, catalogResult].some((result) => result.status === 'rejected')
      });
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isStudent) {
      setStudentData({
        classes: [],
        schedule: { recurringSchedules: [], sessions: [] },
        loading: false,
        hasError: false
      });
      return undefined;
    }

    let active = true;
    setStudentData((current) => ({ ...current, loading: true, hasError: false }));

    Promise.allSettled([
      classApi.getStudentClasses(),
      classApi.getStudentSchedule()
    ]).then(([classesResult, scheduleResult]) => {
      if (!active) return;

      const schedule = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null;
      setStudentData({
        classes: classesResult.status === 'fulfilled' && Array.isArray(classesResult.value)
          ? classesResult.value
          : [],
        schedule: {
          recurringSchedules: Array.isArray(schedule?.recurringSchedules) ? schedule.recurringSchedules : [],
          sessions: Array.isArray(schedule?.sessions) ? schedule.sessions : []
        },
        loading: false,
        hasError: classesResult.status === 'rejected' || scheduleResult.status === 'rejected'
      });
    });

    return () => {
      active = false;
    };
  }, [isStudent]);

  function closeNotice() {
    navigate('/', { replace: true, state: null });
  }

  function openSharedAssistant() {
    window.dispatchEvent(new CustomEvent('educonnect:open-ai-chat'));
  }

  return (
    <div className="min-h-screen text-ink bg-bg font-sans overflow-x-hidden scroll-smooth" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <HomeHeader />
      {notice && (
        <div className="fixed left-1/2 top-[96px] z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800 shadow-[0_18px_40px_rgba(15,23,42,.12)]">
          <div className="flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button
              type="button"
              className="rounded-md px-2 text-emerald-700 hover:bg-emerald-100"
              onClick={closeNotice}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <main>
        <HeroSection
          user={user}
          onOpenChat={openSharedAssistant}
          subjects={publicData.subjects}
          tutorTotal={publicData.tutorTotal}
          featuredTutor={publicData.tutors[0]}
          studentClasses={studentData.classes}
          studentSchedule={studentData.schedule}
          loading={publicData.loading}
        />
        {isAuthenticated ? (
          <>
            <StudentWorkspaceSections
              classes={studentData.classes}
              schedule={studentData.schedule}
              loading={studentData.loading}
              hasError={studentData.hasError}
            />
            <CommunitySection data={publicData} />
          </>
        ) : (
          <>
            <PathwaysSection />
            <CommunitySection data={publicData} />
            <TrustSection />
            <TestimonialSection />
            <FinalCta />
          </>
        )}
      </main>
      <HomeFooter />

    </div>
  );
}
