import type { TerminationItem, TerminationView } from '../../api/terminationsApi';

export const terminationCaseLabel = (status: string): string => ({
  HOLD_PENDING: 'Đang tạm dừng lịch học',
  REQUESTED: 'Đã tạm dừng lịch tương lai, chờ thẩm định',
  RECOMMENDED: 'Staff đã thẩm định, chờ Admin quyết định',
  APPROVED: 'Admin đã duyệt, đang xử lý quyết toán và hoàn cọc',
  RELEASE_PENDING: 'Đang khôi phục lịch học',
  REJECTED: 'Đã từ chối, lịch học được khôi phục',
  COMPLETED: 'Đã hoàn tất hủy và xử lý tiền cọc',
}[status] || status);

export const terminationItemLabel = (item: TerminationItem): string => ({
  LEARNING_PENDING: 'Đang đồng bộ lịch học',
  WAITING_PAYMENT: 'Đang xử lý hợp đồng chưa nạp cọc',
  WAITING_SETTLEMENT: 'Chờ quyết toán các buổi trước mốc hủy',
  BLOCKCHAIN_PENDING: 'Đã gửi giao dịch, chờ blockchain xác nhận',
  WAITING_REFUND_EVENT: 'Giao dịch đã ghi nhận, chờ xác nhận tiền hoàn',
  TRANSACTION_FAILED: 'Giao dịch gặp lỗi, cần nhân viên kiểm tra',
  COMPLETED: item.refundedUnits != null && Number(item.refundedUnits) > 0
    ? 'Đã hoàn cọc về ví học viên'
    : 'Đã tất toán, không có cọc dư',
}[item.status] || item.status);

export const terminationProgressText = (termination: TerminationView): string => {
  const { request, items } = termination;
  if (request.status !== 'APPROVED') return terminationCaseLabel(request.status);
  const outstanding = items.filter(item => item.status !== 'COMPLETED');
  if (outstanding.length === 0) return 'Đã duyệt, đang cập nhật trạng thái lớp';
  if (outstanding.some(item => item.status === 'TRANSACTION_FAILED')) return 'Cần kiểm tra giao dịch hoàn tiền';
  if (outstanding.some(item => item.status === 'WAITING_SETTLEMENT')) return 'Chờ quyết toán buổi trước mốc hủy';
  if (outstanding.some(item => item.status === 'BLOCKCHAIN_PENDING')) return 'Chờ xác nhận giao dịch hoàn cọc';
  if (outstanding.some(item => item.status === 'WAITING_REFUND_EVENT')) return 'Chờ xác nhận sự kiện hoàn tiền';
  return terminationCaseLabel(request.status);
};

export const terminationWaitingDetail = (error: string | null): string | null => {
  if (!error) return null;
  const settlement = error.match(/^Waiting for confirmed session settlement: (.+)$/);
  if (settlement) {
    const descriptions: Record<string, string> = {
      PREPARING: 'đang chuẩn bị quyết toán',
      PROPOSE_PENDING: 'đang gửi đề xuất quyết toán',
      PROPOSED: 'đang trong hạn khiếu nại',
      DISPUTE_OPENING: 'đang mở khiếu nại',
      DISPUTED: 'chờ phân xử khiếu nại',
      RESOLUTION_PENDING: 'chờ xác nhận phán quyết',
      FINALIZE_PENDING: 'chờ xác nhận quyết toán',
      FAILED_RETRYABLE: 'quyết toán đang được thử lại',
    };
    const sessions = settlement[1].replace(/#(\d+) \(([^)]+)\)/g,
      (_, number: string, status: string) => `#${number} (${descriptions[status] || status})`);
    return `Buổi ${sessions} chưa quyết toán xong; tiền cọc dư sẽ được hoàn sau khi buổi này hoàn tất.`;
  }
  const delivery = error.match(/^Waiting for Learning settlement delivery: (.+)$/);
  if (delivery) return `Đang chờ dữ liệu quyết toán buổi ${delivery[1]} từ hệ thống lớp học.`;
  return error;
};
