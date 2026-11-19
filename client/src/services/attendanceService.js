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
 * Generate weekly calendar (Monday to Sunday) mapped with attendance check-ins.
 *
 * @param {Array<Object>} records - Server attendance records
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} { days: Array, attendedCount: number, completionPercent: number }
 */
export function getWeeklyCalendar(records = [], referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayStr = formatter.format(new Date());

  // Determine Monday of current week (ISO week: Monday = 0, Sunday = 6)
  const dayIndex = (referenceDate.getDay() + 6) % 7;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - dayIndex);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [];
  let attendedCount = 0;

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
    });
  }

  const completionPercent = Math.round((attendedCount / 7) * 100);

  return {
    days,
    attendedCount,
    completionPercent,
  };
}

export default {
  checkInAttendance,
  getMyAttendance,
  calculateStreakFromRecords,
  getWeeklyCalendar,
};
