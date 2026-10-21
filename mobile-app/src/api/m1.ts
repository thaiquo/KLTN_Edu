import { api } from './client';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';
import type { UserProfile } from '../types/session';

export type TutorStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type TeachingMode = 'ONLINE' | 'OFFLINE';
export interface TutorApplication {
  id: number;
  status: TutorStatus;
  bio: string | null;
  educationLevel: string | null;
  institution: string | null;
  major: string | null;
  experienceSummary: string | null;
  teachingModes: TeachingMode[];
  rejectionReason: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
}
export type DocumentType = 'IDENTITY_FRONT' | 'IDENTITY_BACK' | 'PASSPORT' | 'DEGREE' | 'CERTIFICATE' | 'WORK_EXPERIENCE' | 'PORTFOLIO' | 'OTHER';
export interface TutorDocument { id: number; documentType: DocumentType; originalFilename?: string; title?: string; }
export interface UploadAsset { uri: string; name: string; mimeType: string; size?: number; file?: File; }

export const authM1 = {
  register: (body: { fullName: string; email: string; password: string; confirmPassword: string; role: 'STUDENT' | 'TUTOR' }) =>
    api.request<{ email: string }>('/api/auth/mobile/register', { method: 'POST', anonymous: true, body: JSON.stringify(body) }),
  verifyEmail: (email: string, otp: string) =>
    api.request<void>('/api/auth/mobile/verify-email', { method: 'POST', anonymous: true, body: JSON.stringify({ email, otp }) }),
  resendOtp: (email: string) =>
    api.request<void>('/api/auth/mobile/resend-verification-otp', { method: 'POST', anonymous: true, body: JSON.stringify({ email }) }),
  forgotPassword: (email: string) =>
    api.request<void>('/api/auth/mobile/forgot-password', { method: 'POST', anonymous: true, body: JSON.stringify({ email }) }),
  resetPassword: (body: { email: string; otp: string; newPassword: string; confirmPassword: string }) =>
    api.request<void>('/api/auth/mobile/reset-password', { method: 'POST', anonymous: true, body: JSON.stringify(body) }),
};

export const accountM1 = {
  update: (body: Record<string, unknown>) => api.request<UserProfile>('/api/users/me', { method: 'PUT', body: JSON.stringify(body) }),
  uploadAvatar: (asset: UploadAsset) => api.request<UserProfile>('/api/users/me/avatar', { method: 'POST', body: multipart('file', asset) }),
  activateStudent: () => api.request<UserProfile>('/api/users/me/activate-student', { method: 'POST' }),
};

export const tutorM1 = {
  application: () => api.request<TutorApplication>('/api/tutor-applications/me'),
  create: () => api.request<TutorApplication>('/api/tutor-applications', { method: 'POST' }),
  update: (body: Partial<TutorApplication>) => api.request<TutorApplication>('/api/tutor-applications/me', { method: 'PUT', body: JSON.stringify(body) }),
  submit: () => api.request<TutorApplication>('/api/tutor-applications/me/submit', { method: 'POST' }),
  documents: () => api.request<TutorDocument[]>('/api/tutor-applications/me/documents'),
  uploadDocument: (documentType: DocumentType, asset: UploadAsset) => {
    const body = multipart('file', asset);
    body.append('documentType', documentType);
    if (!['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(documentType)) {
      body.append('title', asset.name.replace(/\.[^/.]+$/, '').slice(0, 160));
    }
    return api.request<TutorDocument>('/api/tutor-applications/me/documents', { method: 'POST', body });
  },
  deleteDocument: (id: number) => api.request<void>(`/api/tutor-applications/me/documents/${id}`, { method: 'DELETE' }),
};

function multipart(field: string, asset: UploadAsset) {
  const body = new FormData();
  const file = Platform.OS === 'web' ? asset.file : new ExpoFile(asset.uri);
  if (!file) throw new Error('Không tìm thấy file đã chọn. Vui lòng chọn lại.');
  body.append(field, file as Blob, asset.name);
  return body;
}
