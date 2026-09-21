import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Loader2, Send, Check, X, MessageSquare, ClipboardCheck } from 'lucide-react';
import { contractsApi, AgreementSummary } from '../../api/contractsApi';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';

const labels: Record<string, string> = {
  REQUESTED: 'Chờ xem xét', RECOMMENDED: 'Đề xuất chấm dứt', APPROVED: 'Đang chấm dứt',
  REJECTED: 'Không chấp thuận', COMPLETED: 'Hoàn tất', LEARNING_PENDING: 'Chờ dừng lịch học',
  WAITING_SETTLEMENT: 'Chờ quyết toán buổi đã học', WAITING_PAYMENT: 'Chờ xác nhận / hết hạn thanh toán',
  BLOCKCHAIN_PENDING: 'Chờ xác nhận giao dịch', TRANSACTION_FAILED: 'Giao dịch cần kiểm tra',
  WAITING_REFUND_EVENT: 'Chờ xác nhận hoàn tiền', RESPOND: 'Giải trình', RECOMMEND: 'Đề xuất chấm dứt',
  APPROVE: 'Phê duyệt chấm dứt', REJECT: 'Không chấp thuận',
};
const inputStyle = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors disabled:opacity-50';
const message = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.';
const units = (value?: string | null, decimals: number = 6) => {
  if (!value) return '0';
  const digits = String(value).padStart(decimals + 1, '0');
  return decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
};
const parseAudit = (json?: string | null) => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Array<{ actor: string; action: string; reason: string; at: string }>) : [];
  } catch {
    return [];
  }
};

import { signTerminationRequestEip712 } from '../../web3/eip712Signer';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';

