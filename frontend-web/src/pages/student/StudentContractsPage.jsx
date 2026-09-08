import { EscrowContractsView } from '../../components/contract/EscrowContractsView';
import { StudentPageScaffold } from './StudentPageScaffold';

export function StudentContractsPage() {
  return (
    <StudentPageScaffold
      eyebrow="Hợp đồng"
      title="Hợp đồng của tôi"
      description="Theo dõi hợp đồng học tập, chữ ký xác nhận và trạng thái ký quỹ của các lớp bạn đã đăng ký."
    >
      <EscrowContractsView activeRole="student" />
    </StudentPageScaffold>
  );
}
