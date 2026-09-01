import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  KeyRound,
  LoaderCircle,
  Lock,
  RefreshCw,
} from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { TutorReviewStatus } from "../types";

interface TutorRestrictedHomeProps {
  tutorStatus?: TutorReviewStatus | null;
  onTutorStatusChange?: (status: TutorReviewStatus) => void;
  onNavigate: (page: string) => void;
}

export function TutorRestrictedHome({
  tutorStatus,
  onTutorStatusChange,
  onNavigate,
}: TutorRestrictedHomeProps) {
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadApplication() {
      setLoading(true);
      setError("");

      try {
        const data = await tutorApplicationApi.getMyTutorApplication();

        if (!active) return;

        setApplication(data);
        onTutorStatusChange?.(
          (data?.status || "DRAFT") as TutorReviewStatus
        );
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.message || "Không thể tải trạng thái hồ sơ gia sư."
          );
          onTutorStatusChange?.("DRAFT");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadApplication();

    return () => {
      active = false;
    };
  }, [onTutorStatusChange]);

  const status = (
    application?.status ||
    tutorStatus ||
    "DRAFT"
  ) as TutorReviewStatus;

  const rejected = status === "REJECTED";
  const pending = status === "PENDING";
  const approved = status === "APPROVED";

  const reason =
    application?.rejectionReason ||
    application?.reviewNote ||
    "";

  const content = useMemo(() => {
    if (approved) {
      return {
        icon: CheckCircle2,
        badge: "Đã được duyệt",
        title: "Hồ sơ gia sư đã được duyệt",
        description: "Hồ sơ của bạn đã được xét duyệt.",
        accent:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        iconAccent: "text-emerald-600",
        button: "Vào khu vực gia sư",
      };
    }

    if (rejected) {
      return {
        icon: AlertTriangle,
        badge: "Chưa được duyệt",
        title: "Hồ sơ gia sư cần cập nhật",
        description:
          "Hồ sơ của bạn chưa đáp ứng yêu cầu xét duyệt. Bạn có thể xem lý do, cập nhật thông tin và gửi lại hồ sơ.",
        accent: "border-red-200 bg-red-50 text-red-700",
        iconAccent: "text-red-600",
        button: "Chỉnh sửa hồ sơ",
      };
    }

    if (pending) {
      return {
        icon: RefreshCw,
        badge: "Đang chờ xét duyệt",
        title: "Hồ sơ gia sư đang chờ xét duyệt",
        description:
          "Hồ sơ của bạn đã được gửi và đang chờ xét duyệt. Trong thời gian này, bạn chỉ có thể xem lại hồ sơ.",
        accent:
          "border-amber-200 bg-amber-50 text-amber-700",
        iconAccent: "text-amber-600",
        button: "Xem hồ sơ gia sư",
      };
    }

    return {
      icon: FileText,
      badge: "Chưa hoàn thiện",
      title: "Hồ sơ gia sư chưa hoàn thiện",
      description:
        "Hoàn thiện thông tin cá nhân, tài liệu xác minh và gửi hồ sơ để Staff xét duyệt.",
      accent: "border-blue-200 bg-blue-50 text-blue-700",
      iconAccent: "text-blue-600",
      button: "Hoàn thiện hồ sơ gia sư",
    };
  }, [approved, pending, rejected]);

  const Icon = content.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10 font-sans">
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${content.accent}`}
          >
            <Icon className={`h-6 w-6 ${content.iconAccent}`} />
          </div>

          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${content.accent}`}
            >
              {content.badge}
            </span>

            <h2 className="mt-4 text-2xl font-bold text-[#0F172A] tracking-tight">
              {content.title}
            </h2>

            <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-500">
              {content.description}
            </p>

            {loading && (
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Đang tải thông tin xét duyệt...
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {rejected && reason && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <p className="font-bold mb-1">
                  Lý do chưa được duyệt
                </p>

                <p className="font-medium leading-relaxed">
                  {reason}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    approved ? "dashboard" : "settings"
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <FileText className="h-[18px] w-[18px]" />
                {content.button}
              </button>

              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
              >
                <CheckCircle2 className="h-[18px] w-[18px]" />
                Tài khoản
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate("settings-password")
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
              >
                <KeyRound className="h-[18px] w-[18px]" />
                Đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-blue-600" />
        </div>

        <div>
          <h3 className="text-[16px] font-bold text-[#0F172A]">
            Chức năng đang bị giới hạn
          </h3>

          <p className="mt-1 text-[14px] font-medium leading-relaxed text-slate-600">
            Quản lý lớp học, yêu cầu học, lịch dạy, tin nhắn,
            hợp đồng và ví chỉ mở khóa khi hồ sơ gia sư của
            bạn <strong>đã được duyệt</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}