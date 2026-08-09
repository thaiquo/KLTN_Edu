import { Quote } from 'lucide-react';

export function TestimonialSection() {
  return (
    <section className="py-[clamp(88px,10vw,144px)] bg-white text-center scroll-mt-[90px]" aria-labelledby="testimonial-title">
      <div className="container-app grid justify-items-center max-w-[880px]">

        {/* Avatar */}
        <div className="relative mb-8">
          <img
            src="https://i.pravatar.cc/160?u=thanh-vinh"
            alt="Lê Thành Vinh — học viên tốt nghiệp ĐH Bách Khoa"
            loading="lazy"
            decoding="async"
            className="w-[84px] h-[84px] border-4 border-white rounded-[24px] object-cover shadow-[0_20px_52px_rgba(15,23,42,.15)]"
          />
          <span
            className="absolute -right-2.5 -bottom-1.5 w-7 h-7 grid place-items-center border-[3px] border-white rounded-full bg-primary text-white"
            aria-hidden="true"
          >
            <Quote size={14} />
          </span>
        </div>

        <h2
          id="testimonial-title"
          className="font-display font-extrabold text-[clamp(26px,4vw,48px)] leading-[1.2] tracking-tight italic"
        >
          "Nhờ có Kết Nối Học, mình tìm được gia sư rất phù hợp để hoàn thiện khóa luận tốt nghiệp. Hợp đồng rõ ràng, lịch học đúng giờ và chi phí đúng cam kết từ đầu."
        </h2>

        <strong className="mt-8 font-display font-extrabold text-[17px]">Lê Thành Vinh</strong>
        <span className="mt-2 text-primary text-[10px] font-extrabold tracking-[.18em] uppercase">
          Sinh viên tốt nghiệp — ĐH Bách Khoa TP.HCM
        </span>
      </div>
    </section>
  );
}
