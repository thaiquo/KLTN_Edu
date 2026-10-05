import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  Video, 
  MapPin, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import communityApi from '../../api/community';

export function ConvertPostToClassModal({ isOpen, onClose, post, onConverted }) {
  if (!isOpen || !post) return null;

  const poll = post.poll;
  const options = poll?.options || [];

  // Find option with highest votes by default
  const defaultOption = [...options].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];

  const [selectedOptionId, setSelectedOptionId] = useState(defaultOption?.id || options[0]?.id || '');
  const [className, setClassName] = useState(post.title || '');
  const [description, setDescription] = useState(post.content || '');
  const [pricePerSession, setPricePerSession] = useState(post.targetPricePerSession || '');
  const [maxStudents, setMaxStudents] = useState(20);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [meetingLink, setMeetingLink] = useState('');
  const [address, setAddress] = useState(post.address || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedOptionId) {
      setError('Vui lòng chọn khung giờ học để thiết lập lịch cố định cho lớp');
      return;
    }
    if (!className.trim()) {
      setError('Vui lòng nhập tên lớp học');
      return;
    }
    if (post.learningMode === 'ONLINE' && !meetingLink.trim()) {
      setError('Vui lòng nhập link phòng học trực tuyến');
      return;
    }
    if (post.learningMode === 'OFFLINE' && !address.trim()) {
      setError('Vui lòng nhập địa chỉ học trực tiếp');
      return;
    }

    const payload = {
      selectedOptionId: Number(selectedOptionId),
      name: className.trim(),
      description: description.trim(),
      pricePerSession: pricePerSession ? Number(pricePerSession) : null,
      maxStudents: Number(maxStudents) || 20,
      startDate,
      meetingLink: post.learningMode === 'ONLINE' ? meetingLink.trim() : null,
      address: post.learningMode === 'OFFLINE' ? address.trim() : null
    };

    setSubmitting(true);
    try {
      const res = await communityApi.convertPostToClass(post.id, payload);
      if (onConverted) onConverted(res);
      onClose();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Có lỗi xảy ra khi tạo lớp học từ bài viết');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Chuyển đổi bài khảo sát thành Lớp học</h3>
              <p className="text-xs text-indigo-700 font-medium">Tự động cấu hình lịch học & thông báo cho học viên đã vote</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs md:text-sm">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Option Selector from Poll */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Chọn ca học trúng tuyển (dựa trên kết quả bình chọn) *
            </label>
            <div className="space-y-2">
              {options.map((opt) => {
                const isSelected = String(selectedOptionId) === String(opt.id);
                const isTopVoted = defaultOption && defaultOption.id === opt.id && (opt.voteCount || 0) > 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span>{opt.optionLabel}</span>
                      {isTopVoted && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                          ⭐ Nhiều vote nhất ({opt.voteCount} vote)
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 font-semibold text-xs">
                      {opt.voteCount || 0} vote ({opt.votePercentage || 0}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp học *</label>
            <input
              type="text"
              value={className}
              onChange={e => setClassName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              placeholder="VD: Lớp Toán 12 Nâng cao - Luyện thi Đại học"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả tóm tắt lớp</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Mục tiêu khóa học, tài liệu..."
            />
          </div>

          {/* Price & Max Students & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Học phí (VNĐ/buổi)</label>
              <input
                type="number"
                value={pricePerSession}
                onChange={e => setPricePerSession(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-emerald-600"
                placeholder="200000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sĩ số tối đa</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxStudents}
                onChange={e => setMaxStudents(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày khai giảng</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>
          </div>

          {/* Mode specific link / address */}
          {post.learningMode === 'ONLINE' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Link phòng học Google Meet</label>
              <input
                type="url"
                required
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ học trực tiếp</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Địa chỉ học offline"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          {/* Info Notice */}
          <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-start gap-2 text-indigo-900 text-xs">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <p>
              Hệ thống sẽ tự động tạo lớp học, liên kết với bài khảo sát này và gửi thông báo mời học đến <strong>{poll?.totalVotes || 0} học viên</strong> đã tham gia bình chọn!
            </p>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Đang tạo lớp...' : '🚀 Xác nhận Mở Lớp & Gửi Thông Báo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConvertPostToClassModal;
