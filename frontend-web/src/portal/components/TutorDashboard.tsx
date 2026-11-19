import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, BookOpen, CalendarClock, CheckCircle2,
  FileCheck2, GraduationCap, RefreshCw, Star, TrendingUp, Users, WalletCards
} from "lucide-react";
import { tutorStatisticsApi } from "../../api/tutorStatistics";

interface TutorDashboardProps {
  userName: string;
  onNavigate: (page: string) => void;
}

type SourceSection = { status: "SUCCESS" | "UNAVAILABLE"; data: any | null; errorCode?: string | null };
type TutorStatistics = {
  generatedAt: string;
  rangeDays: number;
  learning: SourceSection;
  income: SourceSection;
  sources: Array<{ source: string; status: string; errorCode?: string | null }>;
};

const RANGE_OPTIONS = [7, 30, 90];
const fmtNumber = (value: unknown) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const fmtMoney = (value: unknown, currency = "USDC") => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(Number(value || 0))} ${currency}`;
const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("vi-VN") : "--";

export function TutorDashboard({ userName, onNavigate }: TutorDashboardProps) {
  const [rangeDays, setRangeDays] = useState(30);
  const [statistics, setStatistics] = useState<TutorStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStatistics(await tutorStatisticsApi.get(rangeDays));
    } catch (cause: any) {
      setStatistics(null);
      setError(cause?.message || "Không thể tải thống kê gia sư.");
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => { load(); }, [load]);

  const learningAvailable = statistics?.learning?.status === "SUCCESS";
  const incomeAvailable = statistics?.income?.status === "SUCCESS";
  const learning = learningAvailable ? statistics?.learning?.data : null;
  const income = incomeAvailable ? statistics?.income?.data : null;
  const teaching = learning?.teaching;
  const operations = learning?.operations;
  const reviews = learning?.reviews;
  const currency = income?.currency || "USDC";
  const unavailable = useMemo(() => statistics?.sources?.filter(source => source.status !== "SUCCESS") || [], [statistics]);

  const summary = [
    { label: "Lớp đang dạy", value: learningAvailable ? fmtNumber(teaching?.activeClasses) : null, icon: BookOpen, tone: "blue" },
    { label: "Học viên đang học", value: learningAvailable ? fmtNumber(teaching?.totalStudents) : null, icon: Users, tone: "emerald" },
    { label: "Buổi đã hoàn thành", value: learningAvailable ? `${fmtNumber(teaching?.completedSessions)}/${fmtNumber(teaching?.totalSessions)}` : null, icon: CheckCircle2, tone: "violet" },
    { label: "Thu nhập đã release", value: incomeAvailable ? fmtMoney(income?.releasedAmount, currency) : null, icon: WalletCards, tone: "amber" },
    { label: "Đánh giá", value: learningAvailable ? `${Number(reviews?.averageRating || 0).toFixed(1)} · ${fmtNumber(reviews?.reviewCount)} lượt` : null, icon: Star, tone: "rose" }
  ];

  return (
    <div data-testid="tutor-statistics-dashboard" className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900">
      <header className="flex flex-col gap-4 border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Tutor Command Center</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Tổng quan giảng dạy của {userName}</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Theo dõi lớp học, khối lượng học vụ, settlement đã xác nhận và phản hồi thật từ học viên.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Khoảng thời gian</label>
          <select aria-label="Khoảng thời gian thống kê" value={rangeDays} onChange={event => setRangeDays(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            {RANGE_OPTIONS.map(value => <option key={value} value={value}>{value} ngày</option>)}
          </select>
          <button type="button" onClick={load} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-blue-300 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Làm mới</button>
        </div>
      </header>

      {error && <ErrorState message={error} retry={load} />}
      {!error && unavailable.length > 0 && (
        <div data-testid="tutor-statistics-partial" className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Một phần dữ liệu tạm thời chưa khả dụng: {unavailable.map(item => item.source).join(", ")}. Các phần còn lại vẫn là dữ liệu thật.</span>
        </div>
      )}

      <section aria-label="Tóm tắt thống kê" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map(item => <Metric key={item.label} {...item} loading={loading} />)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
        <div className="min-w-0 space-y-6">
          <Section title="Hoạt động giảng dạy" subtitle="Lớp gần đây và tiến độ buổi học" icon={GraduationCap} unavailable={!loading && !learningAvailable}>
            {loading ? <SkeletonRows /> : learningAvailable ? (
              learning?.classes?.length ? <div className="space-y-3">{learning.classes.map((item: any) => {
                const percent = item.totalSessions ? Math.min(100, Math.round(item.completedSessions * 100 / item.totalSessions)) : 0;
                return <div key={item.classRoomId} className="border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{item.className}</p><p className="mt-1 text-xs font-bold uppercase text-slate-400">{item.status} · {item.enrolledStudents} học viên</p></div><span className="text-sm font-black text-blue-700">{percent}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div>
                  <p className="mt-2 text-xs text-slate-500">{item.completedSessions}/{item.totalSessions} buổi hoàn thành · {item.upcomingSessions} buổi sắp tới</p>
                </div>;
              })}</div> : <Empty text="Chưa có lớp học để thống kê." />
            ) : <Unavailable text="Không thể tải dữ liệu lớp và buổi học." />}
          </Section>

          <Section title="Thu nhập theo lớp" subtitle="Chỉ tính settlement đã release hoặc đang chờ xử lý" icon={TrendingUp} unavailable={!loading && !incomeAvailable}>
            {loading ? <SkeletonRows /> : incomeAvailable ? (
              income?.classBreakdown?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-slate-100 text-[11px] font-black uppercase text-slate-400"><tr><th className="py-3">Lớp</th><th>Đã release</th><th>Đang chờ</th><th>Số payout</th></tr></thead><tbody className="divide-y divide-slate-100">{income.classBreakdown.map((item: any) => <tr key={item.classRoomId}><td className="py-4 pr-4 font-bold">{item.className || `Lớp #${item.classRoomId}`}</td><td className="font-black text-emerald-700">{fmtMoney(item.releasedAmount, currency)}</td><td className="font-bold text-amber-700">{fmtMoney(item.pendingAmount, currency)}</td><td>{item.settledPayouts}</td></tr>)}</tbody></table></div> : <Empty text="Chưa có settlement tài chính cho gia sư này." />
            ) : <Unavailable text="Contract Service chưa khả dụng; số tiền không được hiển thị thành 0." />}
          </Section>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="Việc cần xử lý" subtitle="Khối lượng học vụ hiện tại" icon={FileCheck2} unavailable={!loading && !learningAvailable}>
            {loading ? <SkeletonRows /> : learningAvailable ? <div className="grid grid-cols-2 gap-3">
              <SmallMetric label="Bài đã giao" value={operations?.assignmentsCreated} />
              <SmallMetric label="Bài chờ chấm" value={operations?.pendingSubmissions} alert={Number(operations?.pendingSubmissions) > 0} />
              <SmallMetric label="Bài đã chấm" value={operations?.gradedSubmissions} />
              <SmallMetric label="Buổi cần hoàn tất" value={operations?.sessionActionsPending} alert={Number(operations?.sessionActionsPending) > 0} />
            </div> : <Unavailable text="Không thể tải khối lượng học vụ." />}
            <button onClick={() => onNavigate("homework")} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-700">Mở quản lý bài tập <ArrowRight size={15} /></button>
          </Section>

          <Section title="Buổi học sắp tới" subtitle="Tối đa 8 buổi gần nhất" icon={CalendarClock} unavailable={!loading && !learningAvailable}>
            {loading ? <SkeletonRows /> : learningAvailable ? learning?.upcomingSessions?.length ? <div className="space-y-3">{learning.upcomingSessions.map((item: any) => <div key={item.sessionId} className="flex gap-3 border-l-2 border-blue-500 pl-3"><div className="min-w-0"><p className="truncate text-sm font-black">{item.className}</p><p className="mt-1 text-xs text-slate-500">{fmtDate(item.sessionDate)} · {item.startTime}–{item.endTime} · Buổi {item.sequenceNumber}</p></div></div>)}</div> : <Empty text="Không có buổi học sắp tới." /> : <Unavailable text="Lịch buổi học chưa khả dụng." />}
          </Section>

          <Section title="Đánh giá học viên" subtitle="Phản hồi công khai gần đây" icon={Star} unavailable={!loading && !learningAvailable}>
            {loading ? <SkeletonRows /> : learningAvailable ? <>
              <div className="flex items-end gap-3"><span className="text-4xl font-black text-amber-500">{Number(reviews?.averageRating || 0).toFixed(1)}</span><span className="pb-1 text-sm font-bold text-slate-500">/ 5 · {fmtNumber(reviews?.reviewCount)} đánh giá</span></div>
              <div className="mt-4 space-y-2">{[5,4,3,2,1].map(star => { const count = Number(reviews?.distribution?.[star] || 0); const width = reviews?.reviewCount ? count * 100 / reviews.reviewCount : 0; return <div key={star} className="grid grid-cols-[24px_1fr_28px] items-center gap-2 text-xs"><span className="font-bold">{star}★</span><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} /></div><span className="text-right text-slate-500">{count}</span></div>; })}</div>
              {reviews?.recent?.length > 0 && <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">{reviews.recent.slice(0, 3).map((review: any) => <div key={review.id}><p className="text-xs font-black text-amber-600">{"★".repeat(review.rating)}</p><p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{review.comment}</p></div>)}</div>}
            </> : <Unavailable text="Dữ liệu review chưa khả dụng." />}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, loading }: any) {
  const tones: Record<string, string> = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };
  return <div className="min-w-0 border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}><Icon size={20} /></div><p className="mt-4 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-black">{loading ? "..." : value == null ? "Không khả dụng" : value}</p></div>;
}
function Section({ title, subtitle, icon: Icon, unavailable, children }: any) { return <section className={`min-w-0 overflow-hidden border bg-white p-5 shadow-sm ${unavailable ? "border-amber-200" : "border-slate-200"}`}><header className="mb-4 flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><Icon size={18} /></div><div className="min-w-0"><h2 className="font-black">{title}</h2><p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p></div></header>{children}</section>; }
function SmallMetric({ label, value, alert }: any) { return <div className={`border p-3 ${alert ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}><p className="text-[11px] font-bold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${alert ? "text-amber-700" : "text-slate-900"}`}>{fmtNumber(value)}</p></div>; }
function SkeletonRows() { return <div className="space-y-3" aria-label="Đang tải"><div className="h-16 animate-pulse bg-slate-100" /><div className="h-16 animate-pulse bg-slate-100" /><div className="h-16 animate-pulse bg-slate-100" /></div>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm font-semibold text-slate-400">{text}</p>; }
function Unavailable({ text }: { text: string }) { return <div className="flex items-start gap-2 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{text}</div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="flex flex-col gap-3 border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><AlertCircle size={16} />{message}</span><button onClick={retry} className="inline-flex items-center justify-center gap-2 border border-rose-200 bg-white px-3 py-2 font-bold"><RefreshCw size={15} />Thử lại</button></div>; }
