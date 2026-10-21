import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, LogOut, ShieldCheck, UserRound } from 'lucide-react-native';
import { accountM1 } from '../../src/api/m1';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, FormScreen, Heading, Notice, Panel } from '../../src/components/Ui';
import { AppShell } from '../../src/components/AppShell';
import { base, themeForRole } from '../../src/theme/tokens';

export default function Profile() {
  const { user, refreshUser, switchRole, logout } = useAuth();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { void refreshUser().catch(cause => setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.')); }, [refreshUser]));
  if (!user) return <Redirect href="/(public)" />;
  const theme = themeForRole(user.activeRole);
  const tutorAvailable = user.tutorStatus === 'APPROVED' && user.roles.includes('TUTOR');
  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('Cần quyền truy cập ảnh để chọn ảnh đại diện.');
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9, allowsEditing: true, aspect: [1, 1] });
    const asset = selected.assets?.[0];
    if (selected.canceled || !asset) return;
    const type = asset.mimeType || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type) || (asset.fileSize || 0) > 2 * 1024 * 1024) return setError('Ảnh cần là JPG, PNG hoặc WEBP và không quá 2 MB.');
    setBusy(true); setError('');
    try { await accountM1.uploadAvatar({ uri: asset.uri, name: asset.fileName || 'avatar.jpg', mimeType: type, size: asset.fileSize, file: asset.file }); await refreshUser(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên.'); }
    finally { setBusy(false); }
  }
  async function changeRole() {
    if (!user) return;
    setBusy(true); setError('');
    try {
      if (user.activeRole === 'TUTOR' && !user.hasStudentProfile) await accountM1.activateStudent();
      await switchRole(user.activeRole === 'TUTOR' ? 'STUDENT' : 'TUTOR');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể chuyển vai trò.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try { await logout(); router.replace('/(public)'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.'); }
    finally { setBusy(false); }
  }
  return <AppShell active="account" title="Tài khoản" role={user.activeRole === 'TUTOR' ? 'TUTOR' : 'STUDENT'}><FormScreen role={user.activeRole} edges={[]}><Heading eyebrow={theme.roleLabel.toUpperCase()} title="Hồ sơ của tôi" detail="Thông tin tài khoản và hành trình của bạn" role={user.activeRole} />
    <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Pressable onPress={() => void chooseAvatar()} accessibilityLabel="Đổi ảnh đại diện" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: 72, height: 72 }} /> : <UserRound size={32} color={theme.primary} />}
      </Pressable><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 19, color: base.ink }}>{user.fullName}</Text><Text style={{ color: base.muted, marginTop: 3 }}>{user.email}</Text><Text style={{ color: theme.primary, marginTop: 7, fontWeight: '700' }}>{user.activeRole === 'TUTOR' ? 'Gia sư' : 'Học viên'} · {user.accountStatus === 'ACTIVE' ? 'Đang hoạt động' : user.accountStatus || 'Tài khoản'}</Text></View><Camera size={18} color={theme.primary} />
    </View></Panel>
    <Notice message={error} />
    <Panel><Text style={{ fontSize: 16, fontWeight: '800', color: base.ink, marginBottom: 10 }}>Thông tin cá nhân</Text>
      <Info label="Số điện thoại" value={user.phone} /><Info label="Ngày sinh" value={user.dateOfBirth} /><Info label="Khu vực" value={[user.commune, user.province].filter(Boolean).join(', ')} /><Info label="Giới thiệu" value={user.bio} />
      <Button label="Chỉnh sửa hồ sơ" onPress={() => router.push('/(app)/profile-edit')} role={user.activeRole} secondary />
    </Panel>
    <Panel><Text style={{ fontSize: 16, fontWeight: '800', color: base.ink, marginBottom: 8 }}>Vai trò & gia sư</Text>
      <Text style={{ color: base.muted, lineHeight: 20, marginBottom: 12 }}>{user.activeRole === 'STUDENT' ? 'Bạn đang dùng tài khoản Học viên.' : 'Bạn đang dùng tài khoản Gia sư.'}</Text>
      {user.activeRole === 'TUTOR' || tutorAvailable ? <Button label={`Chuyển sang ${user.activeRole === 'TUTOR' ? 'Học viên' : 'Gia sư'}`} onPress={() => void changeRole()} busy={busy} role={user.activeRole} /> : null}
    </Panel>
    <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}><ShieldCheck size={18} color={theme.primary} /><Text style={{ color: base.ink, fontWeight: '800' }}>Tài khoản</Text></View>
      <Info label="Email" value={user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'} /><Info label="Ví liên kết" value={user.walletAddress || 'Chưa liên kết'} />
    </Panel>
    <Pressable disabled={busy} onPress={() => Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất khỏi thiết bị này?', [{ text: 'Hủy', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() }])} style={{ flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', minHeight: 52 }}><LogOut size={18} color={base.danger} /><Text style={{ color: base.danger, fontWeight: '800' }}>Đăng xuất</Text></Pressable>
  </FormScreen></AppShell>;
}

function Info({ label, value }: { label: string; value?: string | null }) { return <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: base.line }}><Text style={{ color: base.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: base.ink, fontSize: 14, marginTop: 3 }}>{value || 'Chưa cập nhật'}</Text></View>; }
