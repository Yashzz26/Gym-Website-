import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  ExternalLink,
  Award,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getWorkoutPlans,
  logWorkoutCompletion,
  getWorkoutLogs,
} from '../../services/workoutService';
import {
  PageHeader,
  StatusTag,
  ProgressBar,
  StatePanel,
} from '../../components/member/MemberUI';
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
  const dayIndex = new Date().getDay();
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[dayIndex] || 'mon';
}

function getTodayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function getIsoDateWeekdayKey(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d.getDay()] || null;
}

export default function WorkoutPlanPage() {
  const { user, profile } = useAuth();
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
      setPlans(Array.isArray(plansData) ? plansData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load workout details');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkoutData();
  }, [fetchWorkoutData]);

  const currentPlan = useMemo(() => {
    return (
      plans.find((p) => p.weekDay === selectedDay) ||
      plans.find((p) => p.weekDay === 'all') ||
      null
    );
  }, [plans, selectedDay]);

  const todayLog = useMemo(() => {
    return logs.find((l) => l.date === todayDate);
  }, [logs, todayDate]);

  // Identify weekdays with completed logs in recent 7 days
  const loggedDaysSet = useMemo(() => {
    const todayMs = new Date(`${todayDate}T00:00:00`).getTime();
    const cutoff = todayMs - 7 * 24 * 60 * 60 * 1000;
    const set = new Set();
    for (const log of logs) {
      if (!log?.date) continue;
      const t = new Date(`${log.date}T00:00:00`).getTime();
      if (!Number.isNaN(t) && t >= cutoff) {
        const key = getIsoDateWeekdayKey(log.date);
        if (key) set.add(key);
      }
    }
    return set;
  }, [logs, todayDate]);

  // Determine nearest upcoming scheduled workout after selectedDay for Rest Day guidance
  const nextScheduledSession = useMemo(() => {
    if (plans.length === 0) return null;
    const startIdx = WEEKDAYS.findIndex((d) => d.key === selectedDay);
    if (startIdx < 0) return null;

    for (let offset = 1; offset <= 6; offset++) {
      const candidateDay = WEEKDAYS[(startIdx + offset) % 7];
      const match = plans.find(
        (p) => p.weekDay === candidateDay.key || p.weekDay === 'all'
      );
      if (match) {
        return { day: candidateDay, plan: match };
      }
    }
    return null;
  }, [plans, selectedDay]);

  const exercises = currentPlan?.exercises || [];
  const totalExercises = exercises.length;

  const currentCompletedCount = useMemo(() => {
    if (!currentPlan) return 0;
    return (completedExercises[currentPlan.id] || []).length;
  }, [currentPlan, completedExercises]);

  const progressPercentage =
    totalExercises > 0 ? Math.round((currentCompletedCount / totalExercises) * 100) : 0;

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
        completedExercises:
          planCompleted.length > 0 ? planCompleted : exercises.map((ex) => ex.name),
        durationMinutes: Number(modalData.durationMinutes) || 45,
        perceivedExertion: Number(modalData.perceivedExertion) || 7,
        notes: modalData.notes.trim() || undefined,
      };

      const result = await logWorkoutCompletion(payload, token);
      setLogs((prev) => [result, ...prev]);
      setShowLogModal(false);
      setSuccessToast('Workout completion logged.');
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      setError(err.message || 'Failed to record workout log');
    } finally {
      setSubmittingLog(false);
    }
  };

  const selectedDayInfo = WEEKDAYS.find((d) => d.key === selectedDay);
  const assignedTrainerName = profile?.assignedTrainerName || profile?.trainerName || null;

  return (
    <div className="member-page" data-testid="workout-plan-page">
      <PageHeader
        title="Daily Workout Routine"
        subtitle="Follow your trainer-assigned split, track sets and reps, and log completed sessions."
      />

      {successToast && (
        <div className="member-alert is-success" role="status" data-testid="success-banner">
          <div className="member-alert-body">
            <Award size={16} />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="member-alert is-error" role="alert" data-testid="error-banner">
          <div className="member-alert-body">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchWorkoutData}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <StatePanel
          testId="loading-state"
          icon={RefreshCw}
          spinIcon
          title="Loading your routine…"
          description="Fetching weekly workouts and completion history."
        />
      ) : plans.length === 0 ? (
        /* No Workout Plan Assigned — Weekday Rest Navigation Intentionally Hidden */
        <section className="member-panel workout-unassigned-panel" data-testid="no-plan-state">
          <div className="unassigned-head">
            <div className="member-state-icon" aria-hidden="true">
              <Dumbbell size={18} strokeWidth={1.65} />
            </div>
            <div>
              <h3>No Workout Plan Assigned</h3>
              <p>
                A weekly training split has not been published for your account yet. Once your
                trainer creates your schedule, exercises, sets, and rest intervals will appear here.
              </p>
            </div>
          </div>
          {assignedTrainerName && (
            <div className="assigned-trainer-meta">
              <span>Assigned trainer</span>
              <strong>{assignedTrainerName}</strong>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Compact 7-Day Selector (Rendered Only When Trainer Plans Exist) */}
          <div className="weekday-nav" role="tablist" aria-label="Workout days">
            {WEEKDAYS.map((day) => {
              const isToday = day.key === todayKey;
              const isActive = day.key === selectedDay;
              const hasPlan = plans.some((p) => p.weekDay === day.key || p.weekDay === 'all');
              const isCompletedDay = loggedDaysSet.has(day.key);

              const stateLabel = isCompletedDay
                ? 'Done'
                : isToday
                  ? 'Today'
                  : hasPlan
                    ? 'Workout'
                    : 'Rest';

              return (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`weekday-tab-${day.key}`}
                  className={`weekday-btn ${isActive ? 'is-selected' : ''} ${
                    isToday ? 'is-today' : ''
                  }`}
                  onClick={() => setSelectedDay(day.key)}
                >
                  <span className="weekday-name">{day.label}</span>
                  <span className="weekday-meta-row">
                    <span
                      className={`weekday-status-dot ${
                        isCompletedDay
                          ? 'is-done'
                          : hasPlan
                            ? 'is-scheduled'
                            : 'is-rest'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="weekday-meta-label">{stateLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {!currentPlan ? (
        /* Compact Rest Day Recovery State */
        <section className="member-panel rest-day-panel" data-testid="rest-day-state">
          <div className="rest-day-top">
            <div>
              <StatusTag variant="neutral">{selectedDayInfo?.full || selectedDay}</StatusTag>
              <h3>Rest &amp; Recovery Day</h3>
              <p>
                No workout session is scheduled for {selectedDayInfo?.full || selectedDay}. Give
                muscle tissue and your nervous system time to recover before your next session.
              </p>
            </div>

            {nextScheduledSession && (
              <div className="next-workout-callout">
                <span className="next-workout-eyebrow">Next scheduled workout</span>
                <strong className="next-workout-title">
                  {nextScheduledSession.day.full} — {nextScheduledSession.plan.title}
                </strong>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedDay(nextScheduledSession.day.key)}
                >
                  <span>Preview {nextScheduledSession.day.label}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="recovery-habits-strip" aria-label="General recovery guidance">
            <div className="recovery-habit-item">
              <span className="recovery-habit-title">Hydration</span>
              <span className="recovery-habit-desc">Stay hydrated consistently throughout the day.</span>
            </div>
            <div className="recovery-habit-item">
              <span className="recovery-habit-title">Mobility</span>
              <span className="recovery-habit-desc">10–15 minutes of gentle stretching or foam rolling.</span>
            </div>
            <div className="recovery-habit-item">
              <span className="recovery-habit-title">Light movement</span>
              <span className="recovery-habit-desc">Easy outdoor walking to support circulation.</span>
            </div>
          </div>
        </section>
      ) : (
        /* Scheduled Workout View */
        <div className="workout-active-stack">
          <section className="member-panel workout-summary-panel" data-testid="workout-summary-card">
            <div className="workout-summary-top">
              <div className="workout-summary-info">
                <div className="workout-summary-badges">
                  {currentPlan.muscleGroup && (
                    <StatusTag variant="accent">{currentPlan.muscleGroup}</StatusTag>
                  )}
                  {currentPlan.trainerName && (
                    <StatusTag variant="neutral">Coach {currentPlan.trainerName}</StatusTag>
                  )}
                </div>
                <h2>{currentPlan.title}</h2>
                {currentPlan.notes && <p className="workout-plan-notes">{currentPlan.notes}</p>}
              </div>

              {todayLog && selectedDay === todayKey ? (
                <StatusTag variant="success" className="completed-today-tag">
                  <span data-testid="status-completed-today">Completed Today</span>
                </StatusTag>
              ) : (
                <StatusTag variant="warning">In Progress</StatusTag>
              )}
            </div>

            <ProgressBar
              label="Routine Progress"
              value={progressPercentage}
              valueText={`${currentCompletedCount} of ${totalExercises} exercises completed (${progressPercentage}%)`}
              valueTestId="progress-text"
              fillTestId="progress-bar-fill"
              variant={progressPercentage === 100 ? 'success' : 'accent'}
            />
          </section>

          {/* Clean Checklist Table Container */}
          <section className="member-panel exercises-panel" data-testid="exercises-list">
            <div className="member-section-header">
              <h3 className="member-section-title">Exercises</h3>
              <span className="member-section-meta tabular-nums">{totalExercises} movements</span>
            </div>

            <div className="exercises-list-stack">
              {exercises.map((exercise, index) => {
                const isChecked = (completedExercises[currentPlan.id] || []).includes(
                  exercise.name
                );

                return (
                  <div
                    key={`${exercise.name}-${index}`}
                    className={`exercise-row ${isChecked ? 'is-completed' : ''}`}
                    data-testid={`exercise-card-${index}`}
                  >
                    <button
                      type="button"
                      className={`exercise-checkbox-btn ${isChecked ? 'is-checked' : ''}`}
                      onClick={() => toggleExercise(exercise.name)}
                      data-testid={`exercise-check-${index}`}
                      aria-label={`Mark ${exercise.name} as ${isChecked ? 'incomplete' : 'complete'}`}
                    >
                      {isChecked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>

                    <div className="exercise-row-body">
                      <div className="exercise-row-top">
                        <div className="exercise-heading-group">
                          <h4 className="exercise-name">{exercise.name}</h4>
                          {exercise.muscleGroup && (
                            <span className="exercise-muscle-tag">{exercise.muscleGroup}</span>
                          )}
                        </div>
                        {exercise.videoUrl && (
                          <a
                            href={exercise.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="video-link"
                            data-testid={`video-link-${index}`}
                          >
                            <ExternalLink size={13} />
                            <span>Demo Tutorial</span>
                          </a>
                        )}
                      </div>

                      <div className="exercise-specs-row tabular-nums">
                        <span>
                          <strong>{exercise.sets}</strong> sets
                        </span>
                        <span className="spec-sep" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          <strong>{exercise.reps}</strong> reps
                        </span>
                        {exercise.weightKg !== undefined && exercise.weightKg !== null && (
                          <>
                            <span className="spec-sep" aria-hidden="true">
                              ·
                            </span>
                            <span>
                              <strong>{exercise.weightKg} kg</strong> target
                            </span>
                          </>
                        )}
                        {exercise.restSeconds && (
                          <>
                            <span className="spec-sep" aria-hidden="true">
                              ·
                            </span>
                            <span>
                              <strong>{exercise.restSeconds}s</strong> rest
                            </span>
                          </>
                        )}
                      </div>

                      {exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="workout-actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowLogModal(true)}
                data-testid="complete-workout-btn"
              >
                <CheckCircle2 size={16} />
                <span>{todayLog ? 'Log Additional Session' : 'Record Workout Completion'}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </>
      )}

      {/* Completion Log Modal */}
      {showLogModal && (
        <div className="modal-overlay" data-testid="log-modal">
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Log Workout Completion">
            <div className="modal-header">
              <h3>Log Workout Completion</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowLogModal(false)}
                data-testid="modal-close-btn"
                aria-label="Close modal"
              >
                <X size={18} />
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
                    value={modalData.durationMinutes}
                    onChange={(e) =>
                      setModalData({ ...modalData, durationMinutes: e.target.value })
                    }
                    required
                    data-testid="log-duration-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rpeSelect">Rate of Perceived Exertion (RPE 1-10)</label>
                  <select
                    id="rpeSelect"
                    value={modalData.perceivedExertion}
                    onChange={(e) =>
                      setModalData({ ...modalData, perceivedExertion: e.target.value })
                    }
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
                    placeholder="Session notes and weights lifted"
                    value={modalData.notes}
                    onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                    data-testid="log-notes-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLogModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingLog}
                  data-testid="submit-log-btn"
                >
                  {submittingLog ? 'Saving…' : 'Save & Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Workout Adherence */}
      {logs.length > 0 && (
        <section className="member-panel workout-history-panel" data-testid="workout-history-section">
          <div className="member-section-header">
            <h3 className="member-section-title">Recent Workout Adherence</h3>
            <span className="member-section-meta tabular-nums">{logs.length} logged</span>
          </div>

          <div className="workout-history-grid">
            {logs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="workout-history-item"
                data-testid={`history-card-${log.id}`}
              >
                <div className="history-item-top">
                  <span className="history-item-date tabular-nums">
                    <Calendar size={13} />
                    <span>{log.date}</span>
                  </span>
                  <span className="history-item-count tabular-nums">
                    {log.completedExercises?.length || 0} exercises
                  </span>
                </div>
                <div className="history-item-meta tabular-nums">
                  {log.durationMinutes && (
                    <span>
                      <Clock size={12} /> {log.durationMinutes} min
                    </span>
                  )}
                  {log.perceivedExertion && <span>RPE {log.perceivedExertion}/10</span>}
                </div>
                {log.notes && <p className="history-item-notes">{log.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
