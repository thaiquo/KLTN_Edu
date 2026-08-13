import { AlertCircle } from 'lucide-react';

export function DeleteSubjectDialog({ item, busy, error, onCancel, onConfirm }) {
  if (!item) return null;

  return (
    <div className="rounded-[8px] border border-red-100 bg-red-50 p-5 text-red-800">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-extrabold">Xóa môn {item.subject?.name}?</h3>
          <p className="mt-2 text-sm font-semibold leading-6">
            Dữ liệu môn trong hồ sơ nháp sẽ bị xóa. Subject catalog gốc không bị ảnh hưởng.
          </p>
          {error && <p className="mt-3 text-sm font-extrabold">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-[8px] border border-red-200 bg-white px-4 py-3 text-sm font-extrabold text-red-800 disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="rounded-[8px] bg-red-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {busy ? 'Đang xóa...' : 'Xóa môn'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
