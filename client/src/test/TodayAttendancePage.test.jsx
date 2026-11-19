import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodayAttendancePage from '../pages/reception/TodayAttendancePage';
import * as attendanceService from '../services/attendanceService';

// Mock AuthContext with stable user reference
const mockUser = {
  uid: 'staff-reception-1',
  displayName: 'Receptionist Sunita',
  email: 'reception@fitmax.com',
  getIdToken: vi.fn().mockResolvedValue('mock-staff-token'),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'reception',
  }),
}));

const mockRecords = [
  {
    id: 'att-1',
    attendanceId: 'att-1',
    userId: 'user-101',
    memberName: 'Aman Sharma',
    memberEmail: 'aman@example.com',
    gymId: 'fitmax-main',
    session: 'Morning Session',
    timestamp: '2026-11-19T06:45:00.000Z',
    date: '2026-11-19',
    streakDays: 5,
    planName: 'Annual Pro',
    method: 'qr',
  },
  {
    id: 'att-2',
    attendanceId: 'att-2',
    userId: 'user-102',
    memberName: 'Pooja Verma',
    memberEmail: 'pooja@example.com',
    gymId: 'fitmax-main',
    session: 'Morning Session',
    timestamp: '2026-11-19T07:15:00.000Z',
    date: '2026-11-19',
    streakDays: 12,
    planName: 'Quarterly Gold',
    method: 'qr',
  },
  {
    id: 'att-3',
    attendanceId: 'att-3',
    userId: 'user-103',
    memberName: 'Rahul Mehta',
    memberEmail: 'rahul@example.com',
    gymId: 'fitmax-main',
    session: 'Evening Session',
    timestamp: '2026-11-19T17:30:00.000Z',
    date: '2026-11-19',
    streakDays: 3,
    planName: 'Monthly Standard',
    method: 'qr',
  },
];

const mockTodayData = {
  date: '2026-11-19',
  gymId: 'fitmax-main',
  totalCount: 3,
  morningCount: 2,
  eveningCount: 1,
  generalCount: 0,
  records: mockRecords,
};

describe("TodayAttendancePage — Reception Daily Attendance Screen (Day 18 Task 36)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders branding header, KPI summary cards and controls', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockResolvedValue(mockTodayData);

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Daily Attendance Screen/i)).toBeInTheDocument();
    expect(screen.getByText(/Reception Desk/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Check-ins/i)).toBeInTheDocument();
    expect(screen.getByText(/Morning Session/i)).toBeInTheDocument();
    expect(screen.getByText(/Evening Session/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Entrance QR/i })).toBeInTheDocument();

    // Verify KPI values loaded
    await waitFor(() => {
      expect(screen.getByTestId('total-count')).toHaveTextContent('3');
      expect(screen.getByTestId('morning-count')).toHaveTextContent('2');
      expect(screen.getByTestId('evening-count')).toHaveTextContent('1');
    });
  });

  it('displays member check-in records with names, sessions, streaks, and timestamps', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockResolvedValue(mockTodayData);

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
      expect(screen.getByText('Pooja Verma')).toBeInTheDocument();
      expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
    });

    expect(screen.getByText('aman@example.com')).toBeInTheDocument();
    expect(screen.getByText('Annual Pro')).toBeInTheDocument();
    expect(screen.getByText(/5d streak/i)).toBeInTheDocument();
    expect(screen.getByText(/12d streak/i)).toBeInTheDocument();
    expect(screen.getAllByText(/QR Verified/i).length).toBe(3);
  });

  it('filters member records by search input query', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockResolvedValue(mockTodayData);

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by member name/i);
    fireEvent.change(searchInput, { target: { value: 'Pooja' } });

    expect(screen.getByText('Pooja Verma')).toBeInTheDocument();
    expect(screen.queryByText('Aman Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('Rahul Mehta')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
  });

  it('filters member records by session tab (Morning vs Evening)', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockResolvedValue(mockTodayData);

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
      expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
    });

    // Switch to Morning session tab
    const morningTab = screen.getByRole('tab', { name: /Morning \(2\)/i });
    fireEvent.click(morningTab);

    expect(screen.getByText('Aman Sharma')).toBeInTheDocument();
    expect(screen.getByText('Pooja Verma')).toBeInTheDocument();
    expect(screen.queryByText('Rahul Mehta')).not.toBeInTheDocument();

    // Switch to Evening session tab
    const eveningTab = screen.getByRole('tab', { name: /Evening \(1\)/i });
    fireEvent.click(eveningTab);

    expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
    expect(screen.queryByText('Aman Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('Pooja Verma')).not.toBeInTheDocument();
  });

  it('renders empty state when no check-in records exist for the date', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockResolvedValue({
      date: '2026-11-19',
      gymId: 'fitmax-main',
      totalCount: 0,
      morningCount: 0,
      eveningCount: 0,
      generalCount: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No Check-ins Recorded/i)).toBeInTheDocument();
    });
  });

  it('renders error banner and retry button when backend call fails', async () => {
    vi.spyOn(attendanceService, 'getTodayAttendance').mockRejectedValue(
      new Error('Failed to connect to attendance service')
    );

    render(
      <MemoryRouter>
        <TodayAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to connect to attendance service/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
