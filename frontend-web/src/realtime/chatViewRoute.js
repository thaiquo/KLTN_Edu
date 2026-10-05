export function isChatNotification(event) {
  const type = String(event?.notificationType || event?.type || '').toUpperCase();
  const referenceType = String(event?.referenceType || '').toUpperCase();
  return type === 'CHAT_MESSAGE' ||
    type === 'CHAT_MESSAGE_RECEIVED' ||
    referenceType === 'CHAT_CONVERSATION';
}

export function isMessagesRoute(pathname, search = '') {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  if (path === '/messages' || path === '/student/messages') {
    return true;
  }

  if (path === '/dashboard') {
    return new URLSearchParams(search || '').get('tab') === 'messages';
  }

  return false;
}

