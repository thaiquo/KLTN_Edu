import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TutorNextStepPage } from './pages/TutorNextStepPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { TutorApplicationWizardPage } from './pages/tutor-application/TutorApplicationWizardPage';
import { PublicTutorProfilePage } from './pages/tutor/PublicTutorProfilePage';
import { TutorMarketplacePage } from './pages/tutor/TutorMarketplacePage';
import { TutorProfilePage } from './pages/tutor/TutorProfilePage';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);

function defaultRouteFor(user) {
  if (user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN')) {
    return '/staff/tutors';
  }
  return '/';
}

function Gate({ guest = false, children }) {
  const { user, authenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  if (guest) return authenticated ? <Navigate to={defaultRouteFor(user)} replace /> : children;
  return authenticated ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function HomeEntry() {
  const { user, authenticated, loading } = useAuth();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  const nextRoute = defaultRouteFor(user);
  if (authenticated && nextRoute !== '/') return <Navigate to={nextRoute} replace />;

  return <HomePage />;
}

function RoleGate({ roles, children }) {
  const { user, authenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  const allowed = roles.some((role) => user.roles?.includes(role));
  return allowed ? children : <Navigate to="/" replace />;
}

function ProtectedDashboard() {
  return (
    <Gate>
      <Suspense fallback={<div className="loader" aria-label="Dang tai cong hoc tap" />}>
        <DashboardPage />
      </Suspense>
    </Gate>
  );
}

function ProtectedTutorProfile() {
  return (
    <RoleGate roles={['TUTOR']}>
      <TutorProfilePage />
    </RoleGate>
  );
}

function ProtectedStaffDashboard() {
  return (
    <RoleGate roles={['STAFF', 'ADMIN']}>
      <Suspense fallback={<div className="loader" aria-label="Dang tai cong hoc tap" />}>
        <DashboardPage />
      </Suspense>
    </RoleGate>
  );
}

function ProtectedProfile() {
  return (
    <Gate>
      <ProfilePage />
    </Gate>
  );
}

function ProtectedChangePassword() {
  return (
    <Gate>
      <ChangePasswordPage />
    </Gate>
  );
}

function ProtectedBecomeTutor() {
  return (
    <Gate>
      <TutorApplicationWizardPage />
    </Gate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route path="/login" element={<Gate guest><LoginPage /></Gate>} />
          <Route path="/register" element={<Gate guest><RegisterPage /></Gate>} />
          <Route path="/verify-email" element={<Gate guest><VerifyEmailPage /></Gate>} />
          <Route path="/forgot-password" element={<Gate guest><ForgotPasswordPage /></Gate>} />
          <Route path="/reset-password" element={<Gate guest><ResetPasswordPage /></Gate>} />
          <Route path="/tutors" element={<TutorMarketplacePage />} />
          <Route path="/tutors/:id" element={<PublicTutorProfilePage />} />
          <Route path="/profile" element={<ProtectedProfile />} />
          <Route path="/profile/password" element={<ProtectedChangePassword />} />
          <Route path="/become-tutor" element={<ProtectedBecomeTutor />} />
          <Route path="/tutor-next-step" element={<TutorNextStepPage />} />
          <Route path="/tutor/profile" element={<ProtectedTutorProfile />} />
          <Route path="/staff/tutors" element={<ProtectedStaffDashboard />} />
          <Route path="/dashboard" element={<ProtectedDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
