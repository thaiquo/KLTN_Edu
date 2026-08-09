import { Award, CheckCircle2, FileSignature, IdCard, Zap } from 'lucide-react';
import { trustFeatures } from './homeData';

const featureIcons = { contract: FileSignature, identity: IdCard, matching: Zap };

export function TrustSection() {
  return (
    <section
      className="py-[clamp(88px,10vw,144px)] bg-slate-900 text-white scroll-mt-[90px]"
      id="trust"
      aria-labelledby="trust-title"
    >
      <div className="container-app grid grid-cols-[1fr_minmax(360px,0.85fr)] items-center gap-[clamp(60px,9vw,120px)] max-[920px]:grid-cols-1 max-[920px]:gap-16">

        {/* Copy */}
        <div>
          <span className="text-blue-400 text-[11px] font-extrabold tracking-[.22em] uppercase">Bảo mật & Tin cậy</span>
          <h2 id="trust-title" className="font-display font-extrabold text-[clamp(48px,6.3vw,82px)] leading-[.94] tracking-tight mt-5">
            An toàn.<br />Minh bạch.<br />Đáng tin.
          </h2>

          <div className="grid gap-8 mt-12">
            {trustFeatures.map((feature, i) => {
              const Icon = featureIcons[feature.icon];
              return (
                <article className="flex items-start gap-5" key={feature.title}>
                  <span className={`flex-none w-12 h-12 grid place-items-center rounded-2xl text-white ${i === 0 ? 'bg-primary' : 'bg-slate-800'}`}>
                    <Icon size={23} />
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-display font-extrabold text-[17px] tracking-tight">{feature.title}</h3>
                    <p className="max-w-[480px] mt-2 text-slate-400 text-[14px] leading-[1.6]">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Visual */}
        <div className="relative max-[920px]:max-w-[560px] max-[920px]:w-full">
          {/* Glow blob */}
          <div className="absolute inset-[15%_-10%] rounded-full bg-primary/14 blur-[65px]" aria-hidden="true" />

          <div className="relative p-7 border border-slate-500/18 rounded-[42px] bg-slate-800/65 backdrop-blur-lg shadow-[0_28px_64px_rgba(0,0,0,.18)] max-[520px]:p-5 max-[520px]:rounded-[28px]">

            {/* Transaction row */}
            <div className="flex items-center gap-3.5 px-4 py-4 border border-slate-500/16 rounded-[18px] bg-white/4">
              <span className="w-10 h-10 grid place-items-center rounded-[12px] bg-success text-white">
                <CheckCircle2 size={19} />
              </span>
              <div className="grid gap-1 flex-1">
                <small className="text-slate-500 text-[9px] font-extrabold tracking-[.1em] uppercase">Hợp đồng xác nhận</small>
                <code className="text-slate-300 text-[12px]">HDT-2024-0821-KNH</code>
              </div>
              <strong className="px-2 py-1.5 rounded-lg bg-success/10 text-green-300 text-[10px] font-extrabold">Đã ký</strong>
            </div>

            {/* Academic proof */}
            <div className="p-6 mt-6 rounded-[22px] bg-primary shadow-[0_18px_32px_rgba(37,99,235,.24)]">
              <div className="flex items-center gap-2.5">
                <Award size={23} className="text-blue-200" />
                <strong className="font-display font-extrabold text-[15px]">Hồ sơ đã được kiểm duyệt</strong>
              </div>
              <p className="mt-4 text-blue-100 text-[13px] leading-[1.6]">
                Bằng cấp, chứng chỉ và cam kết dạy học của gia sư được hiển thị rõ ràng cho học viên tham khảo.
              </p>
              {/* Progress bar */}
              <div className="flex gap-1.5 mt-5">
                {[true, false, false, false].map((filled, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${filled ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            </div>

            {/* Caption */}
            <div className="flex items-center gap-2 mt-6 text-slate-500 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <b className="text-slate-400 font-semibold">Hệ thống hoạt động</b>
              <code className="ml-auto text-slate-600">v2.4.1 · ketnoi.edu</code>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
