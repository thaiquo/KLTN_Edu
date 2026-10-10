import { apiRequest } from './client';

export const communityApi = {
  // Posts
  getPosts: ({ postType, status, subjectId, learningMode, keyword, followingOnly, page = 0, size = 10 } = {}) => {
    const params = new URLSearchParams();
    if (postType && postType !== 'ALL') params.set('postType', postType);
    if (status) params.set('status', status);
    if (subjectId) params.set('subjectId', String(subjectId));
    if (learningMode) params.set('learningMode', learningMode);
    if (keyword) params.set('keyword', keyword);
    if (followingOnly) params.set('followingOnly', 'true');
    params.set('page', String(page));
    params.set('size', String(size));
    const query = params.toString();

    return apiRequest(`/api/community/posts${query ? `?${query}` : ''}`);
  },

  getPostDetail: (id) => apiRequest(`/api/community/posts/${id}`),

  /**
   * @param {{ status?: string, page?: number, size?: number }} [params]
   */
  getMyPosts: ({ status, page = 0, size = 10 } = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status && status !== 'ALL') params.set('status', status);
    return apiRequest(`/api/community/posts/mine?${params.toString()}`);
  },

  getBookmarkedPosts: ({ page = 0, size = 10 } = {}) => {
    return apiRequest(`/api/community/posts/bookmarked?page=${page}&size=${size}`);
  },

  createPost: (data) => apiRequest('/api/community/posts', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updatePost: (id, data) => apiRequest(`/api/community/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  deletePost: (id) => apiRequest(`/api/community/posts/${id}`, {
    method: 'DELETE'
  }),

  closePost: (id) => apiRequest(`/api/community/posts/${id}/close`, {
    method: 'PATCH'
  }),

  // Polls & Votes
  votePoll: (pollId, optionId) => apiRequest(`/api/community/polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId })
  }),

  updatePollVotes: (pollId, optionIds) => apiRequest(`/api/community/polls/${pollId}/votes`, {
    method: 'PUT',
    body: JSON.stringify({ optionIds })
  }),

  unvotePoll: (pollId) => apiRequest(`/api/community/polls/${pollId}/vote`, {
    method: 'DELETE'
  }),

  // Reactions & Comments
  getPostLikes: (postId) => apiRequest(`/api/community/posts/${postId}/likes`),

  toggleReaction: (postId, { userName, userAvatar } = {}) => {
    const params = new URLSearchParams();
    if (userName) params.set('userName', userName);
    if (userAvatar) params.set('userAvatar', userAvatar);
    const query = params.toString();
    return apiRequest(`/api/community/posts/${postId}/reactions${query ? `?${query}` : ''}`, {
      method: 'POST'
    });
  },

  toggleBookmark: (postId) => apiRequest(`/api/community/posts/${postId}/bookmarks`, {
    method: 'POST'
  }),

  getComments: (postId, { page = 0, size = 20 } = {}) => {
    return apiRequest(`/api/community/posts/${postId}/comments?page=${page}&size=${size}`);
  },

  addComment: (postId, payload) => {
    const body = typeof payload === 'string' ? { commentText: payload } : payload;
    return apiRequest(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // Smart Class Conversion
  getClassSuggestion: (postId) => apiRequest(`/api/community/posts/${postId}/class-suggestion`),

  convertPostToClass: (postId, data) => apiRequest(`/api/community/posts/${postId}/convert-to-class`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Tutor Follow System
  followTutor: (tutorUserId) => apiRequest(`/api/community/tutors/${tutorUserId}/follow`, {
    method: 'PUT'
  }),

  unfollowTutor: (tutorUserId) => apiRequest(`/api/community/tutors/${tutorUserId}/follow`, {
    method: 'DELETE'
  }),

  getTutorFollowStatus: (tutorUserId) => apiRequest(`/api/community/tutors/${tutorUserId}/follow-status`),

  getFollowingTutors: () => apiRequest('/api/community/following-tutors'),

  getTutorFollowers: (tutorUserId, { page = 0, size = 20 } = {}) => {
    return apiRequest(`/api/community/tutors/${tutorUserId}/followers?page=${page}&size=${size}`);
  },
};

export default communityApi;
