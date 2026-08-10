import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { useAuth } from './hooks/useAuth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { TutorNextStepPage } from './pages/TutorNextStepPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
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
  const { user, loading } = useAuth();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  if (guest) return user ? <Navigate to={defaultRouteFor(user)} replace /> : children;
  return user ? children : <Navigate to="/login" replace />;
}

function HomeEntry() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  if (user && defaultRouteFor(user) !== '/') {
    return <Navigate to={defaultRouteFor(user)} replace />;
  }

  return <HomePage />;
}

function RoleGate({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader" aria-label="Dang tai" />;
  if (!user) return <Navigate to="/login" replace />;

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route path="/login" element={<Gate guest><LoginPage /></Gate>} />
          <Route path="/register" element={<Gate guest><RegisterPage /></Gate>} />
          <Route path="/verify-email" element={<Gate guest><VerifyEmailPage /></Gate>} />
          <Route path="/profile" element={<ProtectedProfile />} />
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
