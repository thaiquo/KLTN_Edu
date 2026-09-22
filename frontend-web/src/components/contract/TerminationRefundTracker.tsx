import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';
import { EtherscanLink } from '../common/EtherscanLink';

const stages: Record<string, string> = {
  HOLD_PENDING: 'Đang tạm dừng lịch học', REQUESTED: 'Chờ thẩm định',
  RECOMMENDED: 'Chờ Admin duyệt', APPROVED: 'Đã duyệt, đang thanh lý',
  RELEASE_PENDING: 'Đang khôi phục lịch học', REJECTED: 'Đã từ chối',
  LEARNING_PENDING: 'Đang đồng bộ lớp học', WAITING_PAYMENT: 'Chờ xử lý hạn nạp cọc',
  WAITING_SETTLEMENT: 'Chờ quyết toán buổi đã bắt đầu và xử lý khiếu nại',
  BLOCKCHAIN_PENDING: 'Chờ xác nhận giao dịch',
  WAITING_REFUND_EVENT: 'Chờ xác nhận số tiền hoàn',
  TRANSACTION_FAILED: 'Giao dịch lỗi, cần kiểm tra', COMPLETED: 'Đã hoàn tất',
};

export function TerminationRefundTracker() {
  const [cases, setCases] = useState<TerminationView[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await terminationsApi.list();
        if (active) { setCases(data); setError(''); }
      } catch {
        if (active) setError('Không tải được tiến độ hoàn tiền. Vui lòng thử lại.');
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [revision]);

  return (
    <section className="border-y border-slate-200 bg-white py-5 space-y-4">
      <div className="flex items-center justify-between gap-3 px-4">
        <h3 className="text-base font-bold text-slate-900">Hoàn tiền hủy hợp đồng / hủy lớp</h3>
        <button type="button" title="Làm mới tiến độ hoàn tiền" aria-label="Làm mới tiến độ hoàn tiền"
          onClick={() => setRevision(v => v + 1)} className="shrink-0 p-2 text-blue-700 hover:bg-blue-50 rounded">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {error && <p role="alert" className="px-4 text-sm text-red-700">{error}</p>}
      {loading ? <p className="px-4 text-sm">Đang tải tiến độ...</p> : !error && cases.length === 0 ?
        <p className="px-4 text-sm text-slate-500">Chưa có hồ sơ chấm dứt hợp đồng.</p> : null}
      {cases.map(({ request, items }) => (
        <div key={request.id} className="border-t border-slate-100 px-4 pt-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong>{request.wholeClass ? 'Hủy toàn bộ lớp' : 'Chấm dứt hợp đồng riêng'} · Lớp #{request.classroomId}</strong>
            <span>{stages[request.status] || request.status} · {items.filter(i => i.status === 'COMPLETED').length}/{items.length} hợp đồng</span>
          </div>
          {request.lastError && <p className="text-sm text-red-700 break-words">{request.lastError}</p>}
          <ul className="divide-y divide-slate-100">
            {items.map(item => (
              <li key={item.agreementId} className="grid gap-2 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><strong>{item.studentName}</strong><p className="text-xs text-slate-500">HĐ #{item.agreementId.slice(0, 8)}</p></div>
                <div className={item.lastError ? 'text-red-700' : 'text-slate-700'}>
                  {['APPROVED', 'COMPLETED'].includes(request.status) ? stages[item.status] || item.status : stages[request.status] || request.status}
                  {item.lastError && <p className="text-xs break-words">{item.lastError}</p>}
                </div>
                <div>{item.refundedUnits != null ?
                  <span className="font-semibold text-emerald-700">Hoàn về học viên: {(Number(item.refundedUnits) / 10 ** item.tokenDecimals).toLocaleString('vi-VN', { maximumFractionDigits: item.tokenDecimals })} USDC</span> :
                  <span className="text-slate-500">Chưa xác nhận tiền hoàn</span>}</div>
                <div>{item.transactionHash ? <EtherscanLink txHash={item.transactionHash} chainId={item.chainId ?? undefined} /> : <span className="text-slate-500">Chưa có giao dịch</span>}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
