/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Video,
  X
} from "lucide-react";
import {
  CHAT_IMAGE_ACCEPT,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGE_MAX_FILES,
  CHAT_IMAGE_TYPES,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_VIDEO_ACCEPT,
  CHAT_VIDEO_MAX_BYTES,
  CHAT_VIDEO_TYPES,
  chatApi,
  ChatAttachmentDto,
  ChatConversationDto,
  ChatMessageDto
} from "../../api/chatApi";
import { ApiError, isForbidden, isUnauthorized } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { SharedResourceCard } from "../../components/sharing/SharedResourceCard";

const PAGE_SIZE = 30;
const NEAR_BOTTOM_PX = 96;

interface MessagesViewProps {
  embeddedInStudentPage?: boolean;
}

interface ChatRealtimePayload {
  messageId: string;
  conversationId: string;
  senderUserId: number;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "SHARED_RESOURCE";
  content: string;
  sharedResourceType?: "CLASS" | "COMMUNITY_POST" | null;
  sharedResourcePublicId?: string | null;
  attachments?: ChatAttachmentDto[];
  createdAt: string;
  read?: boolean;
}

type PendingMedia = {
  type: "IMAGE" | "VIDEO";
  files: Array<{ id: string; file: File; previewUrl: string | null }>;
};

function avatarInitials(name?: string) {
  return (name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatClock(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatConversationTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === new Date().toDateString()) return formatClock(value);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function roleLabel(role?: string | null) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "TUTOR") return "Gia sư";
  if (normalized === "STUDENT") return "Học viên";
  return "Đối tác học tập";
}

function attachmentsOf(message: Pick<ChatMessageDto, "attachments"> | Pick<ChatRealtimePayload, "attachments">) {
  return Array.isArray(message.attachments) ? message.attachments : [];
}

function messageType(message: Pick<ChatMessageDto, "type" | "attachments"> | Pick<ChatRealtimePayload, "type" | "attachments">) {
  const type = String(message.type || "").toUpperCase();
  if (type === "IMAGE" || type === "VIDEO" || type === "SHARED_RESOURCE") return type;
  const first = attachmentsOf(message)[0];
  if (first?.contentType?.startsWith("image/")) return "IMAGE";
  if (first?.contentType?.startsWith("video/")) return "VIDEO";
  return "TEXT";
}

function messagePreview(message: Pick<ChatMessageDto, "type" | "content" | "attachments"> | Pick<ChatRealtimePayload, "type" | "content" | "attachments">) {
  const type = messageType(message);
  if (type === "IMAGE") {
    const count = attachmentsOf(message).length || 1;
    return count === 1 ? "Đã gửi 1 hình ảnh" : `Đã gửi ${count} hình ảnh`;
  }
  if (type === "VIDEO") return "Đã gửi một video";
  if (type === "SHARED_RESOURCE") return "Đã chia sẻ một nội dung";
  return message.content || "Tin nhắn mới";
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function validateFiles(files: File[], mode: "IMAGE" | "VIDEO") {
  if (!files.length) return null;
  const allowed = mode === "IMAGE" ? CHAT_IMAGE_TYPES : CHAT_VIDEO_TYPES;
  if (files.some((file) => !allowed.has(file.type))) {
    return mode === "VIDEO" ? "Định dạng video chưa được hỗ trợ." : "Định dạng tệp chưa được hỗ trợ.";
  }
  if (mode === "IMAGE") {
    if (files.length > CHAT_IMAGE_MAX_FILES) return "Bạn chỉ có thể gửi tối đa 5 ảnh trong một lần.";
    if (files.some((file) => file.size > CHAT_IMAGE_MAX_BYTES)) return "Mỗi ảnh chỉ được tối đa 10 MB.";
  } else {
    if (files.length > 1) return "Chỉ có thể gửi một video trong một lần.";
    if (files.some((file) => file.size > CHAT_VIDEO_MAX_BYTES)) return "Video chỉ được tối đa 40 MB.";
  }
  return null;
}

function safeErrorMessage(error: unknown) {
  if (isUnauthorized(error)) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (isForbidden(error)) return "Bạn không có quyền truy cập cuộc trò chuyện này.";
  if (error instanceof ApiError) return error.message || "Không thể tải tin nhắn.";
  return "Không thể kết nối đến hệ thống tin nhắn.";
}

function sortMessages(messages: ChatMessageDto[]) {
  return [...messages].sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime || a.id.localeCompare(b.id);
  });
}

