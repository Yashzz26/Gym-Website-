import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RenewalListPage from '../pages/reception/RenewalListPage';
import * as membershipService from '../services/membershipService';
import * as planService from '../services/planService';

// Mock AuthContext with stable user reference
const mockUser = {
  uid: 'staff-reception-1',
  displayName: 'Receptionist Sunita',
  email: 'reception@ironpulse.fit',
  getIdToken: vi.fn().mockResolvedValue('mock-staff-token'),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'reception',
  }),
}));

const mockExpiringMemberships = [
  {
    membershipId: 'mem-101',
    userId: 'user-101',
    planId: 'plan-3-months',
    planName: '3 Months Pro',
    durationDays: 90,
    priceInPaise: 399900,
    startDate: '2026-08-25T00:00:00.000Z',
    endDate: '2026-11-24T00:00:00.000Z',
    daysRemaining: 1,
    isExpired: false,
    urgency: 'critical',
    member: {
      userId: 'user-101',
      displayName: 'Aman Sharma',
      phone: '+91 98765 11111',
      email: 'aman@example.com',
    },
  },
  {
    membershipId: 'mem-102',
    userId: 'user-102',
    planId: 'plan-1-month',
    planName: '1 Month Starter',
    durationDays: 30,
    priceInPaise: 149900,
    startDate: '2026-10-27T00:00:00.000Z',
    endDate: '2026-11-26T00:00:00.000Z',
    daysRemaining: 3,
    isExpired: false,
    urgency: 'urgent',
    member: {
      userId: 'user-102',
      displayName: 'Pooja Verma',
      phone: '+91 98765 22222',
      email: 'pooja@example.com',
    },
  },
  {
    membershipId: 'mem-103',
    userId: 'user-103',
    planId: 'plan-6-months',
    planName: '6 Months Power',
    durationDays: 180,
    priceInPaise: 699900,
    startDate: '2026-05-31T00:00:00.000Z',
    endDate: '2026-11-29T00:00:00.000Z',
    daysRemaining: 6,
    isExpired: false,
    urgency: 'warning',
    member: {
      userId: 'user-103',
      displayName: 'Rahul Mehta',
      phone: '+91 98765 33333',
      email: 'rahul@example.com',
    },
  },
];

const mockPlans = [
  {
    planId: 'plan-1-month',
    name: '1 Month Starter',
    durationDays: 30,
    priceInPaise: 149900,
    isActive: true,
  },
  {
    planId: 'plan-3-months',
    name: '3 Months Pro',
    durationDays: 90,
    priceInPaise: 399900,
    isActive: true,
  },
];

describe('RenewalListPage — Reception Renewal Management Screen (Day 22 Task 44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(membershipService, 'getExpiringMemberships').mockResolvedValue({
      count: mockExpiringMemberships.length,
      windowDays: 7,
      memberships: mockExpiringMemberships,
    });
    vi.spyOn(membershipService, 'renewMembership').mockResolvedValue({
      membershipId: 'new-mem-999',
      status: 'active',
    });
    vi.spyOn(planService, 'listPlans').mockResolvedValue(mockPlans);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <RenewalListPage />
      </MemoryRouter>
    );

  it('renders branding header, KPI summary statistics and controls', async () => {
    renderComponent();

    expect(screen.getByTestId('renewal-list-page')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming Renewals & Expiry Watch/i)).toBeInTheDocument();
    expect(screen.getByText(/Reception Desk/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-expiring-soon')).toHaveTextContent('3');
      expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1');
      expect(screen.getByTestId('kpi-urgent')).toHaveTextContent('1');
    });

    expect(screen.getByTestId('renewals-search-input')).toBeInTheDocument();
  });

  it('displays expiring members with plan details, days left and urgency badges', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
      expect(screen.getByText('Pooja Verma')).toBeInTheDocument();
      expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
    });

    expect(screen.getByText('3 Months Pro')).toBeInTheDocument();
    expect(screen.getByText('1 Day Left')).toBeInTheDocument();
    expect(screen.getByText('3 Days Left')).toBeInTheDocument();
    expect(screen.getByText('6 Days Left')).toBeInTheDocument();
  });

  it('filters expiring members by search query', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('renewals-search-input');
    fireEvent.change(searchInput, { target: { value: 'Pooja' } });

    expect(screen.getByText('Pooja Verma')).toBeInTheDocument();
    expect(screen.queryByText('Aman Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('Rahul Mehta')).not.toBeInTheDocument();
  });

  it('filters expiring members by urgency tab pill', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    });

    // Click Critical tab (should show Aman Sharma with 1 day left)
    const criticalTab = screen.getByRole('button', { name: /critical/i });
    fireEvent.click(criticalTab);

    expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Pooja Verma')).not.toBeInTheDocument();
    expect(screen.queryByText('Rahul Mehta')).not.toBeInTheDocument();
  });

  it('opens Quick Renew modal and submits updated membership', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    });

    const renewBtn = screen.getByLabelText(/renew membership for aman sharma/i);
    fireEvent.click(renewBtn);

    expect(screen.getByTestId('renew-modal')).toBeInTheDocument();
    expect(screen.getByText(/Renew Membership/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm & record renewal/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(membershipService.renewMembership).toHaveBeenCalledWith(
        'mem-101',
        expect.objectContaining({
          planId: 'plan-3-months',
          paymentMethod: 'cash',
          paymentStatus: 'paid',
        }),
        'mock-staff-token'
      );
    });
  });

  it('opens WhatsApp reminder modal and simulates message dispatch', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    });

    const whatsappBtn = screen.getByLabelText(/send whatsapp reminder to aman sharma/i);
    fireEvent.click(whatsappBtn);

    expect(screen.getByTestId('bulk-whatsapp-modal')).toBeInTheDocument();
    expect(screen.getByText(/Send WhatsApp Renewal Reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/ironcore_renewal_reminder_3days/i)).toBeInTheDocument();

    const sendBtn = screen.getByRole('button', { name: /confirm & send via whatsapp/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/WhatsApp reminder template dispatched/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no memberships expire within window', async () => {
    membershipService.getExpiringMemberships.mockResolvedValueOnce({
      count: 0,
      windowDays: 7,
      memberships: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/No Memberships Due For Renewal/i)).toBeInTheDocument();
    });
  });

  it('renders error banner and retry button when fetching fails', async () => {
    membershipService.getExpiringMemberships.mockRejectedValueOnce(
      new Error('Failed to connect to memberships service')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to connect to memberships service/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
