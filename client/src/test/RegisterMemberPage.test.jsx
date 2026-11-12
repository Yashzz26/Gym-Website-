/**
 * test/RegisterMemberPage.test.jsx — Reception Member Registration Tests (Day 11 Task 21)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterMemberPage from '../pages/reception/RegisterMemberPage';
import { AuthContext } from '../context/AuthContext';
import * as receptionService from '../services/receptionService';
import * as planService from '../services/planService';

vi.mock('../services/receptionService');
vi.mock('../services/planService');

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: { uid: 'rec-1', email: 'reception@gym.com', getIdToken: () => Promise.resolve('fake-token') },
    profile: { role: 'reception', approvalStatus: 'active' },
    isAuthenticated: true,
    loading: false,
    ...authValue,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('RegisterMemberPage — In-Person Member Registration (Day 11 Task 21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planService.listPlans.mockResolvedValue([
      { planId: 'plan-3-months', name: '3 Months Pro', priceInPaise: 399900, durationDays: 90 },
    ]);
  });

  it('renders registration form fields and plan options', async () => {
    renderWithAuth(<RegisterMemberPage />);

    expect(screen.getByRole('heading', { name: /member onboarding/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/3 Months Pro — ₹3999/i)).toBeInTheDocument();
    });
  });

  it('submits valid member registration and renders credentials with copy option', async () => {
    receptionService.registerMember.mockResolvedValueOnce({
      user: {
        uid: 'new-mem-1',
        displayName: 'Varun Patel',
        email: 'varun@example.com',
        phone: '+91 98765 43210',
        role: 'member',
        approvalStatus: 'active',
      },
      temporaryPassword: 'Gym#882910',
      membership: {
        membershipId: 'mem-1',
        planName: '3 Months Pro',
      },
    });

    renderWithAuth(<RegisterMemberPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Varun Patel' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'varun@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+91 98765 43210' },
    });

    const submitBtn = screen.getByRole('button', { name: /register member/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(receptionService.registerMember).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Varun Patel',
          email: 'varun@example.com',
          phone: '+91 98765 43210',
        }),
        'fake-token'
      );
    });

    // Verify success banner and credentials
    expect(await screen.findByText(/member registered successfully/i)).toBeInTheDocument();
    expect(screen.getByText('Gym#882910')).toBeInTheDocument();
    expect(screen.getByText('3 Months Pro')).toBeInTheDocument();
  });

  it('displays error alert when duplicate email is rejected by backend', async () => {
    receptionService.registerMember.mockRejectedValueOnce(
      new Error('A member account with this email address already exists')
    );

    renderWithAuth(<RegisterMemberPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Duplicate User' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'duplicate@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+91 98765 43211' },
    });

    fireEvent.click(screen.getByRole('button', { name: /register member/i }));

    expect(
      await screen.findByText(/a member account with this email address already exists/i)
    ).toBeInTheDocument();
  });
});

