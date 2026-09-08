function normalizeRole(role) {
  return String(role || '').toUpperCase();
}

function normalizeValue(value) {
  return String(value || '').toUpperCase();
}

function target(path, portalPage = null) {
  return {
    path,
    portalPage
  };
}

export function getNotificationTarget(notification, activeRole) {
  const type = normalizeValue(notification?.type);
  const referenceType = normalizeValue(notification?.referenceType);
  const role = normalizeRole(activeRole);

  if (type === 'TUTOR_APPLICATION_REVIEWED' || referenceType === 'TUTOR_APPLICATION') {
    return role === 'TUTOR'
      ? target('/dashboard', 'dashboard')
      : target('/profile');
  }

  if (type === 'TEACHING_REGISTRATION_REVIEWED' || referenceType === 'TEACHING_REGISTRATION') {
    if (role === 'STAFF' || role === 'ADMIN') {
      return target('/staff/tutors', 'tutor-approval');
    }
    if (role === 'TUTOR') {
      return target('/tutor/teaching-registrations', 'subjects');
    }
    return target('/tutor/teaching-registrations');
  }

  if (type === 'SUBJECT_REQUEST_REVIEWED' || referenceType === 'SUBJECT_REQUEST') {
    if (role === 'STAFF' || role === 'ADMIN') {
      return target('/staff/tutors', 'tutor-approval');
    }
    if (role === 'TUTOR') {
      return target('/tutor/teaching-registrations', 'subjects');
    }
    return target('/tutor/teaching-registrations');
  }

  if (type === 'CLASS_REVIEWED' || referenceType === 'CLASS') {
    if (role === 'STAFF' || role === 'ADMIN') {
      return target('/staff/tutors', 'class-management');
    }
    if (role === 'TUTOR') {
      return target('/dashboard', 'my-classes');
    }
    return target('/dashboard');
  }

  if (type === 'ENROLLMENT_ACCEPTED' || type === 'ENROLLMENT_REJECTED') {
    return target('/my-classes');
  }

  if (type === 'ENROLLMENT_REQUESTED' || type === 'ENROLLMENT_CANCELLED' || referenceType === 'ENROLLMENT_REQUEST') {
    if (role === 'TUTOR') {
      return target('/dashboard', 'requests');
    }
    return role === 'STUDENT'
      ? target('/my-classes')
      : target('/dashboard');
  }

  return null;
}

export function getNotificationRoute(targetValue) {
  if (!targetValue) return null;
  if (typeof targetValue === 'string') return targetValue;
  return targetValue.path || null;
}

export function getNotificationPortalPage(targetValue) {
  if (!targetValue || typeof targetValue === 'string') return null;
  return targetValue.portalPage || null;
}
