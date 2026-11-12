import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  User,
  Mail,
  Phone,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { registerMember } from '../../services/receptionService';
import { listPlans } from '../../services/planService';
import './RegisterMemberPage.css';

export default function RegisterMemberPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const initialForm = {
    displayName: '',
    email: '',
    phone: '',
    password: '',
    gender: 'male',
    dateOfBirth: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    assignedPlanId: '',
    whatsappOptIn: true,
  };

  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [registeredMember, setRegisteredMember] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPlans() {
      try {
        const token = user ? await user.getIdToken() : null;
        const availablePlans = await listPlans({ activeOnly: true }, token);
        if (!cancelled) {
          setPlans(availablePlans || []);
        }
      } catch {
        // Fallback if offline/mock
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    }
    loadPlans();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const token = user ? await user.getIdToken() : null;

      const payload = {
        displayName: formData.displayName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password || undefined,
        gender: formData.gender || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address || undefined,
        whatsappOptIn: formData.whatsappOptIn,
      };

      if (formData.emergencyName && formData.emergencyPhone) {
        payload.emergencyContact = {
          name: formData.emergencyName,
          phone: formData.emergencyPhone,
        };
      }

      if (formData.assignedPlanId) {
        payload.assignedPlanId = formData.assignedPlanId;
      }

      const result = await registerMember(payload, token);
      setRegisteredMember(result);
      setFormData(initialForm);
    } catch (err) {
      setError(err.message || 'Failed to register member. Please check details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (registeredMember?.temporaryPassword) {
      navigator.clipboard.writeText(registeredMember.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="reception-register-page">
      <div className="reception-header">
        <div className="reception-header-top">
          <div>
            <span className="badge badge-warning" style={{ marginBottom: '4px' }}>
              Reception Desk · Walk-In Registration
            </span>
            <h1 className="reception-title">Member Onboarding</h1>
          </div>
          <span className="badge badge-accent">Direct Activation</span>
        </div>
        <p className="reception-subtitle">
          Register in-person walk-in members, create their account credentials, and optionally assign an initial membership plan.
        </p>
      </div>

      {registeredMember ? (
        <div className="registration-success-card">
          <div className="success-icon-badge">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>
              Member Registered Successfully!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Member account has been created in Firebase with immediate active status.
            </p>
          </div>

          <div className="credentials-box">
            <div className="credentials-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Full Name:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {registeredMember.user?.displayName}
              </strong>
            </div>
            <div className="credentials-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Email:</span>
              <span className="credentials-value">{registeredMember.user?.email}</span>
            </div>
            <div className="credentials-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Phone:</span>
              <span>{registeredMember.user?.phone || 'Not provided'}</span>
            </div>
            <div className="credentials-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Initial Password:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="credentials-value">{registeredMember.temporaryPassword}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto' }}
                  onClick={handleCopyPassword}
                  title="Copy password to clipboard"
                >
                  {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            {registeredMember.membership && (
              <div
                style={{
                  borderTop: '1px solid var(--color-border-subtle)',
                  paddingTop: '8px',
                  marginTop: '4px',
                }}
              >
                <div className="credentials-row">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Assigned Plan:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {registeredMember.membership.planName}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRegisteredMember(null)}
            >
              <RefreshCw size={16} />
              <span>Register Another Member</span>
            </button>
            <Link to="/reception/fees" className="btn btn-primary">
              <span>Proceed to Fees Entry</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="reception-card">
          {error && (
            <div
              role="alert"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f87171',
                fontSize: '0.875rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="reception-form">
            {/* 1. Personal Information */}
            <div className="form-section">
              <div className="form-section-header">
                <User size={18} className="text-accent" />
                <h3 className="form-section-title">Personal Details</h3>
              </div>
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="reg-displayName" className="form-label">
                    Full Name *
                  </label>
                  <input
                    id="reg-displayName"
                    name="displayName"
                    type="text"
                    required
                    placeholder="e.g. Rohan Mehra"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reg-email" className="form-label">
                    Email Address *
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    required
                    placeholder="e.g. rohan@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reg-phone" className="form-label">
                    Phone Number *
                  </label>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reg-gender" className="form-label">
                    Gender
                  </label>
                  <select
                    id="reg-gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="reg-dob" className="form-label">
                    Date of Birth
                  </label>
                  <input
                    id="reg-dob"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reg-password" className="form-label">
                    Custom Password (Optional)
                  </label>
                  <input
                    id="reg-password"
                    name="password"
                    type="text"
                    placeholder="Leave blank to auto-generate"
                    value={formData.password}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 2. Emergency Contact & Address */}
            <div className="form-section">
              <div className="form-section-header">
                <Shield size={18} className="text-accent" />
                <h3 className="form-section-title">Emergency Contact &amp; Address</h3>
              </div>
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="reg-emergencyName" className="form-label">
                    Emergency Contact Name
                  </label>
                  <input
                    id="reg-emergencyName"
                    name="emergencyName"
                    type="text"
                    placeholder="e.g. Anjali Mehra"
                    value={formData.emergencyName}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reg-emergencyPhone" className="form-label">
                    Emergency Contact Phone
                  </label>
                  <input
                    id="reg-emergencyPhone"
                    name="emergencyPhone"
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="reg-address" className="form-label">
                    Residential Address
                  </label>
                  <textarea
                    id="reg-address"
                    name="address"
                    placeholder="Street, City, Pincode"
                    value={formData.address}
                    onChange={handleChange}
                    className="form-textarea"
                  />
                </div>
              </div>
            </div>

            {/* 3. Initial Plan Selection */}
            <div className="form-section">
              <div className="form-section-header">
                <CreditCard size={18} className="text-accent" />
                <h3 className="form-section-title">Membership Plan</h3>
              </div>
              <div className="form-field">
                <label htmlFor="reg-plan" className="form-label">
                  Assign Starter Plan (Optional)
                </label>
                <select
                  id="reg-plan"
                  name="assignedPlanId"
                  value={formData.assignedPlanId}
                  onChange={handleChange}
                  className="form-select"
                  disabled={plansLoading}
                >
                  <option value="">No Plan (Plan selection during fee payment)</option>
                  {plans.map((p) => (
                    <option key={p.planId} value={p.planId}>
                      {p.name} — ₹{p.priceInPaise / 100} ({p.durationDays} days)
                    </option>
                  ))}
                </select>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                <input
                  type="checkbox"
                  name="whatsappOptIn"
                  checked={formData.whatsappOptIn}
                  onChange={handleChange}
                />
                <span>Opt in for WhatsApp gym updates and check-in notifications</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ minWidth: '180px' }}
              >
                <UserPlus size={18} />
                <span>{isSubmitting ? 'Registering…' : 'Register Member'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
