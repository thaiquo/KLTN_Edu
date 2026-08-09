import { ArrowUpRight, BookOpen, Calculator, Code2, Languages } from 'lucide-react';

const icons = { calculator: Calculator, code: Code2, language: Languages };

export function ClassRequestRow({ item }) {
  const Icon = icons[item.icon] || BookOpen;

  return (
    <article className="flex items-center justify-between gap-7 px-6 py-6 border border-slate-200 rounded-[22px] bg-white shadow-[0_12px_28px_rgba(15,23,42,.03)] transition-[transform,border-color] duration-200 hover:translate-x-1.5 hover:border-blue-200 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-5">

      {/* Main info */}
      <div className="flex items-center gap-4 min-w-0">
        <span className="flex-none w-12 h-12 grid place-items-center rounded-2xl bg-blue-50 text-primary">
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <span className="block text-primary text-[10px] font-extrabold tracking-[.12em] uppercase">{item.subject}</span>
          <h3 className="mt-1 text-slate-900 font-display font-extrabold text-[15px] overflow-hidden text-ellipsis whitespace-nowrap max-[760px]:whitespace-normal">
            {item.title}
          </h3>
          <p className="mt-1 text-slate-500 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap max-[760px]:whitespace-normal">
            {item.requirement}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 flex-none max-[760px]:w-full max-[760px]:justify-end">
        <span>
          <strong className="block font-display font-extrabold text-[16px] text-primary">{item.budget}</strong>
          <span className="text-slate-400 text-[11px]">{item.duration}</span>
        </span>
        <a
          href="#matching"
          aria-label={`Xem yêu cầu ${item.title}`}
          className="w-9 h-9 grid place-items-center rounded-[11px] bg-slate-900 text-white hover:bg-primary transition-colors"
        >
          <ArrowUpRight size={17} />
        </a>
      </div>
    </article>
  );
}
