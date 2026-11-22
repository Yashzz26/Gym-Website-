import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DietPlanPage from '../pages/trainer/DietPlanPage';
import MemberDietPage from '../pages/member/MemberDietPage';
import * as trainerService from '../services/trainerService';
import * as dietService from '../services/dietService';

const mockTrainerUser = {
  uid: 'trainer-001',
  displayName: 'Coach Vikram',
  email: 'vikram@fitmax.com',
  getIdToken: vi.fn().mockResolvedValue('mock-trainer-token'),
};

const mockMemberUser = {
  uid: 'member-101',
  displayName: 'Aman Verma',
  email: 'aman@example.com',
  getIdToken: vi.fn().mockResolvedValue('mock-member-token'),
};

let currentMockUser = mockTrainerUser;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    role: currentMockUser.uid === 'trainer-001' ? 'trainer' : 'member',
  }),
}));

const mockAssignedMembers = [
  {
    assignmentId: 'assign-1',
    memberId: 'member-101',
    displayName: 'Aman Verma',
    fitnessGoal: 'Muscle Gain',
    currentWeightKg: 78.5,
    targetWeightKg: 75.0,
  },
  {
    assignmentId: 'assign-2',
    memberId: 'member-102',
    displayName: 'Pooja Singh',
    fitnessGoal: 'Fat Loss',
    currentWeightKg: 68.0,
    targetWeightKg: 60.0,
  },
];

const mockDietPlan = {
  id: 'diet-001',
  memberId: 'member-101',
  trainerId: 'trainer-001',
  trainerName: 'Vikram Singh',
  title: 'Lean Muscle Hypertrophy',
  targetCalories: 2650,
  macros: {
    protein: 190,
    carbs: 290,
    fat: 65,
    fiber: 35,
  },
  waterIntakeLiters: 4,
  notes: 'Take whey immediately post-workout with water.',
  meals: [
    {
      name: 'Breakfast',
      time: '08:30 AM',
      targetCalories: 650,
      items: [
        { name: 'Oatmeal & Whey', quantity: '80g oats + 1 scoop', calories: 420, protein: 30, carbs: 60, fat: 6 },
        { name: 'Almonds', quantity: '15 nuts', calories: 100, protein: 4, carbs: 3, fat: 9 },
      ],
    },
    {
      name: 'Lunch',
      time: '01:30 PM',
      targetCalories: 850,
      items: [
        { name: 'Grilled Chicken & Rice', quantity: '200g chicken + 150g rice', calories: 600, protein: 55, carbs: 65, fat: 8 },
      ],
    },
  ],
  isActive: true,
};

describe('Diet Plan Interfaces (Day 21 Task 42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = mockTrainerUser;
    vi.spyOn(trainerService, 'getAssignedMembers').mockResolvedValue(mockAssignedMembers);
    vi.spyOn(dietService, 'getMemberActiveDietPlan').mockResolvedValue(mockDietPlan);
    vi.spyOn(dietService, 'createDietPlan').mockImplementation(async (payload) => ({
      id: 'diet-new-123',
      ...payload,
    }));
    vi.spyOn(dietService, 'updateDietPlan').mockImplementation(async (id, payload) => ({
      id,
      ...payload,
    }));
  });

  describe('Trainer Diet Editor (DietPlanPage)', () => {
    it('renders header, member select, and loads assigned members', async () => {
      render(<DietPlanPage />);

      expect(screen.getByText('Nutrition & Diet Plan Builder')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('member-select')).toBeInTheDocument();
      });

      expect(screen.getByText(/Aman Verma/i)).toBeInTheDocument();
      expect(screen.getByText(/Pooja Singh/i)).toBeInTheDocument();
    });

    it('populates existing active diet plan fields for selected member', async () => {
      render(<DietPlanPage />);

      await waitFor(() => {
        expect(screen.getByTestId('plan-title-input')).toHaveValue('Lean Muscle Hypertrophy');
      });

      expect(screen.getByTestId('target-calories-input')).toHaveValue(2650);
      expect(screen.getByTestId('protein-input')).toHaveValue(190);
      expect(screen.getByTestId('carbs-input')).toHaveValue(290);
      expect(screen.getByTestId('fat-input')).toHaveValue(65);
      expect(screen.getByTestId('water-input')).toHaveValue(4);
    });

    it('allows editing macros and submitting updated diet plan', async () => {
      render(<DietPlanPage />);

      await waitFor(() => {
        expect(screen.getByTestId('plan-title-input')).toHaveValue('Lean Muscle Hypertrophy');
      });

      // Update target calories
      fireEvent.change(screen.getByTestId('target-calories-input'), {
        target: { value: '2800' },
      });

      // Update protein
      fireEvent.change(screen.getByTestId('protein-input'), {
        target: { value: '200' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('save-diet-plan-btn'));

      await waitFor(() => {
        expect(dietService.updateDietPlan).toHaveBeenCalledWith(
          'diet-001',
          expect.objectContaining({
            memberId: 'member-101',
            targetCalories: 2800,
            macros: expect.objectContaining({ protein: 200 }),
          }),
          'mock-trainer-token'
        );
      });

      expect(await screen.findByTestId('success-banner')).toBeInTheDocument();
    });

    it('can add a new meal to the schedule', async () => {
      render(<DietPlanPage />);

      await waitFor(() => {
        expect(screen.getByTestId('add-meal-btn')).toBeInTheDocument();
      });

      const initialMealsCount = screen.getAllByTestId(/meal-block-/).length;

      fireEvent.click(screen.getByTestId('add-meal-btn'));

      const updatedMealsCount = screen.getAllByTestId(/meal-block-/).length;
      expect(updatedMealsCount).toBe(initialMealsCount + 1);
    });
  });

  describe('Member Diet View (MemberDietPage)', () => {
    beforeEach(() => {
      currentMockUser = mockMemberUser;
    });

    it('displays active diet plan with calories, water intake, macros, and meals', async () => {
      render(<MemberDietPage />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-diet-state')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('member-diet-page')).toBeInTheDocument();
      expect(screen.getByText('Lean Muscle Hypertrophy')).toBeInTheDocument();
      expect(screen.getByText(/Coach Vikram Singh/i)).toBeInTheDocument();

      // Metrics
      expect(screen.getByTestId('target-calories-val')).toHaveTextContent('2,650');
      expect(screen.getByTestId('target-water-val')).toHaveTextContent('4 L');

      // Macros
      expect(screen.getByTestId('macro-protein-val')).toHaveTextContent('190g');
      expect(screen.getByTestId('macro-carbs-val')).toHaveTextContent('290g');
      expect(screen.getByTestId('macro-fat-val')).toHaveTextContent('65g');

      // Meals
      expect(screen.getByText('Breakfast')).toBeInTheDocument();
      expect(screen.getByText('Oatmeal & Whey')).toBeInTheDocument();
      expect(screen.getByText('Lunch')).toBeInTheDocument();
      expect(screen.getByText('Grilled Chicken & Rice')).toBeInTheDocument();
    });

    it('shows empty state when member has no active diet plan', async () => {
      vi.spyOn(dietService, 'getMemberActiveDietPlan').mockResolvedValue(null);

      render(<MemberDietPage />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-diet-state')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('empty-diet-state')).toBeInTheDocument();
      expect(screen.getByText('No Active Diet Plan Yet')).toBeInTheDocument();
    });
  });
});
