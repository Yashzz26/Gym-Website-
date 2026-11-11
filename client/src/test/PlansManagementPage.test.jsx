import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlansManagementPage from '../pages/owner/PlansManagementPage';
import * as planService from '../services/planService';

vi.mock('../services/planService', () => ({
  listPlans: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  setPlanStatus: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'owner-uid-1',
      displayName: 'Vikram Gym Owner',
      getIdToken: vi.fn().mockResolvedValue('mock-owner-token'),
    },
    profile: {
      role: 'owner',
      approvalStatus: 'active',
    },
    isAuthenticated: true,
  }),
}));

describe('PlansManagementPage — Membership Plans UI', () => {
  const samplePlans = [
    {
      planId: 'plan-1',
      name: '1 Month Starter',
      durationMonths: 1,
      durationDays: 30,
      priceInPaise: 149900, // ₹1,499.00
      features: ['Access to gym floor', 'Locker access'],
      description: 'Starter tier for beginners.',
      isActive: true,
      displayOrder: 1,
      badge: 'Starter',
    },
    {
      planId: 'plan-3',
      name: '3 Months Pro',
      durationMonths: 3,
      durationDays: 90,
      priceInPaise: 399900, // ₹3,999.00
      features: ['All classes included', 'Sauna access'],
      description: 'Our most popular plan.',
      isActive: true,
      displayOrder: 2,
      badge: 'Popular',
    },
    {
      planId: 'plan-legacy',
      name: 'Legacy 6 Months',
      durationMonths: 6,
      durationDays: 180,
      priceInPaise: 599900,
      features: ['Basic floor access'],
      description: 'Discontinued legacy tier.',
      isActive: false,
      displayOrder: 4,
      badge: '',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    planService.listPlans.mockResolvedValue(samplePlans);
    planService.createPlan.mockImplementation(async (data) => ({
      planId: 'new-plan-id',
      ...data,
    }));
    planService.updatePlan.mockImplementation(async (id, data) => ({
      planId: id,
      ...data,
    }));
    planService.setPlanStatus.mockImplementation(async (id, isActive) => ({
      planId: id,
      isActive,
    }));
  });

  it('renders all plans with formatted INR prices and feature lists', async () => {
    await act(async () => {
      render(<PlansManagementPage initialPlans={samplePlans} />);
    });

    expect(screen.getByText('1 Month Starter')).toBeInTheDocument();
    expect(screen.getByText('3 Months Pro')).toBeInTheDocument();
    expect(screen.getByText('Legacy 6 Months')).toBeInTheDocument();

    // Check INR formatted amounts (149900 -> ₹1,499)
    expect(screen.getByText(/1,499/)).toBeInTheDocument();
    expect(screen.getByText(/3,999/)).toBeInTheDocument();

    // Check features
    expect(screen.getByText('Access to gym floor')).toBeInTheDocument();
    expect(screen.getByText('All classes included')).toBeInTheDocument();
  });

  it('filters plans by active and inactive status tabs', async () => {
    await act(async () => {
      render(<PlansManagementPage initialPlans={samplePlans} />);
    });

    // Default 'All Plans (3)' shows all 3
    expect(screen.getByText('Legacy 6 Months')).toBeInTheDocument();

    // Click 'Active (2)'
    const activeTab = screen.getByRole('button', { name: /Active \(2\)/i });
    fireEvent.click(activeTab);

    expect(screen.getByText('1 Month Starter')).toBeInTheDocument();
    expect(screen.getByText('3 Months Pro')).toBeInTheDocument();
    expect(screen.queryByText('Legacy 6 Months')).not.toBeInTheDocument();

    // Click 'Inactive (1)'
    const inactiveTab = screen.getByRole('button', { name: /Inactive \(1\)/i });
    fireEvent.click(inactiveTab);

    expect(screen.getByText('Legacy 6 Months')).toBeInTheDocument();
    expect(screen.queryByText('1 Month Starter')).not.toBeInTheDocument();
  });

  it('toggles a plan active/inactive status', async () => {
    await act(async () => {
      render(<PlansManagementPage initialPlans={samplePlans} />);
    });

    const toggleBtn = screen.getByRole('button', { name: /Toggle status for 1 Month Starter/i });
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    await waitFor(() => {
      expect(planService.setPlanStatus).toHaveBeenCalledWith('plan-1', false, 'mock-owner-token');
    });

    expect(screen.getByText(/Plan '1 Month Starter' is now inactive/i)).toBeInTheDocument();
  });

  it('creates a new plan using presets and sends integer paise price', async () => {
    await act(async () => {
      render(<PlansManagementPage initialPlans={samplePlans} />);
    });

    // Open create form
    const createBtn = screen.getByRole('button', { name: /Add New Plan/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Create New Membership Plan')).toBeInTheDocument();

    // Click preset
    const presetBtn = screen.getByRole('button', { name: /12 Months Elite/i });
    fireEvent.click(presetBtn);

    expect(screen.getByDisplayValue('12 Months Elite')).toBeInTheDocument();
    expect(screen.getByDisplayValue('11999')).toBeInTheDocument();

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save Plan/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(planService.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '12 Months Elite',
          durationMonths: 12,
          durationDays: 365,
          priceInPaise: 1199900, // 11999 * 100 paise
          badge: 'Best Value',
        }),
        'mock-owner-token'
      );
    });

    expect(screen.getByText(/Plan '12 Months Elite' created successfully/i)).toBeInTheDocument();
  });

  it('edits an existing plan and updates its details', async () => {
    await act(async () => {
      render(<PlansManagementPage initialPlans={samplePlans} />);
    });

    const editBtn = screen.getByRole('button', { name: /Edit 1 Month Starter/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Membership Plan')).toBeInTheDocument();

    const priceInput = screen.getByLabelText(/Price \(INR ₹\)/i);
    fireEvent.change(priceInput, { target: { value: '1699' } });

    const updateBtn = screen.getByRole('button', { name: /Update Plan/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    await waitFor(() => {
      expect(planService.updatePlan).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          priceInPaise: 169900,
        }),
        'mock-owner-token'
      );
    });

    expect(screen.getByText(/Plan '1 Month Starter' updated successfully/i)).toBeInTheDocument();
  });
});