export function TerminationPanel({ activeRole }: { activeRole: string }) {
  const { address } = useWeb3Wallet();
  const [requests, setRequests] = useState<TerminationView[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [agreementId, setAgreementId] = useState('');
  const [wholeClass, setWholeClass] = useState(activeRole === 'tutor');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ id: string; type: string } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const manager = activeRole === 'admin' || activeRole === 'staff';
  const load = useCallback(async () => {
    try { setRequests(await terminationsApi.list()); setError(''); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void load();
    const timer = window.setInterval(load, 15000);
    void (async () => {
      try {
        const result: AgreementSummary[] = [];
        for (let page = 0; ; page++) {
          const response = await contractsApi.listAgreements({ page, size: 100 });
          const content = response.content ?? [];
          result.push(...content);
          if (content.length < 100 || result.length >= response.totalElements) break;
        }
        if (active) setAgreements(result);
      } catch (e) { if (active) setError(message(e)); }
    })();
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);
  const available = agreements.filter(a => !a.legacyUnreconciled && !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(a.status));
  const names = new Map(agreements.map(a => [a.id, a.className || `Lớp #${a.classroomId}`]));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const targetAgr = agreements.find(a => a.id === agreementId);
      let sig: string | undefined = undefined;
      let signerWallet: string | undefined = undefined;
      let requestedAt: number | undefined = undefined;

      const normalizedRole = (activeRole || '').toLowerCase();
      if (normalizedRole === 'student' || normalizedRole === 'tutor') {
        if (!targetAgr) throw new Error('Không tìm thấy thông tin hợp đồng được chọn.');
        const expectedWallet = normalizedRole === 'student' ? targetAgr.studentWallet : targetAgr.tutorWallet;
        if (!expectedWallet || expectedWallet.trim() === '' || expectedWallet.toLowerCase() === '0x' + '0'.repeat(40)) {
          throw new Error('Hợp đồng chưa liên kết địa chỉ ví hợp lệ.');
        }
        if (!address) throw new Error('Vui lòng kết nối ví MetaMask trước khi gửi yêu cầu.');
        const sigRes = await signTerminationRequestEip712({
          agreementId,
          expectedWallet,
          reason,
          wholeClass,
          chainId: targetAgr.chainId,
          escrowContractAddress: targetAgr.escrowContractAddress,
        }, address);
        sig = sigRes.signature;
        signerWallet = sigRes.signerWallet;
        requestedAt = sigRes.requestedAt;
      }

      await terminationsApi.request(agreementId, wholeClass, reason, sig, signerWallet, requestedAt);
      setReason(''); setSuccess('Đã gửi yêu cầu chấm dứt kèm chữ ký số xác thực.'); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const review = async (event: React.FormEvent) => {
    event.preventDefault(); if (!action) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await terminationsApi.act(action.id, action.type, reviewReason);
      setAction(null); setReviewReason(''); setSuccess('Đã ghi nhận quyết định.'); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const choose = (id: string, type: string) => { setAction({ id, type }); setReviewReason(''); };
  return <section className="space-y-5 text-gray-800">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Chấm dứt hợp đồng</h2>
      <button className={buttonStyle} onClick={load} disabled={busy} title="Làm mới" aria-label="Làm mới"><RefreshCw size={16} /></button>
    </div>
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-green-700">{success}</p>}
    <form onSubmit={submit} className="grid gap-3 border-y border-gray-200 py-4 md:grid-cols-2">
      <label className="min-w-0 space-y-1 text-sm">Hợp đồng
        <select className={inputStyle} required value={agreementId} onChange={e => setAgreementId(e.target.value)} disabled={busy}>
          <option value="">Chọn hợp đồng</option>
          {available.map(a => <option key={a.id} value={a.id}>{a.className || `Lớp #${a.classroomId}`} - {a.studentName || a.studentEmail} - {a.id.slice(0, 8)}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">Phạm vi
        <select className={inputStyle} value={wholeClass ? 'CLASS' : 'AGREEMENT'} disabled={busy || activeRole === 'student' || activeRole === 'tutor'} onChange={e => setWholeClass(e.target.value === 'CLASS')}>
          {activeRole !== 'tutor' && <option value="AGREEMENT">Một hợp đồng</option>}
          {activeRole !== 'student' && <option value="CLASS">Toàn bộ lớp học</option>}
        </select>
      </label>
      <label className="space-y-1 text-sm md:col-span-2">Lý do và minh chứng
        <textarea className={inputStyle} rows={3} maxLength={5000} required value={reason} onChange={e => setReason(e.target.value)} disabled={busy} />
      </label>
      <div className="md:col-span-2"><button className={`${buttonStyle} bg-green-700 text-white`} disabled={busy || !agreementId || !reason.trim()}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi yêu cầu
      </button></div>
    </form>
    {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Đang tải hồ sơ...</p>}
    {!loading && requests.length === 0 && <p className="text-sm text-gray-500">Chưa có yêu cầu chấm dứt.</p>}
    {requests.map(({ request: c, items }) => <article key={c.id} className="space-y-3 border-b border-gray-200 pb-5">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="min-w-0"><h3 className="break-words font-semibold">{names.get(c.anchorAgreementId) || `Lớp #${c.classroomId}`}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{c.wholeClass ? 'Toàn lớp' : 'Một hợp đồng'} · {new Date(c.createdAt).toLocaleString('vi-VN')}</span>
            {c.signerWallet && (
              <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                <Check size={12} /> Ví ký xác thực: {c.signerWallet.slice(0, 6)}...{c.signerWallet.slice(-4)}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-medium text-green-800">{labels[c.status] || c.status}</p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{c.reason}</p>
      {c.lastError && <p role="alert" className="break-words text-sm text-red-700">{c.lastError}</p>}
      {items.length > 0 && <div className="overflow-x-auto">
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-2 pr-3">Học viên</th><th className="pr-3">Tiến độ</th><th className="pr-3">Hoàn khi chấm dứt</th><th>Giao dịch</th></tr></thead>
          <tbody>{items.map(i => <tr key={i.agreementId} className="border-b border-gray-100 align-top">
            <td className="py-2 pr-3"><p className="break-words">{i.studentName}</p><span className="text-xs text-gray-500">{i.agreementId.slice(0, 8)}</span></td>
            <td className="py-2 pr-3">{labels[i.status] || i.status}{i.lastError && <p className="max-w-sm break-words text-xs text-red-700">{i.lastError}</p>}</td>
            <td className="whitespace-nowrap py-2 pr-3">{i.refundedUnits == null ? 'Chưa xác nhận' : `${units(i.refundedUnits, i.tokenDecimals)} USDC`}</td>
            <td className="py-2">{i.transactionHash ? (i.chainId === 11155111
              ? <a className="text-green-700 underline" href={`https://sepolia.etherscan.io/tx/${i.transactionHash}`} target="_blank" rel="noreferrer">{i.transactionHash.slice(0, 10)}...</a>
              : <span className="break-all text-xs">{i.transactionHash}</span>) : '-'}</td>
          </tr>)}</tbody></table>
      </div>}
      <details className="text-sm"><summary className="cursor-pointer text-gray-600">Lịch sử xử lý</summary>
        <ul className="mt-2 space-y-2">{parseAudit(c.auditJson).map((entry, index) =>
          <li key={index} className="break-words border-l-2 border-gray-200 pl-3"><p className="text-xs text-gray-500">{entry.at ? new Date(entry.at).toLocaleString('vi-VN') : ''} · {entry.actor} · {labels[entry.action] || entry.action}</p><p className="whitespace-pre-wrap">{entry.reason}</p></li>)}</ul>
      </details>
      <div className="flex flex-wrap gap-2">
        {!manager && ['REQUESTED', 'RECOMMENDED'].includes(c.status) && <button className={buttonStyle} onClick={() => choose(c.id, 'RESPOND')} disabled={busy}><MessageSquare size={16} /> Giải trình</button>}
        {manager && c.status === 'REQUESTED' && <button className={buttonStyle} onClick={() => choose(c.id, 'RECOMMEND')} disabled={busy}><ClipboardCheck size={16} /> Đề xuất chấm dứt</button>}
        {activeRole === 'admin' && c.status === 'RECOMMENDED' && <button className={`${buttonStyle} border-red-300 text-red-700`} onClick={() => choose(c.id, 'APPROVE')} disabled={busy}><Check size={16} /> Phê duyệt chấm dứt</button>}
        {manager && ['REQUESTED', 'RECOMMENDED'].includes(c.status) && <button className={buttonStyle} onClick={() => choose(c.id, 'REJECT')} disabled={busy}><X size={16} /> Không chấp thuận</button>}
      </div>
      {action?.id === c.id && <form onSubmit={review} className="space-y-2 border-l-2 border-red-300 pl-3">
        <p className="font-medium">{labels[action.type]}</p>
        {action.type === 'APPROVE' && <p className="text-sm text-red-700">{c.wholeClass ? 'Dừng lịch học tương lai của cả lớp.' : 'Dừng các buổi tương lai của học viên này.'} Các buổi đã bắt đầu sẽ được quyết toán trước khi hoàn phần tiền còn lại. Quyết định này không thể rút lại sau khi gửi giao dịch.</p>}
        <label className="block space-y-1 text-sm">Nội dung xác minh / giải trình<textarea className={inputStyle} required maxLength={5000} rows={3} value={reviewReason} onChange={e => setReviewReason(e.target.value)} disabled={busy} /></label>
        <div className="flex gap-2"><button className={`${buttonStyle} bg-green-700 text-white`} disabled={busy || !reviewReason.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Xác nhận</button>
          <button type="button" className={buttonStyle} onClick={() => setAction(null)} disabled={busy}>Đóng</button></div>
      </form>}
    </article>)}
  </section>;
}
