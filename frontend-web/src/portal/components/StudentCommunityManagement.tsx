import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass,
  Layers,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit3,
  Lock,
  MessageCircle,
  Eye,
  Heart,
  Sparkles,
  Users,
  Target,
  BookOpen,
  MapPin,
  Video,
  Clock,
  Send,
  Reply,
  X
} from 'lucide-react';
import communityApi from '../../api/community';
import { useFeedback } from '../../components/feedback/useFeedback';
import { CreatePostModal } from '../../components/community/CreatePostModal';
import { CommunityFeedPage } from '../../pages/community/CommunityFeedPage';

interface StudentCommunityManagementProps {
  onNavigate?: (pageId: string) => void;
  initialTab?: 'explore' | 'mine';
  hideExploreTab?: boolean;
}

export function StudentCommunityManagement({
  onNavigate,
  initialTab = 'explore',
  hideExploreTab = false
}: StudentCommunityManagementProps) {
  // Main Tabs: 'explore' | 'mine' | 'following'
  const [activeMainTab, setActiveMainTab] = useState<'explore' | 'mine' | 'following'>(initialTab as any);
  const feedback = useFeedback();

  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab as any);
    }
  }, [initialTab]);

  // Following tutors state
  const [followingTutors, setFollowingTutors] = useState<any[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const loadFollowingTutors = useCallback(async () => {
    setFollowingLoading(true);
    try {
      const res = await communityApi.getFollowingTutors();
      setFollowingTutors(res || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách gia sư theo dõi:', err);
    } finally {
      setFollowingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowingTutors();
  }, [loadFollowingTutors]);

  const handleUnfollow = async (tutorUserId: number) => {
    try {
      await communityApi.unfollowTutor(tutorUserId);
      setFollowingTutors(prev => prev.filter(f => f.tutorUserId !== tutorUserId));
      feedback.success('Đã hủy theo dõi gia sư.');
    } catch (err: any) {
      feedback.error(err.message || 'Không thể hủy theo dõi gia sư.');
    }
  };

  // 'mine' tab state
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);

  // Expanded comments
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, any[]>>({});
  const [loadingCommentsPostId, setLoadingCommentsPostId] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [replyingToMap, setReplyingToMap] = useState<Record<number, any>>({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<number | null>(null);

  // Action toast status message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadMyPosts = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    try {
      const targetPage = resetPage ? 0 : page;
      const res = await communityApi.getMyPosts({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: targetPage,
        size: 10
      });
      setPosts(res.content || []);
      setTotalPages(res.totalPages || 1);
      if (resetPage) setPage(0);
    } catch (err: any) {
      console.error('Lỗi khi tải bài đăng của tôi:', err);
      setError('Không thể tải danh sách bài viết của bạn. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    loadMyPosts(true);
  }, [statusFilter]);

  useEffect(() => {
    const handleRealtimeCommunityEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const postId = Number(detail?.payload?.postId ?? detail?.entityId);
      if (!postId) return;

      if (detail?.type === 'COMMUNITY_POST_DELETED') {
        setPosts(current => current.filter(post => Number(post.id) !== postId));
      } else if (detail?.type === 'COMMUNITY_POST_UPDATED') {
        setPosts(current => current.map(post => Number(post.id) === postId
          ? {
              ...post,
              status: detail.payload?.status || post.status,
              likeCount: detail.payload?.likeCount ?? post.likeCount,
              commentCount: detail.payload?.commentCount ?? post.commentCount,
              viewCount: detail.payload?.viewCount ?? post.viewCount,
              poll: detail.payload?.poll || post.poll
            }
          : post));
      }
    };

    window.addEventListener('realtime:event', handleRealtimeCommunityEvent);
    return () => window.removeEventListener('realtime:event', handleRealtimeCommunityEvent);
  }, []);

  // KPI Quick Statistics
  const stats = useMemo(() => {
    const total = posts.length;
    const openCount = posts.filter(p => p.status === 'OPEN').length;
    const closedCount = posts.filter(p => p.status === 'CLOSED').length;
    const totalComments = posts.reduce((sum, p) => sum + (p.commentCount || 0), 0);
    return { total, openCount, closedCount, totalComments };
  }, [posts]);

  // Locally filtered by keyword
  const filteredPosts = useMemo(() => {
    if (!searchKeyword.trim()) return posts;
    const kw = searchKeyword.toLowerCase();
    return posts.filter(p =>
      (p.title && p.title.toLowerCase().includes(kw)) ||
      (p.content && p.content.toLowerCase().includes(kw)) ||
      (p.subjectName && p.subjectName.toLowerCase().includes(kw))
    );
  }, [posts, searchKeyword]);

  // Handle Close Post (When student found a tutor or study group)
  const handleClosePost = async (postId: number) => {
    const confirmed = await feedback.confirm({
      title: 'Xác nhận đóng bài đăng',
      message: 'Bạn có chắc chắn muốn đóng bài đăng này? Sau khi đóng, bài viết sẽ được đánh dấu đã hoàn thành tìm kiếm.',
      confirmText: 'Đóng bài đăng',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    try {
      await communityApi.closePost(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'CLOSED' } : p));
      feedback.success('Đã đóng bài viết thành công.');
    } catch (err: any) {
      feedback.error(err.message || 'Không thể đóng bài viết');
    }
  };

  // Handle Delete Post
  const handleDeletePost = async (postId: number) => {
    const confirmed = await feedback.confirm({
      title: 'Xác nhận xóa bài đăng',
      message: 'Bạn có chắc chắn muốn xóa bài viết này khỏi hệ thống? Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa bài đăng',
      cancelText: 'Hủy',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await communityApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      feedback.success('Đã xóa bài viết thành công.');
    } catch (err: any) {
      feedback.error(err.message || 'Không thể xóa bài viết');
    }
  };

  // Handle Toggle Comments
  const handleToggleComments = async (postId: number) => {
    if (expandedCommentsPostId === postId) {
      setExpandedCommentsPostId(null);
      return;
    }
    setExpandedCommentsPostId(postId);
    if (!commentsMap[postId]) {
      setLoadingCommentsPostId(postId);
      try {
        const res = await communityApi.getComments(postId, { page: 0, size: 20 });
        setCommentsMap(prev => ({ ...prev, [postId]: res.content || [] }));
      } catch (err) {
        console.error('Lỗi khi tải bình luận:', err);
      } finally {
        setLoadingCommentsPostId(null);
      }
    }
  };

  const handleReplyTo = (postId: number, comment: any) => {
    setReplyingToMap(prev => ({ ...prev, [postId]: comment }));
    const targetName = comment.userName || 'thành viên';
    const mention = `@${targetName} `;
    setCommentInputs(prev => {
      const current = prev[postId] || '';
      return current.includes(`@${targetName}`) ? prev : { ...prev, [postId]: `${mention}${current}`.trim() + ' ' };
    });
  };

  const handleCancelReply = (postId: number) => {
    setReplyingToMap(prev => {
      const copy = { ...prev };
      delete copy[postId];
      return copy;
    });
  };

  // Handle Add Comment
  const handleAddComment = async (postId: number) => {
    const text = commentInputs[postId]?.trim();
    if (!text || submittingCommentPostId === postId) return;

    setSubmittingCommentPostId(postId);
    try {
      const created = await communityApi.addComment(postId, {
        commentText: text,
        replyToUserId: replyingToMap[postId]?.userId,
        replyToUserRole: replyingToMap[postId]?.userRole,
        replyToUserName: replyingToMap[postId]?.userName
      });
      setCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), created]
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      handleCancelReply(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
      showToast('success', 'Đã gửi phản hồi thành công.');
    } catch (err: any) {
      showToast('error', err.message || 'Không thể gửi bình luận');
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  const formatPrice = (price: number) => {
    if (!price) return null;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-8 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header & Dual Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-black text-brand-text">Bảng tin & Kết nối Cộng đồng</h1>
          </div>
          <p className="text-xs text-brand-text-variant mt-1">
            Khám phá bài đăng của gia sư, tham gia khảo sát mở lớp hoặc quản lý các bài tìm gia sư của bạn.
          </p>
        </div>

        {/* Action Button: Create Student Post */}
        <button
          type="button"
          onClick={() => {
            setEditingPost(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-md transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>+ Đăng bài kết nối</span>
        </button>
      </div>

      {/* Navigation Switch Tabs (Segmented Control) */}
      {!hideExploreTab && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setActiveMainTab('explore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
              activeMainTab === 'explore'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. Khám phá Bảng tin (Cộng đồng)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('mine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
              activeMainTab === 'mine'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Quản lý bài đăng của tôi</span>
            {posts.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === 'mine' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {posts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('following')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
              activeMainTab === 'following'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>3. Gia sư đang theo dõi</span>
            {followingTutors.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeMainTab === 'following' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {followingTutors.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: EXPLORE COMMUNITY FEED (Public posts of other users & tutors) */}
      {activeMainTab === 'explore' && (
        <div className="pt-2">
          <CommunityFeedPage
            embedded={true}
            hideSecondaryHeader={true}
            hideMineTab={true}
            exploreMode={true}
          />
        </div>
      )}

      {/* TAB 2: MY POSTS (Student's own posts: Find Tutor, Study Groups) */}
      {activeMainTab === 'mine' && (
        <div className="space-y-6">
          {/* Quick Statistics KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Tổng bài đã đăng</p>
                <h3 className="text-xl md:text-2xl font-black text-brand-text mt-0.5">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Đang tìm kiếm</p>
                <h3 className="text-xl md:text-2xl font-black text-emerald-600 mt-0.5">{stats.openCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Đã đóng / Hoàn thành</p>
                <h3 className="text-xl md:text-2xl font-black text-slate-600 mt-0.5">{stats.closedCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Bình luận nhận được</p>
                <h3 className="text-xl md:text-2xl font-black text-purple-600 mt-0.5">{stats.totalComments}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <MessageCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Tất cả trạng thái' },
                { id: 'OPEN', label: '🟢 Đang tìm kiếm (OPEN)' },
                { id: 'CLOSED', label: '🔒 Đã đóng (CLOSED)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Keyword Search & Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  placeholder="Tìm theo tiêu đề, môn..."
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-44 md:w-60"
                />
              </div>

              <button
                type="button"
                onClick={() => loadMyPosts(false)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                title="Tải lại danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-brand-border/30">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3" />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách bài viết của bạn...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 text-rose-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
              <p className="text-sm font-bold">{error}</p>
              <button
                type="button"
                onClick={() => loadMyPosts(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-brand-border/30 shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 font-bold">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Chưa có bài đăng nào</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Hãy đăng bài tìm gia sư để kết nối với các gia sư phù hợp trên EduConnect.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingPost(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Đăng bài kết nối</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredPosts.map(post => {
                const isFindTutor = post.postType === 'STUDENT_FIND_TUTOR' || post.postType === 'STUDENT_GROUP_STUDY';
                const isExpanded = expandedCommentsPostId === post.id;
                const comments = commentsMap[post.id] || [];

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Post Card Header */}
                    <div className="p-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isFindTutor && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Target className="w-3.5 h-3.5" />
                              Tìm gia sư
                            </span>
                          )}

                          {post.status === 'OPEN' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 Đang tìm kiếm
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              🔒 Đã đóng
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400">
                            {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base md:text-lg leading-snug">
                          {post.title}
                        </h3>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {post.status === 'OPEN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPost(post);
                                setIsCreateModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                              title="Chỉnh sửa bài viết"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleClosePost(post.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition cursor-pointer"
                              title="Đóng bài đăng (khi đã tìm được)"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Đóng bài</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Xóa bài viết"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Post Card Content Body */}
                    <div className="p-5 space-y-4">
                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {post.subjectName && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                            <BookOpen className="w-3.5 h-3.5" />
                            {post.subjectName}
                          </span>
                        )}
                        {post.educationLevel && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                            {post.educationLevel}
                          </span>
                        )}
                        {post.learningMode === 'ONLINE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                            <Video className="w-3.5 h-3.5" />
                            Online (Trực tuyến)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                            <MapPin className="w-3.5 h-3.5" />
                            Offline ({post.address || 'Trực tiếp'})
                          </span>
                        )}
                        {post.targetPricePerSession && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                            💰 Ngân sách: {formatPrice(post.targetPricePerSession)}/buổi
                          </span>
                        )}
                      </div>

                      {/* Content Description */}
                      <p className="text-slate-700 text-xs md:text-sm leading-relaxed whitespace-pre-line">
                        {post.content}
                      </p>
                    </div>

                    {/* Post Footer Stats & Comment Toggle */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-rose-600 font-bold">
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                          <span>{post.likeCount || 0} thích</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Eye className="w-4 h-4" />
                          <span>{post.viewCount || 0} lượt xem</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleComments(post.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                          isExpanded
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{isExpanded ? 'Ẩn bình luận' : `Bình luận (${post.commentCount || 0})`}</span>
                      </button>
                    </div>

                    {/* Expanded Comments Section */}
                    {isExpanded && (
                      <div className="p-5 bg-slate-50/70 border-t border-slate-100 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Trao đổi & Liên hệ từ Gia sư / Bạn học
                        </h4>

                        {loadingCommentsPostId === post.id ? (
                          <div className="py-4 text-center text-xs text-slate-400">Đang tải bình luận...</div>
                        ) : comments.length === 0 ? (
                          <p className="py-3 text-xs text-slate-500 text-center italic">
                            Chưa có bình luận nào trên bài viết này.
                          </p>
                        ) : (
                          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                            {comments.map(c => {
                              const isTutor = c.userRole === 'TUTOR';
                              const isStudent = c.userRole === 'STUDENT';
                              const renderCommentText = (text: string) => {
                                if (!text) return null;
                                return text.split(/(@[^\s]+)/g).map((part, index) => (
                                  part.startsWith('@')
                                    ? <span key={index} className="font-bold text-indigo-600 bg-indigo-50/80 px-1 py-0.5 rounded">{part}</span>
                                    : part
                                ));
                              };

                              return (
                                <div key={c.id} className="flex items-start gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {c.userName ? c.userName.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-900 text-xs">{c.userName || 'Ẩn danh'}</span>
                                        {isTutor && (
                                          <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            Gia sư
                                          </span>
                                        )}
                                        {isStudent && (
                                          <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                            Học viên
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed break-words">{renderCommentText(c.commentText)}</p>
                                    <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-slate-50">
                                      <button
                                        type="button"
                                        onClick={() => handleReplyTo(post.id, c)}
                                        className="font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer text-[11px]"
                                      >
                                        <Reply className="w-3 h-3" />
                                        <span>Trả lời</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {replyingToMap[post.id] && (
                          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700">
                            <span>
                              Đang trả lời <strong className="font-bold">@{replyingToMap[post.id].userName || 'thành viên'}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelReply(post.id)}
                              className="p-1 rounded-lg hover:bg-indigo-100 transition"
                              aria-label="Hủy trả lời"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Comment Input */}
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddComment(post.id);
                              }
                            }}
                            placeholder={replyingToMap[post.id] ? `Trả lời @${replyingToMap[post.id].userName || 'thành viên'}...` : "Gửi phản hồi hoặc trao đổi thêm..."}
                            className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddComment(post.id)}
                            disabled={!commentInputs[post.id]?.trim() || submittingCommentPostId === post.id}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Gửi</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FOLLOWING TUTORS */}
      {activeMainTab === 'following' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Danh sách Gia sư bạn đang quan tâm & theo dõi</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Các bài viết, khảo sát mở lớp của các gia sư này sẽ luôn được ưu tiên hiển thị trên Bảng tin của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={loadFollowingTutors}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${followingLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {followingLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Đang tải danh sách gia sư theo dõi...</p>
            </div>
          ) : followingTutors.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base mb-1">
                Bạn chưa theo dõi gia sư nào
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Hãy khám phá Marketplace Gia sư để tìm và theo dõi các gia sư phù hợp với nhu cầu học tập của bạn!
              </p>
              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('tutors') : window.location.assign('/tutors')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition cursor-pointer"
              >
                Khám phá Marketplace Gia sư
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {followingTutors.map((item) => (
                <div
                  key={item.tutorUserId}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                        G
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm hover:text-indigo-600">
                          Gia sư #{item.tutorUserId}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Đã theo dõi: {new Date(item.followedAt).toLocaleDateString('vi-VN')}</span>
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ⭐ Đang theo dõi
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('explore')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem bài viết
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnfollow(item.tutorUserId)}
                      className="text-xs font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50"
                    >
                      Bỏ theo dõi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Tạo/Sửa bài viết dành cho Học viên */}
      {isCreateModalOpen && (
        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPost(null);
          }}
          onPostCreated={() => {
            setIsCreateModalOpen(false);
            setEditingPost(null);
            loadMyPosts(true);
            showToast('success', editingPost ? 'Đã cập nhật bài viết thành công.' : 'Đã đăng bài viết kết nối thành công!');
          }}
          userRole="STUDENT"
          editingPost={editingPost}
        />
      )}
    </div>
  );
}

export default StudentCommunityManagement;
