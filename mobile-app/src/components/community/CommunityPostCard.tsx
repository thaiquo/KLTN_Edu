import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, Heart, MessageCircle, Users } from 'lucide-react-native';
import type { Post } from '../../api/community';
import { moderationDisplay, moderationLabel } from '../../utils/community';
import { base } from '../../theme/tokens';

const typeLabel: Record<string, string> = {
  STUDENT_FIND_TUTOR: 'Tìm gia sư', STUDENT_GROUP_STUDY: 'Học nhóm', TUTOR_ANNOUNCEMENT: 'Chia sẻ',
  TUTOR_POLL: 'Khảo sát mở lớp', TUTOR_CLASS_SHARE: 'Giới thiệu lớp',
};

export function CommunityPostCard({ post, onPress, owner = false, full = false }: { post: Post; onPress?: () => void; owner?: boolean; full?: boolean }) {
  const moderation = moderationDisplay(post);
  const body = <>
    <View style={styles.top}><View style={styles.avatar}><Text style={styles.avatarText}>{post.authorName?.trim().slice(0, 1).toUpperCase() || '?'}</Text></View>
      <View style={styles.authorBlock}><Text style={styles.author}>{post.authorName}</Text><Text style={styles.muted}>{post.authorRole === 'TUTOR' ? 'Gia sư' : 'Học viên'} · {new Date(post.createdAt).toLocaleDateString('vi-VN')}</Text></View>
      <Text style={styles.type}>{typeLabel[post.postType] || post.postType}</Text>
    </View>
    {owner && <View style={styles.status}><Text style={styles.statusText}>{moderation.pending ? 'Bản chỉnh sửa: ' : ''}{moderationLabel[moderation.status]}</Text>
      {moderation.reason ? <Text style={styles.reason}>{moderation.reason}</Text> : null}</View>}
    <Text style={styles.title}>{post.title}</Text>
    <Text numberOfLines={full ? undefined : 4} style={styles.content}>{post.content}</Text>
    {(post.subjectName || post.levelName || post.educationLevel) && <Text style={styles.meta}>{[post.subjectName, post.levelName || post.educationLevel].filter(Boolean).join(' · ')}</Text>}
    {post.learningMode && post.postType !== 'TUTOR_ANNOUNCEMENT' && <Text style={styles.meta}>{post.learningMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}{post.targetPricePerSession ? ` · ${Number(post.targetPricePerSession).toLocaleString('vi-VN')} đ/buổi` : ''}</Text>}
    {post.poll && <View style={styles.poll}><Users size={17} color="#137e77" /><Text style={styles.pollText} numberOfLines={2}>{post.poll.question} · {post.poll.participantCount || 0} người bình chọn</Text></View>}
    {post.linkedClassName && <Text style={styles.meta}>Lớp: {post.linkedClassName}</Text>}
    <View style={styles.footer}><Heart size={15} color={post.isLiked ? '#c3445d' : base.muted} /><Text style={styles.count}>{post.likeCount || 0}</Text><MessageCircle size={15} color={base.muted} /><Text style={styles.count}>{post.commentCount || 0}</Text><Bookmark size={15} color={post.isBookmarked ? '#137e77' : base.muted} /></View>
  </>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>{body}</Pressable> : <View style={styles.card}>{body}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderColor: base.line, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 11 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  avatar: { height: 35, width: 35, borderRadius: 18, backgroundColor: '#e5f4f2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#16766f', fontWeight: '800' }, authorBlock: { flex: 1, minWidth: 0 }, author: { color: base.ink, fontSize: 13, fontWeight: '800' },
  muted: { color: base.muted, fontSize: 11, marginTop: 2 }, type: { color: '#16766f', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  title: { fontSize: 16, fontWeight: '800', color: base.ink, lineHeight: 23, marginBottom: 7 },
  content: { color: base.ink, fontSize: 14, lineHeight: 21 }, meta: { color: base.muted, fontSize: 12, marginTop: 9 },
  poll: { backgroundColor: '#f0faf8', borderRadius: 6, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 },
  pollText: { flex: 1, color: '#116d67', fontSize: 12, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: base.line, marginTop: 13, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  count: { color: base.muted, fontSize: 12, marginRight: 13 },
  status: { borderLeftWidth: 3, borderLeftColor: '#d49a3c', backgroundColor: '#fff8eb', padding: 9, marginBottom: 12 },
  statusText: { color: '#80531d', fontSize: 12, fontWeight: '800' }, reason: { color: '#80531d', fontSize: 12, lineHeight: 18, marginTop: 5 },
});
