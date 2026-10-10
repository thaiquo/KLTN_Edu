import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  AlertCircle,
  Megaphone,
  BarChart3,
  GraduationCap,
  BookOpen,
  Info,
  Video,
  MapPin,
  RefreshCw,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import communityApi from '../../api/community';
import { useFeedback } from '../feedback/useFeedback';
import { subjectApi } from '../../api/subjects';
import { teachingRegistrationApi } from '../../api/teachingRegistrations';
import { classApi } from '../../api/classes';

const POLL_PERIODS = [
  { timePeriod: 'MORNING', label: 'Sáng', startTime: '07:00', endTime: '13:00' },
  { timePeriod: 'AFTERNOON', label: 'Chiều', startTime: '13:00', endTime: '18:00' },
  { timePeriod: 'EVENING', label: 'Tối', startTime: '18:00', endTime: '23:00' }
];

const SLOT_TEMPLATES = Array.from({ length: 7 }, (_, index) => index + 1)
  .flatMap(dayOfWeek => POLL_PERIODS.map(period => ({ dayOfWeek, ...period })));

function removeDiacritics(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function generateOptionLabel(dayOfWeek, period) {
  return `${dayOfWeek === 7 ? 'Chủ nhật' : `Thứ ${dayOfWeek + 1}`} - ${period}`;
}

function buildSlot(template) {
  return {
    dayOfWeek: template.dayOfWeek,
    startTime: template.startTime,
    endTime: template.endTime,
    optionLabel: generateOptionLabel(template.dayOfWeek, template.label)
  };
}

const TUTOR_POST_TYPES = [
  {
    type: 'TUTOR_ANNOUNCEMENT',
    label: 'Thông báo / Chia sẻ',
    hint: 'Trao đổi, tư vấn lộ trình, thông báo buổi khảo sát',
    icon: Megaphone
  },
  {
    type: 'TUTOR_POLL',
    label: 'Khảo sát mở lớp',
    hint: 'Thăm dò ca học trước khi tạo lớp chính thức',
    icon: BarChart3
  },
  {
    type: 'TUTOR_CLASS_SHARE',
    label: 'Giới thiệu lớp có sẵn',
    hint: 'Gắn danh thiếp lớp để học viên gửi yêu cầu',
    icon: GraduationCap
  }
];

function formatCurrency(value) {
  if (!value) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(value));
}

function normalizeList(res) {
  return res?.data || res || [];
}

