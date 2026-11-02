import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Eye, RotateCcw, Search, ShieldAlert, UserRoundCheck, X } from "lucide-react";
import { contractsApi, DisputeDto, DisputeEscalationDto, DisputeHistoryDto } from "../../../api/contractsApi";
import { useFeedback } from "../../../components/feedback/useFeedback";
import { EmptyState, ErrorState, ListSkeleton, MetricStrip, OperationsHeader, Pager, StatusBadge } from "../OperationalUi";

const STATUS: Record<string, { label: string; tone: "slate" | "amber" | "blue" | "green" | "red" }> = {
  NONE: { label: "Chưa chuyển cấp", tone: "slate" },
  PENDING_ADMIN: { label: "Chờ Admin", tone: "amber" },
  ACCEPTED_BY_ADMIN: { label: "Admin tiếp nhận", tone: "blue" },
  RETURNED_TO_STAFF: { label: "Trả về Staff", tone: "red" },
  CLOSED: { label: "Đã đóng", tone: "green" },
};

export function DisputeEscalationPage({ activeRole }: { activeRole: string }) {
  const admin = activeRole.toLowerCase() === "admin";
  const feedback = useFeedback();
  const [items, setItems] = useState<Array<DisputeEscalationDto | DisputeDto>>([]);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(admin ? "PENDING_ADMIN" : "");
  const [keywordInput, setKeywordInput] = useState(""); const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null); const [reason, setReason] = useState("");
  const [history, setHistory] = useState<DisputeHistoryDto[]>([]); const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = admin
        ? await contractsApi.listEscalations({ status: status || undefined, keyword, page, size: 10 })
        : await contractsApi.listDisputes({ status: "OPEN", page, size: 10 });
      setItems(result.content || []); setPages(Math.max(1, result.totalPages || 1)); setTotal(result.totalElements || 0);
    } catch (e: any) { setError(e?.message || "Không thể tải dữ liệu chuyển cấp."); }
    finally { setLoading(false); }
  }, [admin, keyword, page, status]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => items.reduce((acc: Record<string, number>, item: any) => {
    const key = item.escalationStatus || "NONE"; acc[key] = (acc[key] || 0) + 1; return acc;
  }, {}), [items]);

  const open = async (item: any) => {
    setSelected(item); setReason(""); setHistory([]);
    try { setHistory(await contractsApi.getDisputeHistory(item.id)); }
    catch { feedback.warning("Không thể tải lịch sử chuyển cấp của khiếu nại này."); }
  };

  const act = async (action: "ESCALATE" | "ACCEPT" | "RETURN") => {
    if ((action === "ESCALATE" || action === "RETURN") && !reason.trim()) {
      feedback.warning("Vui lòng nhập lý do trước khi thực hiện."); return;
    }
    const labels = { ESCALATE: "chuyển khiếu nại này lên Admin", ACCEPT: "tiếp nhận khiếu nại này", RETURN: "trả khiếu nại này về Staff" };
    const confirmed = await feedback.confirm({ title: "Xác nhận thao tác", message: `Bạn có chắc muốn ${labels[action]}?`, confirmText: "Xác nhận", variant: action === "RETURN" ? "destructive" : "default" });
    if (!confirmed) return;
    setActing(true);
    try {
      if (action === "ESCALATE") await contractsApi.escalateDispute(selected.id, reason.trim(), crypto.randomUUID());
      if (action === "ACCEPT") await contractsApi.acceptEscalation(selected.id, reason.trim());
      if (action === "RETURN") await contractsApi.returnEscalation(selected.id, reason.trim());
      feedback.success("Đã cập nhật quy trình chuyển cấp."); setSelected(null); await load();
    } catch (e: any) { feedback.error(e?.message || "Không thể cập nhật chuyển cấp."); }
    finally { setActing(false); }
  };

  const filtered = Boolean(keyword || status && status !== "PENDING_ADMIN");
  const metrics = admin ? [
    { label: "Tổng theo bộ lọc", value: total, icon: ShieldAlert },
    { label: "Chờ Admin trên trang", value: counts.PENDING_ADMIN || 0, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
    { label: "Đã tiếp nhận trên trang", value: counts.ACCEPTED_BY_ADMIN || 0, icon: UserRoundCheck, tone: "bg-blue-50 text-blue-700" },
    { label: "Đã hoàn tất trên trang", value: counts.CLOSED || 0, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
  ] : [
    { label: "Khiếu nại được giao", value: total, icon: ShieldAlert },
    { label: "Có thể chuyển trên trang", value: (counts.NONE || 0) + (counts.RETURNED_TO_STAFF || 0), icon: AlertTriangle, tone: "bg-amber-50 text-amber-700" },
    { label: "Chờ Admin trên trang", value: counts.PENDING_ADMIN || 0, icon: Clock3, tone: "bg-blue-50 text-blue-700" },
    { label: "Trả về trên trang", value: counts.RETURNED_TO_STAFF || 0, icon: RotateCcw, tone: "bg-rose-50 text-rose-700" },
  ];

  return <div className="space-y-5 pb-10">
    <OperationsHeader eyebrow="Khiếu nại & tranh chấp" title={admin ? "Hàng đợi chuyển cấp Admin" : "Chuyển cấp lên Admin"}
      description={admin ? "Tiếp nhận hoặc trả lại Staff theo lịch sử xử lý; không tự động thay đổi escrow hay settlement." : "Chỉ các khiếu nại thuộc phạm vi bạn phụ trách mới có thể được chuyển cấp."}
      onRefresh={load} refreshing={loading} />
    <MetricStrip metrics={metrics} />

    {admin && <form onSubmit={e => { e.preventDefault(); setPage(0); setKeyword(keywordInput.trim()); }} className="flex flex-col gap-3 border-y border-slate-200 bg-white py-4 xl:flex-row">
      <label className="relative flex-1"><span className="sr-only">Tìm kiếm</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary" placeholder="Tìm lớp, lý do hoặc mã khiếu nại" /></label>
      <select aria-label="Trạng thái chuyển cấp" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold">
        <option value="">Tất cả trạng thái</option><option value="PENDING_ADMIN">Chờ Admin</option><option value="ACCEPTED_BY_ADMIN">Đã tiếp nhận</option><option value="RETURNED_TO_STAFF">Đã trả Staff</option><option value="CLOSED">Đã đóng</option>
      </select>
      <button className="h-10 rounded-md bg-brand-primary px-4 text-sm font-bold text-white">Tìm kiếm</button>
    </form>}

    {error && <ErrorState message={error} onRetry={load} />}
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {loading ? <ListSkeleton /> : items.length === 0 ? <EmptyState filtered={filtered} title={admin ? "Hàng đợi đang trống" : "Không có khiếu nại cần chuyển cấp"} description={admin ? "Các hồ sơ Staff chuyển lên sẽ xuất hiện tại đây." : "Không có hồ sơ nào trong phạm vi phụ trách cần xử lý lúc này."} /> : <>
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Lớp / buổi</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Phụ trách</th><th className="px-4 py-3 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((raw: any) => <tr key={raw.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-black text-brand-text">{raw.className || `Lớp #${raw.classroomId || "-"}`}</p><p className="mt-1 text-xs text-slate-500">Buổi #{raw.sessionId}</p></td><td className="max-w-sm px-4 py-4 text-slate-600"><p className="line-clamp-2">{raw.escalationReason || raw.reason || raw.disputeReason}</p></td><td className="px-4 py-4"><StatusBadge {...(STATUS[raw.escalationStatus || "NONE"] || STATUS.NONE)} /></td><td className="px-4 py-4 text-xs text-slate-600">{raw.assignedStaffEmail || raw.classroomReviewerEmail || "Chưa gán"}</td><td className="px-4 py-4 text-right"><button onClick={() => open(raw)} title="Xem chi tiết" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary"><Eye size={16} /></button></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 xl:hidden">{items.map((raw: any) => <button key={raw.id} onClick={() => open(raw)} className="w-full p-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-brand-text">{raw.className || `Lớp #${raw.classroomId || "-"}`}</p><p className="mt-1 text-xs text-slate-500">Buổi #{raw.sessionId}</p></div><StatusBadge {...(STATUS[raw.escalationStatus || "NONE"] || STATUS.NONE)} /></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{raw.escalationReason || raw.reason || raw.disputeReason}</p></button>)}</div>
        <Pager page={page} pages={pages} onChange={setPage} total={total} size={10} />
      </>}
    </section>

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><div role="dialog" aria-modal="true" aria-labelledby="dispute-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><p className="text-[11px] font-black uppercase text-brand-primary">Khiếu nại · Buổi #{selected.sessionId}</p><h2 id="dispute-title" className="mt-1 text-lg font-black text-brand-text">{selected.className || "Chi tiết chuyển cấp"}</h2></div><button title="Đóng" onClick={() => setSelected(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-5"><div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]"><section><h3 className="text-xs font-black uppercase text-slate-500">Nội dung khiếu nại</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.reason || selected.disputeReason}</p>{selected.escalationReason && <><h3 className="mt-5 text-xs font-black uppercase text-slate-500">Lý do chuyển cấp</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.escalationReason}</p></>}</section><section className="border-l-0 border-slate-200 md:border-l md:pl-5"><h3 className="text-xs font-black uppercase text-slate-500">Lịch sử xử lý</h3><div className="mt-3 space-y-4">{history.length === 0 ? <p className="text-sm text-slate-500">Chưa có sự kiện chuyển cấp.</p> : history.map(h => <div key={h.id} className="border-l-2 border-brand-primary/30 pl-3 text-xs"><p className="font-black text-brand-text">{h.action}</p><p className="mt-1 text-slate-500">{h.actorEmail} ({h.actorRole})</p><p className="text-slate-500">{new Date(h.createdAt).toLocaleString("vi-VN")}</p>{h.reason && <p className="mt-1 text-slate-700">{h.reason}</p>}</div>)}</div></section></div></div>
      <footer className="border-t border-slate-200 bg-slate-50 p-4"><label className="text-xs font-black text-slate-600">Lý do xử lý</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000} placeholder={admin ? "Nhập lý do tiếp nhận hoặc trả lại" : "Bắt buộc khi chuyển cấp"} className="mt-2 w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-primary" /><div className="mt-3 flex flex-wrap justify-end gap-2">{admin ? <><button disabled={acting || selected.escalationStatus !== "PENDING_ADMIN"} onClick={() => act("ACCEPT")} className="rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Tiếp nhận</button><button disabled={acting || !["PENDING_ADMIN", "ACCEPTED_BY_ADMIN"].includes(selected.escalationStatus) || !reason.trim()} onClick={() => act("RETURN")} className="rounded-md border border-amber-400 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-40">Trả Staff</button></> : <button disabled={acting || (selected.escalationStatus && !["NONE", "RETURNED_TO_STAFF"].includes(selected.escalationStatus)) || !reason.trim()} onClick={() => act("ESCALATE")} className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><ShieldAlert className="h-4 w-4" />Chuyển Admin</button>}</div></footer>
    </div></div>}
  </div>;
}


