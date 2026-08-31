import { HomeHeader } from '../components/home/HomeHeader';
import { HomeFooter } from '../components/home/HomeFooter';

function PageShell({ title, description }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <HomeHeader />
      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 text-[#0f766e] mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-[#0f172a] mb-4">{title}</h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            {description}
          </p>
          <div className="mt-10 p-8 border border-slate-200 bg-white rounded-2xl shadow-sm inline-block max-w-lg w-full">
            <p className="text-slate-500 italic">Giao diện chuyên sâu đang được phát triển.</p>
          </div>
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}

export function MyClassesPage() {
  return <PageShell title="Lớp học của tôi" description="Quản lý và theo dõi tiến độ các lớp học 1:1 của bạn tại đây." />;
}

export function MessagesPage() {
  return <PageShell title="Tin nhắn" description="Trao đổi trực tiếp với gia sư và đội ngũ hỗ trợ." />;
}

export function ContractsPage() {
  return <PageShell title="Hợp đồng của tôi" description="Xem chi tiết các hợp đồng điện tử và cam kết học tập." />;
}

export function BillingPage() {
  return <PageShell title="Thanh toán & Ký quỹ" description="Quản lý lịch sử giao dịch và tài khoản ví của bạn." />;
}
