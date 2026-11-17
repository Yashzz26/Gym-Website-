import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  RefreshCw,
  Maximize2,
  Minimize2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCurrentQrToken, rotateQrToken } from '../../services/qrService';
import './GymQrDisplayPage.css';

export default function GymQrDisplayPage() {
  const { user } = useAuth();

  const [tokenData, setTokenData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [initialDuration, setInitialDuration] = useState(60);
  const [isLoading, setIsLoading] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // Determine current workout session (Morning: 6 AM - 12 PM, Evening: 4 PM - 10 PM, etc.)
  const getSessionInfo = () => {
    const hours = currentTime.getHours();
    if (hours >= 5 && hours < 13) {
      return { name: 'Morning Session', icon: Sun, class: 'session-morning' };
    }
    if (hours >= 16 && hours < 23) {
      return { name: 'Evening Session', icon: Moon, class: 'session-evening' };
    }
    return { name: 'General Hours', icon: Sparkles, class: 'session-general' };
  };

  const session = getSessionInfo();

  // Generate QR Code image from token string
  const renderQrCode = async (tokenString) => {
    try {
      const url = await QRCode.toDataURL(tokenString, {
        width: 380,
        margin: 2,
        color: {
          dark: '#070b14',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR data URL:', err);
    }
  };

  // Fetch or renew token
  const fetchActiveToken = useCallback(
    async (forceRotate = false) => {
      setError('');
      if (forceRotate) {
        setIsRotating(true);
      }

      try {
        const token = user ? await user.getIdToken() : null;
        let data;

        if (forceRotate) {
          data = await rotateQrToken(token, { ttlSeconds: 60 });
        } else {
          data = await getCurrentQrToken(token);
        }

        setTokenData(data);
        const remaining = data.expiresInSeconds || 60;
        setTimeLeft(remaining);
        setInitialDuration(remaining > 0 ? remaining : 60);

        if (data.token) {
          await renderQrCode(data.token);
        }
      } catch (err) {
        console.error('Error fetching rotating QR token:', err);
        setError(
          err.message || 'Failed to connect to QR service. Retrying in a few seconds...'
        );
      } finally {
        setIsLoading(false);
        setIsRotating(false);
      }
    },
    [user]
  );

  // Initial load
  useEffect(() => {
    fetchActiveToken(false);
  }, [fetchActiveToken]);

  // Clock interval (updates every second)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Countdown timer for rotating QR
  useEffect(() => {
    if (isLoading || !tokenData) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Token expired — automatically fetch fresh rotating token
          fetchActiveToken(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isLoading, tokenData, fetchActiveToken]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Copy token for debug/testing
  const handleCopyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Progress percentage calculation
  const progressPercent = Math.max(
    0,
    Math.min(100, (timeLeft / (initialDuration || 60)) * 100)
  );
  const isExpiringSoon = timeLeft <= 10;

  return (
    <div
      className={`gym-qr-page ${isFullscreen ? 'fullscreen-kiosk' : ''}`}
      ref={containerRef}
    >
      <div className="gym-qr-card">
        {/* Top Header & Session Bar */}
        <div className="gym-qr-header">
          <div className="gym-brand-group">
            <span className="brand-pill">
              <ShieldCheck size={14} /> LIVE ATTENDANCE GATEWAY
            </span>
            <h1 className="gym-name">FITMAX FITNESS CLUB</h1>
            <p className="gym-tagline">Entrance Turnstile & Reception Kiosk</p>
          </div>

          <div className="gym-meta-bar">
            <div className={`session-badge ${session.class}`}>
              <session.icon size={15} />
              <span>{session.name}</span>
            </div>

            <div className="clock-badge">
              <Clock size={15} />
              <span>
                {currentTime.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="gym-qr-error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              className="btn-retry"
              onClick={() => fetchActiveToken(true)}
            >
              Retry
            </button>
          </div>
        )}

        {/* QR Code Container */}
        <div className="qr-viewport-wrapper">
          <div className="qr-scan-frame">
            {/* Viewfinder corner brackets */}
            <span className="bracket bracket-tl" />
            <span className="bracket bracket-tr" />
            <span className="bracket bracket-bl" />
            <span className="bracket bracket-br" />

            {qrDataUrl ? (
              <div className="qr-image-box">
                <img
                  src={qrDataUrl}
                  alt="Live Gym Attendance Rotating QR"
                  className="qr-image"
                />
              </div>
            ) : (
              <div className="qr-loading-placeholder">
                <RefreshCw size={36} className="animate-spin text-primary" />
                <p>{isLoading ? 'Generating secure entrance QR...' : 'Waiting for QR token...'}</p>
              </div>
            )}
          </div>

          {/* Scanner Instructions */}
          <div className="qr-instructions">
            <p className="instruction-primary">Scan with FitMax Member App</p>
            <p className="instruction-secondary">
              Point your phone camera to instantly record your daily gym check-in
            </p>
          </div>
        </div>

        {/* Rotation & Expiration Countdown Progress */}
        <div className="qr-countdown-section">
          <div className="countdown-info-row">
            <span className="countdown-label">
              <RefreshCw
                size={14}
                className={isRotating || isExpiringSoon ? 'animate-spin' : ''}
              />
              {isExpiringSoon ? 'Rotating shortly...' : 'Token refreshes automatically'}
            </span>
            <span
              className={`countdown-value ${isExpiringSoon ? 'expiring-soon' : ''}`}
            >
              {timeLeft}s
            </span>
          </div>

          <div className="progress-track">
            <div
              className={`progress-fill ${isExpiringSoon ? 'fill-warning' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="gym-qr-footer">
          <div className="footer-token-info">
            <span className="token-label">Security Nonce:</span>
            <code className="token-nonce">
              {tokenData?.nonce ? `${tokenData.nonce.slice(0, 12)}...` : 'Generating...'}
            </code>
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={handleCopyToken}
              title="Copy token string"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="footer-controls">
            <button
              type="button"
              className="btn btn-control"
              onClick={() => fetchActiveToken(true)}
              disabled={isRotating}
              title="Force rotate new QR token"
            >
              <RefreshCw size={16} className={isRotating ? 'animate-spin' : ''} />
              <span>Rotate QR</span>
            </button>

            <button
              type="button"
              className="btn btn-control"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Kiosk Mode' : 'Kiosk Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'Exit Kiosk' : 'Kiosk Mode'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
