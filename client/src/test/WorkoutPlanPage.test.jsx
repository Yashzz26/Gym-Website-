import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WorkoutPlanPage from '../pages/member/WorkoutPlanPage';
import * as workoutService from '../services/workoutService';

const mockMemberUser = {
  uid: 'member-101',
  displayName: 'Aman Verma',
  email: 'aman@example.com',
  getIdToken: vi.fn().mockResolvedValue('mock-member-token'),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockMemberUser,
    role: 'member',
  }),
}));

const mockPlans = [
  {
    id: 'plan-mon',
    memberId: 'member-101',
    trainerId: 'trainer-001',
    trainerName: 'Vikram Singh',
    title: 'Push Day - Chest & Shoulders',
    weekDay: 'mon',
    notes: 'Warm up thoroughly with rotator cuff drills',
    exercises: [
      {
        name: 'Barbell Bench Press',
        sets: 4,
        reps: '8-10',
        weightKg: 75,
        restSeconds: 90,
        videoUrl: 'https://youtube.com/watch?v=bench-press',
        notes: 'Pause at the chest for 1 second',
      },
      {
        name: 'Incline Dumbbell Press',
        sets: 3,
        reps: '10-12',
        weightKg: 24,
        restSeconds: 60,
        notes: 'Controlled eccentric tempo',
      },
      {
        name: 'Overhead Shoulder Press',
        sets: 4,
        reps: '8-10',
        weightKg: 45,
        restSeconds: 90,
      },
    ],
    createdAt: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'plan-wed',
    memberId: 'member-101',
    trainerId: 'trainer-001',
    trainerName: 'Vikram Singh',
    title: 'Pull Day - Back & Biceps',
    weekDay: 'wed',
    notes: 'Focus on mind-muscle connection',
    exercises: [
      {
        name: 'Barbell Deadlift',
        sets: 4,
        reps: '5',
        weightKg: 120,
        restSeconds: 120,
      },
    ],
    createdAt: '2026-11-20T10:00:00.000Z',
  },
];

const mockLogs = [
  {
    id: 'log-001',
    workoutPlanId: 'plan-mon',
    date: '2026-11-16',
    completedExercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Overhead Shoulder Press'],
    durationMinutes: 50,
    perceivedExertion: 8,
    notes: 'Crushed bench press, felt strong!',
    createdAt: '2026-11-16T18:30:00.000Z',
  },
];

describe('WorkoutPlanPage (Day 20 Task 40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workoutService, 'getWorkoutPlans').mockResolvedValue(mockPlans);
    vi.spyOn(workoutService, 'getWorkoutLogs').mockResolvedValue(mockLogs);
    vi.spyOn(workoutService, 'logWorkoutCompletion').mockImplementation(async (payload) => ({
      id: 'log-new-999',
      ...payload,
      createdAt: new Date().toISOString(),
    }));
  });

  it('renders page header and weekday navigation tabs', async () => {
    render(<WorkoutPlanPage />);

    expect(screen.getByTestId('workout-plan-page')).toBeInTheDocument();
    expect(screen.getByText('Daily Workout Routine')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('weekday-tab-mon')).toBeInTheDocument();
    expect(screen.getByTestId('weekday-tab-tue')).toBeInTheDocument();
    expect(screen.getByTestId('weekday-tab-wed')).toBeInTheDocument();
  });

  it('displays workout plan details and exercise checklist for Monday', async () => {
    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    // Click Monday tab
    fireEvent.click(screen.getByTestId('weekday-tab-mon'));

    expect(screen.getByText('Push Day - Chest & Shoulders')).toBeInTheDocument();
    expect(screen.getByText(/Coach Vikram Singh/i)).toBeInTheDocument();
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText('Overhead Shoulder Press')).toBeInTheDocument();

    // Verify video link exists
    expect(screen.getByTestId('video-link-0')).toHaveAttribute(
      'href',
      'https://youtube.com/watch?v=bench-press'
    );
  });

  it('updates progress percentage when checking off exercises', async () => {
    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('weekday-tab-mon'));

    // Initially 0 of 3 exercises completed (0%)
    expect(screen.getByTestId('progress-text')).toHaveTextContent('0 of 3 exercises completed (0%)');

    // Check first exercise
    fireEvent.click(screen.getByTestId('exercise-check-0'));
    expect(screen.getByTestId('progress-text')).toHaveTextContent('1 of 3 exercises completed (33%)');

    // Check second exercise
    fireEvent.click(screen.getByTestId('exercise-check-1'));
    expect(screen.getByTestId('progress-text')).toHaveTextContent('2 of 3 exercises completed (67%)');

    // Uncheck first exercise
    fireEvent.click(screen.getByTestId('exercise-check-0'));
    expect(screen.getByTestId('progress-text')).toHaveTextContent('1 of 3 exercises completed (33%)');
  });

  it('shows rest day empty state on days with no scheduled routine', async () => {
    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    // Click Tuesday tab (no plan configured)
    fireEvent.click(screen.getByTestId('weekday-tab-tue'));

    expect(screen.getByTestId('rest-day-state')).toBeInTheDocument();
    expect(screen.getByText('Rest & Recovery Day')).toBeInTheDocument();
    expect(screen.getByText(/Wednesday — Pull Day - Back & Biceps/i)).toBeInTheDocument();
  });

  it('distinguishes no assigned workout plan from a scheduled rest day', async () => {
    vi.spyOn(workoutService, 'getWorkoutPlans').mockResolvedValueOnce([]);

    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('no-plan-state')).toBeInTheDocument();
    expect(screen.getByText('No Workout Plan Assigned')).toBeInTheDocument();
    expect(screen.queryByTestId('weekday-tab-mon')).not.toBeInTheDocument();
  });

  it('opens completion modal and records workout log', async () => {
    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('weekday-tab-mon'));

    // Check an exercise
    fireEvent.click(screen.getByTestId('exercise-check-0'));

    // Open modal
    fireEvent.click(screen.getByTestId('complete-workout-btn'));
    expect(screen.getByTestId('log-modal')).toBeInTheDocument();

    // Fill in notes
    fireEvent.change(screen.getByTestId('log-notes-input'), {
      target: { value: 'Hit a PR on bench today!' },
    });

    // Submit modal
    fireEvent.click(screen.getByTestId('submit-log-btn'));

    await waitFor(() => {
      expect(workoutService.logWorkoutCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutPlanId: 'plan-mon',
          completedExercises: ['Barbell Bench Press'],
          durationMinutes: 45,
          notes: 'Hit a PR on bench today!',
        }),
        'mock-member-token'
      );
    });

    // Success banner shown
    await waitFor(() => {
      expect(screen.getByTestId('success-banner')).toBeInTheDocument();
    });
  });

  it('displays past workout adherence logs history', async () => {
    render(<WorkoutPlanPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('workout-history-section')).toBeInTheDocument();
    expect(screen.getByText('2026-11-16')).toBeInTheDocument();
    expect(screen.getByText(/Crushed bench press, felt strong!/i)).toBeInTheDocument();
  });
});
