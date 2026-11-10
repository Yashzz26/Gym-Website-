import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Clock,
  QrCode,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getGymSettings, updateGymSettings } from '../../services/settingsService';
import './GymSettingsPage.css';

const DEFAULT_FORM_STATE = {
  gymName: 'IronPulse Fitness Club',
  logoUrl: '',
  address: 'Plot 42, Commercial Main Road, Bengaluru, Karnataka 560102',
  phone: '+91 98765 43210',
  email: 'contact@ironpulse.fit',
  gstin: '29ABCDE1234F1Z5',
  upiId: 'ironpulse@upi',
  timezone: 'Asia/Kolkata',
  operatingHours: {
    openingTime: '05:30',
    closingTime: '22:30',
  },
  morningSession: {
    startTime: '06:00',
    endTime: '12:00',
  },
  eveningSession: {
    startTime: '16:00',
    endTime: '22:00',
  },
  qrRefreshIntervalSeconds: 300,
};

export default function GymSettingsPage({ initialData = null }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialData || DEFAULT_FORM_STATE);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (initialData) return;

    let isMounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const token = user?.getIdToken ? await user.getIdToken() : null;
        const data = await getGymSettings(token);
        if (isMounted && data) {
          setFormData((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        if (isMounted) {
          // If offline or first run, fallback to defaults
          console.warn('[GymSettingsPage] Using local defaults:', err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [user, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNestedChange = (parentKey, childKey, value) => {
    setFormData((prev) => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const payload = {
        ...formData,
        qrRefreshIntervalSeconds: Number(formData.qrRefreshIntervalSeconds) || 300,
      };

      const result = await updateGymSettings(payload, token);
      if (result) {
        setFormData((prev) => ({ ...prev, ...result }));
      }
      setFeedback({
        type: 'success',
        message: 'Gym profile and session operating settings updated successfully.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update settings. Please check your inputs.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="gym-settings-page" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading gym configuration…</p>
      </div>
    );
  }

  return (
    <div className="gym-settings-page">
      {/* Header */}
      <div className="settings-header">
        <h1>
          <Settings size={26} color="var(--color-accent)" />
          <span>Gym Profile & Operating Settings</span>
        </h1>
        <p>
          Configure your business profile, morning and evening session definitions, and attendance QR parameters.
        </p>
      </div>

      {/* Feedback Alerts */}
      {feedback.message && (
        <div className={`settings-alert ${feedback.type}`} role="alert">
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="settings-form">
        {/* Section 1: Business Profile */}
        <div className="settings-section-card">
          <div className="settings-section-title">
            <div className="settings-section-icon">
              <Building2 size={18} />
            </div>
            <span>Gym Profile & Contact Details</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="gymName">Gym Brand Name *</label>
              <input
                id="gymName"
                name="gymName"
                type="text"
                className="form-input"
                required
                value={formData.gymName || ''}
                onChange={handleChange}
                placeholder="e.g. IronPulse Fitness Club"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Official Phone / WhatsApp *</label>
              <input
                id="phone"
                name="phone"
                type="text"
                className="form-input"
                required
                value={formData.phone || ''}
                onChange={handleChange}
                placeholder="+91 98765 43210"
              />
              <span className="form-help-text">Used for member communication & WhatsApp alerts</span>
            </div>

            <div className="form-group">
              <label htmlFor="email">Support Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                value={formData.email || ''}
                onChange={handleChange}
                placeholder="contact@gym.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="upiId">Official UPI ID (VPA)</label>
              <input
                id="upiId"
                name="upiId"
                type="text"
                className="form-input"
                value={formData.upiId || ''}
                onChange={handleChange}
                placeholder="gymname@okaxis"
              />
              <span className="form-help-text">Displayed on desk QR and payment receipts</span>
            </div>

            <div className="form-group">
              <label htmlFor="gstin">GSTIN Number (Optional)</label>
              <input
                id="gstin"
                name="gstin"
                type="text"
                className="form-input"
                value={formData.gstin || ''}
                onChange={handleChange}
                placeholder="29ABCDE1234F1Z5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="timezone">Operational Timezone</label>
              <input
                id="timezone"
                name="timezone"
                type="text"
                className="form-input"
                value={formData.timezone || 'Asia/Kolkata'}
                disabled
              />
              <span className="form-help-text">Enforced server-side per ADR 004</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Physical Address *</label>
            <input
              id="address"
              name="address"
              type="text"
              className="form-input"
              required
              value={formData.address || ''}
              onChange={handleChange}
              placeholder="Building, street, area, city, pincode"
            />
          </div>
        </div>

        {/* Section 2: Operating Hours & Session Windows */}
        <div className="settings-section-card">
          <div className="settings-section-title">
            <div className="settings-section-icon">
              <Clock size={18} />
            </div>
            <span>Operating Hours & Session Windows</span>
          </div>

          <p className="form-help-text">
            Session windows automatically classify member attendance check-ins into Morning or Evening slots.
          </p>

          <div className="form-grid-2">
            {/* Overall Hours */}
            <div className="session-block">
              <div className="session-block-header">
                <span className="session-block-title">Daily Operating Hours</span>
                <span className="session-badge">Facility</span>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="openingTime">Facility Open (HH:mm)</label>
                  <input
                    id="openingTime"
                    type="time"
                    className="form-input"
                    value={formData.operatingHours?.openingTime || '05:30'}
                    onChange={(e) => handleNestedChange('operatingHours', 'openingTime', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="closingTime">Facility Close (HH:mm)</label>
                  <input
                    id="closingTime"
                    type="time"
                    className="form-input"
                    value={formData.operatingHours?.closingTime || '22:30'}
                    onChange={(e) => handleNestedChange('operatingHours', 'closingTime', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Morning Session */}
            <div className="session-block">
              <div className="session-block-header">
                <span className="session-block-title">Morning Session</span>
                <span className="session-badge">Slot 1</span>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="morningStart">Start Time</label>
                  <input
                    id="morningStart"
                    type="time"
                    className="form-input"
                    value={formData.morningSession?.startTime || '06:00'}
                    onChange={(e) => handleNestedChange('morningSession', 'startTime', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="morningEnd">End Time</label>
                  <input
                    id="morningEnd"
                    type="time"
                    className="form-input"
                    value={formData.morningSession?.endTime || '12:00'}
                    onChange={(e) => handleNestedChange('morningSession', 'endTime', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Evening Session */}
            <div className="session-block">
              <div className="session-block-header">
                <span className="session-block-title">Evening Session</span>
                <span className="session-badge">Slot 2</span>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="eveningStart">Start Time</label>
                  <input
                    id="eveningStart"
                    type="time"
                    className="form-input"
                    value={formData.eveningSession?.startTime || '16:00'}
                    onChange={(e) => handleNestedChange('eveningSession', 'startTime', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="eveningEnd">End Time</label>
                  <input
                    id="eveningEnd"
                    type="time"
                    className="form-input"
                    value={formData.eveningSession?.endTime || '22:00'}
                    onChange={(e) => handleNestedChange('eveningSession', 'endTime', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* QR Security */}
            <div className="session-block">
              <div className="session-block-header">
                <span className="session-block-title">QR Security & Rotation</span>
                <span className="session-badge">ADR 002</span>
              </div>
              <div className="form-group">
                <label htmlFor="qrRefreshIntervalSeconds">QR Token Expiry (Seconds)</label>
                <input
                  id="qrRefreshIntervalSeconds"
                  name="qrRefreshIntervalSeconds"
                  type="number"
                  min="60"
                  max="3600"
                  className="form-input"
                  value={formData.qrRefreshIntervalSeconds || 300}
                  onChange={handleChange}
                />
                <span className="form-help-text">Tokens rotate every 300s (5m) to prevent proxy scans</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            className="save-settings-btn"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Saving Settings…</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
