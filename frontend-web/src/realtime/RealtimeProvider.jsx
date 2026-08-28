import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ENDPOINTS = ['/ws/account', '/ws/learning'];

function socketUrl(path) {
  const configured = import.meta.env.VITE_REALTIME_URL?.replace(/\/$/, '');
  if (configured) return `${configured}${path}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

function notificationFor(event, reviewer) {
  const status = event.payload?.status;
  const approved = status === 'APPROVED' || event.payload?.action === 'APPROVED';
  const name = event.payload?.className ? ` "${event.payload.className}"` : '';

  switch (event.type) {
    case 'TUTOR_APPLICATION_SUBMITTED': return ['Hồ sơ gia sư mới', 'Một hồ sơ và CCCD mới đang chờ xử lý.', 'info'];
    case 'TUTOR_APPLICATION_REVIEWED': return reviewer
      ? ['Hàng chờ hồ sơ đã cập nhật', `Hồ sơ đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
      : ['Kết quả duyệt hồ sơ', `Hồ sơ và CCCD của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'TEACHING_REGISTRATION_SUBMITTED': return ['Đăng ký môn học mới', 'Một đăng ký quyền dạy mới đang chờ xử lý.', 'info'];
    case 'TEACHING_REGISTRATION_REVIEWED': return reviewer
      ? ['Hàng chờ môn học đã cập nhật', `Đăng ký quyền dạy đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
      : ['Kết quả đăng ký môn học', `Đăng ký quyền dạy của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'SUBJECT_REQUEST_SUBMITTED': return ['Đề xuất môn học mới', 'Một đề xuất môn học mới đang chờ Admin xử lý.', 'info'];
    case 'SUBJECT_REQUEST_REVIEWED': return reviewer
      ? ['Đề xuất môn đã cập nhật', `Đề xuất môn học đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
      : ['Kết quả đề xuất môn học', `Đề xuất môn học của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'CLASS_SUBMITTED': return ['Lớp học mới', `Lớp học${name} đang chờ duyệt.`, 'info'];
    case 'CLASS_REVIEWED': return reviewer
      ? ['Hàng chờ lớp học đã cập nhật', `Lớp học${name} đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
      : ['Kết quả duyệt lớp học', `Lớp học${name} của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    default: return null;
  }
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [notice, setNotice] = useState(null);
  const retryTimers = useRef([]);
  const hideTimer = useRef(null);

  useEffect(() => {
    retryTimers.current.forEach(clearTimeout);
    retryTimers.current = [];
    if (!user) return undefined;

    const roles = (user.roles || []).map((role) => String(role).replace(/^ROLE_/, '').toUpperCase());
    const reviewer = roles.includes('STAFF') || roles.includes('ADMIN');
    const sockets = [];
    let stopped = false;

    const connect = (path, attempt = 0) => {
      if (stopped) return;
      const socket = new WebSocket(socketUrl(path));
      sockets.push(socket);

      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data);
          if (event.type === 'SUBJECT_REQUEST_REVIEWED' && !reviewer
              && Number(event.payload?.userId) !== Number(user.id)) return;
          if ((event.type === 'TEACHING_REGISTRATION_REVIEWED' || event.type === 'CLASS_REVIEWED')
              && !reviewer
              && event.payload?.tutorEmail
              && event.payload.tutorEmail.toLowerCase() !== user.email?.toLowerCase()) return;

          window.dispatchEvent(new CustomEvent('realtime:event', { detail: event }));
          const message = notificationFor(event, reviewer);
          if (!message) return;
          setNotice({ title: message[0], message: message[1], tone: message[2], reason: event.payload?.reason });
          clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setNotice(null), 6000);
        } catch {
          // Ignore malformed frames and keep the connection alive.
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        const delay = Math.min(1000 * (2 ** attempt), 15000);
        retryTimers.current.push(setTimeout(() => connect(path, Math.min(attempt + 1, 4)), delay));
      };
    };

    ENDPOINTS.forEach((path) => connect(path));
    return () => {
      stopped = true;
      sockets.forEach((socket) => socket.close());
      retryTimers.current.forEach(clearTimeout);
      clearTimeout(hideTimer.current);
    };
  }, [user]);

  const Icon = notice?.tone === 'success' ? CheckCircle2 : notice?.tone === 'error' ? XCircle : Info;
  const color = notice?.tone === 'success' ? 'text-emerald-600' : notice?.tone === 'error' ? 'text-rose-600' : 'text-sky-600';

  return (
    <>
      {children}
      {notice && (
        <div className="fixed right-4 top-4 z-[10000] flex w-[min(92vw,390px)] gap-3 border border-slate-200 bg-white p-4 shadow-xl" role="status" aria-live="polite">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">{notice.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{notice.message}</p>
            {notice.tone === 'error' && notice.reason && <p className="mt-1 text-xs text-rose-600">Lý do: {notice.reason}</p>}
          </div>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto h-6 w-6 text-slate-400" aria-label="Đóng thông báo">×</button>
        </div>
      )}
    </>
  );
}
