import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2, MessageCircle, Send, Sparkles, Star, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendChatMessage } from '../../api/chatbot';
import { useAuth } from '../../hooks/useAuth';
import {
  clearLegacyAiChatHistory,
  getAiChatStorageKey,
  loadAiChatHistory,
  saveAiChatHistory
} from './aiChatHistoryStore';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 8;

const SUGGESTIONS = [
  'EduConnect là gì?',
  'Làm sao đăng ký?',
  'Tôi có thể làm gì ở đây?',
  'Đăng nhập ở đâu?'
];

const ACTION_ROUTES = {
  OPEN_HOME: '/',
  OPEN_TUTOR_MARKETPLACE: '/tutors',
  OPEN_CLASS_MARKETPLACE: '/classes',
  OPEN_LOGIN: '/login',
  OPEN_REGISTER: '/register',
  OPEN_STUDENT_CLASSES: '/my-classes',
  OPEN_STUDENT_SCHEDULE: '/my-schedule',
  OPEN_STUDENT_HOMEWORK: '/my-homework',
  OPEN_STUDENT_ENROLLMENT_REQUESTS: '/my-classes',
  OPEN_STUDENT_CONTRACTS: '/contracts',
  OPEN_STUDENT_WALLET: '/student/wallet',
  OPEN_TUTOR_CLASSES: '/dashboard?tab=my-classes',
  OPEN_TUTOR_SCHEDULE: '/dashboard?tab=schedule',
  OPEN_TUTOR_ENROLLMENT_REQUESTS: '/dashboard?tab=requests',
  OPEN_TUTOR_HOMEWORK: '/dashboard?tab=homework',
  OPEN_TUTOR_CONTRACTS: '/dashboard?tab=contracts',
  OPEN_TUTOR_AVAILABILITY: '/dashboard?tab=schedule'
};

const OPEN_AI_CHAT_EVENT = 'educonnect:open-ai-chat';

function pageTypeFor(pathname) {
  if (pathname === '/') return 'HOME';
  if (pathname.startsWith('/tutors')) return 'TUTOR_MARKETPLACE';
  if (pathname.startsWith('/classes')) return 'CLASS_MARKETPLACE';
  if (pathname.includes('messages')) return 'HUMAN_MESSAGES';
  if (pathname.includes('contracts')) return 'CONTRACTS';
  if (pathname.includes('homework')) return 'HOMEWORK';
  return 'GENERAL';
}

