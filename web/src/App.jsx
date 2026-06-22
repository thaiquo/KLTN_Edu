import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);

function Gate({ guest = false, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader" aria-label="Đang tải" />;
  if (guest) return user ? <Navigate to="/" replace /> : children;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Gate guest><LoginPage /></Gate>} />
          <Route path="/register" element={<Gate guest><RegisterPage /></Gate>} />
          <Route
            path="/"
            element={(
              <Gate>
                <Suspense fallback={<div className="loader" aria-label="Đang tải cổng học tập" />}>
                  <DashboardPage />
                </Suspense>
              </Gate>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
