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

export default function Register() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#147b77" /></View>;
  if (user) return <Redirect href="/home" />;

  async function submit() {
    if (busy) return;
    if (fullName.trim().length < 2) {
      setError('Họ và tên cần ít nhất 2 ký tự.');
      return;
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu cần ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password
      });
      router.replace('/home');
    } catch (registerError) {
      setError(registerError.message === 'Email is already registered'
        ? 'Email này đã được đăng ký.'
        : registerError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>EduConnect</Text>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.note}>Tài khoản mới mặc định là Học viên</Text>

        <TextInput
          style={styles.input}
          placeholder="Họ và tên"
          autoComplete="name"
          value={fullName}
          onChangeText={(value) => { setFullName(value); setError(''); }}
          maxLength={80}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          value={email}
          onChangeText={(value) => { setEmail(value); setError(''); }}
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu (tối thiểu 8 ký tự)"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={(value) => { setPassword(value); setError(''); }}
          maxLength={128}
        />
        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu"
          secureTextEntry
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={(value) => { setConfirmPassword(value); setError(''); }}
          onSubmitEditing={submit}
          returnKeyType="done"
          maxLength={128}
        />

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tạo tài khoản</Text>}
        </Pressable>
        <Link href="/(auth)/login" style={styles.link}>Đã có tài khoản? Đăng nhập</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7faf9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7faf9' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#147b77', fontSize: 20, fontWeight: '800' },
  title: { fontSize: 34, fontWeight: '800', marginTop: 20 },
  note: { color: '#147b77', marginVertical: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4e5', padding: 15, borderRadius: 12, marginBottom: 14 },
  button: { minHeight: 52, backgroundColor: '#147b77', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#147b77', textAlign: 'center', marginTop: 22 },
  error: { color: '#b83333', backgroundColor: '#fff0f0', padding: 12, borderRadius: 10, marginBottom: 14 }
});
