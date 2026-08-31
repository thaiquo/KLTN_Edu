import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, KeyRound, LoaderCircle, Lock, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { TutorReviewStatus } from "../types";

interface TutorRestrictedHomeProps {
  tutorStatus?: TutorReviewStatus | null;
  onTutorStatusChange?: (status: TutorReviewStatus) => void;
  onNavigate: (page: string) => void;
}

export function TutorRestrictedHome({ tutorStatus, onTutorStatusChange, onNavigate }: TutorRestrictedHomeProps) {
  const navigate = useNavigate();
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
        if (data?.status) {
          onTutorStatusChange?.(data.status as TutorReviewStatus);
        } else if (!tutorStatus) {
          onTutorStatusChange?.("DRAFT");
        }
      } catch (loadError: any) {
        if (active) {
          setError(loadError?.message || "Kh�ng th� t�i tr�ng th�i h� s� gia s�.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplication();
    return () => {
      active = false;
    };
  }, [onTutorStatusChange, tutorStatus]);

  const status = (application?.status || tutorStatus || "DRAFT") as TutorReviewStatus;
  const rejected = status === "REJECTED";
  const pending = status === "PENDING";
  const approved = status === "APPROVED";
  const reason = application?.rejectionReason || application?.reviewNote || "";

  const content = useMemo(() => {
    if (approved) {
      return {
        icon: CheckCircle2,
        badge: "� ���c duy�!t",
        title: "H� s� gia s� �� ���c duy�!t",
        description:
          "H� s� c�a b�n �� ���c x�t duy�!t. N�u khu v�c Gia s� ch�a t� m�x kh�a, h�y t�i l�i trang �� ��ng b�" tr�ng th�i m�:i nh�t.",
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
        iconAccent: "text-emerald-600",
        button: "V�o khu v�c Gia s�",
      };
    }

    if (rejected) {
      return {
        icon: AlertTriangle,
        badge: "Ch�a ���c duy�!t",
        title: "H� s� gia s� c�n ���c c�p nh�t",
        description:
          "H� s� c�a b�n ch�a ��p �ng y�u c�u x�t duy�!t. B�n c� th� xem l� do, c�p nh�t th�ng tin v� g�i l�i h� s� theo lu�ng hi�!n t�i.",
        accent: "border-red-200 bg-red-50 text-red-700",
        iconAccent: "text-red-600",
        button: "Ch�0nh s�a h� s�",
      };
    }

    if (pending) {
      return {
        icon: RefreshCw,
        badge: "ang ch� x�t duy�!t",
        title: "H� s� gia s� �ang ch� x�t duy�!t",
        description:
          "H� s� c�a b�n �� ���c g�i v� �ang ch� x�t duy�!t. Trong th�i gian n�y, b�n c� th� xem l�i h� s� nh�ng ch�a s� d�ng c�c ch�c nng Gia s� ��y ��.",
        accent: "border-amber-200 bg-amber-50 text-amber-700",
        iconAccent: "text-amber-600",
        button: "Xem h� s� gia s�",
      };
    }

    return {
      icon: FileText,
      badge: "Ch�a ho�n thi�!n",
      title: "H� s� gia s� ch�a ho�n thi�!n",
      description:
        "Ho�n thi�!n th�ng tin chuy�n m�n v� h� s� x�c minh �� g�i y�u c�u x�t duy�!t.",
      accent: "border-blue-200 bg-blue-50 text-blue-700",
      iconAccent: "text-blue-600",
      button: "Ho�n thi�!n h� s� gia s�",
    };
  }, [approved, pending, rejected]);

  const Icon = content.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10 font-sans">
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${content.accent}`}>
            <Icon className={`h-6 w-6 ${content.iconAccent}`} />
          </div>
          <div className="min-w-0 flex-1">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${content.accent}`}>
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
                ang t�i th�ng tin x�t duy�!t...
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {rejected && reason && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <p className="font-bold mb-1">L� do ch�a ���c duy�!t</p>
                <p className="font-medium leading-relaxed">{reason}</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate(approved ? "dashboard" : "profile")}
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
                T�i kho�n
              </button>
              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
              >
                <KeyRound className="h-[18px] w-[18px]" />
                �"i m�t kh�u
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
          <h3 className="text-[16px] font-bold text-[#0F172A]">Ch�c nng �ang b�9 gi�:i h�n</h3>
          <p className="mt-1 text-[14px] font-medium leading-relaxed text-slate-600">
            C�c ch�c nng qu�n l� l�:p h�c, y�u c�u tham gia, l�9ch d�y, b�i t�p, tin nh�n, h�p ��ng gi�ng d�y v� thu nh�p ch�0 m�x kh�a khi h� s� gia s� c�a b�n <strong>�� ���c duy�!t</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}

