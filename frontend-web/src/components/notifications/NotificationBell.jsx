import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useFeedback } from '../feedback/useFeedback';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationUnreadCount,
  useNotifications
} from '../../hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell({
  activeRole,
  variant = 'student',
  buttonClassName = '',
  dropdownClassName = '',
  onNavigateTarget,
  label
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const feedback = useFeedback();

  const notificationsQuery = useNotifications({ page: 0, size: 8 });
  const unreadCountQuery = useNotificationUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = notificationsQuery.data?.content || [];
  const unreadCount = unreadCountQuery.data?.count || 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    function closeOnClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOnClickOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOnClickOutside);
    };
  }, []);

  async function handleMarkAllRead() {
    try {
      await markAllRead.mutateAsync({});
    } catch (err) {
      console.error('Không thể đánh dấu tất cả thông báo đã đọc:', err);
      feedback.error('Không thể cập nhật thông báo lúc này.');
    }
  }

  async function handleSelectNotification(notification, target) {
    setOpen(false);

    if (notification && !notification.read) {
      markRead.mutate(notification.id, {
        onError: (err) => {
          console.error('Không thể đánh dấu thông báo đã đọc:', err);
        }
      });
    }

    if (!target) return;

    if (onNavigateTarget) {
      onNavigateTarget(target);
    } else {
      navigate(target);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName}
        aria-label="Thông báo"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Thông báo"
      >
        <Bell size={variant === 'portal' ? 20 : 18} className={variant === 'portal' ? 'w-5 h-5' : undefined} />
        {label && <span>{label}</span>}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ef4444] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className={dropdownClassName}>
          <NotificationDropdown
            notifications={notifications}
            activeRole={activeRole}
            isLoading={notificationsQuery.isLoading || unreadCountQuery.isLoading}
            isError={notificationsQuery.isError || unreadCountQuery.isError}
            onRetry={() => {
              notificationsQuery.refetch();
              unreadCountQuery.refetch();
            }}
            unreadCount={unreadCount}
            onMarkAllRead={handleMarkAllRead}
            markAllLoading={markAllRead.isPending}
            onSelectNotification={handleSelectNotification}
            variant={variant}
          />
        </div>
      )}
    </div>
  );
}