function mergeMessages(current: ChatMessageDto[], incoming: ChatMessageDto[]) {
  const map = new Map<string, ChatMessageDto>();
  current.forEach((message) => map.set(message.id, message));
  incoming.forEach((message) => map.set(message.id, { ...map.get(message.id), ...message }));
  return sortMessages(Array.from(map.values()));
}

function mergeConversationPreview(
  conversations: ChatConversationDto[],
  payload: ChatRealtimePayload,
  currentUserId?: number,
  activeConversationId?: string | null
) {
  return conversations
    .map((conversation) => {
      if (conversation.id !== payload.conversationId) return conversation;
      const incoming = Number(payload.senderUserId) !== Number(currentUserId);
      const active = conversation.id === activeConversationId;
      return {
        ...conversation,
        lastMessage: messagePreview(payload),
        lastMessageTime: payload.createdAt,
        updatedAt: payload.createdAt,
        unreadCount: incoming && !active ? (conversation.unreadCount || 0) + 1 : active ? 0 : conversation.unreadCount
      };
    })
    .sort((a, b) => new Date(b.updatedAt || b.lastMessageTime).getTime() - new Date(a.updatedAt || a.lastMessageTime).getTime());
}

export function MessagesView({ embeddedInStudentPage = false }: MessagesViewProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversationDto[]>([]);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(searchParams.get("conversation"));
  const [conversationLoading, setConversationLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [inputText, setInputText] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const scrollFrameRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottom = useRef(true);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const pendingReadRequestsRef = useRef<Set<string>>(new Set());
  const readTimersRef = useRef<Map<string, number>>(new Map());
  const currentUserId = Number(user?.id);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conversation) => conversation.id));
  }, [conversations]);

  const revokePending = useCallback((media: PendingMedia | null) => {
    media?.files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const clearPendingMedia = useCallback(() => {
    setPendingMedia((current) => {
      revokePending(current);
      return null;
    });
    setAttachmentError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }, [revokePending]);

  useEffect(() => () => {
    readTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    readTimersRef.current.clear();
    revokePending(pendingMedia);
  }, [pendingMedia, revokePending]);

  const setConversationInRoute = useCallback((id: string | null, options: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/dashboard" && !next.get("tab")) {
      next.set("tab", "messages");
    }
    if (id) next.set("conversation", id);
    else next.delete("conversation");
    setSearchParams(next, { replace: Boolean(options.replace) });
  }, [setSearchParams]);

  const markActiveRead = useCallback(async (conversationId: string) => {
    if (pendingReadRequestsRef.current.has(conversationId)) return;
    pendingReadRequestsRef.current.add(conversationId);
    try {
      const result = await chatApi.markRead(conversationId);
      setConversations((prev) => prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: result.unreadCount } : conversation
      ));
    } catch {
      // Reconciled on next conversation refresh.
    } finally {
      pendingReadRequestsRef.current.delete(conversationId);
    }
  }, []);

  const scheduleMarkActiveRead = useCallback((conversationId: string) => {
    const previousTimer = readTimersRef.current.get(conversationId);
    if (previousTimer) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      readTimersRef.current.delete(conversationId);
      markActiveRead(conversationId);
    }, 180);
    readTimersRef.current.set(conversationId, timer);
  }, [markActiveRead]);

  const loadConversations = useCallback(async ({ preserveActive = false } = {}) => {
    setConversationLoading(true);
    setError(null);
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
      const routeConversation = new URLSearchParams(window.location.search).get("conversation");
      const nextActive =
        preserveActive && activeConversationIdRef.current && data.some((item) => item.id === activeConversationIdRef.current)
          ? activeConversationIdRef.current
          : routeConversation && data.some((item) => item.id === routeConversation)
            ? routeConversation
            : data[0]?.id || null;
      setActiveConversationId(nextActive);
      setConversationInRoute(nextActive, { replace: !routeConversation || routeConversation !== nextActive });
      if (!nextActive) setMessages([]);
    } catch (err) {
      setError(safeErrorMessage(err));
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
    } finally {
      setConversationLoading(false);
    }
  }, [setConversationInRoute]);

  const loadMessages = useCallback(async (conversationId: string, targetPage = 0) => {
    if (targetPage === 0) {
      setMessageLoading(true);
      shouldScrollToBottom.current = true;
    } else {
      setOlderLoading(true);
      shouldScrollToBottom.current = false;
    }
    setMessageError(null);
    try {
      const data = await chatApi.getMessages(conversationId, targetPage, PAGE_SIZE);
      const chronological = sortMessages(data.content);
      setMessages((prev) => targetPage === 0 ? chronological : mergeMessages(chronological, prev));
      setPage(data.page);
      setHasOlder(!data.last);
      if (targetPage === 0) await markActiveRead(conversationId);
    } catch (err) {
      setMessageError(safeErrorMessage(err));
      if (targetPage === 0) setMessages([]);
    } finally {
      setMessageLoading(false);
      setOlderLoading(false);
    }
  }, [markActiveRead]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const routeConversation = searchParams.get("conversation");
    if (routeConversation && routeConversation !== activeConversationId) {
      setActiveConversationId(routeConversation);
    }
  }, [searchParams, activeConversationId]);

  useEffect(() => {
    if (activeConversationId) loadMessages(activeConversationId, 0);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (shouldScrollToBottom.current && scrollFrameRef.current) {
      scrollFrameRef.current.scrollTop = scrollFrameRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleRealtime = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame?.type !== "NEW_MESSAGE" || !frame.payload?.messageId) return;
      const payload = frame.payload as ChatRealtimePayload;
      const active = activeConversationIdRef.current === payload.conversationId;
      const socketMessage: ChatMessageDto = {
        id: payload.messageId,
        conversationId: payload.conversationId,
        senderId: Number(payload.senderUserId),
        type: payload.type || "TEXT",
        content: payload.content,
        sharedResourceType: payload.sharedResourceType,
        sharedResourcePublicId: payload.sharedResourcePublicId,
        attachments: payload.attachments || [],
        createdAt: payload.createdAt,
        isRead: Boolean(payload.read)
      };

      const scrollFrame = scrollFrameRef.current;
      shouldScrollToBottom.current = active && (scrollFrame
        ? scrollFrame.scrollHeight - scrollFrame.scrollTop - scrollFrame.clientHeight < NEAR_BOTTOM_PX
        : true);

      setConversations((prev) => mergeConversationPreview(prev, payload, currentUserId, activeConversationIdRef.current));
      if (active) {
        setMessages((prev) => mergeMessages(prev, [socketMessage]));
        if (Number(payload.senderUserId) !== currentUserId) scheduleMarkActiveRead(payload.conversationId);
      } else if (!conversationIdsRef.current.has(payload.conversationId)) {
        loadConversations({ preserveActive: true });
      }
    };
    const handleReconnect = () => {
      loadConversations({ preserveActive: true });
      if (activeConversationIdRef.current) loadMessages(activeConversationIdRef.current, 0);
    };
    window.addEventListener("realtime:event", handleRealtime);
    window.addEventListener("chat:reconnected", handleReconnect);
    return () => {
      window.removeEventListener("realtime:event", handleRealtime);
      window.removeEventListener("chat:reconnected", handleReconnect);
    };
  }, [currentUserId, loadConversations, loadMessages, scheduleMarkActiveRead]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    const needle = searchContact.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) =>
      (conversation.counterpartDisplayName || conversation.counterpartEmail || "").toLowerCase().includes(needle)
    );
  }, [conversations, searchContact]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setConversationInRoute(id);
    setConversations((prev) => prev.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item));
  };

  const handleLoadOlder = async () => {
    if (!activeConversationId || olderLoading || !hasOlder) return;
    await loadMessages(activeConversationId, page + 1);
  };

  const setSelectedFiles = (mode: "IMAGE" | "VIDEO", files: File[]) => {
    setAttachmentError(null);
    const validationError = validateFiles(files, mode);
    if (validationError) {
      setAttachmentError(validationError);
      if (mode === "IMAGE" && imageInputRef.current) imageInputRef.current.value = "";
      if (mode === "VIDEO" && videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setPendingMedia((current) => {
      revokePending(current);
      return {
        type: mode,
        files: files.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: mode === "IMAGE" ? URL.createObjectURL(file) : null
        }))
      };
    });
  };

  const removePendingFile = (id: string) => {
    setPendingMedia((current) => {
      if (!current) return null;
      const removed = current.files.find((item) => item.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      const nextFiles = current.files.filter((item) => item.id !== id);
      return nextFiles.length ? { ...current, files: nextFiles } : null;
    });
    setAttachmentError(null);
  };

  const handleSend = async () => {
    if (!activeConversationId || sending) return;
    const content = inputText.trim();
    if ((!content && !pendingMedia) || content.length > CHAT_MESSAGE_MAX_LENGTH) return;
    setSending(true);
    setMessageError(null);
    try {
      const saved = pendingMedia
        ? await chatApi.sendAttachment(activeConversationId, pendingMedia.files.map((item) => item.file), content)
        : await chatApi.sendMessage(activeConversationId, content);
      shouldScrollToBottom.current = true;
      setMessages((prev) => mergeMessages(prev, [saved]));
      setConversations((prev) => prev
        .map((conversation) => conversation.id === activeConversationId
          ? { ...conversation, lastMessage: messagePreview(saved), lastMessageTime: saved.createdAt, updatedAt: saved.createdAt, unreadCount: 0 }
          : conversation)
        .sort((a, b) => new Date(b.updatedAt || b.lastMessageTime).getTime() - new Date(a.updatedAt || a.lastMessageTime).getTime())
      );
      setInputText("");
      clearPendingMedia();
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : "Không thể gửi tệp lúc này. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const blankOrTooLong = (!inputText.trim() && !pendingMedia) || inputText.trim().length > CHAT_MESSAGE_MAX_LENGTH;

  return (
    <div className={`font-sans flex min-h-0 border border-brand-border/30 rounded-[8px] bg-white overflow-hidden shadow-sm ${embeddedInStudentPage ? "h-[calc(100vh-7.5rem)] min-h-[560px]" : "h-[calc(100vh-8rem)] min-h-[560px]"}`}>
      <div className={`${activeConversation ? "hidden md:flex" : "flex"} w-full md:w-80 border-r border-brand-border/30 flex-col shrink-0 bg-brand-low/5`}>
        <div className="p-4 border-b border-brand-border/20 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-black text-lg text-brand-text">Tin nhắn</h2>
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-brand-primary">Thật</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-variant/40 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm cuộc trò chuyện..."
              className="w-full bg-brand-low border border-brand-border/20 rounded-[8px] py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-brand-primary outline-none focus:bg-white transition-colors"
              value={searchContact}
              onChange={(event) => setSearchContact(event.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-brand-border/10">
          {conversationLoading && <LoadingRow text="Đang tải cuộc trò chuyện..." />}
          {!conversationLoading && error && <ErrorBox text={error} />}
          {!conversationLoading && !error && filteredConversations.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-brand-text-variant/70">Bạn chưa có cuộc trò chuyện nào.</div>
          )}
          {filteredConversations.map((conversation) => {
            const isSelected = conversation.id === activeConversation?.id;
            const name = conversation.counterpartDisplayName || "Người dùng EduConnect";
            return (
              <button
                type="button"
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className={`w-full p-4 flex gap-3 text-left transition-all border-l-4 ${isSelected ? "bg-brand-primary/5 border-brand-primary" : "border-transparent hover:bg-brand-low/40"}`}
              >
                <Avatar name={name} src={conversation.counterpartAvatarUrl || ""} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="font-bold text-brand-text text-xs tracking-wide truncate">{name}</span>
                    <span className="text-[9px] uppercase font-bold text-brand-text-variant/40 shrink-0">
                      {formatConversationTime(conversation.lastMessageTime || conversation.updatedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <p className={`text-xs truncate ${conversation.unreadCount > 0 ? "font-bold text-brand-primary" : "text-brand-text-variant/70"}`}>
                      {conversation.lastMessage || "Chưa có tin nhắn."}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="bg-brand-secondary text-white text-[10px] min-w-5 h-5 px-1 flex items-center justify-center rounded-full font-bold shadow-sm shrink-0">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${activeConversation ? "flex" : "hidden md:flex"} w-full flex-1 flex-col bg-brand-low/5 relative`}>
        {activeConversation ? (
          <>
            <header className="h-16 px-6 border-b border-brand-border/20 flex items-center justify-between bg-white z-10 shadow-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveConversationId(null);
                    setConversationInRoute(null);
                  }}
                  className="md:hidden rounded-[8px] p-2 text-brand-text-variant hover:bg-brand-low"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar name={activeConversation.counterpartDisplayName} src={activeConversation.counterpartAvatarUrl || ""} size="sm" />
                <div className="min-w-0">
                  <h3 className="font-bold text-brand-text text-sm leading-none mb-1 truncate">
                    {activeConversation.counterpartDisplayName || "Người dùng EduConnect"}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-text-variant/60 font-semibold font-display tracking-wide">
                    <span>{roleLabel(activeConversation.counterpartRole)}</span>
                    <span>-</span>
                    <span>Nhắn tin bảo mật</span>
                  </div>
                </div>
              </div>
            </header>

            <div ref={scrollFrameRef} className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
              {hasOlder && (
                <div className="flex justify-center">
                  <button type="button" onClick={handleLoadOlder} disabled={olderLoading} className="rounded-[8px] border border-brand-border/40 bg-white px-4 py-2 text-xs font-extrabold text-brand-primary shadow-sm hover:bg-brand-low disabled:cursor-not-allowed disabled:opacity-60">
                    {olderLoading ? "Đang tải..." : "Tải tin nhắn cũ hơn"}
                  </button>
                </div>
              )}
              {messageLoading && <LoadingRow text="Đang tải lịch sử tin nhắn..." centered />}
              {messageError && <ErrorBox text={messageError} centered />}
              {!messageLoading && messages.length === 0 && !messageError && (
                <div className="flex h-full flex-col items-center justify-center text-center text-brand-text-variant/70">
                  <MessageSquare className="mb-3 h-10 w-10 text-brand-border" />
                  <p className="text-sm font-bold">Chưa có tin nhắn trong cuộc trò chuyện này.</p>
                </div>
              )}
              {messages.map((message) => {
                const ownMessage = Number(message.senderId) === currentUserId;
                return (
                  <div key={message.id} className={`flex gap-3 max-w-[88%] sm:max-w-[80%] ${ownMessage ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                    {!ownMessage && <Avatar name={activeConversation.counterpartDisplayName} src={activeConversation.counterpartAvatarUrl || ""} size="xs" />}
                    <div className="space-y-1 min-w-0">
                      <MessageBubble message={message} ownMessage={ownMessage} />
                      <div className={`flex items-center gap-1.5 px-1 ${ownMessage ? "justify-end" : ""}`}>
                        <span className="text-[9px] font-bold text-brand-text-variant/40">{formatClock(message.createdAt)}</span>
                        {ownMessage && <CheckCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="p-3 sm:p-4 bg-white border-t border-brand-border/20 shrink-0">
              <input ref={imageInputRef} type="file" multiple accept={CHAT_IMAGE_ACCEPT} className="hidden" onChange={(event) => setSelectedFiles("IMAGE", Array.from(event.target.files || []))} data-testid="chat-image-input" />
              <input ref={videoInputRef} type="file" accept={CHAT_VIDEO_ACCEPT} className="hidden" onChange={(event) => setSelectedFiles("VIDEO", Array.from(event.target.files || []))} data-testid="chat-video-input" />
              {pendingMedia && (
                <MediaDraft media={pendingMedia} onRemove={removePendingFile} onClear={clearPendingMedia} />
              )}
              {attachmentError && <ErrorBox text={attachmentError} />}
              <div className="max-w-4xl mx-auto flex items-end gap-2 sm:gap-3 bg-brand-low border border-brand-border/30 rounded-[8px] p-2 focus-within:border-brand-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-primary/10 transition-all">
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={sending} className="mb-1 rounded-[8px] p-2.5 text-brand-text-variant hover:bg-white hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50" title="Gửi ảnh" data-testid="chat-image-button">
                  <ImageIcon className="h-4 w-4 shrink-0" />
                </button>
                <button type="button" onClick={() => videoInputRef.current?.click()} disabled={sending} className="mb-1 rounded-[8px] p-2.5 text-brand-text-variant hover:bg-white hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50" title="Gửi video" data-testid="chat-video-button">
                  <Video className="h-4 w-4 shrink-0" />
                </button>
                <div className="flex-1">
                  <textarea
                    rows={1}
                    maxLength={CHAT_MESSAGE_MAX_LENGTH}
                    className="max-h-28 min-h-10 w-full resize-none bg-transparent border-none focus:ring-0 text-sm font-sans placeholder:text-brand-text-variant/40 outline-none text-brand-text py-2"
                    placeholder="Nhập tin nhắn..."
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="text-right text-[10px] font-semibold text-brand-text-variant/50">
                    {inputText.trim().length}/{CHAT_MESSAGE_MAX_LENGTH}
                  </div>
                </div>
                <button type="button" onClick={handleSend} data-testid="chat-send-button" disabled={blankOrTooLong || sending} className="bg-brand-secondary text-white p-2.5 rounded-[8px] flex items-center justify-center hover:bg-brand-secondary-hover active:scale-95 transition-all shadow-md shrink-0 disabled:cursor-not-allowed disabled:opacity-50" title="Gửi tin nhắn">
                  {sending ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Send className="w-4 h-4 shrink-0" />}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-brand-low/5 p-12 text-center text-brand-text-variant/60">
            <MessageSquare className="w-12 h-12 text-brand-border/70 mb-4" />
            <h3 className="font-display font-black text-sm text-brand-text">Chọn một cuộc trò chuyện</h3>
            <p className="text-xs max-w-xs mt-1">Lịch sử tin nhắn sẽ được tải trực tiếp từ hệ thống khi bạn chọn một cuộc trò chuyện.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingRow({ text, centered = false }: { text: string; centered?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-4 text-xs font-bold text-brand-text-variant ${centered ? "justify-center" : ""}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function ErrorBox({ text, centered = false }: { text: string; centered?: boolean }) {
  return (
    <div className={`${centered ? "mx-auto max-w-md" : "mx-auto mb-2 max-w-4xl"} flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

function MediaDraft({ media, onRemove, onClear }: { media: PendingMedia; onRemove: (id: string) => void; onClear: () => void }) {
  return (
    <div className="mx-auto mb-2 max-w-4xl rounded-[8px] border border-brand-border/30 bg-brand-low p-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold text-brand-text">
          {media.type === "IMAGE" ? `${media.files.length} ảnh đã chọn` : "Video đã chọn"}
        </div>
        <button type="button" onClick={onClear} className="rounded-[8px] p-1.5 text-brand-text-variant hover:bg-white hover:text-brand-text" title="Xóa tất cả">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={media.type === "IMAGE" ? "grid grid-cols-3 sm:grid-cols-5 gap-2" : "space-y-2"}>
        {media.files.map((item) => (
          <div key={item.id} className="relative overflow-hidden rounded-[8px] border border-brand-border/20 bg-white">
            {media.type === "IMAGE" && item.previewUrl ? (
              <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex h-16 items-center gap-2 px-3 text-xs font-bold text-brand-text">
                <Video className="h-5 w-5 text-brand-primary" />
                <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                <span className="shrink-0 text-brand-text-variant/60">{formatFileSize(item.file.size)}</span>
              </div>
            )}
            {media.type === "IMAGE" && (
              <div className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-1 text-[10px] font-semibold text-white">
                <span className="block truncate">{item.file.name}</span>
              </div>
            )}
            <button type="button" onClick={() => onRemove(item.id)} className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white hover:bg-black/75" title="Xóa tệp">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderMessageText(content: string, ownMessage: boolean) {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s]+|\/classes\/\d+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, index) => {
    if (/^(https?:\/\/[^\s]+|\/classes\/\d+)$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-bold break-all hover:opacity-80 ${
            ownMessage ? "text-indigo-100" : "text-indigo-600"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function MessageBubble({ message, ownMessage }: { message: ChatMessageDto; ownMessage: boolean }) {
  const type = messageType(message);
  const attachments = attachmentsOf(message);
  const hasCaption = Boolean(message.content?.trim());
  const mediaFrameClass = ownMessage ? "border-white/20 bg-white/10" : "border-brand-border/20 bg-brand-low/40";

  if (type === "SHARED_RESOURCE" && message.sharedResourceType && message.sharedResourcePublicId) {
    return (
      <SharedResourceCard
        resourceType={message.sharedResourceType}
        publicShareId={message.sharedResourcePublicId}
        caption={message.content}
      />
    );
  }

  if (type === "TEXT") {
    return (
      <div className={`whitespace-pre-wrap break-words p-4 rounded-2xl shadow-sm text-sm leading-relaxed border ${ownMessage ? "bg-brand-primary text-white border-brand-primary/10 rounded-br-sm" : "bg-white text-brand-text border-brand-border/20 rounded-bl-sm"}`}>
        {renderMessageText(message.content, ownMessage)}
      </div>
    );
  }

  return (
    <div className={`space-y-2 p-2 rounded-2xl shadow-sm border ${ownMessage ? "bg-brand-primary text-white border-brand-primary/10 rounded-br-sm" : "bg-white text-brand-text border-brand-border/20 rounded-bl-sm"}`}>
      {type === "IMAGE" ? (
        <ImageGrid attachments={attachments} frameClass={mediaFrameClass} />
      ) : (
        <VideoAttachment attachment={attachments[0]} frameClass={mediaFrameClass} />
      )}
      <div className={`flex items-center gap-2 px-1 text-[10px] font-bold ${ownMessage ? "text-white/80" : "text-brand-text-variant/60"}`}>
        {type === "IMAGE" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <Video className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{type === "IMAGE" ? messagePreview(message) : attachments[0]?.fileName || "Video"}</span>
        {type === "VIDEO" && attachments[0]?.size ? <span className="shrink-0">({formatFileSize(attachments[0].size)})</span> : null}
      </div>
      {hasCaption && <p className="whitespace-pre-wrap break-words px-2 pb-1 text-sm leading-relaxed">{renderMessageText(message.content, ownMessage)}</p>}
    </div>
  );
}

function ImageGrid({ attachments, frameClass }: { attachments: ChatAttachmentDto[]; frameClass: string }) {
  if (!attachments.length) {
    return <MissingMedia type="IMAGE" frameClass={frameClass} />;
  }
  const gridClass = attachments.length === 1
    ? "grid-cols-1"
    : attachments.length === 2
      ? "grid-cols-2"
      : "grid-cols-2";
  return (
    <div className={`grid ${gridClass} gap-1 overflow-hidden rounded-[8px] max-w-[18rem] sm:max-w-sm`} data-testid="chat-image-grid">
      {attachments.map((attachment, index) => (
        attachment.url ? (
          <a key={attachment.id || `${attachment.fileName}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className={attachments.length === 3 && index === 2 ? "col-span-2" : ""}>
            <img
              src={attachment.url}
              alt={attachment.fileName || "Ảnh đính kèm"}
              className={`h-full max-h-72 min-h-28 w-full rounded-[8px] border object-cover ${frameClass}`}
              loading="lazy"
              data-testid="chat-image-attachment"
            />
          </a>
        ) : (
          <MissingMedia key={attachment.id || `${attachment.fileName}-${index}`} type="IMAGE" frameClass={frameClass} />
        )
      ))}
    </div>
  );
}

function VideoAttachment({ attachment, frameClass }: { attachment?: ChatAttachmentDto; frameClass: string }) {
  if (!attachment?.url) return <MissingMedia type="VIDEO" frameClass={frameClass} />;
  return (
    <video
      className={`max-h-72 w-full max-w-sm rounded-[8px] border ${frameClass}`}
      controls
      preload="metadata"
      src={attachment.url}
      data-testid="chat-video-attachment"
    />
  );
}

function MissingMedia({ type, frameClass }: { type: "IMAGE" | "VIDEO"; frameClass: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-[8px] border p-3 text-xs font-bold ${frameClass}`}>
      {type === "IMAGE" ? <ImageIcon className="h-4 w-4 shrink-0" /> : <Video className="h-4 w-4 shrink-0" />}
      Không thể tải tệp lúc này.
    </div>
  );
}

function Avatar({ name, src, size }: { name?: string | null; src?: string | null; size: "xs" | "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-12 w-12" : size === "sm" ? "h-10 w-10" : "h-8 w-8";
  const textClass = size === "md" ? "text-sm" : "text-xs";
  if (src) {
    return (
      <img
        className={`${sizeClass} rounded-full object-cover shrink-0 bg-brand-low`}
        src={src}
        alt={name || "Ảnh đại diện"}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${sizeClass} ${textClass} rounded-full shrink-0 bg-brand-primary/10 text-brand-primary grid place-items-center font-black`}>
      {avatarInitials(name || undefined)}
    </div>
  );
}
