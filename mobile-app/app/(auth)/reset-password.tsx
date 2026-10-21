import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { authM1 } from '../../src/api/m1';
import { Button, Field, FormScreen, Heading, Notice } from '../../src/components/Ui';
import { emailValid, otpValid, passwordValid } from '../../src/utils/validation';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const [email, setEmail] = useState(params.email || ''); const [otp, setOtp] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (!emailValid(email) || !otpValid(otp)) return setError('Email hoặc mã OTP không hợp lệ.');
    if (!passwordValid(password)) return setError('Mật khẩu cần từ 8 đến 100 ký tự.');
    if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.');
    setBusy(true); setError('');
    try { await authM1.resetPassword({ email: email.trim().toLowerCase(), otp, newPassword: password, confirmPassword: confirm }); router.replace({ pathname: '/(auth)/sign-in', params: { email, role: params.role || 'STUDENT', message: 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập.' } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đặt lại mật khẩu.'); }
    finally { setBusy(false); }
  }
  return <FormScreen><Heading eyebrow="BẢO MẬT" title="Đặt lại mật khẩu" detail="Dùng mã OTP đặt lại mật khẩu, không phải mã xác minh email." />
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Field label="Mã OTP" value={otp} onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
    <Field label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
    <Field label="Xác nhận mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
    <Notice message={error} /><Button label="Đặt lại mật khẩu" onPress={() => void submit()} busy={busy} />
  </FormScreen>;
}
