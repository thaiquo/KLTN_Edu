import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { RealtimeProvider } from './realtime/RealtimeProvider';
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
import { PublicTutorProfilePage } from './pages/tutor/PublicTutorProfilePage';
import { TutorMarketplacePage } from './pages/tutor/TutorMarketplacePage';
import { ClassMarketplacePage } from './pages/class/ClassMarketplacePage';
import { TutorProfilePage } from './pages/tutor/TutorProfilePage';
import { TeachingRegistrationPage } from './pages/tutor/TeachingRegistrationPage';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);

function defaultRouteFor(user) {
  if (user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN')) {
    return '/staff/tutors';
  }
  if (user?.activeRole === 'TUTOR') {
    return '/dashboard';
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

  const isStaffOrAdmin = user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN');
  if (isStaffOrAdmin && (roles.includes('STAFF') || roles.includes('ADMIN'))) {
    return children;
  }

  if (roles.includes('TUTOR')) {
    if (user.activeRole === 'TUTOR') {
      return children;
    }
    return <Navigate to="/" replace />;
  }

  if (roles.includes('STUDENT')) {
    if (user.activeRole === 'STUDENT') {
      return children;
    }
    return <Navigate to="/" replace />;
  }

  return <Navigate to="/" replace />;
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
      <TeachingRegistrationPage />
    </Gate>
  );
}

function ProtectedTeachingRegistration() {
  return <Gate><TeachingRegistrationPage /></Gate>;
}

function ProtectedCompleteProfile() {
  return <Gate><TeachingRegistrationPage /></Gate>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <Routes>
            <Route path="/" element={<HomeEntry />} />
            <Route path="/login" element={<Gate guest><LoginPage /></Gate>} />
            <Route path="/register" element={<Gate guest><RegisterPage /></Gate>} />
            <Route path="/verify-email" element={<Gate guest><VerifyEmailPage /></Gate>} />
            <Route path="/forgot-password" element={<Gate guest><ForgotPasswordPage /></Gate>} />
            <Route path="/reset-password" element={<Gate guest><ResetPasswordPage /></Gate>} />
            
            {/* Public Marketplace Routes */}
            <Route path="/tutors" element={<TutorMarketplacePage />} />
            <Route path="/tutors/:id" element={<PublicTutorProfilePage />} />
            <Route path="/classes" element={<ClassMarketplacePage />} />
            
            {/* Protected Profile & Workspace Routes */}
            <Route path="/profile" element={<ProtectedProfile />} />
            <Route path="/profile/password" element={<ProtectedChangePassword />} />
            <Route path="/become-tutor" element={<ProtectedBecomeTutor />} />
            <Route path="/tutor/complete-profile" element={<ProtectedCompleteProfile />} />
            <Route path="/tutor-next-step" element={<TutorNextStepPage />} />
            <Route path="/tutor/profile" element={<ProtectedTutorProfile />} />
            <Route path="/tutor/teaching-registrations" element={<ProtectedTeachingRegistration />} />
            
            {/* Staff & Shared Dashboard Routes */}
            <Route path="/staff/tutors" element={<ProtectedStaffDashboard />} />
            <Route path="/dashboard" element={<ProtectedDashboard />} />
            
            {/* Student Clean RESTful Route Aliases */}
            <Route path="/student/contracts" element={<Navigate to="/dashboard?tab=contracts" replace />} />
            <Route path="/student/wallet" element={<Navigate to="/dashboard?tab=wallet" replace />} />
            <Route path="/student/classes" element={<Navigate to="/dashboard?tab=courses" replace />} />
            <Route path="/student/messages" element={<Navigate to="/dashboard?tab=messages" replace />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
