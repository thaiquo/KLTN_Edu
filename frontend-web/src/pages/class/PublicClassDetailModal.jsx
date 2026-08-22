import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calendar, Clock, DollarSign, Globe, Info, Key, MapPin,
  Users, Video, X, UserRound, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const VIETNAMESE_DAYS = [
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 8, label: 'CN' }
];

function checkProfileCompletion(user) {
  if (!user) return { isComplete: false, missingFields: ['Chưa đăng nhập'] };

  const hasName = Boolean(user.fullName && user.fullName.trim());
  const hasPhone = Boolean(user.phone && user.phone.trim());
  const hasDob = Boolean(user.dateOfBirth);
  const hasAddress = Boolean(user.province || user.commune || user.ward || user.address);

  const missingFields = [];
  if (!hasName) missingFields.push('Họ và tên');
  if (!hasPhone) missingFields.push('Số điện thoại');
  if (!hasDob) missingFields.push('Ngày sinh');
  if (!hasAddress) missingFields.push('Địa chỉ');

  const isComplete = hasName && hasPhone && hasDob && hasAddress;
  return { isComplete, missingFields };
}

export function PublicClassDetailModal({ classRoom, onClose, onRefreshClass }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [myRequest, setMyRequest] = React.useState(null);
  const [showInviteKeyForm, setShowInviteKeyForm] = React.useState(false);
  const [joinKey, setJoinKey] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [enrollSuccess, setEnrollSuccess] = React.useState('');
  const [enrollError, setEnrollError] = React.useState('');
  const [profileWarning, setProfileWarning] = React.useState(null);

  const profileCheck = React.useMemo(() => checkProfileCompletion(user), [user]);

  const fetchMyRequestStatus = React.useCallback(async () => {
    if (!user || !classRoom?.id) return;
    try {
      const { classApi } = await import('../../api/classes');
      const requests = await classApi.getMyEnrollmentRequests();
      if (Array.isArray(requests)) {
        const active = requests.find(r => r.classRoomId === classRoom.id && r.status !== 'CANCELLED');
        setMyRequest(active || null);
      }
    } catch (err) {
      console.error('Failed to load my request status', err);
    }
  }, [user, classRoom?.id]);

  React.useEffect(() => {
    fetchMyRequestStatus();
  }, [fetchMyRequestStatus]);

  if (!classRoom) return null;

  const realFullName = classRoom.tutorFullName || 'Chưa đồng bộ tên giảng viên';
  const tutorProfileId = classRoom.tutorProfileId;

  const handleEnrollSubmit = async (e) => {
    if (e) e.preventDefault();
    setEnrollError('');
    setEnrollSuccess('');
    setProfileWarning(null);

    // Profile Completeness Enforcement Check
    if (!profileCheck.isComplete) {
      setProfileWarning(profileCheck.missingFields);
      return;
    }

    setSubmitting(true);
    try {
      const { classApi } = await import('../../api/classes');
      const studentName = user?.fullName || user?.name || user?.email || 'Học viên';
      await classApi.enrollClass(classRoom.id, {
        joinKey: classRoom.joinMode === 'INVITE_KEY' ? joinKey.trim() : undefined,
        studentName: studentName
      });
      setEnrollSuccess('Gửi yêu cầu tham gia thành công! Vui lòng chờ Gia sư duyệt.');
      setShowInviteKeyForm(false);
      await fetchMyRequestStatus();
      if (onRefreshClass) onRefreshClass();
    } catch (err) {
      setEnrollError(err?.message || 'Không thể gửi yêu cầu. Vui lòng kiểm tra lại!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!myRequest) return;
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi yêu cầu tham gia lớp học này?')) return;
    setSubmitting(true);
    setEnrollError('');
    setEnrollSuccess('');
    try {
      const { classApi } = await import('../../api/classes');
      await classApi.cancelEnrollmentRequest(myRequest.id);
      setEnrollSuccess('Đã thu hồi yêu cầu tham gia thành công!');
      setMyRequest(null);
      await fetchMyRequestStatus();
      if (onRefreshClass) onRefreshClass();
    } catch (err) {
      setEnrollError(err?.message || 'Không thể thu hồi yêu cầu tham gia.');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptedCount = classRoom.acceptedCount != null ? classRoom.acceptedCount : 0;
  const availableSlots = classRoom.availableSlots != null ? classRoom.availableSlots : Math.max(0, classRoom.maxStudents - acceptedCount);
  const isFull = acceptedCount >= classRoom.maxStudents || classRoom.status === 'LOCKED' || classRoom.status === 'CLOSED';
  const isTemporarilyFull = !isFull && classRoom.isBufferPoolFull;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-black uppercase tracking-wider">
                {classRoom.registration?.subjectName || 'Môn học'} &bull; {classRoom.level?.name || 'Cấp độ'}
              </span>
              {isFull ? (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  Đã Khóa / Đủ sĩ số
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" /> Đang tuyển sinh
                </span>
              )}
              {classRoom.joinMode === 'INVITE_KEY' && (
                <span className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-sky-600" /> Yêu cầu Mã mời
                </span>
              )}
            </div>
            <h2 className="font-display font-black text-2xl text-slate-900 pt-1">
              {classRoom.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:bg-slate-100 font-bold transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tutor Owner Card Info Banner */}
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-base border border-white/20 shrink-0">
              {getInitials(realFullName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg text-white">{realFullName}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <ShieldCheck className="w-3 h-3" /> Đã xác minh
                </span>
              </div>
              <p className="text-xs text-slate-300 font-semibold">Gia sư đã được xác minh trên Kết Nối Học</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!tutorProfileId}
            onClick={() => {
              onClose();
              if (tutorProfileId) {
                navigate(`/tutors/${tutorProfileId}`);
              }
            }}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserRound className="w-3.5 h-3.5 text-brand-primary" />
            <span>{tutorProfileId ? 'Xem trang Gia sư & Các lớp khác' : 'Chưa có liên kết hồ sơ gia sư'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Profile Incomplete Warning Banner */}
        {profileWarning && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span>YÊU CẦU HOÀN THIỆN HỒ SƠ CÁ NHÂN TRƯỚC KHI NỘP ĐƠN</span>
            </div>
            <p className="text-[11px] text-amber-800 font-semibold">
              Để đảm bảo tính xác thực khi tham gia lớp học, bạn cần cập nhật đầy đủ thông tin cá nhân trong hồ sơ trước khi gửi yêu cầu.
            </p>
            <div className="text-[11px] text-amber-900 font-bold">
              Các mục còn thiếu: <span className="text-rose-700 font-extrabold">{profileWarning.join(', ')}</span>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/profile');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
              >
                <UserRound className="w-4 h-4" />
                <span>Cập nhật Hồ sơ cá nhân ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Student Active Request Status Banner */}
        {myRequest && (
          <div>
            {myRequest.status === 'PENDING' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-black text-amber-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" /> Bạn đã gửi yêu cầu tham gia lớp này (Đang chờ Gia sư duyệt)
                  </span>
                  <p className="text-[11px] text-amber-700 font-medium">
                    Gửi lúc: {new Date(myRequest.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCancelRequest}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs shrink-0 disabled:opacity-50"
                >
                  {submitting ? 'Đang thu hồi...' : 'Thu hồi yêu cầu'}
                </button>
              </div>
            )}

            {myRequest.status === 'ACCEPTED' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-black text-emerald-900 text-xs block">
                    🎉 Bạn đã được Gia sư chấp nhận tham gia lớp học này!
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Chào mừng bạn đến với lớp học. Vui lòng xem thông tin lịch học và địa điểm bên dưới.
                  </span>
                </div>
              </div>
            )}

            {myRequest.status === 'REJECTED' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                <span className="font-black text-rose-900 text-xs flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" /> Yêu cầu tham gia trước đó của bạn đã bị từ chối
                </span>
                {myRequest.rejectReason && (
                  <p className="text-[11px] text-rose-700 font-medium">Lý do: {myRequest.rejectReason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Global Action Messages */}
        {enrollSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold">
            {enrollSuccess}
          </div>
        )}
        {enrollError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold">
            {enrollError}
          </div>
        )}

        {/* Specifications Grid */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-4 h-4 text-brand-primary" /> Thông số chi tiết & Tình trạng slot:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Học phí / buổi</span>
              <strong className="text-brand-primary text-base font-black">{classRoom.pricePerSession?.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Sĩ số & Chỗ trống</span>
              <strong className="text-slate-900 font-bold text-xs">
                {acceptedCount} / {classRoom.maxStudents} HV (Còn {availableSlots} chỗ)
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tần suất & Thời lượng</span>
              <strong className="text-slate-900 font-bold text-xs">{classRoom.sessionsPerWeek} buổi/tuần ({classRoom.durationPerSessionMinutes} phút)</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Hình thức học</span>
              <strong className="text-slate-900 font-bold text-xs">{classRoom.learningMode === 'ONLINE' ? 'Học Online' : 'Học Offline'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời gian học</span>
              <strong className="text-slate-900 font-bold text-xs">{classRoom.startDate} ➔ {classRoom.endDate}</strong>
            </div>
          </div>
        </div>

        {/* Weekly Schedules */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand-primary" /> Lịch học cố định hàng tuần:
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {classRoom.schedules && classRoom.schedules.length > 0 ? (
              classRoom.schedules.map((s) => {
                const dayLabel = VIETNAMESE_DAYS.find((d) => d.value === s.dayOfWeek)?.label || `T${s.dayOfWeek}`;
                return (
                  <span key={s.id} className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                    {dayLabel}: {s.startTime} - {s.endTime}
                  </span>
                );
              })
            ) : (
              <span className="text-slate-400 italic text-xs">Lịch học linh hoạt theo thỏa thuận.</span>
            )}
          </div>
        </div>

        {/* Detailed Description */}
        <div className="space-y-1">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
            Mô tả chi tiết lớp học:
          </label>
          <p className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-medium">
            {classRoom.description || 'Chưa có thông tin mô tả.'}
          </p>
        </div>

        {/* Location / Meeting link note */}
        <div className="space-y-1">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
            {classRoom.learningMode === 'ONLINE' ? 'Hình thức lớp học Online:' : 'Địa điểm học Offline:'}
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2">
            {classRoom.learningMode === 'ONLINE' ? (
              <>
                <Video className="w-4 h-4 text-brand-primary shrink-0" />
                <span>Học trực tuyến qua Google Meet / Zoom (Link được gửi khi vào lớp)</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{classRoom.address || 'Học tại nhà / địa điểm thỏa thuận của gia sư'}</span>
              </>
            )}
          </div>
        </div>

        {/* Syllabus / Chapters */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-brand-primary" /> Lộ trình bài giảng ({classRoom.chapters?.length || 0} chương):
          </label>
          {classRoom.chapters && classRoom.chapters.length > 0 ? (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {classRoom.chapters.map((ch, i) => (
                <div key={ch.id || i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                      {ch.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">{ch.expectedSessions} buổi</span>
                  </div>
                  {ch.description && <p className="text-[11px] text-slate-600 font-medium pl-5">{ch.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic text-xs">Lộ trình giảng dạy chi tiết đang được cập nhật.</p>
          )}
        </div>

        {/* Invite Key Form Dropdown (only shown when class has INVITE_KEY mode) */}
        {showInviteKeyForm && classRoom.joinMode === 'INVITE_KEY' && (
          <form onSubmit={handleEnrollSubmit} className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3 animate-in fade-in">
            <h3 className="text-xs font-black text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-sky-600" /> Nhập Mã mời để tham gia lớp học
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mã mời (Invite Key) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={joinKey}
                onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
                placeholder="Vui lòng nhập mã mời"
                className="w-full px-3 py-2 text-xs font-bold border border-sky-300 rounded-xl bg-white focus:border-sky-500 outline-none uppercase tracking-wider"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowInviteKeyForm(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-black text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Đang xác minh...' : 'Xác nhận nộp đơn'}
              </button>
            </div>
          </form>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
          >
            Đóng
          </button>

          {!myRequest || myRequest.status === 'CANCELLED' || myRequest.status === 'REJECTED' ? (
            classRoom.joinMode === 'INVITE_KEY' ? (
              !showInviteKeyForm && (
                <button
                  type="button"
                  disabled={isFull || isTemporarilyFull || submitting}
                  onClick={() => {
                    if (!profileCheck.isComplete) {
                      setProfileWarning(profileCheck.missingFields);
                    } else {
                      setShowInviteKeyForm(true);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-black hover:bg-sky-700 transition-all shadow-md flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  <Key className="w-4 h-4" />
                  <span>
                    {isFull
                      ? 'Lớp đã đủ sĩ số'
                      : isTemporarilyFull
                      ? 'Tạm đủ số lượng'
                      : 'Nhập Mã mời & Tham gia lớp'}
                  </span>
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={isFull || isTemporarilyFull || submitting}
                onClick={() => handleEnrollSubmit()}
                className="px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-black hover:bg-brand-primary/90 transition-all shadow-md flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <span>
                  {isFull
                    ? 'Lớp đã đủ sĩ số'
                    : isTemporarilyFull
                    ? 'Tạm đủ số lượng'
                    : submitting
                    ? 'Đang gửi yêu cầu...'
                    : 'Gửi yêu cầu tham gia lớp'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )
          ) : myRequest.status === 'PENDING' ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleCancelRequest}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Đang thu hồi...' : 'Thu hồi yêu cầu'}</span>
            </button>
          ) : (
            <span className="px-4 py-2 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đã tham gia lớp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getInitials(value) {
  return (value || 'Tutor')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
