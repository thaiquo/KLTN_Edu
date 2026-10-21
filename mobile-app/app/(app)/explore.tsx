import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppShell } from '../../src/components/AppShell';
import { PublicExplore } from '../../src/components/PublicExplore';

export default function StudentExplore() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/(public)" />;
  if (user.activeRole === 'TUTOR') return <Redirect href="/(app)/management" />;
  return <AppShell active="explore" title="Khám phá" role="STUDENT"><PublicExplore role="STUDENT" /></AppShell>;
}
