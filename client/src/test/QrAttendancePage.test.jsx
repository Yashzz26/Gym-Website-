/**
 * test/QrAttendancePage.test.jsx — Tests for Member QR Scanner & Check-in (Day 17 Task 33)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QrAttendancePage from '../pages/member/QrAttendancePage';
import { AuthContext } from '../context/AuthContext';
import * as attendanceService from '../services/attendanceService';

// Mock attendanceService
vi.mock('../services/attendanceService');

// Mock html5-qrcode
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn().mockResolvedValue(undefined);

vi.mock('html5-qrcode', () => {
  class MockHtml5Qrcode {
    constructor(elementId) {
      this.elementId = elementId;
      this.isScanning = true;
    }
    start = mockStart;
    stop = mockStop;
    clear = mockClear;
  }
  return {
    Html5Qrcode: MockHtml5Qrcode,
  };
});

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: {
      uid: 'member-123',
      email: 'member@fitmax.com',
      displayName: 'Alex Rider',
      getIdToken: () => Promise.resolve('mock-firebase-token'),
    },
    profile: {
      role: 'member',
      approvalStatus: 'active',
      displayName: 'Alex Rider',
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

describe('QrAttendancePage — Member QR Scanner (Day 17 Task 33)', () => {
  const mockCheckInSuccess = {
    checkInId: 'chk-12345',
    memberId: 'member-123',
    memberName: 'Alex Rider',
    timestamp: '2026-11-18T08:30:00.000Z',
    session: 'Morning Session',
    streakDays: 5,
    gymId: 'fitmax-main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    attendanceService.checkInAttendance.mockResolvedValue(mockCheckInSuccess);
  });

  it('renders branding header, session badge, and scanner controls', async () => {
    renderWithAuth(<QrAttendancePage />);

    expect(screen.getByText(/Gym Entrance Scanner/i)).toBeInTheDocument();
    expect(screen.getByText(/Member Check-In/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /camera viewfinder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual token entry/i })).toBeInTheDocument();
  });

  it('initializes Html5Qrcode camera scanner on mount', async () => {
    renderWithAuth(<QrAttendancePage />);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  it('allows manual token submission and displays confirmed check-in with streak', async () => {
    renderWithAuth(<QrAttendancePage />);

    const manualTab = screen.getByRole('button', { name: /manual token entry/i });
    fireEvent.click(manualTab);

    expect(screen.getByLabelText(/gym qr token payload/i)).toBeInTheDocument();

    const textarea = screen.getByLabelText(/gym qr token payload/i);
    fireEvent.change(textarea, {
      target: { value: 'eyJneW1JZCI6ImZpdG1heC1tYWluIn0.validSignature123' },
    });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(attendanceService.checkInAttendance).toHaveBeenCalledWith(
        'eyJneW1JZCI6ImZpdG1heC1tYWluIn0.validSignature123',
        'mock-firebase-token'
      );
      expect(screen.getByText(/Check-In Confirmed!/i)).toBeInTheDocument();
      expect(screen.getByText(/Alex Rider/i)).toBeInTheDocument();
      expect(screen.getByText(/5 Days Active 🔥/i)).toBeInTheDocument();
      expect(screen.getByText(/Atomic Verified/i)).toBeInTheDocument();
    });
  });

  it('handles camera permission denied with clear instructions', async () => {
    const permError = new Error('Permission denied');
    permError.name = 'NotAllowedError';
    mockStart.mockRejectedValueOnce(permError);

    renderWithAuth(<QrAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText(/Camera Permission Denied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request permission again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use manual entry/i })).toBeInTheDocument();
    });
  });

  it('displays error message when check-in API rejects with duplicate or expired code', async () => {
    attendanceService.checkInAttendance.mockRejectedValueOnce(
      new Error('Attendance already recorded today for this member')
    );

    renderWithAuth(<QrAttendancePage />);

    // Switch to manual mode for predictable triggering
    fireEvent.click(screen.getByRole('button', { name: /manual token entry/i }));

    const textarea = screen.getByLabelText(/gym qr token payload/i);
    fireEvent.change(textarea, { target: { value: 'expired.token.data' } });

    fireEvent.click(screen.getByRole('button', { name: /verify & check in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Attendance already recorded today for this member/i)
      ).toBeInTheDocument();
    });
  });

  it('resets check-in state when clicking Scan Another', async () => {
    renderWithAuth(<QrAttendancePage />);

    fireEvent.click(screen.getByRole('button', { name: /manual token entry/i }));
    fireEvent.change(screen.getByLabelText(/gym qr token payload/i), {
      target: { value: 'some.valid.token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify & check in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Check-In Confirmed!/i)).toBeInTheDocument();
    });

    const scanAnotherBtn = screen.getByRole('button', { name: /scan another/i });
    fireEvent.click(scanAnotherBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Check-In Confirmed!/i)).not.toBeInTheDocument();
    });
  });
});
