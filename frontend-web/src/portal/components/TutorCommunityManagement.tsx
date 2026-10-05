import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  BookOpen,
  Calendar,
  Clock,
  Users,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Lock,
  MessageSquare,
  Heart,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Send,
  ArrowRight,
  ExternalLink,
  Layers,
  GraduationCap,
  Compass
} from 'lucide-react';
import communityApi from '../../api/community';
import { CreatePostModal } from '../../components/community/CreatePostModal';
import { ConvertPostToClassModal } from '../../components/community/ConvertPostToClassModal';
import { CommunityFeedPage } from '../../pages/community/CommunityFeedPage';

interface TutorCommunityManagementProps {
  onNavigate?: (pageId: string) => void;
}

export function TutorCommunityManagement({ onNavigate }: TutorCommunityManagementProps) {
  // Main Tabs: 'mine' (default) | 'explore'
  const [activeMainTab, setActiveMainTab] = useState<'mine' | 'explore'>('mine');

  // 'mine' tab state
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'CONVERTED'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [convertingPost, setConvertingPost] = useState<any | null>(null);

  // Expanded comments by post ID
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, any[]>>({});
  const [loadingCommentsPostId, setLoadingCommentsPostId] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<number | null>(null);

  // Action status message
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
    if (activeMainTab === 'mine') {
      loadMyPosts(true);
    }
  }, [activeMainTab, statusFilter]);

  // Quick statistics
  const stats = useMemo(() => {
    const total = posts.length;
    const openCount = posts.filter(p => p.status === 'OPEN').length;
    const convertedCount = posts.filter(p => p.status === 'CONVERTED').length;
    const totalVotes = posts.reduce((sum, p) => sum + (p.poll?.totalVotes || 0), 0);
    return { total, openCount, convertedCount, totalVotes };
  }, [posts]);

  // Filtered by keyword locally
  const filteredPosts = useMemo(() => {
    if (!searchKeyword.trim()) return posts;
    const kw = searchKeyword.toLowerCase();
    return posts.filter(p =>
      (p.title && p.title.toLowerCase().includes(kw)) ||
      (p.content && p.content.toLowerCase().includes(kw)) ||
      (p.subjectName && p.subjectName.toLowerCase().includes(kw))
    );
  }, [posts, searchKeyword]);

  // Handle Close Poll
  const handleClosePost = async (postId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn đóng khảo sát bài viết này? Sau khi đóng, học viên sẽ không thể bình chọn thêm.')) {
      return;
    }
    try {
      const updated = await communityApi.closePost(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'CLOSED', poll: updated.poll || p.poll } : p));
      showToast('success', 'Đã đóng bài khảo sát thành công.');
    } catch (err: any) {
      showToast('error', err.message || err.response?.data?.message || 'Không thể đóng bài viết');
    }
  };

  // Handle Delete Post (Soft delete)
  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này khỏi bảng tin?')) {
      return;
    }
    try {
      await communityApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showToast('success', 'Đã xóa bài viết thành công.');
    } catch (err: any) {
      showToast('error', err.message || err.response?.data?.message || 'Không thể xóa bài viết');
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

  // Handle Add Comment
  const handleAddComment = async (postId: number) => {
    const text = commentInputs[postId]?.trim();
    if (!text || submittingCommentPostId === postId) return;

    setSubmittingCommentPostId(postId);
    try {
      const created = await communityApi.addComment(postId, text);
      setCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), created]
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
      showToast('success', 'Đã gửi câu trả lời thành công.');
    } catch (err: any) {
      showToast('error', err.message || 'Không thể gửi bình luận');
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  // Handle Class Conversion Success
  const handleClassConverted = (result: any) => {
    setPosts(prev => prev.map(p => {
      if (p.id === result.postId) {
        return {
          ...p,
          status: 'CONVERTED',
          linkedClassId: result.classId,
          linkedClassName: result.className,
          linkedClassStatus: result.status,
          poll: p.poll ? { ...p.poll, isClosed: true } : p.poll
        };
      }
      return p;
    }));
    setConvertingPost(null);
    showToast('success', `Lớp học "${result.className}" đã được tạo thành công! Toàn bộ học viên đã vote sẽ nhận thông báo.`);
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
            <h1 className="text-xl md:text-2xl font-black text-brand-text">Bảng tin & Khảo sát Mở lớp</h1>
          </div>
          <p className="mt-1 text-xs md:text-sm text-brand-text-variant">
            Khảo sát nhu cầu học viên trước khi mở lớp, theo dõi bình chọn ca học và chuyển thành lớp học thực tế.
          </p>
        </div>

        {/* Action Button: Create Post */}
        <button
          type="button"
          onClick={() => {
            setEditingPost(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-md transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo bài khảo sát mới</span>
        </button>
      </div>

      {/* Navigation Switch Tabs */}
      <div className="flex items-center gap-2 border-b border-brand-border/20 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
            activeMainTab === 'mine'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-brand-text-variant hover:bg-brand-container/50 hover:text-brand-text'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bài đăng của tôi ({posts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('explore')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
            activeMainTab === 'explore'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-brand-text-variant hover:bg-brand-container/50 hover:text-brand-text'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Khám phá Bảng tin cộng đồng</span>
        </button>
      </div>

      {/* TAB 2: EXPLORE COMMUNITY FEED */}
      {activeMainTab === 'explore' && (
        <div className="pt-2">
          <CommunityFeedPage embedded={true} />
        </div>
      )}

      {/* TAB 1: MY POSTS (CORE TUTOR MANAGEMENT) */}
      {activeMainTab === 'mine' && (
        <div className="space-y-6">
          {/* Quick Statistics KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Tổng bài đăng</p>
                <h3 className="text-xl md:text-2xl font-black text-brand-text mt-0.5">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Đang mở khảo sát</p>
                <h3 className="text-xl md:text-2xl font-black text-emerald-600 mt-0.5">{stats.openCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Đã mở thành lớp</p>
                <h3 className="text-xl md:text-2xl font-black text-indigo-600 mt-0.5">{stats.convertedCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-brand-border/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-brand-text-variant uppercase tracking-wider">Tổng lượt vote ca học</p>
                <h3 className="text-xl md:text-2xl font-black text-purple-600 mt-0.5">{stats.totalVotes}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-brand-border/30 shadow-sm">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Tất cả trạng thái' },
                { id: 'OPEN', label: '🟢 Đang mở (OPEN)' },
                { id: 'CLOSED', label: '🔒 Đã đóng (CLOSED)' },
                { id: 'CONVERTED', label: '🎓 Đã tạo lớp (CONVERTED)' }
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
              <h3 className="text-base font-bold text-slate-800">Chưa có bài đăng khảo sát nào</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Hãy đăng bài khảo sát ca học để lắng nghe nhu cầu của học viên trước khi ấn định mở lớp học chính thức.
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
                <span>Tạo bài khảo sát đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredPosts.map(post => {
                const poll = post.poll;
                const options = poll?.options || [];
                const sortedOptions = [...options].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
                const topOptionId = sortedOptions[0]?.voteCount > 0 ? sortedOptions[0]?.id : null;
                const canConvert = poll && post.status !== 'CONVERTED';
                const isExpanded = expandedCommentsPostId === post.id;
                const comments = commentsMap[post.id] || [];

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Card Top: Badges, Status & Quick Action */}
                    <div className="p-6 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {post.subjectName && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                              <BookOpen className="w-3.5 h-3.5" />
                              Môn {post.subjectName}
                            </span>
                          )}
                          {post.educationLevel && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-bold">
                              <Layers className="w-3.5 h-3.5" />
                              {post.educationLevel}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                            {post.learningMode === 'ONLINE' ? (
                              <><Video className="w-3.5 h-3.5 text-blue-500" /> Trực tuyến (Online)</>
                            ) : (
                              <><MapPin className="w-3.5 h-3.5 text-rose-500" /> {post.address || 'Trực tiếp (Offline)'}</>
                            )}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {post.status === 'OPEN' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Đang mở khảo sát
                            </span>
                          )}
                          {post.status === 'CLOSED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                              <Lock className="w-3 h-3 text-amber-600" />
                              Đã đóng khảo sát
                            </span>
                          )}
                          {post.status === 'CONVERTED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                              Đã mở thành lớp
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="mt-3">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-base md:text-lg font-bold text-slate-900 hover:text-indigo-600 transition">
                            {post.title}
                          </h3>
                          {post.targetPricePerSession && (
                            <div className="text-right flex-shrink-0">
                              <span className="text-[10px] text-slate-400 block font-semibold">Học phí dự kiến</span>
                              <span className="text-sm md:text-base font-black text-emerald-600">
                                {formatPrice(post.targetPricePerSession)}/buổi
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-xs md:text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                          {post.content}
                        </p>
                      </div>

                      {/* Converted Success Banner */}
                      {post.status === 'CONVERTED' && (
                        <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>
                              Khảo sát này đã được chuyển đổi thành lớp học chính thức
                              {post.linkedClassName ? `: "${post.linkedClassName}"` : ''}.
                            </span>
                          </div>
                          {onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate('my-classes')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1 cursor-pointer flex-shrink-0"
                            >
                              <span>Xem lớp học</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Poll Results Section */}
                      {poll && (
                        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                          <div className="flex items-center justify-between mb-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">📊 {poll.question || 'Khảo sát ca học mong muốn'}</span>
                              {poll.isClosed && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                                  Đã khóa bình chọn
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-slate-500">
                              Tổng: <b className="text-indigo-600">{poll.totalVotes || 0}</b> lượt học viên vote
                              {poll.minVotesTarget ? ` (Mục tiêu: ${poll.minVotesTarget})` : ''}
                            </span>
                          </div>

                          {/* Options */}
                          <div className="space-y-2.5">
                            {options.map((opt: any) => {
                              const isTop = opt.id === topOptionId;
                              const percentage = poll.totalVotes > 0
                                ? Math.round(((opt.voteCount || 0) / poll.totalVotes) * 100)
                                : 0;

                              return (
                                <div
                                  key={opt.id}
                                  className={`relative overflow-hidden p-3 rounded-xl border transition ${
                                    isTop
                                      ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-400/30'
                                      : 'bg-white border-slate-200'
                                  }`}
                                >
                                  {/* Background Percentage Progress Bar */}
                                  <div
                                    className={`absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500 ${
                                      isTop ? 'bg-indigo-600' : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />

                                  <div className="relative z-10 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        {opt.optionLabel || `Thứ ${opt.dayOfWeek} (${opt.startTime} - ${opt.endTime})`}
                                      </span>
                                      {isTop && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-xs">
                                          ⭐ Nhiều vote nhất
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-700">{opt.voteCount || 0} phiếu</span>
                                      <span className="text-[11px] font-semibold text-slate-400">({percentage}%)</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Bottom: Metrics & Actions */}
                    <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Left: Metrics & View Comments Button */}
                      <div className="flex items-center gap-4 text-slate-500 font-semibold">
                        <span className="flex items-center gap-1" title="Lượt xem bài viết">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>{post.viewCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Lượt thích">
                          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                          <span>{post.likeCount || 0}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleComments(post.id)}
                          className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-bold transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{post.commentCount || 0} bình luận</span>
                          <span className="text-[10px] text-indigo-500 underline ml-0.5">
                            {isExpanded ? 'Ẩn' : 'Xem & Trả lời'}
                          </span>
                        </button>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2">
                        {/* Convert to Class Button */}
                        {canConvert && (
                          <button
                            type="button"
                            onClick={() => setConvertingPost(post)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs shadow-sm hover:shadow-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Mở lớp từ bài này</span>
                          </button>
                        )}

                        {/* Close Poll Button */}
                        {post.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => handleClosePost(post.id)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Khóa không cho nhận thêm vote"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Đóng khảo sát</span>
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPost(post);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                          title="Chỉnh sửa bài viết"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa bài viết"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Comments Section */}
                    {isExpanded && (
                      <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Trao đổi / Bình luận với học viên</span>
                          <span className="text-[11px] text-slate-400">{comments.length} phản hồi</span>
                        </div>

                        {/* Comments list */}
                        {loadingCommentsPostId === post.id ? (
                          <p className="text-xs text-slate-400 text-center py-2">Đang tải bình luận...</p>
                        ) : comments.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">Chưa có bình luận nào từ học viên.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {comments.map((c: any) => (
                              <div key={c.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{c.userName || 'Người dùng'}</span>
                                    {c.userRole === 'TUTOR' && (
                                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                                        Gia sư (Bạn)
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                                    {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">{c.commentText}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment Input */}
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
                            placeholder="Trả lời câu hỏi hoặc thông báo cho học viên..."
                            className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddComment(post.id)}
                            disabled={!commentInputs[post.id]?.trim() || submittingCommentPostId === post.id}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.max(0, prev - 1))}
                    disabled={page === 0}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs text-slate-500 font-bold px-2">
                    Trang {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPost(null);
        }}
        onPostCreated={savedPost => {
          if (editingPost) {
            setPosts(prev => prev.map(p => p.id === savedPost.id ? savedPost : p));
            showToast('success', 'Đã cập nhật bài viết thành công.');
          } else {
            setPosts(prev => [savedPost, ...prev]);
            showToast('success', 'Đã đăng bài khảo sát ca học mới thành công!');
          }
        }}
        userRole="TUTOR"
        editingPost={editingPost}
      />

      {/* Convert to Class Modal */}
      {convertingPost && (
        <ConvertPostToClassModal
          isOpen={Boolean(convertingPost)}
          onClose={() => setConvertingPost(null)}
          post={convertingPost}
          onConverted={handleClassConverted}
        />
      )}
    </div>
  );
}

export default TutorCommunityManagement;
