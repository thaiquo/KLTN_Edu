import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, LifeBuoy, MessageSquare, Plus, Search, Send, ShieldAlert, UserRoundCheck, X } from "lucide-react";
import supportApi, { TicketDetail, TicketStatus, TicketSummary } from "../../api/supportApi";
import { useFeedback } from "../../components/feedback/useFeedback";
import { useAuth } from "../../hooks/useAuth";
import { EmptyState, ErrorState, ListSkeleton, MetricStrip, OperationsHeader, Pager, StatusBadge } from "./OperationalUi";

const STATUS: Record<string, { label: string; tone: "slate" | "amber" | "blue" | "green" | "red" }> = {
  OPEN: { label: "Mới", tone: "amber" }, ASSIGNED: { label: "Đã tiếp nhận", tone: "blue" },
  WAITING_USER: { label: "Chờ người gửi", tone: "slate" }, WAITING_STAFF: { label: "Chờ hỗ trợ", tone: "amber" },
  ESCALATED: { label: "Đã chuyển Admin", tone: "red" }, RESOLVED: { label: "Đã giải quyết", tone: "green" }, CLOSED: { label: "Đã đóng", tone: "slate" },
};
const CATEGORY: Record<string, string> = { ACCOUNT: "Tài khoản", TUTOR_PROFILE: "Hồ sơ gia sư", CLASS: "Lớp học", CONTRACT: "Hợp đồng", PAYMENT: "Thanh toán", COMMUNITY: "Community", TECHNICAL: "Kỹ thuật", OTHER: "Khác" };
const CATEGORIES = Object.keys(CATEGORY);

