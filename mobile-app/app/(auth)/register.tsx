import React, { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { authM1 } from '../../src/api/m1';
import { Button, Choice, Field, FormScreen, Heading, Notice } from '../../src/components/Ui';
import { emailValid, passwordValid } from '../../src/utils/validation';
import { base } from '../../src/theme/tokens';

export default function Register() {
  const [role, setRole] = useState<'STUDENT' | 'TUTOR'>('STUDENT');
  const [fullName, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (!fullName.trim() || fullName.trim().length > 100) return setError('Họ tên phải có và tối đa 100 ký tự.');
    if (!emailValid(email)) return setError('Email không hợp lệ.');
    if (!passwordValid(password)) return setError('Mật khẩu cần từ 8 đến 100 ký tự.');
    if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.');
    setBusy(true); setError('');
    try {
      const result = await authM1.register({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password, confirmPassword: confirm, role });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: result.email || email.trim().toLowerCase(), role } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Đăng ký chưa thành công.'); }
    finally { setBusy(false); }
  }
  return <FormScreen><Heading eyebrow="EDUCONNECT" title="Tạo tài khoản" detail="Một tài khoản, hai hành trình học tập và giảng dạy." />
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}><View style={{ flex: 1 }}><Choice label="Học viên" selected={role === 'STUDENT'} onPress={() => setRole('STUDENT')} /></View><View style={{ flex: 1 }}><Choice label="Gia sư" selected={role === 'TUTOR'} role="TUTOR" onPress={() => setRole('TUTOR')} /></View></View>
    <Field label="Họ và tên" value={fullName} onChangeText={setName} autoComplete="name" maxLength={100} placeholder="Nguyễn Văn A" />
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="email@example.com" />
    <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={100} placeholder="Tối thiểu 8 ký tự" />
    <Field label="Xác nhận mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" placeholder="Nhập lại mật khẩu" />
    <Notice message={error} /><Button label="Tạo tài khoản" onPress={() => void submit()} busy={busy} role={role} />
    <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 18 }}><Text style={{ color: base.muted }}>Đã có tài khoản? Đăng nhập</Text></Pressable>
  </FormScreen>;
}
