import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getPendingStaff,
  approveStaff,
  suspendStaff,
  createStaffAccountByOwner,
} from '../../services/userService';
import './StaffApprovalPage.css';

export default function StaffApprovalPage() {
  const { user } = useAuth();
  const [pendingStaff, setPendingStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [actionLoading, setActionLoading] = useState(null);

  // Direct staff addition form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({
    uid: '',
    email: '',
    displayName: '',
    role: 'trainer',
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchStaffQueue = useCallback(async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const data = await getPendingStaff(token);
      setPendingStaff(data || []);
    } catch (err) {
      // In offline / test mode without backend, provide safe empty state
      setPendingStaff([]);
      if (err.status !== 404) {
        console.warn('[StaffApprovalPage] Failed to fetch staff list:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStaffQueue();
  }, [fetchStaffQueue]);

  const handleApprove = async (staffUid, assignedRole) => {
    setActionLoading(staffUid);
    setFeedback({ type: '', message: '' });
    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      await approveStaff(staffUid, assignedRole, token);
      setFeedback({
        type: 'success',
        message: 'Staff account successfully approved and granted portal access.',
      });
      setPendingStaff((prev) => prev.filter((s) => s.uid !== staffUid));
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to approve staff account.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (staffUid) => {
    setActionLoading(staffUid);
    setFeedback({ type: '', message: '' });
    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      await suspendStaff(staffUid, 'Rejected by gym owner during registration review', token);
      setFeedback({
        type: 'success',
        message: 'Staff registration rejected and account suspended.',
      });
      setPendingStaff((prev) => prev.filter((s) => s.uid !== staffUid));
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to reject staff account.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.email || !newStaff.displayName) return;

    setCreateLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const token = user?.getIdToken ? await user.getIdToken() : null;
      const uid = newStaff.uid || `staff-${Date.now()}`;
      await createStaffAccountByOwner(
        {
          uid,
          email: newStaff.email,
          displayName: newStaff.displayName,
          role: newStaff.role,
        },
        token
      );
      setFeedback({
        type: 'success',
        message: `Direct staff account for ${newStaff.displayName} (${newStaff.role}) successfully created.`,
      });
      setNewStaff({ uid: '', email: '', displayName: '', role: 'trainer' });
      setShowAddForm(false);
      fetchStaffQueue();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to create staff account.',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="staff-approval-container">
      {/* Header Banner */}
      <div className="staff-header-banner">
        <div className="staff-header-title">
          <span className="badge badge-accent" style={{ marginBottom: 'var(--spacing-1)' }}>
            Owner Security Control · Day 8
          </span>
          <h1>Staff Account Approvals & Roles</h1>
          <p>Review self-registered staff or provision pre-approved gym personnel.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchStaffQueue}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            <Plus size={16} />
            <span>Provision Staff</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="staff-stats-grid">
        <div className="staff-stat-card">
          <div className="staff-stat-icon">
            <Clock size={22} />
          </div>
          <div>
            <div className="staff-stat-number">{pendingStaff.length}</div>
            <div className="staff-stat-label">Pending Approval</div>
          </div>
        </div>
        <div className="staff-stat-card">
          <div className="staff-stat-icon approved">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="staff-stat-number">Zero-Trust</div>
            <div className="staff-stat-label">Server Authorization</div>
          </div>
        </div>
        <div className="staff-stat-card">
          <div className="staff-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Users size={22} />
          </div>
          <div>
            <div className="staff-stat-number">Owner Gate</div>
            <div className="staff-stat-label">Public Role Restrictions</div>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback.message && (
        <div
          role="alert"
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            background:
              feedback.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${
              feedback.type === 'error' ? '#ef4444' : '#22c55e'
            }`,
            color: feedback.type === 'error' ? '#fca5a5' : '#86efac',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
          }}
        >
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Direct Staff Addition Form (Owner) */}
      {showAddForm && (
        <div className="staff-content-card">
          <div className="staff-card-header">
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
              Direct Staff Provisioning (Owner Created)
            </h3>
            <span className="badge badge-accent">Bypasses Pending Queue</span>
          </div>
          <form onSubmit={handleCreateStaff} className="direct-create-form">
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Trainer"
                value={newStaff.displayName}
                onChange={(e) => setNewStaff({ ...newStaff, displayName: e.target.value })}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                Staff Email
              </label>
              <input
                type="email"
                placeholder="staff@ironcore.com"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                Role
              </label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value="trainer">Trainer</option>
                <option value="reception">Receptionist</option>
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createLoading}
            >
              <span>{createLoading ? 'Provisioning…' : 'Add Active Staff'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Pending Approvals Table */}
      <div className="staff-content-card">
        <div className="staff-card-header">
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
            Self-Registered Staff Awaiting Approval
          </h3>
          <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
            {pendingStaff.length} Pending
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading staff queue…
          </div>
        ) : pendingStaff.length === 0 ? (
          <div className="staff-empty-state">
            <CheckCircle2 size={48} className="staff-empty-icon" />
            <h4 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-primary)' }}>
              All Caught Up!
            </h4>
            <p>There are no staff self-registrations pending approval.</p>
          </div>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Requested Role</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingStaff.map((staff) => (
                <tr key={staff.uid}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{staff.displayName || 'Unnamed Staff'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {staff.email}
                    </div>
                  </td>
                  <td>
                    <span className={`staff-role-badge ${staff.role}`}>
                      {staff.role}
                    </span>
                  </td>
                  <td>
                    {staff.createdAt
                      ? new Date(staff.createdAt).toLocaleDateString()
                      : 'Recently'}
                  </td>
                  <td>
                    <span className="staff-status-badge pending">
                      <Clock size={12} />
                      Pending Review
                    </span>
                  </td>
                  <td>
                    <div className="staff-action-btns">
                      <button
                        type="button"
                        className="btn-approve"
                        onClick={() => handleApprove(staff.uid, staff.role)}
                        disabled={actionLoading === staff.uid}
                      >
                        <UserCheck size={14} />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleReject(staff.uid)}
                        disabled={actionLoading === staff.uid}
                      >
                        <UserX size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
