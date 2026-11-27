/**
 * services/reportService.js — Revenue, Attendance, and Retention Analytics (Day 26 Task 51)
 *
 * Implements:
 * 1. Daily revenue aggregation with verified payments (Cash vs UPI vs Online split)
 * 2. Daily attendance check-ins and session breakdown (Morning vs Evening)
 * 3. Daily new member acquisition and membership renewals count
 * 4. Distinct handling of pending dues (overdue unpaid invoices/pending verifications)
 *    vs upcoming renewals (memberships expiring within 7 days, NOT treated as debt)
 * 5. Weekly trend aggregation across rolling 7-day intervals for visual charts
 * 6. Structured export formats for CSV and audit logs
 */

import { db as defaultDb } from '../config/firebase.js';

const TIMEZONE = 'Asia/Kolkata';

export function getFormattedDate(date = new Date(), timeZone = TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
  } catch {
    return new Date(date).toISOString().split('T')[0];
  }
}

export function getDayName(date = new Date(), timeZone = TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
  } catch {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(date).getDay()];
  }
}

export const createReportService = ({ customDb = defaultDb } = {}) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error('[ReportService] Database connection not initialized');
    return customDb.collection(name);
  };

  /**
   * Safe extraction of timestamp date in YYYY-MM-DD
   */
  const extractDate = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      if (val.length >= 10 && val.includes('-')) return val.substring(0, 10);
    }
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString().split('T')[0];
    return null;
  };

  /**
   * Helper to normalize amount in paise from diverse payment document fields
   */
  const extractAmountPaise = (p) => {
    if (typeof p.amountPaise === 'number') return p.amountPaise;
    if (typeof p.amountInPaise === 'number') return p.amountInPaise;
    if (typeof p.amount === 'number') {
      // If amount is stored in standard rupees, convert to paise
      return p.amount > 1000 && p.gateway === 'razorpay' ? p.amount : Math.round(p.amount * 100);
    }
    return 0;
  };

  return {
    /**
     * Generate Daily Analytics Report
     * @param {string} [dateStr] - YYYY-MM-DD (defaults to today)
     * @param {string} [gymId='fitmax-main']
     */
    async getDailyReport(dateStr = getFormattedDate(), gymId = 'fitmax-main') {
      const targetDate = dateStr || getFormattedDate();

      // 1. Fetch verified payments for the date
      const paymentsSnap = await getCollection('payments').get();
      const allPayments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      let totalRevenuePaise = 0;
      let cashPaise = 0;
      let cashCount = 0;
      let upiPaise = 0;
      let upiCount = 0;
      let onlinePaise = 0;
      let onlineCount = 0;
      let transactionsCount = 0;

      // Pending dues collections (unpaid / awaiting verification)
      let pendingDuesPaise = 0;
      const pendingDuesItems = [];

      for (const p of allPayments) {
        const paymentDate = extractDate(p.createdAt || p.timestamp || p.paymentDate);
        const isVerified = p.status === 'captured' || p.status === 'completed' || p.status === 'success';
        const isPending =
          p.status === 'pending' ||
          p.status === 'created' ||
          p.status === 'verification_pending' ||
          p.status === 'requires_action';

        const amountPaise = extractAmountPaise(p);

        // Verified revenue on target date
        if (paymentDate === targetDate && isVerified) {
          totalRevenuePaise += amountPaise;
          transactionsCount += 1;

          const method = String(p.method || p.paymentMethod || '').toLowerCase();
          if (method === 'cash') {
            cashPaise += amountPaise;
            cashCount += 1;
          } else if (method === 'upi' || method.includes('upi')) {
            upiPaise += amountPaise;
            upiCount += 1;
          } else {
            onlinePaise += amountPaise;
            onlineCount += 1;
          }
        }

        // Pending dues (regardless of date, represents outstanding collections)
        if (isPending) {
          pendingDuesPaise += amountPaise;
          pendingDuesItems.push({
            paymentId: p.id,
            memberId: p.userId || p.memberId || null,
            memberName: p.memberName || p.userName || 'Member',
            email: p.email || null,
            planName: p.planName || 'Gym Plan',
            amountRupees: Math.round(amountPaise / 100),
            status: p.status,
            createdAt: p.createdAt || null,
            method: p.method || 'unknown',
          });
        }
      }

      // 2. Fetch attendance for target date
      const attendanceSnap = await getCollection('attendance').get();
      const allAttendance = attendanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      let totalCheckIns = 0;
      let morningCheckIns = 0;
      let eveningCheckIns = 0;
      const uniqueMemberIds = new Set();

      for (const att of allAttendance) {
        const attDate = att.date || extractDate(att.timestamp);
        if (attDate === targetDate) {
          totalCheckIns += 1;
          if (att.userId) uniqueMemberIds.add(att.userId);

          const session = String(att.session || '').toLowerCase();
          if (session === 'morning') {
            morningCheckIns += 1;
          } else if (session === 'evening') {
            eveningCheckIns += 1;
          } else {
            // Determine from time if session not explicitly saved
            const hour = att.timestamp ? new Date(att.timestamp).getHours() : 12;
            if (hour < 14) morningCheckIns += 1;
            else eveningCheckIns += 1;
          }
        }
      }

      // 3. Fetch new member registrations on target date
      const usersSnap = await getCollection('users').get();
      let newMembersCount = 0;
      for (const doc of usersSnap.docs) {
        const u = doc.data();
        if (u.role === 'member') {
          const userDate = extractDate(u.createdAt);
          if (userDate === targetDate) {
            newMembersCount += 1;
          }
        }
      }

      // 4. Fetch renewals processed on target date
      const membershipsSnap = await getCollection('memberships').get();
      let renewalsCount = 0;
      const upcomingRenewalsItems = [];
      let projectedUpcomingRenewalPaise = 0;

      const targetDateTime = new Date(`${targetDate}T00:00:00.000Z`).getTime();
      const sevenDaysLaterTime = targetDateTime + 7 * 24 * 60 * 60 * 1000;

      for (const doc of membershipsSnap.docs) {
        const m = doc.data();
        const memStartDate = extractDate(m.startDate || m.createdAt);

        // Renewals on target date
        if (memStartDate === targetDate && m.isRenewal === true) {
          renewalsCount += 1;
        }

        // Upcoming renewals expiring within next 7 days
        // (Defined separately from debt / pending dues per acceptance criteria)
        if (m.status === 'active' && m.endDate) {
          const endDateTime = new Date(m.endDate).getTime();
          if (endDateTime >= targetDateTime && endDateTime <= sevenDaysLaterTime) {
            const planPricePaise = m.priceInPaise || (m.price ? m.price * 100 : 0) || 149900;
            projectedUpcomingRenewalPaise += planPricePaise;

            const daysRemaining = Math.max(0, Math.ceil((endDateTime - targetDateTime) / (24 * 60 * 60 * 1000)));

            upcomingRenewalsItems.push({
              membershipId: doc.id,
              userId: m.userId,
              userName: m.userName || m.memberName || 'Active Member',
              userEmail: m.userEmail || m.email || null,
              planName: m.planName || 'Membership Tier',
              endDate: m.endDate,
              daysRemaining,
              renewalPriceRupees: Math.round(planPricePaise / 100),
            });
          }
        }
      }

      // Sort upcoming renewals by urgency (least days remaining first)
      upcomingRenewalsItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

      return {
        date: targetDate,
        gymId,
        revenue: {
          totalRupees: Math.round(totalRevenuePaise / 100),
          totalPaise: totalRevenuePaise,
          transactionsCount,
          breakdown: {
            cash: {
              rupees: Math.round(cashPaise / 100),
              paise: cashPaise,
              count: cashCount,
              percentage: totalRevenuePaise > 0 ? Math.round((cashPaise / totalRevenuePaise) * 100) : 0,
            },
            upi: {
              rupees: Math.round(upiPaise / 100),
              paise: upiPaise,
              count: upiCount,
              percentage: totalRevenuePaise > 0 ? Math.round((upiPaise / totalRevenuePaise) * 100) : 0,
            },
            online: {
              rupees: Math.round(onlinePaise / 100),
              paise: onlinePaise,
              count: onlineCount,
              percentage: totalRevenuePaise > 0 ? Math.round((onlinePaise / totalRevenuePaise) * 100) : 0,
            },
          },
        },
        attendance: {
          totalCheckIns,
          uniqueMembers: uniqueMemberIds.size,
          morningCheckIns,
          eveningCheckIns,
        },
        members: {
          newMembersCount,
          renewalsCount,
        },
        pendingDues: {
          count: pendingDuesItems.length,
          totalRupees: Math.round(pendingDuesPaise / 100),
          totalPaise: pendingDuesPaise,
          items: pendingDuesItems,
        },
        upcomingRenewals: {
          count: upcomingRenewalsItems.length,
          projectedRevenueRupees: Math.round(projectedUpcomingRenewalPaise / 100),
          projectedRevenuePaise: projectedUpcomingRenewalPaise,
          notice: 'Memberships expiring within 7 days shown as upcoming renewals, not automatically as overdue debt.',
          items: upcomingRenewalsItems,
        },
      };
    },

    /**
     * Generate Weekly Analytics Report across rolling N days (default 7)
     * @param {string} [endDateStr] - YYYY-MM-DD
     * @param {number} [days=7] - Number of days to include
     * @param {string} [gymId='fitmax-main']
     */
    async getWeeklyReport(endDateStr = getFormattedDate(), days = 7, gymId = 'fitmax-main') {
      const end = endDateStr || getFormattedDate();
      const numDays = Math.min(Math.max(days || 7, 1), 30);

      // Build array of dates in chronological order
      const dateList = [];
      const endDateObj = new Date(`${end}T12:00:00.000Z`);

      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(endDateObj.getTime() - i * 24 * 60 * 60 * 1000);
        dateList.push(d.toISOString().split('T')[0]);
      }

      const startDateStr = dateList[0];

      // Fetch daily reports in parallel
      const dailyReports = await Promise.all(
        dateList.map((d) => this.getDailyReport(d, gymId))
      );

      // Aggregate totals for the week
      let totalRevenueRupees = 0;
      let totalCashRupees = 0;
      let totalUpiRupees = 0;
      let totalOnlineRupees = 0;
      let totalCheckIns = 0;
      let totalMorningCheckIns = 0;
      let totalEveningCheckIns = 0;
      let totalNewMembers = 0;
      let totalRenewals = 0;

      const dailyTrend = dailyReports.map((report) => {
        const dObj = new Date(`${report.date}T12:00:00.000Z`);
        const dayName = getDayName(dObj);

        totalRevenueRupees += report.revenue.totalRupees;
        totalCashRupees += report.revenue.breakdown.cash.rupees;
        totalUpiRupees += report.revenue.breakdown.upi.rupees;
        totalOnlineRupees += report.revenue.breakdown.online.rupees;
        totalCheckIns += report.attendance.totalCheckIns;
        totalMorningCheckIns += report.attendance.morningCheckIns;
        totalEveningCheckIns += report.attendance.eveningCheckIns;
        totalNewMembers += report.members.newMembersCount;
        totalRenewals += report.members.renewalsCount;

        return {
          date: report.date,
          dayName,
          revenueRupees: report.revenue.totalRupees,
          cashRupees: report.revenue.breakdown.cash.rupees,
          upiRupees: report.revenue.breakdown.upi.rupees,
          onlineRupees: report.revenue.breakdown.online.rupees,
          transactionsCount: report.revenue.transactionsCount,
          checkIns: report.attendance.totalCheckIns,
          morningCheckIns: report.attendance.morningCheckIns,
          eveningCheckIns: report.attendance.eveningCheckIns,
          newMembers: report.members.newMembersCount,
          renewals: report.members.renewalsCount,
        };
      });

      // Latest snapshot for pending dues & upcoming renewals from the most recent day report
      const latestReport = dailyReports[dailyReports.length - 1];

      return {
        startDate: startDateStr,
        endDate: end,
        daysCount: numDays,
        gymId,
        summary: {
          totalRevenueRupees,
          averageDailyRevenueRupees: Math.round(totalRevenueRupees / numDays),
          cashRupees: totalCashRupees,
          cashPercentage: totalRevenueRupees > 0 ? Math.round((totalCashRupees / totalRevenueRupees) * 100) : 0,
          upiRupees: totalUpiRupees,
          upiPercentage: totalRevenueRupees > 0 ? Math.round((totalUpiRupees / totalRevenueRupees) * 100) : 0,
          onlineRupees: totalOnlineRupees,
          onlinePercentage: totalRevenueRupees > 0 ? Math.round((totalOnlineRupees / totalRevenueRupees) * 100) : 0,
          totalCheckIns,
          averageDailyCheckIns: Math.round(totalCheckIns / numDays),
          morningCheckIns: totalMorningCheckIns,
          eveningCheckIns: totalEveningCheckIns,
          totalNewMembers,
          totalRenewals,
          pendingDuesCount: latestReport.pendingDues.count,
          pendingDuesRupees: latestReport.pendingDues.totalRupees,
          upcomingRenewalsCount: latestReport.upcomingRenewals.count,
          projectedUpcomingRenewalRupees: latestReport.upcomingRenewals.projectedRevenueRupees,
        },
        dailyTrend,
        pendingDues: latestReport.pendingDues,
        upcomingRenewals: latestReport.upcomingRenewals,
      };
    },

    /**
     * Get CSV export representation
     */
    async getExportData({ type = 'daily', date = getFormattedDate(), endDate = getFormattedDate(), gymId = 'fitmax-main' } = {}) {
      if (type === 'daily') {
        const report = await this.getDailyReport(date, gymId);
        return {
          filename: `ironcore_daily_report_${report.date}.csv`,
          headers: ['Metric', 'Value', 'Notes'],
          rows: [
            ['Report Date', report.date, ''],
            ['Total Revenue (INR)', report.revenue.totalRupees, 'Verified collections'],
            ['Cash Collections (INR)', report.revenue.breakdown.cash.rupees, `${report.revenue.breakdown.cash.count} receipts`],
            ['UPI Collections (INR)', report.revenue.breakdown.upi.rupees, `${report.revenue.breakdown.upi.count} transactions`],
            ['Online / Card (INR)', report.revenue.breakdown.online.rupees, `${report.revenue.breakdown.online.count} gateway orders`],
            ['Total Check-Ins', report.attendance.totalCheckIns, `${report.attendance.uniqueMembers} unique members`],
            ['Morning Check-Ins', report.attendance.morningCheckIns, 'Morning session'],
            ['Evening Check-Ins', report.attendance.eveningCheckIns, 'Evening session'],
            ['New Members Enrolled', report.members.newMembersCount, 'First-time registrations'],
            ['Renewals Processed', report.members.renewalsCount, 'Extended memberships'],
            ['Pending Unpaid Dues (INR)', report.pendingDues.totalRupees, `${report.pendingDues.count} pending items`],
            ['Upcoming 7-Day Renewals', report.upcomingRenewals.count, `Projected INR ${report.upcomingRenewals.projectedRevenueRupees}`],
          ],
        };
      } else {
        const weekly = await this.getWeeklyReport(endDate, 7, gymId);
        return {
          filename: `ironcore_weekly_report_${weekly.startDate}_to_${weekly.endDate}.csv`,
          headers: ['Date', 'Day', 'Revenue (INR)', 'Cash (INR)', 'UPI (INR)', 'Check-Ins', 'Morning', 'Evening', 'New Members', 'Renewals'],
          rows: weekly.dailyTrend.map((d) => [
            d.date,
            d.dayName,
            d.revenueRupees,
            d.cashRupees,
            d.upiRupees,
            d.checkIns,
            d.morningCheckIns,
            d.eveningCheckIns,
            d.newMembers,
            d.renewals,
          ]),
        };
      }
    },
  };
};

export const reportService = createReportService();
export default reportService;
