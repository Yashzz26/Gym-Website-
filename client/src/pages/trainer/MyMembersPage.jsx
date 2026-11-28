import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Dumbbell,
  Flame,
  Heart,
  CalendarCheck,
  RefreshCw,
  Edit3,
  Utensils,
  AlertCircle,
  CheckCircle2,
  X,
  Target,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedMembers,
  updateMemberProgress,
} from '../../services/trainerService';
import './MyMembersPage.css';

const FITNESS_GOALS = [
  'All Goals',
  'Fat Loss',
  'Muscle Gain',
  'Strength Training',
  'General Fitness',
];

/**
 * Returns icon corresponding to fitness goal
 */
function getGoalIcon(goal = '') {
  const g = goal.toLowerCase();
  if (g.includes('fat') || g.includes('loss') || g.includes('weight')) {
    return <Flame size={15} className="goal-icon flame" />;
  }
  if (g.includes('muscle') || g.includes('strength') || g.includes('hypertrophy')) {
    return <Dumbbell size={15} className="goal-icon dumbbell" />;
  }
  return <Heart size={15} className="goal-icon heart" />;
}

export default function MyMembersPage() {
  const { user } = useAuth();
  const userUid = user?.uid;

  // Data states
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('All Goals');
  const [sortBy, setSortBy] = useState('RECENT'); // 'RECENT' | 'VISITS' | 'NAME'

  // Modal State for Progress Updating
  const [editingMember, setEditingMember] = useState(null);
  const [modalForm, setModalForm] = useState({
    fitnessGoal: 'General Fitness',
    currentWeightKg: '',
    targetWeightKg: '',
    notes: '',
  });
  const [savingProgress, setSavingProgress] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  // Fetch assigned members
  const fetchMembers = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const token = user ? await user.getIdToken() : null;
        const data = await getAssignedMembers(token);
        setMembers(data || []);
      } catch (err) {
        console.error('Failed to load assigned members:', err);
        setError(err.message || 'Unable to retrieve assigned members. Please retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userUid]
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Open Edit Modal
  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setModalForm({
      fitnessGoal: member.fitnessGoal || 'General Fitness',
      currentWeightKg: member.currentWeightKg != null ? String(member.currentWeightKg) : '',
      targetWeightKg: member.targetWeightKg != null ? String(member.targetWeightKg) : '',
      notes: member.notes || '',
    });
    setModalError(null);
    setModalSuccess(false);
  };

  // Close Modal
  const handleCloseModal = () => {
    setEditingMember(null);
    setModalError(null);
    setModalSuccess(false);
  };

  // Submit Progress Update
  const handleSaveProgress = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    setSavingProgress(true);
    setModalError(null);

    try {
      const token = user ? await user.getIdToken() : null;
      const payload = {
        fitnessGoal: modalForm.fitnessGoal,
        notes: modalForm.notes.trim() || null,
      };

      if (modalForm.currentWeightKg !== '') {
        const cw = parseFloat(modalForm.currentWeightKg);
        if (isNaN(cw) || cw <= 0) throw new Error('Please enter a valid current weight in kg');
        payload.currentWeightKg = cw;
      }
      if (modalForm.targetWeightKg !== '') {
        const tw = parseFloat(modalForm.targetWeightKg);
        if (isNaN(tw) || tw <= 0) throw new Error('Please enter a valid target weight in kg');
        payload.targetWeightKg = tw;
      }

      await updateMemberProgress(editingMember.memberId, payload, token);

      // Update state locally
      setMembers((prev) =>
        prev.map((m) => {
          if (m.memberId === editingMember.memberId) {
            const cw = payload.currentWeightKg ?? m.currentWeightKg;
            const tw = payload.targetWeightKg ?? m.targetWeightKg;
            const weightDeltaKg =
              cw != null && tw != null ? Number((cw - tw).toFixed(1)) : null;

            return {
              ...m,
              fitnessGoal: payload.fitnessGoal,
              currentWeightKg: cw,
              targetWeightKg: tw,
              weightDeltaKg,
              notes: payload.notes,
            };
          }
          return m;
        })
      );

      setModalSuccess(true);
      setTimeout(() => {
        handleCloseModal();
      }, 700);
    } catch (err) {
      console.error('Failed to update member progress:', err);
      setModalError(err.message || 'Failed to update progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  // Filtered and sorted members
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Goal filter
        if (selectedGoal !== 'All Goals' && m.fitnessGoal !== selectedGoal) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = (m.displayName || '').toLowerCase();
          const email = (m.email || '').toLowerCase();
          const phone = (m.phone || '').toLowerCase();
          const goal = (m.fitnessGoal || '').toLowerCase();
          const plan = (m.activePlan?.planName || '').toLowerCase();
          return name.includes(q) || email.includes(q) || phone.includes(q) || goal.includes(q) || plan.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'VISITS') {
          return (b.attendance?.totalVisits || 0) - (a.attendance?.totalVisits || 0);
        }
        if (sortBy === 'NAME') {
          return (a.displayName || '').localeCompare(b.displayName || '');
        }
        // Default RECENT assigned
        return new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0);
      });
  }, [members, selectedGoal, searchQuery, sortBy]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = members.length;
    let fatLoss = 0;
    let muscleGain = 0;
    let totalVisits = 0;

    members.forEach((m) => {
      const g = (m.fitnessGoal || '').toLowerCase();
      if (g.includes('fat') || g.includes('loss')) fatLoss++;
      else if (g.includes('muscle') || g.includes('strength')) muscleGain++;
      totalVisits += m.attendance?.totalVisits || 0;
    });

    return { total, fatLoss, muscleGain, totalVisits };
  }, [members]);

  return (
    <div className="my-members-container">
      {/* Header */}
      <header className="my-members-header">
        <div className="header-meta">
          <div className="portal-badge">
            <Users size={14} className="badge-icon" />
            <span>Trainer Portal &bull; Client Roster</span>
          </div>
          <h1 className="header-title">Assigned Members</h1>
          <p className="header-subtitle">
            Track member fitness goals, weight targets, attendance streaks, and coaching logs.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchMembers(true)}
            disabled={refreshing || loading}
            aria-label="Refresh assigned members list"
            title="Refresh member list"
          >
            <RefreshCw size={16} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh List'}</span>
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="trainer-error-banner" role="alert">
          <AlertCircle size={20} className="error-icon" />
          <div className="error-text">
            <strong>Error loading assigned members:</strong>
            <span>{error}</span>
          </div>
          <button type="button" className="btn-retry" onClick={() => fetchMembers()}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <section className="trainer-stats-grid" aria-label="Trainer clients summary">
        <div className="stat-card total">
          <div className="icon-wrap total">
            <Users size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-label">Assigned Clients</span>
            <div className="stat-value" data-testid="total-clients-count">
              {loading ? '...' : stats.total}
            </div>
            <span className="stat-subtext">Active 1-on-1 coaching</span>
          </div>
        </div>

        <div className="stat-card fatloss">
          <div className="icon-wrap fatloss">
            <Flame size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-label">Fat Loss Clients</span>
            <div className="stat-value" data-testid="fatloss-clients-count">
              {loading ? '...' : stats.fatLoss}
            </div>
            <span className="stat-subtext">Caloric deficit & cardio</span>
          </div>
        </div>

        <div className="stat-card muscle">
          <div className="icon-wrap muscle">
            <Dumbbell size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-label">Muscle & Strength</span>
            <div className="stat-value" data-testid="muscle-clients-count">
              {loading ? '...' : stats.muscleGain}
            </div>
            <span className="stat-subtext">Hypertrophy & progressive load</span>
          </div>
        </div>

        <div className="stat-card visits">
          <div className="icon-wrap visits">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-label">Total Visits Logged</span>
            <div className="stat-value" data-testid="total-visits-count">
              {loading ? '...' : stats.totalVisits}
            </div>
            <span className="stat-subtext">QR gym check-in adherence</span>
          </div>
        </div>
      </section>

      {/* Controls Bar: Search, Goal Filter & Sort */}
      <section className="trainer-controls-bar">
        <div className="search-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by member name, email or goal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search assigned members"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Goal Filter Pills */}
        <div className="goal-filter-pills" role="tablist" aria-label="Filter by fitness goal">
          {FITNESS_GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              role="tab"
              aria-selected={selectedGoal === goal}
              className={`goal-pill ${selectedGoal === goal ? 'active' : ''}`}
              onClick={() => setSelectedGoal(goal)}
            >
              {goal}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="sort-wrap">
          <span className="sort-label">Sort:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort members"
          >
            <option value="RECENT">Recently Assigned</option>
            <option value="VISITS">Most Check-ins</option>
            <option value="NAME">Name (A-Z)</option>
          </select>
        </div>
      </section>

      {/* Member Cards Grid */}
      <section className="members-roster-section" aria-label="Assigned members list">
        {/* Loading State */}
        {loading && (
          <div className="roster-loading" data-testid="roster-loading">
            <RefreshCw size={28} className="spinning" />
            <p>Loading assigned members and progress data...</p>
          </div>
        )}

        {/* Empty Roster State */}
        {!loading && members.length === 0 && (
          <div className="roster-empty-state" data-testid="roster-empty-state">
            <div className="empty-icon-wrap">
              <Users size={46} />
            </div>
            <h3>No Members Assigned Yet</h3>
            <p>
              You do not have any gym members assigned to your trainer profile currently.
              The gym owner or reception desk assigns members to personal trainers.
            </p>
          </div>
        )}

        {/* Empty Filter State */}
        {!loading && members.length > 0 && filteredMembers.length === 0 && (
          <div className="roster-no-results" data-testid="roster-no-results">
            <AlertCircle size={32} />
            <h4>No matching members</h4>
            <p>No assigned members found matching &ldquo;{searchQuery}&rdquo;.</p>
            <button
              type="button"
              className="btn-clear-filter"
              onClick={() => {
                setSearchQuery('');
                setSelectedGoal('All Goals');
              }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Grid of Member Cards */}
        {!loading && filteredMembers.length > 0 && (
          <div className="members-grid">
            {filteredMembers.map((member) => {
              const initials = (member.displayName || 'M')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              const hasWeights = member.currentWeightKg != null && member.targetWeightKg != null;
              const delta = member.weightDeltaKg;
              const isWeightLossGoal = (member.fitnessGoal || '').toLowerCase().includes('fat') || (member.fitnessGoal || '').toLowerCase().includes('loss');

              return (
                <article key={member.memberId} className="member-card" data-testid={`member-card-${member.memberId}`}>
                  {/* Card Top: Avatar, Name, Email, Role Tag */}
                  <div className="card-top">
                    <div className="member-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="member-main-info">
                      <div className="member-name-row">
                        <h3 className="member-name">{member.displayName || 'Member'}</h3>
                        {member.activePlan && (
                          <span className="plan-badge">{member.activePlan.planName}</span>
                        )}
                      </div>
                      <span className="member-email">{member.email || 'No email registered'}</span>
                      {member.phone && <span className="member-phone">{member.phone}</span>}
                    </div>
                  </div>

                  {/* Goal Badge Pill */}
                  <div className="goal-banner">
                    <div className="goal-tag">
                      {getGoalIcon(member.fitnessGoal)}
                      <span className="goal-text">{member.fitnessGoal || 'General Fitness'}</span>
                    </div>
                    {member.gender && (
                      <span className="gender-tag">{member.gender.toUpperCase()}</span>
                    )}
                  </div>

                  {/* Weight Progress Widget */}
                  <div className="weight-progress-box">
                    <div className="weight-metric">
                      <span className="weight-label">Current</span>
                      <span className="weight-val">
                        {member.currentWeightKg != null ? `${member.currentWeightKg} kg` : '--'}
                      </span>
                    </div>

                    <div className="weight-divider">
                      <Target size={16} className="target-icon" />
                      {hasWeights && (
                        <span
                          className={`delta-badge ${
                            delta === 0
                              ? 'neutral'
                              : isWeightLossGoal
                              ? delta > 0
                                ? 'positive'
                                : 'negative'
                              : delta < 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {delta > 0 ? `+${delta} kg` : `${delta} kg`}
                        </span>
                      )}
                    </div>

                    <div className="weight-metric right">
                      <span className="weight-label">Target</span>
                      <span className="weight-val">
                        {member.targetWeightKg != null ? `${member.targetWeightKg} kg` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Adherence Widget */}
                  <div className="attendance-adherence-box">
                    <div className="adherence-item">
                      <CalendarCheck size={14} className="adh-icon" />
                      <span className="adh-val">
                        <strong>{member.attendance?.totalVisits || 0}</strong> visits recorded
                      </span>
                    </div>

                    <div className="adherence-item streak">
                      <Flame size={14} className="streak-icon" />
                      <span className="adh-streak-val">
                        <strong>{member.attendance?.currentStreak || 0}d</strong> streak
                      </span>
                    </div>
                  </div>

                  {/* Notes Snippet */}
                  {member.notes && (
                    <div className="notes-snippet">
                      <span className="notes-label">Coaching Notes:</span>
                      <p className="notes-content">{member.notes}</p>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-update-progress"
                      onClick={() => handleOpenEdit(member)}
                      title="Update Weight & Goals"
                    >
                      <Edit3 size={15} />
                      <span>Update Progress</span>
                    </button>

                    <div className="action-links">
                      <Link
                        to={`/trainer/workouts?memberId=${member.memberId}`}
                        className="btn-action-link workout"
                        title="View or Build Workout Plan"
                      >
                        <Dumbbell size={14} />
                        <span>Workouts</span>
                      </Link>

                      <Link
                        to={`/trainer/diet?memberId=${member.memberId}`}
                        className="btn-action-link diet"
                        title="View or Build Diet Plan"
                      >
                        <Utensils size={14} />
                        <span>Diet</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Progress & Goals Update Modal */}
      {editingMember && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Target size={20} className="modal-icon" />
                <h3 id="modal-title" className="modal-title" data-testid="modal-title">
                  Update Progress — {editingMember.displayName}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProgress} className="modal-form">
              {modalError && (
                <div className="modal-alert error" role="alert">
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="modal-alert success" role="alert">
                  <CheckCircle2 size={16} />
                  <span>Progress updated</span>
                </div>
              )}

              {/* Fitness Goal Dropdown */}
              <div className="form-group">
                <label htmlFor="fitnessGoal" className="form-label">
                  Primary Fitness Goal
                </label>
                <select
                  id="fitnessGoal"
                  className="form-select"
                  value={modalForm.fitnessGoal}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, fitnessGoal: e.target.value }))
                  }
                  required
                >
                  <option value="Fat Loss">Fat Loss & Leaning</option>
                  <option value="Muscle Gain">Muscle Gain / Hypertrophy</option>
                  <option value="Strength Training">Strength Training</option>
                  <option value="General Fitness">General Fitness & Cardio</option>
                  <option value="Endurance">Endurance & Conditioning</option>
                  <option value="Flexibility & Mobility">Flexibility & Mobility</option>
                </select>
              </div>

              {/* Weight Inputs Row */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="currentWeightKg" className="form-label">
                    Current Weight (kg)
                  </label>
                  <input
                    id="currentWeightKg"
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    placeholder="e.g. 78.5"
                    className="form-input"
                    value={modalForm.currentWeightKg}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, currentWeightKg: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="targetWeightKg" className="form-label">
                    Target Weight (kg)
                  </label>
                  <input
                    id="targetWeightKg"
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    placeholder="e.g. 72.0"
                    className="form-input"
                    value={modalForm.targetWeightKg}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, targetWeightKg: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Coaching Notes */}
              <div className="form-group">
                <label htmlFor="coachingNotes" className="form-label">
                  Coaching Notes & Instructions
                </label>
                <textarea
                  id="coachingNotes"
                  rows={3}
                  className="form-textarea"
                  placeholder="Add notes on form, intensity, calorie targets or weekly recommendations..."
                  value={modalForm.notes}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              {/* Modal Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleCloseModal}
                  disabled={savingProgress}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={savingProgress}
                >
                  {savingProgress ? 'Saving Changes...' : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
