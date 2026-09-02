import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeedback } from '../components/feedback/useFeedback';
import { useAuth } from '../hooks/useAuth';
import { notificationKeys } from '../hooks/useNotifications';
import { tutorApplicationKeys } from '../hooks/useTutorApplication';

const ENDPOINTS = ['/ws/account', '/ws/learning', '/ws/notifications'];
const TOAST_DEDUPE_WINDOW_MS = 15_000;

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
    case 'TUTOR_APPLICATION_SUBMITTED':
      return ['Hồ sơ gia sư mới', 'Một hồ sơ và CCCD mới đang chờ xử lý.', 'info'];
    case 'TUTOR_APPLICATION_REVIEWED':
      return reviewer
        ? ['Hàng chờ hồ sơ đã cập nhật', `Hồ sơ đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
        : ['Kết quả duyệt hồ sơ', `Hồ sơ và CCCD của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'TEACHING_REGISTRATION_SUBMITTED':
      return ['Đăng ký môn học mới', 'Một đăng ký quyền dạy mới đang chờ xử lý.', 'info'];
    case 'TEACHING_REGISTRATION_REVIEWED':
      return reviewer
        ? ['Hàng chờ môn học đã cập nhật', `Đăng ký quyền dạy đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
        : ['Kết quả đăng ký môn học', `Đăng ký quyền dạy của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'SUBJECT_REQUEST_SUBMITTED':
      return ['Đề xuất môn học mới', 'Một đề xuất môn học mới đang chờ Admin xử lý.', 'info'];
    case 'SUBJECT_REQUEST_REVIEWED':
      return reviewer
        ? ['Đề xuất môn đã cập nhật', `Đề xuất môn học đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
        : ['Kết quả đề xuất môn học', `Đề xuất môn học của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    case 'CLASS_SUBMITTED':
      return ['Lớp học mới', `Lớp học${name} đang chờ duyệt.`, 'info'];
    case 'CLASS_REVIEWED':
      return reviewer
        ? ['Hàng chờ lớp học đã cập nhật', `Lớp học${name} đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error']
        : ['Kết quả duyệt lớp học', `Lớp học${name} của bạn đã được ${approved ? 'phê duyệt' : 'từ chối'}.`, approved ? 'success' : 'error'];
    default:
      return null;
  }
}

function notificationToastFor(event) {
  if (event.eventType !== 'NOTIFICATION_CREATED') return null;

  const title = event.title || 'Thông báo mới';
  const message = event.message || 'Bạn có một cập nhật mới.';
  const type = notificationToastType(event.notificationType, title, message);

  return [title, message, type];
}

function notificationToastType(notificationType, title, message) {
  if (notificationType === 'ENROLLMENT_ACCEPTED') {
    return 'success';
  }
  if (notificationType === 'ENROLLMENT_REJECTED') {
    return 'error';
  }
  if (notificationType === 'TUTOR_APPLICATION_REVIEWED'
      || notificationType === 'SUBJECT_REQUEST_REVIEWED') {
    return reviewedToastType(title, message);
  }
  return 'info';
}

function reviewedToastType(title, message) {
  const value = `${title || ''} ${message || ''}`.toLowerCase();
  if (value.includes('chưa') || value.includes('từ chối') || value.includes('cần cập nhật')) {
    return 'error';
  }
  return 'success';
}

function toastDedupeKey(event) {
  if (event.eventType === 'NOTIFICATION_CREATED') {
    return [
      event.notificationType,
      event.referenceType,
      event.referenceId
    ].filter(Boolean).join(':');
  }

  const inferredReferenceType = event.type === 'TUTOR_APPLICATION_REVIEWED'
    ? 'TUTOR_APPLICATION'
    : event.type === 'SUBJECT_REQUEST_REVIEWED'
    ? 'SUBJECT_REQUEST'
    : event.type === 'CLASS_REVIEWED'
    ? 'CLASS'
    : null;

  return [
    event.type,
    inferredReferenceType,
    event.entityId
  ].filter(Boolean).join(':');
}

function pruneToastKeys(map, now) {
  for (const [key, timestamp] of map.entries()) {
    if (now - timestamp > TOAST_DEDUPE_WINDOW_MS) {
      map.delete(key);
    }
  }
}

function handleRealtimeStateSync(event, { queryClient, refreshUser, reviewer }) {
  const notificationType = event.notificationType || event.type;
  const referenceType = event.referenceType || event.payload?.referenceType;

  if (event.eventType === 'NOTIFICATION_CREATED') {
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  }

  if (notificationType === 'TUTOR_APPLICATION_REVIEWED' || referenceType === 'TUTOR_APPLICATION') {
    queryClient.invalidateQueries({ queryKey: tutorApplicationKeys.mine() });
    if (event.eventType === 'NOTIFICATION_CREATED' || !reviewer) {
      refreshUser().catch(() => null);
    }
  }
}

function shouldIgnoreDomainEvent(event, { reviewer, user }) {
  if (event.type === 'SUBJECT_REQUEST_REVIEWED' && !reviewer
      && Number(event.payload?.userId) !== Number(user.id)) {
    return true;
  }

  if ((event.type === 'TEACHING_REGISTRATION_REVIEWED' || event.type === 'CLASS_REVIEWED')
      && !reviewer
      && event.payload?.tutorEmail
      && event.payload.tutorEmail.toLowerCase() !== user.email?.toLowerCase()) {
    return true;
  }

  return false;
}

export function RealtimeProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useFeedback();
  const queryClient = useQueryClient();
  const retryTimers = useRef([]);
  const toastKeys = useRef(new Map());

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

      socket.onopen = () => {
        if (path === '/ws/notifications' && attempt > 0) {
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        }
      };

      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data);
          if (shouldIgnoreDomainEvent(event, { reviewer, user })) return;

          handleRealtimeStateSync(event, { queryClient, refreshUser, reviewer });
          window.dispatchEvent(new CustomEvent('realtime:event', { detail: event }));

          const message = notificationToastFor(event) || notificationFor(event, reviewer);
          if (!message) return;

          const now = Date.now();
          pruneToastKeys(toastKeys.current, now);
          const toastKey = toastDedupeKey(event);
          if (toastKey && toastKeys.current.has(toastKey)) return;
          if (toastKey) toastKeys.current.set(toastKey, now);

          showToast({
            title: message[0],
            message: event.payload?.reason ? `${message[1]} Lý do: ${event.payload.reason}` : message[1],
            type: message[2],
            duration: 6000
          });
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
    };
  }, [queryClient, refreshUser, showToast, user]);

  return (
    <>{children}</>
  );
}
