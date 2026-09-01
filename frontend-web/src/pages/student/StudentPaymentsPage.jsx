import { WalletCards } from 'lucide-react';
import { MyWalletView } from '../../portal/components/MyWalletView';
import { StudentPageScaffold } from './StudentPageScaffold';

export function StudentPaymentsPage() {
  return (
    <StudentPageScaffold
      eyebrow="Thanh toán & Ký quỹ"
      title="Thanh toán & Ký quỹ"
      description="Trang này chỉ reuse phần kết nối ví Web3 đang có. Lịch sử giao dịch và escrow agreement sẽ cần API thật trước khi hiển thị."
    >
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.05)]">
        <div className="mb-6 flex items-start gap-3 rounded-[8px] border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            Chưa có payment/escrow REST API hoàn chỉnh cho Student Web. Không hiển thị transaction history hoặc escrow sample data trong phase này.
          </p>
        </div>
        <MyWalletView />
      </section>
    </StudentPageScaffold>
  );
}
