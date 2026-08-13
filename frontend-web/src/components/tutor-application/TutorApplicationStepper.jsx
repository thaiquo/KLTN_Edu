import {
  BookOpenCheck,
  Check,
  FileCheck2,
  GraduationCap,
  IdCard,
  MessageSquareText,
  ShieldCheck
} from 'lucide-react';

const ICONS = [IdCard, GraduationCap, BookOpenCheck, MessageSquareText, FileCheck2, ShieldCheck];

export function TutorApplicationStepper({ steps, currentIndex, onStepChange, readOnly }) {
  const progress = ((currentIndex + 1) / steps.length) * 100;
  const roundedProgress = Math.round(progress);

  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-28 rounded-[12px] border border-slate-200 bg-white p-5 shadow-[0_24px_65px_rgba(15,23,42,.08)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Hồ sơ gia sư</p>
          <h2 className="mt-1 font-display text-xl font-extrabold text-slate-950">Hoàn thiện từng bước</h2>

          <div className="mt-5 rounded-[10px] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
              <span>Bước {currentIndex + 1}/{steps.length}</span>
              <span>{roundedProgress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#147b77] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <nav className="mt-6 grid gap-2" aria-label="Các bước hồ sơ gia sư">
            {steps.map((step, index) => {
              const Icon = ICONS[index] || Check;
              const active = index === currentIndex;
              const done = index < currentIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepChange(index)}
                  className={`grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-[8px] px-3 py-3 text-left transition-colors ${
                    active
                      ? 'bg-[#147b77] text-white shadow-[0_14px_28px_rgba(20,123,119,.2)]'
                      : done
                        ? 'bg-emerald-50/70 text-slate-700 hover:bg-emerald-50'
                        : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-[12px] ${
                    active ? 'bg-white/15' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {done ? <Check size={17} /> : <Icon size={17} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold">{step.title}</span>
                    <span className={`block text-xs font-semibold ${active ? 'text-white/75' : 'text-slate-400'}`}>
                      Bước {index + 1}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {readOnly && (
            <p className="mt-5 rounded-[8px] bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
              Hồ sơ đang ở trạng thái chỉ đọc. Bạn vẫn có thể xem từng phần đã gửi.
            </p>
          )}
        </div>
      </aside>

      <div className="rounded-[12px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,.05)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Bước {currentIndex + 1} / {steps.length}
          </p>
          <p className="min-w-0 truncate text-sm font-extrabold text-[#147b77]">{steps[currentIndex].title}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#147b77] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </>
  );
}
