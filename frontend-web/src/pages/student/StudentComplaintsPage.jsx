import { Link } from 'react-router-dom';
import { BookOpen, ShieldCheck } from 'lucide-react';
import { DisputeManagementPanel } from '../../components/contract/DisputeManagementPanel';
import { StudentPageScaffold } from './StudentPageScaffold';

export function StudentComplaintsPage() {
  return (
    <StudentPageScaffold
      eyebrow="Khiếu nại & Bảo vệ quyền lợi"
      title="Khiếu nại của tôi"
      description="Xem lại toàn bộ đơn khiếu nại đã gửi, minh chứng, trạng thái xử lý và kết quả giải quyết phân xử on-chain."
      actions={
        <div className="flex items-center gap-2.5">
          <Link
            to="/student/classes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <BookOpen size={16} />
            Lớp học của tôi
          </Link>
          <Link
            to="/contracts"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 text-xs font-extrabold text-indigo-700 shadow-xs hover:bg-indigo-100/70 transition-colors"
          >
            <ShieldCheck size={16} />
            Hợp đồng & Ký quỹ
          </Link>
        </div>
      }
    >
      <DisputeManagementPanel activeRole="student" />
    </StudentPageScaffold>
  );
}
