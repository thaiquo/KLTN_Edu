export function StepPlaceholder({ icon, eyebrow, title, description, application, readOnly }) {
  return (
    <section>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">{eyebrow}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-7 rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-6">
        <p className="text-sm font-extrabold text-slate-900">Development placeholder</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          Backend application #{application?.id} đang là source of truth. Không có dữ liệu giả và không lưu localStorage.
        </p>
        <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
          {readOnly ? 'Chỉ đọc theo trạng thái backend' : 'Editable shell'}
        </span>
      </div>
    </section>
  );
}
