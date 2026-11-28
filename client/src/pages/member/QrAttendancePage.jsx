import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  Keyboard,
  ArrowRight,
  Sun,
  Moon,
  History,
  Check,
  Dumbbell,
  MapPin,
  Square,
  SwitchCamera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  checkInAttendance,
  getMyAttendance,
  calculateStreakFromRecords,
  getWeeklyCalendar,
} from '../../services/attendanceService';
import { getMyMembership } from '../../services/memberService';
import {
  PageHeader,
  StatusTag,
  ProgressBar,
  StatePanel,
} from '../../components/member/MemberUI';
import './QrAttendancePage.css';

function getWorkoutSession(date = new Date()) {
  const hours = date.getHours();
  if (hours >= 5 && hours < 13) {
    return { name: 'Morning Session', icon: Sun, label: 'Morning' };
  }
  if (hours >= 16 && hours < 23) {
    return { name: 'Evening Session', icon: Moon, label: 'Evening' };
  }
  return { name: 'General Session', icon: Clock, label: 'General' };
}

export default function QrAttendancePage() {
  const { user, profile } = useAuth();

  // Scanner states: 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'permission-denied' | 'no-camera'
  const [scannerState, setScannerState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isSecure] = useState(() => {
    if (typeof window === 'undefined') return true;
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    return isLocalhost || isHttps;
  });

  // Camera enumeration & switching state
  const [availableCameras, setAvailableCameras] = useState([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);

  // History, Membership eligibility & Streak state
  const [historyRecords, setHistoryRecords] = useState([]);
  const [membershipInfo, setMembershipInfo] = useState(undefined);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const scannerRef = useRef(null);
  const historySectionRef = useRef(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  const loadAttendanceHistory = useCallback(async () => {
    if (!user) return;
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const authToken = await user.getIdToken();
      const [records, activePlan] = await Promise.all([
        getMyAttendance(authToken),
        getMyMembership(authToken).catch(() => undefined),
      ]);
      if (isMountedRef.current) {
        setHistoryRecords(records || []);
        if (activePlan !== undefined) {
          setMembershipInfo(activePlan);
        }
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

  useEffect(() => {
    loadAttendanceHistory();
  }, [loadAttendanceHistory]);

  const streakStats = useMemo(() => {
    return calculateStreakFromRecords(historyRecords);
  }, [historyRecords]);

  const weeklyData = useMemo(() => {
    return getWeeklyCalendar(historyRecords, new Date(), membershipInfo);
  }, [historyRecords, membershipInfo]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore stop errors during teardown
      }
      scannerRef.current = null;
    }
  }, []);

  const handleTokenSubmit = useCallback(
    async (tokenString) => {
      if (!tokenString || isProcessingRef.current) return;

      const now = Date.now();
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

      await stopScanner();

      try {
        const authToken = user ? await user.getIdToken() : null;
        const result = await checkInAttendance(tokenString, authToken);

        if (isMountedRef.current) {
          setCheckInResult(result);
          setScannerState('success');
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
   * Explicitly start camera scanner only after user clicks Start QR Scanner
   */
  const startScanner = useCallback(
    async (cameraIdOverride = null) => {
      await stopScanner();
      if (!isMountedRef.current) return;

      setScannerState('scanning');
      setErrorMessage('');

      try {
        let camerasList = availableCameras;
        if (typeof Html5Qrcode.getCameras === 'function') {
          try {
            const detected = await Html5Qrcode.getCameras();
            if (Array.isArray(detected) && detected.length > 0 && isMountedRef.current) {
              camerasList = detected;
              setAvailableCameras(detected);
            }
          } catch {
            // Fall back to default facingMode constraint
          }
        }

        if (!isMountedRef.current) return;

        const html5QrCode = new Html5Qrcode('member-qr-reader');
        scannerRef.current = html5QrCode;

        const qrCodeSuccessCallback = async (decodedText) => {
          if (!decodedText || isProcessingRef.current) return;

          if (!decodedText.includes('.') && decodedText.length < 10) {
            setErrorMessage('Invalid QR Code. Please scan the official gym entrance QR.');
            setScannerState('error');
            await stopScanner();
            return;
          }

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
          // Expected while seeking QR frame
        };

        const config = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        };

        const cameraConstraint = cameraIdOverride
          ? cameraIdOverride
          : camerasList.length > 1
            ? camerasList[activeCameraIndex]?.id || { facingMode: 'environment' }
            : { facingMode: 'environment' };

        await html5QrCode.start(
          cameraConstraint,
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
            'Camera permission was denied. Allow camera access in your browser settings to scan the gym QR.'
          );
        } else if (
          errorStr.includes('notfounderror') ||
          errorStr.includes('not found') ||
          err?.name === 'NotFoundError'
        ) {
          setScannerState('no-camera');
          setErrorMessage(
            'No camera was detected on your device. Enter the QR token manually instead.'
          );
        } else {
          setScannerState('error');
          setErrorMessage(
            err.message || 'Unable to access camera. Check permissions or use manual token entry.'
          );
        }
      }
    },
    [availableCameras, activeCameraIndex, stopScanner, handleTokenSubmit]
  );

  const handleStopScanner = async () => {
    await stopScanner();
    setScannerState('idle');
    setErrorMessage('');
  };

  const handleSwitchCamera = async () => {
    if (availableCameras.length < 2) return;
    const nextIndex = (activeCameraIndex + 1) % availableCameras.length;
    setActiveCameraIndex(nextIndex);
    await startScanner(availableCameras[nextIndex].id);
  };

  // Cleanup camera resources on unmount only (never auto-start on mount)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  // Release camera if browser tab moves to background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && scannerState === 'scanning') {
        stopScanner();
        setScannerState('idle');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scannerState, stopScanner]);

  const handleReset = () => {
    setCheckInResult(null);
    setErrorMessage('');
    setManualToken('');
    lastScannedTokenRef.current = '';
    lastScannedTimeRef.current = 0;
    isProcessingRef.current = false;
    setScannerState('idle');
  };

  const currentSession = getWorkoutSession();

  return (
    <div className="member-page attendance-page-root">
      <PageHeader
        title="Gym Attendance & Streak"
        subtitle="Scan the live entrance QR code to check in and review your weekly consistency."
        actions={
          <div className="attendance-header-tags">
            <StatusTag variant="neutral">Member Check-In</StatusTag>
            <StatusTag variant="accent">{currentSession.name}</StatusTag>
          </div>
        }
      />

      {!isSecure && (
        <div className="member-alert is-warning" role="alert">
          <div className="member-alert-body">
            <AlertCircle size={16} />
            <span>
              Camera access requires HTTPS or localhost. Use manual token entry if camera access is blocked.
            </span>
          </div>
        </div>
      )}

      {/* Reorganized Attendance Workspace Grid:
          Desktop: Stats row across top; Left = QR Scanner (immediately visible), Right = Weekly Calendar + History.
          Mobile: QR Scanner first, Stats second, Weekly Calendar & History below. */}
      <div className="attendance-layout-grid">
        {/* Compact Statistics Bar */}
        <section className="streak-stats-grid" aria-label="Workout Streak and Attendance Overview">
          <div className="stat-card">
            <span className="stat-label">Current Streak</span>
            <span className="stat-value tabular-nums">
              {streakStats.currentStreak}{' '}
              <span className="stat-unit">Day{streakStats.currentStreak === 1 ? '' : 's'}</span>
            </span>
            <span className="stat-subtext">
              {streakStats.currentStreak > 0 ? 'Active streak' : 'Check in to start streak'}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">This Week</span>
            <span className="stat-value tabular-nums">
              {weeklyData.attendedCount} <span className="stat-unit">/ 7 Days</span>
            </span>
            <span className="stat-subtext tabular-nums">{weeklyData.completionPercent}% target</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Total Workouts</span>
            <span className="stat-value tabular-nums">{streakStats.totalCheckIns}</span>
            <span className="stat-subtext">All-time visits</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Best Streak</span>
            <span className="stat-value tabular-nums">
              {streakStats.longestStreak}{' '}
              <span className="stat-unit">Day{streakStats.longestStreak === 1 ? '' : 's'}</span>
            </span>
            <span className="stat-subtext">Personal record</span>
          </div>
        </section>

        {/* Left Column (Desktop) / First Block (Mobile): Primary QR Check-In Scanner */}
        <section className="member-panel scanner-panel" aria-label="QR Check-In Scanner">
          <div className="scanner-panel-head">
            <h2 className="member-section-title">Entrance QR Check-In</h2>
            <div className="scanner-mode-switcher">
              <button
                type="button"
                className={`scanner-mode-btn ${!manualMode ? 'is-active' : ''}`}
                onClick={() => {
                  setManualMode(false);
                  handleReset();
                  stopScanner();
                }}
              >
                <Camera size={15} />
                <span>Camera</span>
              </button>
              <button
                type="button"
                className={`scanner-mode-btn ${manualMode ? 'is-active' : ''}`}
                onClick={() => {
                  setManualMode(true);
                  setScannerState('idle');
                  setErrorMessage('');
                  stopScanner();
                }}
              >
                <Keyboard size={15} />
                <span>Manual Token Entry</span>
              </button>
            </div>
          </div>

          {/* Success State */}
          {scannerState === 'success' && checkInResult && (
            <div className="scanner-result-box" role="status">
              <div className="scanner-result-head">
                <div className="result-icon is-success">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h2>Check-in confirmed</h2>
                  <p>
                    Checked in at IRONCORE,{' '}
                    <strong>{checkInResult.memberName || profile?.displayName || 'Member'}</strong>
                  </p>
                </div>
              </div>

              <dl className="checkin-summary-grid">
                <div className="checkin-summary-item">
                  <dt>Check-In Time</dt>
                  <dd className="tabular-nums">
                    {checkInResult.timestamp
                      ? new Date(checkInResult.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Just now'}
                  </dd>
                </div>
                <div className="checkin-summary-item">
                  <dt>Session</dt>
                  <dd>{checkInResult.session || currentSession.label}</dd>
                </div>
                <div className="checkin-summary-item">
                  <dt>Workout Streak</dt>
                  <dd className="tabular-nums is-accent-val">
                    {checkInResult.streakDays ?? (streakStats.currentStreak || 1)} day streak
                  </dd>
                </div>
                <div className="checkin-summary-item">
                  <dt>Verification</dt>
                  <dd className="is-success-val">Atomic Verified</dd>
                </div>
              </dl>

              <div className="scanner-result-actions">
                <button type="button" className="btn btn-primary" onClick={handleReset}>
                  <RefreshCw size={16} />
                  <span>Scan Another</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    loadAttendanceHistory();
                    historySectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
                  }}
                >
                  <History size={16} />
                  <span>View Attendance Log</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing State */}
          {scannerState === 'processing' && (
            <StatePanel
              icon={RefreshCw}
              spinIcon
              title="Verifying QR Token…"
              description="Authenticating membership and recording entrance timestamp."
            />
          )}

          {/* Permission Denied */}
          {scannerState === 'permission-denied' && (
            <div className="scanner-notice-box" role="alert">
              <div className="scanner-notice-head">
                <div className="result-icon is-danger">
                  <CameraOff size={20} />
                </div>
                <div>
                  <h3>Camera Permission Denied</h3>
                  <p>{errorMessage}</p>
                </div>
              </div>

              <ol className="permission-steps">
                <li>Click the camera or lock icon in your browser address bar.</li>
                <li>Set Camera permission to Allow.</li>
                <li>Click Request Permission Again below.</li>
              </ol>

              <div className="scanner-result-actions">
                <button type="button" className="btn btn-primary" onClick={() => startScanner()}>
                  <Camera size={16} />
                  <span>Request Permission Again</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setManualMode(true);
                    setScannerState('idle');
                  }}
                >
                  <Keyboard size={16} />
                  <span>Use Manual Entry</span>
                </button>
              </div>
            </div>
          )}

          {/* No Camera */}
          {scannerState === 'no-camera' && (
            <StatePanel
              icon={CameraOff}
              title="No Camera Detected"
              description={errorMessage}
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setManualMode(true);
                    setScannerState('idle');
                  }}
                >
                  <Keyboard size={16} />
                  <span>Enter Token Manually</span>
                </button>
              }
            />
          )}

          {/* Camera Standby / Live Preview */}
          {!manualMode &&
            scannerState !== 'success' &&
            scannerState !== 'processing' &&
            scannerState !== 'permission-denied' &&
            scannerState !== 'no-camera' && (
              <div className="viewfinder-layout">
                {errorMessage && (
                  <div className="member-alert is-error" role="alert">
                    <div className="member-alert-body">
                      <AlertCircle size={16} />
                      <span>{errorMessage}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => startScanner()}
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div
                  className={`scanner-frame-box ${
                    scannerState === 'scanning' ? 'is-live' : 'is-standby'
                  }`}
                >
                  <div id="member-qr-reader" className="html5-qr-reader-container" />

                  <div className="target-reticle" aria-hidden="true">
                    <div className="reticle-corner top-left" />
                    <div className="reticle-corner top-right" />
                    <div className="reticle-corner bottom-left" />
                    <div className="reticle-corner bottom-right" />
                  </div>

                  {scannerState !== 'scanning' && (
                    <div className="scanner-standby-overlay">
                      <QrCode size={30} strokeWidth={1.5} />
                      <span>Ready to scan</span>
                    </div>
                  )}
                </div>

                <div className="viewfinder-controls">
                  {scannerState !== 'scanning' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => startScanner()}
                    >
                      <Camera size={16} />
                      <span>Start QR Scanner</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleStopScanner}
                      >
                        <Square size={14} />
                        <span>Stop Scanner</span>
                      </button>
                      {availableCameras.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleSwitchCamera}
                        >
                          <SwitchCamera size={16} />
                          <span>Switch Camera</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                <p className="scanner-guidance">
                  {scannerState === 'scanning'
                    ? 'Point your camera at the reception QR code to check in.'
                    : 'Camera access is requested only after you click Start QR Scanner.'}
                </p>
              </div>
            )}

          {/* Manual Entry Form */}
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
                <div className="member-alert is-error" role="alert">
                  <div className="member-alert-body">
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              <div className="manual-form-field">
                <label htmlFor="manual-token-input">Gym QR Token Payload</label>
                <textarea
                  id="manual-token-input"
                  className="token-textarea"
                  placeholder="Paste QR token string"
                  rows={3}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  required
                />
                <span className="input-hint">
                  Enter the rotating token displayed at reception.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!manualToken.trim()}
              >
                <span>Verify &amp; Check In</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </section>

        {/* Right Column (Desktop) / Lower Section (Mobile): Weekly Calendar + History */}
        <div className="attendance-activity-column">
          <section className="member-panel weekly-calendar-card" aria-label="Weekly Attendance Calendar">
            <div className="calendar-card-header">
              <div className="header-title-group">
                <h2>Weekly Attendance</h2>
                <span className="calendar-week-label tabular-nums">
                  {weeklyData.attendedCount} check-ins this week
                </span>
              </div>
              <div className="week-progress-indicator">
                <ProgressBar
                  value={weeklyData.completionPercent}
                  variant={weeklyData.attendedCount > 0 ? 'success' : 'accent'}
                />
              </div>
            </div>

            <div className="calendar-days-row">
              {weeklyData.days.map((day) => {
                const status = day.eligibilityStatus || (day.checkedIn ? 'attended' : day.isToday ? 'today' : day.isFuture ? 'upcoming' : 'missed');
                const metaLabel =
                  status === 'attended'
                    ? day.session?.includes('Morning')
                      ? 'AM'
                      : 'PM'
                    : status === 'today'
                      ? 'Today'
                      : status === 'ineligible'
                        ? 'Pre-plan'
                        : status === 'upcoming'
                          ? 'Upcoming'
                          : 'Missed';

                return (
                  <div
                    key={day.date}
                    data-status={status}
                    className={`calendar-day-col ${day.isToday ? 'is-today' : ''} is-${status}`}
                  >
                    <span className="day-name">{day.dayName}</span>
                    <span className="day-number tabular-nums">{day.dayNumber}</span>
                    <div className="day-status-indicator">
                      {status === 'attended' ? (
                        <span className="check-badge" title={`Attended: ${day.session || 'Workout'}`}>
                          <Check size={13} strokeWidth={2.2} />
                        </span>
                      ) : status === 'today' ? (
                        <span className="today-dot" title="Pending Today" />
                      ) : status === 'ineligible' ? (
                        <span className="ineligible-dot" title="Before membership activation" />
                      ) : status === 'missed' ? (
                        <span className="missed-dot" title="Missed" />
                      ) : (
                        <span className="future-dot" title="Upcoming" />
                      )}
                    </div>
                    <span className="day-meta-label">{metaLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Attendance History */}
          <section
            ref={historySectionRef}
            className="member-panel history-panel"
            aria-label="Member Attendance History"
          >
            <div className="member-section-header">
              <div>
                <h2 className="member-section-title">Workout Check-In History</h2>
                <p className="history-subtitle">
                  Verified timestamps recorded at IRONCORE entrance gateway.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadAttendanceHistory}
                disabled={historyLoading}
                aria-label={`Attendance History (${historyRecords.length})`}
              >
                <RefreshCw size={14} className={historyLoading ? 'member-spin' : ''} />
                <span className="tabular-nums">Attendance History ({historyRecords.length})</span>
              </button>
            </div>

            {historyError && (
              <div className="member-alert is-error" role="alert">
                <div className="member-alert-body">
                  <AlertCircle size={16} />
                  <span>{historyError}</span>
                </div>
              </div>
            )}

            {historyLoading && historyRecords.length === 0 ? (
              <StatePanel
                icon={RefreshCw}
                spinIcon
                title="Loading attendance history"
                description="Fetching verified check-in timestamps."
              />
            ) : historyRecords.length === 0 ? (
              <StatePanel
                icon={Dumbbell}
                title="No Attendance Records Yet"
                description="Scan the entrance QR code at reception when you arrive to record your first check-in."
              />
            ) : (
              <ul className="attendance-history-list">
                {historyRecords.map((record) => {
                  const recordDate = new Date(record.timestamp || record.date);
                  const isMorning = record.session?.includes('Morning');

                  return (
                    <li key={record.attendanceId || record.id} className="attendance-history-row">
                      <div className="row-date-badge">
                        <span className="badge-month">
                          {recordDate.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="badge-day tabular-nums">{recordDate.getDate()}</span>
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
                          <span className="row-time tabular-nums">
                            {recordDate.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="row-meta-tags">
                          <span className="history-meta-item">
                            {isMorning ? <Sun size={13} /> : <Moon size={13} />}
                            <span>{record.session || 'Workout'}</span>
                          </span>
                          {record.streakDays > 0 && (
                            <span className="history-meta-item is-streak tabular-nums">
                              Streak Day {record.streakDays}
                            </span>
                          )}
                          <span className="history-meta-item">
                            <MapPin size={13} />
                            <span>{record.gymId || 'IRONCORE Main'}</span>
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <footer className="attendance-security-footer">
        <ShieldCheck size={15} />
        <span>
          Anti-replay security enabled: Tokens rotate dynamically and are single-use only.
        </span>
      </footer>
    </div>
  );
}
