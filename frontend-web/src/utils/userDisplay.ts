import { adminUsersApi } from '../api/adminUsers';

export interface UserSummary {
  id?: number | string;
  email?: string;
  fullName?: string;
  name?: string;
  role?: string;
}

let cachedUsers: UserSummary[] | null = null;
let fetchPromise: Promise<UserSummary[]> | null = null;

export async function fetchUserDirectory(force = false): Promise<UserSummary[]> {
  if (!force && cachedUsers && cachedUsers.length > 0) return cachedUsers;
  if (!fetchPromise || force) {
    fetchPromise = adminUsersApi.list()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : []);
        cachedUsers = list;
        return list;
      })
      .catch((err: any) => {
        console.warn('Failed to load user directory for reviewer mapping:', err);
        return cachedUsers || [];
      });
  }
  return fetchPromise;
}

export function getUserDisplayName(
  email?: string | null,
  users?: UserSummary[] | null,
  fallback?: string
): { fullName: string; email: string; label: string } {
  if (!email || !email.trim()) {
    return { fullName: fallback || '--', email: '', label: fallback || '--' };
  }
  const cleanEmail = email.trim();
  const list = users && users.length > 0 ? users : (cachedUsers || []);
  const found = list.find((u) => u?.email && u.email.trim().toLowerCase() === cleanEmail.toLowerCase());
  const fullName = found?.fullName || found?.name || '';
  if (fullName) {
    return {
      fullName,
      email: cleanEmail,
      label: `${fullName} (${cleanEmail})`
    };
  }
  return {
    fullName: fallback || cleanEmail,
    email: cleanEmail,
    label: cleanEmail
  };
}
