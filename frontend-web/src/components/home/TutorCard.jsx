import { ArrowUpRight, Heart, Star } from 'lucide-react';

export function TutorCard({ tutor }) {
  return (
    <article className="overflow-hidden border border-slate-200 rounded-[28px] bg-white shadow-[0_16px_36px_rgba(15,23,42,.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_rgba(15,23,42,.11)]">
      {/* Image */}
      <div className="relative aspect-[1.18] overflow-hidden m-3 rounded-[20px] bg-slate-200">
        <img
          src={tutor.image}
          alt={tutor.imageAlt}
          className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
        />
        {/* Rating */}
        <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/95 text-slate-900 text-[12px] font-extrabold shadow-[0_6px_14px_rgba(15,23,42,.1)]">
          <Star size={14} fill="#f59e0b" stroke="#f59e0b" />
          {tutor.rating}
        </span>
        {/* Favourite */}
        <button
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-[10px] bg-white/92 text-slate-800 border-0 hover:text-red-500 transition-colors"
          type="button"
          aria-label={`Lưu gia sư ${tutor.name}`}
        >
          <Heart size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 pb-5 pt-1">
        <h3 className="font-display font-extrabold text-[19px] tracking-tight text-slate-900">{tutor.name}</h3>
        <p className="min-h-10 mt-1.5 text-slate-500 text-[12px] leading-[1.55]">{tutor.credential}</p>
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {tutor.tags.map((tag) => (
            <span key={tag} className="px-2 py-1.5 rounded-lg bg-blue-50 text-primary-dark text-[9px] font-extrabold tracking-[.02em] uppercase">
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
          <span className="text-primary">
            <strong className="font-display font-extrabold text-[18px]">{tutor.rate}</strong>
            <small className="ml-1 text-slate-400">/buổi</small>
          </span>
          <a
            href="#trust"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-slate-900 text-white text-[9px] font-extrabold hover:bg-primary transition-colors"
          >
            XEM HỒ SƠ <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </article>
  );
}
