import React, { useState, useEffect } from 'react';
import { Heart, X, User, GraduationCap, ShieldCheck, Clock } from 'lucide-react';
import communityApi from '../../api/community';

export function PostLikesModal({ isOpen, onClose, postId, postTitle }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadLikes = () => {
    if (!postId) return;
    setLoading(true);
    setError(null);

    communityApi.getPostLikes(postId)
      .then((data) => {
        setLikes(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Lỗi lấy danh sách người thích bài viết:', err);
        setError('Chưa thể tải danh sách người thích lúc này. Máy chủ đang cập nhật dịch vụ.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !postId) return;
    loadLikes();
  }, [isOpen, postId]);

  if (!isOpen) return null;

  const getRoleBadge = (role) => {
    const normalized = (role || '').toUpperCase();
    if (normalized === 'TUTOR') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <GraduationCap className="w-2.5 h-2.5" />
          Gia sư
        </span>
      );
    }
    if (normalized === 'STUDENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <User className="w-2.5 h-2.5" />
          Học viên
        </span>
      );
    }
    if (normalized === 'ADMIN' || normalized === 'STAFF') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <ShieldCheck className="w-2.5 h-2.5" />
          Quản trị
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
        Thành viên
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shadow-xs">
              <Heart className="w-4 h-4 fill-rose-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base leading-tight">
                Người đã thích
              </h3>
              <p className="text-[11px] text-slate-400">
                {likes.length > 0 ? `${likes.length} người quan tâm bài viết` : 'Danh sách lượt thích'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 divide-y divide-slate-50">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Đang tải danh sách người thích...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-slate-500 text-xs space-y-2.5 bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
              <p className="text-slate-600 font-medium">{error}</p>
              <button
                type="button"
                onClick={loadLikes}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition cursor-pointer shadow-xs"
              >
                Thử lại
              </button>
            </div>
          ) : likes.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs space-y-2">
              <Heart className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Chưa có ai thả tim bài viết này.</p>
            </div>
          ) : (
            likes.map((like) => (
              <div key={like.id || like.userId} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {like.userAvatar ? (
                    <img
                      src={like.userAvatar}
                      alt={like.userName || 'Avatar'}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                      {like.userName ? like.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-semibold text-slate-800 truncate leading-snug">
                      {like.userName || 'Người dùng'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getRoleBadge(like.userRole)}
                    </div>
                  </div>
                </div>

                {like.createdAt && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(like.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostLikesModal;
