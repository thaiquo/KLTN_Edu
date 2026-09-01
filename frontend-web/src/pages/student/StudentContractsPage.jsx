import { FileText } from 'lucide-react';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

export function StudentContractsPage() {
  return (
    <StudentPageScaffold
      eyebrow="Hợp đồng"
      title="Hợp đồng của tôi"
      description="Trang này giữ vị trí trong Student Web cho hợp đồng học tập khi contract REST API hoàn chỉnh."
    >
      <StudentEmptyState
        icon={<FileText size={24} />}
        title="Chưa có dữ liệu hợp đồng thật"
        description="Legacy contract list đang dùng sample data, vì vậy phase này không hiển thị danh sách hợp đồng giả."
      />
    </StudentPageScaffold>
  );
}
