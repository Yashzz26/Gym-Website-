import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Flame,
  Clock,
  Sparkles,
  ShieldCheck,
  Keyboard,
  ArrowRight,
  Sun,
  Moon,
  Calendar,
  History,
  Trophy,
  Check,
  Dumbbell,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  checkInAttendance,
  getMyAttendance,
  calculateStreakFromRecords,
  getWeeklyCalendar,
} from '../../services/attendanceService';
import './QrAttendancePage.css';

/**
 * Determine session from hour
 */
function getWorkoutSession(date = new Date()) {
  const hours = date.getHours();
  if (hours >= 5 && hours < 13) {
    return { name: 'Morning Session', icon: Sun, label: 'Morning' };
  }
  if (hours >= 16 && hours < 23) {
    return { name: 'Evening Session', icon: Moon, label: 'Evening' };
  }
  return { name: 'General Session', icon: Sparkles, label: 'General' };
}

export default function QrAttendancePage() {
  const { user, profile } = useAuth();

  // Primary page tabs: 'scanner' | 'history'
  const [activeTab, setActiveTab] = useState('scanner');

  // Scanner states: 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'permission-denied' | 'no-camera'
  const [scannerState, setScannerState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isSecure, setIsSecure] = useState(true);

  // History & Streak state
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const scannerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Check secure context on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      setIsSecure(isLocalhost || isHttps);
    }
  }, []);

  /**
   * Fetch member's attendance history from server
   */
  const loadAttendanceHistory = useCallback(async () => {
    if (!user) return;
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const authToken = await user.getIdToken();
      const records = await getMyAttendance(authToken);
      if (isMountedRef.current) {
        setHistoryRecords(records || []);
      }
    } catch (err) {
      console.warn('[QrAttendancePage] Failed to load attendance history:', err.message);
      if (isMountedRef.current) {
        setHistoryError('Unable to load attendance history from server.');
      }
    } finally {
      if (isMountedRef.current) {
        setHistoryLoading(false);
      }
    }
  }, [user]);

  // Load history on initial mount when user is available
  useEffect(() => {
    loadAttendanceHistory();
  }, [loadAttendanceHistory]);

  // Calculate streak analytics from server records
  const streakStats = useMemo(() => {
    return calculateStreakFromRecords(historyRecords);
  }, [historyRecords]);

  // Calculate weekly calendar from server records
  const weeklyData = useMemo(() => {
    return getWeeklyCalendar(historyRecords);
  }, [historyRecords]);

  /**
   * Stop and cleanup the active camera scanner
   */
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore stop errors on unmount
      }
      scannerRef.current = null;
    }
  }, []);

  /**
   * Submit token to check-in API
   */
  const handleTokenSubmit = useCallback(
    async (tokenString) => {
      if (!tokenString || isProcessingRef.current) return;

      const now = Date.now();
      // Deduplicate: prevent rapid spam of the same token within 10 seconds
      if (
        lastScannedTokenRef.current === tokenString &&
        now - lastScannedTimeRef.current < 10000
      ) {
        return;
      }

      lastScannedTokenRef.current = tokenString;
      lastScannedTimeRef.current = now;
      isProcessingRef.current = true;
      setScannerState('processing');
      setErrorMessage('');

      // Stop camera scanner immediately on token capture
      await stopScanner();

      try {
        const authToken = user ? await user.getIdToken() : null;
        const result = await checkInAttendance(tokenString, authToken);

        if (isMountedRef.current) {
          setCheckInResult(result);
          setScannerState('success');
          // Reload history & streaks in background
          loadAttendanceHistory();
        }
      } catch (err) {
        console.error('[QrAttendancePage] Check-in error:', err);
        if (isMountedRef.current) {
          setErrorMessage(err.message || 'Attendance check-in failed. Please try again.');
          setScannerState('error');
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [user, loadAttendanceHistory, stopScanner]
  );

  /**
   * Start camera scanner via Html5Qrcode
   */
  const startScanner = useCallback(async () => {
    await stopScanner();
    if (!isMountedRef.current) return;

    setScannerState('scanning');
    setErrorMessage('');

    try {
      const html5QrCode = new Html5Qrcode('member-qr-reader');
      scannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = async (decodedText) => {
        if (!decodedText || isProcessingRef.current) return;

        // Basic sanity check: gym rotating tokens are formatted as <payload>.<signature>
        if (!decodedText.includes('.') && decodedText.length < 10) {
          setErrorMessage('Invalid QR Code. Please scan the official Gym entrance QR.');
          setScannerState('error');
          return;
        }

        // Pause camera while processing check-in
        try {
          if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {
          // Ignore
        }

        handleTokenSubmit(decodedText);
      };

      const qrCodeErrorCallback = () => {
        // Continuous parse errors while seeking QR code are expected; do not spam state
      };

      const config = {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      // Prefer back camera on mobile devices
      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
    } catch (err) {
      console.warn('[QrAttendancePage] Camera start failure:', err);
      if (!isMountedRef.current) return;

      const errorStr = String(err).toLowerCase();
      if (
        errorStr.includes('notallowederror') ||
        errorStr.includes('permission') ||
        err?.name === 'NotAllowedError'
      ) {
        setScannerState('permission-denied');
        setErrorMessage(
          'Camera permission was denied. Please allow camera access in your browser settings to scan the gym QR.'
        );
      } else if (
        errorStr.includes('notfounderror') ||
        errorStr.includes('not found') ||
        err?.name === 'NotFoundError'
      ) {
        setScannerState('no-camera');
        setErrorMessage(
          'No camera was found on your device. You can enter the QR token manually below.'
        );
      } else {
        setScannerState('error');
        setErrorMessage(
          err.message || 'Unable to access camera. Please check permissions or enter token manually.'
        );
      }
    }
  }, [stopScanner, handleTokenSubmit]);

  // Manage scanner lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (activeTab === 'scanner' && !manualMode && scannerState === 'idle') {
      startScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [activeTab, manualMode, scannerState, startScanner, stopScanner]);

  // Pause scanner when tab is hidden / in background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScanner();
      } else if (activeTab === 'scanner' && !manualMode && scannerState === 'idle') {
        startScanner();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, manualMode, scannerState, startScanner, stopScanner]);

  // Reset and restart
  const handleReset = () => {
    setCheckInResult(null);
    setErrorMessage('');
    setManualToken('');
    lastScannedTokenRef.current = '';
    lastScannedTimeRef.current = 0;
    isProcessingRef.current = false;
    if (manualMode) {
      setScannerState('idle');
    } else {
      setScannerState('idle');
      startScanner();
    }
  };

  const currentSession = getWorkoutSession();
  const SessionIcon = currentSession.icon;

  return (
    <div className="qr-attendance-page">
      <div className="qr-attendance-container">
        {/* Top Header Card */}
        <header className="attendance-header">
          <div className="attendance-badge-row">
            <span className="badge-gateway">
              <QrCode size={16} /> Member Check-In
            </span>
            <span className="badge-session">
              <SessionIcon size={14} /> {currentSession.name}
            </span>
          </div>
          <h1>Gym Attendance & Streak</h1>
          <p>
            Scan the live rotating entrance QR code, track your daily check-in streak, and review workout history.
          </p>
        </header>

        {/* 1. STREAK & SUMMARY STATS BAR (Always visible) */}
        <section className="streak-stats-grid" aria-label="Workout Streak and Attendance Overview">
          <div className="stat-card streak-card">
            <div className="stat-icon-wrap streak-icon-wrap">
              <Flame size={24} className="flame-animate" />
            </div>
            <div className="stat-content">
              <span className="stat-label">Current Streak</span>
              <span className="stat-value">
                {streakStats.currentStreak}{' '}
                <span className="stat-unit">Day{streakStats.currentStreak === 1 ? '' : 's'}</span>
              </span>
              <span className="stat-subtext">
                {streakStats.currentStreak > 0 ? '🔥 On Fire!' : 'Check in to start!'}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap calendar-icon-wrap">
              <Calendar size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">This Week</span>
              <span className="stat-value">
                {weeklyData.attendedCount} <span className="stat-unit">/ 7 Days</span>
              </span>
              <span className="stat-subtext">{weeklyData.completionPercent}% target</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap workout-icon-wrap">
              <Dumbbell size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Workouts</span>
              <span className="stat-value">{streakStats.totalCheckIns}</span>
              <span className="stat-subtext">All-time visits</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap trophy-icon-wrap">
              <Trophy size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Best Streak</span>
              <span className="stat-value">
                {streakStats.longestStreak}{' '}
                <span className="stat-unit">Day{streakStats.longestStreak === 1 ? '' : 's'}</span>
              </span>
              <span className="stat-subtext">Personal Record</span>
            </div>
          </div>
        </section>

        {/* 2. WEEKLY ATTENDANCE CALENDAR WIDGET */}
        <section className="weekly-calendar-card" aria-label="Weekly Attendance Calendar">
          <div className="calendar-card-header">
            <div className="header-title-group">
              <h3>
                <Calendar size={18} /> Weekly Attendance
              </h3>
              <span className="calendar-week-label">
                {weeklyData.attendedCount} of 7 days completed this week
              </span>
            </div>
            <div className="week-progress-indicator">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${weeklyData.completionPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="calendar-days-row">
            {weeklyData.days.map((day) => (
              <div
                key={day.date}
                className={`calendar-day-col ${day.isToday ? 'is-today' : ''} ${
                  day.checkedIn ? 'checked-in' : ''
                } ${day.isFuture ? 'is-future' : ''}`}
              >
                <span className="day-name">{day.dayName}</span>
                <span className="day-number">{day.dayNumber}</span>
                <div className="day-status-indicator">
                  {day.checkedIn ? (
                    <div className="check-badge" title={`Attended: ${day.session || 'Workout'}`}>
                      <Check size={14} />
                    </div>
                  ) : day.isToday ? (
                    <div className="today-dot" title="Pending Today" />
                  ) : day.isPast ? (
                    <div className="missed-dot" title="Rest / Missed" />
                  ) : (
                    <div className="future-dot" title="Upcoming" />
                  )}
                </div>
                {day.checkedIn && day.session && (
                  <span className="day-session-tag">
                    {day.session.includes('Morning') ? 'AM' : 'PM'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Navigation Tabs: Scanner vs Attendance History */}
        <nav className="page-nav-tabs" aria-label="Attendance Views">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
          >
            <Camera size={16} /> QR Scanner
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={async () => {
              await stopScanner();
              setActiveTab('history');
              loadAttendanceHistory();
            }}
          >
            <History size={16} /> Attendance History ({historyRecords.length})
          </button>
        </nav>

        {/* Security context alert if not HTTPS/localhost */}
        {!isSecure && activeTab === 'scanner' && (
          <div className="alert-warning" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>Insecure Context:</strong> Camera scanner requires HTTPS or localhost. If camera does not start, please use manual entry.
            </div>
          </div>
        )}

        {/* TAB 1: SCANNER VIEW */}
        {activeTab === 'scanner' && (
          <div className="scanner-card">
            {/* Mode Switcher */}
            <div className="scanner-tabs">
              <button
                type="button"
                className={`tab-btn ${!manualMode ? 'active' : ''}`}
                onClick={() => {
                  setManualMode(false);
                  handleReset();
                }}
              >
                <Camera size={16} /> Camera Viewfinder
              </button>
              <button
                type="button"
                className={`tab-btn ${manualMode ? 'active' : ''}`}
                onClick={() => {
                  setManualMode(true);
                  setScannerState('idle');
                  setErrorMessage('');
                  stopScanner();
                }}
              >
                <Keyboard size={16} /> Manual Token Entry
              </button>
            </div>

            {/* VIEW 1: Success State */}
            {scannerState === 'success' && checkInResult && (
              <div className="state-success" role="status">
                <div className="success-icon-wrapper">
                  <CheckCircle2 size={64} className="icon-pulse" />
                </div>
                <h2>Check-In Confirmed!</h2>
                <p className="success-subtitle">
                  Welcome to FitMax, <strong>{checkInResult.memberName || profile?.displayName || 'Member'}</strong>!
                </p>

                <div className="checkin-summary-grid">
                  <div className="summary-item">
                    <span className="item-label"><Clock size={14} /> Check-In Time</span>
                    <span className="item-val">
                      {checkInResult.timestamp
                        ? new Date(checkInResult.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Just now'}
                    </span>
                  </div>

                  <div className="summary-item">
                    <span className="item-label"><SessionIcon size={14} /> Session</span>
                    <span className="item-val">{checkInResult.session || currentSession.label}</span>
                  </div>

                  <div className="summary-item streak-item">
                    <span className="item-label"><Flame size={14} /> Workout Streak</span>
                    <span className="item-val streak-val">
                      {checkInResult.streakDays ?? (streakStats.currentStreak || 1)} Days Active 🔥
                    </span>
                  </div>

                  <div className="summary-item">
                    <span className="item-label"><ShieldCheck size={14} /> Verification</span>
                    <span className="item-val text-verified">Atomic Verified</span>
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleReset}
                  >
                    <RefreshCw size={16} /> Scan Another
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab('history')}
                  >
                    <History size={16} /> View Attendance Log
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 2: Processing State */}
            {scannerState === 'processing' && (
              <div className="state-processing" role="status">
                <RefreshCw size={48} className="spinner-icon" />
                <h3>Verifying QR Token...</h3>
                <p>Authenticating membership and logging entrance timestamp.</p>
              </div>
            )}

            {/* VIEW 3: Permission Denied State */}
            {scannerState === 'permission-denied' && (
              <div className="state-notice notice-permission" role="alert">
                <CameraOff size={48} className="notice-icon" />
                <h3>Camera Permission Denied</h3>
                <p>{errorMessage}</p>
                <div className="notice-instructions">
                  <strong>How to enable:</strong>
                  <ol>
                    <li>Click the camera or lock icon in your browser address bar.</li>
                    <li>Set Camera permission to <em>Allow</em>.</li>
                    <li>Click the button below to retry.</li>
                  </ol>
                </div>
                <div className="notice-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={startScanner}
                  >
                    <Camera size={16} /> Request Permission Again
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setManualMode(true);
                      setScannerState('idle');
                    }}
                  >
                    <Keyboard size={16} /> Use Manual Entry
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 4: No Camera Found State */}
            {scannerState === 'no-camera' && (
              <div className="state-notice notice-nocamera" role="alert">
                <CameraOff size={48} className="notice-icon" />
                <h3>No Camera Detected</h3>
                <p>{errorMessage}</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setManualMode(true);
                    setScannerState('idle');
                  }}
                >
                  <Keyboard size={16} /> Enter Token Manually
                </button>
              </div>
            )}

            {/* VIEW 5: Camera Scanner Viewfinder */}
            {!manualMode &&
              scannerState !== 'success' &&
              scannerState !== 'processing' &&
              scannerState !== 'permission-denied' &&
              scannerState !== 'no-camera' && (
                <div className="viewfinder-section">
                  {/* Error Banner if error occurred */}
                  {errorMessage && (
                    <div className="scan-error-banner" role="alert">
                      <AlertCircle size={18} />
                      <span>{errorMessage}</span>
                      <button
                        type="button"
                        className="btn-retry-inline"
                        onClick={startScanner}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="scanner-target-wrapper">
                    {/* html5-qrcode mounts into this element */}
                    <div id="member-qr-reader" className="html5-qr-reader-container" />
                    <div className="target-reticle" aria-hidden="true">
                      <div className="reticle-corner top-left" />
                      <div className="reticle-corner top-right" />
                      <div className="reticle-corner bottom-left" />
                      <div className="reticle-corner bottom-right" />
                      <div className="scan-laser" />
                    </div>
                  </div>

                  <div className="scanner-guidance">
                    <p>Align the reception QR code inside the viewfinder frame to check in.</p>
                  </div>
                </div>
              )}

            {/* VIEW 6: Manual Entry Mode */}
            {manualMode && scannerState !== 'success' && scannerState !== 'processing' && (
              <form
                className="manual-entry-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken.trim()) {
                    handleTokenSubmit(manualToken.trim());
                  }
                }}
              >
                {errorMessage && (
                  <div className="scan-error-banner" role="alert">
                    <AlertCircle size={18} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="manual-token-input">Gym QR Token Payload</label>
                  <textarea
                    id="manual-token-input"
                    className="token-textarea"
                    placeholder="Paste gym QR token string (e.g. eyJneW1JZCI6...)"
                    rows={4}
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    required
                  />
                  <span className="input-hint">
                    The token displayed on the reception desk screen or sent by front desk.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-block"
                  disabled={!manualToken.trim()}
                >
                  Verify & Check In <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED ATTENDANCE HISTORY VIEW */}
        {activeTab === 'history' && (
          <section className="history-card" aria-label="Member Attendance History">
            <div className="history-card-header">
              <div>
                <h2>Workout Check-In History</h2>
                <p>Verified timestamps recorded at FitMax entrance gateway.</p>
              </div>
              <button
                type="button"
                className="btn-refresh-history"
                onClick={loadAttendanceHistory}
                disabled={historyLoading}
                aria-label="Refresh History"
              >
                <RefreshCw size={16} className={historyLoading ? 'spinner-icon' : ''} />
              </button>
            </div>

            {historyError && (
              <div className="scan-error-banner" role="alert">
                <AlertCircle size={16} />
                <span>{historyError}</span>
              </div>
            )}

            {historyLoading && historyRecords.length === 0 ? (
              <div className="history-loading-state" role="status">
                <RefreshCw size={36} className="spinner-icon" />
                <p>Loading attendance history from server...</p>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="history-empty-state">
                <Dumbbell size={48} className="empty-icon" />
                <h3>No Attendance Records Yet</h3>
                <p>
                  You haven't scanned in at the gym yet. Head to the QR Scanner tab and scan the reception code to begin your streak!
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setActiveTab('scanner')}
                >
                  <Camera size={16} /> Open Scanner
                </button>
              </div>
            ) : (
              <div className="history-timeline">
                {historyRecords.map((record) => {
                  const recordDate = new Date(record.timestamp || record.date);
                  const isMorning = record.session?.includes('Morning');

                  return (
                    <article key={record.attendanceId || record.id} className="history-row-card">
                      <div className="row-date-badge">
                        <span className="badge-month">
                          {recordDate.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="badge-day">{recordDate.getDate()}</span>
                      </div>

                      <div className="row-details">
                        <div className="row-top-line">
                          <span className="row-full-date">
                            {recordDate.toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="row-time">
                            <Clock size={13} />{' '}
                            {recordDate.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="row-tags">
                          <span
                            className={`session-pill ${
                              isMorning ? 'pill-morning' : 'pill-evening'
                            }`}
                          >
                            {isMorning ? <Sun size={12} /> : <Moon size={12} />}
                            {record.session || 'Workout'}
                          </span>

                          {record.streakDays > 0 && (
                            <span className="streak-pill">
                              <Flame size={12} /> Streak Day {record.streakDays}
                            </span>
                          )}

                          <span className="gym-pill">
                            <MapPin size={12} /> {record.gymId || 'FitMax Main'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Security & Integrity Note */}
        <footer className="attendance-footer">
          <ShieldCheck size={16} />
          <span>
            Anti-replay security enabled: Tokens rotate dynamically and are single-use only.
          </span>
        </footer>
      </div>
    </div>
  );
}
