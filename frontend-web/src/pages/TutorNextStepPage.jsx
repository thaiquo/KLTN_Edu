import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Edit3, LogOut, RefreshCw, UserCheck } from 'lucide-react';
import { HomeHeader } from '../components/home/HomeHeader';
import { TutorApplicationStatusBanner } from '../components/tutor-application/TutorApplicationStatusBanner';
import { useAuth } from '../hooks/useAuth';
import { useTutorApplication } from '../hooks/useTutorApplication';

export function TutorNextStepPage() {
  const navigate = useNavigate();
  const { user, logout, switchRole } = useAuth();
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);
  const {
    data: application,
    isLoading: loading,
    isFetching,
    error: applicationError,
    refetch
  } = useTutorApplication({
    enabled: Boolean(user)
  });

  async function handleSwitchToStudent() {
    if (switching) return;
    setSwitching(true);
    try {
      await switchRole('STUDENT');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Không thể chuyển đổi vai trò.');
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleRetry() {
    setError('');
    try {
      await refetch();
    } catch (err) {
      setError(err.message || 'Không thể tải trạng thái hồ sơ.');
    }
  }

  const queryError = applicationError ? (applicationError.message || 'Không thể tải trạng thái hồ sơ.') : '';
  const status = application?.status || (user?.tutorStatus || 'DRAFT');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <HomeHeader />

      <main className="container-app pt-28 pb-16 max-w-4xl mx-auto">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,.07)]">
          <div className="bg-slate-900 px-6 py-8 text-white sm:px-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              Trạng thái hồ sơ gia sư
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              Chào mừng bạn đến với EduConnect. Dưới đây là thông tin tiến trình hồ sơ của bạn.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {loading || isFetching ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-indigo-600" />
                <p className="text-sm font-bold">Đang kiểm tra trạng thái hồ sơ...</p>
              </div>
            ) : error || queryError ? (
              <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm font-semibold flex items-center justify-between">
                <span>{error || queryError}</span>
                <button type="button" onClick={handleRetry} className="underline text-red-900">Thử lại</button>
              </div>
            ) : (
              <>
                <TutorApplicationStatusBanner application={application} />

                {status === 'DRAFT' || !application ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 text-slate-800">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Hồ sơ của bạn chưa hoàn tất
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Vui lòng điền đầy đủ các thông tin cá nhân, bằng cấp, thông tin giảng dạy và tài liệu để gửi Staff xét duyệt.
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20"
                      >
                        Hoàn tất hồ sơ gia sư
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : status === 'PENDING' ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-6 text-slate-800 space-y-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Đang chờ Staff duyệt
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Admin đang xem xét thông tin, môn đăng ký và minh chứng của bạn. Thời gian xử lý thường từ 1 đến 2 ngày làm việc.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Edit3 size={16} />
                        Xem lại hồ sơ
                      </button>

                      {user?.roles?.includes('STUDENT') && (
                        <button
                          type="button"
                          onClick={handleSwitchToStudent}
                          disabled={switching}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                        >
                          <UserCheck size={16} />
                          {switching ? 'Đang chuyển...' : 'Chuyển sang vai trò Học viên'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors ml-auto"
                      >
                        <LogOut size={16} />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                ) : status === 'REJECTED' ? (
                  <div className="rounded-xl border border-red-100 bg-red-50/50 p-6 text-slate-800 space-y-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Hồ sơ cần chỉnh sửa lại
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Hồ sơ gia sư của bạn chưa được thông qua. Vui lòng kiểm tra lý do và cập nhật thông tin chính xác trước khi gửi lại.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 transition-all shadow-md"
                      >
                        <Edit3 size={16} />
                        Chỉnh sửa & gửi lại hồ sơ
                      </button>

                      {user?.roles?.includes('STUDENT') && (
                        <button
                          type="button"
                          onClick={handleSwitchToStudent}
                          disabled={switching}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <UserCheck size={16} />
                          Chuyển sang Học viên
                        </button>
                      )}
                    </div>
                  </div>
                ) : status === 'APPROVED' ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6 text-slate-800 space-y-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Hồ sơ gia sư đã được chấp nhận!
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Chúc mừng bạn! Tài khoản gia sư của bạn đã hoạt động bình thường trên hệ thống.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate('/tutor/profile')}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 transition-all shadow-md"
                      >
                        Vào trang hồ sơ Gia sư
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
