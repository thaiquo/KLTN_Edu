import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Bookmark, Heart, Pencil, RotateCcw, Share2, Trash2 } from 'lucide-react-native';
import { communityApi, type Comment, type Poll, type Post } from '../../src/api/community';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppShell } from '../../src/components/AppShell';
import { CommunityPostCard } from '../../src/components/community/CommunityPostCard';
import { CommunityPoll } from '../../src/components/community/CommunityPoll';
import { communityEventDecision, moderationDisplay } from '../../src/utils/community';
import { base, themeForRole } from '../../src/theme/tokens';
import { publicWebUrl } from '../../src/config/runtime';

export default function CommunityDetail() {
  const { id, mine } = useLocalSearchParams<{ id: string; mine?: string }>();
  const postId = Number(id);
  const { user, realtime } = useAuth();
  const role = user?.activeRole;
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentPage, setCommentPage] = useState(0);
  const [commentPages, setCommentPages] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Set<string>());
  const postRef = useRef(post);
  postRef.current = post;
  const color = themeForRole(role).primary;
  const owner = Boolean(user && post && user.id === post.authorId && user.activeRole === post.authorRole);

  const load = useCallback(async () => {
    if (!Number.isInteger(postId) || postId < 1) { setError('Bài viết không hợp lệ.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      let item: Post | undefined;
      if (mine === '1' && user) {
        for (let page = 0; page < 50 && !item; page++) {
          const result = await communityApi.feed({ tab: 'MINE', page, size: 50 });
          item = result.content.find(value => value.id === postId);
          if (page + 1 >= result.totalPages) break;
        }
      }
      item = item || await communityApi.detail(postId);
      setPost(item);
      if (item.moderationStatus === 'ALLOWED' || item.moderationStatus === 'NOT_CHECKED') {
        const result = await communityApi.comments(postId).catch(() => null);
        if (result) { setComments(result.content); setCommentPage(0); setCommentPages(result.totalPages); }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải bài viết.'); }
    finally { setLoading(false); }
  }, [postId, mine, user?.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(), 350); };
    const offEvent = realtime.subscribe(frame => {
      if (frame.channel !== 'learning') return;
      const event = frame.payload as { type?: string; entityId?: number; payload?: { postId?: number } };
      const eventId = Number(event?.payload?.postId ?? event?.entityId);
      if (eventId !== postId) return;
      if (communityEventDecision(event, postRef.current ? [postRef.current] : [], seen.current) === 'refresh') schedule();
    });
    const offRecovery = realtime.onRecovery(schedule);
    return () => { offEvent(); offRecovery(); if (timer) clearTimeout(timer); };
  }, [realtime, load, postId]);

  function login() { router.push({ pathname: '/(auth)/sign-in', params: { returnTo: `/community/${postId}` } }); }
  async function act(operation: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await operation(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Thao tác không thành công.'); }
    finally { setBusy(false); }
  }
  function remove() {
    const confirmed = async () => {
      setBusy(true); setError('');
      try { await communityApi.remove(postId); router.replace('/community'); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa bài viết.'); }
      finally { setBusy(false); }
    };
    if (Platform.OS === 'web') { if (globalThis.confirm('Xóa bài viết?')) void confirmed(); return; }
    Alert.alert('Xóa bài viết?', 'Bài viết sẽ không còn hiển thị trong cộng đồng.', [
      { text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void confirmed() },
    ]);
  }
  async function sendComment() {
    if (!comment.trim()) return;
    await act(async () => { await communityApi.comment(postId, comment.trim()); setComment(''); });
  }
  async function share() {
    if (!post || !publicWebUrl) { setError('Chưa có địa chỉ chia sẻ bài viết.'); return; }
    const url = post.publicShareId ? `${publicWebUrl}/share/posts/${post.publicShareId}` : `${publicWebUrl}/community?postId=${post.id}`;
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(url); setNotice('Đã sao chép liên kết bài viết.'); }
      else await Share.share({ message: `${post.title}\n${url}`, url });
    } catch { setError('Không thể chia sẻ liên kết lúc này.'); }
  }
  async function moreComments() {
    if (busy || commentPage + 1 >= commentPages) return;
    setBusy(true);
    try {
      const next = await communityApi.comments(postId, commentPage + 1);
      setComments(current => [...current, ...next.content.filter(item => !current.some(existing => existing.id === item.id))]);
      setCommentPage(commentPage + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải thêm bình luận.'); }
    finally { setBusy(false); }
  }
  return <AppShell role={role === 'TUTOR' ? 'TUTOR' : role === 'STUDENT' ? 'STUDENT' : null} active={role === 'TUTOR' ? 'home' : 'explore'} title="Bài viết">
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={color} /><Text style={[styles.backText, { color }]}>Cộng đồng</Text></Pressable>
      {loading && !post ? <ActivityIndicator color={color} style={styles.space} /> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={[styles.link, { color }]}>Thử lại</Text></Pressable></View> : null}
      {notice ? <Text style={[styles.notice, { color }]}>{notice}</Text> : null}
      {post && <>
        <CommunityPostCard post={post} full owner={owner} />
        {owner && <View style={styles.actions}>
          <Action icon={Pencil} text="Chỉnh sửa" onPress={() => router.push({ pathname: '/community/compose', params: { id: String(postId) } })} />
          {moderationDisplay(post).status === 'FAILED' && <Action icon={RotateCcw} text="Kiểm duyệt lại" disabled={busy} onPress={() => void act(() => communityApi.retry(postId))} />}
          <Action icon={Trash2} text="Xóa" onPress={remove} />
        </View>}
        {post.poll && <CommunityPoll poll={post.poll} role={post.moderationStatus === 'ALLOWED' || post.moderationStatus === 'NOT_CHECKED' ? role : 'TUTOR'} onLogin={login} onChange={(poll: Poll) => setPost(value => value ? { ...value, poll } : value)} />}
        {(post.moderationStatus === 'ALLOWED' || post.moderationStatus === 'NOT_CHECKED') && <>
          <View style={styles.actions}>
            <Action icon={Heart} text={`${post.likeCount || 0} Thích`} onPress={() => user ? void act(() => communityApi.like(postId)) : login()} />
            <Action icon={Bookmark} text={post.isBookmarked ? 'Đã lưu' : 'Lưu'} onPress={() => user ? void act(() => communityApi.bookmark(postId)) : login()} />
            <Action icon={Share2} text="Chia sẻ" onPress={() => void share()} />
            {post.authorRole === 'TUTOR' && user?.activeRole === 'STUDENT' && user.id !== post.authorId && <Pressable onPress={() => void act(() => post.isAuthorFollowed ? communityApi.unfollow(post.authorId) : communityApi.follow(post.authorId))}><Text style={[styles.link, { color }]}>{post.isAuthorFollowed ? 'Bỏ theo dõi' : 'Theo dõi'}</Text></Pressable>}
          </View>
          <Text style={styles.section}>Bình luận ({post.commentCount || 0})</Text>
          {comments.map(item => <View key={item.id} style={styles.comment}><Text style={styles.commentAuthor}>{item.userName}</Text><Text style={styles.commentText}>{item.commentText}</Text></View>)}
          {commentPage + 1 < commentPages && <Pressable disabled={busy} onPress={() => void moreComments()}><Text style={[styles.link, { color }]}>Xem thêm bình luận</Text></Pressable>}
          {!comments.length && <Text style={styles.muted}>Chưa có bình luận.</Text>}
          {user ? <View style={styles.commentForm}><TextInput value={comment} onChangeText={setComment} multiline placeholder="Viết bình luận..." style={styles.input} /><Pressable disabled={busy || !comment.trim()} onPress={() => void sendComment()}><Text style={[styles.link, { color }]}>Gửi</Text></Pressable></View> : <Pressable onPress={login}><Text style={[styles.link, { color }]}>Đăng nhập để bình luận</Text></Pressable>}
        </>}
      </>}
    </ScrollView>
  </AppShell>;
}

function Action({ icon: Icon, text, onPress, disabled }: { icon: typeof Pencil; text: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={styles.action}><Icon size={16} color={base.ink} /><Text style={styles.actionText}>{text}</Text></Pressable>;
}
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36, maxWidth: 680, width: '100%', alignSelf: 'center' }, back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15, minHeight: 30 }, backText: { fontSize: 13, fontWeight: '800' },
  space: { marginTop: 35 }, errorBox: { padding: 12, backgroundColor: '#fff0ef', marginBottom: 12, borderRadius: 6 }, error: { color: base.danger, fontSize: 13 }, link: { fontSize: 13, fontWeight: '800', marginTop: 5 },
  notice: { fontSize: 12, marginBottom: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }, action: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', padding: 9, borderRadius: 6 }, actionText: { color: base.ink, fontSize: 12, fontWeight: '700' },
  section: { color: base.ink, fontSize: 16, fontWeight: '800', marginTop: 7, marginBottom: 9 }, muted: { color: base.muted, fontSize: 13 },
  comment: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: base.line, padding: 12 }, commentAuthor: { color: base.ink, fontSize: 12, fontWeight: '800' }, commentText: { color: base.ink, fontSize: 13, lineHeight: 19, marginTop: 4 },
  commentForm: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, input: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: base.line, borderRadius: 6, padding: 9, backgroundColor: '#fff', color: base.ink },
});
