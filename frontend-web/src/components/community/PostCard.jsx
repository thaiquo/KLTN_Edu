import React, { useEffect, useState, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Clock, 
  BookOpen, 
  MapPin, 
  Video, 
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
  Bookmark, 
  Check, 
  Trash2,
  Reply,
  X,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import communityApi from '../../api/community';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../feedback/useFeedback';
import ConvertPostToClassModal from './ConvertPostToClassModal';
import { PollWeeklyCalendar } from './PollWeeklyCalendar';
import PostLikesModal from './PostLikesModal';
import { PostCommentsModal } from './PostCommentsModal';

export function PostCard({ post: initialPost, currentUserId, userRole, authenticated, onRequireAuth, onVoteSuccess, onLikeToggle, onBookmarkToggle, onCommentAdded, onPostDeleted }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feedback = useFeedback();
  const commentInputRef = useRef(null);

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
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    setPost(initialPost);
    setIsLiked(initialPost.isLiked || false);
    setLikeCount(initialPost.likeCount || 0);
    setIsBookmarked(initialPost.isBookmarked || false);
    setPoll(initialPost.poll);
  }, [initialPost]);

  useEffect(() => {
    const handleRealtimeCommunityEvent = (event) => {
      const detail = event.detail;
      const eventPostId = detail?.payload?.postId ?? detail?.entityId;
      if (String(eventPostId) !== String(post.id)) return;

      if (detail?.type === 'COMMUNITY_POST_DELETED') {
        onPostDeleted?.(post.id);
        return;
      }

      if (detail?.type === 'COMMUNITY_POLL_UPDATED' && detail.payload?.poll) {
        setPoll(current => ({
          ...current,
          ...detail.payload.poll,
          userVotedOptionId: current?.userVotedOptionId,
          userVotedOptionIds: current?.userVotedOptionIds || []
        }));
      }

      if (detail?.type === 'COMMUNITY_POST_UPDATED') {
        setPost(current => ({ ...current, status: detail.payload?.status || current.status }));
        if (detail.payload?.poll) {
          setPoll(current => ({
            ...current,
            ...detail.payload.poll,
            userVotedOptionId: current?.userVotedOptionId,
            userVotedOptionIds: current?.userVotedOptionIds || []
          }));
        }
      }
    };

    window.addEventListener('realtime:event', handleRealtimeCommunityEvent);
    return () => window.removeEventListener('realtime:event', handleRealtimeCommunityEvent);
  }, [onPostDeleted, post.id]);

  const isAuthor = currentUserId && String(currentUserId) === String(post.authorId);
  const isTutorAuthor = isAuthor && post.authorRole === 'TUTOR' && userRole === 'TUTOR';
  const pollExpired = Boolean(poll?.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now());
  const canConvert = isTutorAuthor
    && post.postType === 'TUTOR_POLL'
    && (post.status === 'OPEN' || post.status === 'CLOSED')
    && !post.linkedClassId
    && poll;
  const canViewLinkedClass = Boolean(post.linkedClassId && (post.linkedClassAcceptingEnrollment === true || post.linkedClassStatus === 'PUBLISHED'));
  const canInteractWithPosts = Boolean(authenticated);
  const showLoginRequired = (message) => {
    feedback.info({ title: 'Cần đăng nhập', message });
  };

  const handleLike = async () => {
    if (!authenticated) {
      showLoginRequired('Vui lòng đăng nhập để thả tim bài viết.');
      return;
    }
    try {
      const newStatus = await communityApi.toggleReaction(post.id, {
        userName: user?.fullName || user?.email,
        userAvatar: user?.avatarUrl || user?.avatar
      });
      setIsLiked(newStatus);
      setLikeCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
      if (onLikeToggle) onLikeToggle(post.id, newStatus);
    } catch (err) {
      console.error('Lỗi khi thả tim:', err);
    }
  };

  const handleBookmark = async () => {
    if (!authenticated) {
      showLoginRequired('Vui lòng đăng nhập để lưu bài viết.');
      return;
    }
    try {
      const newStatus = await communityApi.toggleBookmark(post.id);
      setIsBookmarked(newStatus);
      onBookmarkToggle?.(post.id, newStatus);
      feedback.success(newStatus ? 'Đã lưu bài viết vào danh sách quan tâm.' : 'Đã bỏ lưu bài viết.');
    } catch (err) {
      feedback.error(err.message || err.response?.data?.message || 'Không thể lưu bài viết');
    }
  };

  const handleSaveVotes = async (optionIds) => {
    if (!poll || isVoting) return;
    if (!authenticated) {
      showLoginRequired('Chỉ tài khoản học viên đã đăng nhập mới được bình chọn ca học.');
      return;
    }
    if (userRole !== 'STUDENT') {
      feedback.warning('Chỉ tài khoản học viên mới được tham gia bình chọn ca học.');
      return;
    }
    if (post.status !== 'OPEN' || poll.isClosed || pollExpired) {
      feedback.info('Khảo sát này đã kết thúc.');
      return;
    }

    setIsVoting(true);
    try {
      const updatedPoll = await communityApi.updatePollVotes(poll.id, optionIds);
      setPoll(updatedPoll);
      if (onVoteSuccess) onVoteSuccess(post.id, updatedPoll);
      feedback.success('Đã lưu các ca học bạn có thể tham gia.');
    } catch (err) {
      feedback.error(err.message || err.response?.data?.message || 'Không thể bình chọn, vui lòng kiểm tra lại');
      throw err;
    } finally {
      setIsVoting(false);
    }
  };

  const handleToggleComments = async () => {
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

  const handleReplyTo = (targetComment) => {
    setReplyingTo(targetComment);
    const targetName = targetComment.userName || 'bạn';
    const mention = `@${targetName} `;
    setNewComment(prev => {
      if (!prev.includes(`@${targetName}`)) {
        return `${mention}${prev}`.trim() + ' ';
      }
      return prev;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;
    if (!canInteractWithPosts) {
      showLoginRequired('Vui lòng đăng nhập để bình luận trên bảng tin.');
      return;
    }
    setIsSubmittingComment(true);
    try {
      const created = await communityApi.addComment(post.id, {
        commentText: newComment.trim(),
        userName: user?.fullName || user?.email,
        userAvatar: user?.avatarUrl || user?.avatar
      });
      setComments(prev => [...prev, created]);
      setPost(prev => ({
        ...prev,
        commentCount: (prev.commentCount || 0) + 1
      }));
      setNewComment('');
      setReplyingTo(null);
      if (onCommentAdded) onCommentAdded(post.id);
    } catch (err) {
      feedback.error(err.message || err.response?.data?.message || 'Không thể gửi bình luận');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/community#' + post.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeletePost = async () => {
    const confirmed = await feedback.confirm({
      title: 'Xác nhận xóa bài viết',
      message: 'Bạn có chắc chắn muốn xóa bài viết này khỏi bảng tin? Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa bài viết',
      cancelText: 'Hủy',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await communityApi.deletePost(post.id);
      feedback.success('Đã xóa bài viết thành công.');
      onPostDeleted?.(post.id);
    } catch (err) {
      feedback.error(err.message || err.response?.data?.message || 'Không thể xóa bài viết');
    }
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
    feedback.success(`Lớp học "${result.className}" đã được gửi duyệt. ${result.notifiedStudentsCount || 0} học viên đã bình chọn sẽ nhận thông báo.`);
  };

  const formatPrice = (price) => {
    if (!price) return null;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const getPostTypeBadge = (type) => {
    switch (type) {
      case 'TUTOR_ANNOUNCEMENT':
        return {
          label: 'Gia sư thông báo / chia sẻ',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500'
        };
      case 'TUTOR_POLL':
        return {
          label: 'Gia sư khảo sát mở lớp',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500'
        };
      case 'TUTOR_CLASS_SHARE':
        return {
          label: 'Gia sư giới thiệu lớp học',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
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
            <div className="flex items-center gap-1.5">
              {isAuthor && (
                <button
                  type="button"
                  onClick={handleDeletePost}
                  title="Xóa bài viết của bạn"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {post.targetPricePerSession && (
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  {post.authorRole === 'TUTOR' ? 'Học phí đề xuất' : 'Ngân sách'}
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

      {/* Linked Class Banner (If converted or TUTOR_CLASS_SHARE) */}
      {post.linkedClassId && (
        <div
          onClick={() => {
            if (isTutorAuthor && post.postType === 'TUTOR_CLASS_SHARE') {
              navigate('/dashboard?tab=class-management');
            } else if (canViewLinkedClass) {
              navigate(`/classes?id=${post.linkedClassId}`);
            }
          }}
          className={`mx-5 my-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
            canViewLinkedClass || (isTutorAuthor && post.postType === 'TUTOR_CLASS_SHARE')
              ? 'cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all'
              : ''
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                {post.postType === 'TUTOR_CLASS_SHARE'
                  ? canViewLinkedClass
                    ? 'Gia sư đang giới thiệu lớp học này trên bảng tin.'
                    : 'Lớp học này hiện không còn nhận yêu cầu mới.'
                  : ['PUBLISHED', 'ACTIVE'].includes(post.linkedClassStatus)
                  ? 'Lớp học từ khảo sát này đã mở tuyển sinh.'
                  : 'Lớp học từ khảo sát này đang chờ phê duyệt.'}
              </p>
              <h4 className="text-sm font-black text-emerald-950 mt-0.5">{post.linkedClassName}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-800">
                {post.linkedClassPricePerSession && (
                  <span className="rounded-md bg-white/90 px-2 py-0.5 font-bold shadow-xs">
                    {formatPrice(post.linkedClassPricePerSession)}/buổi
                  </span>
                )}
                {post.linkedClassTotalSessions && (
                  <span className="rounded-md bg-white/90 px-2 py-0.5 font-bold shadow-xs">
                    {post.linkedClassTotalSessions} buổi
                  </span>
                )}
                {post.linkedClassStartDate && (
                  <span className="rounded-md bg-white/90 px-2 py-0.5 font-bold shadow-xs">
                    Khai giảng: {post.linkedClassStartDate}
                  </span>
                )}
                {post.linkedClassAvailableSlots != null && (
                  <span className={`rounded-md px-2 py-0.5 font-bold shadow-xs ${
                    post.linkedClassAvailableSlots > 0 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {post.linkedClassAvailableSlots > 0
                      ? `Còn ${post.linkedClassAvailableSlots} chỗ (${post.linkedClassAcceptedCount || 0}/${post.linkedClassMaxStudents || '?'})`
                      : 'Đã hết chỗ'}
                  </span>
                )}
                {post.linkedClassJoinMode === 'INVITE_KEY' && (
                  <span className="rounded-md bg-sky-100 text-sky-800 px-2 py-0.5 font-bold">
                    Cần mã mời
                  </span>
                )}
                {canViewLinkedClass && (
                  <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold">
                    Đang tuyển sinh
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            {isTutorAuthor && post.postType === 'TUTOR_CLASS_SHARE' ? (
              <Link
                to="/dashboard?tab=class-management"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              >
                <span>Quản lý lớp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : canViewLinkedClass ? (
              <Link
                to={`/classes?id=${post.linkedClassId}`}
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              >
                <span>{authenticated && userRole === 'STUDENT' ? 'Xem chi tiết & Đăng ký' : 'Xem lớp học'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : post.postType === 'TUTOR_CLASS_SHARE' ? (
              <span className="text-xs font-bold text-slate-500">Đã đóng tuyển sinh</span>
            ) : null}
          </div>
        </div>
      )}

      {/* Weekly 7-Day Calendar Poll Section */}
      {poll && (
        <div className="mx-5 my-3">
          <PollWeeklyCalendar
            poll={poll}
            isTutorView={isTutorAuthor}
            userRole={userRole}
            authenticated={authenticated}
            onSaveVotes={handleSaveVotes}
            isVoting={isVoting}
            onConvert={() => setIsConvertModalOpen(true)}
            canConvert={canConvert}
            defaultExpanded={true}
          />
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-slate-600 text-xs md:text-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl overflow-hidden border border-slate-200/80 bg-white shadow-2xs">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 py-1.5 px-3 font-semibold transition cursor-pointer ${
                isLiked ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title={isLiked ? 'Bỏ thích' : 'Thích bài viết'}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{isLiked ? 'Đã thích' : 'Thích'}</span>
            </button>
            {likeCount > 0 && (
              <button
                type="button"
                onClick={() => setIsLikesModalOpen(true)}
                className={`py-1.5 px-2.5 font-bold transition text-xs border-l cursor-pointer ${
                  isLiked
                    ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                    : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
                title="Bấm để xem danh sách người đã thích bài viết"
              >
                {likeCount}
              </button>
            )}
          </div>

          <button
            onClick={() => setIsCommentsModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer text-slate-600"
            title="Bấm để mở popup bình luận & trao đổi"
          >
            <MessageCircle className="w-4 h-4 text-indigo-500" />
            <span>{post.commentCount > 0 ? `${post.commentCount} Bình luận` : 'Bình luận'}</span>
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

      {/* Quick comments bar */}
      {post.commentCount > 0 && (
        <div
          onClick={() => setIsCommentsModalOpen(true)}
          className="mx-5 mb-3 px-3.5 py-2 rounded-xl bg-slate-50/80 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 flex items-center justify-between text-xs text-slate-600 cursor-pointer transition-all group"
          title="Bấm để mở xem tất cả bình luận"
        >
          <div className="flex items-center gap-2 truncate">
            <MessageCircle className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span className="truncate">
              Có <strong className="font-bold text-slate-800">{post.commentCount} bình luận trao đổi</strong>.
            </span>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform whitespace-nowrap flex items-center gap-1">
            Xem tất cả &bull; Phản hồi
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}

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
              comments.map(c => {
                const isCommentAuthor = c.userId && String(c.userId) === String(post.authorId);
                const roleNorm = (c.userRole || '').toUpperCase();
                const isTutor = roleNorm === 'TUTOR';
                const isStudent = roleNorm === 'STUDENT';
                const isAdmin = roleNorm === 'ADMIN' || roleNorm === 'STAFF';

                const renderCommentText = (text) => {
                  if (!text) return null;
                  const parts = text.split(/(@[^\s]+)/g);
                  return parts.map((part, index) => {
                    if (part.startsWith('@')) {
                      return (
                        <span key={index} className="font-bold text-indigo-600 bg-indigo-50/80 px-1 py-0.5 rounded">
                          {part}
                        </span>
                      );
                    }
                    return part;
                  });
                };

                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    {c.userAvatar ? (
                      <img
                        src={c.userAvatar}
                        alt={c.userName || 'Avatar'}
                        className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0 mt-0.5 shadow-xs"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                        {c.userName ? c.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{c.userName || 'Ẩn danh'}</span>
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
                          {isAdmin && (
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Quản trị
                            </span>
                          )}
                          {isCommentAuthor && (
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Tác giả bài viết
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{renderCommentText(c.commentText)}</p>

                      {/* Reply button */}
                      <div className="flex items-center gap-3 mt-1.5 pt-1 border-t border-slate-50 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleReplyTo(c)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Trả lời</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment Input / Guest Login Call-to-action */}
          {authenticated ? (
            <div>
              {replyingTo && (
                <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-indigo-50/90 border border-indigo-100 text-xs text-indigo-900 animate-in fade-in duration-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <Reply className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                    <span className="truncate">
                      Đang trả lời <strong className="font-bold text-indigo-700">@{replyingTo.userName || 'Ẩn danh'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer flex-shrink-0"
                    title="Hủy trả lời"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={replyingTo ? `Trả lời @${replyingTo.userName}...` : "Viết bình luận hoặc trao đổi về lớp..."}
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
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs">
              <div className="flex items-center gap-2 text-indigo-900">
                <MessageCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>Đăng nhập để tham gia bình luận và kết nối cùng cộng đồng.</span>
              </div>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer flex-shrink-0 shadow-xs"
              >
                Đăng nhập
              </button>
            </div>
          )}
        </div>
      )}

      {/* Convert Post to Class Modal */}
      {canConvert && isConvertModalOpen && (
        <ConvertPostToClassModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          post={{ ...post, poll }}
          onConverted={handleClassConverted}
        />
      )}

      {/* Post Likes Modal */}
      <PostLikesModal
        isOpen={isLikesModalOpen}
        onClose={() => setIsLikesModalOpen(false)}
        postId={post.id}
        postTitle={post.title}
      />

      {/* Post Comments Modal (Popup chuyên biệt) */}
      <PostCommentsModal
        isOpen={isCommentsModalOpen}
        onClose={() => setIsCommentsModalOpen(false)}
        post={post}
        currentUser={user}
        currentUserId={currentUserId}
        userRole={userRole}
        authenticated={authenticated}
        onRequireAuth={onRequireAuth}
        onCommentAdded={(postId, newCommentObj) => {
          setPost(prev => ({ ...prev, commentCount: (prev.commentCount || 0) + 1 }));
          setComments(prev => [...prev, newCommentObj]);
          onCommentAdded?.(postId, newCommentObj);
        }}
      />
    </article>
  );
}

export default PostCard;
