import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listPlans } from '../../services/planService';
import { selectPlan, getMyMembership } from '../../services/memberService';
import { createRazorpayOrder, loadRazorpayScript } from '../../services/paymentService';
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

  const [formData, setFormData] = useState({
    phone: '',
    gender: 'male',
    emergencyName: '',
    emergencyPhone: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Razorpay Checkout UI States: 'idle' | 'opening' | 'success' | 'failed'
  const [checkoutStatus, setCheckoutStatus] = useState('idle');
  const [checkoutDetails, setCheckoutDetails] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const token = user ? await user.getIdToken() : null;

        // 1. Fetch available active plans
        const fetchedPlans = await listPlans({ activeOnly: true }, token);
        if (!cancelled) {
          setPlans(fetchedPlans || []);
        }

        // 2. Fetch existing membership if authenticated
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

  // Pre-fill phone if available in profile
  useEffect(() => {
    if (profile?.phone && !formData.phone) {
      setFormData((prev) => ({ ...prev, phone: profile.phone }));
    }
  }, [profile]);

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

      // 1. Create server-side order with strictly server-verified price
      const orderData = await createRazorpayOrder({ planId: currentMembership.planId }, token);

      // 2. Ensure Razorpay Checkout SDK is available
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay checkout SDK could not be loaded. Please check your internet connection.');
      }

      // 3. Configure Checkout options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'FitMax Gym',
        description: `${orderData.plan.name} Membership`,
        order_id: orderData.orderId,
        prefill: {
          name: profile?.displayName || user?.displayName || '',
          email: profile?.email || user?.email || '',
          contact: profile?.phone || formData.phone || '',
        },
        theme: {
          color: '#0066ff',
        },
        handler: function (response) {
          // Captured at gateway; display success state without activating yet (activation happens via verified webhook)
          setCheckoutDetails({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            planName: orderData.plan.name,
            amount: orderData.amount,
          });
          setCheckoutStatus('success');
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

  return (
    <div className="online-joining-page">
      {/* Header */}
      <div className="joining-header">
        <span className="badge badge-accent">Screen 1 · Online Joining</span>
        <h1 className="joining-title">Choose Your Fitness Journey</h1>
        <p className="joining-subtitle">
          Select an official membership plan, review your onboarding details, and complete your registration with guaranteed transparent pricing.
        </p>

        {/* Stepper */}
        <div className="joining-stepper">
          <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span>Select Plan</span>
          </div>
          <div className="step-connector" />
          <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span>Confirm Details</span>
          </div>
          <div className="step-connector" />
          <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span>Pending Payment</span>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            color: '#f87171',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '650px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Plan Comparison Cards */}
      {step === 1 && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
              Loading membership plans…
            </div>
          ) : (
            <div className="plans-comparison-grid">
              {plans.map((plan) => {
                const isFeatured = plan.badge === 'Popular' || plan.badge === 'Best Value';
                const formattedPrice = (plan.priceInPaise / 100).toLocaleString('en-IN');

                return (
                  <div
                    key={plan.planId}
                    className={`joining-plan-card ${isFeatured ? 'featured' : ''}`}
                  >
                    {plan.badge && <span className="plan-badge-pill">{plan.badge}</span>}

                    <div className="plan-card-header">
                      <h3 className="plan-title-name">{plan.name}</h3>
                      <span className="plan-duration-text">
                        Valid for {plan.durationDays} Days ({plan.durationMonths || Math.round(plan.durationDays / 30)} Months)
                      </span>
                      <div className="plan-price-block">
                        <span className="plan-currency">₹</span>
                        <span className="plan-amount">{formattedPrice}</span>
                        <span className="plan-period">/ total</span>
                      </div>
                    </div>

                    <div className="plan-features-list">
                      {plan.features?.map((feature, idx) => (
                        <div key={idx} className="plan-feature-row">
                          <Check size={16} className="plan-feature-icon" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`plan-select-btn ${isFeatured ? 'btn btn-primary' : 'btn btn-secondary'}`}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      <span>Choose {plan.name}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Confirm Details & Review */}
      {step === 2 && selectedPlan && (
        <div className="joining-confirm-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={14} />
              <span>Back to Plans</span>
            </button>
            <span className="badge badge-accent">Selected: {selectedPlan.name}</span>
          </div>

          <div className="confirm-summary-box">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>
              Order Breakdown
            </h3>
            <div className="summary-row">
              <span>Membership Plan</span>
              <strong style={{ color: '#ffffff' }}>{selectedPlan.name}</strong>
            </div>
            <div className="summary-row">
              <span>Access Duration</span>
              <span>{selectedPlan.durationDays} Days</span>
            </div>
            <div className="summary-row">
              <span>GST &amp; Facility Access</span>
              <span style={{ color: '#10b981' }}>Included</span>
            </div>
            <div className="summary-row total">
              <span>Total Payable</span>
              <span style={{ color: '#0080ff' }}>
                ₹{(selectedPlan.priceInPaise / 100).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <form onSubmit={handleConfirmJoining} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
              Member Information
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="confirm-phone" style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Contact Phone Number *
                </label>
                <input
                  id="confirm-phone"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    border: '1px solid #223553',
                    backgroundColor: '#142138',
                    padding: '0 12px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="confirm-emergency" style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Emergency Contact Phone
                </label>
                <input
                  id="confirm-emergency"
                  type="tel"
                  placeholder="+91 98765 00000"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    border: '1px solid #223553',
                    backgroundColor: '#142138',
                    padding: '0 12px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="confirm-address" style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                Address / City
              </label>
              <input
                id="confirm-address"
                type="text"
                placeholder="e.g. Pune, Maharashtra"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #223553',
                  backgroundColor: '#142138',
                  padding: '0 12px',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ height: '48px', marginTop: '0.5rem', fontWeight: 600 }}
            >
              <CreditCard size={18} />
              <span>{isSubmitting ? 'Recording Selection…' : 'Confirm Plan & Proceed'}</span>
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: Razorpay Checkout & Pending/Success/Failure States */}
      {step === 3 && currentMembership && checkoutStatus === 'success' && checkoutDetails && (
        <div className="payment-success-card" role="status">
          <div className="success-icon-circle">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <span className="success-status-badge">
              Gateway Captured · Signature Pending Verification
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: '0.75rem 0 0.5rem 0' }}>
              Payment Captured at Razorpay
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', maxWidth: '520px', margin: '0 auto' }}>
              Your payment has been successfully recorded by Razorpay. Per security guidelines, membership access will automatically activate once signature and webhook verification confirm capture.
            </p>
          </div>

          <div className="pending-details-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Payment Reference:</span>
              <strong style={{ color: '#4ade80' }}>{checkoutDetails.paymentId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Order ID:</span>
              <span>{checkoutDetails.orderId}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Plan:</span>
              <strong style={{ color: '#ffffff' }}>{checkoutDetails.planName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Amount Captured:</span>
              <strong style={{ color: '#0080ff' }}>
                ₹{((checkoutDetails.amount || 0) / 100).toLocaleString('en-IN')}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Activation Status:</span>
              <span style={{ color: '#facc15', fontWeight: 600 }}>Awaiting Signature Capture</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetPlanSelection}
            >
              <span>Back to Plans</span>
            </button>
          </div>
        </div>
      )}

      {step === 3 && currentMembership && checkoutStatus === 'failed' && (
        <div className="payment-failed-card" role="alert">
          <div className="failed-icon-circle">
            <XCircle size={32} />
          </div>

          <div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Checkout Notice
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: '0.75rem 0 0.5rem 0' }}>
              Checkout Not Completed
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto' }}>
              {checkoutError || 'The Razorpay payment process was interrupted, declined, or closed.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
        </div>
      )}

      {step === 3 && currentMembership && checkoutStatus !== 'success' && checkoutStatus !== 'failed' && (
        <div className="payment-pending-card">
          <div className="pending-icon-circle">
            <Clock size={32} />
          </div>

          <div>
            <span className="pending-status-badge">
              Status: {currentMembership.status || 'payment_pending'}
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: '0.75rem 0 0.5rem 0' }}>
              Plan Selected — Awaiting Payment Verification
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto' }}>
              Your membership selection has been reserved. Complete payment securely via Razorpay Checkout to finalize your enrollment.
            </p>
          </div>

          <div className="pending-details-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Selected Plan:</span>
              <strong style={{ color: '#ffffff' }}>{currentMembership.planName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Validity Duration:</span>
              <span>{currentMembership.durationDays} Days</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Fee Amount Due:</span>
              <strong style={{ color: '#0080ff' }}>
                ₹{((currentMembership.priceInPaise || 0) / 100).toLocaleString('en-IN')}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Payment Status:</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Awaiting Verification</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
              disabled={checkoutStatus === 'opening'}
            >
              <CreditCard size={16} />
              <span>{checkoutStatus === 'opening' ? 'Opening Gateway…' : 'Pay Online via Razorpay'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
