import { useState, useEffect, useCallback } from 'react';
import {
  Utensils,
  Clock,
  Droplet,
  Flame,
  User,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMemberActiveDietPlan } from '../../services/dietService';
import './MemberDietPage.css';

export default function MemberDietPage() {
  const { user } = useAuth();
  const [dietPlan, setDietPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDietPlan = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const plan = await getMemberActiveDietPlan(user.uid, token);
      setDietPlan(plan);
    } catch (err) {
      setError(err.message || 'Failed to load your diet plan');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDietPlan();
  }, [fetchDietPlan]);

  return (
    <div className="member-diet-page" data-testid="member-diet-page">
      {/* Header */}
      <div className="member-diet-header">
        <div className="member-diet-header-title">
          <div className="member-diet-icon-badge">
            <Utensils size={28} />
          </div>
          <div>
            <h1>Personalized Nutrition & Diet</h1>
            <p className="member-diet-subtitle">
              Follow your trainer-curated meal timings, macronutrient targets, and daily fuel
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner" data-testid="error-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDietPlan}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-box" data-testid="loading-diet-state">
          <RefreshCw size={24} className="spinning" color="#22c55e" />
          <span>Loading your nutrition plan...</span>
        </div>
      ) : !dietPlan ? (
        /* Empty State */
        <div className="empty-state" data-testid="empty-diet-state">
          <Utensils size={48} className="empty-state-icon" />
          <h3>No Active Diet Plan Yet</h3>
          <p>
            Your assigned personal trainer has not prepared an active nutrition routine for your account yet.
            Reach out to your coach to receive a personalized diet breakdown customized to your fitness goal!
          </p>
        </div>
      ) : (
        /* Active Diet Plan */
        <>
          {/* Daily Overview Card */}
          <div className="diet-overview-card" data-testid="diet-overview-card">
            <div className="overview-top-row">
              <div className="overview-plan-info">
                <h2>{dietPlan.title}</h2>
                {dietPlan.trainerName && (
                  <span className="coach-badge">
                    <User size={13} /> Coach {dietPlan.trainerName}
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="overview-metrics-strip">
              <div className="overview-metric-box calories">
                <Flame size={20} strokeWidth={1.75} color="var(--color-warning)" />
                <span className="metric-val" data-testid="target-calories-val">
                  {dietPlan.targetCalories?.toLocaleString()}
                </span>
                <span className="metric-label">Daily Calories (kcal)</span>
              </div>

              <div className="overview-metric-box water">
                <Droplet size={20} strokeWidth={1.75} color="var(--color-accent-light)" />
                <span className="metric-val" data-testid="target-water-val">
                  {dietPlan.waterIntakeLiters || 3.5} L
                </span>
                <span className="metric-label">Daily Water Intake</span>
              </div>
            </div>

            {/* Macros Breakdown */}
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)', marginBottom: '0.5rem', display: 'block' }}>
                Daily macronutrient targets
              </span>
              <div className="macros-display-grid" data-testid="macros-display-grid">
                <div className="macro-box protein">
                  <div className="macro-val" data-testid="macro-protein-val">{dietPlan.macros?.protein || 0}g</div>
                  <div className="macro-name">Protein</div>
                </div>

                <div className="macro-box carbs">
                  <div className="macro-val" data-testid="macro-carbs-val">{dietPlan.macros?.carbs || 0}g</div>
                  <div className="macro-name">Carbs</div>
                </div>

                <div className="macro-box fat">
                  <div className="macro-val" data-testid="macro-fat-val">{dietPlan.macros?.fat || 0}g</div>
                  <div className="macro-name">Fats</div>
                </div>

                {dietPlan.macros?.fiber ? (
                  <div className="macro-box fiber">
                    <div className="macro-val" data-testid="macro-fiber-val">{dietPlan.macros.fiber}g</div>
                    <div className="macro-name">Fiber</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Meals Schedule */}
          <div className="meals-container" data-testid="meals-container">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: '#fff' }}>
              Daily Meal Schedule & Food Items
            </h2>

            {dietPlan.meals && dietPlan.meals.map((meal, mealIdx) => (
              <div key={mealIdx} className="member-meal-card" data-testid={`member-meal-${mealIdx}`}>
                <div className="meal-header-row">
                  <div className="meal-title-group">
                    <h3>{meal.name}</h3>
                    {meal.time && (
                      <span className="meal-time-pill">
                        <Clock size={12} /> {meal.time}
                      </span>
                    )}
                  </div>

                  {meal.targetCalories && (
                    <span className="meal-target-calories">
                      ~{meal.targetCalories} kcal
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="food-items-table">
                  {meal.items && meal.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="food-row" data-testid={`food-item-${mealIdx}-${itemIdx}`}>
                      <div className="food-name-qty">
                        <span className="food-item-name">{item.name}</span>
                        <span className="food-item-qty">{item.quantity}</span>
                      </div>

                      <div className="food-item-macros">
                        {item.calories ? (
                          <span className="food-item-kcal">{item.calories} kcal</span>
                        ) : null}
                        {item.protein ? (
                          <span style={{ color: '#ef4444' }}>{item.protein}g P</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {meal.notes && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Note: {meal.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Coaching Notes */}
          {dietPlan.notes && (
            <div className="coaching-card" data-testid="coaching-card">
              <h3>
                <UtensilsCrossed size={18} strokeWidth={1.75} color="var(--color-success)" /> Coach&apos;s Nutrition Advice
              </h3>
              <p>{dietPlan.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
