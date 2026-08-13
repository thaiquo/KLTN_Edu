import React, { useState } from "react";
import { TutorApprovalItem } from "../../types";

export function RejectTutorModal({
  tutor,
  busy,
  onClose,
  onConfirm,
}: {
  tutor?: TutorApprovalItem;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  if (!tutor) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = reason.trim();

    if (!value) {
      setError("Vui long nhap ly do tu choi.");
      return;
    }

    onConfirm(value, note.trim());
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#061827]/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg border border-[#d7dde6] bg-white p-6 shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff695f]">Reject Tutor Application</p>
        <h3 className="mt-2 font-display text-xl font-black text-[#073554]">Từ chối hồ sơ gia sư</h3>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Tutor: <span className="font-black text-[#073554]">{tutor.fullName}</span>
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Lý do *</span>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError("");
            }}
            rows={5}
            placeholder="Thông tin học vấn chưa đầy đủ..."
            className="mt-2 w-full resize-none border border-[#d7dde6] bg-[#f7f9fc] p-3 text-sm font-semibold text-[#073554] outline-none focus:border-[#ff695f]"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ghi chú nội bộ</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Ghi chú thêm, có thể để trống..."
            className="mt-2 w-full resize-none border border-[#d7dde6] bg-[#f7f9fc] p-3 text-sm font-semibold text-[#073554] outline-none focus:border-[#ff695f]"
          />
        </label>

        {error && <p className="mt-3 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="border border-[#d7dde6] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="submit" disabled={busy} className="bg-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-rose-700 disabled:opacity-50">
            {busy ? "Đang từ chối..." : "Xác nhận từ chối"}
          </button>
        </div>
      </form>
    </div>
  );
}