export function CreatePostModal({ isOpen, onClose, onPostCreated, userRole, editingPost = null }) {
  const navigate = useNavigate();
  const defaultType = userRole === 'TUTOR' ? 'TUTOR_ANNOUNCEMENT' : 'STUDENT_FIND_TUTOR';
  const feedback = useFeedback();

  const [postType, setPostType] = useState(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegId, setSelectedRegId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [educationLevel, setEducationLevel] = useState('Lớp 12');
  const [learningMode, setLearningMode] = useState('ONLINE');
  const [targetPrice, setTargetPrice] = useState('');
  const [address, setAddress] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [shareableClasses, setShareableClasses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeAnnouncementPreset, setActiveAnnouncementPreset] = useState(null);

  const pollQuestion = editingPost?.poll?.question || 'Bạn học được vào khung giờ nào dưới đây?';
  const [minVotesTarget, setMinVotesTarget] = useState(editingPost?.poll?.minVotesTarget || 10);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const hasVotes = (editingPost?.poll?.totalVotes || 0) > 0;

  const activeRegistration = useMemo(() => {
    return registrations.find(r => r.id === Number(selectedRegId)) || null;
  }, [registrations, selectedRegId]);

  const selectedLevel = useMemo(() => {
    return activeRegistration?.levels?.find(l => l.id === Number(selectedLevelId)) || null;
  }, [activeRegistration, selectedLevelId]);

  const selectedClass = useMemo(() => {
    return shareableClasses.find(item => String(item.id) === String(selectedClassId)) || null;
  }, [shareableClasses, selectedClassId]);

  const generateClassShareContent = (cls) => {
    if (!cls) return { title: '', content: '' };
    const modeLabel = cls.learningMode === 'ONLINE' ? 'Trực tuyến (Online)' : 'Trực tiếp (Offline)';
    const subName = cls.registration?.subjectName || cls.subjectName || '';
    const suggestedTitle = `[Tuyển sinh] ${cls.name} - Mở nhận học viên (${modeLabel})`;
    const suggestedContent = `Lớp học "${cls.name}" hiện đang mở tuyển sinh cho các bạn học viên có nhu cầu học tập và rèn luyện môn ${subName || 'học'}.

📅 Lịch học: ${cls.sessionsPerWeek || 2} buổi/tuần (${cls.durationPerSessionMinutes || 90} phút/buổi)
⏱ Khai giảng: ${cls.startDate || 'Sắp diễn ra'}
💰 Học phí: ${formatCurrency(cls.pricePerSession)} đ/buổi
👥 Sĩ số tối đa: ${cls.maxStudents || 20} học viên

Học viên quan tâm vui lòng xem chi tiết lớp học bên dưới và gửi yêu cầu đăng ký tham gia lớp nhé!`;
    return { title: suggestedTitle, content: suggestedContent };
  };

  const handleSelectClass = (clsId) => {
    setSelectedClassId(clsId);
  };

  const handleApplyClassTemplate = () => {
    if (!selectedClass) return;
    const { title: autoTitle, content: autoContent } = generateClassShareContent(selectedClass);
    setTitle(autoTitle);
    setContent(autoContent);
    feedback.success('Đã điền mẫu bài viết cho lớp học này.');
  };

  const handleGoToCreateClass = () => {
    onClose();
    navigate('/dashboard?tab=create-class');
  };

  const ANNOUNCEMENT_PRESETS = [
    {
      id: 'ANNOUNCEMENT',
      label: '📢 Thông báo chung',
      prefix: '[Thông báo] ',
      titlePlaceholder: 'Ví dụ: [Thông báo] Lịch nghỉ lễ và học bù trong tuần tới...',
      contentPlaceholder: 'Kính gửi quý phụ huynh và các em học viên, xin thông báo về kế hoạch học tập sắp tới...',
      prompt: 'Kính gửi quý phụ huynh và các em học viên,\n\n'
    },
    {
      id: 'SHARING',
      label: '💡 Kinh nghiệm học tập',
      prefix: '[Chia sẻ] ',
      titlePlaceholder: 'Ví dụ: [Chia sẻ] Bí quyết làm chủ môn Toán 12 trong 3 tháng...',
      contentPlaceholder: 'Chào các bạn học viên, hôm nay thầy/cô muốn chia sẻ một số bí quyết ôn tập và phân bổ thời gian làm bài...',
      prompt: 'Chào các bạn học viên, hôm nay thầy/cô muốn chia sẻ một số bí quyết ôn tập hiệu quả:\n\n'
    },
    {
      id: 'MATERIALS',
      label: '📚 Tài liệu ôn thi',
      prefix: '[Tài liệu] ',
      titlePlaceholder: 'Ví dụ: [Tài liệu] Tổng hợp bộ đề thi thử và đáp án chi tiết...',
      contentPlaceholder: 'Thầy/cô chia sẻ bộ tài liệu tự luyện, file PDF tóm tắt công thức trọng tâm...',
      prompt: 'Thầy/cô chia sẻ bộ tài liệu tổng hợp kiến thức và bài tập trọng tâm:\n\n'
    },
    {
      id: 'SCHEDULE',
      label: '🗓 Lịch học / Bù giờ',
      prefix: '[Lịch học] ',
      titlePlaceholder: 'Ví dụ: [Lịch học] Thông báo điều chỉnh ca học tuần này...',
      contentPlaceholder: 'Thông báo thay đổi thời gian học hoặc sắp xếp buổi học bù cho các bạn vắng tiết...',
      prompt: 'Thông báo điều chỉnh lịch học cho các lớp sắp tới:\n\n'
    }
  ];

  const handleApplyPreset = (preset) => {
    setActiveAnnouncementPreset(preset);
    setTitle(prev => {
      if (!prev.trim()) {
        return preset.prefix;
      }
      const clean = prev.replace(/^\[.*?\]\s*/, '');
      return clean ? `${preset.prefix}${clean}` : preset.prefix;
    });
  };

  const handleRegistrationChange = (regId) => {
    setSelectedRegId(regId);
    const reg = registrations.find(r => r.id === Number(regId));
    if (reg && Array.isArray(reg.levels) && reg.levels.length > 0) {
      setSelectedLevelId(reg.levels[0].id);
      setTargetPrice(String(reg.tuitionMin || 150000));
    } else {
      setSelectedLevelId('');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoadingOptions(true);
    setActiveAnnouncementPreset(null);
    setPostType(editingPost?.postType || defaultType);
    setTitle(editingPost?.title || '');
    setContent(editingPost?.content || '');
    setSubjectId(editingPost?.subjectId ? String(editingPost.subjectId) : '');
    setSelectedClassId(editingPost?.linkedClassId ? String(editingPost.linkedClassId) : '');
    setEducationLevel(editingPost?.educationLevel || 'Lớp 12');
    setLearningMode(editingPost?.learningMode || 'ONLINE');
    setTargetPrice(editingPost?.targetPricePerSession ? String(editingPost.targetPricePerSession) : '');
    setAddress(editingPost?.address || '');
    setSessionsPerWeek(editingPost?.poll?.sessionsPerWeek || 2);
    setDurationMinutes(editingPost?.poll?.durationMinutes || 90);
    setMinVotesTarget(editingPost?.poll?.minVotesTarget || 10);

    async function loadOptions() {
      try {
        const subjectList = normalizeList(await subjectApi.list());
        setSubjects(subjectList);

        if (userRole === 'TUTOR') {
          const [regs, classes] = await Promise.all([
            teachingRegistrationApi.mine().catch(() => []),
            classApi.getMyClasses().catch(() => [])
          ]);
          const approved = normalizeList(regs).filter(r => r.status === 'APPROVED');
          setRegistrations(approved);

          if (approved.length > 0) {
            let initialReg = approved[0];
            let initialLevelId = approved[0].levels?.[0]?.id || '';

            if (editingPost) {
              const matched = approved.find(r =>
                (editingPost.subjectId && r.subject?.id === editingPost.subjectId) ||
                (editingPost.subjectName && r.subject?.name?.toLowerCase() === editingPost.subjectName.toLowerCase())
              );
              if (matched) {
                initialReg = matched;
                const matchedLevel = matched.levels?.find(l => l.name === editingPost.educationLevel);
                if (matchedLevel) initialLevelId = matchedLevel.id;
              }
            }

            setSelectedRegId(initialReg.id);
            setSelectedLevelId(initialLevelId);
            if (!editingPost?.targetPricePerSession) {
              setTargetPrice(String(initialReg.tuitionMin || 150000));
            }
          }

          const today = new Date().toISOString().split('T')[0];
          const visibleClasses = normalizeList(classes)
            .filter(cls => {
              if (cls.status !== 'PUBLISHED') return false;
              if (cls.terminationCutoffSession != null) return false;
              if (!cls.startDate || cls.startDate < today) return false;
              return true;
            })
            .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
          setShareableClasses(visibleClasses);
          if (!editingPost?.linkedClassId && visibleClasses.length > 0) {
            setSelectedClassId(String(visibleClasses[0].id));
          }
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu tạo bài:', err);
        setError('Không thể tải dữ liệu môn/lớp. Vui lòng thử lại.');
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [isOpen, editingPost, userRole, defaultType]);

  useEffect(() => {
    if (!selectedClass || postType !== 'TUTOR_CLASS_SHARE') return;
    setLearningMode(selectedClass.learningMode || 'ONLINE');
    setEducationLevel(selectedClass.level?.name || selectedClass.registration?.educationLevelName || '');
    setTargetPrice(selectedClass.pricePerSession ? String(selectedClass.pricePerSession) : '');
    setAddress(selectedClass.address || '');
  }, [selectedClass, postType]);

  if (!isOpen) return null;

  const handleDurationChange = (newDuration) => {
    setDurationMinutes(Number(newDuration));
  };

  const handleSessionsPerWeekChange = (newSessions) => {
    setSessionsPerWeek(Number(newSessions));
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

    let finalSubjectId = null;
    let finalEducationLevel = null;
    let finalLearningMode = 'ONLINE';
    let finalTargetPrice = null;
    let finalAddress = null;

    if (userRole === 'TUTOR') {
      if (postType === 'TUTOR_CLASS_SHARE') {
        if (!selectedClass) {
          setError('Vui lòng chọn lớp đang tuyển sinh để giới thiệu');
          return;
        }
        finalSubjectId = null;
        finalEducationLevel = selectedClass.level?.name || selectedClass.registration?.educationLevelName || '';
        finalLearningMode = selectedClass.learningMode || 'ONLINE';
        finalTargetPrice = selectedClass.pricePerSession ? Number(selectedClass.pricePerSession) : null;
        finalAddress = selectedClass.address || null;
      } else if (postType === 'TUTOR_POLL') {
        if (!activeRegistration) {
          setError('Gia sư cần chọn môn học đã được duyệt để khảo sát mở lớp');
          return;
        }
        if (!selectedLevelId) {
          setError('Vui lòng chọn cấp độ / lớp cụ thể đã được duyệt');
          return;
        }
        const regSubName = activeRegistration.subject?.name || activeRegistration.proposedSubjectName || '';
        // Match subject from subjects list to ensure subjectId is valid in learning-service
        const matchedSub = subjects.find(s =>
          (activeRegistration.subject?.id && s.id === activeRegistration.subject.id) ||
          (s.name && regSubName && removeDiacritics(s.name) === removeDiacritics(regSubName)) ||
          (s.name && regSubName && (removeDiacritics(s.name).includes(removeDiacritics(regSubName)) || removeDiacritics(regSubName).includes(removeDiacritics(s.name))))
        );
        finalSubjectId = matchedSub?.id || activeRegistration.subject?.id || activeRegistration.id;
        finalEducationLevel = selectedLevel?.name || activeRegistration.levels?.[0]?.name || '';
        finalLearningMode = learningMode;
        finalTargetPrice = targetPrice ? Number(targetPrice) : null;
        if (learningMode === 'OFFLINE') {
          if (!address.trim()) {
            setError('Vui lòng nhập địa chỉ học trực tiếp (Offline)');
            return;
          }
          finalAddress = address.trim();
        }
      } else {
        // TUTOR_ANNOUNCEMENT: Thông báo / chia sẻ bình thường, hỗ trợ gắn thẻ môn học
        finalSubjectId = subjectId ? Number(subjectId) : null;
        finalEducationLevel = null;
        finalLearningMode = 'ONLINE';
        finalTargetPrice = null;
        finalAddress = null;
      }
    } else {
      // Học viên
      if (!subjectId) {
        setError('Vui lòng chọn môn học');
        return;
      }
      finalSubjectId = Number(subjectId);
      finalEducationLevel = educationLevel;
      finalLearningMode = learningMode;
      finalTargetPrice = targetPrice ? Number(targetPrice) : null;
      if (learningMode === 'OFFLINE') {
        if (!address.trim()) {
          setError('Vui lòng nhập địa chỉ học trực tiếp (Offline)');
          return;
        }
        finalAddress = address.trim();
      }
    }

    const payload = {
      postType,
      title: title.trim(),
      content: content.trim(),
      subjectId: finalSubjectId,
      educationLevel: finalEducationLevel,
      learningMode: finalLearningMode,
      targetPricePerSession: finalTargetPrice,
      address: finalAddress,
      linkedClassId: postType === 'TUTOR_CLASS_SHARE' ? Number(selectedClassId) : null
    };

    if (postType === 'TUTOR_POLL') {
      const selectedSlots = editingPost?.poll?.options && hasVotes
        ? editingPost.poll.options
        : SLOT_TEMPLATES.map(buildSlot);

      payload.poll = {
        question: pollQuestion.trim(),
        minVotesTarget: Math.max(1, Number(minVotesTarget) || 10),
        sessionsPerWeek: Number(sessionsPerWeek) || 2,
        durationMinutes: Number(durationMinutes) || 90,
        maxVotesPerUser: hasVotes ? (editingPost.poll.maxVotesPerUser || editingPost.poll.sessionsPerWeek || 2) : Number(sessionsPerWeek) || 2,
        options: selectedSlots.map(opt => ({
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
      feedback.success(editingPost ? 'Đã lưu chỉnh sửa bài viết thành công.' : 'Đã đăng bài viết thành công.');
      onPostCreated?.(saved);
      onClose();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Có lỗi xảy ra khi đăng bài');
    } finally {
      setSubmitting(false);
    }
  };

  const showTeachingFields = userRole === 'TUTOR' && postType !== 'TUTOR_CLASS_SHARE';
  const showStudentSubjectFields = userRole !== 'TUTOR';
  const showPriceAndMode = postType !== 'TUTOR_CLASS_SHARE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {editingPost ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới trên bảng tin'}
              </h3>
              <p className="text-xs text-slate-500">
                {userRole === 'TUTOR'
                  ? 'Chia sẻ thông báo, khảo sát mở lớp hoặc giới thiệu lớp đang tuyển sinh'
                  : 'Đăng nhu cầu tìm gia sư hoặc tìm bạn học nhóm'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Loại bài đăng</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {userRole === 'TUTOR' ? TUTOR_POST_TYPES.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    disabled={Boolean(editingPost)}
                    onClick={() => setPostType(item.type)}
                    className={`p-3 rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-80 ${postType === item.type
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.hint}</p>
                  </button>
                );
              }) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPostType('STUDENT_FIND_TUTOR')}
                    className={`p-3 rounded-xl border text-left transition ${postType === 'STUDENT_FIND_TUTOR'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                  >
                    <p className="text-xs font-bold">Tìm gia sư</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Đăng nhu cầu học cá nhân</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('STUDENT_GROUP_STUDY')}
                    className={`p-3 rounded-xl border text-left transition ${postType === 'STUDENT_GROUP_STUDY'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                  >
                    <p className="text-xs font-bold">Tìm bạn học chung</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Gom nhóm cùng học</p>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Phân hệ Gia sư - Giới thiệu lớp có sẵn (TUTOR_CLASS_SHARE) */}
          {userRole === 'TUTOR' && postType === 'TUTOR_CLASS_SHARE' && (
            <div className="space-y-4">
              {/* SECTION 1: CHỌN LỚP HỌC ĐANG TUYỂN SINH */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <span>1. Chọn lớp học đang tuyển sinh của bạn</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoToCreateClass}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Tạo lớp học mới</span>
                  </button>
                </div>

                {shareableClasses.length === 0 ? (
                  <div className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 border border-amber-200 space-y-2.5">
                    <p className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Chưa có lớp nào đang trong thời gian tuyển sinh
                    </p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Chỉ các lớp ở trạng thái <strong>PUBLISHED</strong> (chưa bị khóa, chưa qua ngày khai giảng và chưa dừng tuyển sinh) mới có thể gắn thẻ giới thiệu lên bài viết.
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={handleGoToCreateClass}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Bắt đầu tạo lớp học mới ngay</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedClassId}
                    onChange={e => handleSelectClass(e.target.value)}
                    disabled={loadingOptions}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Chọn một lớp học đang tuyển sinh --</option>
                    {shareableClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} &bull; {cls.registration?.subjectName || 'Môn học'} ({cls.level?.name || 'Cấp độ'}) &bull; Khai giảng: {cls.startDate || 'Sắp diễn ra'} &bull; {formatCurrency(cls.pricePerSession)} đ/buổi
                      </option>
                    ))}
                  </select>
                )}

                {selectedClass && (
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-600 text-white mb-1">
                          Lớp được gắn thẻ tuyển sinh
                        </span>
                        <h4 className="text-xs font-black text-indigo-950">{selectedClass.name}</h4>
                      </div>
                      <span className="text-xs font-black text-indigo-700 whitespace-nowrap">
                        {formatCurrency(selectedClass.pricePerSession)} đ/buổi
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1 border-t border-indigo-100">
                      <div>
                        <span className="block text-[10px] text-slate-400">Môn học & Cấp độ</span>
                        <span className="font-bold text-slate-800">{selectedClass.registration?.subjectName || 'Môn'} - {selectedClass.level?.name || 'Lớp'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">Hình thức</span>
                        <span className="font-bold text-slate-800">{selectedClass.learningMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">Khai giảng</span>
                        <span className="font-bold text-slate-800">{selectedClass.startDate || 'Sắp mở'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">Sĩ số tối đa</span>
                        <span className="font-bold text-slate-800">{selectedClass.maxStudents || 20} học viên</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: THÔNG TIN BÀI VIẾT GIỚI THIỆU */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>2. Thông tin bài viết giới thiệu</span>
                  </div>
                  {selectedClass && (
                    <button
                      type="button"
                      onClick={handleApplyClassTemplate}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                      title="Điền mẫu tiêu đề và nội dung bài viết theo thông tin lớp học này"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Điền mẫu gợi ý</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tiêu đề bài viết <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={
                      selectedClass
                        ? `Ví dụ: [Tuyển sinh] ${selectedClass.name} - Mở nhận học viên mới...`
                        : 'Ví dụ: [Tuyển sinh] Lớp Toán 10 còn 3 chỗ, gửi yêu cầu tham gia ngay...'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nội dung chi tiết / Lời mời tuyển sinh <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={
                      selectedClass
                        ? `Nhập lời giới thiệu, đối tượng phù hợp, ưu đãi... (Hoặc bấm "Điền mẫu gợi ý" ở góc trên để lấy văn bản mẫu)`
                        : 'Viết lời giới thiệu, đối tượng phù hợp, ưu đãi hoặc những điểm đặc biệt của lớp học này...'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phân hệ Gia sư - Thông báo / Chia sẻ thông thường (TUTOR_ANNOUNCEMENT) */}
          {userRole === 'TUTOR' && postType === 'TUTOR_ANNOUNCEMENT' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Gợi ý chủ đề nhanh (Bấm để chèn tiền tố & gợi ý nội dung)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ANNOUNCEMENT_PRESETS.map((preset) => {
                    const isSelected = activeAnnouncementPreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {registrations.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Môn học liên quan <span className="text-slate-400 font-normal">(Tùy chọn)</span>
                  </label>
                  <select
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Thông báo chung (Không gắn thẻ môn cụ thể) --</option>
                    {registrations.map(r => {
                      const subId = r.subject?.id || r.id;
                      const subName = r.subject?.name || r.proposedSubjectName || 'Môn học';
                      return (
                        <option key={r.id} value={subId}>
                          {subName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tiêu đề bài viết <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={
                    activeAnnouncementPreset
                      ? activeAnnouncementPreset.titlePlaceholder
                      : 'Ví dụ: [Thông báo] Lịch nghỉ lễ và học bù trong tuần tới...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nội dung thông báo / chia sẻ <span className="text-rose-500">*</span>
                  </label>
                  {activeAnnouncementPreset && (
                    <button
                      type="button"
                      onClick={() => setContent(prev => prev.trim() ? `${prev}\n\n${activeAnnouncementPreset.prompt}` : activeAnnouncementPreset.prompt)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                      title="Chèn lời mở đầu mẫu vào khung soạn thảo"
                    >
                      + Chèn mở đầu mẫu
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={
                    activeAnnouncementPreset
                      ? activeAnnouncementPreset.contentPlaceholder
                      : 'Chia sẻ nội dung thông báo, dặn dò học viên, thảo luận hoặc giải đáp thắc mắc...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* Phân hệ Gia sư - Khảo sát mở lớp (TUTOR_POLL) */}
          {userRole === 'TUTOR' && postType === 'TUTOR_POLL' && (
            <div className="space-y-4">
              {/* SECTION 1: NỘI DUNG GIẢNG DẠY (CHỈ CÁC MÔN/LỚP ĐÃ ĐƯỢC DUYỆT) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>1. Nội dung giảng dạy (Chỉ các môn/lớp đã được duyệt)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Môn học <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedRegId}
                      onChange={e => handleRegistrationChange(Number(e.target.value))}
                      disabled={loadingOptions || registrations.length === 0}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      {registrations.length === 0 ? (
                        <option value="">-- Chưa có môn học nào được duyệt --</option>
                      ) : (
                        registrations.map(r => {
                          const subName = r.subject?.name || r.proposedSubjectName || 'Môn học';
                          const levelsStr = r.levels?.map(l => l.name).join(', ') || '';
                          return (
                            <option key={r.id} value={r.id}>
                              {subName} {levelsStr ? `(${levelsStr})` : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Lớp / Cấp độ <span className="text-rose-500">* (Chọn 1 level cụ thể)</span>
                    </label>
                    <select
                      value={selectedLevelId}
                      onChange={e => setSelectedLevelId(Number(e.target.value))}
                      disabled={loadingOptions || !activeRegistration}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      {(!activeRegistration?.levels || activeRegistration.levels.length === 0) ? (
                        <option value="">-- Chọn 1 level cụ thể --</option>
                      ) : (
                        activeRegistration.levels.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Box hiển thị khoảng học phí đã được duyệt */}
                {activeRegistration && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      Khoảng học phí đã được duyệt cho môn này:
                    </span>
                    <span className="font-black text-indigo-700">
                      {activeRegistration.tuitionMin?.toLocaleString('vi-VN')} đ - {activeRegistration.tuitionMax?.toLocaleString('vi-VN')} đ / buổi
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 2: THÔNG TIN CHI TIẾT BÀI VIẾT */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>2. Thông tin chi tiết bài viết</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tiêu đề bài viết <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ví dụ: Khảo sát ca học môn Hóa 10 - Ôn tập học kỳ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mô tả chi tiết <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Mô tả mục tiêu khóa học, phương pháp giảng dạy, đối tượng học viên phù hợp hoặc câu hỏi thăm dò..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Học phí mỗi buổi (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={e => setTargetPrice(e.target.value)}
                      placeholder={activeRegistration?.tuitionMin ? String(activeRegistration.tuitionMin) : 'Ví dụ: 150000'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    {activeRegistration && (
                      <p className="mt-1 text-[11px] text-slate-400 font-medium">
                        Khoảng duyệt: {activeRegistration.tuitionMin?.toLocaleString('vi-VN')} đ - {activeRegistration.tuitionMax?.toLocaleString('vi-VN')} đ
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Hình thức học <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLearningMode('ONLINE')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${learningMode === 'ONLINE'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <Video className="w-4 h-4 text-indigo-600" />
                        <span>Học Online (Trực tuyến)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLearningMode('OFFLINE')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${learningMode === 'OFFLINE'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>Học Offline (Trực tiếp)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {learningMode === 'OFFLINE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Địa chỉ học trực tiếp <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Ví dụ: 123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* SECTION 3: THÔNG SỐ LỚP DỰ KIẾN KHẢO SÁT */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>3. Kế hoạch học dự kiến</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số buổi / tuần dự kiến <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={sessionsPerWeek}
                      disabled={hasVotes}
                      onChange={e => handleSessionsPerWeekChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 disabled:bg-slate-100 font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value={1}>1 buổi / tuần</option>
                      <option value={2}>2 buổi / tuần</option>
                      <option value={3}>3 buổi / tuần</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Thời lượng mỗi buổi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={durationMinutes}
                      disabled={hasVotes}
                      onChange={e => handleDurationChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 disabled:bg-slate-100 font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value={60}>60 phút / buổi</option>
                      <option value={90}>90 phút / buổi</option>
                      <option value={120}>120 phút / buổi</option>
                      <option value={150}>150 phút / buổi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mục tiêu học viên tham khảo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={minVotesTarget}
                      disabled={hasVotes}
                      onChange={e => setMinVotesTarget(Math.max(1, Number(e.target.value) || 0))}
                      onBlur={() => setMinVotesTarget(prev => Math.max(1, Number(prev) || 10))}
                      placeholder="Mặc định: 10"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 disabled:bg-slate-100 font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">Mốc tham khảo (mặc định 10 người)</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-950">Tự động kích hoạt bảng khảo sát ca học</p>
                    <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                      Hệ thống sẽ tự động tạo bảng bình chọn đầy đủ các ca học sáng, chiều và tối trong tuần. Học viên sẽ trực tiếp tick chọn ca rảnh trên bài đăng để bạn tham khảo trước khi chốt mở lớp.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phân hệ Học viên (userRole !== 'TUTOR') */}
          {userRole !== 'TUTOR' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Môn học <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Chọn môn học --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cấp độ / Lớp <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={educationLevel}
                    onChange={e => setEducationLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="Lớp 10">Lớp 10</option>
                    <option value="Lớp 11">Lớp 11</option>
                    <option value="Lớp 12">Lớp 12</option>
                    <option value="Đại học">Đại học</option>
                    <option value="Luyện thi ĐGNL">Luyện thi ĐGNL</option>
                    <option value="Lập trình / Công nghệ">Lập trình / Công nghệ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tiêu đề bài viết <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Cần tìm gia sư kèm Toán 12 ôn thi ĐGNL khu vực Bình Thạnh..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nội dung chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Mô tả mục tiêu học tập, yêu cầu về gia sư, thời gian rảnh hoặc địa điểm..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ngân sách mong muốn (VNĐ/buổi)
                  </label>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={e => setTargetPrice(e.target.value)}
                    placeholder="Ví dụ: 150000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Hình thức học <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLearningMode('ONLINE')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${learningMode === 'ONLINE'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <Video className="w-4 h-4 text-indigo-600" />
                      <span>Học Online (Trực tuyến)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLearningMode('OFFLINE')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${learningMode === 'OFFLINE'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Học Offline (Trực tiếp)</span>
                    </button>
                  </div>
                </div>
              </div>

              {learningMode === 'OFFLINE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Địa chỉ học trực tiếp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Ví dụ: Quận Gò Vấp, TP.HCM"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              )}
            </div>
          )}

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
              disabled={submitting || loadingOptions}
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
