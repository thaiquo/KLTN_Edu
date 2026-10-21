import { api } from './client';

export type PostType = 'STUDENT_FIND_TUTOR' | 'STUDENT_GROUP_STUDY' | 'TUTOR_ANNOUNCEMENT' | 'TUTOR_POLL' | 'TUTOR_CLASS_SHARE';
export type ModerationStatus = 'NOT_CHECKED' | 'MODERATING' | 'ALLOWED' | 'NEEDS_EDIT' | 'REJECTED' | 'FAILED';
export type LearningMode = 'ONLINE' | 'OFFLINE';
export type CommunityTab = 'ALL' | 'FOLLOWING' | 'TUTOR_POLL' | 'STUDENT_FIND_TUTOR' | 'TUTOR_CLASS_SHARE' | 'TUTOR_ANNOUNCEMENT' | 'SAVED' | 'MINE';
export type Page<T> = { content: T[]; totalPages: number; totalElements: number; number?: number; last?: boolean };
export type CatalogSubject = { id: number; name: string; categoryName?: string; levels: Array<{ id: number; name: string }> };
export type LegacySubject = { id: number; name: string };
export type TutorRegistration = { id: number; status: string; subject?: { id: number; name: string } | null; proposedSubjectName?: string | null; levels?: Array<{ id: number; name: string }>; tuitionMin?: number | null };
export type ShareableClass = { id: number; name: string; status: string; startDate?: string | null; learningMode?: LearningMode; pricePerSession?: number; address?: string | null; level?: { name: string } | null; registration?: { subjectName?: string; educationLevelName?: string } | null; terminationCutoffSession?: number | null };
export type PollOption = { id: number; dayOfWeek: number; timePeriod?: string; startTime: string; endTime: string; optionLabel: string; voteCount: number; votePercentage?: number };
export type Poll = { id: number; question: string; minVotesTarget?: number; totalVotes: number; participantCount: number; sessionsPerWeek: number; durationMinutes: number; maxVotesPerUser: number; isClosed: boolean; expiresAt?: string | null; userVotedOptionIds?: number[]; userVotedOptionId?: number | null; options: PollOption[] };
export type Post = {
  id: number; publicShareId?: string; authorId: number; authorRole: string; authorName: string; authorAvatar?: string | null;
  postType: PostType; title: string; content: string; subjectId?: number | null; catalogSubjectId?: number | null;
  catalogLevelId?: number | null; subjectName?: string | null; levelName?: string | null; educationLevel?: string | null;
  learningMode?: LearningMode; targetPricePerSession?: number | null; address?: string | null;
  status: 'OPEN' | 'CLOSED' | 'HIDDEN' | 'CONVERTED'; moderationStatus: ModerationStatus; contentRevision: number;
  moderationReason?: string | null; pendingContentRevision?: number | null; pendingModerationStatus?: ModerationStatus | null;
  pendingModerationReason?: string | null; pendingContent?: PostInput | null; linkedClassId?: number | null;
  linkedClassName?: string | null; linkedClassStatus?: string | null; linkedClassAcceptingEnrollment?: boolean;
  likeCount?: number; commentCount?: number; viewCount?: number; isLiked?: boolean; isBookmarked?: boolean;
  isAuthorFollowed?: boolean; poll?: Poll | null; createdAt: string; updatedAt?: string;
};
export type PollInput = { question: string; minVotesTarget: number; sessionsPerWeek: number; durationMinutes: number; maxVotesPerUser: number; options: Array<{ dayOfWeek: number; startTime: string; endTime: string; optionLabel: string }> };
export type PostInput = { postType: PostType; title: string; content: string; subjectId: number | null; catalogSubjectId: number | null; catalogLevelId: number | null; educationLevel: string | null; learningMode: LearningMode; targetPricePerSession: number | null; address: string | null; linkedClassId: number | null; poll?: PollInput | null };
export type RewriteSuggestion = { postId: number; sourceRevision: number; pendingEdit: boolean; canRewrite: boolean; suggestedTitle?: string; suggestedContent?: string; summaryOfChanges?: string };
export type Comment = { id: number; userId: number; userRole: string; userName: string; commentText: string; createdAt: string };

const root = '/api/community';
export const communityApi = {
  feed: (params: { tab: CommunityTab; keyword?: string; page: number; size?: number }) => {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size ?? 10) });
    if (params.keyword?.trim() && params.tab !== 'SAVED' && params.tab !== 'MINE') query.set('keyword', params.keyword.trim());
    if (params.tab === 'FOLLOWING') query.set('followingOnly', 'true');
    else if (!['ALL', 'SAVED', 'MINE'].includes(params.tab)) query.set('postType', params.tab);
    const path = params.tab === 'SAVED' ? 'posts/bookmarked' : params.tab === 'MINE' ? 'posts/mine' : 'posts';
    return api.request<Page<Post>>(`${root}/${path}?${query}`);
  },
  detail: (id: number) => api.request<Post>(`${root}/posts/${id}`),
  shared: (shareId: string) => api.request<Post>(`${root}/posts/shared/${encodeURIComponent(shareId)}`),
  create: (body: PostInput, key: string) => api.request<Post>(`${root}/posts`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }),
  update: (id: number, body: PostInput, revision: number) => api.request<Post>(`${root}/posts/${id}?expectedContentRevision=${revision}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: number) => api.request<void>(`${root}/posts/${id}`, { method: 'DELETE' }),
  close: (id: number) => api.request<Post>(`${root}/posts/${id}/close`, { method: 'PATCH' }),
  retry: (id: number) => api.request<Post>(`${root}/posts/${id}/moderation/retry`, { method: 'POST' }),
  rewrite: (id: number, contentRevision: number) => api.request<RewriteSuggestion>(`${root}/posts/${id}/ai-rewrite`, { method: 'POST', body: JSON.stringify({ contentRevision }), timeoutMs: 45000 }),
  vote: (pollId: number, optionIds: number[]) => api.request<Poll>(`${root}/polls/${pollId}/votes`, { method: 'PUT', body: JSON.stringify({ optionIds }) }),
  like: (id: number) => api.request<boolean>(`${root}/posts/${id}/reactions`, { method: 'POST' }),
  bookmark: (id: number) => api.request<boolean>(`${root}/posts/${id}/bookmarks`, { method: 'POST' }),
  comments: (id: number, page = 0) => api.request<Page<Comment>>(`${root}/posts/${id}/comments?page=${page}&size=20`),
  comment: (id: number, commentText: string) => api.request<Comment>(`${root}/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ commentText }) }),
  follow: (userId: number) => api.request(`${root}/tutors/${userId}/follow`, { method: 'PUT' }),
  unfollow: (userId: number) => api.request(`${root}/tutors/${userId}/follow`, { method: 'DELETE' }),
  catalog: () => api.request<{ subjects: CatalogSubject[] }>('/api/learning/teaching-catalog/community-options', { anonymous: true }),
  legacySubjects: () => api.request<LegacySubject[]>('/api/learning/subjects?limit=50', { anonymous: true }),
  registrations: () => api.request<TutorRegistration[]>('/api/learning/tutor/subject-registrations'),
  classes: () => api.request<ShareableClass[]>('/api/learning/tutor/classes'),
};
