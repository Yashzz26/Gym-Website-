/**
 * config/firebase.js — Firebase Admin SDK Initialization
 *
 * Initializes Firebase Admin using environment configuration:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (direct JSON string)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH (file path)
 * 3. Emulator environment variables (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST)
 * 4. Fallback in-memory Firestore for development mode when service account is not yet provided.
 *
 * Keeps service-account credentials strictly out of source control.
 */

import fs from 'node:fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Creates an in-memory Firestore mock for development when no service account is configured.
 * Prevents google-auth-library from crashing Node.js with missing ADC credentials.
 */
function createDevMemoryFirestore() {
  const stores = new Map();

  const getStore = (name) => {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
    return stores.get(name);
  };

  // Seed default membership plans
  const plansStore = getStore('membershipPlans');
  const defaultPlans = [
    {
      planId: 'plan-1-month',
      name: '1 Month Starter',
      durationMonths: 1,
      durationDays: 30,
      priceInPaise: 149900,
      description: 'Ideal for beginners starting their fitness routine.',
      features: ['Access to weight and cardio zones', 'Locker room access'],
      isActive: true,
      displayOrder: 1,
      badge: 'Starter',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      planId: 'plan-3-months',
      name: '3 Months Pro',
      durationMonths: 3,
      durationDays: 90,
      priceInPaise: 399900,
      description: 'Our most popular plan for consistent body transformation.',
      features: ['Full facility access', 'All group classes', 'Trainer check-ins'],
      isActive: true,
      displayOrder: 2,
      badge: 'Popular',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      planId: 'plan-6-months',
      name: '6 Months Power',
      durationMonths: 6,
      durationDays: 180,
      priceInPaise: 699900,
      description: 'Half-year commitment for maximum strength & endurance gains.',
      features: ['24/7 gym access', 'Unlimited group classes', 'Free diet consultation'],
      isActive: true,
      displayOrder: 3,
      badge: 'Power',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      planId: 'plan-12-months',
      name: '12 Months Elite',
      durationMonths: 12,
      durationDays: 365,
      priceInPaise: 1199900,
      description: 'Ultimate year-round commitment with maximum savings and perks.',
      features: ['24/7 unlimited access', 'All classes included', 'Monthly body composition'],
      isActive: true,
      displayOrder: 4,
      badge: 'Best Value',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  defaultPlans.forEach((p) => plansStore.set(p.planId, { ...p }));

  // Seed default test users (Owner, Reception, Trainer, Members)
  const usersStore = getStore('users');
  const defaultUsers = [
    { uid: 'owner-test-uid', email: 'owner@gmail.com', displayName: 'Gym Owner', role: 'owner', approvalStatus: 'active' },
    { uid: 'reception-test-uid', email: 'reception@gmail.com', displayName: 'Receptionist', role: 'reception', approvalStatus: 'active' },
    { uid: 'trainer-test-uid', email: 'trainer@gmail.com', displayName: 'Fitness Trainer', role: 'trainer', approvalStatus: 'active' },
    { uid: 'member-1-uid', email: 'member1@gmail.com', displayName: 'Member 1', role: 'member', approvalStatus: 'active' },
    { uid: 'member-2-uid', email: 'member2@gmail.com', displayName: 'Member 2', role: 'member', approvalStatus: 'active' },
    { uid: 'member-3-uid', email: 'member3@gmail.com', displayName: 'Member 3', role: 'member', approvalStatus: 'active' },
    { uid: 'member-4-uid', email: 'member4@gmail.com', displayName: 'Member 4', role: 'member', approvalStatus: 'active' },
  ];
  defaultUsers.forEach((u) => usersStore.set(u.uid, { ...u, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));

  let idCounter = 1;

  return {
    isMock: true,
    collection(name) {
      const store = getStore(name);
      return {
        doc(id) {
          return {
            id,
            async get() {
              const exists = store.has(id);
              return {
                id,
                exists,
                data: () => (exists ? { ...store.get(id) } : undefined),
              };
            },
            async set(data, options = {}) {
              const current = store.get(id) || {};
              store.set(id, options.merge ? { ...current, ...data } : { ...data });
            },
            async update(patch) {
              const current = store.get(id) || {};
              store.set(id, { ...current, ...patch });
            },
            async delete() {
              store.delete(id);
            },
          };
        },
        async add(data) {
          const id = data.id || data.planId || data.paymentId || `${name}-${Date.now()}-${idCounter++}`;
          store.set(id, { id, ...data });
          return { id };
        },
        where(field, op, val) {
          const queryConditions = [[field, op, val]];
          let orderField = null;
          let orderDirection = 'asc';
          let limitCount = null;

          const chain = {
            where(f, o, v) {
              queryConditions.push([f, o, v]);
              return chain;
            },
            orderBy(f, dir = 'asc') {
              orderField = f;
              orderDirection = dir;
              return chain;
            },
            limit(n) {
              limitCount = n;
              return chain;
            },
            async get() {
              const docs = [];
              for (const [id, item] of store.entries()) {
                const matches = queryConditions.every(([cf, co, cv]) => {
                  if (co === '==') return item[cf] === cv;
                  if (co === '!=') return item[cf] !== cv;
                  if (co === '>') return item[cf] > cv;
                  if (co === '>=') return item[cf] >= cv;
                  if (co === '<') return item[cf] < cv;
                  if (co === '<=') return item[cf] <= cv;
                  return false;
                });
                if (matches) {
                  docs.push({ id, data: () => ({ ...item }) });
                }
              }

              if (orderField) {
                docs.sort((a, b) => {
                  const valA = a.data()[orderField];
                  const valB = b.data()[orderField];
                  if (valA < valB) return orderDirection === 'asc' ? -1 : 1;
                  if (valA > valB) return orderDirection === 'asc' ? 1 : -1;
                  return 0;
                });
              }

              const sliced = limitCount ? docs.slice(0, limitCount) : docs;
              return {
                empty: sliced.length === 0,
                docs: sliced,
                forEach(cb) {
                  sliced.forEach(cb);
                },
              };
            },
          };
          return chain;
        },
        orderBy(f, dir = 'asc') {
          let limitCount = null;
          const chain = {
            limit(n) {
              limitCount = n;
              return chain;
            },
            async get() {
              const docs = [];
              for (const [id, item] of store.entries()) {
                docs.push({ id, data: () => ({ ...item }) });
              }
              docs.sort((a, b) => {
                const valA = a.data()[f];
                const valB = b.data()[f];
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
              });
              const sliced = limitCount ? docs.slice(0, limitCount) : docs;
              return {
                empty: sliced.length === 0,
                docs: sliced,
                forEach(cb) {
                  sliced.forEach(cb);
                },
              };
            },
          };
          return chain;
        },
        limit(n) {
          const chain = {
            async get() {
              const docs = [];
              for (const [id, item] of store.entries()) {
                docs.push({ id, data: () => ({ ...item }) });
              }
              const sliced = docs.slice(0, n);
              return {
                empty: sliced.length === 0,
                docs: sliced,
                forEach(cb) {
                  sliced.forEach(cb);
                },
              };
            },
          };
          return chain;
        },
        async get() {
          const docs = [];
          for (const [id, item] of store.entries()) {
            docs.push({ id, data: () => ({ ...item }) });
          }
          return {
            empty: docs.length === 0,
            docs,
            forEach(cb) {
              docs.forEach(cb);
            },
          };
        },
      };
    },
    async runTransaction(updateFn) {
      const transaction = {
        async get(docRef) {
          return docRef.get();
        },
        update(docRef, patch) {
          return docRef.update(patch);
        },
        set(docRef, data, options) {
          return docRef.set(data, options);
        },
      };
      return updateFn(transaction);
    },
  };
}

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    const existingApp = getApps()[0];
    return {
      adminApp: existingApp,
      auth: getAuth(existingApp),
      db: getFirestore(existingApp),
    };
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || 'gym-management-system-18fee';
  let appConfig = { projectId };
  let hasServiceAccount = false;

  // 1. Check for single-line JSON string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      appConfig = {
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      };
      hasServiceAccount = true;
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }
  // 2. Check for service account file path
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        appConfig = {
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        };
        hasServiceAccount = true;
      } else {
        console.warn(`[FirebaseAdmin] Service account file not found at: ${filePath}`);
      }
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to load FIREBASE_SERVICE_ACCOUNT_PATH:', err.message);
    }
  }
  // 3. Emulator mode
  else if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    hasServiceAccount = true;
  }

  let adminApp = null;
  let auth = null;
  let db = null;

  try {
    adminApp = initializeApp(appConfig);
    auth = getAuth(adminApp);
  } catch (err) {
    console.warn('[FirebaseAdmin] Auth initialization warning:', err.message);
  }

  if (hasServiceAccount) {
    try {
      db = getFirestore(adminApp);
    } catch (err) {
      console.warn('[FirebaseAdmin] Live Firestore connection failed, using dev memory store:', err.message);
      db = createDevMemoryFirestore();
    }
  } else {
    console.log('[FirebaseAdmin] Running in resilient local dev mode with in-memory Firestore.');
    db = createDevMemoryFirestore();
  }

  return { adminApp, auth, db };
}

export const { adminApp, auth, db } = initFirebaseAdmin();
export default adminApp;
