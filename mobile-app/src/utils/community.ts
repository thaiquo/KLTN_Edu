import type { ModerationStatus, Poll, PollInput, Post, PostInput } from '../api/community';

export const moderationLabel: Record<ModerationStatus, string> = {
  NOT_CHECKED: 'Đã đăng', MODERATING: 'Đang kiểm tra', ALLOWED: 'Đã duyệt',
  NEEDS_EDIT: 'Cần chỉnh sửa', REJECTED: 'Không phù hợp', FAILED: 'Lỗi kiểm tra',
};

export function moderationDisplay(post: Post) {
  const pending = post.pendingContentRevision != null;
  return {
    status: (pending ? post.pendingModerationStatus : post.moderationStatus) || 'NOT_CHECKED',
    reason: pending ? post.pendingModerationReason : post.moderationReason,
    pending,
  };
}

export function currentRevision(post: Post) {
  return Math.max(post.contentRevision || 0, post.pendingContentRevision || 0);
}

export function communityEventDecision(event: unknown, posts: Post[], seen: Set<string>) {
  if (!event || typeof event !== 'object') return 'ignore';
  const frame = event as { type?: string; entityId?: number; payload?: { postId?: number; contentRevision?: number; moderationStatus?: string } };
  if (!frame.type?.startsWith('COMMUNITY_')) return 'ignore';
  if (frame.type !== 'COMMUNITY_POST_MODERATION_COMPLETED') return 'refresh';
  const postId = Number(frame.payload?.postId ?? frame.entityId);
  const revision = Number(frame.payload?.contentRevision);
  if (!postId || !Number.isFinite(revision)) return 'refresh';
  const key = `${postId}:${revision}:${frame.payload?.moderationStatus || ''}`;
  if (seen.has(key)) return 'ignore';
  const local = posts.find(post => post.id === postId);
  if (local && revision < currentRevision(local)) return 'ignore';
  seen.add(key);
  if (seen.size > 200) seen.delete(seen.values().next().value!);
  return 'refresh';
}

export function standardPollOptions(): PollInput['options'] {
  const periods = [
    { label: 'Sáng', startTime: '07:00:00', endTime: '13:00:00' },
    { label: 'Chiều', startTime: '13:00:00', endTime: '18:00:00' },
    { label: 'Tối', startTime: '18:00:00', endTime: '23:00:00' },
  ];
  return Array.from({ length: 7 }, (_, index) => index + 1).flatMap(dayOfWeek =>
    periods.map(period => ({ dayOfWeek, startTime: period.startTime, endTime: period.endTime,
      optionLabel: `${dayOfWeek === 7 ? 'Chủ nhật' : `Thứ ${dayOfWeek + 1}`} - ${period.label}` })));
}

export function pollInput(question: string, sessions: number, duration: number, target: number, existing?: Poll | null): PollInput {
  return {
    question: question.trim(), minVotesTarget: target, sessionsPerWeek: sessions, durationMinutes: duration,
    maxVotesPerUser: existing?.totalVotes ? existing.maxVotesPerUser : sessions,
    options: existing?.totalVotes ? existing.options.map(option => ({ dayOfWeek: option.dayOfWeek,
      startTime: option.startTime, endTime: option.endTime, optionLabel: option.optionLabel })) : standardPollOptions(),
  };
}

export function validatePost(input: PostInput) {
  if (!input.title.trim()) return 'Vui lòng nhập tiêu đề bài viết.';
  if (input.title.length > 255) return 'Tiêu đề không được vượt quá 255 ký tự.';
  if (!input.content.trim()) return 'Vui lòng nhập nội dung bài viết.';
  if (input.content.length > 10000) return 'Nội dung không được vượt quá 10.000 ký tự.';
  if (input.postType.startsWith('STUDENT_') && (!input.catalogSubjectId || !input.catalogLevelId)) return 'Vui lòng chọn môn học và trình độ.';
  if (input.postType === 'TUTOR_POLL' && (!input.subjectId || !input.educationLevel || !input.poll?.question)) return 'Vui lòng chọn môn, lớp và nhập câu hỏi khảo sát.';
  if (input.postType === 'TUTOR_CLASS_SHARE' && !input.linkedClassId) return 'Vui lòng chọn lớp đang tuyển sinh.';
  if (input.learningMode === 'OFFLINE' && input.postType !== 'TUTOR_ANNOUNCEMENT' && input.postType !== 'TUTOR_CLASS_SHARE' && !input.address?.trim()) return 'Vui lòng nhập địa chỉ học trực tiếp.';
  return null;
}
