import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GymSettingsPage from '../pages/owner/GymSettingsPage';
import * as settingsService from '../services/settingsService';

vi.mock('../services/settingsService', () => ({
  getGymSettings: vi.fn(),
  updateGymSettings: vi.fn(),
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

describe('GymSettingsPage — Gym Profile & Operating Sessions', () => {
  const sampleSettings = {
    gymName: 'IronPulse Fitness Club',
    address: 'Plot 42, Commercial Main Road, Bengaluru',
    phone: '+91 98765 43210',
    email: 'contact@ironpulse.fit',
    gstin: '29ABCDE1234F1Z5',
    upiId: 'ironpulse@upi',
    timezone: 'Asia/Kolkata',
    operatingHours: {
      openingTime: '05:30',
      closingTime: '22:30',
    },
    morningSession: {
      startTime: '06:00',
      endTime: '12:00',
    },
    eveningSession: {
      startTime: '16:00',
      endTime: '22:00',
    },
    qrRefreshIntervalSeconds: 300,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService.getGymSettings.mockResolvedValue(sampleSettings);
    settingsService.updateGymSettings.mockResolvedValue(sampleSettings);
  });

  it('renders form with populated gym profile and operating sessions', async () => {
    await act(async () => {
      render(<GymSettingsPage initialData={sampleSettings} />);
    });

    expect(screen.getByDisplayValue('IronPulse Fitness Club')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ironpulse@upi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('06:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('22:00')).toBeInTheDocument();
  });

  it('submits updated settings and displays success feedback', async () => {
    settingsService.updateGymSettings.mockResolvedValueOnce({
      ...sampleSettings,
      gymName: 'Titan Force Gym',
    });

    await act(async () => {
      render(<GymSettingsPage initialData={sampleSettings} />);
    });

    const nameInput = screen.getByLabelText(/Gym Brand Name/i);
    fireEvent.change(nameInput, { target: { value: 'Titan Force Gym' } });

    const submitBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(settingsService.updateGymSettings).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/Gym profile and session operating settings updated successfully/i)
    ).toBeInTheDocument();
  });

  it('displays error alert when update fails', async () => {
    settingsService.updateGymSettings.mockRejectedValueOnce(
      new Error('Failed to update gym settings. Invalid time windows.')
    );

    await act(async () => {
      render(<GymSettingsPage initialData={sampleSettings} />);
    });

    const submitBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to update gym settings. Invalid time windows/i)
      ).toBeInTheDocument();
    });
  });
});
