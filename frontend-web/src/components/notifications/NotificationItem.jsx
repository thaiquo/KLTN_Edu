import { Bell, CheckCircle2 } from 'lucide-react';
import { formatNotificationTime, formatRoleLabel } from './notificationFormat';

export function NotificationItem({ notification, target, onSelect, variant = 'student' }) {
  const isUnread = !notification.read;
  const timeLabel = formatNotificationTime(notification.createdAt);
  const roleLabel = formatRoleLabel(notification.targetRole);
  const tone = variant === 'portal' ? 'text-brand-primary bg-brand-low' : 'text-primary bg-blue-50';
  const hover = variant === 'portal' ? 'hover:bg-brand-low/70' : 'hover:bg-slate-50';

  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 rounded-[12px] px-3 py-3 text-left transition-colors ${hover}`}
      onClick={() => onSelect?.(notification, target)}
    >
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[11px] ${tone}`}>
        {isUnread ? <Bell size={16} /> : <CheckCircle2 size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="line-clamp-2 flex-1 text-sm font-extrabold text-slate-950">
            {notification.title || 'Thông báo'}
          </span>
          {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#147b77]" aria-label="Chưa đọc" />}
        </span>
        {notification.message && (
          <span className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
            {notification.message}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
          {timeLabel && <span>{timeLabel}</span>}
          {roleLabel && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
              {roleLabel}
            </span>
          )}
          {target && <span className="text-slate-500">Mở liên kết</span>}
        </span>
      </span>
    </button>
  );
}
