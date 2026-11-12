import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw } from "lucide-react";
import { getAdminChatKnowledgeStatus, reindexAdminChatKnowledge } from "../../../api/chatbot";

type KnowledgeState = "READY" | "INDEXING" | "DEGRADED" | "FAILED";

interface KnowledgeStatus {
  collection: string;
  state: KnowledgeState;
  collectionExists: boolean;
  pointCount: number;
  indexedDocumentCount: number;
  sourceDocumentCount: number;
  sourceChunkCount: number;
  lastAttemptAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastError?: string | null;
  syncInProgress: boolean;
}

export function ChatbotKnowledgeManagement() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await getAdminChatKnowledgeStatus();
      setStatus(next as KnowledgeStatus);
      setError("");
    } catch (requestError: any) {
      setError(requestError?.message || "Không thể tải trạng thái kho tri thức chatbot.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, status?.syncInProgress ? 2500 : 15000);
    return () => window.clearInterval(timer);
  }, [refresh, status?.syncInProgress]);

  const reindex = async () => {
    if (processing || status?.syncInProgress) return;
    if (!window.confirm("Đồng bộ lại toàn bộ tài liệu Markdown vào kho tri thức chatbot? Dữ liệu đang phục vụ sẽ được giữ trong quá trình đồng bộ.")) {
      return;
    }
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      const result: any = await reindexAdminChatKnowledge();
      setSuccess(`Đồng bộ hoàn tất: ${result.pointsInserted ?? 0} cập nhật, ${result.pointsSkipped ?? 0} giữ nguyên, ${result.pointsDeleted ?? 0} stale chunk đã xóa.`);
      await refresh();
    } catch (requestError: any) {
      setError(requestError?.message || "Không thể đồng bộ kho tri thức chatbot.");
      await refresh();
    } finally {
      setProcessing(false);
    }
  };

  const state = status?.state || "FAILED";
  const ready = state === "READY";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">AI Chatbot</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Kho tri thức EduConnect</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Theo dõi collection Qdrant và đồng bộ tài liệu Markdown dùng để trả lời có nguồn.</p>
        </div>
        <button
          type="button"
          onClick={reindex}
          disabled={loading || processing || status?.syncInProgress}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {(processing || status?.syncInProgress) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {(processing || status?.syncInProgress) ? "Đang đồng bộ" : "Đồng bộ lại"}
        </button>
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}

      {loading ? (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <section className={`rounded-2xl border p-5 ${ready ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ready ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
                {state === "INDEXING" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">Trạng thái: {state}</p>
                <p className="mt-1 break-all text-xs font-semibold text-slate-600">Collection: {status?.collection || "—"}</p>
                {status?.lastError && <p className="mt-2 text-sm font-semibold text-amber-800">{status.lastError}</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Markdown nguồn" value={status?.sourceDocumentCount ?? 0} />
            <Metric label="Tài liệu đã index" value={status?.indexedDocumentCount ?? 0} />
            <Metric label="Chunk nguồn" value={status?.sourceChunkCount ?? 0} />
            <Metric label="Point trong Qdrant" value={status?.pointCount ?? 0} />
          </section>

          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
            <TimeValue label="Lần thử gần nhất" value={status?.lastAttemptAt} />
            <TimeValue label="Đồng bộ thành công gần nhất" value={status?.lastSuccessfulSyncAt} />
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}

function TimeValue({ label, value }: { label: string; value?: string | null }) {
  const formatted = value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "Chưa có";
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-800">{formatted}</p></div>;
}
