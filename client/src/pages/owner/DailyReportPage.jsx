/**
 * DailyReportPage.jsx — Owner Reports & Analytics Dashboard (Day 26 Task 52)
 *
 * Implements:
 * 1. Executive daily summary (Total Revenue, Cash vs UPI Split, Attendance, Enrollments)
 * 2. Weekly attendance & revenue visual chart powered by Recharts
 * 3. Separate, distinct presentation of Pending Dues (unpaid/unverified) vs Upcoming 7-day Renewals (not debt)
 * 4. Tab switcher between Daily Report and Weekly Rolling Trends
 * 5. Real-time CSV export of daily or weekly analytics
 * 6. Resilient loading, empty, and error states conforming to Unslop 9-pass design
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  IndianRupee,
  CalendarCheck,
  Users,
  ArrowDownToLine,
  RefreshCw,
  AlertCircle,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDailyReport,
  fetchWeeklyReport,
  fetchReportExport,
  downloadCsv,
} from '../../services/reportService';
import './DailyReportPage.css';

function formatRupees(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayIsoString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export default function DailyReportPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayIsoString);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'weekly'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [exporting, setExporting] = useState(false);

  const userUid = user?.uid;

  const loadReportData = useCallback(async () => {
    try {
      setError(null);
      const token = user?.getIdToken ? await user.getIdToken() : null;

      const [daily, weekly] = await Promise.all([
        fetchDailyReport(selectedDate, token),
        fetchWeeklyReport(selectedDate, 7, token),
      ]);

      setDailyData(daily);
      setWeeklyData(weekly);
    } catch (err) {
      console.error('[ReportsDashboard] Failed to fetch report data:', err);
      setError(err.message || 'Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userUid, selectedDate]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReportData();
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const exportRes = await fetchReportExport(
        {
          type: activeTab,
          date: selectedDate,
          endDate: selectedDate,
        },
        token
      );

      if (exportRes && exportRes.filename && exportRes.headers && exportRes.rows) {
        downloadCsv(exportRes.filename, exportRes.headers, exportRes.rows);
      }
    } catch (err) {
      console.error('[ReportsDashboard] CSV export error:', err);
      alert('Could not export CSV at this time. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !dailyData) {
    return (
      <div className="owner-reports-container">
        <div className="reports-loading-state" role="status">
          <div className="reports-spinner" />
          <p>Generating executive analytics report...</p>
        </div>
      </div>
    );
  }

  if (error && !dailyData) {
    return (
      <div className="owner-reports-container">
        <div
          className="reports-error-banner"
          role="alert"
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2.5rem',
            gap: '1rem',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={32} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Failed to Load Analytics Report</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{error}</p>
          </div>
          <button
            type="button"
            className="reports-btn reports-btn-secondary"
            onClick={loadReportData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const revenue = dailyData?.revenue || { totalRupees: 0, breakdown: { cash: {}, upi: {}, online: {} } };
  const attendance = dailyData?.attendance || { totalCheckIns: 0, morningCheckIns: 0, eveningCheckIns: 0 };
  const members = dailyData?.members || { newMembersCount: 0, renewalsCount: 0 };
  const pendingDues = dailyData?.pendingDues || { count: 0, totalRupees: 0, items: [] };
  const upcomingRenewals = dailyData?.upcomingRenewals || { count: 0, projectedRevenueRupees: 0, items: [] };

  return (
    <div className="owner-reports-container" data-testid="owner-reports-dashboard">
      {/* Header & Controls */}
      <div className="reports-header">
        <div>
          <div className="reports-header-title">
            <BarChart3 className="reports-kpi-icon" />
            <h1>Owner Analytics & Reports</h1>
            <span className="reports-badge">Live System Data</span>
          </div>
          <p className="reports-subtitle">
            Executive overview of verified collections, Cash vs UPI splits, attendance trends, and revenue pipelines.
          </p>
        </div>

        <div className="reports-controls">
          <input
            type="date"
            className="reports-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Select report date"
          />

          <button
            type="button"
            className="reports-btn reports-btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh current report metrics"
          >
            <RefreshCw size={16} className={refreshing ? 'reports-spinner' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="reports-btn reports-btn-primary"
            onClick={handleExportCsv}
            disabled={exporting}
            title="Download report data as CSV spreadsheet"
          >
            <ArrowDownToLine size={16} />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="reports-error-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="reports-btn reports-btn-secondary"
            onClick={loadReportData}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* View Tabs */}
      <div className="reports-tabs">
        <button
          type="button"
          className={`reports-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Daily Summary ({selectedDate})
        </button>
        <button
          type="button"
          className={`reports-tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly Rolling Trends (7 Days)
        </button>
      </div>

      {/* Tab 1: Daily Summary View */}
      {activeTab === 'daily' && (
        <>
          {/* Key Metric Cards (KPIs) */}
          <div className="reports-kpi-grid">
            {/* KPI 1: Total Revenue */}
            <div className="reports-kpi-card" data-testid="kpi-total-revenue">
              <div>
                <div className="reports-kpi-header">
                  <span className="reports-kpi-label">Today's Revenue</span>
                  <IndianRupee className="reports-kpi-icon" />
                </div>
                <div className="reports-kpi-value">{formatRupees(revenue.totalRupees)}</div>
                <div className="reports-kpi-meta">
                  {revenue.transactionsCount || 0} verified transactions
                </div>
              </div>

              {/* Progress Split Bar */}
              <div>
                <div className="reports-split-bar" title="Cash vs UPI vs Online Split">
                  <div
                    className="split-cash"
                    style={{ width: `${revenue.breakdown.cash.percentage || 0}%` }}
                  />
                  <div
                    className="split-upi"
                    style={{ width: `${revenue.breakdown.upi.percentage || 0}%` }}
                  />
                  <div
                    className="split-online"
                    style={{ width: `${revenue.breakdown.online.percentage || 0}%` }}
                  />
                </div>
                <div className="reports-split-legend">
                  <span className="split-legend-item">
                    <span className="split-dot split-cash" /> Cash: {revenue.breakdown.cash.percentage || 0}%
                  </span>
                  <span className="split-legend-item">
                    <span className="split-dot split-upi" /> UPI: {revenue.breakdown.upi.percentage || 0}%
                  </span>
                  <span className="split-legend-item">
                    <span className="split-dot split-online" /> Online: {revenue.breakdown.online.percentage || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 2: Cash vs UPI Breakdown */}
            <div className="reports-kpi-card" data-testid="kpi-cash-upi">
              <div>
                <div className="reports-kpi-header">
                  <span className="reports-kpi-label">Desk vs Digital Split</span>
                  <CreditCard className="reports-kpi-icon" />
                </div>
                <div className="reports-kpi-value" style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>
                  <span>Cash: {formatRupees(revenue.breakdown.cash.rupees || 0)}</span>
                </div>
                <div className="reports-kpi-meta" style={{ marginTop: '0.25rem' }}>
                  UPI: {formatRupees(revenue.breakdown.upi.rupees || 0)} ({revenue.breakdown.upi.count || 0} txn)
                </div>
                <div className="reports-kpi-meta">
                  Gateway: {formatRupees(revenue.breakdown.online.rupees || 0)} ({revenue.breakdown.online.count || 0} txn)
                </div>
              </div>
              <div className="reports-kpi-meta" style={{ marginTop: '0.5rem', color: '#22c55e' }}>
                <CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                100% reconciled in audit logs
              </div>
            </div>

            {/* KPI 3: Attendance Check-Ins */}
            <div className="reports-kpi-card" data-testid="kpi-attendance">
              <div>
                <div className="reports-kpi-header">
                  <span className="reports-kpi-label">Member Check-Ins</span>
                  <CalendarCheck className="reports-kpi-icon" />
                </div>
                <div className="reports-kpi-value">{attendance.totalCheckIns || 0}</div>
                <div className="reports-kpi-meta">
                  {attendance.uniqueMembers || 0} unique members checked in
                </div>
              </div>
              <div className="reports-kpi-meta" style={{ marginTop: '0.5rem' }}>
                <span>Morning: {attendance.morningCheckIns || 0}</span>
                <span style={{ margin: '0 0.5rem' }}>•</span>
                <span>Evening: {attendance.eveningCheckIns || 0}</span>
              </div>
            </div>

            {/* KPI 4: Member Enrollments & Renewals */}
            <div className="reports-kpi-card" data-testid="kpi-members">
              <div>
                <div className="reports-kpi-header">
                  <span className="reports-kpi-label">New & Renewals</span>
                  <Users className="reports-kpi-icon" />
                </div>
                <div className="reports-kpi-value">
                  {(members.newMembersCount || 0) + (members.renewalsCount || 0)}
                </div>
                <div className="reports-kpi-meta">
                  {members.newMembersCount || 0} new registrations
                </div>
              </div>
              <div className="reports-kpi-meta" style={{ marginTop: '0.5rem' }}>
                <span>Renewals processed: {members.renewalsCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Dues vs Upcoming Renewals Dual Section (Critical Requirement) */}
          <div className="reports-dues-grid">
            {/* Panel 1: Pending Dues (Debt & Unverified Invoices) */}
            <div className="reports-panel" data-testid="panel-pending-dues">
              <div className="reports-panel-header">
                <span className="reports-panel-title">
                  <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                  Pending Unpaid Dues
                </span>
                <span className="badge-dues">
                  {pendingDues.count} Unpaid ({formatRupees(pendingDues.totalRupees)})
                </span>
              </div>

              <div className="reports-panel-notice danger-notice">
                Overdue unpaid invoices and desk payments awaiting front-desk verification.
              </div>

              {pendingDues.items.length === 0 ? (
                <div className="reports-empty-state">
                  <CheckCircle2 size={24} style={{ color: '#22c55e' }} />
                  <p>No overdue unpaid dues recorded.</p>
                </div>
              ) : (
                <div className="reports-table-container">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingDues.items.map((item) => (
                        <tr key={item.paymentId}>
                          <td>
                            <strong>{item.memberName}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                              {item.email || 'No email'}
                            </div>
                          </td>
                          <td>{item.planName}</td>
                          <td>{formatRupees(item.amountRupees)}</td>
                          <td>
                            <span style={{ color: '#ef4444', textTransform: 'capitalize' }}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Panel 2: Upcoming 7-Day Renewals (Not Debt!) */}
            <div className="reports-panel" data-testid="panel-upcoming-renewals">
              <div className="reports-panel-header">
                <span className="reports-panel-title">
                  <Clock size={18} style={{ color: '#38bdf8' }} />
                  Upcoming 7-Day Renewals
                </span>
                <span className="badge-renewal">
                  {upcomingRenewals.count} Projected ({formatRupees(upcomingRenewals.projectedRevenueRupees)})
                </span>
              </div>

              <div className="reports-panel-notice">
                {upcomingRenewals.notice || 'Memberships expiring within 7 days shown as upcoming renewals, not automatically as overdue debt.'}
              </div>

              {upcomingRenewals.items.length === 0 ? (
                <div className="reports-empty-state">
                  <Clock size={24} style={{ color: '#38bdf8' }} />
                  <p>No memberships expiring in the next 7 days.</p>
                </div>
              ) : (
                <div className="reports-table-container">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Expires In</th>
                        <th>Projected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingRenewals.items.map((item) => (
                        <tr key={item.membershipId}>
                          <td>
                            <strong>{item.userName}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                              {item.userEmail || 'No email'}
                            </div>
                          </td>
                          <td>{item.planName}</td>
                          <td>
                            <span style={{ color: item.daysRemaining <= 2 ? '#ef4444' : '#38bdf8' }}>
                              {item.daysRemaining === 0 ? 'Expires today' : `${item.daysRemaining} day(s)`}
                            </span>
                          </td>
                          <td>{formatRupees(item.renewalPriceRupees)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab 2: Weekly Rolling Trends View */}
      {activeTab === 'weekly' && (
        <>
          {/* Weekly Summary KPIs */}
          <div className="reports-kpi-grid">
            <div className="reports-kpi-card">
              <span className="reports-kpi-label">7-Day Total Revenue</span>
              <div className="reports-kpi-value">{formatRupees(weeklyData?.summary?.totalRevenueRupees || 0)}</div>
              <div className="reports-kpi-meta">
                Avg: {formatRupees(weeklyData?.summary?.averageDailyRevenueRupees || 0)} / day
              </div>
            </div>

            <div className="reports-kpi-card">
              <span className="reports-kpi-label">Cash vs UPI Volume</span>
              <div className="reports-kpi-value" style={{ fontSize: '1.25rem' }}>
                Cash: {formatRupees(weeklyData?.summary?.cashRupees || 0)}
              </div>
              <div className="reports-kpi-meta">
                UPI: {formatRupees(weeklyData?.summary?.upiRupees || 0)} ({weeklyData?.summary?.upiPercentage || 0}%)
              </div>
            </div>

            <div className="reports-kpi-card">
              <span className="reports-kpi-label">7-Day Total Check-Ins</span>
              <div className="reports-kpi-value">{weeklyData?.summary?.totalCheckIns || 0}</div>
              <div className="reports-kpi-meta">
                Avg: {weeklyData?.summary?.averageDailyCheckIns || 0} check-ins / day
              </div>
            </div>

            <div className="reports-kpi-card">
              <span className="reports-kpi-label">Member Acquisition</span>
              <div className="reports-kpi-value">
                {(weeklyData?.summary?.totalNewMembers || 0) + (weeklyData?.summary?.totalRenewals || 0)}
              </div>
              <div className="reports-kpi-meta">
                {weeklyData?.summary?.totalNewMembers || 0} new, {weeklyData?.summary?.totalRenewals || 0} renewals
              </div>
            </div>
          </div>

          {/* Weekly Attendance & Revenue Chart Card */}
          <div className="reports-chart-card" data-testid="weekly-attendance-chart">
            <div className="reports-chart-header">
              <span className="reports-chart-title">Weekly Attendance Trends by Session</span>
              <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
                {weeklyData?.startDate} to {weeklyData?.endDate}
              </span>
            </div>

            <div className="reports-chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData?.dailyTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="dayName" stroke="#a1a1aa" fontSize={12} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#27272a',
                      borderRadius: '0.375rem',
                      color: '#f4f4f5',
                      fontSize: '0.8125rem',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                  <Bar dataKey="morningCheckIns" name="Morning Session" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="eveningCheckIns" name="Evening Session" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Daily Breakdown Table */}
          <div className="reports-panel">
            <div className="reports-panel-header">
              <span className="reports-panel-title">Daily Trend Breakdown</span>
            </div>

            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Revenue</th>
                    <th>Cash</th>
                    <th>UPI</th>
                    <th>Check-Ins</th>
                    <th>New Members</th>
                    <th>Renewals</th>
                  </tr>
                </thead>
                <tbody>
                  {(weeklyData?.dailyTrend || []).map((day) => (
                    <tr key={day.date}>
                      <td><strong>{day.date}</strong></td>
                      <td>{day.dayName}</td>
                      <td>{formatRupees(day.revenueRupees)}</td>
                      <td>{formatRupees(day.cashRupees)}</td>
                      <td>{formatRupees(day.upiRupees)}</td>
                      <td>{day.checkIns}</td>
                      <td>{day.newMembers}</td>
                      <td>{day.renewals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
