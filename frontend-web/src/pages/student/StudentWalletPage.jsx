import { MyWalletView } from '../../portal/components/MyWalletView';
import { StudentPageScaffold } from './StudentPageScaffold';

export function StudentWalletPage() {
  return (
    <StudentPageScaffold
      eyebrow="Ví của tôi"
      title="Ví của tôi"
      description="Quản lý ví Web3, địa chỉ ví đã liên kết và số dư ETH / USDC của bạn."
    >
      <MyWalletView activeRole="student" />
    </StudentPageScaffold>
  );
}
