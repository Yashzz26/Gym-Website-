import { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  User,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  History,
  PlusCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listRecentMembers,
  recordManualPayment,
  listManualPayments,
} from '../../services/receptionService';
import { listPlans } from '../../services/planService';
import './FeesEntryPage.css';

export default function FeesEntryPage() {
  const { user } = useAuth();

  // Navigation tab: 'entry' | 'history'
  const [activeTab, setActiveTab] = useState('entry');

  // Loading states
  const [membersLoading, setMembersLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi'
  const [upiReference, setUpiReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isRenewal, setIsRenewal] = useState(false);

  // Feedback states
  const [error, setError] = useState('');
  const [successReceipt, setSuccessReceipt] = useState(null);

  // History filters
  const [historyMethodFilter, setHistoryMethodFilter] = useState('all');

  // Load members and plans on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const token = user ? await user.getIdToken() : null;

        const [membersData, plansData] = await Promise.all([
          listRecentMembers(token).catch(() => []),
          listPlans(token, { activeOnly: true }).catch(() => []),
        ]);

        if (!cancelled) {
          setMembers(membersData || []);
          setPlans(plansData || []);
          if (plansData && plansData.length > 0) {
            setSelectedPlanId(plansData[0].planId || plansData[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading initial data for FeesEntryPage:', err);
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
          setPlansLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load payment history when tab is clicked
  useEffect(() => {
    if (activeTab !== 'history') return;

    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const token = user ? await user.getIdToken() : null;
        const data = await listManualPayments(
          { method: historyMethodFilter, limit: 50 },
          token
        );
        if (!cancelled) {
          setPaymentHistory(data || []);
        }
      } catch (err) {
        console.error('Failed to load manual payment history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [activeTab, historyMethodFilter, user]);

  // Filtered members for auto-complete search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return members.filter((m) => {
      const name = (m.displayName || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [members, searchQuery]);

  // Selected plan object
  const selectedPlan = useMemo(() => {
    return plans.find((p) => (p.planId || p.id) === selectedPlanId) || null;
  }, [plans, selectedPlanId]);

  // Handle member selection
  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setSearchQuery('');
    setError('');

    // If member already has an active membership, default isRenewal to true
    if (member.membershipStatus === 'active') {
      setIsRenewal(true);
    } else {
      setIsRenewal(false);
    }
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setIsRenewal(false);
    setError('');
  };

  // Submit payment handler
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedMember) {
      setError('Please search and select a member first.');
      return;
    }

    if (!selectedPlan) {
      setError('Please select a valid membership plan.');
      return;
    }

    if (paymentMethod === 'upi' && !upiReference.trim()) {
      setError('Please provide the UPI Transaction ID / UTR for manual UPI verification.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = user ? await user.getIdToken() : null;

      const payload = {
        memberId: selectedMember.uid || selectedMember.id,
        planId: selectedPlan.planId || selectedPlan.id,
        method: paymentMethod,
        amountPaise: selectedPlan.priceInPaise,
        upiReference: paymentMethod === 'upi' ? upiReference.trim() : undefined,
        remarks: remarks.trim() || undefined,
        isRenewal,
      };

      const result = await recordManualPayment(payload, token);

      // Create enriched receipt object for display
      const receiptData = {
        ...result,
        member: selectedMember,
        plan: selectedPlan,
        recordedAt: new Date().toISOString(),
      };

      setSuccessReceipt(receiptData);

      // Reset form fields
      setRemarks('');
      setUpiReference('');
      setSelectedMember(null);
    } catch (err) {
      console.error('Payment recording error:', err);
      setError(
        err.data?.message ||
          err.message ||
          'Failed to record payment. Please check member details and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleNewEntry = () => {
    setSuccessReceipt(null);
    setError('');
    setActiveTab('entry');
  };

  return (
    <div className="fees-page">
      {/* Page Header */}
      <div className="fees-header">
        <div className="fees-header-top">
          <div className="fees-title-group">
            <h1 className="fees-title">Fees Entry & Receipts</h1>
            <p className="fees-subtitle">
              Record offline cash and manual UPI payments at the front desk and generate digital receipts.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="fees-tab-group">
            <button
              type="button"
              className={`fees-tab-btn ${activeTab === 'entry' ? 'active' : ''}`}
              onClick={() => setActiveTab('entry')}
            >
              <PlusCircle size={16} />
              New Fee Entry
            </button>
            <button
              type="button"
              className={`fees-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} />
              Payment History
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {successReceipt ? (
        /* ================= SUCCESS RECEIPT VIEW ================= */
        <div className="receipt-view-container">
          <div className="receipt-card" id="printable-receipt">
            {/* Gym Branding Header */}
            <div className="receipt-branding">
              <div className="receipt-badge-pill">
                <ShieldCheck size={14} /> OFFICIAL PAYMENT RECEIPT
              </div>
              <h2 className="receipt-gym-name">FITMAX FITNESS CLUB</h2>
              <p className="receipt-gym-address">Reception Desk • Offline Collection Counter</p>
            </div>

            <div className="receipt-divider" />

            {/* Receipt Summary Grid */}
            <div className="receipt-grid">
              <div className="receipt-field">
                <span className="field-label">Receipt / Payment ID</span>
                <span className="field-value font-mono">
                  {successReceipt.payment?.paymentId || successReceipt.payment?.id || 'PAY-N/A'}
                </span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Date & Time</span>
                <span className="field-value">
                  {new Date(successReceipt.recordedAt || undefined).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Member Name</span>
                <span className="field-value">
                  {successReceipt.member?.displayName || 'Registered Member'}
                </span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Member Email</span>
                <span className="field-value">{successReceipt.member?.email || 'N/A'}</span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Membership Plan</span>
                <span className="field-value highlight">
                  {successReceipt.plan?.name || successReceipt.payment?.planName}
                </span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Validity Period</span>
                <span className="field-value">
                  {successReceipt.membership?.startDate
                    ? `${new Date(successReceipt.membership.startDate).toLocaleDateString()} — ${new Date(
                        successReceipt.membership.endDate
                      ).toLocaleDateString()}`
                    : `${successReceipt.plan?.durationDays || 30} Days`}
                </span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Payment Mode</span>
                <span className="field-value uppercase font-semibold">
                  {successReceipt.payment?.method === 'cash' ? (
                    <span className="method-pill cash">Cash (Front Desk)</span>
                  ) : (
                    <span className="method-pill upi">Manual UPI QR</span>
                  )}
                </span>
              </div>
              {successReceipt.payment?.upiReference && (
                <div className="receipt-field">
                  <span className="field-label">UPI Reference / UTR</span>
                  <span className="field-value font-mono">
                    {successReceipt.payment.upiReference}
                  </span>
                </div>
              )}
            </div>

            <div className="receipt-total-box">
              <span className="total-label">Total Amount Paid</span>
              <span className="total-amount">
                ₹{((successReceipt.payment?.amountPaise || 0) / 100).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="receipt-footer-status">
              <span className="status-badge-paid">
                <CheckCircle2 size={16} /> MEMBERSHIP ACTIVATED
              </span>
              <p className="receipt-footer-text">
                Audit reference logged: {successReceipt.auditLogId || 'Verified'}. Thank you for working out with us!
              </p>
            </div>
          </div>

          {/* Action Buttons (Hidden on Print) */}
          <div className="receipt-actions no-print">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrintReceipt}
            >
              <Printer size={18} />
              Print / Save PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleNewEntry}
            >
              <ArrowRight size={18} />
              Record Another Payment
            </button>
          </div>
        </div>
      ) : activeTab === 'entry' ? (
        /* ================= NEW FEE ENTRY TAB ================= */
        <div className="fees-layout-grid">
          {/* Left Column: Form Controls */}
          <div className="fees-form-column">
            <form onSubmit={handleSubmitPayment} className="fees-form-card">
              {/* Error Alert */}
              {error && (
                <div className="fees-error-alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {/* SECTION 1: Member Selection */}
              <div className="fees-section">
                <div className="fees-section-header">
                  <span className="section-number">1</span>
                  <div>
                    <h2 className="section-title">Select Member</h2>
                    <p className="section-desc">Search member by name, phone or email</p>
                  </div>
                </div>

                {!selectedMember ? (
                  <div className="member-search-box">
                    <div className="search-input-wrapper">
                      <Search size={18} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search member name, email or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="member-search-input"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setSearchQuery('')}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Member Results List */}
                    <div className="member-results-dropdown">
                      {membersLoading ? (
                        <div className="dropdown-loading">
                          <RefreshCw size={16} className="animate-spin" /> Loading members...
                        </div>
                      ) : filteredMembers.length === 0 ? (
                        <div className="dropdown-empty">
                          No members found. Use "Register Walk-in" to add a new member profile first.
                        </div>
                      ) : (
                        filteredMembers.map((m) => (
                          <button
                            key={m.uid || m.id}
                            type="button"
                            className="member-result-item"
                            onClick={() => handleSelectMember(m)}
                          >
                            <div className="member-result-avatar">
                              <User size={18} />
                            </div>
                            <div className="member-result-info">
                              <div className="member-name-row">
                                <span className="member-name">{m.displayName || 'No Name'}</span>
                                <span
                                  className={`member-status-chip ${
                                    m.membershipStatus === 'active' ? 'active' : 'expired'
                                  }`}
                                >
                                  {m.membershipStatus === 'active' ? 'Active' : 'Expired/Pending'}
                                </span>
                              </div>
                              <div className="member-meta-row">
                                <span>{m.email}</span>
                                {m.phone && <span>• {m.phone}</span>}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* Selected Member Banner */
                  <div className="selected-member-card">
                    <div className="selected-member-left">
                      <div className="selected-avatar">
                        <User size={22} />
                      </div>
                      <div className="selected-details">
                        <span className="selected-name">{selectedMember.displayName}</span>
                        <span className="selected-email">{selectedMember.email}</span>
                        {selectedMember.phone && (
                          <span className="selected-phone">📞 {selectedMember.phone}</span>
                        )}
                        <span className="selected-status">
                          Status: {selectedMember.membershipStatus || 'New Member'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-change-member"
                      onClick={handleClearMember}
                    >
                      Change Member
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 2: Membership Plan Selection */}
              <div className="fees-section">
                <div className="fees-section-header">
                  <span className="section-number">2</span>
                  <div>
                    <h2 className="section-title">Select Membership Plan</h2>
                    <p className="section-desc">Choose plan duration and tier</p>
                  </div>
                </div>

                {plansLoading ? (
                  <div className="plans-loading">
                    <RefreshCw size={16} className="animate-spin" /> Loading plans...
                  </div>
                ) : (
                  <div className="plans-selector-grid">
                    {plans.map((p) => {
                      const id = p.planId || p.id;
                      const isSelected = selectedPlanId === id;
                      const priceInRupees = (p.priceInPaise || 0) / 100;

                      return (
                        <button
                          key={id}
                          type="button"
                          className={`plan-card-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedPlanId(id)}
                        >
                          <div className="plan-card-header">
                            <span className="plan-name">{p.name}</span>
                            {isSelected && <Check size={16} className="selected-check" />}
                          </div>
                          <div className="plan-duration">
                            <Clock size={14} />
                            <span>
                              {p.durationMonths
                                ? `${p.durationMonths} Month${p.durationMonths > 1 ? 's' : ''}`
                                : `${p.durationDays || 30} Days`}
                            </span>
                          </div>
                          <div className="plan-price">
                            ₹{priceInRupees.toLocaleString('en-IN')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Renewal Notice Toggle */}
                {selectedMember && selectedMember.membershipStatus === 'active' && (
                  <div className="renewal-alert">
                    <div className="renewal-alert-text">
                      <strong>Active Membership Detected</strong>
                      <p>
                        This member already has an active plan. Recording this payment will extend their validity from their current expiration date.
                      </p>
                    </div>
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={isRenewal}
                        onChange={(e) => setIsRenewal(e.target.checked)}
                      />
                      <span>Renewal / Extension</span>
                    </label>
                  </div>
                )}
              </div>

              {/* SECTION 3: Payment Method (Cash vs Manual UPI) */}
              <div className="fees-section">
                <div className="fees-section-header">
                  <span className="section-number">3</span>
                  <div>
                    <h2 className="section-title">Payment Method</h2>
                    <p className="section-desc">
                      Clearly distinguish offline desk payments from Razorpay gateway
                    </p>
                  </div>
                </div>

                {/* Distinction Notice */}
                <div className="gateway-distinction-banner">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>Front Desk Collections:</strong> Use Cash for paper currency or Manual UPI for direct transfers to the gym counter QR code. Online gateway payments are initiated via Razorpay on the member portal.
                  </span>
                </div>

                <div className="method-selection-grid">
                  {/* Cash Option */}
                  <button
                    type="button"
                    className={`method-option-card ${paymentMethod === 'cash' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <div className="method-icon-wrap cash-icon">
                      <Banknote size={24} />
                    </div>
                    <div className="method-content">
                      <span className="method-title">Cash Payment</span>
                      <span className="method-desc">Cash handed over at reception desk</span>
                    </div>
                  </button>

                  {/* Manual UPI Option */}
                  <button
                    type="button"
                    className={`method-option-card ${paymentMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('upi')}
                  >
                    <div className="method-icon-wrap upi-icon">
                      <QrCode size={24} />
                    </div>
                    <div className="method-content">
                      <span className="method-title">Manual UPI Transfer</span>
                      <span className="method-desc">Direct QR scan at counter (Requires UTR)</span>
                    </div>
                  </button>
                </div>

                {/* UPI UTR Field */}
                {paymentMethod === 'upi' && (
                  <div className="upi-input-group">
                    <label className="field-label" htmlFor="upiReference">
                      UPI Reference / UTR Number <span className="text-danger">*</span>
                    </label>
                    <input
                      id="upiReference"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 432109876543 (12-digit transaction ID)"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                      required
                    />
                    <span className="input-hint">
                      Enter the 12-digit UTR/Txn number visible on the member's UPI app (GPay/PhonePe/Paytm).
                    </span>
                  </div>
                )}

                {/* Remarks Field */}
                <div className="remarks-input-group">
                  <label className="field-label" htmlFor="paymentRemarks">
                    Staff Remarks / Notes (Optional)
                  </label>
                  <input
                    id="paymentRemarks"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Paid in full, received 2000x2 notes, student discount"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="fees-submit-row">
                <button
                  type="submit"
                  className="btn btn-submit-payment"
                  disabled={isSubmitting || !selectedMember || !selectedPlan}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Recording Payment...
                    </>
                  ) : (
                    <>
                      <Receipt size={18} />
                      Record Payment & Issue Receipt (₹
                      {selectedPlan
                        ? ((selectedPlan.priceInPaise || 0) / 100).toLocaleString('en-IN')
                        : '0'}
                      )
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="fees-summary-column">
            <div className="summary-sticky-card">
              <h3 className="summary-title">Payment Summary</h3>

              <div className="summary-row">
                <span className="summary-label">Selected Member</span>
                <span className="summary-val">
                  {selectedMember ? selectedMember.displayName : 'None selected'}
                </span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Plan Name</span>
                <span className="summary-val">
                  {selectedPlan ? selectedPlan.name : 'None selected'}
                </span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Duration</span>
                <span className="summary-val">
                  {selectedPlan
                    ? `${selectedPlan.durationMonths || 1} Month(s)`
                    : '—'}
                </span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Payment Mode</span>
                <span className="summary-val uppercase">
                  {paymentMethod === 'cash' ? 'Desk Cash' : 'Manual UPI'}
                </span>
              </div>

              <div className="summary-divider" />

              <div className="summary-total-row">
                <span className="total-title">Total Payable</span>
                <span className="total-price">
                  ₹
                  {selectedPlan
                    ? ((selectedPlan.priceInPaise || 0) / 100).toLocaleString('en-IN')
                    : '0'}
                </span>
              </div>

              <div className="summary-assurance">
                <ShieldCheck size={16} />
                <span>Immediate membership activation upon reception recording.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= PAYMENT HISTORY TAB ================= */
        <div className="history-tab-container">
          <div className="history-toolbar">
            <div className="filter-pill-group">
              <button
                type="button"
                className={`filter-pill ${historyMethodFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryMethodFilter('all')}
              >
                All Methods
              </button>
              <button
                type="button"
                className={`filter-pill ${historyMethodFilter === 'cash' ? 'active' : ''}`}
                onClick={() => setHistoryMethodFilter('cash')}
              >
                Cash Only
              </button>
              <button
                type="button"
                className={`filter-pill ${historyMethodFilter === 'upi' ? 'active' : ''}`}
                onClick={() => setHistoryMethodFilter('upi')}
              >
                Manual UPI Only
              </button>
            </div>

            <button
              type="button"
              className="btn btn-refresh"
              onClick={() => {
                setHistoryLoading(true);
                listManualPayments({ method: historyMethodFilter, limit: 50 }, user?.accessToken)
                  .then((data) => setPaymentHistory(data || []))
                  .finally(() => setHistoryLoading(false));
              }}
            >
              <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="history-loading-box">
              <RefreshCw size={24} className="animate-spin" />
              <span>Loading payment history...</span>
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="history-empty-box">
              <Receipt size={32} />
              <p>No manual desk payments recorded yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Receipt / ID</th>
                    <th>Plan</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Ref / Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p) => {
                    const id = p.paymentId || p.id;
                    const amountRupees = (p.amountPaise || 0) / 100;
                    return (
                      <tr key={id}>
                        <td>
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="font-mono text-muted">{id}</td>
                        <td className="font-semibold">{p.planName || 'Plan'}</td>
                        <td>
                          <span
                            className={`badge-method ${
                              p.method === 'cash' ? 'cash-badge' : 'upi-badge'
                            }`}
                          >
                            {p.method === 'cash' ? 'Cash' : 'Manual UPI'}
                          </span>
                        </td>
                        <td className="font-bold text-accent">
                          ₹{amountRupees.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className="badge-status-captured">
                            {p.status || 'captured'}
                          </span>
                        </td>
                        <td className="text-muted text-sm">
                          {p.upiReference ? `UTR: ${p.upiReference}` : p.remarks || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-view-receipt"
                            onClick={() => {
                              setSuccessReceipt({
                                payment: p,
                                plan: { name: p.planName },
                                member: { displayName: `User (${p.userId})` },
                                recordedAt: p.createdAt,
                              });
                            }}
                          >
                            <FileText size={14} /> Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
