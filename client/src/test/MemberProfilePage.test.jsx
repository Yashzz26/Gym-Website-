/**
 * test/MemberProfilePage.test.jsx — Member Profile & Membership Views Tests (Day 12 Task 24)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MemberProfilePage from '../pages/member/MemberProfilePage';
import { AuthContext } from '../context/AuthContext';
import * as membershipService from '../services/membershipService';
import * as planService from '../services/planService';

vi.mock('../services/membershipService');
vi.mock('../services/planService');

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: {
      uid: 'user-123',
      email: 'john@fitmax.com',
      displayName: 'John Doe',
      getIdToken: () => Promise.resolve('mock-token'),
    },
    profile: {
      displayName: 'John Doe',
      email: 'john@fitmax.com',
      phone: '+91 98765 43210',
      gender: 'male',
      role: 'member',
      approvalStatus: 'active',
      emergencyContact: {
        name: 'Jane Doe',
        relation: 'Spouse',
        phone: '+91 91234 56789',
      },
    },
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

describe('MemberProfilePage — Member Profile and Membership Views (Day 12 Task 24)', () => {
  const sampleData = {
    userId: 'user-123',
    activeMembership: {
      membershipId: 'mem-active-1',
      planId: 'plan-3-months',
      planName: '3 Months Pro',
      durationDays: 90,
      priceInPaise: 399900,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2027-01-30T00:00:00.000Z',
      status: 'active',
      paymentMethod: 'online',
      daysRemaining: 78,
      isExpired: false,
    },
    history: [
      {
        membershipId: 'mem-active-1',
        planName: '3 Months Pro',
        durationDays: 90,
        priceInPaise: 399900,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2027-01-30T00:00:00.000Z',
        status: 'active',
        paymentMethod: 'online',
        renewedFrom: 'mem-old-0',
      },
      {
        membershipId: 'mem-old-0',
        planName: '1 Month Starter',
        durationDays: 30,
        priceInPaise: 149900,
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T00:00:00.000Z',
        status: 'expired',
        paymentMethod: 'cash',
        renewedFrom: null,
      },
    ],
    totalMemberships: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    membershipService.getUserMemberships.mockResolvedValue(sampleData);
    planService.listPlans.mockResolvedValue([
      {
        planId: 'plan-3-months',
        name: '3 Months Pro',
        durationDays: 90,
        priceInPaise: 399900,
      },
      {
        planId: 'plan-6-months',
        name: '6 Months Power',
        durationDays: 180,
        priceInPaise: 699900,
      },
    ]);
  });

  it('renders member profile details (name, email, phone, role)', async () => {
    renderWithAuth(<MemberProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@fitmax.com')).toBeInTheDocument();
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });
  });

  it('renders active membership details with pricing and status badge', async () => {
    renderWithAuth(<MemberProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: '3 Months Pro' })).toBeInTheDocument();
      expect(screen.getAllByText('₹3,999').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('78 days')).toBeInTheDocument();
      expect(screen.getByText('Membership Period Progress')).toBeInTheDocument();
    });
  });

  it('renders membership renewal history timeline with continuity badges', async () => {
    renderWithAuth(<MemberProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Membership & Renewal History')).toBeInTheDocument();
      expect(screen.getByText('2 Periods Recorded')).toBeInTheDocument();
      expect(screen.getByText('1 Month Starter')).toBeInTheDocument();
      expect(screen.getByText(/Renewed from #/)).toBeInTheDocument();
    });
  });

  it('renders empty membership view when no active subscription exists', async () => {
    membershipService.getUserMemberships.mockResolvedValue({
      userId: 'user-123',
      activeMembership: null,
      history: [],
      totalMemberships: 0,
    });

    renderWithAuth(<MemberProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('No Active Membership Found')).toBeInTheDocument();
      expect(screen.getByText('Choose Membership Plan')).toBeInTheDocument();
    });
  });

  it('opens renewal box and allows submitting membership renewal', async () => {
    membershipService.renewMembership.mockResolvedValue({
      membership: { membershipId: 'mem-active-2', planId: 'plan-6-months', status: 'active' },
    });

    renderWithAuth(<MemberProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Renew / Extend Membership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Renew / Extend Membership'));

    await waitFor(() => {
      expect(screen.getByText('Choose Plan & Renew Membership')).toBeInTheDocument();
      expect(screen.getByText('6 Months Power')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('6 Months Power'));
    fireEvent.click(screen.getByText('Confirm & Renew Now'));

    await waitFor(() => {
      expect(membershipService.renewMembership).toHaveBeenCalledWith(
        'mem-active-1',
        expect.objectContaining({
          planId: 'plan-6-months',
        }),
        'mock-token'
      );
    });
  });
});
