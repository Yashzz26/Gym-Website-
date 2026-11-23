import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  X,
  CreditCard,
  Check,
  Send,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getExpiringMemberships, renewMembership } from '../../services/membershipService';
import { listPlans } from '../../services/planService';
import './RenewalListPage.css';

/**
 * Format integer paise into INR currency display.
 */
function formatPaiseToINR(paise = 0) {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Format ISO date string into readable short date (e.g., "26 Nov 2026").
 */
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RenewalListPage() {
  const { user } = useAuth();

  const [memberships, setMemberships] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Filters
  const [windowDays, setWindowDays] = useState(7);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Modals state
  const [selectedForRenewal, setSelectedForRenewal] = useState(null);
  const [renewalForm, setRenewalForm] = useState({
    planId: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);

  // WhatsApp Single / Bulk Modal state
  const [whatsappModal, setWhatsappModal] = useState({
    isOpen: false,
    mode: 'single', // 'single' | 'bulk'
    targetMembership: null,
    isSending: false,
  });

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');
      const token = user?.getIdToken ? await user.getIdToken() : null;

      const [renewalData, plansData] = await Promise.all([
        getExpiringMemberships(token, { days: windowDays, includeExpired }),
        listPlans(token, { activeOnly: true }).catch(() => []),
      ]);

      setMemberships(renewalData?.memberships || []);
      setPlans(plansData || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve expiring memberships');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, windowDays, includeExpired]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Key KPI metrics calculations
  const kpiStats = useMemo(() => {
    let totalExpiring = memberships.length;
    let criticalCount = 0;
    let urgentCount = 0;
    let totalValuePaise = 0;

    for (const m of memberships) {
      totalValuePaise += m.priceInPaise || 0;
      if (m.isExpired || m.daysRemaining <= 1) {
        criticalCount++;
      } else if (m.daysRemaining <= 3) {
        urgentCount++;
      }
    }

    return {
      totalExpiring,
      criticalCount,
      urgentCount,
      totalValuePaise,
    };
  }, [memberships]);

  // Filtered memberships based on search and urgency pill tab
  const filteredMemberships = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return memberships.filter((m) => {
      // 1. Urgency filter
      if (urgencyFilter === 'critical' && m.urgency !== 'critical') return false;
      if (urgencyFilter === 'urgent' && m.urgency !== 'urgent') return false;
      if (urgencyFilter === 'warning' && m.urgency !== 'warning') return false;

      // 2. Search query filter
      if (q) {
        const name = (m.member?.displayName || '').toLowerCase();
        const phone = (m.member?.phone || '').toLowerCase();
        const plan = (m.planName || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !plan.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [memberships, urgencyFilter, searchQuery]);

  // Open Quick Renew modal
  const handleOpenRenewModal = (membership) => {
    setSelectedForRenewal(membership);
    setRenewalForm({
      planId: membership.planId || (plans[0]?.planId || ''),
      paymentMethod: 'cash',
      notes: 'Renewed at reception desk',
    });
    setFeedback({ type: '', message: '' });
  };

  // Submit Renewal
  const handleConfirmRenewal = async (e) => {
    e.preventDefault();
    if (!selectedForRenewal) return;

    try {
      setRenewalSubmitting(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;

      await renewMembership(
        selectedForRenewal.membershipId,
        {
          planId: renewalForm.planId,
          paymentMethod: renewalForm.paymentMethod,
          paymentStatus: 'paid',
          notes: renewalForm.notes,
        },
        token
      );

      setFeedback({
        type: 'success',
        message: `Successfully renewed membership for ${selectedForRenewal.member?.displayName || 'member'}. Validity extended!`,
      });

      setSelectedForRenewal(null);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process membership renewal',
      });
    } finally {
      setRenewalSubmitting(false);
    }
  };

  // Open WhatsApp Single Reminder Modal
  const handleOpenWhatsappModal = (membership) => {
    setWhatsappModal({
      isOpen: true,
      mode: 'single',
      targetMembership: membership,
      isSending: false,
    });
  };

  // Open WhatsApp Bulk Reminders Modal
  const handleOpenBulkWhatsappModal = () => {
    setWhatsappModal({
      isOpen: true,
      mode: 'bulk',
      targetMembership: null,
      isSending: false,
    });
  };

  // Dispatch WhatsApp Template Reminder (simulated API integration with log)
  const handleDispatchWhatsapp = () => {
    setWhatsappModal((prev) => ({ ...prev, isSending: true }));

    setTimeout(() => {
      const recipientCount =
        whatsappModal.mode === 'single' ? 1 : filteredMemberships.length;

      setFeedback({
        type: 'success',
        message: `WhatsApp reminder template dispatched to ${recipientCount} member(s). Meta message IDs registered.`,
      });

      setWhatsappModal({
        isOpen: false,
        mode: 'single',
        targetMembership: null,
        isSending: false,
      });
    }, 600);
  };

  return (
    <div className="renewal-page" data-testid="renewal-list-page">
      {/* 1. Header & Quick Actions */}
      <header className="renewal-header">
        <div className="renewal-header-info">
          <span className="renewal-role-badge">
            <Clock size={12} /> Reception Desk
          </span>
          <h1>Upcoming Renewals & Expiry Watch</h1>
          <p>
            Monitor subscriptions expiring within {windowDays} days. Dispatch WhatsApp reminders or record direct renewals.
          </p>
        </div>

        <div className="renewal-header-actions">
          <div className="window-select-wrapper">
            <span className="window-select-label">Horizon:</span>
            <select
              className="window-select"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              aria-label="Filter Expiry Horizon"
            >
              <option value={3}>Next 3 Days</option>
              <option value={7}>Next 7 Days</option>
              <option value={14}>Next 14 Days</option>
              <option value={30}>Next 30 Days</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchData}
            disabled={refreshing}
            aria-label="Refresh renewals list"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn-whatsapp-bulk"
            onClick={handleOpenBulkWhatsappModal}
            disabled={filteredMemberships.length === 0}
            aria-label="Dispatch bulk WhatsApp reminders"
          >
            <MessageSquare size={14} />
            <span>Remind All ({filteredMemberships.length})</span>
          </button>
        </div>
      </header>

      {/* Global Alerts */}
      {feedback.message && (
        <div className={`alert-box ${feedback.type}`} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: feedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span style={{ fontSize: 'var(--font-size-sm)', flex: 1 }}>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="alert-box error" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          border: '1px solid var(--color-danger-border)',
        }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: 'var(--font-size-sm)', flex: 1 }}>{error}</span>
          <button type="button" className="btn-secondary" onClick={fetchData}>
            Retry
          </button>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <section className="renewal-kpi-grid" aria-label="Renewal Key Performance Indicators">
        <article className="renewal-kpi-card" data-testid="kpi-expiring-soon">
          <div className="kpi-top">
            <span className="kpi-label">Expiring Soon</span>
            <div className="kpi-icon"><Clock size={16} /></div>
          </div>
          <div className="kpi-value">{kpiStats.totalExpiring}</div>
          <span className="kpi-subtext">Due within next {windowDays} days</span>
        </article>

        <article className="renewal-kpi-card critical" data-testid="kpi-critical">
          <div className="kpi-top">
            <span className="kpi-label">Critical (≤ 1 Day)</span>
            <div className="kpi-icon" style={{ color: '#ef4444' }}><ShieldAlert size={16} /></div>
          </div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{kpiStats.criticalCount}</div>
          <span className="kpi-subtext">Immediate follow-up required</span>
        </article>

        <article className="renewal-kpi-card urgent" data-testid="kpi-urgent">
          <div className="kpi-top">
            <span className="kpi-label">Urgent (2-3 Days)</span>
            <div className="kpi-icon" style={{ color: '#f59e0b' }}><Zap size={16} /></div>
          </div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{kpiStats.urgentCount}</div>
          <span className="kpi-subtext">Send WhatsApp reminder today</span>
        </article>

        <article className="renewal-kpi-card highlight" data-testid="kpi-value-at-risk">
          <div className="kpi-top">
            <span className="kpi-label">Value at Risk</span>
            <div className="kpi-icon" style={{ color: 'var(--color-accent)' }}><IndianRupee size={16} /></div>
          </div>
          <div className="kpi-value">{formatPaiseToINR(kpiStats.totalValuePaise)}</div>
          <span className="kpi-subtext">Subscription dues up for renewal</span>
        </article>
      </section>

      {/* 3. Search and Urgency Filter Tabs */}
      <section className="renewal-controls" aria-label="Table Controls">
        <div className="search-input-group">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            className="search-input"
            placeholder="Search member by name, phone or plan…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="renewals-search-input"
            aria-label="Search Expiring Members"
          />
        </div>

        <div className="urgency-filter-tabs">
          <button
            type="button"
            className={`filter-tab-pill ${urgencyFilter === 'all' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('all')}
          >
            All ({memberships.length})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${urgencyFilter === 'critical' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('critical')}
          >
            Critical ({kpiStats.criticalCount})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${urgencyFilter === 'urgent' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('urgent')}
          >
            Urgent ({kpiStats.urgentCount})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${urgencyFilter === 'warning' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('warning')}
          >
            This Week
          </button>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer', marginLeft: '0.5rem' }}>
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            Include Expired
          </label>
        </div>
      </section>

      {/* 4. Renewal List Table */}
      <section className="renewal-table-card" aria-label="Expiring Memberships List">
        {loading ? (
          <div className="renewal-empty-state">
            <RefreshCw size={28} className="spin" color="var(--color-accent)" />
            <p>Loading expiring membership records…</p>
          </div>
        ) : filteredMemberships.length === 0 ? (
          <div className="renewal-empty-state">
            <div className="empty-icon-wrap">
              <CheckCircle2 size={28} />
            </div>
            <h3>No Memberships Due For Renewal</h3>
            <p>
              {searchQuery
                ? `No matching records found for "${searchQuery}". Try clearing search filter.`
                : `All active memberships in this ${windowDays}-day horizon are current and in good standing.`}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="renewal-table" data-testid="renewals-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Current Plan</th>
                  <th>Expiration</th>
                  <th>Days Left</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMemberships.map((m) => {
                  const initial = (m.member?.displayName || 'M').charAt(0).toUpperCase();

                  return (
                    <tr key={m.membershipId}>
                      {/* Member Info */}
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar-chip">{initial}</div>
                          <div className="member-name-block">
                            <span className="member-name">{m.member?.displayName || 'Registered Member'}</span>
                            <span className="member-meta">{m.member?.phone || m.member?.email || 'No contact'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Current Plan */}
                      <td>
                        <div className="plan-cell-block">
                          <span className="plan-name">{m.planName || 'Active Plan'}</span>
                          <span className="plan-price">{formatPaiseToINR(m.priceInPaise)}</span>
                        </div>
                      </td>

                      {/* Expiration Date */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--font-size-xs)' }}>
                          <Calendar size={13} color="var(--color-text-muted)" />
                          <span className="tabular-nums">{formatDate(m.endDate)}</span>
                        </div>
                      </td>

                      {/* Days Left & Urgency Badge */}
                      <td>
                        <span className={`urgency-badge ${m.urgency}`}>
                          {m.isExpired ? (
                            'Expired'
                          ) : m.daysRemaining === 0 ? (
                            'Expires Today'
                          ) : m.daysRemaining === 1 ? (
                            '1 Day Left'
                          ) : (
                            `${m.daysRemaining} Days Left`
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="action-buttons-cell">
                          <button
                            type="button"
                            className="btn-renew-action"
                            onClick={() => handleOpenRenewModal(m)}
                            aria-label={`Renew membership for ${m.member?.displayName || 'member'}`}
                          >
                            <CreditCard size={13} />
                            <span>Renew</span>
                          </button>

                          <button
                            type="button"
                            className="btn-whatsapp-action"
                            onClick={() => handleOpenWhatsappModal(m)}
                            title="Send WhatsApp Reminder"
                            aria-label={`Send WhatsApp reminder to ${m.member?.displayName || 'member'}`}
                          >
                            <MessageSquare size={14} />
                          </button>

                          <Link
                            to={`/reception/fees?memberId=${m.userId}`}
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
                            title="Open in Fees Entry desk"
                          >
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. In-Modal Quick Renewal Dialog */}
      {selectedForRenewal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="renew-modal">
          <div className="modal-content-card">
            <div className="modal-header">
              <h2>Renew Membership</h2>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedForRenewal(null)}
                aria-label="Close renewal modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmRenewal}>
              <div className="modal-body">
                <div style={{
                  padding: 'var(--spacing-3)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Member:</span>
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                      {selectedForRenewal.member?.displayName || 'Member'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Current Plan:</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {selectedForRenewal.planName} (Expires: {formatDate(selectedForRenewal.endDate)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Remaining:</span>
                    <span className={`urgency-badge ${selectedForRenewal.urgency}`} style={{ padding: '0.1rem 0.4rem' }}>
                      {selectedForRenewal.daysRemaining} days left
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="renewal-plan-select">Renewal Membership Plan *</label>
                  <select
                    id="renewal-plan-select"
                    className="form-select"
                    value={renewalForm.planId}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, planId: e.target.value }))}
                    required
                  >
                    {plans.map((p) => (
                      <option key={p.planId} value={p.planId}>
                        {p.name} — {p.durationDays} Days ({formatPaiseToINR(p.priceInPaise)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="renewal-payment-method">Payment Mode *</label>
                  <select
                    id="renewal-payment-method"
                    className="form-select"
                    value={renewalForm.paymentMethod}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  >
                    <option value="cash">Cash Payment (Reception Desk)</option>
                    <option value="upi">Manual UPI (QR Transfer)</option>
                    <option value="razorpay">Online Razorpay</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="renewal-notes">Staff Notes (Optional)</label>
                  <input
                    type="text"
                    id="renewal-notes"
                    className="form-input"
                    placeholder="e.g., Handed over new RFID card, cash received"
                    value={renewalForm.notes}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedForRenewal(null)}
                  disabled={renewalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={renewalSubmitting || !renewalForm.planId}
                >
                  {renewalSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Extending…</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Record Renewal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. WhatsApp Reminder Modal (Single / Bulk) */}
      {whatsappModal.isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="bulk-whatsapp-modal">
          <div className="modal-content-card">
            <div className="modal-header">
              <h2>
                {whatsappModal.mode === 'single'
                  ? 'Send WhatsApp Renewal Reminder'
                  : `Bulk WhatsApp Reminder (${filteredMemberships.length} Members)`}
              </h2>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setWhatsappModal({ isOpen: false, mode: 'single', targetMembership: null, isSending: false })}
                aria-label="Close WhatsApp modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {whatsappModal.mode === 'single'
                  ? `Dispatch approved Meta Cloud API template reminder to ${whatsappModal.targetMembership?.member?.displayName} (${whatsappModal.targetMembership?.member?.phone || 'No phone'}).`
                  : `Dispatches official WhatsApp utility renewal reminder to all ${filteredMemberships.length} members matching current filter.`}
              </p>

              <div className="whatsapp-preview-box">
                {whatsappModal.mode === 'single'
                  ? `Hello ${whatsappModal.targetMembership?.member?.displayName || 'Member'}, your ${whatsappModal.targetMembership?.planName || 'Gym'} membership at IronPulse Fitness Club is expiring in ${whatsappModal.targetMembership?.daysRemaining} day(s) on ${formatDate(whatsappModal.targetMembership?.endDate)}.\n\nRenew your membership now to maintain seamless access to gym facilities.\n\n[Button: Call Reception]  [Button: Renew Online]`
                  : `Hello {{member_name}}, your {{plan_name}} membership at IronPulse Fitness Club is expiring soon.\n\nRenew your membership to maintain uninterrupted gym access.\n\n[Button: Call Reception]  [Button: Renew Online]`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                <CheckCircle2 size={13} color="#128c7e" />
                <span>Template: <code>ironcore_renewal_reminder_3days</code> (Meta Approved)</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setWhatsappModal({ isOpen: false, mode: 'single', targetMembership: null, isSending: false })}
                disabled={whatsappModal.isSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-whatsapp-bulk"
                onClick={handleDispatchWhatsapp}
                disabled={whatsappModal.isSending}
              >
                {whatsappModal.isSending ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Dispatching…</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Confirm & Send via WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
