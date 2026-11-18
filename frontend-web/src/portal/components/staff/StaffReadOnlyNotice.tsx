import React from "react";
import { Lock } from "lucide-react";

export function StaffReadOnlyNotice({ loading = false }: { loading?: boolean }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="text-sm font-black">
          {loading ? "Đang xác minh ca trực" : "Ngoài ca trực — chế độ chỉ xem"}
        </p>
        <p className="mt-0.5 text-xs font-medium text-amber-800">
          {loading
            ? "Các thao tác xử lý tạm khóa cho đến khi trạng thái ca trực được xác nhận."
            : "Bạn vẫn xem được hồ sơ và chứng cứ, nhưng cần nhận ca hợp lệ trước khi thay đổi hoặc phân xử dữ liệu."}
        </p>
      </div>
    </div>
  );
}
