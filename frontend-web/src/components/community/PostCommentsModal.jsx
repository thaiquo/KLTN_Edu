import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Reply,
  CheckCircle2,
  GraduationCap,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import communityApi from '../../api/community';
import { useFeedback } from '../feedback/useFeedback';

export function PostCommentsModal({
  isOpen,
  onClose,
  post,
  currentUser,
  currentUserId,
  userRole,
  authenticated,
  onCommentAdded,
  onRequireAuth
}) {
  const feedback = useFeedback();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const inputRef = useRef(null);
  const commentListEndRef = useRef(null);
  const canComment = Boolean(authenticated && ['STUDENT', 'TUTOR'].includes(String(userRole || '').toUpperCase()));

  // Load comments when modal opens
  useEffect(() => {
    if (!isOpen || !post?.id) return;

    let active = true;
    setLoading(true);
    setError(null);
    setReplyingTo(null);
    setNewComment('');

    communityApi.getComments(post.id, { page: 0, size: 50 })
      .then((res) => {
        if (!active) return;
        const list = res?.content || res?.data || res || [];
        setComments(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Lỗi tải bình luận:', err);
        setError(err.message || 'Không thể tải danh sách bình luận');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, post?.id]);

  if (!isOpen || !post) return null;

  const handleReplyTo = (comment) => {
    if (!authenticated) {
      feedback.info({ title: 'Cần đăng nhập', message: 'Vui lòng đăng nhập để trả lời bình luận.' });
      onRequireAuth?.();
      return;
    }
    if (!canComment) {
      feedback.warning('Chỉ tài khoản Học viên hoặc Gia sư mới được bình luận trên bảng tin cộng đồng.');
      return;
    }
    setReplyingTo(comment);
    const mention = `@${comment.userName || 'user'} `;
    if (!newComment.startsWith(mention)) {
      setNewComment(mention);
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    if (replyingTo && newComment.startsWith(`@${replyingTo.userName || 'user'}`)) {
      setNewComment(newComment.replace(`@${replyingTo.userName || 'user'} `, ''));
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    if (!authenticated) {
      feedback.info({ title: 'Cần đăng nhập', message: 'Vui lòng đăng nhập để gửi bình luận.' });
      onRequireAuth?.();
      return;
    }

    if (!canComment) {
      feedback.warning('Chỉ tài khoản Học viên hoặc Gia sư mới được bình luận trên bảng tin cộng đồng.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await communityApi.addComment(post.id, {
        commentText: newComment.trim(),
        userName: currentUser?.fullName || currentUser?.email,
        userAvatar: currentUser?.avatarUrl || currentUser?.avatar,
        replyToUserId: replyingTo?.userId,
        replyToUserRole: replyingTo?.userRole,
        replyToUserName: replyingTo?.userName
      });

      setComments(prev => [...prev, created]);
      setNewComment('');
      setReplyingTo(null);
      onCommentAdded?.(post.id, created);
      feedback.success('Đã gửi bình luận thành công.');

      setTimeout(() => {
        commentListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Lỗi khi gửi bình luận:', err);
      feedback.error(err.message || 'Không thể gửi bình luận. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCommentText = (text) => {
    if (!text) return null;
    const parts = text.split(/(@[^\s]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="font-bold text-indigo-600 bg-indigo-50/90 px-1 py-0.5 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const isTutorAuthor = post.authorRole === 'TUTOR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900">Bình luận & Trao đổi</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                  {comments.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 max-w-sm sm:max-w-md">
                Bài viết: <strong className="text-slate-700">{post.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            title="Đóng popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post Quick Preview Card */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full rounded-full object-cover" />
              ) : (
                (post.authorName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800 truncate">{post.authorName || 'Tác giả'}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                  isTutorAuthor ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isTutorAuthor ? 'Gia sư' : 'Học viên'}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {new Date(post.createdAt).toLocaleDateString('vi-VN')}
          </span>
        </div>

        {/* Comments Scrollable Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/30">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium">Đang tải danh sách bình luận...</span>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-xs text-rose-500 font-medium bg-rose-50/60 rounded-2xl border border-rose-100 p-4">
              <AlertCircle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
              {error}
            </div>
          ) : comments.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-2.5">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800">Chưa có bình luận nào</h4>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                Hãy là người đầu tiên đặt câu hỏi hoặc trao đổi cùng gia sư và các bạn học viên!
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const isCommentAuthor = c.userId && String(c.userId) === String(post.authorId);
              const roleNorm = (c.userRole || '').toUpperCase();
              const isTutor = roleNorm === 'TUTOR';
              const isStudent = roleNorm === 'STUDENT';
              const isAdmin = roleNorm === 'ADMIN' || roleNorm === 'STAFF';

              return (
                <div key={c.id} className="flex items-start gap-2.5 sm:gap-3 group">
                  {c.userAvatar ? (
                    <img
                      src={c.userAvatar}
                      alt={c.userName || 'Avatar'}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0 mt-0.5 shadow-2xs"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                      {c.userName ? c.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}

                  <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200/80 text-xs shadow-xs hover:border-indigo-200 transition-all">
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900">{c.userName || 'Thành viên'}</span>
                        {isTutor && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <GraduationCap className="w-2.5 h-2.5" />
                            Gia sư
                          </span>
                        )}
                        {isStudent && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <User className="w-2.5 h-2.5" />
                            Học viên
                          </span>
                        )}
                        {isAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <ShieldCheck className="w-2.5 h-2.5" />
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

                    <p className="text-slate-700 leading-relaxed whitespace-pre-line text-xs sm:text-[13px]">
                      {renderCommentText(c.commentText)}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50 text-[11px]">
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
          <div ref={commentListEndRef} />
        </div>

        {/* Sticky Input Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
          {canComment ? (
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
              <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={
                    replyingTo
                      ? `Trả lời @${replyingTo.userName || 'user'}...`
                      : 'Viết bình luận, trao đổi lịch học hoặc hỏi thông tin...'
                  }
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </form>
            </div>
          ) : authenticated ? (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <MessageCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>Chỉ Học viên và Gia sư được tham gia bình luận trên bảng tin cộng đồng.</span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-xs">
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
      </div>
    </div>
  );
}
