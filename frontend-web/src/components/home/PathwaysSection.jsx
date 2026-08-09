import { BadgeCheck, BookOpen, ClipboardList } from 'lucide-react';
import { pathways } from './homeData';

const stepIcons = [ClipboardList, BookOpen, BadgeCheck];

export function PathwaysSection() {
  return (
    <section className="py-[clamp(88px,10vw,144px)] bg-white scroll-mt-[90px]" id="pathways" aria-labelledby="pathways-title">
      <div className="container-app">

        {/* Heading */}
        <div className="grid gap-3.5 text-center place-items-center reveal">
          <span className="text-primary text-[11px] font-extrabold tracking-[.22em] uppercase">Quy trình</span>
          <h2 id="pathways-title" className="font-display font-extrabold text-[clamp(33px,4vw,54px)] leading-[1.08] tracking-tight max-w-[820px]">
            Hành trình của bạn bắt đầu tại đây
          </h2>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-2 gap-7 mt-16 max-[920px]:grid-cols-1">
          {pathways.map((pathway) => (
            <article
              key={pathway.title}
              className={`min-h-[560px] p-[clamp(30px,4vw,56px)] rounded-[48px] border overflow-hidden
                max-[920px]:min-h-0
                max-[520px]:px-6 max-[520px]:py-8 max-[520px]:rounded-[32px]
                ${pathway.tone === 'student'
                  ? 'border-blue-100 bg-blue-50'
                  : 'border-transparent bg-slate-900 text-white'
                }`}
            >
              {/* Pathway heading */}
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="font-display font-extrabold text-[clamp(24px,2.5vw,33px)] leading-[1.15] tracking-tight">
                    {pathway.title}
                  </h3>
                  <p className={`max-w-[320px] mt-3.5 text-[15px] leading-[1.6] ${pathway.tone === 'student' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {pathway.intro}
                  </p>
                </div>
                <span
                  className={`flex-none w-16 h-px mt-4 opacity-25 ${pathway.tone === 'student' ? 'bg-slate-800' : 'bg-white'} max-[520px]:w-8`}
                  aria-hidden="true"
                />
              </div>

              {/* Steps */}
              <ol className="relative grid gap-8 mt-14 step-list-line max-[520px]:gap-6">
                {pathway.steps.map((step, index) => {
                  const Icon = stepIcons[index];
                  return (
                    <li className="relative z-10 flex gap-5 max-[520px]:gap-3.5" key={step.number}>
                      <span
                        className={`flex-none w-11 h-11 grid place-items-center rounded-[13px] font-display font-extrabold text-base border
                          max-[520px]:w-9 max-[520px]:h-9 max-[520px]:text-[13px]
                          ${pathway.tone === 'student'
                            ? 'border-white/60 bg-white/85 text-primary'
                            : 'border-slate-600/20 bg-slate-800 text-blue-300'
                          }`}
                      >
                        {step.number}
                      </span>
                      <span className="grid gap-2 pt-0.5">
                        <strong className="inline-flex items-center gap-2 text-[17px] font-extrabold max-[520px]:text-[15px]">
                          <Icon size={17} className="text-primary flex-none" aria-hidden="true" />
                          {step.title}
                        </strong>
                        <span className={`max-w-[370px] text-[14px] leading-[1.62] max-[520px]:text-[13px] ${pathway.tone === 'student' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {step.description}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
