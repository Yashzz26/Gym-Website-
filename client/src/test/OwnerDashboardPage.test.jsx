import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage';
import * as userService from '../services/userService';

vi.mock('../services/userService', () => ({
  getPendingStaff: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'owner-uid-1',
      displayName: 'Vikram Gym Owner',
      getIdToken: vi.fn().mockResolvedValue('mock-owner-token'),
    },
    profile: {
      displayName: 'Vikram Gym Owner',
      role: 'owner',
      approvalStatus: 'active',
    },
    isAuthenticated: true,
  }),
}));

describe('OwnerDashboardPage — Layout & Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userService.getPendingStaff.mockResolvedValue([]);
  });

  const renderDashboard = async (props = {}) => {
    let result;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <OwnerDashboardPage {...props} />
        </MemoryRouter>
      );
    });
    return result;
  };

  it('renders welcome banner and owner portal badge', async () => {
    await renderDashboard();

    expect(screen.getByText(/Owner Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Vikram Gym Owner/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time metrics, operational oversight/i)).toBeInTheDocument();
  });

  it('renders clear empty states for key metrics when data is empty', async () => {
    await renderDashboard();

    // Check metric labels with exact text
    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText("Today's Check-ins")).toBeInTheDocument();
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('Pending Staff')).toBeInTheDocument();

    // Check empty state badges and helper texts
    expect(screen.getByText(/0 active members/i)).toBeInTheDocument();
    expect(screen.getByText(/No check-ins today/i)).toBeInTheDocument();
    expect(screen.getByText(/No collections recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/₹0.00/i)).toBeInTheDocument();
    expect(screen.getByText(/No pending staff self-registrations/i)).toBeInTheDocument();
  });

  it('displays the gym launch checklist when there are 0 active members', async () => {
    await renderDashboard();

    expect(screen.getByText(/Gym Launch & Quick Setup Guide/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setup: Configure Gym Profile & Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setup: Create Membership Plans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setup: Approve Staff or Trainers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setup: Enroll Your First Member' })).toBeInTheDocument();
  });

  it('renders all quick action cards linking to operational modules', async () => {
    await renderDashboard();

    const plansLink = screen.getByRole('link', { name: 'Action: Membership Plans' });
    expect(plansLink).toHaveAttribute('href', '/owner/plans');

    const staffLink = screen.getByRole('link', { name: 'Action: Staff Approvals' });
    expect(staffLink).toHaveAttribute('href', '/owner/staff');

    const settingsLink = screen.getByRole('link', { name: 'Action: Gym Settings' });
    expect(settingsLink).toHaveAttribute('href', '/owner/settings');

    const inactiveLink = screen.getByRole('link', { name: 'Action: Inactive Members' });
    expect(inactiveLink).toHaveAttribute('href', '/owner/inactive');

    const registerLink = screen.getByRole('link', { name: 'Action: New Member Registration' });
    expect(registerLink).toHaveAttribute('href', '/reception/register');

    const reportsLink = screen.getByRole('link', { name: 'Action: Daily Report & Revenue' });
    expect(reportsLink).toHaveAttribute('href', '/owner/reports');
  });

  it('renders active stats and formatted revenue correctly when numbers are present', async () => {
    await renderDashboard({
      initialStats: {
        activeMembers: 75,
        todayAttendance: 28,
        monthlyRevenuePaise: 11250000, // 1,12,500 INR
        pendingStaffCount: 2,
      },
    });

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    // 11250000 paise -> ₹1,12,500.00 formatted with INR
    expect(screen.getByText(/1,12,500/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Action required/i)).toBeInTheDocument();
  });

  it('allows manual refresh of dashboard data', async () => {
    await renderDashboard();

    const refreshBtn = screen.getByRole('button', { name: /Refresh Dashboard Metrics/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      expect(userService.getPendingStaff).toHaveBeenCalled();
    });
  });
});
