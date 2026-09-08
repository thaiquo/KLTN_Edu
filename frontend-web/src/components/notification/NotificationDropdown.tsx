import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Clock, ShieldAlert, Sparkles, CheckCircle2, XCircle, Info, ExternalLink } from "lucide-react";
import { notificationsApi, NotificationItem } from "../../api/notificationsApi";

interface NotificationDropdownProps {
  userEmail: string;
}

export function NotificationDropdown({ userEmail }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    if (!userEmail) return;
    try {
      const count = await notificationsApi.getUnreadCount(userEmail);
      setUnreadCount(count);
    } catch {
      // Silent catch
    }
  };

  const fetchNotifications = async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications(userEmail, 0, 15);
      setNotifications(res.content || []);
    } catch {
      // Silent catch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    const handleRealtimeEvent = () => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    };

    window.addEventListener("realtime:event", handleRealtimeEvent);
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      window.removeEventListener("realtime:event", handleRealtimeEvent);
      clearInterval(interval);
    };
  }, [userEmail, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id, userEmail);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, status: "READ" } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead(userEmail);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, status: "READ" }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    if (type.includes("FUNDED") || type.includes("SETTLED")) {
      return <Sparkles className="w-4 h-4 text-emerald-500" />;
    }
    if (type.includes("DISPUTE") || type.includes("REJECTED")) {
      return <ShieldAlert className="w-4 h-4 text-rose-500" />;
    }
    if (type.includes("APPROVED")) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    return <Info className="w-4 h-4 text-sky-500" />;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " " + date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        title="Thông báo"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-brand-text-variant hover:bg-brand-low rounded-full transition-colors relative"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Thông báo</span>
              {unreadCount > 0 && (
                <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium">Bạn không có thông báo nào</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.isRead && handleMarkAsRead(n.id, e)}
                  className={`p-3.5 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shadow-xs">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${!n.isRead ? "text-slate-900" : "text-slate-700"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.content}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(n.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
