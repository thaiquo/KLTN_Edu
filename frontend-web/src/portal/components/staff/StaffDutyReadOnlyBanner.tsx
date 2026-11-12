import React from "react";
import { Clock3, RefreshCw } from "lucide-react";

export function StaffDutyReadOnlyBanner({
  loading,
  error,
  writeAllowed,
  onRetry
}: {
  loading: boolean;
  error?: string;
  writeAllowed: boolean;
  onRetry: () => void;
}) {
  if (writeAllowed && !loading && !error) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <div className="flex items-start gap-2">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-black">Chế độ chỉ xem</p>
          <p className="mt-0.5 font-semibold leading-5">
            {loading ? "Đang xác minh ca trực trước khi cho phép thao tác." : error || "Bạn đang ngoài ca trực. Có thể xem dữ liệu nhưng không thể thay đổi nghiệp vụ."}
          </p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-black underline underline-offset-2">
        <RefreshCw className="h-3.5 w-3.5" /> Kiểm tra lại
      </button>
    </div>
  );
}
