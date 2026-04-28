import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { AnimatePresence, motion } from "framer-motion";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PatientDashboardPage = lazy(() => import("./pages/PatientDashboardPage"));
const DoctorDashboardPage = lazy(() => import("./pages/DoctorDashboardPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
  >
    {children}
  </motion.div>
);

export default function App() {
  const location = useLocation();

  return (
    <Suspense
      fallback={
        <div className="screen-center">
          <div className="loading-dot" />
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PageWrapper>
                <LoginPage />
              </PageWrapper>
            }
          />
          <Route
            path="/register"
            element={
              <PageWrapper>
                <RegisterPage />
              </PageWrapper>
            }
          />
          <Route
            path="/verify-email"
            element={
              <PageWrapper>
                <VerifyEmailPage />
              </PageWrapper>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PageWrapper>
                <ForgotPasswordPage />
              </PageWrapper>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PageWrapper>
                <ResetPasswordPage />
              </PageWrapper>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["patient", "doctor", "admin"]}>
                <PageWrapper>
                  <ProfilePage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={["patient"]}>
                <PageWrapper>
                  <PatientDashboardPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <PageWrapper>
                  <DoctorDashboardPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <PageWrapper>
                  <AdminDashboardPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
