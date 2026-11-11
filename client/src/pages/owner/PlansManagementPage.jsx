import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Check,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listPlans,
  createPlan,
  updatePlan,
  setPlanStatus,
} from '../../services/planService';
import './PlansManagementPage.css';

/**
 * Format integer paise into INR currency display (ADR 001).
 */
function formatPaiseToINR(paise = 0) {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

const PRESETS = {
  starter: {
    name: '1 Month Starter',
    durationMonths: 1,
    durationDays: 30,
    priceRupees: 1499,
    description: 'Perfect for beginners starting their fitness journey.',
    badge: 'Starter',
    features: [
      'Access to weight & cardio floor',
      'Initial fitness assessment',
      'Locker room & shower access',
    ],
    isActive: true,
    displayOrder: 1,
  },
  pro: {
    name: '3 Months Pro',
    durationMonths: 3,
    durationDays: 90,
    priceRupees: 3999,
    description: 'Most popular membership plan for total transformation.',
    badge: 'Popular',
    features: [
      'Full facility access anytime',
      'All group classes & HIIT sessions',
      'Personalized trainer check-ins',
      'Locker room, sauna & shower access',
    ],
    isActive: true,
    displayOrder: 2,
  },
  elite: {
    name: '12 Months Elite',
    durationMonths: 12,
    durationDays: 365,
    priceRupees: 11999,
    description: 'Year-round fitness commitment with maximum perks and savings.',
    badge: 'Best Value',
    features: [
      'Unlimited 24/7 all-zone access',
      'Unlimited group fitness & functional classes',
      'Monthly body composition & diet tracking',
      '2 free guest passes per quarter',
      'Complimentary gym merchandise pack',
    ],
    isActive: true,
    displayOrder: 3,
  },
};

export default function PlansManagementPage({ initialPlans = null }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState(initialPlans || []);
  const [loading, setLoading] = useState(!initialPlans);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    durationMonths: 1,
    durationDays: 30,
    priceRupees: 1499,
    features: ['Gym floor access'],
    description: '',
    isActive: true,
    displayOrder: 1,
    badge: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState(null);

  const fetchPlans = useCallback(async () => {
    if (initialPlans) return;
    try {
      setLoading(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const data = await listPlans(token, { activeOnly: false });
      setPlans(data || []);
    } catch (err) {
      console.warn('[PlansManagementPage] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user, initialPlans]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleOpenCreateForm = () => {
    setEditingPlanId(null);
    setFormData({
      name: '',
      durationMonths: 1,
      durationDays: 30,
      priceRupees: 1499,
      features: ['Access to weight & cardio floor', 'Locker room access'],
      description: '',
      isActive: true,
      displayOrder: plans.length + 1,
      badge: '',
    });
    setFeedback({ type: '', message: '' });
    setShowForm(true);
  };

  const handleOpenEditForm = (plan) => {
    setEditingPlanId(plan.planId);
    setFormData({
      name: plan.name,
      durationMonths: plan.durationMonths || 1,
      durationDays: plan.durationDays || (plan.durationMonths || 1) * 30,
      priceRupees: (plan.priceInPaise || 0) / 100,
      features: Array.isArray(plan.features) && plan.features.length ? [...plan.features] : ['Gym access'],
      description: plan.description || '',
      isActive: Boolean(plan.isActive),
      displayOrder: plan.displayOrder || 0,
      badge: plan.badge || '',
    });
    setFeedback({ type: '', message: '' });
    setShowForm(true);
  };

  const handleApplyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setFormData((prev) => ({
      ...prev,
      ...preset,
      features: [...preset.features],
    }));
  };

  const handleAddFeature = () => {
    setFormData((prev) => ({
      ...prev,
      features: [...prev.features, ''],
    }));
  };

  const handleFeatureChange = (index, value) => {
    setFormData((prev) => {
      const next = [...prev.features];
      next[index] = value;
      return { ...prev, features: next };
    });
  };

  const handleRemoveFeature = (index) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleToggleStatus = async (plan) => {
    setTogglingPlanId(plan.planId);
    setFeedback({ type: '', message: '' });
    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const nextStatus = !plan.isActive;
      await setPlanStatus(plan.planId, nextStatus, token);

      setPlans((prev) =>
        prev.map((p) => (p.planId === plan.planId ? { ...p, isActive: nextStatus } : p))
      );

      setFeedback({
        type: 'success',
        message: `Plan '${plan.name}' is now ${nextStatus ? 'active' : 'inactive'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to toggle plan status.',
      });
    } finally {
      setTogglingPlanId(null);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const cleanedFeatures = formData.features.map((f) => f.trim()).filter(Boolean);

      if (cleanedFeatures.length === 0) {
        throw new Error('Please include at least one plan perk or feature.');
      }

      // Convert price in INR to integer paise per ADR 001
      const priceInPaise = Math.round(Number(formData.priceRupees) * 100);

      const payload = {
        name: formData.name.trim(),
        durationMonths: Number(formData.durationMonths),
        durationDays: Number(formData.durationDays) || Number(formData.durationMonths) * 30,
        priceInPaise,
        features: cleanedFeatures,
        description: formData.description.trim(),
        isActive: Boolean(formData.isActive),
        displayOrder: Number(formData.displayOrder) || 0,
        badge: formData.badge.trim(),
      };

      if (editingPlanId) {
        const updated = await updatePlan(editingPlanId, payload, token);
        setPlans((prev) =>
          prev.map((p) => (p.planId === editingPlanId ? { ...p, ...updated } : p))
        );
        setFeedback({
          type: 'success',
          message: `Plan '${payload.name}' updated successfully.`,
        });
      } else {
        const created = await createPlan(payload, token);
        setPlans((prev) => [...prev, created]);
        setFeedback({
          type: 'success',
          message: `Plan '${payload.name}' created successfully.`,
        });
      }

      setShowForm(false);
      setEditingPlanId(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save membership plan.',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredPlans = plans.filter((p) => {
    if (filter === 'active') return p.isActive;
    if (filter === 'inactive') return !p.isActive;
    return true;
  });

  return (
    <div className="plans-management-page">
      {/* 1. Header */}
      <div className="plans-header">
        <div className="plans-header-text">
          <h1>
            <Layers size={26} color="var(--color-accent)" />
            <span>Membership Plans Management</span>
          </h1>
          <p>
            Configure 1-month, 3-month and annual membership tiers with features, integer paise pricing, and visibility.
          </p>
        </div>

        <div className="plans-top-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateForm}
            aria-label="Add New Plan"
          >
            <Plus size={16} />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {/* 2. Feedback Alert */}
      {feedback.message && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: feedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3. Modal / Slide-out Form for Create/Edit */}
      {showForm && (
        <div className="plan-form-card" aria-label="Plan Configuration Form">
          <div className="plan-form-header">
            <h2>{editingPlanId ? 'Edit Membership Plan' : 'Create New Membership Plan'}</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ color: 'var(--color-text-secondary)', padding: '0.25rem' }}
              aria-label="Close Form"
            >
              <X size={20} />
            </button>
          </div>

          {!editingPlanId && (
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Quick Presets:
              </span>
              <div className="preset-selector-bar">
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => handleApplyPreset('starter')}
                >
                  ⚡ 1 Month Starter (₹1,499)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => handleApplyPreset('pro')}
                >
                  🔥 3 Months Pro (₹3,999)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => handleApplyPreset('elite')}
                >
                  ⭐ 12 Months Elite (₹11,999)
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-4)' }}>
              <div>
                <label htmlFor="plan-name" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
                  Plan Name *
                </label>
                <input
                  id="plan-name"
                  type="text"
                  required
                  style={{ width: '100%' }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 3 Months Pro"
                />
              </div>

              <div>
                <label htmlFor="plan-price" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
                  Price (INR ₹) *
                </label>
                <input
                  id="plan-price"
                  type="number"
                  min="100"
                  max="100000"
                  required
                  style={{ width: '100%' }}
                  value={formData.priceRupees}
                  onChange={(e) => setFormData({ ...formData, priceRupees: e.target.value })}
                  placeholder="e.g. 3999"
                />
              </div>

              <div>
                <label htmlFor="plan-duration-months" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
                  Duration (Months) *
                </label>
                <input
                  id="plan-duration-months"
                  type="number"
                  min="1"
                  max="36"
                  required
                  style={{ width: '100%' }}
                  value={formData.durationMonths}
                  onChange={(e) => {
                    const months = Number(e.target.value) || 1;
                    setFormData({
                      ...formData,
                      durationMonths: months,
                      durationDays: months * 30,
                    });
                  }}
                />
              </div>

              <div>
                <label htmlFor="plan-badge" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
                  Badge Tag (Optional)
                </label>
                <input
                  id="plan-badge"
                  type="text"
                  style={{ width: '100%' }}
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="e.g. Popular, Best Value, Starter"
                />
              </div>
            </div>

            <div>
              <label htmlFor="plan-desc" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
                Description
              </label>
              <textarea
                id="plan-desc"
                rows={2}
                style={{ width: '100%' }}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary of membership tier..."
              />
            </div>

            {/* Features List */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-2)', color: 'var(--color-text-secondary)' }}>
                Included Features & Perks *
              </label>
              {formData.features.map((feat, index) => (
                <div key={index} className="feature-input-row">
                  <input
                    type="text"
                    required
                    style={{ flex: 1 }}
                    value={feat}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    placeholder={`Feature #${index + 1}`}
                  />
                  {formData.features.length > 1 && (
                    <button
                      type="button"
                      className="remove-feature-btn"
                      onClick={() => handleRemoveFeature(index)}
                      aria-label={`Remove feature ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="add-feature-btn" onClick={handleAddFeature}>
                <Plus size={14} />
                <span>Add another feature</span>
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-2)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={formSubmitting}
              >
                {formSubmitting ? 'Saving…' : editingPlanId ? 'Update Plan' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Controls & Filters */}
      <div className="plans-controls-bar">
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Plans ({plans.length})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({plans.filter((p) => p.isActive).length})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilter('inactive')}
          >
            Inactive ({plans.filter((p) => !p.isActive).length})
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchPlans}
          disabled={loading}
          style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--font-size-xs)' }}
          aria-label="Refresh Plans"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 5. Plans Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          Loading membership plans…
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-3)' }}>
            No membership plans found for this filter.
          </p>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreateForm}>
            <Plus size={16} />
            <span>Create First Plan</span>
          </button>
        </div>
      ) : (
        <div className="plans-cards-grid">
          {filteredPlans.map((plan) => {
            const isFeatured = plan.badge?.toLowerCase().includes('popular') || plan.durationMonths === 3;
            return (
              <div
                key={plan.planId}
                className={`plan-card ${isFeatured ? 'featured' : ''}`}
                aria-label={`Plan Card: ${plan.name}`}
              >
                <div className="plan-card-header">
                  <div className="plan-badge-row">
                    {plan.badge ? (
                      <span className="plan-badge-tag">{plan.badge}</span>
                    ) : (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {plan.durationMonths} Month{plan.durationMonths > 1 ? 's' : ''}
                      </span>
                    )}

                    <span className={`plan-status-badge ${plan.isActive ? 'active' : 'inactive'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <h3 className="plan-name">{plan.name}</h3>
                  <p className="plan-desc">{plan.description || 'Comprehensive gym membership privileges.'}</p>
                </div>

                <div className="plan-price-block">
                  <span className="plan-price-amount">
                    {formatPaiseToINR(plan.priceInPaise)}
                  </span>
                  <span className="plan-price-frequency">
                    / {plan.durationMonths} month{plan.durationMonths > 1 ? 's' : ''} ({plan.durationDays || plan.durationMonths * 30} days)
                  </span>
                </div>

                <ul className="plan-features-list">
                  {Array.isArray(plan.features) &&
                    plan.features.map((feat, idx) => (
                      <li key={idx} className="plan-feature-item">
                        <Check size={16} className="feature-check-icon" />
                        <span>{feat}</span>
                      </li>
                    ))}
                </ul>

                <div className="plan-card-actions">
                  <button
                    type="button"
                    className="plan-action-btn edit"
                    onClick={() => handleOpenEditForm(plan)}
                    aria-label={`Edit ${plan.name}`}
                  >
                    <Edit2 size={13} />
                    <span>Edit Plan</span>
                  </button>

                  <button
                    type="button"
                    className="plan-action-btn toggle"
                    onClick={() => handleToggleStatus(plan)}
                    disabled={togglingPlanId === plan.planId}
                    aria-label={`Toggle status for ${plan.name}`}
                  >
                    {plan.isActive ? (
                      <>
                        <ToggleRight size={15} color="var(--color-success)" />
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={15} color="var(--color-text-muted)" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
