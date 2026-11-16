/**
 * test/FeesEntryPage.test.jsx — Reception Fee Entry and Receipt Screen Tests (Day 15 Task 30)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeesEntryPage from '../pages/reception/FeesEntryPage';
import { AuthContext } from '../context/AuthContext';
import * as receptionService from '../services/receptionService';
import * as planService from '../services/planService';

vi.mock('../services/receptionService');
vi.mock('../services/planService');

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: {
      uid: 'staff-rec-1',
      email: 'reception@fitmax.com',
      getIdToken: () => Promise.resolve('fake-token'),
    },
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

describe('FeesEntryPage — Reception Desk Fee Entry & Receipts (Day 15 Task 30)', () => {
  const mockMembers = [
    {
      uid: 'mem-101',
      displayName: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+91 98765 00001',
      membershipStatus: 'none',
    },
    {
      uid: 'mem-102',
      displayName: 'Priya Singh',
      email: 'priya@example.com',
      phone: '+91 98765 00002',
      membershipStatus: 'active',
    },
  ];

  const mockPlans = [
    {
      planId: 'plan-3-months',
      name: '3 Months Pro',
      priceInPaise: 399900,
      durationMonths: 3,
      durationDays: 90,
    },
    {
      planId: 'plan-12-months',
      name: '12 Months Elite',
      priceInPaise: 1199900,
      durationMonths: 12,
      durationDays: 365,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    receptionService.listRecentMembers.mockResolvedValue(mockMembers);
    planService.listPlans.mockResolvedValue(mockPlans);
    receptionService.listManualPayments.mockResolvedValue([
      {
        paymentId: 'PAY-1001',
        userId: 'mem-101',
        planName: '3 Months Pro',
        amountPaise: 399900,
        method: 'cash',
        status: 'captured',
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  it('renders header, member search input, plan options and method cards', async () => {
    renderWithAuth(<FeesEntryPage />);

    expect(screen.getByRole('heading', { name: /fees entry & receipts/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search member name, email or phone/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/3 Months Pro/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/12 Months Elite/i)).toBeInTheDocument();
    });

    // Verify distinct Cash and Manual UPI payment options
    expect(screen.getByText(/Cash Payment/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual UPI Transfer/i)).toBeInTheDocument();

    // Verify distinction banner between counter payments and Razorpay gateway
    expect(screen.getByText(/Front Desk Collections:/i)).toBeInTheDocument();
  });

  it('selects a member, shows selected member card, and displays active renewal toggle if applicable', async () => {
    renderWithAuth(<FeesEntryPage />);

    await waitFor(() => {
      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    });

    // Select the first member
    fireEvent.click(screen.getByText('Rahul Sharma'));

    // Should now display selected member details
    expect(screen.getByText(/Status: none/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change member/i })).toBeInTheDocument();
  });

  it('reveals UPI reference input when Manual UPI option is selected', async () => {
    renderWithAuth(<FeesEntryPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/3 Months Pro/i).length).toBeGreaterThan(0);
    });

    // Initially cash is selected; no UPI reference field
    expect(screen.queryByPlaceholderText(/12-digit transaction ID/i)).not.toBeInTheDocument();

    // Click Manual UPI Transfer
    fireEvent.click(screen.getByText(/Manual UPI Transfer/i));

    // Now the UPI UTR field should be visible
    expect(screen.getByPlaceholderText(/12-digit transaction ID/i)).toBeInTheDocument();
  });

  it('records cash payment successfully and displays the official receipt', async () => {
    receptionService.recordManualPayment.mockResolvedValueOnce({
      payment: {
        paymentId: 'PAY-MANUAL-789',
        method: 'cash',
        amountPaise: 399900,
        status: 'captured',
        gateway: 'manual',
      },
      membership: {
        membershipId: 'mem-sub-1',
        startDate: '2026-11-16T12:00:00.000Z',
        endDate: '2027-02-14T12:00:00.000Z',
        status: 'active',
      },
      auditLogId: 'audit-log-555',
    });

    renderWithAuth(<FeesEntryPage />);

    await waitFor(() => {
      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    });

    // Select member
    fireEvent.click(screen.getByText('Rahul Sharma'));

    // Submit payment
    const submitBtn = screen.getByRole('button', { name: /record payment & issue receipt/i });
    fireEvent.click(submitBtn);

    // Verify receipt rendered
    await waitFor(() => {
      expect(screen.getByText(/OFFICIAL PAYMENT RECEIPT/i)).toBeInTheDocument();
      expect(screen.getByText(/PAY-MANUAL-789/i)).toBeInTheDocument();
      expect(screen.getByText(/Rahul Sharma/i)).toBeInTheDocument();
      expect(screen.getByText(/₹3,999/i)).toBeInTheDocument();
      expect(screen.getByText(/MEMBERSHIP ACTIVATED/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /print \/ save pdf/i })).toBeInTheDocument();
    });
  });

  it('switches to payment history tab and displays past manual payments', async () => {
    renderWithAuth(<FeesEntryPage />);

    const historyTabBtn = screen.getByRole('button', { name: /payment history/i });
    fireEvent.click(historyTabBtn);

    await waitFor(() => {
      expect(screen.getByText('PAY-1001')).toBeInTheDocument();
      expect(screen.getByText('Cash')).toBeInTheDocument();
    });
  });
});
