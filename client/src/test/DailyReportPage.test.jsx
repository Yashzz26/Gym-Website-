import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DailyReportPage from '../pages/owner/DailyReportPage';
import * as reportService from '../services/reportService';

vi.mock('../services/reportService', () => ({
  fetchDailyReport: vi.fn(),
  fetchWeeklyReport: vi.fn(),
  fetchReportExport: vi.fn(),
  downloadCsv: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'owner-uid-1',
      displayName: 'Gym Owner',
      getIdToken: vi.fn().mockResolvedValue('mock-owner-token'),
    },
    profile: {
      displayName: 'Gym Owner',
      role: 'owner',
      approvalStatus: 'active',
    },
    isAuthenticated: true,
  }),
}));

// Mock ResponsiveContainer to avoid 0 width/height errors in jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => (
      <div data-testid="mock-responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const mockDailyData = {
  date: '2026-11-27',
  gymId: 'fitmax-main',
  revenue: {
    totalRupees: 6500,
    totalPaise: 650000,
    transactionsCount: 3,
    breakdown: {
      cash: { rupees: 1500, count: 1, percentage: 23 },
      upi: { rupees: 3000, count: 1, percentage: 46 },
      online: { rupees: 2000, count: 1, percentage: 31 },
    },
  },
  attendance: {
    totalCheckIns: 42,
    uniqueMembers: 40,
    morningCheckIns: 24,
    eveningCheckIns: 18,
  },
  members: {
    newMembersCount: 3,
    renewalsCount: 5,
  },
  pendingDues: {
    count: 2,
    totalRupees: 2998,
    items: [
      {
        paymentId: 'pay-due-1',
        memberName: 'Rahul Verma',
        email: 'rahul@example.com',
        planName: '1 Month Starter',
        amountRupees: 1499,
        status: 'pending',
      },
    ],
  },
  upcomingRenewals: {
    count: 1,
    projectedRevenueRupees: 3999,
    notice: 'Memberships expiring within 7 days shown as upcoming renewals, not automatically as overdue debt.',
    items: [
      {
        membershipId: 'mem-exp-1',
        userName: 'Aakash Sharma',
        userEmail: 'aakash@example.com',
        planName: '3 Months Pro',
        daysRemaining: 2,
        renewalPriceRupees: 3999,
      },
    ],
  },
};

const mockWeeklyData = {
  startDate: '2026-11-21',
  endDate: '2026-11-27',
  daysCount: 7,
  summary: {
    totalRevenueRupees: 45000,
    averageDailyRevenueRupees: 6428,
    cashRupees: 12000,
    cashPercentage: 27,
    upiRupees: 25000,
    upiPercentage: 56,
    onlineRupees: 8000,
    onlinePercentage: 17,
    totalCheckIns: 280,
    averageDailyCheckIns: 40,
    totalNewMembers: 15,
    totalRenewals: 22,
    pendingDuesCount: 2,
    pendingDuesRupees: 2998,
    upcomingRenewalsCount: 1,
    projectedUpcomingRenewalRupees: 3999,
  },
  dailyTrend: [
    {
      date: '2026-11-21',
      dayName: 'Sat',
      revenueRupees: 7000,
      cashRupees: 2000,
      upiRupees: 4000,
      checkIns: 45,
      morningCheckIns: 25,
      eveningCheckIns: 20,
      newMembers: 2,
      renewals: 3,
    },
    {
      date: '2026-11-27',
      dayName: 'Fri',
      revenueRupees: 6500,
      cashRupees: 1500,
      upiRupees: 3000,
      checkIns: 42,
      morningCheckIns: 24,
      eveningCheckIns: 18,
      newMembers: 3,
      renewals: 5,
    },
  ],
};

describe('DailyReportPage — Owner Analytics Dashboard (Day 26 Task 52)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportService.fetchDailyReport.mockResolvedValue(mockDailyData);
    reportService.fetchWeeklyReport.mockResolvedValue(mockWeeklyData);
  });

  const renderPage = async () => {
    let result;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <DailyReportPage />
        </MemoryRouter>
      );
    });
    return result;
  };

  it('renders dashboard with daily summary KPIs and real API data', async () => {
    await renderPage();

    expect(screen.getByTestId('owner-reports-dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Owner Analytics & Reports/i)).toBeInTheDocument();

    // KPI values
    expect(screen.getByTestId('kpi-total-revenue')).toHaveTextContent('6,500');
    expect(screen.getByTestId('kpi-attendance')).toHaveTextContent('42');
    expect(screen.getByTestId('kpi-members')).toHaveTextContent('8'); // 3 + 5
  });

  it('separates pending unpaid dues from upcoming 7-day renewals', async () => {
    await renderPage();

    // Pending dues section
    const duesPanel = screen.getByTestId('panel-pending-dues');
    expect(duesPanel).toBeInTheDocument();
    expect(duesPanel).toHaveTextContent('Pending Unpaid Dues');
    expect(duesPanel).toHaveTextContent('Rahul Verma');
    expect(duesPanel).toHaveTextContent('1,499');

    // Upcoming renewals section (NOT debt)
    const renewalsPanel = screen.getByTestId('panel-upcoming-renewals');
    expect(renewalsPanel).toBeInTheDocument();
    expect(renewalsPanel).toHaveTextContent('Upcoming 7-Day Renewals');
    expect(renewalsPanel).toHaveTextContent('Aakash Sharma');
    expect(renewalsPanel).toHaveTextContent('3,999');
    expect(renewalsPanel).toHaveTextContent('not automatically as overdue debt');
  });

  it('switches to weekly rolling trends view and renders attendance chart', async () => {
    await renderPage();

    const weeklyTab = screen.getByRole('button', { name: /Weekly Rolling Trends/i });
    await act(async () => {
      fireEvent.click(weeklyTab);
    });

    expect(screen.getByTestId('weekly-attendance-chart')).toBeInTheDocument();
    expect(screen.getByText(/Weekly Attendance Trends by Session/i)).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
  });

  it('triggers CSV download when Export CSV button is clicked', async () => {
    reportService.fetchReportExport.mockResolvedValue({
      filename: 'ironcore_daily_report_2026-11-27.csv',
      headers: ['Metric', 'Value'],
      rows: [['Total Revenue', '6500']],
    });

    await renderPage();

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await waitFor(() => {
      expect(reportService.fetchReportExport).toHaveBeenCalled();
      expect(reportService.downloadCsv).toHaveBeenCalledWith(
        'ironcore_daily_report_2026-11-27.csv',
        ['Metric', 'Value'],
        [['Total Revenue', '6500']]
      );
    });
  });

  it('displays error banner and offers retry on API failure', async () => {
    reportService.fetchDailyReport.mockRejectedValue(new Error('Network connectivity issue'));
    await renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(/Network connectivity issue/i);
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
