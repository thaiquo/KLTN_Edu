import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { base } from '../theme/tokens';

export function FullScreenLoading() {
  return <View style={styles.center}><Text style={styles.brand}>EduConnect</Text><ActivityIndicator color="#2463ae" size="large" /></View>;
}

export function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.center}><WifiOff color={base.muted} size={30} /><Text style={styles.emptyTitle}>Không thể kết nối</Text><Text style={styles.detail}>{message}</Text><Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: base.background },
  brand: { fontSize: 26, fontWeight: '800', color: '#2463ae', marginBottom: 22 },
  emptyTitle: { color: base.ink, fontWeight: '700', fontSize: 17, textAlign: 'center' },
  detail: { color: base.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { backgroundColor: '#2463ae', paddingHorizontal: 22, paddingVertical: 13, borderRadius: base.radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
