import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Sparkles } from 'lucide-react';

const STATUS = {
  MODERATING: { label: 'Đang kiểm tra', tone: 'bg-amber-50 border-amber-200 text-amber-800', Icon: Clock3 },
  ALLOWED: { label: 'Đã duyệt', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800', Icon: CheckCircle2 },
  NEEDS_EDIT: { label: 'Cần chỉnh sửa', tone: 'bg-orange-50 border-orange-200 text-orange-800', Icon: AlertCircle },
  REJECTED: { label: 'Không phù hợp', tone: 'bg-rose-50 border-rose-200 text-rose-800', Icon: AlertCircle },
  FAILED: { label: 'Lỗi kiểm tra', tone: 'bg-slate-50 border-slate-200 text-slate-700', Icon: RefreshCw }
};

export function ModerationStatusBanner({ post, onRetry, onRewrite, retrying = false }) {
  const pending = Boolean(post?.pendingContentRevision);
  const status = pending ? post.pendingModerationStatus : post?.moderationStatus;
  if (!status || status === 'NOT_CHECKED') return null;
  const config = STATUS[status] || STATUS.MODERATING;
  const reason = pending ? post.pendingModerationReason : post.moderationReason;
  const Icon = config.Icon;
  return (
    <div className={`mb-3 flex flex-col items-stretch justify-between gap-3 rounded-lg border px-3 py-2 text-xs sm:flex-row sm:items-start ${config.tone}`}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">{pending ? `Bản chỉnh sửa: ${config.label}` : config.label}</p>
          {reason && <p className="mt-0.5 break-words">{reason}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {(status === 'NEEDS_EDIT' || status === 'REJECTED') && onRewrite && (
          <button
            type="button"
            onClick={onRewrite}
            className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 font-bold shadow-sm ring-1 ring-current/10 hover:bg-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI gợi ý chỉnh sửa
          </button>
        )}
        {status === 'FAILED' && onRetry && (
          <button type="button" onClick={onRetry} disabled={retrying}
            className="font-bold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {retrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        )}
      </div>
    </div>
  );
}
