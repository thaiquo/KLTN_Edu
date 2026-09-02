import { CheckCircle2 } from 'lucide-react';

export function ImportantSuccessModal({ state, onClose }) {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[10010] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="important-success-title">
      <section className="w-full max-w-md rounded-[8px] border border-emerald-200 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,.22)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[8px] bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={28} />
        </span>
        <h2 id="important-success-title" className="mt-4 font-display text-xl font-extrabold text-slate-950">
          {state.title || 'Thao tác thành công'}
        </h2>
        {state.message && (
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{state.message}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-[#147b77] px-4 text-sm font-extrabold text-white transition-colors hover:bg-slate-900"
        >
          {state.actionText || 'Đã hiểu'}
        </button>
      </section>
    </div>
  );
}
