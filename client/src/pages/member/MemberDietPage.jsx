import { useState, useEffect, useCallback } from 'react';
import {
  Utensils,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMemberActiveDietPlan } from '../../services/dietService';
import {
  PageHeader,
  StatusTag,
  StatePanel,
} from '../../components/member/MemberUI';
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
    <div className="member-page" data-testid="member-diet-page">
      <PageHeader
        title="Nutrition & Diet Plan"
        subtitle="Trainer-curated calorie target, macronutrient balance, and daily meal timing."
      />

      {error && (
        <div className="member-alert is-error" role="alert" data-testid="error-banner">
          <div className="member-alert-body">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchDietPlan}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <StatePanel
          testId="loading-diet-state"
          icon={RefreshCw}
          spinIcon
          title="Loading your nutrition plan…"
          description="Fetching macronutrient targets and meal schedule."
        />
      ) : !dietPlan ? (
        <section className="member-panel diet-empty-panel" data-testid="empty-diet-state">
          <div className="diet-empty-head">
            <div className="member-state-icon" aria-hidden="true">
              <Utensils size={18} strokeWidth={1.65} />
            </div>
            <div>
              <h3>No Active Diet Plan Yet</h3>
              <p>
                Your assigned trainer has not published an active nutrition plan for your account.
                Once assigned, your targets and meal timings will populate here automatically.
              </p>
            </div>
          </div>

          <div className="diet-empty-structure">
            <span className="diet-empty-structure-title">Included once your coach assigns a plan</span>
            <ul className="diet-empty-checklist">
              <li>Daily calorie &amp; hydration targets</li>
              <li>Protein, carbohydrate, and fat targets</li>
              <li>Meal schedule with timings &amp; portions</li>
              <li>Coach nutrition instructions</li>
            </ul>
          </div>
        </section>
      ) : (
        <>
          {/* Daily Targets Overview Panel */}
          <section className="member-panel diet-overview-panel" data-testid="diet-overview-card">
            <div className="diet-overview-head">
              <h2>{dietPlan.title}</h2>
              {dietPlan.trainerName && (
                <StatusTag variant="accent">Coach {dietPlan.trainerName}</StatusTag>
              )}
            </div>

            {/* Primary Daily Targets Strip */}
            <div className="nutrition-targets-grid" data-testid="macros-display-grid">
              <div className="nutrition-metric-cell">
                <span className="nutrition-metric-label">Daily Calories</span>
                <span className="nutrition-metric-val tabular-nums" data-testid="target-calories-val">
                  {dietPlan.targetCalories?.toLocaleString() || '—'}
                </span>
                <span className="nutrition-metric-unit">kcal</span>
              </div>

              <div className="nutrition-metric-cell">
                <span className="nutrition-metric-label">Water Target</span>
                <span className="nutrition-metric-val tabular-nums" data-testid="target-water-val">
                  {dietPlan.waterIntakeLiters ? `${dietPlan.waterIntakeLiters} L` : 'Not set'}
                </span>
                <span className="nutrition-metric-unit">daily</span>
              </div>

              <div className="nutrition-metric-cell has-protein">
                <span className="nutrition-metric-label">Protein</span>
                <span className="nutrition-metric-val tabular-nums" data-testid="macro-protein-val">
                  {dietPlan.macros?.protein ?? 0}g
                </span>
                <span className="nutrition-metric-unit">target</span>
              </div>

              <div className="nutrition-metric-cell has-carbs">
                <span className="nutrition-metric-label">Carbs</span>
                <span className="nutrition-metric-val tabular-nums" data-testid="macro-carbs-val">
                  {dietPlan.macros?.carbs ?? 0}g
                </span>
                <span className="nutrition-metric-unit">target</span>
              </div>

              <div className="nutrition-metric-cell has-fat">
                <span className="nutrition-metric-label">Fats</span>
                <span className="nutrition-metric-val tabular-nums" data-testid="macro-fat-val">
                  {dietPlan.macros?.fat ?? 0}g
                </span>
                <span className="nutrition-metric-unit">target</span>
              </div>

              {dietPlan.macros?.fiber ? (
                <div className="nutrition-metric-cell has-fiber">
                  <span className="nutrition-metric-label">Fiber</span>
                  <span className="nutrition-metric-val tabular-nums" data-testid="macro-fiber-val">
                    {dietPlan.macros.fiber}g
                  </span>
                  <span className="nutrition-metric-unit">target</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Daily Meal Schedule */}
          <section className="meals-section" data-testid="meals-container">
            <div className="member-section-header">
              <h2 className="member-section-title">Daily Meal Schedule &amp; Food Items</h2>
              <span className="member-section-meta tabular-nums">
                {dietPlan.meals?.length || 0} meals
              </span>
            </div>

            <div className="meals-list">
              {dietPlan.meals &&
                dietPlan.meals.map((meal, mealIdx) => (
                  <article
                    key={mealIdx}
                    className="member-panel-compact meal-section-panel"
                    data-testid={`member-meal-${mealIdx}`}
                  >
                    <div className="meal-header-row">
                      <div className="meal-title-group">
                        <h3>{meal.name}</h3>
                        {meal.time && (
                          <span className="meal-time-meta tabular-nums">
                            <Clock size={13} />
                            <span>{meal.time}</span>
                          </span>
                        )}
                      </div>

                      {meal.targetCalories && (
                        <span className="meal-target-calories tabular-nums">
                          ~{meal.targetCalories} kcal
                        </span>
                      )}
                    </div>

                    <div className="food-items-list">
                      {meal.items &&
                        meal.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="food-row"
                            data-testid={`food-item-${mealIdx}-${itemIdx}`}
                          >
                            <div className="food-name-qty">
                              <span className="food-item-name">{item.name}</span>
                              {item.quantity && (
                                <span className="food-item-qty">{item.quantity}</span>
                              )}
                            </div>

                            <div className="food-item-macros tabular-nums">
                              {item.calories ? (
                                <span className="food-item-kcal">{item.calories} kcal</span>
                              ) : null}
                              {item.protein ? <span>{item.protein}g P</span> : null}
                              {item.carbs ? <span>{item.carbs}g C</span> : null}
                              {item.fat ? <span>{item.fat}g F</span> : null}
                            </div>
                          </div>
                        ))}
                    </div>

                    {meal.notes && <p className="meal-note-line">Note: {meal.notes}</p>}
                  </article>
                ))}
            </div>
          </section>

          {/* Coaching Advice */}
          {dietPlan.notes && (
            <section className="member-panel-compact coaching-panel" data-testid="coaching-card">
              <h3>Coach&apos;s Nutrition Advice</h3>
              <p>{dietPlan.notes}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
