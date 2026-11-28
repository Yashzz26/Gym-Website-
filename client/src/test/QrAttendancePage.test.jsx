/**
 * test/QrAttendancePage.test.jsx — Tests for Member QR Scanner, Attendance History & Streak (Day 17-18 Tasks 33 & 35)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QrAttendancePage from '../pages/member/QrAttendancePage';
import { AuthContext } from '../context/AuthContext';
import * as attendanceService from '../services/attendanceService';
import * as memberService from '../services/memberService';

// Mock network calls of attendanceService while preserving utility calculations
vi.mock('../services/attendanceService', async () => {
  const actual = await vi.importActual('../services/attendanceService');
  return {
    ...actual,
    checkInAttendance: vi.fn(),
    getMyAttendance: vi.fn(),
  };
});

vi.mock('../services/memberService', () => ({
  getMyMembership: vi.fn(),
}));

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

describe('QrAttendancePage — Member QR Scanner & Attendance History (Day 18 Task 35)', () => {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const twoDaysAgoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  );

  const mockHistoryRecords = [
    {
      attendanceId: 'att-1',
      date: todayStr,
      timestamp: `${todayStr}T08:30:00.000Z`,
      session: 'Morning Session',
      streakDays: 3,
      gymId: 'fitmax-main',
    },
    {
      attendanceId: 'att-2',
      date: yesterdayStr,
      timestamp: `${yesterdayStr}T17:45:00.000Z`,
      session: 'Evening Session',
      streakDays: 2,
      gymId: 'fitmax-main',
    },
    {
      attendanceId: 'att-3',
      date: twoDaysAgoStr,
      timestamp: `${twoDaysAgoStr}T09:15:00.000Z`,
      session: 'Morning Session',
      streakDays: 1,
      gymId: 'fitmax-main',
    },
  ];

  const mockCheckInSuccess = {
    checkInId: 'chk-12345',
    memberId: 'member-123',
    memberName: 'Alex Rider',
    timestamp: new Date().toISOString(),
    session: 'Morning Session',
    streakDays: 4,
    gymId: 'fitmax-main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    attendanceService.checkInAttendance.mockResolvedValue(mockCheckInSuccess);
    attendanceService.getMyAttendance.mockResolvedValue(mockHistoryRecords);
    memberService.getMyMembership.mockResolvedValue({
      status: 'active',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isExpired: false,
    });
  });

  it('marks dates prior to membership activation as Pre-plan instead of Missed', async () => {
    attendanceService.getMyAttendance.mockResolvedValueOnce([]);
    memberService.getMyMembership.mockResolvedValueOnce({
      status: 'active',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
      isExpired: false,
    });

    renderWithAuth(<QrAttendancePage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pre-plan').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('Missed')).not.toBeInTheDocument();
  });

  it('renders branding header, streak summary stats and weekly calendar', async () => {
    renderWithAuth(<QrAttendancePage />);

    expect(screen.getByText(/Gym Attendance & Streak/i)).toBeInTheDocument();
    expect(screen.getByText(/Member Check-In/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Streak/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Attendance/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Workouts/i)).toBeInTheDocument();

    // Verify 7 calendar day columns render
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('calculates streak from server records and displays on streak card', async () => {
    renderWithAuth(<QrAttendancePage />);

    await waitFor(() => {
      expect(attendanceService.getMyAttendance).toHaveBeenCalledTimes(1);
      const streakCard = screen.getByText(/Current Streak/i).closest('.stat-card');
      expect(streakCard).toHaveTextContent('3');
    });
  });

  it('does not request camera on mount and starts scanner only after clicking Start QR Scanner', async () => {
    renderWithAuth(<QrAttendancePage />);

    const startBtn = screen.getByRole('button', { name: /start qr scanner/i });
    expect(startBtn).toBeInTheDocument();
    expect(mockStart).not.toHaveBeenCalled();

    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /stop scanner/i })).toBeInTheDocument();
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
      expect(screen.getByText(/Check-in confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/Alex Rider/i)).toBeInTheDocument();
      expect(screen.getByText(/Atomic Verified/i)).toBeInTheDocument();
    });
  });

  it('switches to Attendance History tab and displays check-in history list', async () => {
    renderWithAuth(<QrAttendancePage />);

    // Click on Attendance History tab
    const historyTabBtn = screen.getByRole('button', { name: /attendance history/i });
    fireEvent.click(historyTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Workout Check-In History/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified timestamps recorded at IRONCORE entrance gateway/i)).toBeInTheDocument();
      expect(screen.getByText(/Streak Day 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Streak Day 2/i)).toBeInTheDocument();
    });
  });

  it('handles camera permission denied with clear instructions', async () => {
    const permError = new Error('Permission denied');
    permError.name = 'NotAllowedError';
    mockStart.mockRejectedValueOnce(permError);

    renderWithAuth(<QrAttendancePage />);

    fireEvent.click(screen.getByRole('button', { name: /start qr scanner/i }));

    await waitFor(() => {
      expect(screen.getByText(/Camera Permission Denied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request permission again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use manual entry/i })).toBeInTheDocument();
    });
  });

  it('displays error message when check-in API rejects with duplicate code', async () => {
    attendanceService.checkInAttendance.mockRejectedValueOnce(
      new Error('Attendance already recorded today for this member')
    );

    renderWithAuth(<QrAttendancePage />);

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
});
