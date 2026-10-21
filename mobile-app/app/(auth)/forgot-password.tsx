import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { authM1 } from '../../src/api/m1';
import { Button, Field, FormScreen, Heading, Notice } from '../../src/components/Ui';
import { emailValid } from '../../src/utils/validation';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const [email, setEmail] = useState(params.email || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState(false);
  async function submit() {
    if (!emailValid(email)) return setError('Email không hợp lệ.');
    setBusy(true); setError('');
    try { await authM1.forgotPassword(email.trim().toLowerCase()); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi mã đặt lại.'); }
    finally { setBusy(false); }
  }
  return <FormScreen><Heading eyebrow="TÀI KHOẢN" title="Quên mật khẩu" detail="Chúng tôi sẽ gửi mã đặt lại đến email của bạn." />
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Notice message={error} /><Notice message={sent ? 'Nếu email tồn tại, mã đặt lại đã được gửi.' : null} success />
    <Button label="Gửi mã đặt lại" onPress={() => void submit()} busy={busy} />
    {sent ? <Button label="Nhập mã OTP" secondary onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { email, role: params.role || 'STUDENT' } })} /> : null}
    <Button label="Quay lại đăng nhập" secondary onPress={() => router.back()} />
  </FormScreen>;
}
