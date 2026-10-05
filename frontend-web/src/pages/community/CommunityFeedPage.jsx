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
  Bookmark
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import communityApi from '../../api/community';
import { subjectApi } from '../../api/subjects';
import PostCard from '../../components/community/PostCard';
import CreatePostModal from '../../components/community/CreatePostModal';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeFooter } from '../../components/home/HomeFooter';

export function CommunityFeedPage({ embedded = false }) {
  const { user, authenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'TUTOR_POLL', 'STUDENT_FIND_TUTOR', 'STUDENT_GROUP_STUDY'
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [subjects, setSubjects] = useState([]);
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

  // Fetch subjects
  useEffect(() => {
    subjectApi.list()
      .then(res => setSubjects(res.data || res || []))
      .catch(err => console.error('Lỗi tải danh mục môn:', err));
  }, []);

  const loadPosts = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    try {
      const targetPage = resetPage ? 0 : page;
      const params = {
        page: targetPage,
        size: 10,
        keyword: searchKeyword.trim() || undefined,
        subjectId: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        learningMode: selectedMode || undefined,
        postType: !['ALL', 'SAVED'].includes(activeTab) ? activeTab : undefined
      };
      const res = activeTab === 'SAVED'
        ? await communityApi.getBookmarkedPosts({ page: targetPage, size: 10 })
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
  }, [activeTab, selectedSubjectId, selectedMode, searchKeyword, page]);

  useEffect(() => {
    if (!authenticated && activeTab === 'SAVED') {
      setActiveTab('ALL');
    }
  }, [authenticated, activeTab]);

  useEffect(() => {
    loadPosts(true);
  }, [activeTab, selectedSubjectId, selectedMode]);

  useEffect(() => {
    if (!posts.length || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [posts]);

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

  return (
    <div className={`${embedded ? 'w-full' : 'min-h-screen'} bg-slate-50 flex flex-col font-sans`}>
      {!embedded && <HomeHeader />}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto ${embedded ? 'max-w-none py-1' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'}`}>
        
        {/* Hero Section */}
        {!embedded && <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-10 mb-8 overflow-hidden shadow-xl border border-indigo-700/50">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Bảng tin Kết nối & Khảo sát Nhu cầu 2 Chiều</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-3">
              Cộng đồng Học tập & Khảo sát Mở lớp Thông minh
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/90 mb-6 leading-relaxed">
              Gia sư khảo sát khung giờ học để gom đủ học viên trước khi mở lớp. Học viên dễ dàng tìm gia sư phù hợp hoặc lập nhóm học chung để chia sẻ học phí.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm shadow-lg hover:shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Đăng bài kết nối / Khảo sát</span>
              </button>

              <Link
                to="/classes"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2"
              >
                <Compass className="w-4 h-4 text-indigo-300" />
                <span>Khám phá các lớp đã mở</span>
              </Link>
            </div>
          </div>
        </div>}

        {embedded && (
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
              Tạo khảo sát
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

        {/* Content Layout: Feed + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Feed Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search & Filter Bar */}
            <form onSubmit={handleSearchSubmit} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  placeholder="Tìm theo từ khóa (Môn, Lớp 12, ĐGNL, gia sư...)"
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
              >
                <option value="">Tất cả môn</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={selectedMode}
                onChange={e => setSelectedMode(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
              >
                <option value="">Tất cả hình thức</option>
                <option value="ONLINE">Trực tuyến (Online)</option>
                <option value="OFFLINE">Trực tiếp (Offline)</option>
              </select>

              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
              >
                Tìm
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
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm md:text-base mb-1">Chưa có bài viết nào phù hợp</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Hãy là người đầu tiên đăng khảo sát mở lớp hoặc tìm kiếm bạn học nhóm trên EduConnect!
                </p>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  Tạo bài viết ngay
                </button>
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
                  onVoteSuccess={() => loadPosts(false)}
                />
              ))
            )}
          </div>

          {/* Right Sidebar (1 Col) */}
          <div className="space-y-5">
            
            {/* Widget: Quy trình Khảo sát & Mở lớp */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Cơ chế Khảo sát Mở lớp</h4>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                  <span><strong>Gia sư tạo Poll:</strong> Đăng khung giờ dự kiến và đặt số lượng vote mục tiêu.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                  <span><strong>Học viên bình chọn:</strong> Chọn ca học phù hợp nhất với thời gian biểu của mình.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                  <span><strong>Mở lớp & Ký hợp đồng:</strong> Khi đủ số lượng, gia sư chốt mở lớp và gửi thông báo mời học viên ký hợp đồng Escrow USDC.</span>
                </li>
              </ul>
            </div>

            {/* Widget: Lợi ích Học nhóm */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-emerald-200" />
                <h4 className="font-bold text-sm">Học Nhóm Tiết Kiệm Học Phí</h4>
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed mb-3">
                Đăng bài tìm bạn cùng ôn thi môn Toán, Lý, Hóa, Ngoại ngữ hoặc Lập trình để nhận mức học phí ưu đãi hơn và có môi trường thảo luận sôi nổi.
              </p>
              <button
                onClick={() => {
                  setActiveTab('STUDENT_GROUP_STUDY');
                  openCreateModal();
                }}
                className="w-full py-2 bg-white text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-50 transition text-center shadow-sm cursor-pointer"
              >
                Đăng bài tìm nhóm ngay
              </button>
            </div>

            {/* Widget: Quy tắc Cộng đồng */}
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">🔒 An toàn & Bảo mật trên EduConnect:</p>
              <p>• Mọi giao dịch học phí đều được bảo toàn qua Hợp đồng thông minh Smart Contract.</p>
              <p>• Khuyến khích trao đổi qua tính năng Tin nhắn nội bộ của hệ thống để được bảo vệ quyền lợi khi có tranh chấp.</p>
            </div>
          </div>
        </div>
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
