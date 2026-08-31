import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  X,
  FileSignature,
  DollarSign,
  AlertCircle,
  BookOpen,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "../../api/client";

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  status: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgreement?: (agreementId: string) => void;
  onSelectClassroom?: (classroomId: string) => void;
}

export function NotificationCenterDrawer({
  isOpen,
  onClose,
  onSelectAgreement,
  onSelectClassroom,
}: NotificationCenterDrawerProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/notifications/my?page=0&size=30");
      const list = data?.content || (Array.isArray(data) ? data : []);
      setNotifications(list);
    } catch (e) {
      console.warn("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleRealtime = () => {
      fetchNotifications();
    };
    window.addEventListener("realtime:event", handleRealtime);
    return () => window.removeEventListener("realtime:event", handleRealtime);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.warn("Failed to mark all as read:", e);
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await apiRequest(`/api/notifications/${n.id}/read`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      } catch (e) {
        console.warn("Failed to mark notification as read:", e);
      }
    }

    if (n.referenceType === "AGREEMENT" && n.referenceId && onSelectAgreement) {
      onSelectAgreement(n.referenceId);
      onClose();
    } else if (n.referenceType === "CLASSROOM" && n.referenceId && onSelectClassroom) {
      onSelectClassroom(n.referenceId);
      onClose();
    }
  };

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => (filter === "UNREAD" ? !n.isRead : true));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Top Bar */}
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Trung Tâm Thông Báo</h3>
                <p className="text-[11px] text-slate-500 font-semibold">
                  {unreadCount > 0 ? `Bạn có ${unreadCount} tin nhắn chưa đọc` : "Đã cập nhật tất cả tin mới"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Subheader */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setFilter("ALL")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("UNREAD")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === "UNREAD" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                Chưa đọc ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Đọc tất cả
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs font-bold">
                Đang tải thông báo...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">Không có thông báo nào</p>
              </div>
            ) : (
              filtered.map((item) => {
                const isAgr = item.referenceType === "AGREEMENT" || item.type.includes("AGREEMENT");
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      !item.isRead
                        ? "bg-blue-50/60 border-blue-200/80 hover:bg-blue-50"
                        : "bg-white border-slate-200/80 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        {isAgr ? (
                          <FileSignature className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )}
                        <span>{item.title}</span>
                      </div>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </span>

                      {item.referenceType === "AGREEMENT" && (
                        <span className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                          Xem hợp đồng <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
