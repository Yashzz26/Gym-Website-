import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserX,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  MessageSquare,
  Phone,
  X,
  Check,
  CheckCircle2,
  Calendar,
  Send,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getInactiveMembers, recordFollowUp } from '../../services/memberService';
import './InactiveMembersPage.css';

/**
 * Format ISO date string into readable short date (e.g., "24 Nov 2026").
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

/**
 * Clean phone number for WhatsApp deep-linking.
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Generate default WhatsApp retention message copy.
 */
function getRetentionMessageCopy(memberName, daysAbsent) {
  const name = memberName ? memberName.split(' ')[0] : 'Member';
  return `Hi ${name}, we noticed you haven't been to IRONCORE Gym in ${daysAbsent} days! Consistency is key to reaching your fitness goals. Need any adjustments to your workout schedule or diet plan? Drop by today or reply here — your gym family is waiting for you!`;
}

export default function InactiveMembersPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({
    totalInactive: 0,
    criticalCount: 0,
    urgentCount: 0,
    moderateCount: 0,
    neverAttendedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Filters
  const [daysInactiveThreshold, setDaysInactiveThreshold] = useState(7);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all'); // 'all' | 'critical' | 'urgent' | 'moderate' | 'never_attended'

  // Single Follow-up Modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({
    channel: 'whatsapp',
    notes: '',
    outcome: 'contacted',
  });
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // Bulk WhatsApp Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchInactiveList = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');
      const token = user?.getIdToken ? await user.getIdToken() : null;

      const data = await getInactiveMembers(
        { daysInactive: daysInactiveThreshold, limit: 100 },
        token
      );

      setMembers(data.members || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err.message || 'Failed to retrieve inactive members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, daysInactiveThreshold]);

  useEffect(() => {
    fetchInactiveList();
  }, [fetchInactiveList]);

  // Client-side search and urgency filtering
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Urgency filter
      if (urgencyFilter === 'critical' && member.urgency !== 'critical') return false;
      if (urgencyFilter === 'urgent' && member.urgency !== 'urgent') return false;
      if (urgencyFilter === 'moderate' && member.urgency !== 'moderate') return false;
      if (urgencyFilter === 'never_attended' && !member.neverAttended) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (member.fullName || '').toLowerCase();
        const email = (member.email || '').toLowerCase();
        const phone = (member.phone || '').toLowerCase();
        const plan = (member.planName || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || plan.includes(q);
      }

      return true;
    });
  }, [members, urgencyFilter, searchQuery]);

  // Open single follow-up modal
  const handleOpenFollowUp = (member) => {
    setSelectedMember(member);
    setFollowUpForm({
      channel: 'whatsapp',
      notes: member.neverAttended
        ? 'New member onboarding follow-up'
        : `Retention outreach (${member.daysAbsent} days absent)`,
      outcome: 'contacted',
    });
  };

  const handleCloseFollowUp = () => {
    setSelectedMember(null);
    setFollowUpSubmitting(false);
  };

  // Submit single follow-up log
  const handleSubmitFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      setFollowUpSubmitting(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;

      await recordFollowUp(selectedMember.userId, followUpForm, token);

      // If WhatsApp channel, launch deep link
      if (followUpForm.channel === 'whatsapp' && selectedMember.phone) {
        const cleanPhone = sanitizePhoneNumber(selectedMember.phone);
        const text = getRetentionMessageCopy(selectedMember.fullName, selectedMember.daysAbsent);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      setFeedback({
        type: 'success',
        message: `Outreach recorded for ${selectedMember.fullName}. Profile updated.`,
      });

      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === selectedMember.userId
            ? {
                ...m,
                lastFollowUp: {
                  sentAt: new Date().toISOString(),
                  channel: followUpForm.channel,
                  notes: followUpForm.notes,
                },
              }
            : m
        )
      );

      handleCloseFollowUp();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to record follow-up',
      });
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  // Bulk Outreach Action
  const handleBulkOutreach = async () => {
    const reachableMembers = filteredMembers.filter((m) => m.phone);
    if (reachableMembers.length === 0) {
      setFeedback({
        type: 'error',
        message: 'No members in the current filter have valid phone numbers.',
      });
      setBulkModalOpen(false);
      return;
    }

    try {
      setBulkSubmitting(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;

      // Log outreach for all filtered reachable members
      await Promise.all(
        reachableMembers.map((m) =>
          recordFollowUp(
            m.userId,
            {
              channel: 'whatsapp',
              notes: `Bulk retention broadcast (${m.daysAbsent} days absent)`,
              outcome: 'queued',
            },
            token
          ).catch(() => null)
        )
      );

      setFeedback({
        type: 'success',
        message: `Batch outreach logged for ${reachableMembers.length} inactive members.`,
      });

      setBulkModalOpen(false);
      fetchInactiveList();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Bulk outreach encountered an error',
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="inactive-members-container">
      {/* Header */}
      <header className="page-header">
        <div className="page-header-content">
          <div className="title-row">
            <div className="header-icon-box">
              <UserX className="header-icon" size={24} />
            </div>
            <div>
              <h1 className="page-title">Inactive Member Watch</h1>
              <p className="page-subtitle">
                Active paying gym members with zero attendance for {daysInactiveThreshold} or more consecutive days.
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="refresh-btn"
              onClick={fetchInactiveList}
              disabled={refreshing}
              aria-label="Refresh inactive members"
            >
              <RefreshCw className={`btn-icon ${refreshing ? 'spinning' : ''}`} size={16} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="bulk-action-btn"
              onClick={() => setBulkModalOpen(true)}
              disabled={filteredMembers.length === 0}
            >
              <MessageSquare className="btn-icon" size={16} />
              <span>Bulk Retention Outreach</span>
            </button>
          </div>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback.message && (
        <div className={`feedback-banner ${feedback.type}`}>
          <div className="feedback-content">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="feedback-icon" />
            ) : (
              <AlertTriangle size={18} className="feedback-icon" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss"
            onClick={() => setFeedback({ type: '', message: '' })}
            aria-label="Dismiss feedback"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="kpi-grid" aria-label="Inactive Member KPI Metrics">
        <div className="kpi-card critical">
          <div className="kpi-meta">
            <ShieldAlert size={16} className="kpi-icon" />
            <span className="kpi-label">Critical (21+ Days)</span>
          </div>
          <div className="kpi-number">{summary.criticalCount || 0}</div>
          <div className="kpi-caption">Severe churn danger</div>
        </div>

        <div className="kpi-card urgent">
          <div className="kpi-meta">
            <AlertTriangle size={16} className="kpi-icon" />
            <span className="kpi-label">High Risk (14-20 Days)</span>
          </div>
          <div className="kpi-number">{summary.urgentCount || 0}</div>
          <div className="kpi-caption">Two weeks absent</div>
        </div>

        <div className="kpi-card moderate">
          <div className="kpi-meta">
            <Clock size={16} className="kpi-icon" />
            <span className="kpi-label">Moderate (7-13 Days)</span>
          </div>
          <div className="kpi-number">{summary.moderateCount || 0}</div>
          <div className="kpi-caption">One week dormant</div>
        </div>

        <div className="kpi-card total">
          <div className="kpi-meta">
            <UserX size={16} className="kpi-icon" />
            <span className="kpi-label">Total Inactive</span>
          </div>
          <div className="kpi-number">{summary.totalInactive || 0}</div>
          <div className="kpi-caption">{summary.neverAttendedCount || 0} never checked in</div>
        </div>
      </section>

      {/* Control Panel: Filters & Search */}
      <section className="controls-card" aria-label="Search and Filter Controls">
        <div className="controls-row">
          <div className="search-field">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="threshold-selector">
            <label htmlFor="absence-threshold" className="threshold-label">
              Absence Window:
            </label>
            <select
              id="absence-threshold"
              value={daysInactiveThreshold}
              onChange={(e) => setDaysInactiveThreshold(Number(e.target.value))}
              className="threshold-select"
            >
              <option value={7}>7+ Days Absent</option>
              <option value={14}>14+ Days Absent</option>
              <option value={21}>21+ Days Absent</option>
              <option value={30}>30+ Days Absent</option>
            </select>
          </div>
        </div>

        {/* Urgency Filter Tabs */}
        <div className="urgency-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={urgencyFilter === 'all'}
            className={`tab-btn ${urgencyFilter === 'all' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('all')}
          >
            All Inactive ({members.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={urgencyFilter === 'critical'}
            className={`tab-btn ${urgencyFilter === 'critical' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('critical')}
          >
            Critical 21+ Days ({summary.criticalCount || 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={urgencyFilter === 'urgent'}
            className={`tab-btn ${urgencyFilter === 'urgent' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('urgent')}
          >
            High Risk 14-20 Days ({summary.urgentCount || 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={urgencyFilter === 'moderate'}
            className={`tab-btn ${urgencyFilter === 'moderate' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('moderate')}
          >
            Moderate 7-13 Days ({summary.moderateCount || 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={urgencyFilter === 'never_attended'}
            className={`tab-btn ${urgencyFilter === 'never_attended' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('never_attended')}
          >
            Never Attended ({summary.neverAttendedCount || 0})
          </button>
        </div>
      </section>

      {/* Main Table / State View */}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="loading-spinner spinning" size={28} />
          <p className="loading-text">Analyzing member check-in history...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <AlertTriangle size={24} className="error-icon" />
          <h3 className="error-title">Unable to Load Inactive Members</h3>
          <p className="error-message">{error}</p>
          <button type="button" className="retry-btn" onClick={fetchInactiveList}>
            Try Again
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Check size={32} />
          </div>
          <h3 className="empty-title">Zero Inactive Members Detected</h3>
          <p className="empty-description">
            {searchQuery || urgencyFilter !== 'all'
              ? 'No inactive members match your current filter criteria.'
              : `All active members have attended gym sessions within the last ${daysInactiveThreshold} days! Excellent gym engagement.`}
          </p>
          {(searchQuery || urgencyFilter !== 'all') && (
            <button
              type="button"
              className="reset-filter-btn"
              onClick={() => {
                setSearchQuery('');
                setUrgencyFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="inactive-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Plan & Validity</th>
                <th scope="col">Last Visit</th>
                <th scope="col">Days Absent</th>
                <th scope="col">Outreach Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.userId} className={`member-row ${member.urgency}`}>
                  {/* Member Column */}
                  <td className="member-cell">
                    <div className="member-avatar">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.fullName} />
                      ) : (
                        <span>{(member.fullName || 'M').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="member-info">
                      <div className="member-name">{member.fullName}</div>
                      <div className="member-meta">
                        {member.phone ? (
                          <span className="member-phone">{member.phone}</span>
                        ) : (
                          <span className="text-muted">No phone</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Plan & Validity */}
                  <td className="plan-cell">
                    <div className="plan-title">{member.planName}</div>
                    <div className="plan-sub">
                      Expires {formatDate(member.membershipEndDate)} ({member.daysLeft}d left)
                    </div>
                  </td>

                  {/* Last Visit */}
                  <td className="visit-cell">
                    {member.neverAttended ? (
                      <span className="never-attended-tag">Never Attended</span>
                    ) : (
                      <>
                        <div className="visit-date">{formatDate(member.lastCheckIn || member.lastCheckInDate)}</div>
                        <div className="visit-relative">{member.daysAbsent} days ago</div>
                      </>
                    )}
                  </td>

                  {/* Days Absent Badge */}
                  <td className="absent-cell">
                    <span className={`absent-badge ${member.urgency}`}>
                      {member.daysAbsent} Days
                    </span>
                  </td>

                  {/* Outreach Status */}
                  <td className="outreach-cell">
                    {member.lastFollowUp ? (
                      <div className="outreach-info">
                        <span className="outreach-channel">
                          {member.lastFollowUp.channel === 'whatsapp' ? (
                            <MessageSquare size={13} className="channel-icon" />
                          ) : (
                            <Phone size={13} className="channel-icon" />
                          )}
                          {member.lastFollowUp.channel}
                        </span>
                        <span className="outreach-time">
                          {formatDate(member.lastFollowUp.sentAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="no-outreach">Not contacted</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="actions-cell text-right">
                    <div className="action-buttons">
                      {member.phone && (
                        <a
                          href={`https://wa.me/${sanitizePhoneNumber(member.phone)}?text=${encodeURIComponent(
                            getRetentionMessageCopy(member.fullName, member.daysAbsent)
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="quick-wa-btn"
                          title="Open WhatsApp chat directly"
                          aria-label={`Open WhatsApp chat with ${member.fullName}`}
                        >
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                          <ArrowUpRight size={12} />
                        </a>
                      )}
                      <button
                        type="button"
                        className="followup-btn"
                        onClick={() => handleOpenFollowUp(member)}
                        aria-label={`Log outreach for ${member.fullName}`}
                      >
                        Log Outreach
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Single Member Follow-up Modal */}
      {selectedMember && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <h3 id="modal-title" className="modal-title">
                  Log Retention Outreach
                </h3>
                <p className="modal-subtitle">
                  {selectedMember.fullName} &bull; {selectedMember.daysAbsent} days absent
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseFollowUp}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitFollowUp} className="modal-form">
              <div className="form-group">
                <label className="form-label">Communication Channel</label>
                <div className="channel-options">
                  <label className={`channel-pill ${followUpForm.channel === 'whatsapp' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="channel"
                      value="whatsapp"
                      checked={followUpForm.channel === 'whatsapp'}
                      onChange={() => setFollowUpForm((prev) => ({ ...prev, channel: 'whatsapp' }))}
                    />
                    <MessageSquare size={16} />
                    <span>WhatsApp</span>
                  </label>
                  <label className={`channel-pill ${followUpForm.channel === 'call' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="channel"
                      value="call"
                      checked={followUpForm.channel === 'call'}
                      onChange={() => setFollowUpForm((prev) => ({ ...prev, channel: 'call' }))}
                    />
                    <Phone size={16} />
                    <span>Phone Call</span>
                  </label>
                  <label className={`channel-pill ${followUpForm.channel === 'in_person' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="channel"
                      value="in_person"
                      checked={followUpForm.channel === 'in_person'}
                      onChange={() => setFollowUpForm((prev) => ({ ...prev, channel: 'in_person' }))}
                    />
                    <Calendar size={16} />
                    <span>In-person / Other</span>
                  </label>
                </div>
              </div>

              {followUpForm.channel === 'whatsapp' && (
                <div className="template-preview-box">
                  <div className="template-header">
                    <span className="template-badge">Approved Template: ironcore_inactive_member_checkin</span>
                  </div>
                  <p className="template-copy">
                    {getRetentionMessageCopy(selectedMember.fullName, selectedMember.daysAbsent)}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="followup-notes" className="form-label">
                  Outreach Notes / Special Offer
                </label>
                <textarea
                  id="followup-notes"
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. Member had slight shoulder sprain. Offered 7 days plan extension if returns by Monday."
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={handleCloseFollowUp}
                  disabled={followUpSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn" disabled={followUpSubmitting}>
                  {followUpSubmitting ? (
                    <>
                      <RefreshCw className="spinning" size={16} />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Log & Complete Outreach</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Retention Outreach Confirmation Modal */}
      {bulkModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bulk-modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <h3 id="bulk-modal-title" className="modal-title">
                  Broadcast Retention Outreach
                </h3>
                <p className="modal-subtitle">
                  Batch follow-up for {filteredMembers.filter((m) => m.phone).length} members
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBulkModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-content-body">
              <p className="bulk-instruction">
                This operation logs an outreach touchpoint for all <strong>{filteredMembers.filter((m) => m.phone).length}</strong> inactive members currently visible under your active filter.
              </p>

              <div className="template-preview-box">
                <div className="template-header">
                  <span className="template-badge">Approved Template: ironcore_inactive_member_checkin</span>
                </div>
                <p className="template-copy">
                  &ldquo;Hi [Name], we noticed you haven&#39;t been to IRONCORE Gym in [Days] days! Consistency is key to reaching your fitness goals. Need any adjustments to your workout schedule or diet plan? Drop by today or reply here — your gym family is waiting for you!&rdquo;
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setBulkModalOpen(false)}
                disabled={bulkSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={handleBulkOutreach}
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? (
                  <>
                    <RefreshCw className="spinning" size={16} />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Record Batch Outreach</span>
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
