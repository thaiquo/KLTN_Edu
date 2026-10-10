import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  Filter, 
  Flame, 
  Users, 
  BookOpen, 
  MessageSquare, 
  CheckCircle2, 
  Compass, 
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Bookmark,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import communityApi from '../../api/community';
import PostCard from '../../components/community/PostCard';
import CreatePostModal from '../../components/community/CreatePostModal';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeFooter } from '../../components/home/HomeFooter';
import { useFeedback } from '../../components/feedback/useFeedback';
import { extractCommunityPostId } from '../../utils/shareLinks';

const StudentCommunityManagement = React.lazy(() =>
  import('../../portal/components/StudentCommunityManagement').then(m => ({ default: m.StudentCommunityManagement }))
);
const TutorCommunityManagement = React.lazy(() =>
  import('../../portal/components/TutorCommunityManagement').then(m => ({ default: m.TutorCommunityManagement }))
);

export function CommunityFeedPage({
  embedded = false,
  hideSecondaryHeader = false,
  hideMineTab = false,
  exploreMode = false
}) {
  const { user, authenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('tab') === 'mine' ? 'mine' : 'explore';
  });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const requireAuth = useCallback(() => {
    navigate('/login', { state: { from: location } });
  }, [location, navigate]);

  const openCreateModal = useCallback(() => {
    if (!authenticated) {
      requireAuth();
      return;
    }
    setIsCreateModalOpen(true);
  }, [authenticated, requireAuth]);

  const loadPosts = useCallback(async (resetPage = false, overrideKeyword = undefined) => {
    setLoading(true);
    setError(null);
    try {
      const targetPage = resetPage ? 0 : page;
      const kw = overrideKeyword !== undefined ? overrideKeyword : searchKeyword;
      const params = {
        page: targetPage,
        size: 10,
        keyword: kw.trim() || undefined,
        postType: !['ALL', 'SAVED'].includes(activeTab) ? activeTab : undefined
      };
      const res = activeTab === 'SAVED'
        ? await communityApi.getBookmarkedPosts({ page: targetPage, size: 10 })
        : activeTab === 'MINE'
        ? await communityApi.getMyPosts({ page: targetPage, size: 10 })
        : await communityApi.getPosts(params);
      setPosts(res.content || []);
      setTotalPages(res.totalPages || 1);
      if (resetPage) setPage(0);
    } catch (err) {
      console.error('Lỗi khi tải bài viết:', err);
      setError('Không thể tải danh sách bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchKeyword, page]);

  const feedback = useFeedback();
  const [deepLinkedPostId, setDeepLinkedPostId] = useState(null);
  const [checkedDeepLinkPostId, setCheckedDeepLinkPostId] = useState(null);

  const targetPostId = React.useMemo(
    () => extractCommunityPostId(location),
    [location.search, location.hash]
  );

  useEffect(() => {
    if (!authenticated && ['SAVED', 'MINE'].includes(activeTab)) {
      setActiveTab('ALL');
    }
  }, [authenticated, activeTab]);

  useEffect(() => {
    loadPosts(true);
  }, [activeTab]);

  useEffect(() => {
    if (!targetPostId) return;

    if (mainTab !== 'explore') {
      setMainTab('explore');
    }

    const postInList = posts.find(p => String(p.id) === String(targetPostId));
    if (postInList) {
      setDeepLinkedPostId(targetPostId);
      const timer = setTimeout(() => {
        document.getElementById(`post-${targetPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(timer);
    }

    if (checkedDeepLinkPostId !== targetPostId) {
      setCheckedDeepLinkPostId(targetPostId);
      communityApi.getPostDetail(targetPostId)
        .then((detail) => {
          if (detail && detail.id) {
            setPosts(prev => [detail, ...prev.filter(p => String(p.id) !== String(targetPostId))]);
            setDeepLinkedPostId(targetPostId);
            setTimeout(() => {
              document.getElementById(`post-${targetPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
          }
        })
        .catch((err) => {
          console.warn('Lỗi lấy bài viết chia sẻ:', err);
          feedback.warning('Bài viết này không tồn tại hoặc đã bị xóa khỏi bảng tin cộng đồng.');
        });
    }
  }, [targetPostId, posts, mainTab, checkedDeepLinkPostId]);

  useEffect(() => {
    if (!deepLinkedPostId) return;
    const timer = setTimeout(() => {
      setDeepLinkedPostId(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [deepLinkedPostId]);

  useEffect(() => {
    if (!posts.length || !window.location.hash || targetPostId) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [posts, targetPostId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadPosts(true);
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const handleBookmarkToggle = (postId, isBookmarked) => {
    if (activeTab === 'SAVED' && !isBookmarked) {
      setPosts(prev => prev.filter(post => post.id !== postId));
    }
  };

  const handleLikeToggle = (postId, isLiked) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      isLiked,
      likeCount: isLiked ? (p.likeCount || 0) + 1 : Math.max(0, (p.likeCount || 0) - 1)
    } : p));
  };

  const handleCommentAdded = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      commentCount: (p.commentCount || 0) + 1
    } : p));
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleVoteSuccess = (postId, updatedPoll) => {
    setPosts(prev => prev.map(post => post.id === postId
      ? { ...post, poll: updatedPoll }
      : post));
  };

  return (
    <div className={`${embedded ? 'w-full' : 'min-h-screen'} bg-slate-50 flex flex-col font-sans`}>
      {!embedded && <HomeHeader />}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto ${embedded ? 'max-w-none py-1' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'}`}>
        
        {/* Modern Clean Header (Bỏ banner màu tím, giao diện sáng sủa trang nhã) */}
        {!embedded && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-xs font-bold text-indigo-700 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Bảng tin Kết nối & Khảo sát Học tập</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Cộng đồng Học tập & Kết nối
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Khảo sát khung giờ học để gom lớp hiệu quả. Học viên dễ dàng tìm gia sư phù hợp hoặc lập nhóm học chung để chia sẻ học phí.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Đăng bài kết nối</span>
                </button>

                <Link
                  to="/classes"
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center gap-2"
                >
                  <Compass className="w-4 h-4 text-slate-500" />
                  <span>Khám phá các lớp đã mở</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Switch Tabs (Segmented Control - Đồng bộ 2 option giống bên Gia sư) */}
        {!embedded && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 w-fit mb-6">
            <button
              type="button"
              onClick={() => setMainTab('explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
                mainTab === 'explore'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>1. Khám phá Bảng tin (Cộng đồng)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!authenticated) {
                  requireAuth();
                  return;
                }
                setMainTab('mine');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
                mainTab === 'mine'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Quản lý bài đăng của tôi</span>
            </button>
          </div>
        )}

        {/* Tab 2: Quản lý bài đăng của tôi */}
        {!embedded && mainTab === 'mine' && (
          <React.Suspense fallback={<div className="p-12 text-center text-slate-500 font-semibold">Đang tải quản lý bài đăng...</div>}>
            {user?.role === 'TUTOR' ? (
              <TutorCommunityManagement initialTab="mine" hideExploreTab={true} />
            ) : (
              <StudentCommunityManagement initialTab="mine" hideExploreTab={true} />
            )}
          </React.Suspense>
        )}

        {/* Tab 1: Khám phá Bảng tin */}
        {(embedded || mainTab === 'explore') && (
          <>
        {embedded && !hideSecondaryHeader && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-950">Bảng tin cộng đồng</h1>
              <p className="mt-1 text-sm text-slate-500">Khảo sát nhu cầu học và kết nối với học viên.</p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Tạo bài viết
            </button>
          </div>
        )}

        {/* Tab Filter Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Tất cả bài viết</span>
            </button>
            <button
              onClick={() => setActiveTab('TUTOR_ANNOUNCEMENT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TUTOR_ANNOUNCEMENT'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📢 Gia sư chia sẻ</span>
            </button>
            <button
              onClick={() => setActiveTab('TUTOR_POLL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TUTOR_POLL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📊 Gia sư khảo sát</span>
            </button>
            <button
              onClick={() => setActiveTab('TUTOR_CLASS_SHARE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TUTOR_CLASS_SHARE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🎓 Lớp đang tuyển</span>
            </button>
            <button
              onClick={() => setActiveTab('STUDENT_FIND_TUTOR')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'STUDENT_FIND_TUTOR'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🎯 Học viên tìm gia sư</span>
            </button>
            <button
              onClick={() => setActiveTab('STUDENT_GROUP_STUDY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'STUDENT_GROUP_STUDY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Tìm bạn học nhóm</span>
            </button>
            {authenticated && !hideMineTab && (
              <button
                onClick={() => setMainTab('mine')}
                className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:bg-slate-100"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Quản lý bài đăng của tôi</span>
              </button>
            )}
            {authenticated && (
              <button
                onClick={() => setActiveTab('SAVED')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'SAVED'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Bài viết đã lưu</span>
              </button>
            )}
          </div>

          <button
            onClick={() => loadPosts(false)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
            title="Làm mới bài viết"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Content Layout: Clean Streamlined Feed */}
        <div className="max-w-4xl mx-auto space-y-4">
          
          {/* Search Bar duy nhất: Tìm kiếm từ khóa môn học, lớp, yêu cầu... */}
          <form onSubmit={handleSearchSubmit} className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="Tìm kiếm bài viết (Môn học, lớp học, chủ đề, gia sư, học viên...)"
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400 font-medium"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    loadPosts(true, '');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
                  title="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-sm cursor-pointer flex items-center gap-1.5 flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Tìm kiếm</span>
            </button>
          </form>

          {/* Post Stream */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Đang tải các bài viết mới nhất...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center text-rose-600 text-xs">
              <p>{error}</p>
              <button
                onClick={() => loadPosts(true)}
                className="mt-3 px-4 py-1.5 bg-rose-50 text-rose-700 rounded-xl font-bold hover:bg-rose-100 transition cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                {exploreMode ? <Compass className="w-7 h-7" /> : <BookOpen className="w-7 h-7" />}
              </div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base mb-1">
                {exploreMode ? 'Không tìm thấy bài viết cộng đồng nào' : 'Chưa có bài viết nào phù hợp'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                {exploreMode
                  ? 'Hiện không có bài viết nào trong cộng đồng phù hợp với tiêu chí lọc của bạn. Bạn có thể thử đổi bộ lọc hoặc từ khóa.'
                  : 'Hãy là người đầu tiên đăng bài khảo sát hoặc tìm kiếm trên EduConnect!'}
              </p>
              {exploreMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ALL');
                    setSearchKeyword('');
                    loadPosts(true, '');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  Đặt lại tìm kiếm
                </button>
              ) : (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  Tạo bài viết ngay
                </button>
              )}
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                userRole={user?.activeRole}
                authenticated={authenticated}
                onRequireAuth={requireAuth}
                onBookmarkToggle={handleBookmarkToggle}
                onLikeToggle={handleLikeToggle}
                onCommentAdded={handleCommentAdded}
                onPostDeleted={handlePostDeleted}
                onVoteSuccess={handleVoteSuccess}
                isHighlighted={String(post.id) === String(deepLinkedPostId)}
              />
            ))
          )}
        </div>
        </>
        )}
      </main>

      {!embedded && <HomeFooter />}

      {/* Modal tạo bài viết */}
      {authenticated && (
        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onPostCreated={handlePostCreated}
          userRole={user?.activeRole}
        />
      )}
    </div>
  );
}

export default CommunityFeedPage;
