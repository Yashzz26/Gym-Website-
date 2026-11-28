import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  RefreshCw,
  QrCode,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listPlans } from '../../services/planService';
import { selectPlan, getMyMembership } from '../../services/memberService';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayScript,
} from '../../services/paymentService';
import {
  PageHeader,
  StatusTag,
  StatePanel,
} from '../../components/member/MemberUI';
import {
  formatInrFromPaise,
  formatDisplayDate,
  formatPaymentMethod,
} from '../../utils/memberFormat';
import './OnlineJoiningPage.css';

export default function OnlineJoiningPage() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Step flow: 1 (Plans) -> 2 (Confirm Details) -> 3 (Payment Pending)
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentMembership, setCurrentMembership] = useState(null);
  const [browsingPlans, setBrowsingPlans] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    gender: 'male',
    emergencyName: '',
    emergencyPhone: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Razorpay Checkout UI States: 'idle' | 'opening' | 'verifying' | 'success' | 'failed'
  const [checkoutStatus, setCheckoutStatus] = useState('idle');
  const [checkoutDetails, setCheckoutDetails] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const token = user ? await user.getIdToken() : null;

        const fetchedPlans = await listPlans({ activeOnly: true }, token);
        if (!cancelled) {
          setPlans(fetchedPlans || []);
        }

        if (token) {
          const existing = await getMyMembership(token);
          if (!cancelled && existing) {
            setCurrentMembership(existing);
            if (existing.status === 'payment_pending') {
              setStep(3);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load membership options');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (profile?.phone && !formData.phone) {
      setFormData((prev) => ({ ...prev, phone: profile.phone }));
    }
  }, [profile, formData.phone]);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setStep(2);
    setError('');
  };

  const handleConfirmJoining = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsSubmitting(true);
    setError('');

    try {
      const token = user ? await user.getIdToken() : null;
      const payload = {
        planId: selectedPlan.planId,
        phone: formData.phone || undefined,
        gender: formData.gender || undefined,
        address: formData.address || undefined,
      };

      if (formData.emergencyName && formData.emergencyPhone) {
        payload.emergencyContact = {
          name: formData.emergencyName,
          phone: formData.emergencyPhone,
        };
      }

      const response = await selectPlan(payload, token);
      setCurrentMembership(response.membership);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Unable to complete plan selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPlanSelection = () => {
    setSelectedPlan(null);
    setCurrentMembership(null);
    setStep(1);
    setBrowsingPlans(true);
    setError('');
    setCheckoutStatus('idle');
    setCheckoutDetails(null);
    setCheckoutError('');
  };

  const handlePayOnline = async () => {
    if (!currentMembership?.planId) return;
    setCheckoutStatus('opening');
    setCheckoutError('');

    try {
      const token = user ? await user.getIdToken() : null;
      const orderData = await createRazorpayOrder({ planId: currentMembership.planId }, token);

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error(
          'Razorpay checkout SDK could not be loaded. Please check your internet connection.'
        );
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'IRONCORE Gym',
        description: `${orderData.plan.name} Membership`,
        order_id: orderData.orderId,
        prefill: {
          name: profile?.displayName || user?.displayName || '',
          email: profile?.email || user?.email || '',
          contact: profile?.phone || formData.phone || '',
        },
        theme: {
          color: '#0284c7',
        },
        handler: async function (response) {
          try {
            setCheckoutStatus('verifying');
            const verifyRes = await verifyRazorpayPayment(
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              },
              token
            );

            setCheckoutDetails({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              planName: orderData.plan.name,
              amount: orderData.amount,
              membership: verifyRes?.membership,
            });
            setCheckoutStatus('success');
          } catch (verifyErr) {
            setCheckoutStatus('failed');
            setCheckoutError(verifyErr.message || 'Payment signature verification failed.');
          }
        },
        modal: {
          ondismiss: function () {
            setCheckoutStatus('failed');
            setCheckoutError('Payment window was closed before completing checkout.');
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (resp) {
        setCheckoutStatus('failed');
        setCheckoutError(resp.error?.description || 'Payment was declined or failed at gateway.');
      });

      rzpInstance.open();
    } catch (err) {
      setCheckoutStatus('failed');
      setCheckoutError(err.message || 'Failed to initiate Razorpay checkout.');
    }
  };

  const hasActiveMembership =
    currentMembership?.status === 'active' && !currentMembership?.isExpired;
  const hasExpiredMembership = Boolean(
    currentMembership &&
      (currentMembership.status === 'expired' || currentMembership.isExpired)
  );
  const showActiveSummary = step === 1 && !browsingPlans && hasActiveMembership;
  const showExpiredNotice = step === 1 && !browsingPlans && hasExpiredMembership;
  const showPlansView = step === 1 && !showActiveSummary;
  const showStepper = !showActiveSummary && !showExpiredNotice;

  const headerTitle = showActiveSummary
    ? 'Active Membership'
    : showExpiredNotice
      ? 'Membership Renewal'
      : step === 3
        ? 'Complete Enrollment'
        : 'Choose Your Fitness Journey';

  const headerSubtitle = showActiveSummary
    ? 'Your active plan details, validity period, and gym check-in shortcuts.'
    : showExpiredNotice
      ? 'Your previous membership period has ended. Select a plan below or renew from your profile.'
      : step === 3
        ? 'Review your reserved plan and complete online verification.'
        : 'Compare available plans, confirm your contact details, and activate gym access.';

  return (
    <div className="member-page">
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        actions={
          browsingPlans && hasActiveMembership && step === 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setBrowsingPlans(false)}
            >
              <ArrowLeft size={15} />
              <span>Back to Active Plan</span>
            </button>
          ) : null
        }
      />

      {showStepper && (
        <nav className="joining-stepper" aria-label="Enrollment steps">
          <div className={`joining-step ${step >= 1 ? 'is-active' : ''} ${step > 1 ? 'is-done' : ''}`}>
            <span className="joining-step-num tabular-nums">1</span>
            <span>Select Plan</span>
          </div>
          <div className="joining-step-line" aria-hidden="true" />
          <div className={`joining-step ${step >= 2 ? 'is-active' : ''} ${step > 2 ? 'is-done' : ''}`}>
            <span className="joining-step-num tabular-nums">2</span>
            <span>Confirm Details</span>
          </div>
          <div className="joining-step-line" aria-hidden="true" />
          <div className={`joining-step ${step >= 3 ? 'is-active' : ''}`}>
            <span className="joining-step-num tabular-nums">3</span>
            <span>Pending Payment</span>
          </div>
        </nav>
      )}

      {error && (
        <div className="member-alert is-error" role="alert">
          <div className="member-alert-body">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* STATE A: ACTIVE MEMBERSHIP SUMMARY (No stepper, balanced horizontal panel) */}
      {showActiveSummary && (
        <section className="member-panel active-membership-panel" role="status">
          <div className="active-membership-grid">
            <div className="active-membership-lead">
              <StatusTag variant="success">Active</StatusTag>
              <h2>Your Membership Is Active</h2>
              <p>
                Your {currentMembership.planName || 'Gym Membership'} plan is verified. Scan the
                entrance QR code at reception when checking in for workouts.
              </p>
              <div className="active-membership-actions">
                <Link to="/member/attendance" className="btn btn-primary">
                  <QrCode size={16} />
                  <span>Scan QR Attendance</span>
                </Link>
                <Link to="/member/profile" className="btn btn-secondary">
                  <span>My Membership &amp; History</span>
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBrowsingPlans(true)}
                >
                  <span>Browse Plans</span>
                </button>
              </div>
            </div>

            <dl className="joining-spec-list">
              <div className="joining-spec-row">
                <dt>Active Plan</dt>
                <dd>{currentMembership.planName || 'Membership Plan'}</dd>
              </div>
              <div className="joining-spec-row">
                <dt>Status</dt>
                <dd className="is-success-value">Active</dd>
              </div>
              {currentMembership.endDate && (
                <div className="joining-spec-row">
                  <dt>Valid Until</dt>
                  <dd className="tabular-nums">
                    {formatDisplayDate(currentMembership.endDate)}
                    {typeof currentMembership.daysRemaining === 'number'
                      ? ` (${currentMembership.daysRemaining} days remaining)`
                      : ''}
                  </dd>
                </div>
              )}
              <div className="joining-spec-row">
                <dt>Payment Method</dt>
                <dd>{formatPaymentMethod(currentMembership.paymentMethod)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* STATE B: EXPIRED MEMBERSHIP NOTICE ABOVE PLAN GRID */}
      {showExpiredNotice && (
        <section className="member-panel expired-notice-panel" role="status">
          <div className="expired-notice-content">
            <div className="expired-notice-copy">
              <StatusTag variant="danger">Expired</StatusTag>
              <h2>Previous Plan Expired</h2>
              <p>
                {currentMembership.planName || 'Your membership'} ended on{' '}
                <span className="tabular-nums">{formatDisplayDate(currentMembership.endDate)}</span>.
                Renew on your membership page or choose a plan below.
              </p>
            </div>
            <div className="expired-notice-actions">
              <Link to="/member/profile" className="btn btn-primary">
                <RefreshCw size={16} />
                <span>Renew Existing Plan</span>
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBrowsingPlans(true)}
              >
                <span>Compare All Plans</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 1: MEMBERSHIP PRICING COMPARISON GRID */}
      {showPlansView && (
        <div>
          {loading ? (
            <StatePanel
              icon={RefreshCw}
              spinIcon
              title="Loading membership plans"
              description="Retrieving active tiers and transparent pricing."
            />
          ) : plans.length === 0 ? (
            <StatePanel
              icon={CreditCard}
              title="No Membership Plans Available"
              description="No active plans are configured right now. Contact front desk reception for assistance."
            />
          ) : (
            (() => {
              const recommendedPlan =
                plans.find((p) => p.badge === 'Popular') ||
                plans.find((p) => p.badge === 'Best Value') ||
                null;

              return (
                <div className="plans-comparison-grid">
                  {plans.map((plan) => {
                    const isFeatured = Boolean(
                      recommendedPlan && plan.planId === recommendedPlan.planId
                    );
                    const formattedPrice = (plan.priceInPaise / 100).toLocaleString('en-IN');
                    const monthsCount =
                      plan.durationMonths || Math.max(1, Math.round(plan.durationDays / 30));
                    const monthlyEquivalent = Math.round(
                      plan.priceInPaise / 100 / monthsCount
                    ).toLocaleString('en-IN');

                    return (
                      <article
                        key={plan.planId}
                        className={`joining-plan-card ${isFeatured ? 'is-featured' : ''}`}
                      >
                        <div className="plan-card-top">
                          <div className="plan-meta-slot">
                            <span className="plan-duration-text tabular-nums">
                              {plan.durationDays} days · {monthsCount}{' '}
                              {monthsCount === 1 ? 'month' : 'months'}
                            </span>
                            {plan.badge && (
                              <StatusTag variant={isFeatured ? 'accent' : 'neutral'}>
                                {plan.badge}
                              </StatusTag>
                            )}
                          </div>
                          <h3 className="plan-title-name">{plan.name}</h3>
                        </div>

                        <div className="plan-price-stack">
                          <div className="plan-price-block">
                            <span className="plan-currency">₹</span>
                            <span className="plan-amount tabular-nums">{formattedPrice}</span>
                            <span className="plan-period">/ total</span>
                          </div>
                          <span className="plan-monthly-eq tabular-nums">
                            ₹{monthlyEquivalent} / month equivalent
                          </span>
                        </div>

                        <ul className="plan-features-list">
                          {plan.features?.map((feature, idx) => (
                            <li key={idx} className="plan-feature-row">
                              <Check size={16} strokeWidth={1.75} className="plan-feature-icon" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          type="button"
                          className={`btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} plan-select-btn`}
                          onClick={() => handleSelectPlan(plan)}
                        >
                          <span>Choose {plan.name}</span>
                          <ArrowRight size={16} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* STEP 2: CONFIRM DETAILS & ORDER BREAKDOWN */}
      {step === 2 && selectedPlan && (
        <section className="joining-step2-grid">
          <div className="member-panel confirm-summary-panel">
            <div className="confirm-summary-head">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={15} />
                <span>Back to Plans</span>
              </button>
              <StatusTag variant="accent">Selected: {selectedPlan.name}</StatusTag>
            </div>

            <div className="confirm-breakdown">
              <h3>Order Breakdown</h3>
              <dl className="joining-spec-list">
                <div className="joining-spec-row">
                  <dt>Membership Plan</dt>
                  <dd>{selectedPlan.name}</dd>
                </div>
                <div className="joining-spec-row">
                  <dt>Access Duration</dt>
                  <dd className="tabular-nums">{selectedPlan.durationDays} Days</dd>
                </div>
                <div className="joining-spec-row">
                  <dt>GST &amp; Facility Access</dt>
                  <dd className="is-success-value">Included</dd>
                </div>
                <div className="joining-spec-row is-total">
                  <dt>Total Payable</dt>
                  <dd className="tabular-nums is-accent-value">
                    {formatInrFromPaise(selectedPlan.priceInPaise)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <form className="member-panel joining-details-form" onSubmit={handleConfirmJoining}>
            <h3>Member Information</h3>

            <div className="joining-form-row">
              <div className="joining-field">
                <label htmlFor="confirm-phone">Contact Phone Number *</label>
                <input
                  id="confirm-phone"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="joining-field">
                <label htmlFor="confirm-emergency">Emergency Contact Phone</label>
                <input
                  id="confirm-emergency"
                  type="tel"
                  placeholder="+91 98765 00000"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="joining-field">
              <label htmlFor="confirm-address">Address / City</label>
              <input
                id="confirm-address"
                type="text"
                placeholder="City and state"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="joining-form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSubmitting}
              >
                <CreditCard size={16} />
                <span>{isSubmitting ? 'Recording Selection…' : 'Confirm Plan & Proceed'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 3: PAYMENT CAPTURED — SIGNATURE PENDING */}
      {step === 3 && currentMembership && checkoutStatus === 'success' && checkoutDetails && (
        <section className="member-panel checkout-state-panel is-success-border" role="status">
          <div className="checkout-state-head">
            <div className="checkout-state-icon is-success">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <StatusTag variant="success">
                Gateway Captured · Signature Pending Verification
              </StatusTag>
              <h2>Payment Captured at Razorpay</h2>
              <p>
                Payment recorded at Razorpay. Membership access activates automatically once
                signature and webhook verification confirm capture.
              </p>
            </div>
          </div>

          <dl className="joining-spec-list">
            <div className="joining-spec-row">
              <dt>Payment Reference</dt>
              <dd className="mono-ref is-success-value">{checkoutDetails.paymentId}</dd>
            </div>
            <div className="joining-spec-row">
              <dt>Order ID</dt>
              <dd className="mono-ref">{checkoutDetails.orderId}</dd>
            </div>
            <div className="joining-spec-row">
              <dt>Plan</dt>
              <dd>{checkoutDetails.planName}</dd>
            </div>
            <div className="joining-spec-row">
              <dt>Amount Captured</dt>
              <dd className="tabular-nums is-accent-value">
                {formatInrFromPaise(checkoutDetails.amount)}
              </dd>
            </div>
            <div className="joining-spec-row">
              <dt>Activation Status</dt>
              <dd className="is-warning-value">Awaiting Signature Capture</dd>
            </div>
          </dl>

          <div className="checkout-state-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetPlanSelection}
            >
              <span>Back to Plans</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: CHECKOUT FAILED / DISMISSED */}
      {step === 3 && currentMembership && checkoutStatus === 'failed' && (
        <section className="member-panel checkout-state-panel is-danger-border" role="alert">
          <div className="checkout-state-head">
            <div className="checkout-state-icon is-danger">
              <XCircle size={20} />
            </div>
            <div>
              <StatusTag variant="danger">Checkout Notice</StatusTag>
              <h2>Checkout Not Completed</h2>
              <p>
                {checkoutError ||
                  'The Razorpay payment process was interrupted, declined, or closed.'}
              </p>
            </div>
          </div>

          <div className="checkout-state-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetPlanSelection}
            >
              <RefreshCw size={16} />
              <span>Choose Different Plan</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePayOnline}
            >
              <CreditCard size={16} />
              <span>Retry Online Payment</span>
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: PAYMENT PENDING */}
      {step === 3 &&
        currentMembership &&
        checkoutStatus !== 'success' &&
        checkoutStatus !== 'failed' && (
          <section className="member-panel checkout-state-panel is-warning-border">
            <div className="checkout-state-head">
              <div className="checkout-state-icon is-warning">
                <Clock size={20} />
              </div>
              <div>
                <StatusTag variant="warning">
                  Status: {currentMembership.status || 'payment_pending'}
                </StatusTag>
                <h2>Plan Selected — Awaiting Payment Verification</h2>
                <p>
                  Your membership selection has been reserved. Complete payment securely via
                  Razorpay Checkout to activate access.
                </p>
              </div>
            </div>

            <dl className="joining-spec-list">
              <div className="joining-spec-row">
                <dt>Selected Plan</dt>
                <dd>{currentMembership.planName}</dd>
              </div>
              <div className="joining-spec-row">
                <dt>Validity Duration</dt>
                <dd className="tabular-nums">{currentMembership.durationDays} Days</dd>
              </div>
              <div className="joining-spec-row">
                <dt>Fee Amount Due</dt>
                <dd className="tabular-nums is-accent-value">
                  {formatInrFromPaise(currentMembership.priceInPaise)}
                </dd>
              </div>
              <div className="joining-spec-row">
                <dt>Payment Status</dt>
                <dd className="is-warning-value">Awaiting Verification</dd>
              </div>
            </dl>

            <div className="checkout-state-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetPlanSelection}
                disabled={checkoutStatus === 'opening'}
              >
                <RefreshCw size={16} />
                <span>Choose Different Plan</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePayOnline}
                disabled={checkoutStatus === 'opening' || checkoutStatus === 'verifying'}
              >
                <CreditCard size={16} />
                <span>
                  {checkoutStatus === 'opening'
                    ? 'Opening Gateway…'
                    : checkoutStatus === 'verifying'
                      ? 'Verifying Signature…'
                      : 'Pay Online via Razorpay'}
                </span>
              </button>
            </div>
          </section>
        )}
    </div>
  );
}
