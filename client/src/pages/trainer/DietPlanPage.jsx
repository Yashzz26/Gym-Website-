import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Flame,
  Clock,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssignedMembers } from '../../services/trainerService';
import {
  getMemberActiveDietPlan,
  createDietPlan,
  updateDietPlan,
} from '../../services/dietService';
import './DietPlanPage.css';

const DEFAULT_MEAL = {
  name: 'Breakfast',
  time: '08:30 AM',
  targetCalories: 600,
  notes: '',
  items: [
    { name: 'Oats with Milk & Honey', quantity: '80g oats + 200ml milk', calories: 420, protein: 16, carbs: 68, fat: 9 },
    { name: 'Whole Eggs', quantity: '2 boiled eggs', calories: 150, protein: 12, carbs: 1, fat: 10 },
  ],
};

export default function DietPlanPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State
  const [planId, setPlanId] = useState(null);
  const [title, setTitle] = useState('High Protein Hypertrophy Plan');
  const [targetCalories, setTargetCalories] = useState(2500);
  const [macros, setMacros] = useState({
    protein: 180,
    carbs: 270,
    fat: 65,
    fiber: 35,
  });
  const [waterIntakeLiters, setWaterIntakeLiters] = useState(3.5);
  const [meals, setMeals] = useState([DEFAULT_MEAL]);
  const [notes, setNotes] = useState('Focus on whole foods, stay hydrated and maintain meal consistency.');

  // Load Assigned Members
  const loadMembers = useCallback(async () => {
    if (!user) return;
    setLoadingMembers(true);
    setError(null);
    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const data = await getAssignedMembers(token);
      setMembers(data);
      if (data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].memberId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load assigned members');
    } finally {
      setLoadingMembers(false);
    }
  }, [user, selectedMemberId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Load Selected Member's Active Diet Plan
  const loadMemberPlan = useCallback(async (memberId) => {
    if (!memberId || !user) return;
    setLoadingPlan(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const existingPlan = await getMemberActiveDietPlan(memberId, token);

      if (existingPlan) {
        setPlanId(existingPlan.id);
        setTitle(existingPlan.title || 'Personalized Diet Routine');
        setTargetCalories(existingPlan.targetCalories || 2400);
        setMacros({
          protein: existingPlan.macros?.protein || 160,
          carbs: existingPlan.macros?.carbs || 250,
          fat: existingPlan.macros?.fat || 60,
          fiber: existingPlan.macros?.fiber || 30,
        });
        setWaterIntakeLiters(existingPlan.waterIntakeLiters || 3.5);
        setMeals(existingPlan.meals && existingPlan.meals.length > 0 ? existingPlan.meals : [DEFAULT_MEAL]);
        setNotes(existingPlan.notes || '');
      } else {
        // Reset to default builder for new plan
        setPlanId(null);
        setTitle('Custom Nutrition Plan');
        setTargetCalories(2400);
        setMacros({ protein: 160, carbs: 260, fat: 60, fiber: 30 });
        setWaterIntakeLiters(3.5);
        setMeals([
          {
            name: 'Breakfast',
            time: '08:30 AM',
            targetCalories: 600,
            notes: '',
            items: [{ name: 'Oats with Protein', quantity: '1 bowl', calories: 400, protein: 25, carbs: 55, fat: 8 }],
          },
          {
            name: 'Lunch',
            time: '01:30 PM',
            targetCalories: 800,
            notes: '',
            items: [{ name: 'Chicken & Rice', quantity: '200g chicken + 150g rice', calories: 600, protein: 50, carbs: 65, fat: 12 }],
          },
          {
            name: 'Dinner',
            time: '08:30 PM',
            targetCalories: 700,
            notes: '',
            items: [{ name: 'Paneer / Fish with Salad', quantity: '1 plate', calories: 500, protein: 35, carbs: 25, fat: 20 }],
          },
        ]);
        setNotes('Stay hydrated and avoid processed sugars.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch member diet plan');
    } finally {
      setLoadingPlan(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedMemberId) {
      loadMemberPlan(selectedMemberId);
    }
  }, [selectedMemberId, loadMemberPlan]);

  const selectedMember = useMemo(() => {
    return members.find((m) => m.memberId === selectedMemberId);
  }, [members, selectedMemberId]);

  // Live Macro Energy Calculation
  const calculatedKcal = useMemo(() => {
    const p = Number(macros.protein) || 0;
    const c = Number(macros.carbs) || 0;
    const f = Number(macros.fat) || 0;
    return p * 4 + c * 4 + f * 9;
  }, [macros]);

  // Meal Actions
  const handleAddMeal = () => {
    setMeals((prev) => [
      ...prev,
      {
        name: `Meal ${prev.length + 1}`,
        time: '04:00 PM',
        targetCalories: 350,
        notes: '',
        items: [{ name: 'Healthy Snack / Shake', quantity: '1 serving', calories: 250, protein: 15, carbs: 30, fat: 5 }],
      },
    ]);
  };

  const handleRemoveMeal = (mealIndex) => {
    setMeals((prev) => prev.filter((_, idx) => idx !== mealIndex));
  };

  const handleUpdateMeal = (mealIndex, field, value) => {
    setMeals((prev) =>
      prev.map((meal, idx) => (idx === mealIndex ? { ...meal, [field]: value } : meal))
    );
  };

  const handleAddFoodItem = (mealIndex) => {
    setMeals((prev) =>
      prev.map((meal, idx) => {
        if (idx !== mealIndex) return meal;
        return {
          ...meal,
          items: [
            ...meal.items,
            { name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 },
          ],
        };
      })
    );
  };

  const handleRemoveFoodItem = (mealIndex, itemIndex) => {
    setMeals((prev) =>
      prev.map((meal, idx) => {
        if (idx !== mealIndex) return meal;
        return {
          ...meal,
          items: meal.items.filter((_, i) => i !== itemIndex),
        };
      })
    );
  };

  const handleUpdateFoodItem = (mealIndex, itemIndex, field, value) => {
    setMeals((prev) =>
      prev.map((meal, idx) => {
        if (idx !== mealIndex) return meal;
        const updatedItems = meal.items.map((item, i) =>
          i === itemIndex ? { ...item, [field]: value } : item
        );
        return { ...meal, items: updatedItems };
      })
    );
  };

  // Submit Diet Plan
  const handleSubmitDietPlan = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setError('Please select an assigned member first');
      return;
    }

    if (meals.length === 0) {
      setError('Diet plan must contain at least one meal');
      return;
    }

    // Verify all meals have at least one food item with a name
    for (const m of meals) {
      if (!m.items || m.items.length === 0) {
        setError(`Meal '${m.name}' must have at least one food item`);
        return;
      }
      for (const itm of m.items) {
        if (!itm.name.trim()) {
          setError(`Please provide a name for all items in '${m.name}'`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const payload = {
        memberId: selectedMemberId,
        title: title.trim(),
        targetCalories: Number(targetCalories),
        macros: {
          protein: Number(macros.protein),
          carbs: Number(macros.carbs),
          fat: Number(macros.fat),
          fiber: Number(macros.fiber) || 0,
        },
        waterIntakeLiters: Number(waterIntakeLiters) || 3.5,
        meals,
        notes: notes.trim() || undefined,
        isActive: true,
      };

      if (planId) {
        await updateDietPlan(planId, payload, token);
        setSuccessMsg(`Diet plan '${payload.title}' updated successfully!`);
      } else {
        const created = await createDietPlan(payload, token);
        setPlanId(created.id);
        setSuccessMsg(`New diet plan '${payload.title}' assigned and activated for member!`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save diet plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="trainer-diet-page" data-testid="trainer-diet-page">
      {/* Header */}
      <div className="diet-header">
        <div className="diet-header-title">
          <div className="diet-icon-badge">
            <Utensils size={28} />
          </div>
          <div>
            <h1>Nutrition & Diet Plan Builder</h1>
            <p className="diet-subtitle">
              Design customized calorie, macronutrient, and meal schedules for assigned members
            </p>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="success-banner" data-testid="success-banner">
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="error-banner" data-testid="error-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadMemberPlan(selectedMemberId)}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Member Selector Bar */}
      <div className="member-selector-card">
        <div className="selector-left">
          <label htmlFor="memberSelect" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={16} color="#22c55e" /> Member:
          </label>
          <select
            id="memberSelect"
            className="member-select"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            disabled={loadingMembers}
            data-testid="member-select"
          >
            {members.length === 0 && <option value="">No assigned members found</option>}
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName} ({m.fitnessGoal || 'General Fitness'})
              </option>
            ))}
          </select>
        </div>

        {selectedMember && (
          <div className="selected-member-pill">
            <div className="member-stat-chip">
              Goal: <strong>{selectedMember.fitnessGoal || 'General Fitness'}</strong>
            </div>
            {selectedMember.currentWeightKg && (
              <div className="member-stat-chip">
                Weight: <strong>{selectedMember.currentWeightKg} kg</strong>
              </div>
            )}
            {selectedMember.targetWeightKg && (
              <div className="member-stat-chip">
                Target: <strong>{selectedMember.targetWeightKg} kg</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {loadingPlan ? (
        <div className="empty-state">
          <RefreshCw size={28} className="spinning" color="#22c55e" />
          <p>Loading member's diet schedule...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <User size={48} color="#64748b" />
          <h3>No Assigned Members</h3>
          <p>You have not been assigned any active members yet. Member diet plans can be created once assignments are configured.</p>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmitDietPlan} className="diet-form-container">
          {/* Plan Meta & Calorie Target Card */}
          <div className="macro-calculator-card">
            <h2 className="card-title">
              <Flame size={20} color="#f97316" /> Plan Goals & Daily Target
            </h2>

            <div className="macro-inputs-grid">
              <div className="input-field-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="planTitle">Plan Title</label>
                <input
                  id="planTitle"
                  type="text"
                  className="macro-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lean Bulk, Muscle Definition Cut"
                  required
                  data-testid="plan-title-input"
                />
              </div>

              <div className="input-field-group">
                <label htmlFor="targetCalories">Target Calories (kcal)</label>
                <input
                  id="targetCalories"
                  type="number"
                  min="500"
                  max="10000"
                  className="macro-input"
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(e.target.value)}
                  required
                  data-testid="target-calories-input"
                />
              </div>

              <div className="input-field-group">
                <label htmlFor="waterIntake">Water Target (Liters)</label>
                <input
                  id="waterIntake"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="15"
                  className="macro-input"
                  value={waterIntakeLiters}
                  onChange={(e) => setWaterIntakeLiters(e.target.value)}
                  data-testid="water-input"
                />
              </div>
            </div>

            {/* Macronutrient Split */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>
                Macronutrient Breakdown (Grams)
              </label>
              <div className="macro-inputs-grid">
                <div className="input-field-group">
                  <label htmlFor="macroProtein">Protein (g)</label>
                  <input
                    id="macroProtein"
                    type="number"
                    min="0"
                    max="1000"
                    className="macro-input"
                    value={macros.protein}
                    onChange={(e) => setMacros({ ...macros, protein: e.target.value })}
                    required
                    data-testid="protein-input"
                  />
                </div>

                <div className="input-field-group">
                  <label htmlFor="macroCarbs">Carbs (g)</label>
                  <input
                    id="macroCarbs"
                    type="number"
                    min="0"
                    max="2000"
                    className="macro-input"
                    value={macros.carbs}
                    onChange={(e) => setMacros({ ...macros, carbs: e.target.value })}
                    required
                    data-testid="carbs-input"
                  />
                </div>

                <div className="input-field-group">
                  <label htmlFor="macroFat">Fat (g)</label>
                  <input
                    id="macroFat"
                    type="number"
                    min="0"
                    max="500"
                    className="macro-input"
                    value={macros.fat}
                    onChange={(e) => setMacros({ ...macros, fat: e.target.value })}
                    required
                    data-testid="fat-input"
                  />
                </div>

                <div className="input-field-group">
                  <label htmlFor="macroFiber">Fiber (g)</label>
                  <input
                    id="macroFiber"
                    type="number"
                    min="0"
                    max="200"
                    className="macro-input"
                    value={macros.fiber}
                    onChange={(e) => setMacros({ ...macros, fiber: e.target.value })}
                    data-testid="fiber-input"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Energy Summary */}
            <div className="macro-calc-summary">
              <div className="summary-metric">
                <div className="summary-metric-val">{calculatedKcal} kcal</div>
                <div className="summary-metric-lbl">From Macros</div>
              </div>
              <div className="summary-metric">
                <div className="summary-metric-val" style={{ color: calculatedKcal > targetCalories ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {Math.abs(calculatedKcal - Number(targetCalories))} kcal
                </div>
                <div className="summary-metric-lbl">Delta vs Target</div>
              </div>
              <div className="summary-metric">
                <div className="summary-metric-val" style={{ color: 'var(--color-accent-light)' }}>
                  {waterIntakeLiters} L
                </div>
                <div className="summary-metric-lbl">Daily Water</div>
              </div>
            </div>
          </div>

          {/* Meals Schedule Builder */}
          <div className="meals-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                <Clock size={20} color="var(--color-accent-light)" /> Daily Meal Schedule & Food Items
              </h2>
              <button
                type="button"
                className="btn-add-food-item"
                onClick={handleAddMeal}
                data-testid="add-meal-btn"
                style={{ background: 'var(--color-accent-subtle)', borderColor: 'var(--color-accent-border)', color: 'var(--color-accent-light)' }}
              >
                <Plus size={16} /> Add Meal
              </button>
            </div>

            {meals.map((meal, mealIdx) => (
              <div key={mealIdx} className="meal-block" data-testid={`meal-block-${mealIdx}`}>
                <div className="meal-block-header">
                  <div className="meal-title-inputs">
                    <input
                      type="text"
                      className="meal-name-input"
                      value={meal.name}
                      onChange={(e) => handleUpdateMeal(mealIdx, 'name', e.target.value)}
                      placeholder="Meal Name (e.g. Breakfast, Pre-Workout)"
                      required
                      data-testid={`meal-name-${mealIdx}`}
                    />
                    <input
                      type="text"
                      className="meal-time-input"
                      value={meal.time || ''}
                      onChange={(e) => handleUpdateMeal(mealIdx, 'time', e.target.value)}
                      placeholder="Time (e.g. 08:30 AM)"
                      data-testid={`meal-time-${mealIdx}`}
                    />
                  </div>

                  {meals.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-meal"
                      onClick={() => handleRemoveMeal(mealIdx)}
                      data-testid={`remove-meal-${mealIdx}`}
                    >
                      <Trash2 size={14} /> Remove Meal
                    </button>
                  )}
                </div>

                {/* Items in Meal */}
                <div className="food-items-container">
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
                    Food items & portions
                  </span>
                  {meal.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="food-item-row" data-testid={`food-item-${mealIdx}-${itemIdx}`}>
                      <input
                        type="text"
                        className="food-input-name"
                        value={item.name}
                        onChange={(e) => handleUpdateFoodItem(mealIdx, itemIdx, 'name', e.target.value)}
                        placeholder="Item (e.g. Rolled Oats, Chicken)"
                        required
                        data-testid={`item-name-${mealIdx}-${itemIdx}`}
                      />
                      <input
                        type="text"
                        className="food-input-qty"
                        value={item.quantity}
                        onChange={(e) => handleUpdateFoodItem(mealIdx, itemIdx, 'quantity', e.target.value)}
                        placeholder="Portion (e.g. 80g, 2 eggs)"
                        required
                        data-testid={`item-qty-${mealIdx}-${itemIdx}`}
                      />
                      <input
                        type="number"
                        className="food-input-kcal"
                        value={item.calories || ''}
                        onChange={(e) => handleUpdateFoodItem(mealIdx, itemIdx, 'calories', Number(e.target.value) || 0)}
                        placeholder="kcal"
                        data-testid={`item-kcal-${mealIdx}-${itemIdx}`}
                      />

                      {meal.items.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => handleRemoveFoodItem(mealIdx, itemIdx)}
                          data-testid={`remove-item-${mealIdx}-${itemIdx}`}
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn-add-food-item"
                    onClick={() => handleAddFoodItem(mealIdx)}
                    data-testid={`add-food-item-btn-${mealIdx}`}
                  >
                    <Plus size={14} /> Add Food Item
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Coaching Notes */}
          <div className="macro-calculator-card">
            <h2 className="card-title">General Coaching Notes & Nutrition Advice</h2>
            <textarea
              rows="3"
              className="macro-input"
              style={{ width: '100%', resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Timing instructions, hydration goals, supplement advice..."
              data-testid="plan-notes-input"
            />
          </div>

          {/* Action Row */}
          <div className="form-actions-row">
            <button
              type="submit"
              className="btn-save-diet-plan"
              disabled={saving}
              data-testid="save-diet-plan-btn"
            >
              <Save size={18} />
              {saving ? 'Publishing Plan...' : planId ? 'Update Diet Plan' : 'Assign Diet Plan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
