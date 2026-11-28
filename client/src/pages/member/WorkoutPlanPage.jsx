import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Flame,
  ExternalLink,
  Award,
  AlertCircle,
  RefreshCw,
  User,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWorkoutPlans, logWorkoutCompletion, getWorkoutLogs } from '../../services/workoutService';
import './WorkoutPlanPage.css';

const WEEKDAYS = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
];

function getTodayWeekdayKey() {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[dayIndex] || 'mon';
}

function getTodayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

export default function WorkoutPlanPage() {
  const { user } = useAuth();
  const todayKey = useMemo(() => getTodayWeekdayKey(), []);
  const todayDate = useMemo(() => getTodayIsoDate(), []);

  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [plans, setPlans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedExercises, setCompletedExercises] = useState({});
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [modalData, setModalData] = useState({
    durationMinutes: 45,
    perceivedExertion: 7,
    notes: '',
  });
  const [successToast, setSuccessToast] = useState(null);

  const fetchWorkoutData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const [plansData, logsData] = await Promise.all([
        getWorkoutPlans(token, { memberId: user.uid }),
        getWorkoutLogs(token, { memberId: user.uid, limit: 14 }),
      ]);
      setPlans(plansData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message || 'Failed to load workout details');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkoutData();
  }, [fetchWorkoutData]);

  // Current active plan for selected weekday
  const currentPlan = useMemo(() => {
    return (
      plans.find((p) => p.weekDay === selectedDay) ||
      plans.find((p) => p.weekDay === 'all') ||
      null
    );
  }, [plans, selectedDay]);

  // Has today's workout been logged in workoutLogs?
  const todayLog = useMemo(() => {
    return logs.find((l) => l.date === todayDate);
  }, [logs, todayDate]);

  // Exercise completion states for the current plan
  const exercises = currentPlan?.exercises || [];
  const totalExercises = exercises.length;

  const currentCompletedCount = useMemo(() => {
    if (!currentPlan) return 0;
    const planCompleted = completedExercises[currentPlan.id] || [];
    return planCompleted.length;
  }, [currentPlan, completedExercises]);

  const progressPercentage = totalExercises > 0
    ? Math.round((currentCompletedCount / totalExercises) * 100)
    : 0;

  const toggleExercise = (exerciseName) => {
    if (!currentPlan) return;
    const planId = currentPlan.id;
    setCompletedExercises((prev) => {
      const currentList = prev[planId] || [];
      const isAlready = currentList.includes(exerciseName);
      const updated = isAlready
        ? currentList.filter((name) => name !== exerciseName)
        : [...currentList, exerciseName];
      return { ...prev, [planId]: updated };
    });
  };

  const handleOpenLogModal = () => {
    setShowLogModal(true);
  };

  const handleSubmitWorkoutLog = async (e) => {
    e.preventDefault();
    if (!currentPlan || !user) return;
    setSubmittingLog(true);
    setError(null);
    try {
      const token = typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      const planCompleted = completedExercises[currentPlan.id] || [];
      const payload = {
        workoutPlanId: currentPlan.id,
        date: todayDate,
        completedExercises: planCompleted.length > 0 ? planCompleted : exercises.map((ex) => ex.name),
        durationMinutes: Number(modalData.durationMinutes) || 45,
        perceivedExertion: Number(modalData.perceivedExertion) || 7,
        notes: modalData.notes.trim() || undefined,
      };

      const result = await logWorkoutCompletion(payload, token);
      setLogs((prev) => [result, ...prev]);
      setShowLogModal(false);
      setSuccessToast('Workout successfully recorded! Keep up the momentum.');
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      setError(err.message || 'Failed to record workout log');
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <div className="workout-page" data-testid="workout-plan-page">
      {/* Page Header */}
      <div className="workout-header">
        <div className="workout-header-title">
          <div className="workout-icon-badge">
            <Dumbbell size={28} />
          </div>
          <div>
            <h1>Daily Workout Routine</h1>
            <p className="workout-subtitle">
              Follow your trainer-assigned split, track reps & sets, and log daily completion
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="error-banner" style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#4ade80' }} data-testid="success-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} />
            <span>{successToast}</span>
          </div>
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
            onClick={fetchWorkoutData}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Weekday Tabs */}
      <div className="weekday-nav" role="tablist" aria-label="Workout days">
        {WEEKDAYS.map((day) => {
          const isToday = day.key === todayKey;
          const isActive = day.key === selectedDay;
          return (
            <button
              key={day.key}
              role="tab"
              aria-selected={isActive}
              data-testid={`weekday-tab-${day.key}`}
              className={`weekday-btn ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedDay(day.key)}
            >
              <span className="weekday-name">{day.label}</span>
              {isToday && <span className="today-indicator">Today</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="loading-box" data-testid="loading-state">
          <RefreshCw size={24} className="spinning" />
          <span>Loading your routine...</span>
        </div>
      ) : !currentPlan ? (
        /* Empty / Rest Day State */
        <div className="empty-state" data-testid="rest-day-state">
          <Flame size={48} className="empty-state-icon" />
          <h3>Rest & Recovery Day</h3>
          <p>
            No workout plan is scheduled for {WEEKDAYS.find((d) => d.key === selectedDay)?.full || selectedDay}.
            Rest is crucial for muscle repair, recovery, and central nervous system replenishment!
          </p>
        </div>
      ) : (
        /* Plan Content */
        <>
          {/* Summary / Progress Card */}
          <div className="workout-summary-card" data-testid="workout-summary-card">
            <div className="summary-top-row">
              <div className="summary-info">
                <h2>{currentPlan.title}</h2>
                {currentPlan.trainerName && (
                  <span className="trainer-badge">
                    <User size={13} /> Coach {currentPlan.trainerName}
                  </span>
                )}
                {currentPlan.notes && (
                  <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                    {currentPlan.notes}
                  </p>
                )}
              </div>

              <div>
                {todayLog && selectedDay === todayKey ? (
                  <div className="completion-status-pill completed" data-testid="status-completed-today">
                    <CheckCircle2 size={16} /> Completed Today
                  </div>
                ) : (
                  <div className="completion-status-pill pending">
                    <Clock size={16} /> In Progress
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-section">
              <div className="progress-labels">
                <span>Routine Progress</span>
                <span data-testid="progress-text">
                  {currentCompletedCount} of {totalExercises} exercises completed ({progressPercentage}%)
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercentage}%` }}
                  data-testid="progress-bar-fill"
                />
              </div>
            </div>
          </div>

          {/* Exercises Checklist */}
          <div className="exercises-container" data-testid="exercises-list">
            {exercises.map((exercise, index) => {
              const isChecked = (completedExercises[currentPlan.id] || []).includes(exercise.name);

              return (
                <div
                  key={`${exercise.name}-${index}`}
                  className={`exercise-card ${isChecked ? 'completed' : ''}`}
                  data-testid={`exercise-card-${index}`}
                >
                  <button
                    type="button"
                    className={`exercise-checkbox-btn ${isChecked ? 'checked' : ''}`}
                    onClick={() => toggleExercise(exercise.name)}
                    data-testid={`exercise-check-${index}`}
                    aria-label={`Mark ${exercise.name} as ${isChecked ? 'incomplete' : 'complete'}`}
                  >
                    {isChecked ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>

                  <div className="exercise-details">
                    <div className="exercise-title-row">
                      <h3 className="exercise-name">{exercise.name}</h3>
                      {exercise.videoUrl && (
                        <a
                          href={exercise.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-link"
                          data-testid={`video-link-${index}`}
                        >
                          <ExternalLink size={13} /> Demo Tutorial
                        </a>
                      )}
                    </div>

                    <div className="exercise-meta-row">
                      <div className="meta-chip">
                        <span className="meta-label">Sets:</span>
                        <span className="meta-val">{exercise.sets}</span>
                      </div>
                      <div className="meta-chip">
                        <span className="meta-label">Reps:</span>
                        <span className="meta-val">{exercise.reps}</span>
                      </div>
                      {exercise.weightKg !== undefined && exercise.weightKg !== null && (
                        <div className="meta-chip">
                          <span className="meta-label">Target:</span>
                          <span className="meta-val">{exercise.weightKg} kg</span>
                        </div>
                      )}
                      {exercise.restSeconds && (
                        <div className="meta-chip">
                          <span className="meta-label">Rest:</span>
                          <span className="meta-val">{exercise.restSeconds}s</span>
                        </div>
                      )}
                    </div>

                    {exercise.notes && (
                      <div className="exercise-notes">{exercise.notes}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions Bar */}
          <div className="workout-actions-bar">
            <button
              type="button"
              className="btn-complete-workout"
              onClick={handleOpenLogModal}
              data-testid="complete-workout-btn"
            >
              <CheckCircle2 size={18} />
              {todayLog ? 'Log Additional Session' : 'Record Workout Completion'}
            </button>
          </div>
        </>
      )}

      {/* Log Modal */}
      {showLogModal && (
        <div className="modal-overlay" data-testid="log-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log Workout Completion</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowLogModal(false)}
                data-testid="modal-close-btn"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitWorkoutLog}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="durationInput">Session Duration (minutes)</label>
                  <input
                    id="durationInput"
                    type="number"
                    min="1"
                    max="360"
                    className="form-input"
                    value={modalData.durationMinutes}
                    onChange={(e) => setModalData({ ...modalData, durationMinutes: e.target.value })}
                    required
                    data-testid="log-duration-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rpeSelect">Rate of Perceived Exertion (RPE 1-10)</label>
                  <select
                    id="rpeSelect"
                    className="form-select"
                    value={modalData.perceivedExertion}
                    onChange={(e) => setModalData({ ...modalData, perceivedExertion: e.target.value })}
                    data-testid="log-rpe-select"
                  >
                    <option value="4">4 - Easy Recovery</option>
                    <option value="6">6 - Moderate Effort</option>
                    <option value="7">7 - Solid Challenge (1-2 reps in reserve)</option>
                    <option value="8">8 - Heavy Work (1 rep in reserve)</option>
                    <option value="9">9 - Very Tough (Near failure)</option>
                    <option value="10">10 - Maximum Limit (All out)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="notesInput">Workout Feedback / Notes</label>
                  <textarea
                    id="notesInput"
                    rows="3"
                    className="form-textarea"
                    placeholder="e.g., Felt strong on squats, increased bench press weight..."
                    value={modalData.notes}
                    onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                    data-testid="log-notes-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowLogModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submittingLog}
                  data-testid="submit-log-btn"
                >
                  {submittingLog ? 'Saving...' : 'Save & Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adherence / Recent Logs History */}
      {logs.length > 0 && (
        <section className="history-section" data-testid="workout-history-section">
          <h3>
            <Activity size={20} color="#ef4444" /> Recent Workout Adherence
          </h3>
          <div className="history-grid">
            {logs.slice(0, 6).map((log) => (
              <div key={log.id} className="history-card" data-testid={`history-card-${log.id}`}>
                <div className="history-date">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="#38bdf8" /> {log.date}
                  </span>
                  <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>
                    {log.completedExercises?.length || 0} exercises
                  </span>
                </div>
                <div className="history-meta">
                  {log.durationMinutes && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {log.durationMinutes} min
                    </span>
                  )}
                  {log.perceivedExertion && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Flame size={12} color="var(--color-warning)" /> RPE {log.perceivedExertion}/10
                    </span>
                  )}
                </div>
                {log.notes && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                    "{log.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
