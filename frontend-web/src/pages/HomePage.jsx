import { useLocation, useNavigate } from 'react-router-dom';
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
        <HeroSection user={user} onOpenChat={openSharedAssistant} />
        {isAuthenticated ? (
          <StudentWorkspaceSections />
        ) : (
          <>
            <PathwaysSection />
            <CommunitySection />
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
