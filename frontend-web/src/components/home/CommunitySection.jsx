import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, RefreshCw, Users } from 'lucide-react';
import { TutorCard } from './TutorCard';
import { ClassRequestRow } from './ClassRequestRow';

export function CommunitySection({ data }) {
  const [activeTab, setActiveTab] = useState('tutors');
  const tutors = data?.tutors || [];
  const classes = data?.classes || [];
  const loading = Boolean(data?.loading);

  return (
    <section className="bg-bg py-[clamp(88px,10vw,144px)] scroll-mt-[90px]" id="community" aria-labelledby="community-title">
      <div className="container-app">
        <div className="flex items-end justify-between gap-7 reveal max-[760px]:flex-col max-[760px]:items-start">
          <div className="grid gap-3.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[.22em] text-primary">Dữ liệu đang hoạt động</span>
            <h2 id="community-title" className="font-display text-[clamp(34px,5vw,62px)] font-extrabold leading-[.98] tracking-tight">
              Khám phá cơ hội học tập<br className="hidden md:block" /> trên EduConnect
            </h2>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              Gia sư và lớp học bên dưới được tải trực tiếp từ hệ thống, không phải nội dung minh họa cố định.
            </p>
          </div>
          <Link className="inline-flex items-center gap-2 whitespace-nowrap border-b border-slate-900 pb-1.5 text-[13px] font-extrabold transition-colors hover:border-primary hover:text-primary" to={activeTab === 'tutors' ? '/tutors' : '/classes'}>
            Xem tất cả <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:max-w-md">
          <MetricCard icon={<Users size={18} />} value={data?.tutorTotal} label="Gia sư công khai" loading={loading} />
          <MetricCard icon={<BookOpen size={18} />} value={data?.classTotal} label="Lớp đang mở" loading={loading} />
        </div>

        <div className="mb-6 mt-8 inline-flex gap-1 rounded-[14px] border border-slate-200 bg-slate-100 p-1.5" role="tablist" aria-label="Khám phá EduConnect">
          {[
            { id: 'tutors', label: 'Gia sư nổi bật' },
            { id: 'classes', label: 'Lớp mới cập nhật' }
          ].map((tab) => (
            <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`} onClick={() => setActiveTab(tab.id)} className={`min-h-9 rounded-[10px] px-4 text-[12px] font-extrabold transition-all duration-200 ${activeTab === tab.id ? 'bg-white text-primary shadow-[0_8px_18px_rgba(15,23,42,.07)]' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingGrid />
        ) : activeTab === 'tutors' ? (
          <div className="grid grid-cols-3 gap-6 max-[920px]:grid-cols-2 max-[760px]:flex max-[760px]:snap-x max-[760px]:gap-3.5 max-[760px]:overflow-x-auto max-[760px]:pb-3" id="panel-tutors" role="tabpanel" aria-labelledby="tab-tutors">
            {tutors.length > 0 ? tutors.map((tutor) => (
              <div key={tutor.tutorId} className="max-[920px]:last:col-span-2 max-[920px]:last:max-w-[360px] max-[760px]:w-[min(300px,82vw)] max-[760px]:flex-none max-[760px]:snap-start max-[920px]:last:max-w-none">
                <TutorCard tutor={tutor} />
              </div>
            )) : <EmptyPanel type="tutors" hasError={data?.hasError} />}
          </div>
        ) : (
          <div className="grid gap-3.5" id="panel-classes" role="tabpanel" aria-labelledby="tab-classes">
            {classes.length > 0 ? classes.map((item) => <ClassRequestRow item={item} key={item.id} />) : <EmptyPanel type="classes" hasError={data?.hasError} />}
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({ icon, value, label, loading }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-primary">{icon}</span>
      <span><strong className="block font-display text-xl font-extrabold text-slate-950">{loading ? '—' : new Intl.NumberFormat('vi-VN').format(Number(value || 0))}</strong><small className="text-[11px] font-bold text-slate-500">{label}</small></span>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-3 gap-6 max-[920px]:grid-cols-2 max-[760px]:grid-cols-1" aria-label="Đang tải dữ liệu khám phá">
      {[0, 1, 2].map((item) => <div key={item} className="h-[390px] animate-pulse rounded-[28px] border border-slate-200 bg-white p-4"><div className="h-48 rounded-2xl bg-slate-100" /><div className="mt-5 h-5 w-2/3 rounded bg-slate-100" /><div className="mt-3 h-4 rounded bg-slate-100" /><div className="mt-2 h-4 w-4/5 rounded bg-slate-100" /></div>)}
    </div>
  );
}

function EmptyPanel({ type, hasError }) {
  return (
    <div className="col-span-full flex min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 text-center">
      <RefreshCw size={24} className="text-primary" />
      <h3 className="mt-4 font-display text-xl font-extrabold text-slate-950">{hasError ? 'Chưa thể tải dữ liệu' : type === 'tutors' ? 'Chưa có gia sư công khai' : 'Chưa có lớp đang mở'}</h3>
      <p className="mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-500">{hasError ? 'Một nguồn dữ liệu đang tạm thời không phản hồi. Bạn có thể mở trang danh sách để thử lại.' : 'Dữ liệu mới sẽ xuất hiện tại đây sau khi hoàn tất quy trình xét duyệt.'}</p>
      <Link to={type === 'tutors' ? '/tutors' : '/classes'} className="mt-5 text-sm font-extrabold text-primary hover:text-primary-dark">Mở trang danh sách</Link>
    </div>
  );
}
