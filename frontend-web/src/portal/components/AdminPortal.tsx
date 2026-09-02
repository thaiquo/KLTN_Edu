/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  ShieldCheck,
  Activity,
  AlertTriangle,
  UserPlus,
  Search,
  Filter,
  Trash2,
  SquarePen,
  X,
  Plus,
  RefreshCw,
  Sparkles,
  Eye,
  Phone,
  Mail,
  CalendarDays,
  MapPin,
  FileText,
  ExternalLink,
  Download,
  XCircle,
  Lock,
  Unlock,
  GraduationCap
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import { staffTutorApi } from "../../api/staffTutors";
import { useFeedback } from "../../components/feedback/useFeedback";

export function AdminPortal() {
  const feedback = useFeedback();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Detail modal state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; contentType: string } | null>(null);

  // Rejection dialog
  const [rejectingAppId, setRejectingAppId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminUsersApi.list({
        search: searchQuery,
        role: roleFilter,
        status: statusFilter
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const stats = useMemo(() => {
    const total = users.length;
    const tutors = users.filter((u) => u.roles?.includes("TUTOR")).length;
    const students = users.filter((u) => u.roles?.includes("STUDENT")).length;
    const admins = users.filter((u) => u.roles?.includes("ADMIN") || u.roles?.includes("STAFF")).length;
    const suspended = users.filter((u) => u.accountStatus === "LOCKED" || u.accountStatus === "DISABLED").length;
    return { total, tutors, students, admins, suspended };
  }, [users]);

  const openDetail = async (userId: number) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    try {
      const data = await adminUsersApi.detail(userId);
      setUserDetail(data);
    } catch (err: any) {
      setError(err?.message || "Không thể tải thông tin chi tiết người dùng.");
      setSelectedUserId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "LOCKED" : "ACTIVE";
    const accepted = await feedback.confirm({
      title: nextStatus === "LOCKED" ? "Khóa tài khoản?" : "Mở khóa tài khoản?",
      message: nextStatus === "LOCKED"
        ? "Bạn có chắc chắn muốn khóa tài khoản này?"
        : "Bạn có chắc chắn muốn mở khóa tài khoản này?",
      confirmText: nextStatus === "LOCKED" ? "Khóa tài khoản" : "Mở khóa",
      cancelText: "Hủy",
      variant: nextStatus === "LOCKED" ? "destructive" : "default"
    });
    if (!accepted) return;

    try {
      await adminUsersApi.updateStatus(userId, nextStatus);
      feedback.success(`Đã cập nhật trạng thái tài khoản thành ${nextStatus}.`);
      loadUsers();
      if (selectedUserId === userId && userDetail) {
        openDetail(userId);
      }
    } catch (err: any) {
      feedback.error(err?.message || "Không thể cập nhật trạng thái.");
    }
  };

  const handleApproveTutor = async (applicationId: number) => {
    const accepted = await feedback.confirm({
      title: "Phê duyệt hồ sơ gia sư?",
      message: "Xác nhận phê duyệt hồ sơ cá nhân và CCCD của gia sư này?",
      confirmText: "Phê duyệt",
      cancelText: "Hủy"
    });
    if (!accepted) return;
    setActionBusy(true);
    try {
      await staffTutorApi.approve(applicationId, "Phê duyệt bởi Admin User Control");
      feedback.success("Đã phê duyệt hồ sơ gia sư.");
      if (selectedUserId) openDetail(selectedUserId);
      loadUsers();
    } catch (err: any) {
      feedback.error(err?.message || "Không thể phê duyệt gia sư.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectTutorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingAppId) return;
    if (!rejectReason.trim()) {
      feedback.warning("Vui lòng nhập lý do từ chối.");
      return;
    }
    setActionBusy(true);
    try {
      await staffTutorApi.reject(rejectingAppId, rejectReason.trim(), undefined);
      feedback.success("Đã từ chối hồ sơ gia sư.");
      setRejectingAppId(null);
      setRejectReason("");
      if (selectedUserId) openDetail(selectedUserId);
      loadUsers();
    } catch (err: any) {
      feedback.error(err?.message || "Không thể từ chối hồ sơ.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleViewDoc = async (applicationId: number, doc: any) => {
    try {
      const res = await staffTutorApi.documentDownload(applicationId, doc.id);
      if (res?.downloadUrl) {
        setPreviewDoc({
          url: res.downloadUrl,
          title: doc.title || doc.originalFilename || "Tài liệu xác minh",
          contentType: doc.contentType || ""
        });
      }
    } catch (err: any) {
      setError(err?.message || "Không thể mở tài liệu.");
    }
  };

  return (
    <div className="font-sans select-none max-w-7xl mx-auto pb-10 space-y-6">
      {/* Notice / Error banners */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-900 font-extrabold text-sm">✕</button>
        </div>
      )}

      {/* Platform security administration banner */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-2xl lg:text-3xl text-brand-text tracking-tight flex items-center gap-2">
            Platform User Control
          </h2>
          <p className="text-brand-text-variant/80 text-xs font-semibold mt-1">
            Quản lý toàn diện người dùng thực tế từ Cơ sở dữ liệu, kiểm tra chi tiết hồ sơ cá nhân và xét duyệt CCCD/Hộ chiếu Gia sư.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            LÀM MỚI
          </button>
        </div>
      </section>

      {/* Top Bento statistics card grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 select-none leading-none">
        {/* Stat 1 */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-black text-xl text-brand-text">{stats.total}</p>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mt-1 font-display">
              Tổng số người dùng
            </p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-black text-xl text-brand-text">{stats.admins}</p>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mt-1 font-display">
              Admin & Staff
            </p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-black text-xl text-brand-text">{stats.tutors}</p>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mt-1 font-display">
              Tài khoản Gia sư
            </p>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-black text-xl text-brand-text">{stats.students}</p>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mt-1 font-display">
              Tài khoản Học viên
            </p>
          </div>
        </div>

        {/* Stat 5 */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-black text-xl text-brand-text">{stats.suspended}</p>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mt-1 font-display">
              Tài khoản bị khóa
            </p>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {/* Search & Filters toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên, email, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-brand-primary focus:outline-hidden"
            />
          </form>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Vai trò:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="TUTOR">Gia sư (TUTOR)</option>
                <option value="STUDENT">Học viên (STUDENT)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
                <option value="STAFF">Nhân viên (STAFF)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="LOCKED">Đã khóa (LOCKED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* User table */}
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-400">
            Không tìm thấy người dùng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-semibold text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-5">Người dùng</th>
                  <th className="py-3.5 px-4">Vai trò</th>
                  <th className="py-3.5 px-4">Ngày tham gia</th>
                  <th className="py-3.5 px-4">Trạng thái tài khoản</th>
                  <th className="py-3.5 px-4">Duyệt hồ sơ Gia sư</th>
                  <th className="py-3.5 px-5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isTutor = u.roles?.includes("TUTOR");
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-xs overflow-hidden shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              u.fullName?.charAt(0) || "U"
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{u.fullName || "Chưa cập nhật tên"}</p>
                            <p className="text-[11px] text-slate-400 font-semibold">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((r: string) => (
                            <span
                              key={r}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${
                                r === "TUTOR"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : r === "ADMIN"
                                  ? "bg-slate-900 text-white"
                                  : r === "STAFF"
                                  ? "bg-blue-900 text-white"
                                  : "bg-blue-50 text-primary border border-blue-200"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "--"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            u.accountStatus === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {u.accountStatus === "ACTIVE" ? "ACTIVE" : "LOCKED"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isTutor ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              u.tutorApplicationStatus === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : u.tutorApplicationStatus === "PENDING"
                                ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                                : u.tutorApplicationStatus === "REJECTED"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {u.tutorApplicationStatus === "APPROVED"
                              ? "✓ ĐÃ DUYỆT"
                              : u.tutorApplicationStatus === "PENDING"
                              ? "⏳ CHỜ DUYỆT"
                              : u.tutorApplicationStatus === "REJECTED"
                              ? "✕ TỪ CHỐI"
                              : "DRAFT"}
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(u.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#073554] text-white text-xs font-bold hover:bg-[#147b77] transition-colors"
                          >
                            <Eye size={13} />
                            <span>Chi tiết {isTutor ? "& CCCD" : ""}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u.id, u.accountStatus)}
                            title={u.accountStatus === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              u.accountStatus === "ACTIVE"
                                ? "border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                            }`}
                          >
                            {u.accountStatus === "ACTIVE" ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Comprehensive User Detail & Tutor Review Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#147b77]">Chi tiết tài khoản</p>
                <h3 className="text-xl font-black text-slate-900">Hồ sơ người dùng & Xác minh danh tính</h3>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedUserId(null); setUserDetail(null); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </header>

            {detailLoading || !userDetail ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-6">
                {/* Header card with avatar & quick roles */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white font-black flex items-center justify-center text-xl overflow-hidden shrink-0 border-2 border-white shadow-sm">
                    {userDetail.user?.avatarUrl ? (
                      <img src={userDetail.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      userDetail.user?.fullName?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-black text-slate-900">{userDetail.user?.fullName || "Chưa đặt tên"}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {userDetail.user?.accountStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">{userDetail.user?.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {userDetail.user?.roles?.map((r: string) => (
                        <span key={r} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-900 text-white">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Personal Information Grid */}
                <div>
                  <h5 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <Users className="text-[#147b77]" size={17} /> Thông tin cá nhân
                  </h5>
                  <div className="grid gap-3 sm:grid-cols-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Phone className="text-[#147b77]" size={16} />
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Số điện thoại</p>
                        <p className="text-xs font-extrabold text-slate-900">{userDetail.user?.phone || "--"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarDays className="text-[#147b77]" size={16} />
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Ngày sinh</p>
                        <p className="text-xs font-extrabold text-slate-900">{userDetail.user?.dateOfBirth || "--"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <MapPin className="text-[#147b77]" size={16} />
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Địa chỉ</p>
                        <p className="text-xs font-extrabold text-slate-900">
                          {[userDetail.user?.addressDetail, userDetail.user?.commune, userDetail.user?.province].filter(Boolean).join(", ") || "--"}
                        </p>
                      </div>
                    </div>
                    {userDetail.user?.bio && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] font-black uppercase text-slate-400">Giới thiệu ngắn (Bio)</p>
                        <p className="text-xs font-semibold text-slate-700 mt-1">{userDetail.user.bio}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tutor Verification Documents (If user is a Tutor) */}
                {userDetail.user?.roles?.includes("TUTOR") && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="text-[#147b77]" size={17} /> Xác minh danh tính Gia sư (CCCD / Hộ chiếu)
                      </h5>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${
                          userDetail.user?.tutorApplicationStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : userDetail.user?.tutorApplicationStatus === "PENDING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                            : userDetail.user?.tutorApplicationStatus === "REJECTED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        Trạng thái duyệt: {
                          userDetail.user?.tutorApplicationStatus === "APPROVED" ? "✓ Đã duyệt" :
                          userDetail.user?.tutorApplicationStatus === "PENDING" ? "⏳ Đang chờ duyệt" :
                          userDetail.user?.tutorApplicationStatus === "REJECTED" ? "✕ Bị từ chối" : "📝 Bản nháp (Chưa nộp)"
                        }
                      </span>
                    </div>

                    {userDetail.user?.tutorApplicationStatus === "DRAFT" && (
                      <div className="mb-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-900 leading-5">
                        <p className="font-extrabold text-blue-950">ℹ️ Hồ sơ Gia sư đang ở dạng Bản nháp (Chưa nộp)</p>
                        <p className="mt-0.5 text-blue-800">
                          Gia sư này đã tải lên một số giấy tờ nhưng <strong>chưa bấm "Gửi duyệt hồ sơ cho Ban quản trị"</strong> trên trang cá nhân. Hồ sơ chỉ xuất hiện ở danh sách Chờ duyệt sau khi Gia sư bấm nộp.
                        </p>
                      </div>
                    )}

                    {(!userDetail.tutorDetail?.documents || userDetail.tutorDetail.documents.filter((doc: any) => ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(doc.documentType)).length === 0) ? (
                      <div className="p-4 rounded-2xl border border-dashed border-slate-300 text-xs font-semibold text-slate-400 text-center">
                        Gia sư chưa tải lên ảnh CCCD hoặc Giấy tờ xác minh danh tính.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {userDetail.tutorDetail.documents
                          .filter((doc: any) => ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT'].includes(doc.documentType))
                          .map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs">
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
                              onClick={() => handleViewDoc(userDetail.user.tutorApplicationId, doc)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0"
                            >
                              <ExternalLink size={13} />
                              Xem ảnh
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectingAppId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <form onSubmit={handleRejectTutorSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h4 className="font-extrabold text-base text-slate-900">Lý do từ chối hồ sơ Gia sư</h4>
            <p className="text-xs font-semibold text-slate-500 leading-5">
              Vui lòng nhập lý do từ chối để thông báo cho Gia sư điều chỉnh lại thông tin hoặc ảnh CCCD/Hộ chiếu.
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Ảnh CCCD mặt sau bị mờ, vui lòng tải lại ảnh nét..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium focus:border-[#147b77] focus:outline-hidden"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setRejectingAppId(null); setRejectReason(""); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={actionBusy || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionBusy ? "Đang xử lý..." : "Xác nhận từ chối"}
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
