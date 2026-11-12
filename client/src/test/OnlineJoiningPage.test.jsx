/**
 * test/OnlineJoiningPage.test.jsx — Member Online Joining & Plan Selection Tests (Day 11 Task 22)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnlineJoiningPage from '../pages/member/OnlineJoiningPage';
import { AuthContext } from '../context/AuthContext';
import * as planService from '../services/planService';
import * as memberService from '../services/memberService';

vi.mock('../services/planService');
vi.mock('../services/memberService');

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: { uid: 'mem-1', email: 'member@gym.com', getIdToken: () => Promise.resolve('fake-token') },
    profile: { role: 'member', approvalStatus: 'active', phone: '+91 98765 43210' },
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

describe('OnlineJoiningPage — Member Online Plan Selection (Day 11 Task 22)', () => {
  const samplePlans = [
    {
      planId: 'plan-3-months',
      name: '3 Months Pro',
      priceInPaise: 399900,
      durationDays: 90,
      badge: 'Popular',
      features: ['Full gym floor access', 'Cardio zone', 'Group classes'],
    },
    {
      planId: 'plan-12-months',
      name: '12 Months Elite',
      priceInPaise: 1199900,
      durationDays: 365,
      badge: 'Best Value',
      features: ['24/7 Access', 'Diet Consultation', 'Free guest passes'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    planService.listPlans.mockResolvedValue(samplePlans);
    memberService.getMyMembership.mockResolvedValue(null);
  });

  it('renders plan comparison cards with pricing and benefits', async () => {
    renderWithAuth(<OnlineJoiningPage />);

    expect(screen.getByRole('heading', { name: /choose your fitness journey/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3 Months Pro')).toBeInTheDocument();
      expect(screen.getByText('12 Months Elite')).toBeInTheDocument();
      expect(screen.getByText('3,999')).toBeInTheDocument();
      expect(screen.getByText('11,999')).toBeInTheDocument();
    });
  });

  it('advances to details confirmation step when a plan is selected', async () => {
    renderWithAuth(<OnlineJoiningPage />);

    const chooseBtn = await screen.findByRole('button', { name: /choose 3 months pro/i });
    fireEvent.click(chooseBtn);

    expect(await screen.findByText(/order breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/3,999/)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact phone number/i)).toBeInTheDocument();
  });

  it('submits plan selection and displays clear payment_pending state', async () => {
    memberService.selectPlan.mockResolvedValueOnce({
      membership: {
        membershipId: 'mem-new-1',
        planId: 'plan-3-months',
        planName: '3 Months Pro',
        durationDays: 90,
        priceInPaise: 399900,
        status: 'payment_pending',
      },
      plan: samplePlans[0],
    });

    renderWithAuth(<OnlineJoiningPage />);

    const chooseBtn = await screen.findByRole('button', { name: /choose 3 months pro/i });
    fireEvent.click(chooseBtn);

    const confirmBtn = await screen.findByRole('button', { name: /confirm plan & proceed/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(memberService.selectPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan-3-months',
        }),
        'fake-token'
      );
    });

    expect(await screen.findByText(/plan selected — awaiting payment verification/i)).toBeInTheDocument();
    expect(screen.getByText(/status: payment_pending/i)).toBeInTheDocument();
    expect(screen.getByText('₹3,999')).toBeInTheDocument();
  });

  it('renders payment_pending state directly on mount if member has pending membership', async () => {
    memberService.getMyMembership.mockResolvedValueOnce({
      membershipId: 'existing-pending-1',
      planName: '12 Months Elite',
      durationDays: 365,
      priceInPaise: 1199900,
      status: 'payment_pending',
    });

    renderWithAuth(<OnlineJoiningPage />);

    expect(await screen.findByText(/status: payment_pending/i)).toBeInTheDocument();
    expect(screen.getByText('12 Months Elite')).toBeInTheDocument();
    expect(screen.getByText('₹11,999')).toBeInTheDocument();
  });
});
