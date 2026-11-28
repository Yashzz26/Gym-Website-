import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserMemberships, renewMembership } from '../../services/membershipService';
import { listPlans } from '../../services/planService';
import {
  PageHeader,
  StatusTag,
  ProgressBar,
  StatePanel,
} from '../../components/member/MemberUI';
import {
  formatInrFromPaise,
  formatDisplayDate,
  formatPaymentMethod,
} from '../../utils/memberFormat';
import './MemberProfilePage.css';

function getMembershipStatusVariant(status) {
  if (status === 'active') return 'success';
  if (status === 'payment_pending') return 'warning';
  if (status === 'expired') return 'danger';
  return 'neutral';
}

function formatStatusLabel(status) {
  if (!status) return 'Unknown';
  const normalized = String(status).replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

      setSuccessMsg('Membership renewed and validity extended.');
      setShowRenewalBox(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to complete renewal');
    } finally {
      setRenewing(false);
    }
  };

  const { activeMembership, history } = membershipData;
  const effectiveSubStatus = activeMembership
    ? activeMembership.isExpired && activeMembership.status !== 'payment_pending'
      ? 'expired'
      : activeMembership.status
    : 'unregistered';

  const isExpiringSoon =
    activeMembership &&
    effectiveSubStatus === 'active' &&
    activeMembership.daysRemaining !== undefined &&
    activeMembership.daysRemaining <= 7;

  let progressPercent = 0;
  let totalDaysCount = activeMembership?.durationDays || 0;
  if (activeMembership?.startDate && activeMembership?.endDate) {
    const start = new Date(activeMembership.startDate).getTime();
    const end = new Date(activeMembership.endDate).getTime();
    const total = end - start;
    if (total > 0 && activeMembership.daysRemaining !== undefined) {
      totalDaysCount = Math.max(1, Math.round(total / (1000 * 60 * 60 * 24)));
      const daysPassed = Math.max(0, totalDaysCount - activeMembership.daysRemaining);
      progressPercent = Math.min(100, Math.round((daysPassed / totalDaysCount) * 100));
    }
  }

  const displayName = profile?.displayName || user?.displayName || 'Gym Member';
  const avatarInitial = displayName[0]?.toUpperCase() || 'M';
  const accountStatus = profile?.approvalStatus || 'active';

  if (loading) {
    return (
      <div className="member-page">
        <PageHeader
          title="My Membership"
          subtitle="Account details, active plan validity, and renewal history"
        />
        <StatePanel
          icon={RefreshCw}
          spinIcon
          title="Loading membership details"
          description="Fetching your account profile and subscription records."
        />
      </div>
    );
  }

  return (
    <div className="member-page">
      <PageHeader
        title="My Membership"
        subtitle="Account details, active plan validity, and renewal history"
      />

      {successMsg && (
        <div className="member-alert is-success" role="status">
          <div className="member-alert-body">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="member-alert is-error" role="alert">
          <div className="member-alert-body">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="membership-workspace-grid">
        {/* Left Column: Member Identity & Information Rows */}
        <aside className="member-panel profile-summary-panel" aria-label="Member Profile">
          <div className="profile-identity-head">
            <div className="profile-avatar-mark" aria-hidden="true">
              {avatarInitial}
            </div>
            <div className="profile-identity-text">
              <h2 className="profile-display-name">{displayName}</h2>
              <span className="profile-role-text">{profile?.role || 'member'}</span>
            </div>
          </div>

          <dl className="profile-info-list">
            <div className="profile-info-row">
              <dt>Email</dt>
              <dd>{profile?.email || user?.email || '—'}</dd>
            </div>

            <div className="profile-info-row">
              <dt>Phone</dt>
              <dd className="tabular-nums">{profile?.phone || 'Not provided'}</dd>
            </div>

            <div className="profile-info-row">
              <dt>Gender</dt>
              <dd className="capitalize-text">{profile?.gender || 'Not specified'}</dd>
            </div>

            {profile?.emergencyContact && (
              <div className="profile-info-row">
                <dt>Emergency contact</dt>
                <dd>
                  {profile.emergencyContact.name || 'Contact'} (
                  {profile.emergencyContact.relation || 'Relative'}):{' '}
                  {profile.emergencyContact.phone || '—'}
                </dd>
              </div>
            )}

            <div className="profile-info-row">
              <dt>Account status</dt>
              <dd>
                <StatusTag variant={accountStatus === 'active' ? 'success' : 'warning'}>
                  {formatStatusLabel(accountStatus)} account
                </StatusTag>
              </dd>
            </div>
            <div className="profile-info-row">
              <dt>Subscription status</dt>
              <dd>
                <StatusTag variant={getMembershipStatusVariant(effectiveSubStatus)}>
                  {effectiveSubStatus === 'unregistered'
                    ? 'Not enrolled'
                    : formatStatusLabel(effectiveSubStatus)}
                </StatusTag>
              </dd>
            </div>
          </dl>
        </aside>

        {/* Right Column: Subscription Focus + Membership History */}
        <div className="membership-main-column">
          {activeMembership ? (
            <section className="member-panel subscription-focus-panel" aria-label="Current Membership">
              <div className="subscription-head">
                <div className="subscription-title-block">
                  <span className="subscription-eyebrow">Current subscription</span>
                  <div className="subscription-name-row">
                    <h3>{activeMembership.planName || 'Gym Membership'}</h3>
                    <StatusTag variant={getMembershipStatusVariant(effectiveSubStatus)}>
                      {formatStatusLabel(effectiveSubStatus)}
                    </StatusTag>
                  </div>
                </div>
                <div className="subscription-price tabular-nums">
                  {formatInrFromPaise(activeMembership.priceInPaise)}
                </div>
              </div>

              {isExpiringSoon && (
                <div className="member-alert is-warning" role="status">
                  <div className="member-alert-body">
                    <AlertTriangle size={16} />
                    <span>
                      Membership expires in {activeMembership.daysRemaining} days. Renew to keep uninterrupted gym access.
                    </span>
                  </div>
                </div>
              )}

              {effectiveSubStatus === 'payment_pending' && (
                <div className="member-alert is-warning" role="status">
                  <div className="member-alert-body">
                    <AlertCircle size={16} />
                    <span>
                      Payment verification is pending for this subscription. Complete online checkout or settle at reception.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/member/join')}
                  >
                    <span>Complete Payment</span>
                  </button>
                </div>
              )}

              <dl className="subscription-metrics-grid">
                <div className="subscription-metric-cell">
                  <dt>Start date</dt>
                  <dd className="tabular-nums no-wrap-date">
                    {formatDisplayDate(activeMembership.startDate)}
                  </dd>
                </div>

                <div className="subscription-metric-cell">
                  <dt>Expiry date</dt>
                  <dd className="tabular-nums no-wrap-date">
                    {formatDisplayDate(activeMembership.endDate)}
                  </dd>
                </div>

                <div className="subscription-metric-cell">
                  <dt>Remaining</dt>
                  <dd
                    className={`tabular-nums ${
                      activeMembership.isExpired ? 'is-expired-text' : 'is-highlight-text'
                    }`}
                  >
                    {activeMembership.isExpired
                      ? 'Expired'
                      : `${activeMembership.daysRemaining ?? 0} days`}
                  </dd>
                </div>

                <div className="subscription-metric-cell">
                  <dt>Payment method</dt>
                  <dd>{formatPaymentMethod(activeMembership.paymentMethod)}</dd>
                </div>
              </dl>

              <ProgressBar
                label="Membership Period Progress"
                value={progressPercent}
                valueText={
                  totalDaysCount > 0
                    ? `${progressPercent}% elapsed · ${totalDaysCount}d cycle`
                    : `${progressPercent}% elapsed`
                }
                variant={isExpiringSoon ? 'warning' : 'accent'}
              />

              <div className="subscription-actions-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenRenewal}
                  disabled={renewing}
                >
                  <RefreshCw size={16} />
                  <span>Renew / Extend Membership</span>
                </button>
              </div>

              {showRenewalBox && (
                <form className="renewal-drawer" onSubmit={handleConfirmRenewal}>
                  <div className="renewal-drawer-head">
                    <h4>Choose Plan &amp; Renew Membership</h4>
                    <p>Extends validity seamlessly from your current expiry date.</p>
                  </div>

                  <div className="renewal-plans-grid">
                    {availablePlans.map((plan) => {
                      const isSelected = selectedPlanId === plan.planId;
                      return (
                        <button
                          key={plan.planId}
                          type="button"
                          className={`renewal-plan-choice ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedPlanId(plan.planId)}
                          aria-pressed={isSelected}
                        >
                          <span className="renewal-plan-name">{plan.name}</span>
                          <span className="renewal-plan-price tabular-nums">
                            {formatInrFromPaise(plan.priceInPaise)}
                          </span>
                          <span className="renewal-plan-duration tabular-nums">
                            {plan.durationDays} days
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="renewal-payment-row">
                    <label htmlFor="renewal-payment-method">Payment method</label>
                    <select
                      id="renewal-payment-method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="online">Online Payment (Card/UPI)</option>
                      <option value="cash">Cash at Reception</option>
                      <option value="upi">Direct UPI Transfer</option>
                    </select>
                  </div>

                  <div className="renewal-drawer-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={renewing || !selectedPlanId}
                    >
                      {renewing ? 'Processing Renewal…' : 'Confirm & Renew Now'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowRenewalBox(false)}
                      disabled={renewing}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          ) : (
            <StatePanel
              icon={CreditCard}
              title="No Active Membership Found"
              description="You do not have an active gym membership right now. Compare plans and complete enrollment online."
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('/member/join')}
                >
                  <span>Choose Membership Plan</span>
                  <ArrowRight size={16} />
                </button>
              }
            />
          )}

          {/* Membership & Renewal History */}
          <section className="member-panel history-panel" aria-label="Membership History">
            <div className="member-section-header">
              <h3 className="member-section-title">Membership &amp; Renewal History</h3>
              <span className="member-section-meta tabular-nums">
                {history.length} {history.length === 1 ? 'Period' : 'Periods'} Recorded
              </span>
            </div>

            {history.length > 0 ? (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Period</th>
                      <th>Duration</th>
                      <th className="align-right">Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr key={record.membershipId}>
                        <td data-label="Plan">
                          <div className="history-plan-cell">
                            <span className="history-plan-name">
                              {record.planName || 'Gym Plan'}
                            </span>
                            {record.renewedFrom && (
                              <span className="history-renewed-ref">
                                Renewed from #{record.renewedFrom.slice(-6)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Period" className="tabular-nums no-wrap-date">
                          {formatDisplayDate(record.startDate)} – {formatDisplayDate(record.endDate)}
                        </td>
                        <td data-label="Duration" className="tabular-nums">
                          {record.durationDays} days
                        </td>
                        <td data-label="Amount" className="align-right tabular-nums history-amount">
                          {formatInrFromPaise(record.priceInPaise)}
                        </td>
                        <td data-label="Method">{formatPaymentMethod(record.paymentMethod)}</td>
                        <td data-label="Status">
                          <StatusTag variant={getMembershipStatusVariant(record.status)}>
                            {formatStatusLabel(record.status)}
                          </StatusTag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="history-empty-note">No prior membership periods on record.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