export function HelpDeskPage({ activeRole }: { activeRole: string }) {
  const role = activeRole.toLowerCase(); const operator = role === "staff" || role === "admin";
  const { user } = useAuth(); const feedback = useFeedback();
  const [items, setItems] = useState<TicketSummary[]>([]); const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(""); const [keywordInput, setKeywordInput] = useState(""); const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [acting, setActing] = useState(false);
  const [reply, setReply] = useState(""); const [reason, setReason] = useState(""); const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category: "TECHNICAL", subject: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await supportApi.list({ status, keyword, page, size: 10 });
      setItems(result.content || []); setPages(Math.max(1, result.totalPages || 1)); setTotal(result.totalElements || 0);
    } catch (e: any) { setError(e?.message || "Không thể tải yêu cầu hỗ trợ."); }
    finally { setLoading(false); }
  }, [keyword, page, status]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => items.reduce((acc: Record<string, number>, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}), [items]);
  const mutate = async (action: () => Promise<TicketDetail>, success: string) => {
    setActing(true);
    try { const next = await action(); setDetail(next); setReply(""); setReason(""); feedback.success(success); await load(); }
    catch (e: any) { feedback.error(e?.message || "Không thể cập nhật yêu cầu."); }
    finally { setActing(false); }
  };
  const open = async (id: string) => {
    try { setDetail(await supportApi.get(id)); setReply(""); setReason(""); }
    catch (e: any) { feedback.error(e?.message || "Không thể mở yêu cầu."); }
  };
  const confirmMutation = async (options: any, action: () => Promise<TicketDetail>, success: string) => {
    if (await feedback.confirm(options)) await mutate(action, success);
  };

  const summary = detail?.summary; const assignedToCurrent = Number(summary?.assigneeId) === Number(user?.id);
  const canManage = role === "admin" || (role === "staff" && assignedToCurrent && summary?.status !== "ESCALATED");
  const canReply = Boolean(detail && summary?.status !== "CLOSED" && (!operator || canManage));
  const filtered = Boolean(keyword || status);

  return <div className="space-y-5 pb-10">
    <OperationsHeader eyebrow="Trung tâm hỗ trợ" title="Help Desk" description={operator ? "Tiếp nhận, trao đổi và xử lý yêu cầu trong đúng phạm vi được giao." : "Theo dõi yêu cầu và trao đổi trực tiếp với đội ngũ hỗ trợ EduConnect."} onRefresh={load} refreshing={loading} />
    <div className="flex justify-end">{!operator && <button onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-primary px-4 text-sm font-bold text-white shadow-sm"><Plus size={16} />Tạo yêu cầu</button>}</div>
    <MetricStrip metrics={[
      { label: "Tổng theo bộ lọc", value: total, icon: LifeBuoy },
      { label: "Cần xử lý trên trang", value: (counts.OPEN || 0) + (counts.WAITING_STAFF || 0), icon: Clock3, tone: "bg-amber-50 text-amber-700" },
      { label: "Đang phụ trách trên trang", value: counts.ASSIGNED || 0, icon: UserRoundCheck, tone: "bg-blue-50 text-blue-700" },
      { label: "Đã hoàn tất trên trang", value: (counts.RESOLVED || 0) + (counts.CLOSED || 0), icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    ]} />

    <form onSubmit={e => { e.preventDefault(); setPage(0); setKeyword(keywordInput.trim()); }} className="grid gap-3 border-y border-slate-200 bg-white py-4 xl:grid-cols-[minmax(240px,1fr)_210px_auto]">
      <label className="relative"><span className="sr-only">Tìm yêu cầu</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} placeholder="Tìm theo tiêu đề hoặc nội dung" className="h-10 w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary" /></label>
      <select aria-label="Trạng thái ticket" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Tất cả trạng thái</option>{Object.entries(STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select>
      <button className="h-10 rounded-md bg-brand-primary px-4 text-sm font-bold text-white">Tìm kiếm</button>
    </form>

    {error && <ErrorState message={error} onRetry={load} />}
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {loading ? <ListSkeleton /> : items.length === 0 ? <EmptyState filtered={filtered} title="Không có yêu cầu hỗ trợ" description={operator ? "Yêu cầu mới hoặc được phân công sẽ xuất hiện tại đây." : "Bạn có thể tạo yêu cầu mới khi cần EduConnect hỗ trợ."} /> : <>
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Yêu cầu</th><th className="px-4 py-3">Người gửi</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Cập nhật</th><th className="px-4 py-3 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-black text-brand-text">{item.subject}</p><p className="mt-1 text-xs text-slate-500">{CATEGORY[item.category] || item.category}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-700">{item.creatorName}</p><p className="mt-1 text-xs text-slate-500">{item.creatorRole}</p></td><td className="px-4 py-4"><StatusBadge {...(STATUS[item.status] || { label: item.status, tone: "slate" })} /></td><td className="px-4 py-4 text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString("vi-VN")}</td><td className="px-4 py-4 text-right"><button onClick={() => open(item.id)} title="Xem chi tiết" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary"><Eye size={16} /></button></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 xl:hidden">{items.map(item => <button key={item.id} onClick={() => open(item.id)} className="w-full p-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><p className="font-black text-brand-text">{item.subject}</p><StatusBadge {...(STATUS[item.status] || { label: item.status, tone: "slate" })} /></div><p className="mt-2 text-xs text-slate-500">{CATEGORY[item.category] || item.category} · {item.creatorName}</p><p className="mt-2 text-xs text-slate-400">Cập nhật {new Date(item.updatedAt).toLocaleString("vi-VN")}</p></button>)}</div>
        <Pager page={page} pages={pages} onChange={setPage} total={total} size={10} />
      </>}
    </section>

    {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3" onMouseDown={e => e.target === e.currentTarget && setCreating(false)}><form onSubmit={async e => { e.preventDefault(); await mutate(() => supportApi.create(form), "Đã gửi yêu cầu hỗ trợ."); setCreating(false); setForm({ category: "TECHNICAL", subject: "", description: "" }); }} className="w-full max-w-xl rounded-md bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-5"><div><p className="text-[11px] font-black uppercase text-brand-primary">Help Desk</p><h2 className="mt-1 text-lg font-black">Tạo yêu cầu hỗ trợ</h2></div><button type="button" title="Đóng" onClick={() => setCreating(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header><div className="space-y-4 p-5"><label className="block text-xs font-black text-slate-600">Danh mục<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal">{CATEGORIES.map(value => <option key={value} value={value}>{CATEGORY[value]}</option>)}</select></label><label className="block text-xs font-black text-slate-600">Tiêu đề<input required maxLength={180} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-normal outline-none focus:border-brand-primary" /></label><label className="block text-xs font-black text-slate-600">Mô tả vấn đề<textarea required maxLength={5000} rows={6} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2 w-full rounded-md border border-slate-200 p-3 text-sm font-normal outline-none focus:border-brand-primary" /></label></div><footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4"><button type="button" onClick={() => setCreating(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold">Hủy</button><button disabled={acting} className="rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Gửi yêu cầu</button></footer></form></div>}

    {detail && summary && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}><div role="dialog" aria-modal="true" aria-labelledby="ticket-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-black uppercase text-brand-primary">{CATEGORY[summary.category] || summary.category}</span><StatusBadge {...(STATUS[summary.status] || { label: summary.status, tone: "slate" })} /></div><h2 id="ticket-title" className="mt-2 text-lg font-black text-brand-text">{summary.subject}</h2><p className="mt-1 text-xs text-slate-500">{summary.creatorName} · {summary.creatorRole}{summary.assigneeName ? ` · Phụ trách: ${summary.assigneeName}` : " · Chưa có người phụ trách"}</p></div><button title="Đóng" onClick={() => setDetail(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-5"><section><h3 className="text-xs font-black uppercase text-slate-500">Mô tả</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.description}</p></section><div className="mt-6 grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-[1.15fr_.85fr]"><section><h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><MessageSquare size={15} />Trao đổi</h3><div className="space-y-4">{detail.messages.length === 0 ? <p className="text-sm text-slate-500">Chưa có phản hồi.</p> : detail.messages.map(message => <div key={message.id} className="border-l-2 border-brand-primary/30 pl-3"><p className="text-xs font-black text-brand-text">{message.actorName} · {message.actorRole}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(message.createdAt).toLocaleString("vi-VN")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p></div>)}</div></section><section><h3 className="mb-3 text-xs font-black uppercase text-slate-500">Lịch sử</h3><div className="space-y-3">{detail.history.map(item => <div key={item.id} className="border-l-2 border-slate-200 pl-3 text-xs"><p className="font-black text-brand-text">{item.action}</p><p className="mt-1 text-slate-500">{item.actorName} · {new Date(item.createdAt).toLocaleString("vi-VN")}</p>{item.reason && <p className="mt-1 text-slate-700">{item.reason}</p>}</div>)}</div></section></div></div>
      <footer className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">{canReply && <div className="flex gap-2"><textarea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Nhập phản hồi" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-primary" /><button title="Gửi phản hồi" disabled={acting || !reply.trim()} onClick={() => mutate(() => supportApi.reply(summary.id, reply.trim()), "Đã gửi phản hồi.")} className="grid w-11 place-items-center rounded-md bg-brand-primary text-white disabled:opacity-40"><Send size={17} /></button></div>}{operator && <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do xử lý hoặc chuyển cấp" className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-primary" />}<div className="flex flex-wrap justify-end gap-2">{operator && !summary.assigneeId && summary.status !== "RESOLVED" && summary.status !== "CLOSED" && <button disabled={acting} onClick={() => confirmMutation({ title: "Tiếp nhận yêu cầu", message: "Yêu cầu này sẽ được gán cho bạn xử lý.", confirmText: "Tiếp nhận" }, () => supportApi.claim(summary.id), "Đã tiếp nhận yêu cầu.")} className="rounded-md bg-brand-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Tiếp nhận</button>}{canManage && !["RESOLVED", "CLOSED"].includes(summary.status) && <button disabled={acting} onClick={() => confirmMutation({ title: "Xác nhận đã giải quyết", message: "Đánh dấu yêu cầu này là đã giải quyết?", confirmText: "Xác nhận" }, () => supportApi.status(summary.id, "RESOLVED", reason.trim()), "Đã đánh dấu yêu cầu là đã giải quyết.")} className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-40">Đã giải quyết</button>}{role === "staff" && canManage && <button disabled={acting || !reason.trim()} onClick={() => confirmMutation({ title: "Chuyển cấp lên Admin", message: "Sau khi chuyển cấp, Staff sẽ không thể tiếp tục thay đổi ticket cho đến khi Admin xử lý.", confirmText: "Chuyển Admin", variant: "destructive" }, () => supportApi.escalate(summary.id, reason.trim()), "Đã chuyển yêu cầu lên Admin.")} className="inline-flex items-center gap-2 rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-40"><ShieldAlert size={16} />Chuyển Admin</button>}</div></footer>
    </div></div>}
  </div>;
}


