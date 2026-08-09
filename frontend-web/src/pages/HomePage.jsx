import { useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { HomeHeader } from '../components/home/HomeHeader';
import { HeroSection } from '../components/home/HeroSection';
import { PathwaysSection } from '../components/home/PathwaysSection';
import { CommunitySection } from '../components/home/CommunitySection';
import { TrustSection } from '../components/home/TrustSection';
import { TestimonialSection } from '../components/home/TestimonialSection';
import { FinalCta } from '../components/home/FinalCta';
import { HomeFooter } from '../components/home/HomeFooter';

export function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen text-ink bg-bg font-sans overflow-x-hidden scroll-smooth" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <HomeHeader />
      <main>
        <HeroSection onOpenChat={() => setChatOpen(true)} />
        <PathwaysSection />
        <CommunitySection />
        <TrustSection />
        <TestimonialSection />
        <FinalCta />
      </main>
      <HomeFooter />

      {/* ── Chatbot widget ── */}
      <div className="fixed right-6 bottom-6 z-[35] grid justify-items-end gap-3 max-[520px]:right-4 max-[520px]:bottom-4">

        {/* Chat panel */}
        {chatOpen && (
          <aside
            className="w-[min(330px,calc(100vw-32px))] overflow-hidden border border-slate-200 rounded-[22px] bg-white shadow-[0_24px_60px_rgba(15,23,42,.16)]"
            aria-label="Hỗ trợ tìm gia sư"
            role="dialog"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white font-extrabold">
              <span className="inline-flex items-center gap-2">
                <Bot size={17} /> Kết Nối Học
              </span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Đóng hỗ trợ"
                className="grid place-items-center border-0 text-slate-300 bg-transparent hover:text-white transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            {/* Body */}
            <div className="grid gap-2.5 p-4">
              {/* Intro */}
              <div className="flex items-start gap-2.5 p-3 rounded-[14px] bg-slate-50">
                <span className="flex-none w-7 h-7 grid place-items-center rounded-[9px] bg-primary text-white">
                  <Bot size={15} />
                </span>
                <p className="text-slate-500 text-[12px] leading-[1.5]">
                  Xin chào! Hãy cho tôi biết môn học và mục tiêu để tôi giúp bạn tìm gia sư phù hợp.
                </p>
              </div>

              {/* Quick prompts */}
              {[
                'Tìm gia sư luyện thi IELTS',
                'Tìm mentor cho khóa luận',
              ].map((text) => (
                <button
                  key={text}
                  type="button"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white text-left text-[12px] font-bold hover:border-blue-300 hover:text-primary transition-colors"
                  onClick={() => setChatOpen(false)}
                >
                  {text} <Send size={14} className="flex-none text-slate-400" />
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Trigger button */}
        <button
          className="inline-flex items-center gap-2 min-h-[48px] px-4 border-0 rounded-[16px] bg-primary text-white text-[13px] font-extrabold shadow-[0_16px_32px_rgba(37,99,235,.28)] hover:bg-primary-dark hover:-translate-y-0.5 transition-all max-[520px]:min-h-[44px] max-[520px]:px-3.5"
          type="button"
          aria-label={chatOpen ? 'Đóng hỗ trợ' : 'Tìm gia sư qua chat'}
          aria-expanded={chatOpen}
          onClick={() => setChatOpen((v) => !v)}
        >
          {chatOpen ? <X size={22} /> : <MessageCircle size={22} />}
          <span>Hỗ trợ</span>
        </button>
      </div>
    </div>
  );
}
