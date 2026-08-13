import { ArrowLeft, ArrowRight } from 'lucide-react';

export function WizardNavigation({ currentIndex, totalSteps, onBack, onNext, disabled }) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={disabled || isFirst}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={disabled || isLast}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#147b77] disabled:cursor-not-allowed disabled:opacity-45"
      >
        Tiếp tục
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
