/**
 * services/attendanceService.js — Client Service for Member Attendance & Check-ins (Day 17-18)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Submit scanned QR token to perform attendance check-in.
 *
 * @param {string} token - The scanned rotating QR token string
 * @param {string} authToken - Firebase ID token of the authenticated member
 * @param {string} [gymId='fitmax-main'] - Gym branch identifier
 * @returns {Promise<Object>} Check-in confirmation data
 */
export async function checkInAttendance(token, authToken, gymId = 'fitmax-main') {
  if (!token || typeof token !== 'string') {
    throw new Error('QR token is required for check-in');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/attendance/check-in`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: token.trim(), gymId }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Attendance check-in failed');
    error.status = res.status;
    error.code = body.code || 'CHECK_IN_FAILED';
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Fetch member's own attendance summary and streak history
 *
 * @param {string} authToken - Firebase ID token
 * @returns {Promise<Array<Object>>} Array of attendance records
 */
export async function getMyAttendance(authToken) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/attendance/me`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch attendance history');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Calculate consecutive attendance streak and stats from server records.
 *
 * @param {Array<Object>} records - Attendance records from server
 * @returns {Object} { currentStreak, longestStreak, totalCheckIns, lastCheckInDate }
 */
export function calculateStreakFromRecords(records = []) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      lastCheckInDate: null,
    };
  }

  const uniqueDates = [...new Set(records.map((r) => r.date).filter(Boolean))].sort().reverse();

  if (uniqueDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: records.length,
      lastCheckInDate: null,
    };
  }

  const lastCheckInDate = uniqueDates[0];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayStr = formatter.format(now);
  const yesterdayStr = formatter.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  // Current streak requires checking in today or yesterday
  let currentStreak = 0;
  const isStreakAlive = lastCheckInDate === todayStr || lastCheckInDate === yesterdayStr;

  if (isStreakAlive) {
    let expectedDate = new Date(lastCheckInDate);
    for (const dStr of uniqueDates) {
      const actualDate = new Date(dStr);
      const diffDays = Math.round((expectedDate - actualDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        currentStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak across all historical records
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;

  for (let i = uniqueDates.length - 1; i >= 0; i--) {
    const currentDate = new Date(uniqueDates[i]);
    if (!previousDate) {
      runningStreak = 1;
    } else {
      const diff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    previousDate = currentDate;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalCheckIns: records.length,
    lastCheckInDate,
  };
}

/**
 * Generate weekly calendar (Monday to Sunday) mapped with attendance check-ins
 * and membership activation eligibility.
 *
 * @param {Array<Object>} records - Server attendance records
 * @param {Date} [referenceDate=new Date()]
 * @param {Object|null|undefined} [membership=undefined] - Current membership (optional)
 * @returns {Object} { days: Array, attendedCount: number, completionPercent: number }
 */
export function getWeeklyCalendar(
  records = [],
  referenceDate = new Date(),
  membership = undefined
) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayStr = formatter.format(new Date());

  let activationDateStr = null;
  let expiryDateStr = null;
  if (membership && membership.startDate) {
    const startParsed = new Date(membership.startDate);
    if (!Number.isNaN(startParsed.getTime())) {
      activationDateStr = formatter.format(startParsed);
    }
  }
  if (
    membership &&
    membership.endDate &&
    (membership.isExpired || membership.status === 'expired')
  ) {
    const endParsed = new Date(membership.endDate);
    if (!Number.isNaN(endParsed.getTime())) {
      expiryDateStr = formatter.format(endParsed);
    }
  }
  const hasNoActivePlan =
    membership === null || (membership && membership.status === 'payment_pending');

  // Determine Monday of current week (ISO week: Monday = 0, Sunday = 6)
  const dayIndex = (referenceDate.getDay() + 6) % 7;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - dayIndex);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [];
  let attendedCount = 0;
  let eligibleDaysCount = 0;

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + i);
    const dateStr = formatter.format(targetDate);

    // Find any attendance record on this day
    const match = (records || []).find((r) => r.date === dateStr);
    const checkedIn = Boolean(match);

    if (checkedIn) {
      attendedCount++;
    }

    const isPreActivation = Boolean(activationDateStr && dateStr < activationDateStr);
    const isPostExpiry = Boolean(expiryDateStr && dateStr > expiryDateStr);
    const isIneligible =
      !checkedIn &&
      (isPreActivation || isPostExpiry || (hasNoActivePlan && dateStr <= todayStr));

    if (!isPreActivation && !isPostExpiry && !hasNoActivePlan) {
      eligibleDaysCount++;
    }

    const eligibilityStatus = checkedIn
      ? 'attended'
      : isIneligible
        ? 'ineligible'
        : dateStr > todayStr
          ? 'upcoming'
          : dateStr === todayStr
            ? 'today'
            : 'missed';

    days.push({
      dayIndex: i,
      dayName: dayNames[i],
      date: dateStr,
      dayNumber: targetDate.getDate(),
      checkedIn,
      session: match?.session || null,
      timestamp: match?.timestamp || null,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isFuture: dateStr > todayStr,
      isIneligible,
      eligibilityStatus,
    });
  }

  const denominator = eligibleDaysCount > 0 ? eligibleDaysCount : 7;
  const completionPercent = Math.round((attendedCount / denominator) * 100);

  return {
    days,
    attendedCount,
    completionPercent,
  };
}

/**
 * Fetch daily attendance overview (Staff / Owner).
 *
 * @param {string} [dateStr] - YYYY-MM-DD (defaults to today)
 * @param {string} authToken - Firebase ID token
 * @param {string} [gymId='fitmax-main']
 * @returns {Promise<Object>} { date, gymId, totalCount, morningCount, eveningCount, generalCount, records }
 */
export async function getTodayAttendance(dateStr, authToken, gymId = 'fitmax-main') {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const queryParams = new URLSearchParams();
  if (dateStr) queryParams.set('date', dateStr);
  if (gymId) queryParams.set('gymId', gymId);

  const url = `${API_BASE}/attendance/today?${queryParams.toString()}`;
  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch daily attendance');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

export default {
  checkInAttendance,
  getMyAttendance,
  getTodayAttendance,
  calculateStreakFromRecords,
  getWeeklyCalendar,
};
