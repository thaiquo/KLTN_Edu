import { AlertTriangle, Info } from 'lucide-react';
import { CONFIRM_VARIANTS } from './feedbackTypes';

export function ConfirmModal({ state, onCancel, onConfirm }) {
  if (!state) return null;

  const destructive = state.variant === CONFIRM_VARIANTS.DESTRUCTIVE;
  const Icon = destructive ? AlertTriangle : Info;

  return (
    <div
      className="fixed inset-0 z-[10010] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-confirm-title"
      onMouseDown={state.closeOnOutside === false ? undefined : onCancel}
    >
      <section
        className="w-full max-w-md rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[8px] ${destructive ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="global-confirm-title" className="font-display text-lg font-extrabold text-slate-950">
              {state.title || 'Xác nhận thao tác'}
            </h2>
            {state.message && (
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{state.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={state.loading}
            className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.cancelText || 'Hủy'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={state.loading}
            className={`inline-flex min-h-11 items-center justify-center rounded-[8px] px-4 text-sm font-extrabold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-blue-700'}`}
          >
            {state.loading ? 'Đang xử lý...' : state.confirmText || 'Xác nhận'}
          </button>
        </div>
      </section>
    </div>
  );
}
