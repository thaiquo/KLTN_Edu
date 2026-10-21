export type AppRole = 'STUDENT' | 'TUTOR';

export const base = {
  ink: '#172633',
  muted: '#64737f',
  line: '#dce5eb',
  surface: '#ffffff',
  background: '#f5f8fa',
  danger: '#bb3f52',
  success: '#17765b',
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 8, lg: 8 },
  type: { body: 15, label: 13, title: 24, compactTitle: 18 }
} as const;

export function themeForRole(role: string | null | undefined) {
  const tutor = role === 'TUTOR';
  return {
    ...base,
    primary: tutor ? '#a92f69' : '#2463ae',
    primarySoft: tutor ? '#fce9f1' : '#e8f1fb',
    accent: tutor ? '#8a4b5f' : '#237d76',
    roleLabel: tutor ? 'Gia sư' : 'Học viên',
  };
}
