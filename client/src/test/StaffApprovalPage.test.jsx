import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffApprovalPage from '../pages/owner/StaffApprovalPage';
import RegisterPage from '../pages/auth/RegisterPage';
import { AuthContext } from '../context/AuthContext';
import * as userService from '../services/userService';
import * as authService from '../services/auth';

vi.mock('../services/userService', () => ({
  getPendingStaff: vi.fn(),
  approveStaff: vi.fn(),
  suspendStaff: vi.fn(),
  createStaffAccountByOwner: vi.fn(),
}));

vi.mock('../services/auth', () => ({
  registerWithEmail: vi.fn(),
}));

function renderWithAuth(ui, authValue = { user: { uid: 'owner-1', getIdToken: vi.fn().mockResolvedValue('owner-token') }, isAuthenticated: true, profile: { role: 'owner' } }) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Staff Approval Workflow & Registration UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders staff approval screen and shows pending applicants', async () => {
    userService.getPendingStaff.mockResolvedValueOnce([
      {
        uid: 'staff-1',
        displayName: 'John Trainer',
        email: 'john@gym.com',
        role: 'trainer',
        approvalStatus: 'pending',
        createdAt: '2026-11-09T10:00:00.000Z',
      },
    ]);

    renderWithAuth(<StaffApprovalPage />);

    expect(screen.getByText(/Staff Account Approvals & Roles/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('John Trainer')).toBeInTheDocument();
      expect(screen.getByText('john@gym.com')).toBeInTheDocument();
      expect(screen.getByText('trainer')).toBeInTheDocument();
    });
  });

  it('approves a pending staff account on click', async () => {
    userService.getPendingStaff.mockResolvedValueOnce([
      {
        uid: 'staff-1',
        displayName: 'John Trainer',
        email: 'john@gym.com',
        role: 'trainer',
        approvalStatus: 'pending',
      },
    ]);
    userService.approveStaff.mockResolvedValueOnce({
      uid: 'staff-1',
      approvalStatus: 'active',
    });

    renderWithAuth(<StaffApprovalPage />);

    await waitFor(() => {
      expect(screen.getByText('John Trainer')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(userService.approveStaff).toHaveBeenCalledWith('staff-1', 'trainer', 'owner-token');
      expect(screen.getByText(/successfully approved/i)).toBeInTheDocument();
    });
  });

  it('rejects a staff account on click', async () => {
    userService.getPendingStaff.mockResolvedValueOnce([
      {
        uid: 'staff-2',
        displayName: 'Suspicious Applicant',
        email: 'bad@gym.com',
        role: 'reception',
        approvalStatus: 'pending',
      },
    ]);
    userService.suspendStaff.mockResolvedValueOnce({
      uid: 'staff-2',
      approvalStatus: 'suspended',
    });

    renderWithAuth(<StaffApprovalPage />);

    await waitFor(() => {
      expect(screen.getByText('Suspicious Applicant')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(userService.suspendStaff).toHaveBeenCalledWith(
        'staff-2',
        expect.stringContaining('review'),
        'owner-token'
      );
      expect(screen.getByText(/rejected and account suspended/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no pending staff exist', async () => {
    userService.getPendingStaff.mockResolvedValueOnce([]);

    renderWithAuth(<StaffApprovalPage />);

    await waitFor(() => {
      expect(screen.getByText(/All Caught Up!/i)).toBeInTheDocument();
    });
  });

  it('allows public registration for trainer with pending notice and no owner option', async () => {
    renderWithAuth(<RegisterPage />);

    // Must NEVER offer owner role in registration
    expect(screen.queryByRole('button', { name: /^owner$/i })).not.toBeInTheDocument();

    // Select Trainer
    const trainerBtn = screen.getByRole('button', { name: /trainer/i });
    fireEvent.click(trainerBtn);

    expect(screen.getByText(/Staff registrations require owner approval/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Alex Trainer' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'alex@gym.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(authService.registerWithEmail).toHaveBeenCalledWith({
        name: 'Alex Trainer',
        email: 'alex@gym.com',
        password: 'password123',
        role: 'trainer',
      });
    });
  });
});
