import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { communityApi, type CommunityTab, type Post } from '../../src/api/community';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppShell } from '../../src/components/AppShell';
import { CommunityPostCard } from '../../src/components/community/CommunityPostCard';
import { communityEventDecision } from '../../src/utils/community';
import { base, themeForRole } from '../../src/theme/tokens';

const publicTabs: Array<[CommunityTab, string]> = [['ALL', 'Tất cả'], ['TUTOR_POLL', 'Khảo sát'], ['STUDENT_FIND_TUTOR', 'Tìm gia sư'], ['TUTOR_CLASS_SHARE', 'Lớp học'], ['TUTOR_ANNOUNCEMENT', 'Chia sẻ']];

export default function CommunityFeed() {
  const { user, realtime } = useAuth();
  const role = user?.activeRole;
  const [tab, setTab] = useState<CommunityTab>('ALL');
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const seen = useRef(new Set<string>());
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const color = themeForRole(role).primary;
  const tabs = role ? [...publicTabs, ...(role === 'STUDENT' ? [['FOLLOWING', 'Đang theo dõi'] as [CommunityTab, string]] : []), ['SAVED', 'Đã lưu'] as [CommunityTab, string], ['MINE', 'Bài của tôi'] as [CommunityTab, string]] : publicTabs;

  const load = useCallback(async (nextPage = 0) => {
    const token = nextPage === 0 ? ++generation.current : generation.current;
    if (nextPage === 0) setLoading(true); else setMoreLoading(true);
    setError('');
    try {
      const result = await communityApi.feed({ tab, keyword: search, page: nextPage });
      if (token !== generation.current) return;
      setPosts(current => nextPage === 0 ? result.content : [...current, ...result.content.filter(post => !current.some(existing => existing.id === post.id))]);
      setPage(nextPage);
      setHasMore(nextPage + 1 < result.totalPages);
    } catch (cause) { if (token === generation.current) setError(cause instanceof Error ? cause.message : 'Không thể tải bảng tin.'); }
    finally { if (token === generation.current) { setLoading(false); setMoreLoading(false); } }
  }, [tab, search, user?.id, role]);

  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(), 350); };
    const offEvent = realtime.subscribe(frame => {
      if (frame.channel !== 'learning') return;
      const decision = communityEventDecision(frame.payload, postsRef.current, seen.current);
      if (decision === 'refresh') schedule();
    });
    const offRecovery = realtime.onRecovery(schedule);
    return () => { offEvent(); offRecovery(); if (timer) clearTimeout(timer); };
  }, [realtime, load]);

  function create() { if (user) router.push('/community/compose'); else router.push({ pathname: '/(auth)/sign-in', params: { returnTo: '/community/compose' } }); }
  return <AppShell role={role === 'TUTOR' ? 'TUTOR' : role === 'STUDENT' ? 'STUDENT' : null} active={role === 'TUTOR' ? 'home' : 'explore'} title="Cộng đồng">
    <FlatList data={posts} keyExtractor={post => String(post.id)} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <CommunityPostCard post={item} owner={tab === 'MINE'} onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(item.id), ...(tab === 'MINE' ? { mine: '1' } : {}) } })} />}
      ListHeaderComponent={<>
        <View style={styles.heading}><View style={styles.headingText}><Text style={styles.title}>Bảng tin kết nối</Text><Text style={styles.subtitle}>Chia sẻ và tìm cơ hội học tập</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Tạo bài viết" onPress={create} style={[styles.create, { backgroundColor: color }]}><Plus size={18} color="#fff" /><Text style={styles.createText}>Đăng bài</Text></Pressable></View>
        <View style={styles.search}><Search size={18} color={base.muted} /><TextInput style={styles.searchInput} placeholder="Tìm bài viết" value={keyword} onChangeText={setKeyword} onSubmitEditing={() => setSearch(keyword.trim())} returnKeyType="search" /><Pressable onPress={() => setSearch(keyword.trim())}><Text style={[styles.searchAction, { color }]}>Tìm</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => { if (tab !== key) { setPosts([]); setTab(key); } }} style={[styles.tab, tab === key && { borderColor: color, backgroundColor: themeForRole(role).primarySoft }]}><Text style={[styles.tabText, tab === key && { color }]}>{label}</Text></Pressable>)}</ScrollView>
      </>}
      refreshing={loading && posts.length > 0} onRefresh={() => void load()}
      onEndReachedThreshold={0.25} onEndReached={() => { if (!loading && !moreLoading && hasMore) void load(page + 1); }}
      ListEmptyComponent={loading ? <ActivityIndicator style={styles.empty} color={color} /> : <Text style={styles.empty}>{error || 'Chưa có bài viết phù hợp.'}</Text>}
      ListFooterComponent={<>{moreLoading && <ActivityIndicator color={color} />}{error && posts.length > 0 && <Text style={styles.error}>{error}</Text>}{error && <Pressable onPress={() => void load(page)}><Text style={[styles.retry, { color }]}>Thử lại</Text></Pressable>}</>}
    />
  </AppShell>;
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 34, maxWidth: 680, width: '100%', alignSelf: 'center', flexGrow: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 5 }, headingText: { flex: 1 },
  title: { fontSize: 23, color: base.ink, fontWeight: '800' }, subtitle: { color: base.muted, fontSize: 12, marginTop: 3 },
  create: { borderRadius: 7, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11 }, createText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: base.line, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 13 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: base.ink }, searchAction: { fontWeight: '800', fontSize: 12 },
  tabs: { gap: 8, paddingBottom: 14 }, tab: { borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', borderRadius: 6, minHeight: 36, paddingHorizontal: 11, justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '700', color: base.muted }, empty: { color: base.muted, textAlign: 'center', paddingVertical: 44, fontSize: 14 },
  error: { color: base.danger, textAlign: 'center', marginTop: 10 }, retry: { textAlign: 'center', fontWeight: '800', padding: 12 },
});
