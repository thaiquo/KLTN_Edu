import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  Clock, 
  MapPin, 
  Video, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import communityApi from '../../api/community';
import { subjectApi } from '../../api/subjects';

export function CreatePostModal({ isOpen, onClose, onPostCreated, userRole, editingPost = null }) {
  const [postType, setPostType] = useState(userRole === 'TUTOR' ? 'TUTOR_POLL' : 'STUDENT_FIND_TUTOR');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [educationLevel, setEducationLevel] = useState('Lớp 12');
  const [learningMode, setLearningMode] = useState('ONLINE');
  const [targetPrice, setTargetPrice] = useState('');
  const [address, setAddress] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Poll state (cho TUTOR_POLL)
  const [pollQuestion, setPollQuestion] = useState('Bạn học được vào khung giờ nào dưới đây?');
  const [minVotesTarget, setMinVotesTarget] = useState(5);
  const [pollOptions, setPollOptions] = useState([
    { dayOfWeek: 1, startTime: '19:30', endTime: '21:00', optionLabel: 'Tối Thứ 2 (19:30 - 21:00)' },
    { dayOfWeek: 2, startTime: '19:30', endTime: '21:00', optionLabel: 'Tối Thứ 3 (19:30 - 21:00)' }
  ]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPostType(editingPost?.postType || (userRole === 'TUTOR' ? 'TUTOR_POLL' : 'STUDENT_FIND_TUTOR'));
      setTitle(editingPost?.title || '');
      setContent(editingPost?.content || '');
      setSubjectId(editingPost?.subjectId ? String(editingPost.subjectId) : '');
      setEducationLevel(editingPost?.educationLevel || 'Lớp 12');
      setLearningMode(editingPost?.learningMode || 'ONLINE');
      setTargetPrice(editingPost?.targetPricePerSession ? String(editingPost.targetPricePerSession) : '');
      setAddress(editingPost?.address || '');
      setPollQuestion(editingPost?.poll?.question || 'Bạn học được vào khung giờ nào dưới đây?');
      setMinVotesTarget(editingPost?.poll?.minVotesTarget || 5);
      setPollOptions(editingPost?.poll?.options?.length
        ? editingPost.poll.options.map(option => ({
            dayOfWeek: option.dayOfWeek,
            startTime: String(option.startTime).slice(0, 5),
            endTime: String(option.endTime).slice(0, 5),
            optionLabel: option.optionLabel
          }))
        : [
            { dayOfWeek: 1, startTime: '19:30', endTime: '21:00', optionLabel: 'Tối Thứ 2 (19:30 - 21:00)' },
            { dayOfWeek: 2, startTime: '19:30', endTime: '21:00', optionLabel: 'Tối Thứ 3 (19:30 - 21:00)' }
          ]);
      subjectApi.list()
        .then(res => setSubjects(res.data || res || []))
        .catch(err => console.error('Lỗi tải danh mục môn:', err));
    }
  }, [isOpen, editingPost, userRole]);

  if (!isOpen) return null;

  const handleAddPollOption = () => {
    setPollOptions(prev => [
      ...prev,
      { dayOfWeek: 5, startTime: '08:00', endTime: '09:30', optionLabel: 'Sáng Thứ 6 (08:00 - 09:30)' }
    ]);
  };

  const handleRemovePollOption = (idx) => {
    setPollOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx, field, value) => {
    setPollOptions(prev => {
      const next = [...prev];
      next[idx][field] = value;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề bài viết');
      return;
    }
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung bài viết');
      return;
    }

    const payload = {
      postType,
      title: title.trim(),
      content: content.trim(),
      subjectId: subjectId ? Number(subjectId) : null,
      educationLevel,
      learningMode,
      targetPricePerSession: targetPrice ? Number(targetPrice) : null,
      address: learningMode === 'OFFLINE' ? address : null
    };

    if (postType === 'TUTOR_POLL') {
      if (!subjectId) {
        setError('Vui lòng chọn môn học cho khảo sát mở lớp');
        return;
      }
      if (pollOptions.length < 2) {
        setError('Bài khảo sát cần tối thiểu 2 khung giờ để học viên bình chọn');
        return;
      }
      payload.poll = {
        question: pollQuestion.trim(),
        minVotesTarget: Number(minVotesTarget) || 5,
        options: pollOptions.map(opt => ({
          dayOfWeek: Number(opt.dayOfWeek),
          startTime: opt.startTime.length === 5 ? `${opt.startTime}:00` : opt.startTime,
          endTime: opt.endTime.length === 5 ? `${opt.endTime}:00` : opt.endTime,
          optionLabel: opt.optionLabel
        }))
      };
    }

    setSubmitting(true);
    try {
      const saved = editingPost
        ? await communityApi.updatePost(editingPost.id, payload)
        : await communityApi.createPost(payload);
      if (onPostCreated) onPostCreated(saved);
      onClose();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Có lỗi xảy ra khi đăng bài');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {editingPost ? 'Chỉnh sửa bài viết' : 'Tạo bài viết kết nối mới'}
              </h3>
              <p className="text-xs text-slate-500">
                {editingPost ? 'Cập nhật nội dung bài viết và khảo sát' : 'Khảo sát nhu cầu mở lớp hoặc tìm gia sư/học nhóm'}
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Post Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Loại bài đăng</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {userRole === 'TUTOR' && (
                <button
                  type="button"
                  onClick={() => setPostType('TUTOR_POLL')}
                  className={`p-3 rounded-xl border text-left transition ${
                    postType === 'TUTOR_POLL'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold">📊 Khảo sát mở lớp</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Thăm dò giờ học trước khi chốt lớp</p>
                </button>
              )}
              {userRole !== 'TUTOR' && <>
              <button
                type="button"
                onClick={() => setPostType('STUDENT_FIND_TUTOR')}
                className={`p-3 rounded-xl border text-left transition ${
                  postType === 'STUDENT_FIND_TUTOR'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="text-xs font-bold">🎯 Tìm gia sư</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Đăng nhu cầu học cá nhân (1 kèm 1)</p>
              </button>
              <button
                type="button"
                onClick={() => setPostType('STUDENT_GROUP_STUDY')}
                className={`p-3 rounded-xl border text-left transition ${
                  postType === 'STUDENT_GROUP_STUDY'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="text-xs font-bold">👥 Tìm bạn học chung</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Gom nhóm cùng học để chia sẻ học phí</p>
              </button>
              </>}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề bài viết *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: [Khảo sát] Mở lớp Toán 12 Luyện thi THPTQG 8+..."
              className="w-full px-3.5 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Subject & Education Level & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn học</label>
              <select
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Chọn môn học --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cấp độ / Lớp</label>
              <select
                value={educationLevel}
                onChange={e => setEducationLevel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 12">Lớp 12</option>
                <option value="Đại học">Đại học</option>
                <option value="Luyện thi ĐGNL">Luyện thi ĐGNL</option>
                <option value="Lập trình / Công nghệ">Lập trình / Công nghệ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hình thức</label>
              <select
                value={learningMode}
                onChange={e => setLearningMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="ONLINE">Trực tuyến (Online)</option>
                <option value="OFFLINE">Trực tiếp (Offline)</option>
              </select>
            </div>
          </div>

          {/* Price & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {postType === 'TUTOR_POLL' ? 'Học phí dự kiến (VNĐ/buổi)' : 'Ngân sách mong muốn (VNĐ/buổi)'}
              </label>
              <input
                type="number"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="VD: 150000"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {learningMode === 'OFFLINE' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ học</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="VD: Quận Gò Vấp, TP.HCM"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung chi tiết *</label>
            <textarea
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Mô tả mục tiêu khóa học, lộ trình dự kiến, yêu cầu đầu vào..."
              className="w-full px-3.5 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Poll Builder for Tutor */}
          {postType === 'TUTOR_POLL' && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-indigo-950 text-xs">Cấu hình Thăm dò ý kiến (Poll Khảo sát)</h4>
                </div>
                <div className="flex items-center gap-1 text-xs text-indigo-900 font-medium">
                  <span>Mục tiêu mở lớp:</span>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={minVotesTarget}
                    onChange={e => setMinVotesTarget(e.target.value)}
                    className="w-14 px-2 py-0.5 text-xs bg-white border border-indigo-200 rounded-lg text-center font-bold"
                  />
                  <span>vote</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-indigo-900 mb-1">Câu hỏi khảo sát</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-indigo-900">Các tùy chọn ca học dự kiến</label>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-[86px_90px_90px_1fr_auto] items-center gap-2 bg-white p-2 rounded-xl border border-indigo-100">
                    <select
                      value={opt.dayOfWeek}
                      onChange={e => handleOptionChange(idx, 'dayOfWeek', Number(e.target.value))}
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      aria-label="Ngày học"
                    >
                      <option value={1}>Thứ 2</option>
                      <option value={2}>Thứ 3</option>
                      <option value={3}>Thứ 4</option>
                      <option value={4}>Thứ 5</option>
                      <option value={5}>Thứ 6</option>
                      <option value={6}>Thứ 7</option>
                      <option value={7}>Chủ nhật</option>
                    </select>
                    <input
                      type="time"
                      value={opt.startTime}
                      onChange={e => handleOptionChange(idx, 'startTime', e.target.value)}
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      aria-label="Giờ bắt đầu"
                    />
                    <input
                      type="time"
                      value={opt.endTime}
                      onChange={e => handleOptionChange(idx, 'endTime', e.target.value)}
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      aria-label="Giờ kết thúc"
                    />
                    <input
                      type="text"
                      value={opt.optionLabel}
                      onChange={e => handleOptionChange(idx, 'optionLabel', e.target.value)}
                      placeholder="VD: Tối Thứ 2 (19:30 - 21:00)"
                      className="col-span-2 sm:col-span-1 min-w-0 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePollOption(idx)}
                      disabled={pollOptions.length <= 2}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddPollOption}
                  className="w-full py-1.5 border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-100/50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm ca học khác</span>
                </button>
              </div>
            </div>
          )}

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
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Đang lưu...' : (editingPost ? 'Lưu thay đổi' : 'Đăng bài viết')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePostModal;
