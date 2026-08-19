import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calendar, Clock, DollarSign, Globe, Info, Key, MapPin,
  Users, Video, X, UserRound, ArrowRight, ShieldCheck, CheckCircle2
} from 'lucide-react';

const VIETNAMESE_DAYS = [
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 8, label: 'CN' }
];

export function PublicClassDetailModal({ classRoom, onClose }) {
  const navigate = useNavigate();

  if (!classRoom) return null;

  const realFullName = classRoom.tutorFullName || 'Chưa đồng bộ tên giảng viên';
  const tutorProfileId = classRoom.tutorProfileId;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-black uppercase tracking-wider">
                {classRoom.registration?.subjectName || 'Môn học'} &bull; {classRoom.level?.name || 'Cấp độ'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-emerald-600" /> Đang tuyển sinh
              </span>
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

        {/* Specifications Grid */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-4 h-4 text-brand-primary" /> Thông số chi tiết lớp học:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700 counter-reset">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Học phí / buổi</span>
              <strong className="text-brand-primary text-base font-black">{classRoom.pricePerSession?.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng khóa học</span>
              <strong className="text-slate-900 font-bold text-xs">{classRoom.totalSessions} buổi ({classRoom.totalPrice?.toLocaleString('vi-VN')} đ)</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Sĩ số tối đa</span>
              <strong className="text-slate-900 font-bold text-xs">{classRoom.maxStudents} học viên</strong>
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
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!tutorProfileId}
            onClick={() => {
              onClose();
              if (tutorProfileId) {
                navigate(`/tutors/${tutorProfileId}`);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{tutorProfileId ? 'Khám phá thêm Lớp & Gia sư' : 'Thiếu liên kết hồ sơ gia sư'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
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
