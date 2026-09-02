import { Bell, RefreshCw } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { getNotificationTarget } from './notificationNavigation';

export function NotificationDropdown({
  notifications,
  activeRole,
  isLoading,
  isError,
  onRetry,
  unreadCount,
  onMarkAllRead,
  markAllLoading,
  onSelectNotification,
  variant = 'student'
}) {
  const canMarkAll = unreadCount > 0 && !markAllLoading;

  return (
    <div className="w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-extrabold text-slate-950">Thông báo</p>
          <p className="text-xs font-semibold text-slate-500">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo chưa đọc'}
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={!canMarkAll}
          className="rounded-[10px] px-3 py-2 text-xs font-extrabold text-[#147b77] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          {markAllLoading ? 'Đang xử lý...' : 'Đọc tất cả'}
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {isLoading && (
          <div className="flex items-center gap-3 rounded-[12px] px-3 py-5 text-sm font-bold text-slate-500">
            <RefreshCw size={17} className="animate-spin" />
            Đang tải thông báo...
          </div>
        )}

        {isError && !isLoading && (
          <div className="rounded-[12px] border border-red-100 bg-red-50 px-3 py-4">
            <p className="text-sm font-extrabold text-red-700">Không thể tải thông báo.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-xs font-extrabold text-red-700 underline underline-offset-2"
            >
              Thử lại
            </button>
          </div>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div className="grid place-items-center gap-2 px-4 py-8 text-center">
            <span className={`grid h-11 w-11 place-items-center rounded-[13px] ${variant === 'portal' ? 'bg-brand-low text-brand-primary' : 'bg-blue-50 text-primary'}`}>
              <Bell size={18} />
            </span>
            <p className="text-sm font-extrabold text-slate-900">Chưa có thông báo nào.</p>
            <p className="max-w-[240px] text-xs font-semibold leading-5 text-slate-500">
              Các cập nhật quan trọng sẽ xuất hiện tại đây khi backend tạo thông báo.
            </p>
          </div>
        )}

        {!isLoading && !isError && notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            target={getNotificationTarget(notification, activeRole)}
            onSelect={onSelectNotification}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
