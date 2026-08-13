import { Edit3, Trash2 } from 'lucide-react';

export function ApplicationSubjectCard({ item, readOnly, busy, onEdit, onDelete }) {
  const categoryName = item.subject?.category?.name || item.subject?.category || 'Chưa phân loại';

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold text-slate-950">{item.subject?.name}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">{categoryName}</p>
          {item.levels?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.levels.map((level) => (
                <span key={level} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary">
                  {levelLabels[level] || level}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm font-extrabold text-slate-800">
            {formatVnd(item.oneToOneHourlyRate)} / giờ · {item.experienceYears ?? 0} năm kinh nghiệm
          </p>
          {item.description ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-slate-400">Chưa có mô tả kinh nghiệm.</p>
          )}
        </div>

        {!readOnly && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onEdit(item)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              <Edit3 size={15} />
              Sửa
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[8px] border border-red-100 bg-red-50 px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 size={15} />
              Xóa
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};

function formatVnd(value) {
  const numericValue = Number(value || 0);
  return `${new Intl.NumberFormat('vi-VN').format(numericValue)}đ`;
}
