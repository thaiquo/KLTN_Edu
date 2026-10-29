import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Eye, Flag, Search, ShieldCheck, ShieldX, X } from "lucide-react";
import communityApi from "../../../api/community";
import { useFeedback } from "../../../components/feedback/useFeedback";
import { EmptyState, ErrorState, ListSkeleton, MetricStrip, OperationsHeader, Pager, StatusBadge } from "../OperationalUi";

const MODERATION_STATUS: Record<string, { label: string; tone: "slate" | "amber" | "blue" | "green" | "red" }> = {
  NOT_CHECKED: { label: "Chưa kiểm tra", tone: "slate" }, MODERATING: { label: "AI đang xử lý", tone: "blue" },
  ALLOWED: { label: "Được phép", tone: "green" }, NEEDS_EDIT: { label: "Cần chỉnh sửa", tone: "amber" },
  REJECTED: { label: "AI từ chối", tone: "red" }, FAILED: { label: "AI lỗi", tone: "red" },
};

export function CommunityModerationPage() {
  const feedback = useFeedback();
  const [items, setItems] = useState<any[]>([]); const [page, setPage] = useState(0); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [keywordInput, setKeywordInput] = useState(""); const [keyword, setKeyword] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [detail, setDetail] = useState<any>(null); const [reason, setReason] = useState(""); const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await communityApi.getModerationQueue({ moderationStatus: status || undefined, reportedOnly, keyword, page, size: 10 });
      setItems(result.content || []); setPages(Math.max(1, result.totalPages || 1)); setTotal(result.totalElements || 0);
    } catch (e: any) { setError(e?.message || "Không thể tải hàng đợi kiểm duyệt."); }
    finally { setLoading(false); }
  }, [keyword, page, reportedOnly, status]);
  useEffect(() => { load(); }, [load]);

  const pageStats = useMemo(() => ({
    reports: items.reduce((sum, item) => sum + Number(item.openReportCount || 0), 0),
    aiFlags: items.filter(item => ["NEEDS_EDIT", "REJECTED"].includes(item.moderationStatus)).length,
    aiFailures: items.filter(item => item.moderationStatus === "FAILED").length,
  }), [items]);

  const open = async (id: number) => {
    setReason("");
    try { setDetail(await communityApi.getModerationDetail(id)); }
    catch (e: any) { feedback.error(e?.message || "Không thể mở bài viết."); }
  };
  const decide = async (action: "APPROVE" | "REJECT" | "HIDE" | "RESTORE") => {
    if (!reason.trim()) { feedback.warning("Lý do xử lý là bắt buộc."); return; }
    const actionLabel = { APPROVE: "duyệt nội dung", REJECT: "từ chối nội dung", HIDE: "ẩn nội dung", RESTORE: "khôi phục nội dung" }[action];
    const confirmed = await feedback.confirm({ title: "Xác nhận kiểm duyệt", message: `Bạn có chắc muốn ${actionLabel}? Quyết định và lý do sẽ được lưu vào lịch sử.`, confirmText: "Xác nhận", variant: ["REJECT", "HIDE"].includes(action) ? "destructive" : "default" });
    if (!confirmed) return;
    setActing(true);
    try {
      await communityApi.moderatePost(detail.post.postId, action, reason.trim(), detail.post.contentRevision);
      feedback.success("Đã lưu quyết định kiểm duyệt."); setDetail(null); await load();
    } catch (e: any) { feedback.error(e?.message || "Không thể xử lý bài viết."); }
    finally { setActing(false); }
  };

  const filtered = Boolean(keyword || status || reportedOnly);
  return <div className="space-y-5 pb-10">
    <OperationsHeader eyebrow="Community" title="Kiểm duyệt thủ công" description="Đánh giá nội dung bị báo cáo hoặc AI gắn cờ. Quyết định thủ công được lưu theo revision và không làm gián đoạn AI moderation." onRefresh={load} refreshing={loading} />
    <MetricStrip metrics={[
      { label: "Tổng theo bộ lọc", value: total, icon: ShieldCheck },
      { label: "Báo cáo mở trên trang", value: pageStats.reports, icon: Flag, tone: "bg-amber-50 text-amber-700" },
      { label: "AI gắn cờ trên trang", value: pageStats.aiFlags, icon: Bot, tone: "bg-blue-50 text-blue-700" },
      { label: "AI lỗi trên trang", value: pageStats.aiFailures, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
    ]} />

    <form onSubmit={e => { e.preventDefault(); setPage(0); setKeyword(keywordInput.trim()); }} className="grid gap-3 border-y border-slate-200 bg-white py-4 xl:grid-cols-[minmax(240px,1fr)_180px_auto_auto]">
      <label className="relative"><span className="sr-only">Tìm nội dung</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} placeholder="Tìm tiêu đề hoặc nội dung" className="h-10 w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary" /></label>
      <select aria-label="Trạng thái AI" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Cần xem xét</option><option value="NEEDS_EDIT">Cần chỉnh sửa</option><option value="REJECTED">AI từ chối</option><option value="FAILED">AI lỗi</option></select>
      <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"><input type="checkbox" checked={reportedOnly} onChange={e => { setReportedOnly(e.target.checked); setPage(0); }} />Chỉ nội dung bị báo cáo</label>
      <button className="h-10 rounded-md bg-brand-primary px-4 text-sm font-bold text-white">Tìm kiếm</button>
    </form>

    {error && <ErrorState message={error} onRetry={load} />}
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {loading ? <ListSkeleton /> : items.length === 0 ? <EmptyState filtered={filtered} title="Không có nội dung cần xử lý" description="Nội dung bị báo cáo hoặc được AI chuyển sang kiểm duyệt thủ công sẽ xuất hiện tại đây." /> : <>
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Bài viết</th><th className="px-4 py-3">Tác giả</th><th className="px-4 py-3">AI</th><th className="px-4 py-3">Báo cáo mở</th><th className="px-4 py-3 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.postId} className="hover:bg-slate-50"><td className="max-w-xl px-4 py-4"><p className="font-black text-brand-text">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.content}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-700">{item.authorName}</p><p className="mt-1 text-xs text-slate-500">{item.authorRole}</p></td><td className="px-4 py-4"><StatusBadge {...(MODERATION_STATUS[item.moderationStatus] || { label: item.moderationStatus, tone: "slate" })} /></td><td className="px-4 py-4"><span className="inline-flex items-center gap-1 font-black text-slate-700"><Flag className="h-4 w-4 text-amber-600" />{item.openReportCount}</span></td><td className="px-4 py-4 text-right"><button onClick={() => open(item.postId)} title="Xem chi tiết" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary"><Eye size={16} /></button></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 xl:hidden">{items.map(item => <button key={item.postId} onClick={() => open(item.postId)} className="w-full p-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><p className="font-black text-brand-text">{item.title}</p><StatusBadge {...(MODERATION_STATUS[item.moderationStatus] || { label: item.moderationStatus, tone: "slate" })} /></div><p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.content}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{item.authorName} · {item.authorRole}</span><span className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" />{item.openReportCount}</span></div></button>)}</div>
        <Pager page={page} pages={pages} onChange={setPage} total={total} size={10} />
      </>}
    </section>

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}><div role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><p className="text-[11px] font-black uppercase text-brand-primary">{detail.post.authorName} · {detail.post.authorRole}</p><h2 id="moderation-title" className="mt-1 text-lg font-black text-brand-text">{detail.post.title}</h2><div className="mt-2 flex flex-wrap gap-2"><StatusBadge {...(MODERATION_STATUS[detail.post.moderationStatus] || { label: detail.post.moderationStatus, tone: "slate" })} /><StatusBadge label={detail.post.postStatus} tone={detail.post.postStatus === "HIDDEN" ? "red" : "slate"} /></div></div><button title="Đóng" onClick={() => setDetail(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-5"><section><h3 className="text-xs font-black uppercase text-slate-500">Nội dung</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.post.content}</p>{detail.post.moderationReason && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-slate-600"><strong>Nhận định AI:</strong> {detail.post.moderationReason}</p>}</section><div className="mt-6 grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2"><section><h3 className="mb-3 text-xs font-black uppercase text-slate-500">Báo cáo ({detail.reports.length})</h3>{detail.reports.length === 0 ? <p className="text-sm text-slate-500">Không có báo cáo.</p> : <div className="space-y-3">{detail.reports.map((report: any) => <div key={report.id} className="border-l-2 border-amber-400 pl-3 text-xs"><p className="font-black text-brand-text">{report.reason}</p><p className="mt-1 text-slate-500">{report.reporterRole} · {new Date(report.createdAt).toLocaleString("vi-VN")}</p>{report.details && <p className="mt-1 text-slate-700">{report.details}</p>}</div>)}</div>}</section><section><h3 className="mb-3 text-xs font-black uppercase text-slate-500">Lịch sử quyết định</h3>{detail.history.length === 0 ? <p className="text-sm text-slate-500">Chưa có quyết định thủ công.</p> : <div className="space-y-3">{detail.history.map((item: any) => <div key={item.id} className="border-l-2 border-brand-primary/30 pl-3 text-xs"><p className="font-black text-brand-text">{item.action}</p><p className="mt-1 text-slate-500">{item.actorEmail} · {new Date(item.createdAt).toLocaleString("vi-VN")}</p><p className="mt-1 text-slate-700">{item.reason}</p></div>)}</div>}</section></div></div>
      <footer className="border-t border-slate-200 bg-slate-50 p-4"><label className="text-xs font-black text-slate-600">Lý do quyết định</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000} placeholder="Bắt buộc và sẽ được lưu vào lịch sử" className="mt-2 w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-primary" /><div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={acting || !reason.trim()} onClick={() => decide("APPROVE")} className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-40"><ShieldCheck className="h-4 w-4" />Duyệt</button><button disabled={acting || !reason.trim()} onClick={() => decide("REJECT")} className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40"><ShieldX className="h-4 w-4" />Từ chối</button>{detail.post.postStatus === "HIDDEN" ? <button disabled={acting || !reason.trim()} onClick={() => decide("RESTORE")} className="rounded-md bg-brand-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Khôi phục</button> : <button disabled={acting || !reason.trim()} onClick={() => decide("HIDE")} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Ẩn bài</button>}</div></footer>
    </div></div>}
  </div>;
}


