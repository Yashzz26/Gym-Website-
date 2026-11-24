import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InactiveMembersPage from '../pages/owner/InactiveMembersPage';
import * as memberService from '../services/memberService';

// Mock AuthContext
const mockUser = {
  uid: 'owner-test-uid',
  displayName: 'Vikram Singh',
  email: 'owner@ironcore.fit',
  getIdToken: vi.fn().mockResolvedValue('mock-owner-token'),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'owner',
  }),
}));

const mockInactiveResponse = {
  members: [
    {
      userId: 'user-201',
      fullName: 'Rajesh Khanna',
      phone: '+91 98765 43210',
      email: 'rajesh@example.com',
      avatarUrl: null,
      activeMembershipId: 'mem-201',
      planName: 'Annual Strength Pro',
      membershipStartDate: '2026-01-10T00:00:00.000Z',
      membershipEndDate: '2027-01-10T00:00:00.000Z',
      daysLeft: 47,
      lastCheckIn: '2026-10-30T07:15:00.000Z',
      lastCheckInDate: '2026-10-30',
      daysAbsent: 25,
      urgency: 'critical',
      neverAttended: false,
      streakDays: 0,
      lastFollowUp: null,
    },
    {
      userId: 'user-202',
      fullName: 'Anita Desai',
      phone: '+91 98765 88888',
      email: 'anita@example.com',
      avatarUrl: null,
      activeMembershipId: 'mem-202',
      planName: '3 Months Regular',
      membershipStartDate: '2026-09-01T00:00:00.000Z',
      membershipEndDate: '2026-12-01T00:00:00.000Z',
      daysLeft: 7,
      lastCheckIn: '2026-11-08T18:30:00.000Z',
      lastCheckInDate: '2026-11-08',
      daysAbsent: 16,
      urgency: 'urgent',
      neverAttended: false,
      streakDays: 0,
      lastFollowUp: {
        sentAt: '2026-11-20T10:00:00.000Z',
        channel: 'whatsapp',
        notes: 'Sent check-in message',
      },
    },
    {
      userId: 'user-203',
      fullName: 'Kabir Mehta',
      phone: '+91 98765 99999',
      email: 'kabir@example.com',
      avatarUrl: null,
      activeMembershipId: 'mem-203',
      planName: '1 Month Starter',
      membershipStartDate: '2026-11-14T00:00:00.000Z',
      membershipEndDate: '2026-12-14T00:00:00.000Z',
      daysLeft: 20,
      lastCheckIn: null,
      lastCheckInDate: null,
      daysAbsent: 10,
      urgency: 'moderate',
      neverAttended: true,
      streakDays: 0,
      lastFollowUp: null,
    },
  ],
  summary: {
    totalInactive: 3,
    criticalCount: 1,
    urgentCount: 1,
    moderateCount: 1,
    neverAttendedCount: 1,
  },
  total: 3,
  daysInactiveThreshold: 7,
};

