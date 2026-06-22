import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useAuth } from '../../src/AuthContext';

export default function Login() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#147b77" /></View>;
  if (user) return <Redirect href="/home" />;

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace('/home');
    } catch (loginError) {
      setError(loginError.message === 'Email or password is incorrect'
        ? 'Email hoặc mật khẩu chưa đúng.'
        : loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>EduConnect</Text>
        <Text style={styles.title}>Đăng nhập</Text>
        <Text style={styles.description}>Tiếp tục hành trình học tập của bạn.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          value={email}
          onChangeText={(value) => { setEmail(value); setError(''); }}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={(value) => { setPassword(value); setError(''); }}
          onSubmitEditing={submit}
          returnKeyType="done"
        />

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
        </Pressable>
        <Link href="/(auth)/register" style={styles.link}>Chưa có tài khoản? Đăng ký</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7faf9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7faf9' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#147b77', fontSize: 20, fontWeight: '800' },
  title: { fontSize: 36, fontWeight: '800', marginTop: 24 },
  description: { color: '#687577', marginTop: 8, marginBottom: 24 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4e5', padding: 15, borderRadius: 12, marginBottom: 14 },
  button: { minHeight: 52, backgroundColor: '#147b77', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#147b77', textAlign: 'center', marginTop: 22 },
  error: { color: '#b83333', backgroundColor: '#fff0f0', padding: 12, borderRadius: 10, marginBottom: 14 }
});
