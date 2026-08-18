import { useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileText, X, XCircle } from 'lucide-react';

const STATUS = {
  PENDING: { label: 'Chờ duyệt', className: 'border-amber-100 bg-amber-50 text-amber-700', icon: Clock3 },
  APPROVED: { label: 'Đã duyệt', className: 'border-emerald-100 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  REJECTED: { label: 'Bị từ chối', className: 'border-red-100 bg-red-50 text-red-700', icon: XCircle }
};

export function TeachingRegistrationHistory({ registrations, suggestions = [] }) {
  const [selected, setSelected] = useState(null);

  const standardRegistrations = registrations.filter(item => item.subject !== null);
  const proposedRegistrations = registrations.filter(item => item.subject === null);

  if (!standardRegistrations.length && !proposedRegistrations.length && !suggestions.length) return null;

  return <>
    <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-extrabold text-slate-950">Danh sách hồ sơ đã nộp</h2>
      <p className="mt-2 text-sm font-semibold text-slate-500">Hiển thị thông tin chính và trạng thái từng môn. Bấm vào hồ sơ để xem toàn bộ chi tiết.</p>

      {standardRegistrations.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {standardRegistrations.map((item) => (
            <RegistrationSummary key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </div>
      ) : (
        <p className="mt-5 text-xs font-semibold text-slate-400">Không có hồ sơ môn học có sẵn nào.</p>
      )}

      {(proposedRegistrations.length > 0 || suggestions.length > 0) && (
        <div className="mt-8 border-t border-slate-200 pt-5">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Môn mới đang đề xuất</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {proposedRegistrations.map((item) => (
              <button 
                key={`prop-${item.id}`} 
                type="button" 
                onClick={() => setSelected(item)} 
                className="w-full text-left rounded-[8px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#147b77] hover:shadow-sm focus:outline-none"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-950 truncate">{item.proposedSubjectName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 truncate">Trình độ: {item.proposedLevelName}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                      Kinh nghiệm: {item.experienceYears} năm · Học phí: {money(item.tuitionMin)} - {money(item.tuitionMax)}đ
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                    item.status === 'APPROVED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' :
                    item.status === 'REJECTED' ? 'border-red-100 bg-red-50 text-red-700' :
                    'border-amber-100 bg-amber-50 text-amber-700'
                  }`}>
                    {item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
                  </span>
                </div>
                {item.status === 'REJECTED' && item.rejectReason && (
                  <p className="mt-2 border-t border-rose-100 pt-1.5 text-[11px] font-semibold text-rose-600 line-clamp-1">
                    Lý do: {item.rejectReason}
                  </p>
                )}
              </button>
            ))}

            {suggestions.map((item) => (
              <article key={`sug-${item.id}`} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <p className="font-extrabold text-slate-950 truncate">{item.subjectName} · {item.levelName}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  {item.status === 'APPROVED' ? 'Đã thêm vào danh mục' : item.status === 'REJECTED' ? 'Không được chấp nhận' : 'Admin đang xem xét'}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>

    {selected && <RegistrationDetailModal item={selected} onClose={() => setSelected(null)} />}
  </>;
}

function RegistrationSummary({ item, onOpen }) {
  const config = STATUS[item.status] || STATUS.PENDING;
  const Icon = config.icon;
  return <button type="button" onClick={onOpen} className="w-full rounded-[8px] border border-slate-200 p-4 text-left transition hover:border-[#147b77] hover:shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-display text-lg font-extrabold text-slate-950">{item.subject?.name || item.proposedSubjectName || 'Môn học'}</p><span className="text-slate-300">·</span><p className="font-extrabold text-slate-700">{levelNames(item)}</p></div><p className="mt-2 text-xs font-semibold text-slate-500">{item.category?.name || 'Chưa có nhóm môn'} · {item.experienceYears ?? 0} năm kinh nghiệm · {money(item.tuitionMin)} - {money(item.tuitionMax)}đ/buổi</p><p className="mt-2 text-xs font-semibold text-slate-400">Nộp lúc {dateTime(item.submittedAt)} · {item.evidence?.length || 0} minh chứng</p></div><div className="flex shrink-0 items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold ${config.className}`}><Icon size={14} /> {config.label}</span><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><Eye size={16} /></span></div></div></button>;
}

function RegistrationDetailModal({ item, onClose }) {
  const config = STATUS[item.status] || STATUS.PENDING;
  const Icon = config.icon;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" onClick={onClose}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[12px] bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-[#147b77]">Chi tiết hồ sơ môn dạy</p><h3 className="mt-2 font-display text-2xl font-extrabold text-slate-950">{item.subject?.name || item.proposedSubjectName || 'Môn học'} · {levelNames(item)}</h3></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={18} /></button></div><div className="mt-5 flex flex-wrap gap-3"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold ${config.className}`}><Icon size={14} /> {config.label}</span><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600">Mã hồ sơ #{item.id}</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Chương trình" value={item.programType?.name} /><Detail label="Cấp học" value={item.educationLevel?.name} /><Detail label="Nhóm môn" value={item.category?.name} /><Detail label="Môn và các lớp" value={`${item.subject?.name || item.proposedSubjectName || ''} · ${levelNames(item)}`} /><Detail label="Kinh nghiệm" value={`${item.experienceYears ?? 0} năm`} /><Detail label="Học phí" value={`${money(item.tuitionMin)} - ${money(item.tuitionMax)}đ/buổi`} /><Detail label="Ngày nộp" value={dateTime(item.submittedAt)} /><Detail label="Ngày duyệt" value={item.reviewedAt ? dateTime(item.reviewedAt) : 'Chưa duyệt'} /></div><section className="mt-6 rounded-[8px] border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Mô tả năng lực</p><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{item.description || 'Không có mô tả'}</p></section><section className="mt-4 rounded-[8px] border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Minh chứng ({item.evidence?.length || 0})</p><div className="mt-3 grid gap-2">{item.evidence?.length ? item.evidence.map((evidence) => <div key={evidence.id} className="flex items-center gap-3 rounded-[8px] bg-slate-50 p-3"><FileText size={17} className="shrink-0 text-primary" /><div><p className="text-sm font-extrabold text-slate-900">{evidence.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">Mã tài liệu: {evidence.accountDocumentId || 'Không có'}</p></div></div>) : <p className="text-sm font-semibold text-slate-500">Không có minh chứng.</p>}</div></section>{item.rejectReason && <section className="mt-4 rounded-[8px] border border-red-100 bg-red-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-red-700">Lý do từ chối</p><p className="mt-2 text-sm font-semibold text-red-800">{item.rejectReason}</p></section>}{item.reviewNote && <section className="mt-4 rounded-[8px] border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-blue-700">Ghi chú của Admin</p><p className="mt-2 text-sm font-semibold text-blue-800">{item.reviewNote}</p></section>}</div></div>;
}

function levelNames(item) {
  if (item.proposedLevelName) return item.proposedLevelName;
  const names = (item.levels || []).map((level) => level.name).filter(Boolean);
  return names.length ? names.join(', ') : 'Chưa có lớp / trình độ';
}

function Detail({ label, value }) {
  return <div className="rounded-[8px] bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-sm font-extrabold text-slate-800">{value || 'Chưa có'}</p></div>;
}

function money(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