describe('InactiveMembersPage (Owner Portal — Day 23 Task 46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(memberService, 'getInactiveMembers').mockResolvedValue(mockInactiveResponse);
    vi.spyOn(memberService, 'recordFollowUp').mockResolvedValue({
      logId: 'rem-new-1',
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  });

  it('renders the header, KPI metrics, and table of inactive members', async () => {
    render(<InactiveMembersPage />);

    expect(screen.getByText(/Inactive Member Watch/i)).toBeInTheDocument();

    await waitFor(() => {
      // KPI metrics
      expect(screen.getByText('Critical (21+ Days)')).toBeInTheDocument();
      expect(screen.getByText('High Risk (14-20 Days)')).toBeInTheDocument();
      expect(screen.getByText('Moderate (7-13 Days)')).toBeInTheDocument();
      expect(screen.getByText('Total Inactive')).toBeInTheDocument();
      expect(screen.getByText('1 never checked in')).toBeInTheDocument();

      // Member names
      expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
      expect(screen.getByText('Anita Desai')).toBeInTheDocument();
      expect(screen.getByText('Kabir Mehta')).toBeInTheDocument();

      // Days absent badges
      expect(screen.getByText('25 Days')).toBeInTheDocument();
      expect(screen.getByText('16 Days')).toBeInTheDocument();
      expect(screen.getByText('10 Days')).toBeInTheDocument();

      // Never attended tag
      expect(screen.getByText('Never Attended')).toBeInTheDocument();
    });
  });

  it('filters member rows when clicking urgency filter tabs', async () => {
    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
    });

    // Click 'Critical 21+ Days' tab
    const criticalTab = screen.getByRole('tab', { name: /Critical 21\+ Days/i });
    fireEvent.click(criticalTab);

    expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
    expect(screen.queryByText('Anita Desai')).not.toBeInTheDocument();
    expect(screen.queryByText('Kabir Mehta')).not.toBeInTheDocument();

    // Click 'Never Attended' tab
    const neverTab = screen.getByRole('tab', { name: /Never Attended/i });
    fireEvent.click(neverTab);

    expect(screen.queryByText('Rajesh Khanna')).not.toBeInTheDocument();
    expect(screen.queryByText('Anita Desai')).not.toBeInTheDocument();
    expect(screen.getByText('Kabir Mehta')).toBeInTheDocument();
  });

  it('filters members based on search input query', async () => {
    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name, phone, email, or plan/i);
    fireEvent.change(searchInput, { target: { value: 'Anita' } });

    expect(screen.getByText('Anita Desai')).toBeInTheDocument();
    expect(screen.queryByText('Rajesh Khanna')).not.toBeInTheDocument();
    expect(screen.queryByText('Kabir Mehta')).not.toBeInTheDocument();
  });

  it('opens follow-up modal and records outreach communication', async () => {
    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
    });

    // Click "Log Outreach" for Rajesh Khanna
    const outreachBtns = screen.getAllByRole('button', { name: /Log outreach for/i });
    fireEvent.click(outreachBtns[0]);

    // Modal dialog is opened
    expect(screen.getByText(/Log Retention Outreach/i)).toBeInTheDocument();
    expect(screen.getAllByText(/25 days absent/i).length).toBeGreaterThanOrEqual(1);

    // Verify WhatsApp template copy is visible
    expect(
      screen.getByText(/Approved Template: ironcore_inactive_member_checkin/i)
    ).toBeInTheDocument();

    // Submit the outreach form
    const submitBtn = screen.getByRole('button', { name: /Log & Complete Outreach/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(memberService.recordFollowUp).toHaveBeenCalledWith(
        'user-201',
        expect.objectContaining({
          channel: 'whatsapp',
        }),
        'mock-owner-token'
      );
      expect(screen.getByText(/Outreach recorded for Rajesh Khanna/i)).toBeInTheDocument();
    });
  });

  it('opens bulk outreach modal and submits broadcast for reachable members', async () => {
    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText('Rajesh Khanna')).toBeInTheDocument();
    });

    // Click Bulk Retention Outreach button in header
    const bulkBtn = screen.getByRole('button', { name: /Bulk Retention Outreach/i });
    fireEvent.click(bulkBtn);

    expect(screen.getByText(/Broadcast Retention Outreach/i)).toBeInTheDocument();
    expect(screen.getByText(/Batch follow-up for 3 members/i)).toBeInTheDocument();

    // Click submit in modal
    const confirmBtn = screen.getByRole('button', { name: /Record Batch Outreach/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(memberService.recordFollowUp).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/Batch outreach logged for 3 inactive members/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when zero inactive members exist', async () => {
    vi.spyOn(memberService, 'getInactiveMembers').mockResolvedValue({
      members: [],
      summary: {
        totalInactive: 0,
        criticalCount: 0,
        urgentCount: 0,
        moderateCount: 0,
        neverAttendedCount: 0,
      },
      total: 0,
      daysInactiveThreshold: 7,
    });

    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Zero Inactive Members Detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/All active members have attended gym sessions/i)
      ).toBeInTheDocument();
    });
  });

  it('renders error state and retry button on fetch failure', async () => {
    vi.spyOn(memberService, 'getInactiveMembers').mockRejectedValue(
      new Error('Firestore connection timeout')
    );

    render(<InactiveMembersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Inactive Members/i)).toBeInTheDocument();
      expect(screen.getByText('Firestore connection timeout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });
  });
});
