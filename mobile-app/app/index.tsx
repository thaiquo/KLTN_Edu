import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { ConnectionError, FullScreenLoading } from '../src/components/States';

export default function Index() {
  const { user, restoring, error, retry } = useAuth();
  if (restoring) return <FullScreenLoading />;
  if (error) return <ConnectionError message={error} onRetry={() => void retry()} />;
  return <Redirect href={user ? '/(app)' : '/(public)'} />;
}
