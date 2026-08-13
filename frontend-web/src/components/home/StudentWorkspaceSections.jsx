import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { featuredTutors } from './homeData';
import { TutorCard } from './TutorCard';

const learningProfile = null;
const recommendations = [];
const activeClasses = [];

export function StudentWorkspaceSections() {
  const hasLearningProfile = Boolean(learningProfile);
  const hasClasses = activeClasses.length > 0;

  return (
    <>
      <section id="learning-profile" className="py-8 bg-bg scroll-mt-[96px]">
        <div className="container-app">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <LearningProfileCard hasLearningProfile={hasLearningProfile} />
            <NextClassCard hasClasses={hasClasses} />
          </div>
        </div>
      </section>

      <section id="matching" className="py-12 bg-bg scroll-mt-[96px]" aria-labelledby="matching-title">
        <div className="container-app">
          <SectionHeader
            eyebrow="AI Matching"
            title="Gợi ý dành cho bạn"
            description="Khi Learning Profile và matching-service sẵn sàng, khu vực này sẽ hiển thị gia sư phù hợp cùng lý do đề xuất."
          />

          {recommendations.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.id} recommendation={recommendation} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles size={22} />}
              title="Chưa có gợi ý cá nhân hóa"
              description="Hoàn thiện hồ sơ học tập để hệ thống có đủ dữ liệu về môn học, mục tiêu, lịch rảnh và ngân sách trước khi đề xuất gia sư."
              actionHref="#learning-profile"
              actionLabel="Hoàn thiện hồ sơ học tập"
            />
          )}
        </div>
      </section>

      <section id="my-learning" className="py-12 bg-white scroll-mt-[96px]" aria-labelledby="my-learning-title">
        <div className="container-app">
          <SectionHeader
            eyebrow="Tiến trình học"
            title="Lớp học và lịch sắp tới"
            description="Khi learning-service được kết nối, đây sẽ là nơi ưu tiên buổi học tiếp theo, lớp đang học và lịch học gần nhất."
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <EmptyState
              icon={<BookOpen size={22} />}
              title="Bạn chưa tham gia lớp học nào"
              description="Bắt đầu bằng cách tìm gia sư phù hợp. Sau khi có lớp, các buổi học và hành động liên quan sẽ xuất hiện tại đây."
              actionHref="#find-tutor"
              actionLabel="Tìm gia sư"
            />
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="Chưa có buổi học sắp tới"
              description="Lịch học sẽ được hiển thị theo từng buổi khi lớp học và lịch học được tạo từ learning-service."
            />
          </div>
        </div>
      </section>

      <section id="student-inbox" className="py-12 bg-bg scroll-mt-[96px]" aria-labelledby="student-inbox-title">
        <div className="container-app">
          <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <EmptyState
              icon={<MessageCircle size={22} />}
              title="Tin nhắn sẽ xuất hiện theo lớp hoặc yêu cầu học"
              description="Không hiển thị badge hoặc thông báo giả. Khi messaging-service sẵn sàng, thread và số tin chưa đọc sẽ được nối vào khu vực này."
            />
            <ReadinessList />
          </div>
        </div>
      </section>

      <section className="py-12 bg-bg" aria-labelledby="featured-title">
        <div className="container-app">
          <SectionHeader
            eyebrow="Khám phá thêm"
            title="Gia sư nổi bật"
            description="Một số hồ sơ mẫu trong giao diện hiện tại để Student tiếp tục khám phá khi chưa có gợi ý cá nhân hóa."
          />
          <div className="mt-8 grid grid-cols-3 gap-6 max-[920px]:grid-cols-2 max-[760px]:flex max-[760px]:overflow-x-auto max-[760px]:gap-3.5 max-[760px]:pb-3 max-[760px]:snap-x">
            {featuredTutors.map((tutor) => (
              <div key={tutor.name} className="max-[760px]:flex-none max-[760px]:w-[min(300px,82vw)] max-[760px]:snap-start">
                <TutorCard tutor={tutor} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function LearningProfileCard({ hasLearningProfile }) {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">
            Student Learning Profile
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            {hasLearningProfile ? 'Hồ sơ học tập đã sẵn sàng' : 'Hoàn thiện hồ sơ học tập'}
          </h2>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-blue-50 text-primary">
          <ClipboardList size={22} />
        </span>
      </div>

      <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
        Cho chúng tôi biết môn học, mục tiêu, lịch rảnh và ngân sách để hệ thống có thể tìm gia sư phù hợp hơn.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {['Môn học mục tiêu', 'Lịch rảnh', 'Ngân sách', 'Hình thức học'].map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">
            {item}
          </span>
        ))}
      </div>

      <button
        type="button"
        disabled
        className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white opacity-60"
      >
        Hoàn thiện hồ sơ
        <ArrowRight size={16} />
      </button>
      <p className="mt-3 text-xs font-bold text-slate-400">
        Form Learning Profile sẽ được nối khi learning-service sẵn sàng.
      </p>
    </article>
  );
}

function NextClassCard({ hasClasses }) {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-slate-900 p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,.10)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-200">
        Buổi học tiếp theo
      </p>
      {hasClasses ? (
        <div className="mt-4">
          <h2 className="font-display text-2xl font-extrabold">Đang tải dữ liệu lớp học</h2>
        </div>
      ) : (
        <div className="mt-4">
          <h2 className="font-display text-2xl font-extrabold">Bạn chưa có lớp đang học</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
            Khi có lớp, buổi học kế tiếp, hành động nhắn tin và lịch học sẽ được ưu tiên ở khu vực này.
          </p>
          <a
            href="#find-tutor"
            className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-blue-50"
          >
            Tìm gia sư để bắt đầu
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </article>
  );
}

function ReadinessList() {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">
        Luồng sản phẩm sắp nối
      </p>
      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-950">
        Từ hồ sơ học tập đến lớp học
      </h2>
      <div className="mt-5 grid gap-3">
        {[
          'Student Learning Profile',
          'AI Matching',
          'Tutor Recommendation',
          'Request / Agreement',
          'Electronic Contract',
          'Class & Learning Schedule'
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700">
            <CheckCircle2 size={17} className="text-primary" />
            {item}
          </div>
        ))}
      </div>
    </article>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="flex items-end justify-between gap-7 max-[760px]:flex-col max-[760px]:items-start">
      <div className="grid gap-3">
        <span className="text-primary text-[11px] font-extrabold tracking-[.22em] uppercase">{eyebrow}</span>
        <h2 className="font-display font-extrabold text-[clamp(30px,4vw,48px)] leading-[1.05] tracking-tight text-slate-950">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, actionHref, actionLabel }) {
  return (
    <article className="rounded-[8px] border border-dashed border-slate-300 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.04)]">
      <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-blue-50 text-primary">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
      {actionHref && actionLabel && (
        <a
          href={actionHref}
          className="mt-5 inline-flex items-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-primary"
        >
          {actionLabel}
          <ArrowRight size={16} />
        </a>
      )}
    </article>
  );
}

function RecommendationCard({ recommendation }) {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5">
      <h3 className="font-display text-lg font-extrabold">{recommendation.tutorName}</h3>
    </article>
  );
}
