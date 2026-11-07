/**
 * tests/firestore-rules.test.js — Firestore Security Rules v1 Unit Tests
 *
 * Tests least-privilege security rules for:
 * - users
 * - membershipPlans
 * - memberships
 * - attendance
 * - payments
 * - notifications
 *
 * Uses @firebase/rules-unit-testing against the Firebase Emulator.
 * When emulator is running (FIRESTORE_EMULATOR_HOST), executes live rule evaluations.
 * Also verifies rules integrity and syntax statically.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const RULES_PATH = path.resolve(process.cwd(), '../firestore.rules');

describe('Firestore Security Rules v1 Specification & Unit Tests', () => {
  let testEnv;
  let emulatorAvailable = false;
  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');

  // Helper to check if local Firestore emulator is listening
  const checkPort = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.connect(port, host);
    });
  };

  before(async () => {
    const host = process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.split(':')[0] : '127.0.0.1';
    const port = process.env.FIRESTORE_EMULATOR_HOST ? Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]) : 8080;

    emulatorAvailable = await checkPort(host, port);

    if (emulatorAvailable) {
      testEnv = await initializeTestEnvironment({
        projectId: 'gym-management-test',
        firestore: {
          rules: rulesContent,
          host,
          port,
        },
      });
    }
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // Static Rule Definition & Least-Privilege Verification
  // ---------------------------------------------------------------------------

  test('firestore.rules file exists and defines cloud.firestore rules_version 2', () => {
    assert.ok(fs.existsSync(RULES_PATH), 'firestore.rules must exist');
    assert.ok(rulesContent.includes("rules_version = '2'"), 'Must specify rules_version 2');
    assert.ok(rulesContent.includes('service cloud.firestore'), 'Must target cloud.firestore');
  });

  test('rules define least-privilege security for all required collections', () => {
    const requiredCollections = [
      'users',
      'membershipPlans',
      'memberships',
      'attendance',
      'payments',
      'notifications',
    ];

    for (const col of requiredCollections) {
      assert.ok(
        rulesContent.includes(`match /${col}/`),
        `firestore.rules must include explicit match rules for '${col}'`
      );
    }
  });

  test('rules enforce default-deny catch-all', () => {
    assert.ok(
      rulesContent.includes('match /{document=**}') && rulesContent.includes('allow read, write: if false'),
      'Must contain a default deny-all fallback rule'
    );
  });

  test('direct client writes are denied for sensitive collections', () => {
    const serverOnlyCollections = ['users', 'membershipPlans', 'memberships', 'attendance', 'payments'];
    for (const col of serverOnlyCollections) {
      const matchRegex = new RegExp(`match\\s+/${col}/\\{[^}]+\\}\\s*\\{([\\s\\S]*?)\\}`, 'm');
      const match = rulesContent.match(matchRegex);
      assert.ok(match, `Could not find rule block for ${col}`);
      assert.ok(
        match[1].includes('allow write: if false;'),
        `${col} must have 'allow write: if false' for direct client writes`
      );
    }
  });

  test('membershipPlans allows public read access', () => {
    const matchRegex = /match\s+\/membershipPlans\/\{[^}]+\}\s*\{([\s\S]*?)\}/m;
    const match = rulesContent.match(matchRegex);
    assert.ok(match, 'Could not find rule block for membershipPlans');
    assert.ok(
      match[1].includes('allow read: if true;'),
      'membershipPlans must permit public read for prospective members'
    );
  });

  // ---------------------------------------------------------------------------
  // Emulator Integration Tests (executes when emulator is running)
  // ---------------------------------------------------------------------------

  test('Emulator: public can read membershipPlans, but direct writes are denied', async (t) => {
    if (!emulatorAvailable) {
      t.skip('Firestore emulator not running on port 8080. Start emulator to run live rule execution.');
      return;
    }

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const planRef = unauthDb.collection('membershipPlans').doc('1-month');

    // Public read is permitted
    await assertSucceeds(planRef.get());

    // Direct write is denied
    await assertFails(planRef.set({ name: 'Hacked Plan', price: 0 }));
  });

  test('Emulator: members can read their own profile, but cannot read other users or write directly', async (t) => {
    if (!emulatorAvailable) {
      t.skip('Firestore emulator not running on port 8080');
      return;
    }

    const memberContext = testEnv.authenticatedContext('member_123', { email: 'member@test.com' });
    const memberDb = memberContext.firestore();

    // Setup user doc via admin context
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().collection('users').doc('member_123').set({
        role: 'member',
        name: 'Member Name',
      });
      await adminContext.firestore().collection('users').doc('other_456').set({
        role: 'member',
        name: 'Other Member',
      });
    });

    // Can read own profile
    await assertSucceeds(memberDb.collection('users').doc('member_123').get());

    // Cannot read other member profile
    await assertFails(memberDb.collection('users').doc('other_456').get());

    // Cannot write directly to profile
    await assertFails(memberDb.collection('users').doc('member_123').update({ role: 'owner' }));
  });

  test('Emulator: members can read own attendance, but cannot forge check-ins directly', async (t) => {
    if (!emulatorAvailable) {
      t.skip('Firestore emulator not running on port 8080');
      return;
    }

    const memberContext = testEnv.authenticatedContext('member_123');
    const memberDb = memberContext.firestore();

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().collection('attendance').doc('att_1').set({
        userId: 'member_123',
        session: 'morning',
      });
      await adminContext.firestore().collection('attendance').doc('att_2').set({
        userId: 'other_456',
        session: 'evening',
      });
    });

    // Can read own attendance
    await assertSucceeds(memberDb.collection('attendance').doc('att_1').get());

    // Cannot read another user's attendance
    await assertFails(memberDb.collection('attendance').doc('att_2').get());

    // Cannot forge check-in
    await assertFails(memberDb.collection('attendance').doc('att_new').set({
      userId: 'member_123',
      session: 'morning',
    }));
  });

  test('Emulator: notifications allows user to update isRead, but not modify content or delete', async (t) => {
    if (!emulatorAvailable) {
      t.skip('Firestore emulator not running on port 8080');
      return;
    }

    const memberContext = testEnv.authenticatedContext('member_123');
    const memberDb = memberContext.firestore();

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await adminContext.firestore().collection('notifications').doc('notif_1').set({
        userId: 'member_123',
        title: 'Fee Reminder',
        isRead: false,
      });
    });

    // Permitted to mark as read
    await assertSucceeds(memberDb.collection('notifications').doc('notif_1').update({
      isRead: true,
      readAt: new Date().toISOString(),
    }));

    // Denied to alter message title
    await assertFails(memberDb.collection('notifications').doc('notif_1').update({
      title: 'Tampered title',
    }));

    // Denied to delete notification
    await assertFails(memberDb.collection('notifications').doc('notif_1').delete());
  });
});
