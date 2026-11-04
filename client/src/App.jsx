import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import DailyReportPage from './pages/owner/DailyReportPage';
import InactiveMembersPage from './pages/owner/InactiveMembersPage';
import PlansManagementPage from './pages/owner/PlansManagementPage';
import StaffApprovalPage from './pages/owner/StaffApprovalPage';
import GymSettingsPage from './pages/owner/GymSettingsPage';

import './App.css';

/**
 * App — Root router configuration
 * Configures route groups for Auth, Member, Reception, Trainer, and Owner areas,
 * with shared responsive application shell and 404 fallback.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Auth Route Group */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Application Shell Route Group */}
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />

          {/* Member Routes */}
          <Route path="/member">
            <Route index element={<Navigate to="/member/join" replace />} />
            <Route path="join" element={<OnlineJoiningPage />} />
            <Route path="attendance" element={<QrAttendancePage />} />
            <Route path="workout" element={<WorkoutPlanPage />} />
            <Route path="profile" element={<MemberProfilePage />} />
          </Route>

          {/* Reception Routes */}
          <Route path="/reception">
            <Route index element={<Navigate to="/reception/attendance" replace />} />
            <Route path="attendance" element={<TodayAttendancePage />} />
            <Route path="fees" element={<FeesEntryPage />} />
            <Route path="renewals" element={<RenewalListPage />} />
            <Route path="register" element={<RegisterMemberPage />} />
          </Route>

          {/* Trainer Routes */}
          <Route path="/trainer">
            <Route index element={<Navigate to="/trainer/members" replace />} />
            <Route path="members" element={<MyMembersPage />} />
            <Route path="diet" element={<DietPlanPage />} />
            <Route path="workouts" element={<WorkoutBuilderPage />} />
          </Route>

          {/* Owner Routes */}
          <Route path="/owner">
            <Route index element={<Navigate to="/owner/dashboard" replace />} />
            <Route path="dashboard" element={<DailyReportPage />} />
            <Route path="inactive" element={<InactiveMembersPage />} />
            <Route path="plans" element={<PlansManagementPage />} />
            <Route path="staff" element={<StaffApprovalPage />} />
            <Route path="settings" element={<GymSettingsPage />} />
          </Route>

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
