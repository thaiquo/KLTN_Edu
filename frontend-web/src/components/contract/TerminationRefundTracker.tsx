import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';
import { EtherscanLink } from '../common/EtherscanLink';
import { terminationCaseLabel, terminationItemLabel, terminationProgressText, terminationWaitingDetail } from './terminationStatus';

const formatUnits = (value: string | null | undefined, decimals: number) => {
  const scale = 10n ** BigInt(decimals);
  const amount = BigInt(value || '0');
  const whole = (amount / scale).toLocaleString('vi-VN');
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole},${fraction}` : whole;
};

export function TerminationRefundTracker({ viewerRole = 'student' }: { viewerRole?: string }) {
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
        const data = await terminationsApi.listRefunds();
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
        <div>
          <h3 className="text-base font-bold text-slate-900">Dòng tiền khi hủy hợp đồng / hủy lớp</h3>
          <p className="mt-1 text-xs text-slate-500">Tiền hoàn theo buổi và cọc dư hoàn khi hủy là hai khoản riêng, chỉ ghi nhận khi blockchain xác nhận.</p>
        </div>
        <button type="button" title="Làm mới tiến độ hoàn tiền" aria-label="Làm mới tiến độ hoàn tiền"
          onClick={() => setRevision(v => v + 1)} className="shrink-0 p-2 text-blue-700 hover:bg-blue-50 rounded">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {error && <p role="alert" className="px-4 text-sm text-red-700">{error}</p>}
      {loading ? <p className="px-4 text-sm">Đang tải tiến độ...</p> : !error && cases.length === 0 ?
        <p className="px-4 text-sm text-slate-500">Chưa có hồ sơ hủy hợp đồng hoặc hủy lớp liên quan đến ví của bạn.</p> : null}
      {cases.map(({ request, items, evidence }) => (
        <div key={request.id} className="border-t border-slate-100 px-4 pt-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong>{request.wholeClass ? 'Hủy toàn bộ lớp' : 'Chấm dứt hợp đồng riêng'} · Lớp #{request.classroomId}</strong>
            <span>{terminationProgressText({ request, items, evidence })} · {items.filter(i => i.status === 'COMPLETED').length}/{items.length} hợp đồng</span>
          </div>
          {request.lastError && <p className="text-sm text-red-700 break-words">{request.lastError}</p>}
          <ul className="divide-y divide-slate-100">
            {items.map(item => (
              <li key={item.agreementId} className="grid gap-2 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><strong>{item.studentName}</strong><p className="text-xs text-slate-500">HĐ #{item.agreementId.slice(0, 8)}</p></div>
                <div className={item.lastError ? (item.lastError.startsWith('Waiting for') ? 'text-amber-700' : 'text-red-700') : 'text-slate-700'}>
                  {['APPROVED', 'COMPLETED'].includes(request.status) ? terminationItemLabel(item) : terminationCaseLabel(request.status)}
                  {item.lastError && <p className="text-xs break-words">{terminationWaitingDetail(item.lastError)}</p>}
                </div>
                <div>{item.refundedUnits != null ?
                  <span className="font-semibold text-emerald-700">{BigInt(item.refundedUnits) > 0n
                    ? `Đã hoàn cọc dư về học viên: ${formatUnits(item.refundedUnits, item.tokenDecimals)} USDC`
                    : 'Đã tất toán, không có cọc dư để hoàn'}</span> :
                  <span className="text-slate-500">{request.status === 'REJECTED' ? 'Yêu cầu đã từ chối, không có giao dịch hoàn cọc' : 'Chưa xác nhận tiền hoàn'}</span>}</div>
                <div>{item.transactionHash ? <EtherscanLink txHash={item.transactionHash} chainId={item.chainId ?? undefined} /> : <span className="text-slate-500">Chưa có giao dịch</span>}</div>
                {item.depositedUnits != null && (
                  <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold text-slate-700">{viewerRole === 'tutor' ? 'Thu nhập và phần hoàn của học viên' : viewerRole === 'admin' ? 'Đối soát từng hợp đồng' : 'Tiền cọc của hợp đồng này đi đâu?'}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      <div><span className="block text-slate-500">Học viên đã nạp</span><strong className="text-blue-800">{formatUnits(item.depositedUnits, item.tokenDecimals)} USDC</strong></div>
                      <div><span className="block text-slate-500">Gia sư đã nhận</span><strong className="text-emerald-800">{formatUnits(item.tutorPaidUnits, item.tokenDecimals)} USDC</strong></div>
                      <div><span className="block text-slate-500">Phí nền tảng</span><strong className="text-indigo-800">{formatUnits(item.platformFeeUnits, item.tokenDecimals)} USDC</strong></div>
                      <div><span className="block text-slate-500">Hoàn theo buổi</span><strong className="text-purple-800">{formatUnits(item.sessionRefundedUnits, item.tokenDecimals)} USDC</strong></div>
                      <div><span className="block text-slate-500">Hoàn cọc dư khi hủy</span><strong className="text-rose-800">{item.refundedUnits == null ? 'Chưa xác nhận' : `${formatUnits(item.refundedUnits, item.tokenDecimals)} USDC`}</strong></div>
                      <div><span className="block text-slate-500">Còn trong Escrow</span><strong className="text-amber-800">{formatUnits(item.remainingUnits, item.tokenDecimals)} USDC</strong></div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">{item.status === 'COMPLETED'
                      ? 'Các khoản trên lấy từ quyết toán và sự kiện hoàn tiền đã xác nhận.'
                      : 'Các buổi chưa quyết toán vẫn nằm trong Escrow; số hoàn cọc dư sẽ chốt khi giao dịch hủy được xác nhận.'}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