export function AiChatWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const storageKey = useMemo(() => getAiChatStorageKey({
    authenticated,
    userId: user?.id ?? user?.userId,
    activeRole: user?.activeRole
  }), [authenticated, user?.activeRole, user?.id, user?.userId]);
  const storageKeyRef = useRef(storageKey);

  const pageContext = useMemo(() => ({
    currentRoute: `${location.pathname}${location.search || ''}`,
    pageType: pageTypeFor(location.pathname)
  }), [location.pathname, location.search]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const container = scrollRef.current;
    container.scrollTop = container.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    function openAssistant() {
      setOpen(true);
    }

    window.addEventListener(OPEN_AI_CHAT_EVENT, openAssistant);
    return () => window.removeEventListener(OPEN_AI_CHAT_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    clearLegacyAiChatHistory();
  }, []);

  useEffect(() => {
    storageKeyRef.current = storageKey;
    setMessages(loadAiChatHistory(storageKey));
    setInput('');
    setError('');
    setSending(false);
  }, [storageKey]);

  useEffect(() => {
    saveAiChatHistory(storageKey, messages);
  }, [messages, storageKey]);

  const conversationForRequest = messages
    .filter((item) => item.role === 'USER' || item.role === 'ASSISTANT')
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({ role: item.role, content: item.content }));

  async function submitMessage(rawMessage = input) {
    const trimmed = rawMessage.trim();
    if (!trimmed || sending) return;

    const safeMessage = trimmed.slice(0, MAX_MESSAGE_LENGTH);
    const userMessage = {
      id: crypto.randomUUID?.() || `${Date.now()}-user`,
      role: 'USER',
      content: safeMessage
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError('');
    setSending(true);
    const requestStorageKey = storageKey;
    const requestConversation = conversationForRequest;

    try {
      const response = await sendChatMessage({
        message: safeMessage,
        conversation: requestConversation,
        pageContext
      });
      if (storageKeyRef.current !== requestStorageKey) return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID?.() || `${Date.now()}-assistant`,
          role: 'ASSISTANT',
          content: response?.message || 'Tôi chưa thể phản hồi lúc này. Vui lòng thử lại sau.',
          intent: response?.intent,
          sources: Array.isArray(response?.sources) ? response.sources : [],
          actions: Array.isArray(response?.actions) ? response.actions : [],
          toolResult: response?.toolResult || null
        }
      ]);
    } catch (requestError) {
      if (storageKeyRef.current !== requestStorageKey) return;
      setError(requestError?.message || 'Không thể kết nối trợ lý EduConnect. Vui lòng thử lại sau.');
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID?.() || `${Date.now()}-error`,
          role: 'ASSISTANT',
          content: 'Tôi đang gặp sự cố kết nối. Bạn vui lòng thử lại sau ít phút.',
          error: true
        }
      ]);
    } finally {
      if (storageKeyRef.current === requestStorageKey) {
        setSending(false);
      }
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  function handleAction(action) {
    const route = ACTION_ROUTES[action?.id];
    if (route) {
      navigate(route);
      setOpen(false);
    }
  }

  function handleToolAction(action) {
    if (!action?.type) return;
    if (action.type === 'VIEW_TUTOR' && isSafeId(action.tutorId)) {
      navigate(`/tutors/${action.tutorId}`);
      setOpen(false);
    } else if (action.type === 'VIEW_CLASS' && isSafeId(action.classId)) {
      navigate(`/classes?classId=${action.classId}`);
      setOpen(false);
    } else if (action.type === 'OPEN_LOGIN') {
      navigate('/login');
      setOpen(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-3 z-40 grid justify-items-end font-sans sm:bottom-6 sm:right-6">
      {open && (
        <section
          className="mb-3 flex h-[min(540px,calc(100svh-96px))] w-[calc(100vw-24px)] max-w-[380px] flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] motion-safe:animate-[fade-up_180ms_ease-out_both] sm:mb-4 sm:h-[min(540px,calc(100vh-120px))] sm:w-[380px]"
          aria-label="Trợ lý EduConnect"
        >
          <header className="flex min-h-[70px] shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black leading-5 text-slate-950">Trợ lý EduConnect</h2>
                <p className="text-[11px] font-bold leading-4 text-blue-600">Sẵn sàng hỗ trợ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25"
              aria-label="Đóng trợ lý"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/80 px-4 py-3.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] sm:py-4"
          >
            {messages.length === 0 && (
              <div className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  Xin chào
                </div>
                <p className="text-[13px] leading-5 text-slate-600">
                  Tôi là trợ lý EduConnect. Tôi có thể hỗ trợ bạn tìm hiểu và sử dụng hệ thống.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submitMessage(suggestion)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold leading-5 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      disabled={sending}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                onAction={handleAction}
                onToolAction={handleToolAction}
              />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-500 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang trả lời...
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-slate-100 bg-white p-3">
            {error && (
              <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                {error}
              </p>
            )}
            <div className="flex min-h-12 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition focus-within:border-primary/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/10">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                rows={1}
                className="max-h-20 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[13px] font-semibold leading-5 text-slate-800 outline-none placeholder:text-slate-400"
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => submitMessage()}
                disabled={sending || !input.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Gửi câu hỏi"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group relative grid h-14 w-14 place-items-center rounded-full border border-white/70 bg-primary text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)] transition hover:scale-105 hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/25"
        aria-label="Mở trợ lý EduConnect"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="pointer-events-none absolute bottom-full right-0 mb-3 hidden whitespace-nowrap rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-lg group-hover:block">
          Trợ lý EduConnect
        </span>
      </button>
    </div>
  );
}

function ChatMessageBubble({ message, onAction, onToolAction }) {
  const isUser = message.role === 'USER';
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-5 shadow-sm',
          isUser
            ? 'bg-primary text-white'
            : message.error
              ? 'border border-red-100 bg-red-50 text-red-700'
              : 'border border-slate-200 bg-white text-slate-700'
        ].join(' ')}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && message.toolResult && (
          isMatchingToolResult(message.toolResult)
            ? <MatchingToolResult result={message.toolResult} onToolAction={onToolAction} />
            : <PrivateToolResult result={message.toolResult} onAction={onAction} />
        )}
        {!isUser && message.sources?.length > 0 && (
          <div className="mt-2 text-[11px] leading-4 text-slate-600">
            <button
              type="button"
              onClick={() => setSourcesOpen((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-black text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-expanded={sourcesOpen}
            >
              {sourcesOpen ? 'Ẩn nguồn' : 'Xem nguồn'}
              <ChevronDown className={`h-3 w-3 transition ${sourcesOpen ? 'rotate-180' : ''}`} />
            </button>
            {sourcesOpen && (
              <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/55 px-2.5 py-2">
                <p className="mb-1 font-black text-blue-700">Nguồn</p>
                <ul className="space-y-1">
                  {message.sources.map((source, index) => (
                    <li key={`${source.title || 'source'}-${source.section || index}`} className="min-w-0">
                      <span className="block truncate font-bold text-slate-700">{source.title}</span>
                      {source.section && (
                        <span className="block truncate text-slate-500">{source.section}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!isUser && message.actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action)}
                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black leading-5 text-primary transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function isMatchingToolResult(result) {
  return result?.type === 'TUTOR_MATCHES' || result?.type === 'CLASS_MATCHES';
}

function MatchingToolResult({ result, onToolAction }) {
  const items = Array.isArray(result?.items) ? result.items : [];
  if (!result?.type || items.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {items.map((item, index) => (
        result.type === 'TUTOR_MATCHES'
          ? <TutorMatchCard key={`tutor-${item.tutorId || index}`} item={item} onToolAction={onToolAction} />
          : <ClassMatchCard key={`class-${item.classId || index}`} item={item} onToolAction={onToolAction} />
      ))}
    </div>
  );
}

function PrivateToolResult({ result, onAction }) {
  const items = Array.isArray(result?.items) ? result.items : [];
  if (!result?.type) return null;
  const meta = privateResultMeta(result.type);
  if (!meta) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{meta.title}</p>
        {Number.isFinite(Number(result.totalCount)) && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-600">
            {result.totalCount}
          </span>
        )}
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <PrivateResultCard
              key={`${result.type}-${item.classId || item.sessionId || item.agreementId || item.requestId || index}`}
              type={result.type}
              item={item}
              meta={meta}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-slate-500">
          Chưa có dữ liệu phù hợp để hiển thị.
        </p>
      )}
    </div>
  );
}

function PrivateResultCard({ type, item, meta, onAction }) {
  const title = privateItemTitle(type, item);
  const subtitle = privateItemSubtitle(type, item);
  const tags = privateItemTags(type, item);

  return (
    <div className="rounded-xl border border-white bg-white p-2.5 shadow-sm">
      <p className="line-clamp-2 text-[12px] font-black leading-4 text-slate-900">{title}</p>
      {subtitle && <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-4 text-slate-500">{subtitle}</p>}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag, index) => (
            <span key={`${tag}-${index}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}
      {meta.action && (
        <button
          type="button"
          onClick={() => onAction?.({ id: meta.action, label: meta.buttonLabel })}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-primary hover:bg-blue-100"
        >
          {meta.buttonLabel} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function privateResultMeta(type) {
  const map = {
    STUDENT_CLASSES: { title: 'Lớp của tôi', action: 'OPEN_STUDENT_CLASSES', buttonLabel: 'Mở lớp' },
    TUTOR_CLASSES: { title: 'Lớp đang dạy', action: 'OPEN_TUTOR_CLASSES', buttonLabel: 'Mở lớp' },
    STUDENT_SCHEDULE: { title: 'Lịch học', action: 'OPEN_STUDENT_SCHEDULE', buttonLabel: 'Mở lịch' },
    TUTOR_SCHEDULE: { title: 'Lịch dạy', action: 'OPEN_TUTOR_SCHEDULE', buttonLabel: 'Mở lịch' },
    STUDENT_HOMEWORK: { title: 'Bài tập', action: 'OPEN_STUDENT_HOMEWORK', buttonLabel: 'Mở bài tập' },
    TUTOR_PENDING_HOMEWORK: { title: 'Chờ chấm bài', action: 'OPEN_TUTOR_HOMEWORK', buttonLabel: 'Mở chấm bài' },
    STUDENT_ENROLLMENT_REQUESTS: { title: 'Yêu cầu tham gia', action: 'OPEN_STUDENT_CLASSES', buttonLabel: 'Mở lớp' },
    TUTOR_ENROLLMENT_REQUESTS: { title: 'Yêu cầu học viên', action: 'OPEN_TUTOR_ENROLLMENT_REQUESTS', buttonLabel: 'Mở yêu cầu' },
    STUDENT_CONTRACTS: { title: 'Hợp đồng', action: 'OPEN_STUDENT_CONTRACTS', buttonLabel: 'Mở hợp đồng' },
    TUTOR_CONTRACTS: { title: 'Hợp đồng', action: 'OPEN_TUTOR_CONTRACTS', buttonLabel: 'Mở hợp đồng' },
    PAYMENT_STATUS: { title: 'Thanh toán ký quỹ', action: 'OPEN_STUDENT_WALLET', buttonLabel: 'Mở ví' },
    TUTOR_SETTLEMENTS: { title: 'Quyết toán', action: 'OPEN_TUTOR_CONTRACTS', buttonLabel: 'Mở quyết toán' },
    TUTOR_AVAILABILITY: { title: 'Lịch rảnh', action: 'OPEN_TUTOR_AVAILABILITY', buttonLabel: 'Mở lịch rảnh' }
  };
  return map[type] || null;
}

function privateItemTitle(type, item) {
  if (type.includes('SCHEDULE')) return item.topic || item.className || `Buổi #${item.sequenceNumber || item.sessionId || ''}`;
  if (type.includes('HOMEWORK')) return item.title || item.className || 'Bài tập';
  if (type.includes('REQUESTS')) return item.className || 'Yêu cầu tham gia lớp';
  if (type.includes('CONTRACT') || type === 'PAYMENT_STATUS') return item.className || 'Hợp đồng EduConnect';
  if (type === 'TUTOR_SETTLEMENTS') return item.className || `Buổi #${item.sessionId || ''}`;
  if (type === 'TUTOR_AVAILABILITY') return dayLabel(item.dayOfWeek);
  return item.title || item.className || 'Mục dữ liệu';
}

function privateItemSubtitle(type, item) {
  if (type.includes('SCHEDULE')) return [item.className, item.sessionDate, timeRange(item)].filter(Boolean).join(' • ');
  if (type.includes('HOMEWORK')) return [item.className, item.dueAt && `Hạn: ${formatDateTime(item.dueAt)}`].filter(Boolean).join(' • ');
  if (type.includes('REQUESTS')) return [item.studentName || item.tutorName, item.status].filter(Boolean).join(' • ');
  if (type.includes('CONTRACT') || type === 'PAYMENT_STATUS') return [item.status, moneyUsdc(item.totalAmountUsdc)].filter(Boolean).join(' • ');
  if (type === 'TUTOR_SETTLEMENTS') return [item.status, moneyUsdc(item.tutorAmountUsdc)].filter(Boolean).join(' • ');
  if (type === 'TUTOR_AVAILABILITY') return timeRange(item);
  return '';
}

function privateItemTags(type, item) {
  const tags = [];
  if (item.subjectName) tags.push(item.subjectName);
  if (item.levelName) tags.push(item.levelName);
  if (item.teachingMode) tags.push(modeLabel(item.teachingMode));
  if (item.status) tags.push(statusLabel(item.status));
  if (item.onchainFunded != null) tags.push(item.onchainFunded ? 'Đã ký quỹ' : 'Chưa ký quỹ');
  if (item.pendingCount != null) tags.push(`${item.pendingCount} chờ chấm`);
  if (item.settledSessions != null && item.totalSessions != null) tags.push(`${item.settledSessions}/${item.totalSessions} buổi`);
  if (item.remainingDeposit != null) tags.push(`Còn ${moneyUsdc(item.remainingDeposit)}`);
  if (type === 'TUTOR_AVAILABILITY') tags.push(dayLabel(item.dayOfWeek));
  return tags.filter(Boolean);
}

function TutorMatchCard({ item, onToolAction }) {
  const mismatchReasons = Array.isArray(item.mismatchReasons) ? item.mismatchReasons.filter(Boolean).slice(0, 2) : [];
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/55 p-3 text-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-slate-950">{item.displayName || 'Gia sư EduConnect'}</p>
          <p className="mt-0.5 text-[11px] font-bold text-blue-700">
            {[item.matchedSubject, item.matchedLevel].filter(Boolean).join(' • ') || 'Gia sư phù hợp'}
          </p>
        </div>
        {Number.isFinite(Number(item.matchPercentage)) && (
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700">
            {Math.round(Number(item.matchPercentage))}%
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
        {formatMoney(item.startingTuition || item.tuitionMin) && <span>{formatMoney(item.startingTuition || item.tuitionMin)}/buổi</span>}
        {Number.isFinite(Number(item.averageRating)) && <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(item.averageRating).toFixed(1)}</span>}
        {item.experienceYears != null && <span>{item.experienceYears} năm KN</span>}
      </div>
      <ReasonList reasons={item.matchingReasons} />
      {mismatchReasons.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold leading-4 text-amber-800">
          <p className="font-black">Chưa khớp hoàn toàn</p>
          <ul className="mt-1 space-y-1">
            {mismatchReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => onToolAction?.({ type: 'VIEW_TUTOR', tutorId: item.tutorId })}
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary hover:bg-blue-100"
      >
        Xem hồ sơ <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function ClassMatchCard({ item, onToolAction }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-black text-slate-950">{item.title || 'Lớp học EduConnect'}</p>
          <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
            {[item.subjectName, item.levelName, modeLabel(item.teachingMode)].filter(Boolean).join(' • ')}
          </p>
        </div>
        {Number.isFinite(Number(item.matchPercentage)) && (
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700">
            {Math.round(Number(item.matchPercentage))}%
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
        {formatMoney(item.pricePerSession) && <span>{formatMoney(item.pricePerSession)}/buổi</span>}
        {item.tutorName && <span>{item.tutorName}</span>}
        {item.availableSlots != null && <span>Còn {item.availableSlots} chỗ</span>}
      </div>
      <ReasonList reasons={item.matchingReasons} />
      <button
        type="button"
        onClick={() => onToolAction?.({ type: 'VIEW_CLASS', classId: item.classId })}
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"
      >
        Xem lớp <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function ReasonList({ reasons }) {
  const visible = Array.isArray(reasons) ? reasons.filter(Boolean).slice(0, 2) : [];
  if (visible.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-[11px] font-semibold leading-4 text-slate-600">
      {visible.map((reason, index) => (
        <li key={`${reason}-${index}`}>• {reason}</li>
      ))}
    </ul>
  );
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return new Intl.NumberFormat('vi-VN').format(number) + 'đ';
}

function moneyUsdc(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `${number.toFixed(number >= 10 ? 2 : 4)} USDC`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function timeRange(item) {
  return [item?.startTime, item?.endTime].filter(Boolean).join(' - ');
}

function dayLabel(value) {
  const day = Number(value);
  if (day === 8) return 'Chủ nhật';
  if (day >= 2 && day <= 7) return `Thứ ${day}`;
  return 'Khung giờ';
}

function statusLabel(value) {
  const labels = {
    ACTIVE: 'Đang hoạt động',
    PUBLISHED: 'Đã công khai',
    PRIVATE: 'Riêng tư',
    LOCKED: 'Đã khóa',
    PENDING: 'Đang chờ',
    ACCEPTED: 'Đã chấp nhận',
    ENROLLED: 'Đang học',
    REJECTED: 'Đã từ chối',
    CANCELLED: 'Đã hủy',
    COMPLETED: 'Đã hoàn tất',
    GRADED: 'Đã chấm',
    SUBMITTED: 'Đã nộp'
  };
  return labels[value] || value;
}

function modeLabel(value) {
  if (value === 'ONLINE') return 'Online';
  if (value === 'OFFLINE') return 'Offline';
  return '';
}

function isSafeId(value) {
  return /^\d+$/.test(String(value || ''));
}

export default AiChatWidget;
