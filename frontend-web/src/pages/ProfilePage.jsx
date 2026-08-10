import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, GraduationCap, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { tutorApi } from '../api/tutors';
import { HomeHeader } from '../components/home/HomeHeader';
import { TutorStatusBadge } from '../components/tutor/TutorStatusBadge';
import { useAuth } from '../hooks/useAuth';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles || [];
  const isTutor = roles.includes('TUTOR');
  const isStudent = roles.includes('STUDENT');
  const [tutorProfile, setTutorProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTutorProfile() {
      if (!isTutor) return;

      try {
        const profile = await tutorApi.getProfile();
        if (active) setTutorProfile(profile);
      } catch (error) {
        if (active) setProfileError(error.message || 'Không thể tải hồ sơ gia sư.');
      }
    }

    loadTutorProfile();
    return () => {
      active = false;
    };
  }, [isTutor]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-sans"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <HomeHeader />

      <main className="container-app pt-28 pb-16">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-4">
                <span className="w-16 h-16 grid place-items-center rounded-[8px] bg-slate-900 text-white">
                  <UserRound size={30} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">
                    Thông tin cá nhân
                  </p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
                    {user?.fullName || 'Người dùng EduConnect'}
                  </h1>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Mail size={15} />
                    {user?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Bell size={16} />
                Thông báo
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <InfoBlock icon={<UserRound size={18} />} label="Họ và tên" value={user?.fullName || '-'} />
              <InfoBlock icon={<Mail size={18} />} label="Email" value={user?.email || '-'} />
              <InfoBlock icon={<ShieldCheck size={18} />} label="Vai trò" value={roles.length ? roles.join(', ') : '-'} />
              <InfoBlock
                icon={<GraduationCap size={18} />}
                label="Loại hồ sơ"
                value={isTutor ? 'Gia sư' : isStudent ? 'Học viên' : 'Tài khoản vận hành'}
              />
            </div>

            {isStudent && !isTutor && (
              <div className="mt-6 rounded-[8px] border border-blue-100 bg-blue-50 p-4">
                <h2 className="text-lg font-extrabold text-slate-950">Hồ sơ học viên</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Tài khoản học viên dùng để tìm gia sư, theo dõi lớp học và quản lý lộ trình học tập.
                </p>
              </div>
            )}

            {isTutor && (
              <div className="mt-6 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-slate-950">Hồ sơ gia sư</h2>
                  {tutorProfile?.status && <TutorStatusBadge status={tutorProfile.status} />}
                </div>

                {profileError && <div className="error mt-4">{profileError}</div>}

                {tutorProfile && (
                  <div className="mt-4 grid gap-4">
                    <InfoBlock icon={<GraduationCap size={18} />} label="Học vấn" value={tutorProfile.education || '-'} />
                    <InfoBlock
                      icon={<ShieldCheck size={18} />}
                      label="Kinh nghiệm"
                      value={`${tutorProfile.experienceYears ?? 0} năm`}
                    />
                    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        Môn/chuyên môn giảng dạy
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(tutorProfile.subjects || []).map((subject) => (
                          <span
                            key={subject.id}
                            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white"
                          >
                            {subject.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Bio</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{tutorProfile.bio || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
            <h2 className="text-lg font-extrabold tracking-tight">Tác vụ nhanh</h2>
            <div className="mt-4 grid gap-3">
              {isTutor && (
                <Link
                  to="/tutor/profile"
                  className="rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-800 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  Cập nhật hồ sơ gia sư
                </Link>
              )}
              <Link
                to="/"
                className="rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-800 hover:border-primary/40 hover:text-primary transition-colors"
              >
                Quay lại homepage
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-[#ff695f] transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function InfoBlock({ icon, label, value }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-base font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
