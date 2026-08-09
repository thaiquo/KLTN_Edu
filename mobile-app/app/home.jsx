import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/AuthContext';

const roleLabels = { student: 'Học viên', tutor: 'Gia sư', admin: 'Quản trị viên' };

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) return <View style={styles.center}><ActivityIndicator color="#147b77" /></View>;
  if (!user) return <Redirect href="/(auth)/login" />;

  async function exit() {
    await logout();
    router.replace('/(auth)/login');
  }

  const roleLabel = roleLabels[user.currentRole] || roleLabels[user.role] || user.role;

  return (
    <View style={styles.page}>
      <Text style={styles.badge}>TÀI KHOẢN ĐÃ SẴN SÀNG</Text>
      <Text style={styles.title}>Xin chào, {user.fullName}!</Text>
      <View style={styles.card}>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        <Text>Vai trò: {roleLabel}</Text>
      </View>
      <Pressable onPress={exit}><Text style={styles.logout}>Đăng xuất</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#f7faf9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7faf9' },
  badge: { color: '#d58b35', fontWeight: '800' },
  title: { fontSize: 34, fontWeight: '800', marginVertical: 18 },
  card: { padding: 22, borderRadius: 16, backgroundColor: '#fff' },
  email: { fontWeight: '700', marginBottom: 7 },
  phone: { color: '#657373', marginBottom: 7 },
  logout: { color: '#147b77', fontWeight: '700', marginTop: 24 }
});
