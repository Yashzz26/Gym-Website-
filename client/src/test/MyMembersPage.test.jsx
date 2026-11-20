import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyMembersPage from '../pages/trainer/MyMembersPage';
import * as trainerService from '../services/trainerService';

// Stable Auth Context mock
const mockTrainerUser = {
  uid: 'trainer-001',
  displayName: 'Coach Vikram',
  email: 'vikram@fitmax.com',
  getIdToken: vi.fn().mockResolvedValue('mock-trainer-token'),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockTrainerUser,
    role: 'trainer',
  }),
}));

const mockMembers = [
  {
    assignmentId: 'assign-1',
    memberId: 'member-101',
    displayName: 'Aman Verma',
    email: 'aman@example.com',
    phone: '+919876543210',
    gender: 'male',
    membershipStatus: 'active',
    activePlan: {
      planName: 'Annual Pro',
      status: 'active',
    },
    fitnessGoal: 'Muscle Gain',
    currentWeightKg: 78.5,
    targetWeightKg: 72.0,
    weightDeltaKg: 6.5,
    notes: 'Focus on compound lifts and calorie surplus',
    assignedAt: '2026-11-15T10:00:00.000Z',
    attendance: {
      totalVisits: 18,
      currentStreak: 5,
      lastCheckInDate: '2026-11-19',
    },
  },
  {
    assignmentId: 'assign-2',
    memberId: 'member-102',
    displayName: 'Pooja Singh',
    email: 'pooja@example.com',
    phone: '+919876543211',
    gender: 'female',
    membershipStatus: 'active',
    activePlan: {
      planName: 'Quarterly Gold',
      status: 'active',
    },
    fitnessGoal: 'Fat Loss',
    currentWeightKg: 68.0,
    targetWeightKg: 60.0,
    weightDeltaKg: 8.0,
    notes: 'Calorie deficit diet and evening HIIT',
    assignedAt: '2026-11-16T12:00:00.000Z',
    attendance: {
      totalVisits: 12,
      currentStreak: 3,
      lastCheckInDate: '2026-11-18',
    },
  },
];

describe("MyMembersPage — Trainer Assigned Members Roster (Day 19 Task 38)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders branding header, KPI summary statistics and controls', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockMembers);

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Assigned Members/i })).toBeInTheDocument();
    expect(screen.getByText(/Trainer Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Fat Loss Clients/i)).toBeInTheDocument();
    expect(screen.getByText(/Muscle & Strength/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('total-clients-count')).toHaveTextContent('2');
      expect(screen.getByTestId('fatloss-clients-count')).toHaveTextContent('1');
      expect(screen.getByTestId('muscle-clients-count')).toHaveTextContent('1');
      expect(screen.getByTestId('total-visits-count')).toHaveTextContent('30');
    });
  });

  it('displays member cards with fitness goals, weight delta, attendance and workout links', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockMembers);

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Verma')).toBeInTheDocument();
      expect(screen.getByText('Pooja Singh')).toBeInTheDocument();
    });

    // Check fitness goals
    expect(screen.getAllByText('Muscle Gain').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fat Loss').length).toBeGreaterThanOrEqual(1);

    // Check weights
    expect(screen.getByText('78.5 kg')).toBeInTheDocument();
    expect(screen.getByText('72 kg')).toBeInTheDocument();
    expect(screen.getByText('+6.5 kg')).toBeInTheDocument();

    // Check attendance
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText(/5d/)).toBeInTheDocument();

    // Check action buttons and links
    expect(screen.getAllByRole('button', { name: /Update Progress/i }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /Workouts/i }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /Diet/i }).length).toBe(2);
  });

  it('filters assigned members by search query', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockMembers);

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Verma')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by member name/i);
    fireEvent.change(searchInput, { target: { value: 'Pooja' } });

    expect(screen.getByText('Pooja Singh')).toBeInTheDocument();
    expect(screen.queryByText('Aman Verma')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Aman Verma')).toBeInTheDocument();
    expect(screen.getByText('Pooja Singh')).toBeInTheDocument();
  });

  it('filters assigned members by goal pill tab', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockMembers);

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Verma')).toBeInTheDocument();
    });

    // Click Fat Loss tab
    const fatLossTab = screen.getByRole('tab', { name: 'Fat Loss' });
    fireEvent.click(fatLossTab);

    expect(screen.getByText('Pooja Singh')).toBeInTheDocument();
    expect(screen.queryByText('Aman Verma')).not.toBeInTheDocument();
  });

  it('opens progress update modal and submits updated weight and goal', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockMembers);
    const updateSpy = vi.spyOn(trainerService, 'updateMemberProgress').mockResolvedValue({
      memberId: 'member-101',
      fitnessGoal: 'Muscle Gain',
      currentWeightKg: 79.0,
      targetWeightKg: 72.0,
    });

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Verma')).toBeInTheDocument();
    });

    // Click Update Progress button specifically on Aman Verma's card
    const amanCard = screen.getByTestId('member-card-member-101');
    const updateBtn = within(amanCard).getByRole('button', { name: /Update Progress/i });
    fireEvent.click(updateBtn);

    // Modal should be open
    await waitFor(() => {
      expect(screen.getByTestId('modal-title')).toHaveTextContent(/Aman Verma/i);
    });

    const weightInput = screen.getByLabelText(/Current Weight/i);
    fireEvent.change(weightInput, { target: { value: '79.0' } });

    const submitBtn = screen.getByRole('button', { name: /Save Progress/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'member-101',
        expect.objectContaining({
          currentWeightKg: 79.0,
          fitnessGoal: 'Muscle Gain',
        }),
        'mock-trainer-token'
      );
    });
  });

  it('renders empty state when trainer has no assigned members', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('roster-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No Members Assigned Yet/i)).toBeInTheDocument();
    });
  });

  it('renders error banner and retry button when fetching fails', async () => {
    vi.spyOn(trainerService, 'getAssignedMembers').mockRejectedValue(
      new Error('Failed to retrieve assigned members')
    );

    render(
      <MemoryRouter>
        <MyMembersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to retrieve assigned members/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
