import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { accountM1 } from '../../src/api/m1';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Choice, Field, FormScreen, Heading, Notice } from '../../src/components/Ui';
import { base } from '../../src/theme/tokens';
import { ArrowLeft } from 'lucide-react-native';
import { phoneValid } from '../../src/utils/validation';

interface Place { code: string; name: string }
export default function ProfileEdit() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '', dateOfBirth: user?.dateOfBirth || '', gender: user?.gender || 'PREFER_NOT_TO_SAY', provinceCode: user?.provinceCode || '', communeCode: user?.communeCode || '', addressDetail: user?.addressDetail || '', bio: user?.bio || '' });
  const [provinces, setProvinces] = useState<Place[]>([]); const [communes, setCommunes] = useState<Place[]>([]);
  const [provinceQuery, setProvinceQuery] = useState(''); const [communeQuery, setCommuneQuery] = useState('');
  const [selecting, setSelecting] = useState<'province' | 'commune' | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void api.request<Place[]>('/api/reference/provinces').then(setProvinces).catch(() => setError('Không thể tải danh sách tỉnh/thành.')); }, []);
  useEffect(() => { if (!form.provinceCode) { setCommunes([]); return; } void api.request<Place[]>(`/api/reference/provinces/${encodeURIComponent(form.provinceCode)}/communes`).then(setCommunes).catch(() => setError('Không thể tải xã/phường.')); }, [form.provinceCode]);
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const changed = JSON.stringify(form) !== JSON.stringify({ fullName: user?.fullName || '', phone: user?.phone || '', dateOfBirth: user?.dateOfBirth || '', gender: user?.gender || 'PREFER_NOT_TO_SAY', provinceCode: user?.provinceCode || '', communeCode: user?.communeCode || '', addressDetail: user?.addressDetail || '', bio: user?.bio || '' });
  function cancel() { if (!changed) return router.back(); Alert.alert('Bỏ thay đổi?', 'Thông tin chưa lưu sẽ mất.', [{ text: 'Ở lại', style: 'cancel' }, { text: 'Bỏ thay đổi', onPress: () => router.back() }]); }
  async function save() {
    if (!form.fullName.trim() || form.fullName.trim().length > 100) return setError('Họ tên phải có và tối đa 100 ký tự.');
    if (!phoneValid(form.phone)) return setError('Số điện thoại phải gồm 8-15 chữ số.');
    if (form.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) || form.dateOfBirth > new Date().toISOString().slice(0, 10))) return setError('Ngày sinh cần theo YYYY-MM-DD và không ở tương lai.');
    if (form.bio.length > 300) return setError('Giới thiệu không được quá 300 ký tự.');
    setBusy(true); setError('');
    try { await accountM1.update({ fullName: form.fullName.trim(), phone: form.phone.trim() || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender, provinceCode: form.provinceCode || null, communeCode: form.communeCode || null, addressDetail: form.addressDetail.trim() || null, bio: form.bio.trim() || null }); await refreshUser(); router.back(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.'); }
    finally { setBusy(false); }
  }
  const role = user?.activeRole;
  return <FormScreen role={role}><Pressable accessibilityRole="button" onPress={cancel} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, marginBottom: 7 }}><ArrowLeft size={18} color={base.muted} /><Text style={{ color: base.muted, fontWeight: '700' }}>Tài khoản</Text></Pressable><Heading eyebrow="TÀI KHOẢN" title="Chỉnh sửa hồ sơ" detail={user?.tutorStatus === 'APPROVED' ? 'Thay đổi thông tin chính có thể cần được xét duyệt lại.' : 'Cập nhật thông tin cá nhân của bạn.'} role={role} />
    <Field label="Họ và tên" value={form.fullName} onChangeText={v => set('fullName', v)} maxLength={100} />
    <Field label="Email (không thể sửa)" value={user?.email || ''} editable={false} />
    <Field label="Số điện thoại" value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" maxLength={16} />
    <Field label="Ngày sinh (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={v => set('dateOfBirth', v)} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="2000-01-31" />
    <Text style={{ color: base.ink, fontWeight: '700', marginBottom: 8 }}>Giới tính</Text>
    {([['MALE', 'Nam'], ['FEMALE', 'Nữ'], ['PREFER_NOT_TO_SAY', 'Không muốn chia sẻ']] as const).map(([value, label]) => <Choice key={value} label={label} selected={form.gender === value} onPress={() => set('gender', value)} role={role} />)}
    <Text style={{ color: base.ink, fontWeight: '700', marginVertical: 8 }}>Khu vực sinh sống</Text>
    <Choice label={provinces.find(p => p.code === form.provinceCode)?.name || 'Chọn tỉnh/thành phố'} selected={Boolean(form.provinceCode)} onPress={() => setSelecting(selecting === 'province' ? null : 'province')} role={role} />
    {selecting === 'province' ? <View><Field label="Tìm tỉnh/thành" value={provinceQuery} onChangeText={setProvinceQuery} />{provinces.filter(p => p.name.toLowerCase().includes(provinceQuery.toLowerCase())).slice(0, 20).map(p => <Choice key={p.code} label={p.name} selected={form.provinceCode === p.code} onPress={() => { setForm(current => ({ ...current, provinceCode: p.code, communeCode: '' })); setSelecting(null); }} role={role} />)}</View> : null}
    {form.provinceCode ? <Choice label={communes.find(p => p.code === form.communeCode)?.name || 'Chọn xã/phường'} selected={Boolean(form.communeCode)} onPress={() => setSelecting(selecting === 'commune' ? null : 'commune')} role={role} /> : null}
    {selecting === 'commune' ? <View><Field label="Tìm xã/phường" value={communeQuery} onChangeText={setCommuneQuery} />{communes.filter(p => p.name.toLowerCase().includes(communeQuery.toLowerCase())).slice(0, 20).map(p => <Choice key={p.code} label={p.name} selected={form.communeCode === p.code} onPress={() => { set('communeCode', p.code); setSelecting(null); }} role={role} />)}</View> : null}
    <Field label="Địa chỉ chi tiết" value={form.addressDetail} onChangeText={v => set('addressDetail', v)} maxLength={255} />
    <Field label="Giới thiệu ngắn" value={form.bio} onChangeText={v => set('bio', v)} multiline maxLength={300} />
    <Notice message={error} /><Button label="Lưu thay đổi" onPress={() => void save()} busy={busy} role={role} /><Button label="Hủy" secondary role={role} onPress={cancel} />
  </FormScreen>;
}
