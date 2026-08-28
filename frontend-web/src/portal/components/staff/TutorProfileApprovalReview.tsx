import React, { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  FileText, 
  UserRound, 
  Phone, 
  Mail, 
  CalendarDays, 
  MapPin, 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  ExternalLink,
  History,
  Search,
  X
} from "lucide-react";
import { staffTutorApi } from "../../../api/staffTutors";
import { useRealtimeRefresh } from "../../../realtime/useRealtimeRefresh";

interface TutorProfileApprovalReviewProps {
  onNotice: (msg: string) => void;
  onError: (err: string) => void;
  onPendingCountChange?: (count: number) => void;
  onActionSuccess?: () => void;
}

export function TutorProfileApprovalReview({
  onNotice,
  onError,
  onPendingCountChange,
  onActionSuccess
}: TutorProfileApprovalReviewProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveNote, setApproveNote] = useState("Hồ sơ cá nhân và tệp xác minh CCCD/Hộ chiếu hợp lệ.");
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState<string>("");

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; contentType: string } | null>(null);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await staffTutorApi.pending();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      if (onPendingCountChange) onPendingCountChange(list.length);
    } catch (err: any) {
      onError(err?.message || "Không thể tải danh sách hồ sơ gia sư chờ duyệt.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await staffTutorApi.history();
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load tutor application review history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useRealtimeRefresh(
    ["TUTOR_APPLICATION_SUBMITTED", "TUTOR_APPLICATION_REVIEWED"],
    () => { loadPending(); loadHistory(); }
  );

  useEffect(() => {
    loadPending();
    loadHistory();
  }, []);

  const openDetail = async (applicationId: number) => {
    setSelectedId(applicationId);
    setDetailLoading(true);
    try {
      const data = await staffTutorApi.detail(applicationId);
      setDetail(data);
    } catch (err: any) {
      onError(err?.message || "Không thể tải chi tiết hồ sơ gia sư.");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingId) return;
    setSubmitting(true);
    try {
      await staffTutorApi.approve(approvingId, approveNote.trim() || "Hồ sơ cá nhân và CCCD hợp lệ");
      onNotice("Đã phê duyệt hồ sơ gia sư thành công!");
      setApprovingId(null);
      setApproveNote("Hồ sơ cá nhân và tệp xác minh CCCD/Hộ chiếu hợp lệ.");
      setSelectedId(null);
      setDetail(null);
      loadPending();
      loadHistory();
      if (onActionSuccess) onActionSuccess();
    } catch (err: any) {
      onError(err?.message || "Không thể phê duyệt hồ sơ gia sư.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối.");
      return;
    }
    setSubmitting(true);
    try {
      await staffTutorApi.reject(rejectingId, rejectReason.trim(), undefined);
      onNotice("Đã từ chối hồ sơ gia sư và gửi phản hồi!");
      setRejectingId(null);
      setRejectReason("");
      setSelectedId(null);
      setDetail(null);
      loadPending();
      loadHistory();
      if (onActionSuccess) onActionSuccess();
    } catch (err: any) {
      onError(err?.message || "Không thể từ chối hồ sơ gia sư.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDoc = async (applicationId: number, doc: any) => {
    const existingUrl = doc.url || doc.downloadUrl || doc.presignedUrl;
    if (existingUrl) {
      setPreviewDoc({
        url: existingUrl,
        title: doc.title || doc.originalFilename || "Tài liệu xác minh",
        contentType: doc.contentType || ""
      });
      return;
    }
    try {
      const res = await staffTutorApi.documentDownload(applicationId, doc.id);
      const fileUrl = res?.url || res?.downloadUrl;
      if (fileUrl) {
        setPreviewDoc({
          url: fileUrl,
          title: doc.title || doc.originalFilename || "Tài liệu xác minh",
          contentType: doc.contentType || ""
        });
      } else {
        onError("Không thể tạo đường dẫn xem tài liệu.");
      }
    } catch (err: any) {
      onError(err?.message || "Không thể lấy liên kết xem tài liệu.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="border border-[#d7dde6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e8ee] pb-4">
          <div>
            <h2 className="font-display text-lg font-black text-[#073554]">
              Hồ sơ & Giấy tờ xác minh danh tính Gia sư chờ duyệt ({items.length})
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Kiểm tra thông tin cá nhân và ảnh chụp CCCD/CMND (2 mặt) hoặc Hộ chiếu của Gia sư trước khi cho phép mở lớp và đăng ký dạy.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPending}
            className="inline-flex items-center gap-1.5 border border-[#d7dde6] px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-[#147b77] transition-colors"
          >
            <RefreshCw size={13} />
            Tải lại
          </button>
        </div>

        {loading ? (
          <div className="mt-6 h-32 animate-pulse rounded bg-slate-100" />
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/60" />
            <p className="mt-3 text-sm font-extrabold text-slate-700">Hiện không có hồ sơ gia sư nào cần duyệt</p>
            <p className="mt-1 text-xs text-slate-400 font-semibold">Tất cả hồ sơ cá nhân và CCCD đã được xử lý hoàn tất.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-semibold text-slate-600">
              <thead>
                <tr className="border-b border-[#edf0f4] text-[#073554] font-black uppercase text-[10px]">
                  <th className="py-3 px-3">Gia sư</th>
                  <th className="py-3 px-3">Thông tin liên hệ</th>
                  <th className="py-3 px-3">Địa chỉ</th>
                  <th className="py-3 px-3">Thời gian gửi</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f4f8]">
                {items.map((item) => (
                  <tr key={item.applicationId || item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-xs overflow-hidden shrink-0">
                          {item.applicantAvatarUrl ? (
                            <img src={item.applicantAvatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            item.applicantFullName?.charAt(0) || "G"
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{item.applicantFullName}</p>
                          <p className="text-[11px] text-slate-400 font-semibold">{item.applicantEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="text-slate-800 font-bold">{item.applicantPhone || "Chưa có SĐT"}</p>
                      <p className="text-[11px] text-slate-400">Sinh: {item.applicantDateOfBirth || "--"}</p>
                    </td>
                    <td className="py-3.5 px-3 max-w-[200px] truncate">
                      <p className="text-slate-700 font-medium truncate">
                        {[item.applicantCommuneName, item.applicantProvinceName].filter(Boolean).join(", ") || "--"}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("vi-VN") : "--"}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700">
                        Chờ duyệt
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(item.applicationId || item.id)}
                        className="inline-flex items-center gap-1 rounded-[6px] bg-[#073554] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#147b77] transition-colors"
                      >
                        <Eye size={13} />
                        Xem chi tiết & CCCD
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* History Section */}
      <section className="border border-[#d7dde6] bg-white p-5 shadow-sm mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e8ee] pb-4">
          <div>
            <h2 className="font-extrabold text-base text-[#073554] flex items-center gap-2">
              <History size={18} className="text-[#147b77]" />
              Lịch sử Phê duyệt Hồ sơ & CCCD Gia sư ({historyItems.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Danh sách các hồ sơ gia sư đã được xử lý (Phê duyệt hoặc Từ chối).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Tìm theo tên gia sư, email..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 w-56 focus:outline-hidden focus:border-[#147b77]"
              />
            </div>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHistoryFilterStatus("ALL")}
                className={`px-3 py-1 rounded-md transition-colors ${historyFilterStatus === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterStatus("APPROVED")}
                className={`px-3 py-1 rounded-md transition-colors ${historyFilterStatus === "APPROVED" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                Đã duyệt
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterStatus("REJECTED")}
                className={`px-3 py-1 rounded-md transition-colors ${historyFilterStatus === "REJECTED" ? "bg-red-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                Bị từ chối
              </button>
            </div>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="inline-flex items-center gap-1.5 border border-[#d7dde6] bg-[#f7f9fc] px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-[#ff695f]"
            >
              <RefreshCw size={13} className={historyLoading ? "animate-spin" : ""} />
              Tải lại
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">Đang tải lịch sử...</div>
        ) : historyItems.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-xl mt-4">
            Chưa có lịch sử phê duyệt hồ sơ gia sư nào.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3">Gia sư</th>
                  <th className="py-3 px-3">Thông tin liên hệ</th>
                  <th className="py-3 px-3">Người duyệt</th>
                  <th className="py-3 px-3">Thời gian duyệt</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3">Ghi chú / Lý do</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {historyItems
                  .filter((item) => {
                    if (historyFilterStatus !== "ALL" && item.status !== historyFilterStatus) return false;
                    if (historySearch.trim()) {
                      const q = historySearch.toLowerCase();
                      const matchName = item.applicantFullName?.toLowerCase().includes(q) || item.fullName?.toLowerCase().includes(q);
                      const matchEmail = item.applicantEmail?.toLowerCase().includes(q) || item.email?.toLowerCase().includes(q);
                      return matchName || matchEmail;
                    }
                    return true;
                  })
                  .map((item) => (
                    <tr key={item.applicationId || item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-xs overflow-hidden shrink-0">
                            {item.applicantAvatarUrl || item.avatarUrl ? (
                              <img src={item.applicantAvatarUrl || item.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              (item.applicantFullName || item.fullName)?.charAt(0) || "G"
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{item.applicantFullName || item.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-semibold">{item.applicantEmail || item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-slate-800 font-bold">{item.applicantPhone || item.phone || "Chưa có SĐT"}</p>
                        <p className="text-[11px] text-slate-400">
                          {[item.communeName || item.applicantCommuneName, item.provinceName || item.applicantProvinceName].filter(Boolean).join(", ") || "--"}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-800">{item.reviewedByName || "Admin/Staff"}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{item.reviewedByEmail || "--"}</p>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("vi-VN") : "--"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            item.status === "APPROVED"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                              : "bg-red-50 border border-red-200 text-red-700"
                          }`}
                        >
                          {item.status === "APPROVED" ? "✓ Đã duyệt" : "✕ Bị từ chối"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 max-w-[250px]">
                        {item.status === "REJECTED" ? (
                          <p className="text-xs text-red-600 font-semibold truncate" title={item.rejectionReason}>
                            <span className="font-bold">Lý do:</span> {item.rejectionReason || "Không đạt yêu cầu"}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 font-semibold truncate" title={item.reviewNote}>
                            <span className="font-bold">Ghi chú:</span> {item.reviewNote || "Hợp lệ"}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(item.applicationId || item.id)}
                          className="inline-flex items-center gap-1 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs"
                        >
                          <Eye size={13} />
                          Xem lại hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Detail & Identity Documents Review */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#147b77]">Chi tiết hồ sơ</p>
                <h3 className="text-xl font-black text-slate-900">Kiểm tra thông tin & CCCD Gia sư</h3>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </header>

            {detailLoading || !detail ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-6">
                {/* Personal Info Grid */}
                <div className="grid gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <UserRound className="text-[#147b77]" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Họ và tên</p>
                      <p className="text-sm font-extrabold text-slate-900">{detail.applicant?.fullName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="text-[#147b77]" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Email</p>
                      <p className="text-sm font-extrabold text-slate-900">{detail.applicant?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="text-[#147b77]" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Số điện thoại</p>
                      <p className="text-sm font-extrabold text-slate-900">{detail.applicant?.phone || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarDays className="text-[#147b77]" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Ngày sinh</p>
                      <p className="text-sm font-extrabold text-slate-900">{detail.applicant?.dateOfBirth || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <MapPin className="text-[#147b77]" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Địa chỉ</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {[detail.applicant?.addressDetail, detail.applicant?.communeName, detail.applicant?.provinceName].filter(Boolean).join(", ") || "--"}
                      </p>
                    </div>
                  </div>
                  {detail.applicant?.bio && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                      <p className="text-[10px] font-black uppercase text-slate-400">Giới thiệu ngắn</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1">{detail.applicant.bio}</p>
                    </div>
                  )}
                </div>

                {/* Identity Documents List */}
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="text-[#147b77]" size={18} />
                    Tài liệu xác minh danh tính (CCCD / Hộ chiếu)
                  </h4>

                  {(() => {
                    const identityDocs = (detail.documents || []).filter((doc: any) => 
                      doc.documentType === 'IDENTITY_FRONT' || doc.documentType === 'IDENTITY_BACK' || doc.documentType === 'PASSPORT'
                    );

                    if (identityDocs.length === 0) {
                      return (
                        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-400 text-center">
                          Chưa có tệp xác minh CCCD / Hộ chiếu nào được tải lên.
                        </div>
                      );
                    }

                    return (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {identityDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="text-primary shrink-0" size={20} />
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {doc.documentType === 'IDENTITY_FRONT' ? 'CCCD Mặt trước' :
                                   doc.documentType === 'IDENTITY_BACK' ? 'CCCD Mặt sau' :
                                   doc.documentType === 'PASSPORT' ? 'Trang Hộ chiếu' :
                                   doc.title || doc.documentType}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400 truncate">{doc.originalFilename}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleViewDoc(selectedId, doc)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0"
                            >
                              <ExternalLink size={13} />
                              Xem ảnh
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions: Approve / Reject */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setRejectingId(selectedId)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={15} />
                    Từ chối hồ sơ
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setApprovingId(selectedId)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    Phê duyệt hồ sơ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Note Dialog */}
      {approvingId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <form onSubmit={handleApproveSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h4 className="font-extrabold text-base text-slate-900">Xác nhận & Ghi chú phê duyệt hồ sơ Gia sư</h4>
            <p className="text-xs font-semibold text-slate-500 leading-5">
              Vui lòng nhập ghi chú phê duyệt (Ví dụ: Thông tin cá nhân và 2 mặt CCCD hợp lệ).
            </p>
            <textarea
              required
              rows={3}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Ghi chú phê duyệt..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium focus:border-emerald-600 focus:outline-hidden"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Đang xử lý..." : "Xác nhận Phê duyệt"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <form onSubmit={handleRejectSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h4 className="font-extrabold text-base text-slate-900">Lý do từ chối hồ sơ Gia sư</h4>
            <p className="text-xs font-semibold text-slate-500 leading-5">
              Vui lòng cung cấp lý do rõ ràng để gia sư biết thông tin hoặc ảnh CCCD/Hộ chiếu cần cập nhật lại.
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Ảnh CCCD mặt sau bị mờ, không đọc được số..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium focus:border-[#147b77] focus:outline-hidden"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setRejectingId(null); setRejectReason(""); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Document Image Lightbox / Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-800">{previewDoc.title}</span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-auto flex items-center justify-center">
              {previewDoc.contentType?.includes("pdf") ? (
                <iframe src={previewDoc.url} className="w-[600px] h-[500px]" title="PDF Preview" />
              ) : (
                <img src={previewDoc.url} alt="Document" className="max-h-[70vh] object-contain rounded-lg" />
              )}
            </div>
            <div className="mt-4 w-full flex justify-end">
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-[#147b77]"
              >
                <Download size={14} /> Tải về tệp gốc
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
