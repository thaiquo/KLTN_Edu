import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { classRequests, featuredTutors } from './homeData';
import { TutorCard } from './TutorCard';
import { ClassRequestRow } from './ClassRequestRow';

export function CommunitySection() {
  const [activeTab, setActiveTab] = useState('tutors');

  return (
    <section className="py-[clamp(88px,10vw,144px)] bg-bg scroll-mt-[90px]" id="community" aria-labelledby="community-title">
      <div className="container-app">
        <div className="flex items-end justify-between gap-7 reveal max-[760px]:flex-col max-[760px]:items-start">
          <div className="grid gap-3.5">
            <span className="text-primary text-[11px] font-extrabold tracking-[.22em] uppercase">Cộng đồng</span>
            <h2 id="community-title" className="font-display font-extrabold text-[clamp(34px,5vw,62px)] leading-[.98] tracking-tight">
              Cộng đồng học tập<br className="hidden md:block" /> lớn mạnh nhất
            </h2>
          </div>
          <a
            className="inline-flex items-center gap-2 pb-1.5 border-b border-slate-900 text-[13px] font-extrabold whitespace-nowrap hover:text-primary hover:border-primary transition-colors"
            href="#matching"
          >
            Khám phá tất cả <ArrowUpRight size={16} />
          </a>
        </div>

        <div
          className="inline-flex gap-1 p-1.5 mt-12 mb-6 ml-auto border border-slate-200 rounded-[14px] bg-slate-100 max-[760px]:mt-8 max-[760px]:ml-0"
          role="tablist"
          aria-label="Khám phá cộng đồng"
        >
          {[
            { id: 'tutors', label: 'Gia sư nổi bật' },
            { id: 'classes', label: 'Lớp mới đăng' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-9 px-4 rounded-[10px] text-[12px] font-extrabold transition-all duration-200
                ${activeTab === tab.id
                  ? 'text-primary bg-white shadow-[0_8px_18px_rgba(15,23,42,.07)]'
                  : 'text-slate-500 bg-transparent hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'tutors' ? (
          <div
            className="grid grid-cols-3 gap-6 max-[920px]:grid-cols-2 max-[760px]:flex max-[760px]:overflow-x-auto max-[760px]:gap-3.5 max-[760px]:pb-3 max-[760px]:snap-x"
            id="panel-tutors"
            role="tabpanel"
            aria-labelledby="tab-tutors"
          >
            {featuredTutors.map((tutor) => (
              <div key={tutor.name} className="max-[920px]:last:col-span-2 max-[920px]:last:max-w-[360px] max-[760px]:flex-none max-[760px]:w-[min(300px,82vw)] max-[760px]:snap-start max-[920px]:last:max-w-none">
                <TutorCard tutor={tutor} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="grid gap-3.5"
            id="panel-classes"
            role="tabpanel"
            aria-labelledby="tab-classes"
          >
            {classRequests.map((item) => (
              <ClassRequestRow item={item} key={item.title} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
