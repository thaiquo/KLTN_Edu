import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Poll } from '../../api/community';
import { communityApi } from '../../api/community';
import { base } from '../../theme/tokens';

export function CommunityPoll({ poll, role, onChange, onLogin }: { poll: Poll; role?: string | null; onChange: (poll: Poll) => void; onLogin: () => void }) {
  const [selected, setSelected] = useState<number[]>(poll.userVotedOptionIds || (poll.userVotedOptionId ? [poll.userVotedOptionId] : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setSelected(poll.userVotedOptionIds || (poll.userVotedOptionId ? [poll.userVotedOptionId] : [])), [poll.id, poll.userVotedOptionIds, poll.userVotedOptionId]);
  const closed = poll.isClosed || (poll.expiresAt ? new Date(poll.expiresAt).getTime() <= Date.now() : false);
  function toggle(id: number) {
    setError('');
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < poll.maxVotesPerUser ? [...current, id] : current);
  }
  async function save() {
    if (role !== 'STUDENT') { onLogin(); return; }
    setBusy(true); setError('');
    try { onChange(await communityApi.vote(poll.id, selected)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu bình chọn.'); }
    finally { setBusy(false); }
  }
  const original = poll.userVotedOptionIds || (poll.userVotedOptionId ? [poll.userVotedOptionId] : []);
  const changed = [...selected].sort().join(',') !== [...original].sort().join(',');
  return <View style={styles.wrap}>
    <Text style={styles.heading}>{poll.question}</Text>
    <Text style={styles.sub}>{poll.participantCount || 0} người tham gia · chọn tối đa {poll.maxVotesPerUser} khung giờ{closed ? ' · Đã đóng' : ''}</Text>
    {poll.minVotesTarget ? <Text style={styles.target}>Mốc quan tâm: {poll.participantCount || 0}/{poll.minVotesTarget} học viên</Text> : null}
    {poll.options.map(option => {
      const active = selected.includes(option.id);
      return <Pressable key={option.id} disabled={closed || role === 'TUTOR'} onPress={() => toggle(option.id)} accessibilityRole="checkbox" accessibilityState={{ checked: active }} style={[styles.option, active && styles.active]}>
        <Text style={[styles.optionLabel, active && styles.activeText]}>{active ? '✓  ' : ''}{option.optionLabel}</Text>
        <Text style={styles.result}>{option.voteCount || 0} · {Math.round(option.votePercentage || 0)}%</Text>
      </Pressable>;
    })}
    {!closed && role !== 'TUTOR' && <Pressable disabled={busy || (role === 'STUDENT' && !changed)} onPress={() => void save()} style={[styles.button, (busy || (role === 'STUDENT' && !changed)) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{role === 'STUDENT' ? 'Lưu bình chọn' : 'Đăng nhập để bình chọn'}</Text>}</Pressable>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: '#f4faf9', borderColor: '#cde6e2', borderWidth: 1, borderRadius: 8, padding: 15, marginBottom: 16 },
  heading: { color: base.ink, fontSize: 15, fontWeight: '800' }, sub: { color: base.muted, fontSize: 12, marginTop: 5, marginBottom: 10 }, target: { color: '#116d67', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  option: { backgroundColor: '#fff', borderColor: base.line, borderWidth: 1, borderRadius: 6, padding: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  active: { borderColor: '#16837b', backgroundColor: '#e8f5f2' }, optionLabel: { color: base.ink, fontSize: 13, flex: 1 }, activeText: { color: '#116d67', fontWeight: '700' }, result: { color: base.muted, fontSize: 11 },
  button: { backgroundColor: '#137e77', borderRadius: 6, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, disabled: { opacity: 0.55 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 13 }, error: { color: base.danger, marginTop: 8, fontSize: 12 },
});
