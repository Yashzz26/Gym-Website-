/**
 * services/reminderAutomationService.js — Automated Idempotent Reminder Jobs (Day 25 Task 50)
 *
 * Implements:
 * 1. 3-day membership expiration reminders (WhatsApp utility + in-app notification)
 * 2. 7+ day inactive member re-engagement follow-ups (WhatsApp + in-app notification)
 * 3. Strict idempotency and duplicate prevention via reminderLogs collection
 * 4. Respects member WhatsApp opt-out preferences
 */

import { db as defaultDb } from '../config/firebase.js';
import { whatsappService as defaultWhatsAppService } from './whatsappService.js';
import { notificationService as defaultNotificationService } from './notificationService.js';
import { membershipService as defaultMembershipService } from './membershipService.js';
import { memberService as defaultMemberService } from './memberService.js';

function formatDateOnly(date = new Date()) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export const createReminderAutomationService = ({
  customDb = defaultDb,
  whatsappService = defaultWhatsAppService,
  notificationService = defaultNotificationService,
  membershipService = defaultMembershipService,
  memberService = defaultMemberService,
} = {}) => {
  const getReminderLogsCollection = () => {
    if (!customDb) throw new Error('[ReminderService] Firestore DB is not initialized');
    return customDb.collection('reminderLogs');
  };

  return {
    /**
     * Compute a unique, deterministic idempotency key for renewal reminders.
     * Prevents duplicate dispatch for the same membership in the same renewal cycle.
     */
    computeRenewalIdempotencyKey(membershipId, expiryDateStr) {
      return `renewal_${membershipId}_${expiryDateStr}`;
    },

    /**
     * Compute a unique, deterministic idempotency key for inactive member reminders.
     * Prevents duplicate dispatch within a 7-day re-engagement window.
     */
    computeInactiveIdempotencyKey(memberId, cycleDateStr) {
      return `inactive_${memberId}_${cycleDateStr}`;
    },

    /**
     * Run automated 3-day membership expiry reminder job.
     *
     * @param {Object} [options]
     * @param {number} [options.days=3] - Lookahead window in days
     * @param {string} [options.targetDate] - Optional specific date to evaluate
     * @param {boolean} [options.dryRun=false] - If true, identify candidates without sending
     * @param {string} [options.actorId='system_job']
     */
    async runRenewalReminderJob({
      days = 3,
      targetDate = null,
      dryRun = false,
      actorId = 'system_job',
    } = {}) {
      const logsCol = getReminderLogsCollection();
      const todayStr = targetDate || formatDateOnly();
      const lookaheadDays = Number(days) || 3;

      // 1. Fetch memberships expiring within the window
      const result = await membershipService.getExpiringMemberships({
        days: lookaheadDays,
        includeExpired: false,
      });

      const memberships = Array.isArray(result?.memberships) ? result.memberships : [];
      const executionSummary = {
        jobType: 'renewal_reminder',
        targetDate: todayStr,
        lookaheadDays,
        totalEligible: memberships.length,
        sentCount: 0,
        skippedDuplicates: 0,
        optedOutCount: 0,
        failedCount: 0,
        dryRun: Boolean(dryRun),
        dispatchedAt: new Date().toISOString(),
        reminders: [],
      };

      for (const m of memberships) {
        const membershipId = m.membershipId || m.id;
        const memberId = m.memberId || m.userId;
        const phone = m.member?.phone;
        const memberName = m.member?.displayName || 'Member';
        const planName = m.planName || 'Gym Membership';
        const expiryDateStr = formatDateOnly(m.endDate);
        const daysLeft = m.daysRemaining != null ? m.daysRemaining : lookaheadDays;

        const idempotencyKey = this.computeRenewalIdempotencyKey(membershipId, expiryDateStr);

        // 2. Idempotency Check: check if already sent for this membership cycle
        let alreadySent = false;
        try {
          const snap = await logsCol.where('idempotencyKey', '==', idempotencyKey).get();
          if (!snap.empty) {
            for (const doc of snap.docs) {
              const status = doc.data()?.status;
              if (['sent', 'opted_out', 'dispatched'].includes(status)) {
                alreadySent = true;
                break;
              }
            }
          }
        } catch {
          // Resilient check
        }

        if (alreadySent) {
          executionSummary.skippedDuplicates += 1;
          executionSummary.reminders.push({
            membershipId,
            memberId,
            status: 'skipped',
            reason: 'already_reminded_for_cycle',
            idempotencyKey,
          });
          continue;
        }

        if (dryRun) {
          executionSummary.sentCount += 1;
          executionSummary.reminders.push({
            membershipId,
            memberId,
            status: 'dry_run_candidate',
            phone,
            idempotencyKey,
          });
          continue;
        }

        // 3. Dispatch WhatsApp utility template via whatsappService
        let waResult = null;
        if (phone) {
          try {
            waResult = await whatsappService.sendTemplateMessage({
              to: phone,
              templateName: 'ironcore_renewal_reminder_3days',
              languageCode: 'en_US',
              variables: [
                memberName,
                planName,
                'IronPulse Fitness Club',
                String(daysLeft),
                expiryDateStr,
              ],
              memberId,
              triggerType: 'automated_job',
              actorId,
              metadata: {
                idempotencyKey,
                membershipId,
                jobType: 'renewal_reminder',
              },
            });
          } catch (err) {
            waResult = { success: false, status: 'failed', error: err.message };
          }
        } else {
          waResult = { success: false, status: 'no_phone', message: 'No phone registered' };
        }

        // 4. Dispatch in-app notification alongside WhatsApp
        if (memberId && notificationService?.createNotification) {
          try {
            await notificationService.createNotification(
              {
                recipientId: memberId,
                type: 'renewal_reminder',
                title: 'Membership Renewal Notice',
                body: `Your ${planName} membership expires in ${daysLeft} day(s) on ${expiryDateStr}. Renew now to maintain gym access.`,
                actionUrl: '/member/join',
                channel: 'in_app',
                metadata: { membershipId, daysLeft, expiryDate: expiryDateStr },
              },
              'system'
            );
          } catch {
            // In-app alert non-blocking
          }
        }

        // 5. Record execution in reminderLogs
        const finalStatus = waResult?.status === 'opted_out'
          ? 'opted_out'
          : waResult?.success
          ? 'sent'
          : 'failed';

        if (finalStatus === 'sent') {
          executionSummary.sentCount += 1;
        } else if (finalStatus === 'opted_out') {
          executionSummary.optedOutCount += 1;
        } else {
          executionSummary.failedCount += 1;
        }

        const logDocRef = logsCol.doc();
        const record = {
          id: logDocRef.id,
          idempotencyKey,
          jobType: 'renewal_reminder',
          membershipId,
          memberId,
          recipientPhone: phone ? whatsappService.formatPhoneE164(phone) : null,
          waMessageId: waResult?.waMessageId || null,
          status: finalStatus,
          actorId,
          scheduledDate: todayStr,
          expiryDate: expiryDateStr,
          daysLeft,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await logDocRef.set(record);

        executionSummary.reminders.push({
          membershipId,
          memberId,
          status: finalStatus,
          waMessageId: waResult?.waMessageId || null,
          idempotencyKey,
        });
      }

      return executionSummary;
    },

    /**
     * Run automated inactive member follow-up job (7+ days absent).
     *
     * @param {Object} [options]
     * @param {number} [options.daysInactive=7] - Minimum days absent (default 7)
     * @param {number} [options.minDaysBetweenReminders=7] - Minimum spacing between consecutive alerts
     * @param {boolean} [options.dryRun=false]
     * @param {string} [options.actorId='system_job']
     */
    async runInactiveMemberReminderJob({
      daysInactive = 7,
      minDaysBetweenReminders = 7,
      dryRun = false,
      actorId = 'system_job',
    } = {}) {
      const logsCol = getReminderLogsCollection();
      const todayStr = formatDateOnly();
      const thresholdDays = Number(daysInactive) || 7;
      const cooldownMs = (Number(minDaysBetweenReminders) || 7) * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();

      // 1. Fetch inactive members
      const result = await memberService.getInactiveMembers({
        daysInactive: thresholdDays,
        limit: 100,
      });

      const members = Array.isArray(result?.members) ? result.members : [];
      const executionSummary = {
        jobType: 'inactive_followup',
        targetDate: todayStr,
        daysInactiveThreshold: thresholdDays,
        totalEligible: members.length,
        sentCount: 0,
        skippedDuplicates: 0,
        optedOutCount: 0,
        failedCount: 0,
        dryRun: Boolean(dryRun),
        dispatchedAt: new Date().toISOString(),
        reminders: [],
      };

      for (const m of members) {
        const memberId = m.memberId || m.id;
        const phone = m.phone;
        const memberName = m.fullName || m.displayName || 'Member';
        const daysAbsent = m.daysAbsent || thresholdDays;

        // 2. Idempotency Check: check if already sent within cooldown window
        let recentlySent = false;
        try {
          const snap = await logsCol
            .where('memberId', '==', memberId)
            .where('jobType', '==', 'inactive_followup')
            .get();

          if (!snap.empty) {
            for (const doc of snap.docs) {
              const data = doc.data();
              const sentTime = new Date(data.createdAt || data.scheduledDate || 0).getTime();
              if (nowMs - sentTime < cooldownMs && ['sent', 'opted_out', 'dispatched'].includes(data.status)) {
                recentlySent = true;
                break;
              }
            }
          }
        } catch {
          // Resilient check
        }

        const idempotencyKey = this.computeInactiveIdempotencyKey(memberId, todayStr);

        if (recentlySent) {
          executionSummary.skippedDuplicates += 1;
          executionSummary.reminders.push({
            memberId,
            status: 'skipped',
            reason: 'recently_reminded_within_cooldown',
            idempotencyKey,
          });
          continue;
        }

        if (dryRun) {
          executionSummary.sentCount += 1;
          executionSummary.reminders.push({
            memberId,
            status: 'dry_run_candidate',
            phone,
            idempotencyKey,
          });
          continue;
        }

        // 3. Dispatch WhatsApp template
        let waResult = null;
        if (phone) {
          try {
            waResult = await whatsappService.sendTemplateMessage({
              to: phone,
              templateName: 'ironcore_inactive_member_checkin',
              languageCode: 'en_US',
              variables: [
                memberName,
                'IronPulse Fitness Club',
                String(daysAbsent),
              ],
              memberId,
              triggerType: 'automated_job',
              actorId,
              metadata: {
                idempotencyKey,
                daysAbsent,
                jobType: 'inactive_followup',
              },
            });
          } catch (err) {
            waResult = { success: false, status: 'failed', error: err.message };
          }
        } else {
          waResult = { success: false, status: 'no_phone', message: 'No phone registered' };
        }

        // 4. Dispatch in-app notification alongside WhatsApp
        if (memberId && notificationService?.createNotification) {
          try {
            await notificationService.createNotification(
              {
                recipientId: memberId,
                type: 'inactive_alert',
                title: 'We Miss You at the Gym!',
                body: `It has been ${daysAbsent} days since your last workout. Your training plan is waiting for you!`,
                actionUrl: '/member/workout',
                channel: 'in_app',
                metadata: { daysAbsent },
              },
              'system'
            );
          } catch {
            // Non-blocking in-app alert
          }
        }

        const finalStatus = waResult?.status === 'opted_out'
          ? 'opted_out'
          : waResult?.success
          ? 'sent'
          : 'failed';

        if (finalStatus === 'sent') {
          executionSummary.sentCount += 1;
        } else if (finalStatus === 'opted_out') {
          executionSummary.optedOutCount += 1;
        } else {
          executionSummary.failedCount += 1;
        }

        const logDocRef = logsCol.doc();
        const record = {
          id: logDocRef.id,
          idempotencyKey,
          jobType: 'inactive_followup',
          memberId,
          recipientPhone: phone ? whatsappService.formatPhoneE164(phone) : null,
          waMessageId: waResult?.waMessageId || null,
          status: finalStatus,
          actorId,
          scheduledDate: todayStr,
          daysAbsent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await logDocRef.set(record);

        executionSummary.reminders.push({
          memberId,
          status: finalStatus,
          waMessageId: waResult?.waMessageId || null,
          idempotencyKey,
        });
      }

      return executionSummary;
    },

    /**
     * Run all daily automated reminder jobs in sequence.
     */
    async runAllDailyReminderJobs({
      renewalDays = 3,
      inactiveDays = 7,
      dryRun = false,
      actorId = 'system_job',
    } = {}) {
      const renewalResult = await this.runRenewalReminderJob({
        days: renewalDays,
        dryRun,
        actorId,
      });

      const inactiveResult = await this.runInactiveMemberReminderJob({
        daysInactive: inactiveDays,
        dryRun,
        actorId,
      });

      return {
        timestamp: new Date().toISOString(),
        dryRun: Boolean(dryRun),
        summary: {
          totalEligible: renewalResult.totalEligible + inactiveResult.totalEligible,
          totalSent: renewalResult.sentCount + inactiveResult.sentCount,
          totalSkippedDuplicates: renewalResult.skippedDuplicates + inactiveResult.skippedDuplicates,
          totalOptedOut: renewalResult.optedOutCount + inactiveResult.optedOutCount,
          totalFailed: renewalResult.failedCount + inactiveResult.failedCount,
        },
        jobs: {
          renewalReminders: renewalResult,
          inactiveFollowups: inactiveResult,
        },
      };
    },

    /**
     * Retrieve reminder execution logs with optional filtering.
     */
    async getReminderLogs({
      jobType,
      memberId,
      status,
      limit = 50,
    } = {}) {
      const logsCol = getReminderLogsCollection();
      let query = logsCol;

      if (jobType) {
        query = query.where('jobType', '==', jobType);
      }
      if (memberId) {
        query = query.where('memberId', '==', memberId);
      }
      if (status) {
        query = query.where('status', '==', status);
      }

      const snap = await query.get();
      const logs = [];
      if (snap && !snap.empty) {
        for (const doc of snap.docs) {
          logs.push({ id: doc.id, ...doc.data() });
        }
      }

      logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return logs.slice(0, Number(limit) || 50);
    },
  };
};

export const reminderAutomationService = createReminderAutomationService();
