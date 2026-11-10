import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RoleGuard, ActiveGuard } from './components/ProtectedRoute';

// Layouts
import AppShell from './layouts/AppShell';
import AuthLayout from './layouts/AuthLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Common Pages
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// Member Pages
import OnlineJoiningPage from './pages/member/OnlineJoiningPage';
import QrAttendancePage from './pages/member/QrAttendancePage';
import WorkoutPlanPage from './pages/member/WorkoutPlanPage';
import MemberProfilePage from './pages/member/MemberProfilePage';

// Reception Pages
import TodayAttendancePage from './pages/reception/TodayAttendancePage';
import FeesEntryPage from './pages/reception/FeesEntryPage';
import RenewalListPage from './pages/reception/RenewalListPage';
import RegisterMemberPage from './pages/reception/RegisterMemberPage';

// Trainer Pages
import MyMembersPage from './pages/trainer/MyMembersPage';
import DietPlanPage from './pages/trainer/DietPlanPage';
import WorkoutBuilderPage from './pages/trainer/WorkoutBuilderPage';

// Owner Pages
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import DailyReportPage from './pages/owner/DailyReportPage';
import InactiveMembersPage from './pages/owner/InactiveMembersPage';
import PlansManagementPage from './pages/owner/PlansManagementPage';
import StaffApprovalPage from './pages/owner/StaffApprovalPage';
import GymSettingsPage from './pages/owner/GymSettingsPage';

import './App.css';

/**
 * App — Root router configuration
 *
 * Route-guard hierarchy:
 *
 *   Public   — Auth layout routes (login, register, forgot-password)
 *   Protected  → ActiveGuard → AppShell
 *                └ RoleGuard(['member'])    → member/*
 *                └ RoleGuard(['reception', 'owner']) → reception/*
 *                └ RoleGuard(['trainer', 'owner'])   → trainer/*
 *                └ RoleGuard(['owner'])              → owner/*
 *
 * Frontend guards are UX-only: the Express server enforces authorization
 * via Firebase Admin SDK and Firestore reads on every API call.
 */
function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div
        role="status"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        Loading your account…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ---------------------------------------------------------------- */}
        {/* Public / Auth Route Group — no authentication required           */}
        {/* ---------------------------------------------------------------- */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* ---------------------------------------------------------------- */}
        {/* Protected Route Group — must be signed in                        */}
        {/* ---------------------------------------------------------------- */}
        <Route element={<ProtectedRoute />}>
          {/* Account-status gate: blocks pending/suspended users            */}
          <Route element={<ActiveGuard />}>
            {/* Application Shell wraps all role portals                     */}
            <Route element={<AppShell />}>
              {/* Home / landing */}
              <Route path="/" element={<HomePage />} />

              {/* ---------------------------------------------------------- */}
              {/* Member Routes — role: member                                */}
              {/* ---------------------------------------------------------- */}
              <Route element={<RoleGuard allowedRoles={['member', 'owner']} />}>
                <Route path="/member">
                  <Route index element={<Navigate to="/member/join" replace />} />
                  <Route path="join" element={<OnlineJoiningPage />} />
                  <Route path="attendance" element={<QrAttendancePage />} />
                  <Route path="workout" element={<WorkoutPlanPage />} />
                  <Route path="profile" element={<MemberProfilePage />} />
                </Route>
              </Route>

              {/* ---------------------------------------------------------- */}
              {/* Reception Routes — role: reception or owner                 */}
              {/* ---------------------------------------------------------- */}
              <Route element={<RoleGuard allowedRoles={['reception', 'owner']} />}>
                <Route path="/reception">
                  <Route index element={<Navigate to="/reception/attendance" replace />} />
                  <Route path="attendance" element={<TodayAttendancePage />} />
                  <Route path="fees" element={<FeesEntryPage />} />
                  <Route path="renewals" element={<RenewalListPage />} />
                  <Route path="register" element={<RegisterMemberPage />} />
                </Route>
              </Route>

              {/* ---------------------------------------------------------- */}
              {/* Trainer Routes — role: trainer or owner                     */}
              {/* ---------------------------------------------------------- */}
              <Route element={<RoleGuard allowedRoles={['trainer', 'owner']} />}>
                <Route path="/trainer">
                  <Route index element={<Navigate to="/trainer/members" replace />} />
                  <Route path="members" element={<MyMembersPage />} />
                  <Route path="diet" element={<DietPlanPage />} />
                  <Route path="workouts" element={<WorkoutBuilderPage />} />
                </Route>
              </Route>

              {/* ---------------------------------------------------------- */}
              {/* Owner Routes — role: owner only                             */}
              {/* ---------------------------------------------------------- */}
              <Route element={<RoleGuard allowedRoles={['owner']} />}>
                <Route path="/owner">
                  <Route index element={<Navigate to="/owner/dashboard" replace />} />
                  <Route path="dashboard" element={<OwnerDashboardPage />} />
                  <Route path="reports" element={<DailyReportPage />} />
                  <Route path="inactive" element={<InactiveMembersPage />} />
                  <Route path="plans" element={<PlansManagementPage />} />
                  <Route path="staff" element={<StaffApprovalPage />} />
                  <Route path="settings" element={<GymSettingsPage />} />
                </Route>
              </Route>

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
