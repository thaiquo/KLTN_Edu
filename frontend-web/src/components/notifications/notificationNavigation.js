function normalizeRole(role) {
  return String(role || '').toUpperCase();
}

export function getNotificationTarget(notification, activeRole) {
  const type = notification?.type;
  const referenceType = notification?.referenceType;
  const role = normalizeRole(activeRole);

  if (type === 'TUTOR_APPLICATION_REVIEWED' || referenceType === 'TUTOR_APPLICATION') {
    return role === 'TUTOR' ? '/dashboard' : '/profile';
  }

  if (type === 'TEACHING_REGISTRATION_REVIEWED' || referenceType === 'TEACHING_REGISTRATION') {
    return role === 'STAFF' || role === 'ADMIN'
      ? '/staff/tutors'
      : '/tutor/teaching-registrations';
  }

  if (type === 'SUBJECT_REQUEST_REVIEWED' || referenceType === 'SUBJECT_REQUEST') {
    return role === 'STAFF' || role === 'ADMIN'
      ? '/staff/tutors'
      : '/tutor/teaching-registrations';
  }

  if (type === 'CLASS_REVIEWED' || referenceType === 'CLASS') {
    return role === 'STAFF' || role === 'ADMIN' ? '/staff/tutors' : '/dashboard';
  }

  if (type === 'ENROLLMENT_ACCEPTED' || type === 'ENROLLMENT_REJECTED') {
    return '/my-classes';
  }

  if (type === 'ENROLLMENT_REQUESTED' || type === 'ENROLLMENT_CANCELLED' || referenceType === 'ENROLLMENT_REQUEST') {
    return role === 'STUDENT' ? '/my-classes' : '/dashboard';
  }

  return null;
}
