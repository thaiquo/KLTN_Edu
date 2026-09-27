import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileSignature,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Paperclip,
  FileText
} from 'lucide-react';
import { AgreementSummary } from '../../api/contractsApi';
import { terminationsApi } from '../../api/terminationsApi';
import { signTerminationRequestEip712 } from '../../web3/eip712Signer';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';

export interface TerminationAgreementTarget {
  id: string;
  className?: string;
  classroomId?: number;
  studentWallet: string;
  tutorWallet: string;
  pricePerSessionUsdc?: number;
  settledSessions?: number;
  totalSessions?: number;
  remainingAmountUsdc?: number;
  totalAmountUsdc?: number;
  affectedAgreements?: number;
  chainId?: number;
  escrowContractAddress?: string;
}

export interface TerminationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: TerminationAgreementTarget | AgreementSummary;
  activeRole: string;
  title?: string;
  description?: string;
  cancelLabel?: string;
  onSuccess?: () => void;
}

export function TerminationRequestModal({
  isOpen,
  onClose,
  agreement,
  activeRole,
  title,
  description,
  cancelLabel = 'Hủy bỏ',
  onSuccess
}: TerminationRequestModalProps) {
  const { address, chainId, connectWallet, isConnecting, switchNetwork } = useWeb3Wallet();

  const normalizedRole = (activeRole || '').toLowerCase();
  const isStudent = normalizedRole === 'student';
  const isTutor = normalizedRole === 'tutor';

  // Expected immutable wallet from contract agreement
  const expectedWallet = (isStudent
    ? agreement.studentWallet
    : isTutor
    ? agreement.tutorWallet
    : '') || '';

  const wholeClass = isTutor;
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAcceptedTerms(false);
    setError('');
    setSuccessMsg('');
    setFiles([]);
    setUploadStatus('');
  }, [agreement.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const currentWalletNormalized = address ? address.toLowerCase().trim() : '';
  const expectedWalletNormalized = expectedWallet ? expectedWallet.toLowerCase().trim() : '';
  const isWalletMatched = Boolean(
    currentWalletNormalized &&
    expectedWalletNormalized &&
    currentWalletNormalized === expectedWalletNormalized
  );
  const expectedChainId = agreement.chainId || DEFAULT_CHAIN_ID;
  const isChainMatched = chainId === expectedChainId;

  const pricePerSession = agreement.pricePerSessionUsdc || 0;
  const settledSessions = agreement.settledSessions || 0;
  const totalSessions = agreement.totalSessions || 0;
  const remainingSessions = Math.max(0, totalSessions - settledSessions);
  const estimatedRefund = Number(agreement.remainingAmountUsdc ?? (remainingSessions * pricePerSession)).toFixed(2);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const validFiles: File[] = [];
    let err = '';

    for (const f of selected) {
      if (files.length + validFiles.length >= 5) {
        err = 'Mỗi yêu cầu chỉ được chọn tối đa 5 file minh chứng.';
        break;
      }
      if (f.size > 50 * 1024 * 1024) {
        err = `File "${f.name}" vượt quá kích thước tối đa cho phép (50 MB).`;
        continue;
      }
      validFiles.push(f);
    }

    if (err) setError(err);
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setUploadStatus('');

    if (!isStudent && !isTutor) {
      setError('Chỉ học viên hoặc gia sư là bên ký hợp đồng mới có thể gửi yêu cầu này.');
      return;
    }

    if (!reason.trim()) {
      setError('Vui lòng nêu rõ lý do và hoàn cảnh cần kết thúc hợp đồng.');
      return;
    }

    if (!acceptedTerms) {
      setError('Vui lòng xác nhận bạn đã đọc, hiểu và đồng ý trước khi ký yêu cầu.');
      return;
    }

    if (!address) {
      setError('Bạn chưa kết nối Ví Web3 MetaMask. Vui lòng kết nối ví trước.');
      return;
    }

    if (!expectedWallet || expectedWallet.trim() === '' || expectedWallet.toLowerCase() === '0x' + '0'.repeat(40)) {
      setError('Hợp đồng chưa liên kết địa chỉ ví blockchain hợp lệ.');
      return;
    }

    if (!isWalletMatched) {
      setError(
        `Ví MetaMask đang chọn (${address.slice(0, 6)}...${address.slice(-4)}) không khớp với ví đã ký hợp đồng/nạp cọc (${expectedWallet.slice(0, 6)}...${expectedWallet.slice(-4)}). Vui lòng chuyển sang đúng ví trên MetaMask.`
      );
      return;
    }

    if (!isChainMatched) {
      setError(`Vui lòng chuyển ví sang đúng mạng của hợp đồng (Chain ID ${expectedChainId}) trước khi ký.`);
      return;
    }

    try {
      setLoading(true);

      // 1. Sign EIP-712 typed data with MetaMask using user's private key
      const sigResult = await signTerminationRequestEip712(
        {
          agreementId: agreement.id,
          expectedWallet: expectedWallet,
          reason: reason.trim(),
          wholeClass: wholeClass,
          chainId: agreement.chainId,
          escrowContractAddress: agreement.escrowContractAddress,
        },
        address
      );

      // 2. Send payload to backend with signature verification
      const created = await terminationsApi.request(
        agreement.id,
        wholeClass,
        reason.trim(),
        sigResult.signature,
        sigResult.signerWallet,
        sigResult.requestedAt
      );

      // 3. Upload evidence files sequentially to S3 if any
      const failedUploads: string[] = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setUploadStatus(`Đang tải minh chứng lên S3 (${i + 1}/${files.length}): ${files[i].name}...`);
          try {
            await terminationsApi.uploadEvidence(created.request.id, files[i]);
          } catch (uploadErr: any) {
            console.warn('Lỗi tải file minh chứng:', files[i].name, uploadErr);
            failedUploads.push(files[i].name);
          }
        }
      }

      const holdPending = created.request.status === 'HOLD_PENDING';
      const evidenceNotice = failedUploads.length > 0
        ? ` Hồ sơ đã tạo nhưng ${failedUploads.length} file chưa tải được; bạn có thể gửi lại trong mục hồ sơ chấm dứt.`
        : '';
      setSuccessMsg((holdPending
        ? 'Đã tiếp nhận hồ sơ. Hệ thống đang đồng bộ tạm dừng lịch và sẽ tự động thử lại nếu Learning tạm gián đoạn.'
        : wholeClass
        ? 'Đã gửi đề xuất. Lịch tương lai của lớp đang được tạm dừng để Ban quản trị xem xét.'
        : 'Đã gửi yêu cầu. Các buổi tương lai của hợp đồng đang được tạm dừng để Ban quản trị xem xét.') + evidenceNotice);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Termination request error:', err);
      setError(err?.message || 'Không thể gửi yêu cầu kết thúc hợp đồng.');
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="termination-dialog-title" className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="termination-dialog-title" className="font-display text-base font-black leading-snug text-slate-900 sm:text-lg">
                {title || (wholeClass ? "Đề Xuất Dừng Giảng Dạy & Hủy Cả Lớp" : "Yêu Cầu Kết Thúc Hợp Đồng")}
              </h3>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                {description || (wholeClass ? "Tạm dừng lịch tương lai của lớp để Ban quản trị xem xét" : "Tạm dừng các buổi tương lai của hợp đồng để Ban quản trị xem xét")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Agreement Info Box */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Lớp học</span>
                <span className="font-bold text-slate-800 text-sm">
                  {agreement.className || `Lớp #${agreement.classroomId}`}
                </span>
                <span className="block text-xs text-slate-500 font-mono mt-0.5">Mã HĐ: #{agreement.id.slice(0, 8)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">{wholeClass ? 'Hợp đồng ảnh hưởng' : 'Tiến độ'}</span>
                <span className="font-black text-slate-800 text-sm">
                  {wholeClass ? `${agreement.affectedAgreements || 0} hợp đồng` : `${settledSessions} / ${totalSessions} buổi`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Tổng giá trị ký quỹ:</span>
                <p className="font-bold text-slate-800">{Number(agreement.totalAmountUsdc || 0).toFixed(2)} USDC</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Ước tính số dư chưa sử dụng:</span>
                <p className="font-black text-emerald-700 font-mono text-sm">{estimatedRefund} USDC</p>
              </div>
            </div>
          </div>

          {/* Wallet Verification Alert */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Xác thực ví Web3 người thực hiện
            </label>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 text-xs transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Wallet size={14} className="text-blue-600" /> Ví hợp đồng (đã nạp/ký):
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {expectedWallet ? `${expectedWallet.slice(0, 8)}...${expectedWallet.slice(-6)}` : 'Chưa cập nhật'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <FileSignature size={14} className="text-indigo-600" /> Ví MetaMask hiện tại:
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Chưa kết nối ví'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                {isWalletMatched ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700">
                    <CheckCircle2 size={15} />
                    <span>Ví MetaMask trùng khớp hoàn toàn. Hợp lệ để ký xác nhận.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700">
                    <XCircle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      {expectedWallet
                        ? `Ví đang kết nối không trùng khớp với ví đã ký hợp đồng. Hãy đổi sang ví ${expectedWallet.slice(0, 6)}...${expectedWallet.slice(-4)} trên MetaMask.`
                        : 'Hợp đồng chưa có địa chỉ ví hợp lệ.'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className={`font-semibold ${isChainMatched ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isChainMatched ? `Đúng mạng hợp đồng (Chain ID ${expectedChainId})` : `Cần chuyển sang Chain ID ${expectedChainId}`}
                </span>
                {!address ? (
                  <button type="button" onClick={() => void connectWallet()} disabled={isConnecting || loading} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700 disabled:opacity-50">
                    {isConnecting ? 'Đang kết nối...' : 'Kết nối ví'}
                  </button>
                ) : !isChainMatched ? (
                  <button type="button" onClick={() => void switchNetwork(expectedChainId)} disabled={loading} className="rounded-lg border border-amber-300 px-3 py-1.5 font-bold text-amber-800 disabled:opacity-50">
                    Chuyển mạng
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <form id="termination-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Scope Selection */}
            {(isStudent || isTutor) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  {wholeClass ? "Phạm vi: Dừng giảng dạy toàn bộ lớp học" : "Phạm vi: Một hợp đồng riêng lẻ của bạn"}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {wholeClass
                    ? "Đề xuất áp dụng cho toàn bộ hợp đồng đang hoạt động trong lớp. Lịch tương lai sẽ tạm dừng; sau khi Admin phê duyệt, Escrow V1 xử lý và hoàn số dư chưa sử dụng riêng cho từng học viên."
                    : "Yêu cầu chỉ áp dụng cho hợp đồng cá nhân của bạn. Các buổi tương lai sẽ tạm dừng trong thời gian Ban quản trị xem xét."}
                </p>
              </div>
            )}

            {/* Reason Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Lý do kết thúc hợp đồng & giải trình <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                maxLength={5000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
                placeholder="Nêu rõ hoàn cảnh, lý do (sự cố bất khả kháng, sức khỏe, tai nạn, vi phạm thỏa thuận...) và tài liệu minh chứng kèm theo..."
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="text-[11px] text-slate-400 text-right mt-1">{reason.length} / 5000 ký tự</p>
            </div>

            {/* Evidence Files Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tài liệu minh chứng đính kèm (Ảnh, Video, Tài liệu)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Tối đa 5 file, mỗi file ≤ 50MB</span>
              </div>

              <div className="space-y-2">
                {files.length < 5 && (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/60 p-4 transition-colors hover:border-amber-400 hover:bg-amber-50/30">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Paperclip size={16} className="text-amber-600 shrink-0" />
                      <span>Chọn file từ thiết bị (ảnh, video, ghi âm, PDF, Word, Excel, TXT)</span>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                      className="hidden"
                      disabled={loading}
                      onChange={handleFileChange}
                    />
                  </label>
                )}

                {files.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {files.map((file, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText size={16} className="text-amber-600 shrink-0" />
                          <span className="truncate font-medium text-slate-800">{file.name}</span>
                          <span className="text-slate-400 shrink-0">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          disabled={loading}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Xóa file"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="leading-relaxed">
                Để đảm bảo an toàn tài sản, khi bấm gửi, <strong>MetaMask sẽ yêu cầu bạn ký điện tử EIP-712</strong> bằng Private Key. Không ai có thể giả mạo yêu cầu nếu không sở hữu ví của bạn. Thao tác hoàn toàn <strong>miễn phí gas</strong>.
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-900">
              Gửi yêu cầu chỉ tạo tạm dừng vận hành. Hệ thống chưa hoàn tiền và chưa gửi giao dịch blockchain cho đến khi hồ sơ được xác minh, Staff đề xuất và Admin phê duyệt. Số tiền thực tế còn phụ thuộc các buổi đã bắt đầu, settlement và khiếu nại liên quan.
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700 transition-colors hover:border-amber-400 hover:bg-amber-50/40">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                disabled={loading}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-600"
              />
              <span className="leading-relaxed">
                Tôi đã đọc, hiểu và đồng ý gửi yêu cầu này để Ban quản trị xem xét. Tôi xác nhận lý do đã khai là trung thực và đồng ý ký xác nhận bằng đúng ví MetaMask của hợp đồng.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {uploadStatus && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 animate-pulse">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
                <span className="font-semibold">{uploadStatus}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{successMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            form="termination-form"
            disabled={loading || (!isStudent && !isTutor) || !isWalletMatched || !isChainMatched || !reason.trim() || !acceptedTerms}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang chờ ký MetaMask...</span>
              </>
            ) : (
              <>
                <FileSignature size={14} />
                <span>Ký xác nhận MetaMask & Gửi yêu cầu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
