const LOGIN_PROTECTION_MESSAGES = Object.freeze({
  LOGIN_CHALLENGE_REQUIRED: 'Vui lòng xác minh để thử đăng nhập lại.',
  LOGIN_RATE_LIMITED: 'Quá nhiều lần đăng nhập. Vui lòng chờ trước khi thử lại.',
  LOGIN_ATTEMPT_IN_PROGRESS: 'Một yêu cầu đăng nhập khác đang được xử lý. Vui lòng thử lại sau.',
  LOGIN_PROTECTION_UNAVAILABLE: 'Hệ thống bảo vệ đăng nhập đang tạm thời gián đoạn. Vui lòng thử lại sau.',
  LOGIN_RATE_LIMIT_UNAVAILABLE: 'Hệ thống bảo vệ đăng nhập đang tạm thời gián đoạn. Vui lòng thử lại sau.'
});

export function getLoginProtectionMessage(code) {
  return LOGIN_PROTECTION_MESSAGES[code] || null;
}

export function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}
