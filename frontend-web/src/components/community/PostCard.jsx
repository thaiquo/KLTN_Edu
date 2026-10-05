import React, { useState } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Clock, 
  BookOpen, 
  MapPin, 
  Video, 
  Sparkles, 
  CheckCircle2, 
  Users, 
  DollarSign,
  ArrowRight,
  Send,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Bookmark
} from 'lucide-react';
import { Link } from 'react-router-dom';
import communityApi from '../../api/community';
import ConvertPostToClassModal from './ConvertPostToClassModal';

export function PostCard({ post: initialPost, currentUserId, userRole, authenticated, onRequireAuth, onVoteSuccess, onLikeToggle, onBookmarkToggle, onCommentAdded }) {
  const [post, setPost] = useState(initialPost);
  const [isLiked, setIsLiked] = useState(initialPost.isLiked || false);
  const [likeCount, setLikeCount] = useState(initialPost.likeCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(initialPost.isBookmarked || false);
  const [poll, setPoll] = useState(initialPost.poll);
  const [isVoting, setIsVoting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  const isAuthor = currentUserId && String(currentUserId) === String(post.authorId);
  const isTutorAuthor = isAuthor && post.authorRole === 'TUTOR' && userRole === 'TUTOR';
  const pollReachedTarget = poll && (poll.totalVotes || 0) >= (poll.minVotesTarget || 1);
  const canConvert = isTutorAuthor
    && post.postType === 'TUTOR_POLL'
    && post.status === 'OPEN'
    && !post.linkedClassId
    && !poll?.isClosed
    && pollReachedTarget;
  const canVote = userRole === 'STUDENT' && post.status === 'OPEN' && !poll?.isClosed;

  const handleLike = async () => {
    if (!authenticated) {
      onRequireAuth?.();
      return;
    }
    try {
      const newStatus = await communityApi.toggleReaction(post.id);
      setIsLiked(newStatus);
      setLikeCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
      if (onLikeToggle) onLikeToggle(post.id, newStatus);
    } catch (err) {
      console.error('Lỗi khi thả tim:', err);
    }
  };

  const handleBookmark = async () => {
    if (!authenticated) {
      onRequireAuth?.();
      return;
    }
    try {
      const newStatus = await communityApi.toggleBookmark(post.id);
      setIsBookmarked(newStatus);
      onBookmarkToggle?.(post.id, newStatus);
    } catch (err) {
      alert(err.message || err.response?.data?.message || 'Không thể lưu bài viết');
    }
  };

  const handleVote = async (optionId) => {
    if (!poll || isVoting || !canVote) return;
    setIsVoting(true);
    try {
      const updatedPoll = await communityApi.votePoll(poll.id, optionId);
      setPoll(updatedPoll);
      if (onVoteSuccess) onVoteSuccess(post.id, updatedPoll);
    } catch (err) {
      alert(err.message || err.response?.data?.message || 'Không thể bình chọn, vui lòng kiểm tra lại');
    } finally {
      setIsVoting(false);
    }
  };

  const handleToggleComments = async () => {
    if (!authenticated) {
      onRequireAuth?.();
      return;
    }
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await communityApi.getComments(post.id);
        setComments(data.content || []);
      } catch (err) {
        console.error('Lỗi tải bình luận:', err);
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(prev => !prev);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const created = await communityApi.addComment(post.id, newComment);
      setComments(prev => [...prev, created]);
      setNewComment('');
      if (onCommentAdded) onCommentAdded(post.id);
    } catch (err) {
      alert(err.message || err.response?.data?.message || 'Không thể gửi bình luận');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/community#' + post.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClassConverted = (result) => {
    setPost(prev => ({
      ...prev,
      linkedClassId: result.classId,
      linkedClassName: result.className,
      linkedClassStatus: result.status,
      status: 'CONVERTED'
    }));
    if (poll) {
      setPoll(prev => ({ ...prev, isClosed: true }));
    }
    alert(`Lớp học "${result.className}" đã được gửi duyệt. ${result.notifiedStudentsCount} học viên đã bình chọn sẽ nhận thông báo.`);
  };

  const formatPrice = (price) => {
    if (!price) return null;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const getPostTypeBadge = (type) => {
    switch (type) {
      case 'TUTOR_POLL':
        return {
          label: 'Gia sư khảo sát mở lớp',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500'
        };
      case 'STUDENT_FIND_TUTOR':
        return {
          label: 'Học viên tìm gia sư',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500'
        };
      case 'STUDENT_GROUP_STUDY':
        return {
          label: 'Tìm bạn học nhóm',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      default:
        return {
          label: 'Cộng đồng',
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500'
        };
    }
  };

  const badgeInfo = getPostTypeBadge(post.postType);

  return (
    <article 
      id={`post-${post.id}`}
      className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden mb-6"
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                {post.authorAvatar ? (
                  <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (post.authorName || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <span 
                className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-white uppercase ${
                  post.authorRole === 'TUTOR' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                }`}
              >
                {post.authorRole === 'TUTOR' ? 'Gia sư' : 'Học viên'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm md:text-base hover:text-indigo-600 cursor-pointer">
                  {post.authorName || 'Người dùng'}
                </h4>
                {post.authorRole === 'TUTOR' && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeInfo.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot}`}></span>
                  {badgeInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons & Price / Budget Badge */}
          <div className="text-right flex flex-col items-end gap-1.5">
            {canConvert && (
              <button
                onClick={() => setIsConvertModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs shadow-sm hover:shadow-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Mở lớp từ bài này</span>
              </button>
            )}

            {post.targetPricePerSession && (
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  {post.postType === 'TUTOR_POLL' ? 'Học phí đề xuất' : 'Ngân sách'}
                </span>
                <span className="text-sm md:text-base font-bold text-emerald-600">
                  {formatPrice(post.targetPricePerSession)}/buổi
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tags metadata */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 text-xs">
          {post.subjectName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
              <BookOpen className="w-3.5 h-3.5" />
              Môn {post.subjectName}
            </span>
          )}
          {post.educationLevel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-medium">
              <Layers className="w-3.5 h-3.5" />
              {post.educationLevel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
            {post.learningMode === 'ONLINE' ? (
              <><Video className="w-3.5 h-3.5 text-blue-500" /> Học Trực tuyến (Online)</>
            ) : (
              <><MapPin className="w-3.5 h-3.5 text-rose-500" /> {post.address || 'Học Trực tiếp (Offline)'}</>
            )}
          </span>
        </div>
      </div>

      {/* Title & Body */}
      <div className="px-5 py-2">
        <h3 className="font-bold text-slate-900 text-base md:text-lg mb-2 leading-snug">
          {post.title}
        </h3>
        <p className="text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
          {post.content}
        </p>
      </div>

      {/* Linked Class Banner (If converted) */}
      {post.linkedClassId && (
        <div className="mx-5 my-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                {['PUBLISHED', 'ACTIVE'].includes(post.linkedClassStatus)
                  ? 'Lớp học từ khảo sát này đã mở đăng ký.'
                  : 'Lớp học từ khảo sát này đang chờ phê duyệt.'}
              </p>
              <p className="text-xs text-emerald-700 font-medium">{post.linkedClassName}</p>
            </div>
          </div>
          {['PUBLISHED', 'ACTIVE'].includes(post.linkedClassStatus) ? (
            <Link
              to={`/classes?id=${post.linkedClassId}`}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>Xem lớp học</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : isTutorAuthor ? (
            <Link
              to="/dashboard?tab=class-management"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>Quản lý lớp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>
      )}

      {/* Interactive Poll Section */}
      {poll && (
        <div className="mx-5 my-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h5 className="font-bold text-slate-900 text-sm">
                {poll.question}
              </h5>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                poll.totalVotes >= poll.minVotesTarget 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {poll.totalVotes}/{poll.minVotesTarget} Vote
              </span>
            </div>
          </div>

          {/* Progress towards minimum opening quorum */}
          <div className="mb-3">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  poll.totalVotes >= poll.minVotesTarget ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (poll.totalVotes / (poll.minVotesTarget || 5)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
              <span>{poll.totalVotes >= poll.minVotesTarget ? '🎉 Đã đủ sĩ số mở lớp!' : `Cần thêm ${Math.max(0, poll.minVotesTarget - poll.totalVotes)} vote để gia sư chốt mở lớp`}</span>
              <span>Tổng: {poll.totalVotes} lượt vote</span>
            </div>
          </div>

          {/* Poll Options */}
          <div className="space-y-2">
            {poll.options?.map((opt) => {
              const isUserChoice = poll.userVotedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleVote(opt.id)}
                  disabled={isVoting || !canVote}
                  className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                    isUserChoice 
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500' 
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80'
                  }`}
                >
                  {/* Background progress fill */}
                  <div 
                    className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                      isUserChoice ? 'bg-indigo-100/70' : 'bg-slate-100/60'
                    }`}
                    style={{ width: `${opt.votePercentage || 0}%` }}
                  />

                  {/* Option content */}
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isUserChoice ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                      }`}>
                        {isUserChoice && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className={`text-xs md:text-sm font-semibold ${
                        isUserChoice ? 'text-indigo-900' : 'text-slate-800'
                      }`}>
                        {opt.optionLabel}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700 mr-1.5">
                        {opt.votePercentage || 0}%
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({opt.voteCount || 0} vote)
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-slate-600 text-xs md:text-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold transition cursor-pointer ${
              isLiked ? 'text-rose-600 bg-rose-50' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{likeCount > 0 ? likeCount : 'Thích'}</span>
          </button>

          <button
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.commentCount > 0 ? `${post.commentCount} Bình luận` : 'Bình luận'}</span>
            {showComments ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <button
            onClick={handleBookmark}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold transition cursor-pointer ${
              isBookmarked ? 'text-indigo-700 bg-indigo-50' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title={isBookmarked ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-indigo-600 text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">{isBookmarked ? 'Đã lưu' : 'Lưu'}</span>
          </button>
        </div>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium hover:bg-slate-100 transition text-slate-500 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>{copied ? 'Đã sao chép link!' : 'Chia sẻ'}</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="bg-slate-50/70 border-t border-slate-100 p-5 pt-3">
          {/* Comment List */}
          <div className="space-y-3 mb-4">
            {loadingComments ? (
              <p className="text-xs text-slate-500 text-center py-2">Đang tải bình luận...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">Chưa có bình luận nào. Hãy là người đầu tiên trao đổi!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {c.userName ? c.userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{c.userName || 'Ẩn danh'}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.commentText}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Viết bình luận hoặc trao đổi về lớp..."
              className="flex-1 px-3.5 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmittingComment}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </form>
        </div>
      )}

      {/* Convert Post to Class Modal */}
      {canConvert && (
        <ConvertPostToClassModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          post={post}
          onConverted={handleClassConverted}
        />
      )}
    </article>
  );
}

export default PostCard;
