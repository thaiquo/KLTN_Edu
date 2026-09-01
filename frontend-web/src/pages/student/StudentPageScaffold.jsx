import { Link } from 'react-router-dom';
import { HomeHeader } from '../../components/home/HomeHeader';

export function StudentPageScaffold({ eyebrow, title, description, actions, children }) {
  return (
    <div className="min-h-screen bg-bg font-sans text-slate-950">
      <HomeHeader />
      <main className="container-app space-y-7 pb-16 pt-[calc(80px+36px)]">
        <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.05)] sm:p-8">
          {eyebrow && (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          )}
          <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-tight tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}

export function StudentEmptyState({ icon, title, description, actionTo, actionLabel }) {
  return (
    <section className="rounded-[8px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,.04)]">
      {icon && (
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] bg-blue-50 text-primary">
          {icon}
        </span>
      )}
      <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-slate-950">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      )}
      {actionTo && actionLabel && (
        <Link
          to={actionTo}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-slate-900 px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary"
        >
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
