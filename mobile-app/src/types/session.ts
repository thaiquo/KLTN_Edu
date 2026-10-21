export interface MobileSession {
  userId: number;
  email: string;
  fullName: string;
  roles: string[];
  activeRole: string;
  hasStudentProfile: boolean;
  hasTutorProfile: boolean;
  tutorStatus: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
}

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  activeRole: string;
  roles: string[];
  walletAddress?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  provinceCode?: string | null;
  province?: string | null;
  communeCode?: string | null;
  commune?: string | null;
  addressDetail?: string | null;
  bio?: string | null;
  emailVerified?: boolean;
  accountStatus?: string;
  hasStudentProfile?: boolean;
  hasTutorProfile?: boolean;
  tutorStatus?: string | null;
}
