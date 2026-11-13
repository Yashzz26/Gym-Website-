import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  Clock,
  CreditCard,
  ArrowRight,
  History,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserMemberships, renewMembership } from '../../services/membershipService';
import { listPlans } from '../../services/planService';
import './MemberProfilePage.css';

function formatPrice(paise) {
  if (typeof paise !== 'number') return '₹0';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export default function MemberProfilePage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isStaff = ['owner', 'reception', 'trainer'].includes(profile?.role);
  const targetUserId = (isStaff && searchParams.get('userId')) || user?.uid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [membershipData, setMembershipData] = useState({
    activeMembership: null,
    history: [],
    totalMemberships: 0,
  });

  // Renewal form state
  const [showRenewalBox, setShowRenewalBox] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [renewing, setRenewing] = useState(false);

  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    try {
      setLoading(true);
      setError('');
      const token = user ? await user.getIdToken() : null;

      const data = await getUserMemberships(targetUserId, token);
      setMembershipData(data || { activeMembership: null, history: [], totalMemberships: 0 });

      // If active plan exists, default selectedPlanId to active planId
      if (data?.activeMembership?.planId) {
        setSelectedPlanId(data.activeMembership.planId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load membership data');
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load plans when renewal box is opened
  const handleOpenRenewal = async () => {
    setShowRenewalBox(true);
    setSuccessMsg('');
    setError('');
    try {
      const token = user ? await user.getIdToken() : null;
      const plans = await listPlans({ activeOnly: true }, token);
      setAvailablePlans(plans || []);
      if (!selectedPlanId && plans?.length > 0) {
        setSelectedPlanId(plans[0].planId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load membership plans');
    }
  };

  const handleConfirmRenewal = async (e) => {
    e.preventDefault();
    if (!membershipData.activeMembership?.membershipId) {
      setError('No existing membership available to renew');
      return;
    }

    try {
      setRenewing(true);
      setError('');
      setSuccessMsg('');
      const token = user ? await user.getIdToken() : null;

      await renewMembership(
        membershipData.activeMembership.membershipId,
        {
          planId: selectedPlanId,
          paymentMethod,
          paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
        },
        token
      );

      setSuccessMsg('Membership renewed successfully! Validity extended.');
      setShowRenewalBox(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to complete renewal');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="member-profile-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem', color: '#0066ff' }} size={32} />
        <p style={{ color: '#94a3b8' }}>Loading member profile & subscription details…</p>
      </div>
    );
  }

  const { activeMembership, history } = membershipData;
  const isExpiringSoon =
    activeMembership &&
    activeMembership.status === 'active' &&
    activeMembership.daysRemaining !== undefined &&
    activeMembership.daysRemaining <= 7;

  // Calculate progress %
  let progressPercent = 0;
  if (activeMembership?.startDate && activeMembership?.endDate) {
    const start = new Date(activeMembership.startDate).getTime();
    const end = new Date(activeMembership.endDate).getTime();
    const now = Date.now();
    const total = end - start;
    const elapsed = Math.max(0, now - start);
    progressPercent = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
  }

  return (
    <div className="member-profile-container">
      <div className="profile-header">
        <h1>Member Profile & Membership</h1>
        <p>Manage your account, active subscription status, and full renewal history.</p>
      </div>

      {successMsg && (
        <div className="alert-box success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert-box error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="profile-grid">
        {/* Left Column: User Profile Overview */}
        <div className="profile-card">
          <div className="profile-avatar-row">
            <div className="profile-avatar">
              {(profile?.displayName || user?.displayName || 'M')[0].toUpperCase()}
            </div>
            <div className="profile-name-info">
              <h2>{profile?.displayName || user?.displayName || 'Gym Member'}</h2>
              <span className="profile-role-badge">
                <ShieldCheck size={12} />
                {profile?.role || 'member'}
              </span>
            </div>
          </div>

          <div className="profile-details-list">
            <div className="profile-detail-item">
              <Mail size={16} />
              <div className="profile-detail-content">
                <span className="profile-detail-label">Email</span>
                <span>{profile?.email || user?.email || '—'}</span>
              </div>
            </div>

            <div className="profile-detail-item">
              <Phone size={16} />
              <div className="profile-detail-content">
                <span className="profile-detail-label">Phone</span>
                <span>{profile?.phone || 'Not provided'}</span>
              </div>
            </div>

            <div className="profile-detail-item">
              <User size={16} />
              <div className="profile-detail-content">
                <span className="profile-detail-label">Gender</span>
                <span style={{ textTransform: 'capitalize' }}>{profile?.gender || 'Not specified'}</span>
              </div>
            </div>

            {profile?.emergencyContact && (
              <div className="profile-detail-item">
                <ShieldCheck size={16} />
                <div className="profile-detail-content">
                  <span className="profile-detail-label">Emergency Contact</span>
                  <span>
                    {profile.emergencyContact.name || 'Contact'} ({profile.emergencyContact.relation || 'Relative'}):{' '}
                    {profile.emergencyContact.phone || '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="profile-detail-item">
              <Calendar size={16} />
              <div className="profile-detail-content">
                <span className="profile-detail-label">Account Status</span>
                <span style={{ textTransform: 'capitalize', color: profile?.approvalStatus === 'active' ? '#4ade80' : '#facc15' }}>
                  {profile?.approvalStatus || 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Membership & Renewal History */}
        <div className="membership-column">
          {/* Active / Current Membership Card */}
          {activeMembership ? (
            <div className="active-membership-card">
              <div className="card-top-row">
                <div className="plan-title-area">
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Current Subscription
                  </span>
                  <h3>{activeMembership.planName || 'Gym Membership'}</h3>
                  <div className="plan-price-tag">{formatPrice(activeMembership.priceInPaise)}</div>
                </div>

                <div>
                  <span className={`status-badge ${activeMembership.status}`}>
                    {activeMembership.status === 'active' && <CheckCircle2 size={14} />}
                    {activeMembership.status === 'expired' && <AlertTriangle size={14} />}
                    {activeMembership.status === 'payment_pending' && <Clock size={14} />}
                    <span style={{ textTransform: 'capitalize' }}>
                      {activeMembership.status.replace('_', ' ')}
                    </span>
                  </span>
                </div>
              </div>

              {isExpiringSoon && (
                <div className="alert-box error" style={{ marginBottom: '1rem' }}>
                  <AlertTriangle size={18} />
                  <span>Your membership expires in {activeMembership.daysRemaining} days! Renew now to keep uninterrupted access.</span>
                </div>
              )}

              <div className="membership-stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Start Date</span>
                  <span className="stat-value">{formatDate(activeMembership.startDate)}</span>
                </div>

                <div className="stat-item">
                  <span className="stat-label">End Date / Expiry</span>
                  <span className="stat-value">{formatDate(activeMembership.endDate)}</span>
                </div>

                <div className="stat-item">
                  <span className="stat-label">Days Remaining</span>
                  <span className="stat-value highlight">
                    {activeMembership.isExpired ? 'Expired' : `${activeMembership.daysRemaining || 0} days`}
                  </span>
                </div>

                <div className="stat-item">
                  <span className="stat-label">Payment Method</span>
                  <span className="stat-value" style={{ textTransform: 'uppercase' }}>
                    {activeMembership.paymentMethod || 'Online'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-container">
                <div className="progress-header">
                  <span>Membership Period Progress</span>
                  <span>{progressPercent}% Elapsed</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Card Actions */}
              <div className="membership-card-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOpenRenewal}
                >
                  <Sparkles size={16} />
                  Renew / Extend Membership
                </button>
              </div>

              {/* Interactive Renewal Box */}
              {showRenewalBox && (
                <form className="renewal-box" onSubmit={handleConfirmRenewal}>
                  <h4>
                    <RefreshCw size={18} />
                    Choose Plan & Renew Membership
                  </h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    Renewing now extends your validity seamlessly from your current expiry date.
                  </p>

                  <div className="renewal-plans-row">
                    {availablePlans.map((plan) => (
                      <div
                        key={plan.planId}
                        className={`renewal-plan-option ${selectedPlanId === plan.planId ? 'selected' : ''}`}
                        onClick={() => setSelectedPlanId(plan.planId)}
                        role="button"
                        tabIndex={0}
                      >
                        <strong style={{ color: '#ffffff' }}>{plan.name}</strong>
                        <span style={{ color: '#38bdf8', fontWeight: '700' }}>
                          {formatPrice(plan.priceInPaise)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {plan.durationDays} Days Duration
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ margin: '1rem 0' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{
                        background: '#090d16',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        width: '100%',
                        maxWidth: '240px',
                      }}
                    >
                      <option value="online">Online Payment (Card/UPI)</option>
                      <option value="cash">Cash at Reception</option>
                      <option value="upi">Direct UPI Transfer</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={renewing || !selectedPlanId}
                    >
                      {renewing ? 'Processing Renewal…' : 'Confirm & Renew Now'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowRenewalBox(false)}
                      disabled={renewing}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="empty-membership-box">
              <CreditCard size={48} style={{ color: '#0066ff' }} />
              <h3>No Active Membership Found</h3>
              <p>
                You do not have an active gym membership at the moment. Explore our membership tiers
                and start your fitness journey today!
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/member/join')}
              >
                Choose Membership Plan
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Renewal & Membership History Timeline */}
          <div className="history-section">
            <div className="history-header">
              <h3>
                <History size={20} style={{ color: '#0066ff' }} />
                Membership & Renewal History
              </h3>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {history.length} {history.length === 1 ? 'Period' : 'Periods'} Recorded
              </span>
            </div>

            {history.length > 0 ? (
              <div className="history-timeline">
                {history.map((record) => (
                  <div key={record.membershipId} className="timeline-item">
                    <div className={`timeline-dot ${record.status === 'active' ? 'active' : ''}`} />
                    <div className="timeline-content-top">
                      <div className="timeline-plan-title">
                        {record.planName || 'Gym Plan'}
                        {record.renewedFrom && (
                          <span className="renewed-badge">
                            Renewed from #{record.renewedFrom.slice(-6)}
                          </span>
                        )}
                      </div>
                      <span className={`status-badge ${record.status}`}>
                        <span style={{ textTransform: 'capitalize' }}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </span>
                    </div>

                    <div className="timeline-details">
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>PERIOD</span>
                        <span>{formatDate(record.startDate)} – {formatDate(record.endDate)}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>DURATION</span>
                        <span>{record.durationDays} Days</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>FEE</span>
                        <span style={{ color: '#38bdf8', fontWeight: '600' }}>
                          {formatPrice(record.priceInPaise)}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>METHOD</span>
                        <span style={{ textTransform: 'uppercase' }}>
                          {record.paymentMethod || 'Online'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No prior membership periods on record.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
