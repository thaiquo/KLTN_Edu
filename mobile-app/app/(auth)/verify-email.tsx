import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { authM1 } from '../../src/api/m1';
import { Button, Field, FormScreen, Heading, Notice } from '../../src/components/Ui';
import { emailValid, otpValid } from '../../src/utils/validation';
import { base } from '../../src/theme/tokens';

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const [email, setEmail] = useState(params.email || ''); const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(params.email ? 60 : 0); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { if (seconds <= 0) return; const timer = setTimeout(() => setSeconds(s => s - 1), 1000); return () => clearTimeout(timer); }, [seconds]);
  async function verify() {
    if (!emailValid(email) || !otpValid(otp)) return setError('Nhập email hợp lệ và mã OTP gồm 6 chữ số.');
    setBusy(true); setError('');
    try { await authM1.verifyEmail(email.trim().toLowerCase(), otp); router.replace({ pathname: '/(auth)/sign-in', params: { email, role: params.role || 'STUDENT', message: 'Email đã xác minh. Vui lòng đăng nhập.' } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Mã không hợp lệ hoặc đã hết hạn.'); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (!emailValid(email)) return setError('Vui lòng nhập email hợp lệ.');
    setBusy(true); setError(''); setMessage('');
    try { await authM1.resendOtp(email.trim().toLowerCase()); setSeconds(60); setMessage('Nếu tài khoản đủ điều kiện, mã mới đã được gửi.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi lại mã.'); }
    finally { setBusy(false); }
  }
  return <FormScreen><Heading eyebrow="XÁC MINH" title="Kiểm tra email" detail="Nhập mã 6 chữ số được gửi đến hộp thư của bạn." />
    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
    <Field label="Mã OTP" value={otp} onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" placeholder="000000" />
    <Notice message={error} /><Notice message={message} success /><Button label="Xác minh email" onPress={() => void verify()} busy={busy} />
    <Button label={seconds ? `Gửi lại sau ${seconds} giây` : 'Gửi lại mã'} onPress={() => void resend()} disabled={seconds > 0} busy={busy} secondary />
    <Pressable onPress={() => router.replace('/(auth)/sign-in')} style={{ alignItems: 'center', padding: 18 }}><Text style={{ color: base.muted }}>Quay lại đăng nhập</Text></Pressable>
  </FormScreen>;
}
