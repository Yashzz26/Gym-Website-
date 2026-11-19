import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Search,
  Sun,
  Moon,
  Users,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Flame,
  AlertCircle,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTodayAttendance } from '../../services/attendanceService';
import './TodayAttendancePage.css';

/**
 * Format timestamp into 12-hour time (e.g., "08:45 AM") and relative description.
 *
 * @param {string|number|Object} timestamp
 * @returns {{ formattedTime: string, timeAgo: string }}
 */
function formatCheckInTime(timestamp) {
  if (!timestamp) return { formattedTime: '--:--', timeAgo: '' };

  let dateObj;
  if (typeof timestamp === 'object' && timestamp._seconds) {
    dateObj = new Date(timestamp._seconds * 1000);
  } else if (typeof timestamp === 'object' && timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else {
    dateObj = new Date(timestamp);
  }

  if (isNaN(dateObj.getTime())) {
    return { formattedTime: '--:--', timeAgo: '' };
  }

  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const diffMs = Date.now() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  let timeAgo = '';

  if (diffMinutes < 1) {
    timeAgo = 'just now';
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes}m ago`;
  } else {
    const diffHours = Math.floor(diffMinutes / 60);
    timeAgo = `${diffHours}h ${diffMinutes % 60}m ago`;
  }

  return { formattedTime, timeAgo };
}

/**
 * Get current date string formatted as YYYY-MM-DD in local time
 */
function getLocalDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  return formatter.format(date);
}

export default function TodayAttendancePage() {
  const { user } = useAuth();

  // Selected date (defaults to today)
  const todayStr = useMemo(() => getLocalDateString(), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState({
    date: todayStr,
    gymId: 'fitmax-main',
    totalCount: 0,
    morningCount: 0,
    eveningCount: 0,
    generalCount: 0,
    records: [],
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState('ALL'); // 'ALL' | 'Morning Session' | 'Evening Session'
  const [sortBy, setSortBy] = useState('LATEST'); // 'LATEST' | 'EARLIEST' | 'STREAK'

  // Fetch attendance from backend
  const userUid = user?.uid;
  const fetchAttendance = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const token = user ? await user.getIdToken() : null;
        const data = await getTodayAttendance(selectedDate, token, 'fitmax-main');
        setAttendanceData(
          data || {
            date: selectedDate,
            gymId: 'fitmax-main',
            totalCount: 0,
            morningCount: 0,
            eveningCount: 0,
            generalCount: 0,
            records: [],
          }
        );
      } catch (err) {
        console.error('Failed to load attendance:', err);
        setError(err.message || 'Unable to retrieve attendance records. Please retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userUid, selectedDate]
  );

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Navigate date helper
  const changeDateBy = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(getLocalDateString(current));
  };

  // Reset to today
  const handleResetToToday = () => {
    setSelectedDate(todayStr);
  };

  // Format date display for title
  const formattedDateTitle = useMemo(() => {
    if (selectedDate === todayStr) return 'Today';
    const dateObj = new Date(selectedDate + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate, todayStr]);

  // Determine Peak Session
  const peakSession = useMemo(() => {
    const { morningCount, eveningCount, totalCount } = attendanceData;
    if (totalCount === 0) return 'No check-ins yet';
    if (morningCount > eveningCount) return 'Morning Peak';
    if (eveningCount > morningCount) return 'Evening Peak';
    return 'Even Distribution';
  }, [attendanceData]);

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    const records = attendanceData.records || [];

    return records
      .filter((record) => {
        // Session filter
        if (sessionFilter !== 'ALL' && record.session !== sessionFilter) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = (record.memberName || '').toLowerCase();
          const email = (record.memberEmail || '').toLowerCase();
          const plan = (record.planName || '').toLowerCase();
          const id = (record.memberId || record.checkInId || '').toLowerCase();
          return name.includes(q) || email.includes(q) || plan.includes(q) || id.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'EARLIEST') {
          return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
        }
        if (sortBy === 'STREAK') {
          return (b.streakDays || 0) - (a.streakDays || 0);
        }
        // Default LATEST
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }, [attendanceData.records, sessionFilter, searchQuery, sortBy]);

  return (
    <div className="today-attendance-container">
      {/* Top Header */}
      <header className="today-attendance-header">
        <div className="header-meta">
          <div className="portal-badge">
            <CalendarCheck className="badge-icon" size={15} />
            <span>Reception Desk &bull; Live Attendance</span>
          </div>
          <h1 className="header-title">Daily Attendance Screen</h1>
          <p className="header-subtitle">
            Real-time server-verified check-in logs, session breakdown and member streaks.
          </p>
        </div>

        {/* Date Selector & Controls */}
        <div className="header-actions">
          <div className="date-navigator" role="group" aria-label="Date navigation">
            <button
              type="button"
              className="nav-btn"
              onClick={() => changeDateBy(-1)}
              title="Previous Day"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="date-picker-wrap">
              <Calendar size={16} className="picker-icon" />
              <input
                type="date"
                className="date-input"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label="Select attendance date"
              />
            </div>

            <button
              type="button"
              className="nav-btn"
              onClick={() => changeDateBy(1)}
              title="Next Day"
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>

            {selectedDate !== todayStr && (
              <button
                type="button"
                className="btn-today"
                onClick={handleResetToToday}
                title="Jump to Today"
              >
                Today
              </button>
            )}
          </div>

          <div className="header-buttons">
            <button
              type="button"
              className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchAttendance(true)}
              disabled={refreshing || loading}
              title="Refresh attendance records"
              aria-label="Refresh attendance records"
            >
              <RefreshCw size={16} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            <Link to="/reception/qr" className="btn-display-qr" title="Open Rotating Entrance QR Display">
              <QrCode size={16} />
              <span>Entrance QR</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="attendance-error-banner" role="alert">
          <AlertCircle size={20} className="error-icon" />
          <div className="error-content">
            <strong>Error loading records:</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn-retry"
            onClick={() => fetchAttendance()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <section className="attendance-stats-grid" aria-label="Daily attendance summary">
        {/* Total Today */}
        <div className="stat-kpi-card total">
          <div className="kpi-icon-wrap total">
            <Users size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Total Check-ins</span>
            <div className="kpi-value-row">
              <span className="kpi-value" data-testid="total-count">
                {loading ? '...' : attendanceData.totalCount}
              </span>
              <span className="kpi-tag">{formattedDateTitle}</span>
            </div>
            <span className="kpi-subtext">
              {attendanceData.totalCount === 1 ? '1 member attended' : `${attendanceData.totalCount} members attended`}
            </span>
          </div>
        </div>

        {/* Morning Session */}
        <div className="stat-kpi-card morning">
          <div className="kpi-icon-wrap morning">
            <Sun size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Morning Session</span>
            <div className="kpi-value-row">
              <span className="kpi-value" data-testid="morning-count">
                {loading ? '...' : attendanceData.morningCount}
              </span>
              <span className="session-window">06:00 - 11:30</span>
            </div>
            <span className="kpi-subtext">
              {attendanceData.totalCount > 0
                ? `${Math.round((attendanceData.morningCount / attendanceData.totalCount) * 100)}% of daily check-ins`
                : 'Morning slots'}
            </span>
          </div>
        </div>

        {/* Evening Session */}
        <div className="stat-kpi-card evening">
          <div className="kpi-icon-wrap evening">
            <Moon size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Evening Session</span>
            <div className="kpi-value-row">
              <span className="kpi-value" data-testid="evening-count">
                {loading ? '...' : attendanceData.eveningCount}
              </span>
              <span className="session-window">16:30 - 22:00</span>
            </div>
            <span className="kpi-subtext">
              {attendanceData.totalCount > 0
                ? `${Math.round((attendanceData.eveningCount / attendanceData.totalCount) * 100)}% of daily check-ins`
                : 'Evening slots'}
            </span>
          </div>
        </div>

        {/* Peak Intensity Card */}
        <div className="stat-kpi-card peak">
          <div className="kpi-icon-wrap peak">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Peak Traffic</span>
            <div className="kpi-value-row">
              <span className="kpi-value peak-text">{peakSession}</span>
            </div>
            <span className="kpi-subtext">Branch: {attendanceData.gymId}</span>
          </div>
        </div>
      </section>

      {/* Search, Filter, and Controls Bar */}
      <section className="attendance-controls-bar">
        {/* Search Input */}
        <div className="search-box-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by member name, email or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search check-ins by member name or email"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Session Filter Tabs */}
        <div className="session-filters" role="tablist" aria-label="Session filters">
          <button
            type="button"
            role="tab"
            aria-selected={sessionFilter === 'ALL'}
            className={`filter-tab ${sessionFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSessionFilter('ALL')}
          >
            All Sessions ({attendanceData.totalCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sessionFilter === 'Morning Session'}
            className={`filter-tab morning ${sessionFilter === 'Morning Session' ? 'active' : ''}`}
            onClick={() => setSessionFilter('Morning Session')}
          >
            <Sun size={14} />
            <span>Morning ({attendanceData.morningCount})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sessionFilter === 'Evening Session'}
            className={`filter-tab evening ${sessionFilter === 'Evening Session' ? 'active' : ''}`}
            onClick={() => setSessionFilter('Evening Session')}
          >
            <Moon size={14} />
            <span>Evening ({attendanceData.eveningCount})</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="sort-dropdown-wrap">
          <Filter size={15} className="sort-icon" />
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort attendance list"
          >
            <option value="LATEST">Latest Check-in</option>
            <option value="EARLIEST">Earliest First</option>
            <option value="STREAK">Highest Streak</option>
          </select>
        </div>
      </section>

      {/* Main Content Area: Attendance Table / Cards */}
      <section className="attendance-feed-card" aria-label="Attendance records list">
        <div className="feed-header">
          <div className="feed-title-wrap">
            <h2 className="feed-title">Check-in Activity Feed</h2>
            <span className="feed-counter">
              Showing {filteredRecords.length} of {attendanceData.records.length} records
            </span>
          </div>

          <button
            type="button"
            className="btn-print"
            onClick={() => window.print()}
            title="Print Attendance Sheet"
          >
            <Printer size={15} />
            <span>Print Sheet</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="feed-loading" data-testid="feed-loading">
            <RefreshCw size={24} className="spinning" />
            <p>Loading attendance records from server...</p>
          </div>
        )}

        {/* Empty Records for Day */}
        {!loading && attendanceData.records.length === 0 && (
          <div className="feed-empty-state" data-testid="empty-state">
            <div className="empty-icon-wrap">
              <CalendarCheck size={44} />
            </div>
            <h3>No Check-ins Recorded for {formattedDateTitle}</h3>
            <p>
              Members have not scanned the entrance QR code yet for this date.
              Direct members to scan the rotating QR code at the front desk.
            </p>
            <Link to="/reception/qr" className="btn-empty-action">
              <QrCode size={16} />
              <span>Launch Entrance QR Display</span>
            </Link>
          </div>
        )}

        {/* Empty Filter State */}
        {!loading && attendanceData.records.length > 0 && filteredRecords.length === 0 && (
          <div className="feed-no-results" data-testid="no-results-state">
            <AlertCircle size={32} />
            <h4>No check-ins match your search</h4>
            <p>No members found matching &ldquo;{searchQuery}&rdquo; in this session.</p>
            <button
              type="button"
              className="btn-clear-filters"
              onClick={() => {
                setSearchQuery('');
                setSessionFilter('ALL');
              }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Table / List of records */}
        {!loading && filteredRecords.length > 0 && (
          <div className="attendance-table-wrap">
            <table className="attendance-table" aria-label="Daily attendance entries">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Session</th>
                  <th scope="col">Entry Time</th>
                  <th scope="col">Workout Streak</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const { formattedTime, timeAgo } = formatCheckInTime(record.timestamp);
                  const isMorning = record.session === 'Morning Session';
                  const isEvening = record.session === 'Evening Session';
                  const initials = (record.memberName || 'M')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={record.id || record.attendanceId || record.checkInId} className="attendance-row">
                      {/* Member Info */}
                      <td className="member-cell">
                        <div className="member-avatar" aria-hidden="true">
                          {initials}
                        </div>
                        <div className="member-details">
                          <span className="member-name">{record.memberName || 'Member'}</span>
                          {record.memberEmail && (
                            <span className="member-email">{record.memberEmail}</span>
                          )}
                        </div>
                      </td>

                      {/* Session Badge */}
                      <td className="session-cell">
                        <span
                          className={`session-badge ${
                            isMorning ? 'morning' : isEvening ? 'evening' : 'general'
                          }`}
                        >
                          {isMorning ? <Sun size={13} /> : isEvening ? <Moon size={13} /> : <Clock size={13} />}
                          <span>{record.session || 'General'}</span>
                        </span>
                      </td>

                      {/* Entry Time */}
                      <td className="time-cell">
                        <div className="entry-time-wrap">
                          <Clock size={14} className="time-icon" />
                          <span className="entry-time">{formattedTime}</span>
                          {timeAgo && <span className="time-ago">({timeAgo})</span>}
                        </div>
                      </td>

                      {/* Streak Days */}
                      <td className="streak-cell">
                        <div className="streak-pill" title={`${record.streakDays || 1} consecutive days`}>
                          <Flame size={14} className="streak-flame" />
                          <span>{record.streakDays || 1}d streak</span>
                        </div>
                      </td>

                      {/* Membership Plan */}
                      <td className="plan-cell">
                        <span className="plan-tag">
                          {record.planName || 'Standard'}
                        </span>
                      </td>

                      {/* Verification Status */}
                      <td className="status-cell">
                        <span className="verification-badge">
                          <ShieldCheck size={14} className="verified-icon" />
                          <span>QR Verified</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
