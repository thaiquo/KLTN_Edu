import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { FEEDBACK_TYPES } from './feedbackTypes';

const TOAST_META = {
  [FEEDBACK_TYPES.SUCCESS]: {
    icon: CheckCircle2,
    title: 'Thành công',
    classes: 'border-emerald-200 bg-white text-emerald-700',
    iconClasses: 'text-emerald-600 bg-emerald-50'
  },
  [FEEDBACK_TYPES.ERROR]: {
    icon: XCircle,
    title: 'Có lỗi xảy ra',
    classes: 'border-red-200 bg-white text-red-700',
    iconClasses: 'text-red-600 bg-red-50'
  },
  [FEEDBACK_TYPES.WARNING]: {
    icon: AlertTriangle,
    title: 'Cần chú ý',
    classes: 'border-amber-200 bg-white text-amber-700',
    iconClasses: 'text-amber-600 bg-amber-50'
  },
  [FEEDBACK_TYPES.INFO]: {
    icon: Info,
    title: 'Thông tin',
    classes: 'border-sky-200 bg-white text-sky-700',
    iconClasses: 'text-sky-600 bg-sky-50'
  }
};

export function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed right-4 top-24 z-[10000] grid w-[min(92vw,390px)] gap-3 sm:right-5"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.slice(-4).map((toast) => {
        const meta = TOAST_META[toast.type] || TOAST_META[FEEDBACK_TYPES.INFO];
        const Icon = meta.icon;
        const alert = toast.type === FEEDBACK_TYPES.ERROR || toast.type === FEEDBACK_TYPES.WARNING;

        return (
          <div
            key={toast.id}
            className={`flex gap-3 rounded-[8px] border p-4 shadow-[0_18px_45px_rgba(15,23,42,.14)] ${meta.classes}`}
            role={alert ? 'alert' : 'status'}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] ${meta.iconClasses}`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">{toast.title || meta.title}</p>
              {toast.message && (
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
