import { CheckCircle2 } from 'lucide-react';

export function AiRequirementReviewLayout({
  leftTitle = 'AI đã hiểu',
  leftDescription,
  leftContent,
  rightTitle = 'Bổ sung nếu bạn muốn',
  rightDescription,
  rightContent,
  emptyRightText = 'Thông tin đã khá đầy đủ. Bạn có thể tiếp tục tìm kiếm.',
  footerContent
}) {
  const hasRightContent = Boolean(rightContent);

  return (
    <div className="space-y-5">
      <div className={`grid gap-5 ${hasRightContent ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={21} />
            </span>
            <div>
              <h3 className="font-display text-xl font-extrabold text-slate-950">{leftTitle}</h3>
              {leftDescription && <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{leftDescription}</p>}
            </div>
          </div>
          <div className="mt-6">{leftContent}</div>
        </section>

        {hasRightContent ? (
          <aside className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,.05)] sm:p-6">
            <h3 className="font-display text-lg font-extrabold text-slate-950">{rightTitle}</h3>
            {rightDescription && <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{rightDescription}</p>}
            <div className="mt-5">{rightContent}</div>
          </aside>
        ) : (
          <aside className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-6 text-emerald-800 shadow-[0_14px_36px_rgba(15,23,42,.04)]">
            {emptyRightText}
          </aside>
        )}
      </div>

      {footerContent && <div>{footerContent}</div>}
    </div>
  );
}
