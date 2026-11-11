/**
 * scripts/seedFirebase.js — Seed test users and membership plans in live Firebase
 */

import fs from 'fs';
import path from 'path';

const API_KEY = 'AIzaSyDxOjjkt3ht8pFi-9Rf8Av79vdNrsKOJd8';
const PROJECT_ID = 'gym-management-system-18fee';

// Read Firebase CLI OAuth access token
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
let accessToken = null;
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  accessToken = config.tokens?.access_token;
}

if (!accessToken) {
  console.error('Error: Could not read Firebase CLI access token from', configPath);
  process.exit(1);
}

const usersToSeed = [
  {
    email: 'owner@gmail.com',
    password: '123456',
    displayName: 'Gym Owner',
    role: 'owner',
    phone: '+91 98000 00001',
  },
  {
    email: 'reception@gmail.com',
    password: '123456',
    displayName: 'Front Desk Reception',
    role: 'reception',
    phone: '+91 98000 00002',
  },
  {
    email: 'trainer@gmail.com',
    password: '123456',
    displayName: 'Fitness Trainer',
    role: 'trainer',
    phone: '+91 98000 00003',
  },
  {
    email: 'member1@gmail.com',
    password: '123456',
    displayName: 'Test Member 1',
    role: 'member',
    phone: '+91 98000 00011',
  },
  {
    email: 'member2@gmail.com',
    password: '123456',
    displayName: 'Test Member 2',
    role: 'member',
    phone: '+91 98000 00012',
  },
  {
    email: 'member3@gmail.com',
    password: '123456',
    displayName: 'Test Member 3',
    role: 'member',
    phone: '+91 98000 00013',
  },
  {
    email: 'member4@gmail.com',
    password: '123456',
    displayName: 'Test Member 4',
    role: 'member',
    phone: '+91 98000 00014',
  },
];

const plansToSeed = [
  {
    planId: 'plan-3-months',
    name: '3 Months Pro',
    durationMonths: 3,
    durationDays: 90,
    priceInPaise: 399900, // ₹3,999
    features: [
      'Full facility & gym floor access',
      'Cardio and strength training zone',
      'Locker room & shower access',
      'Group HIIT fitness sessions',
    ],
    description: 'Our most popular membership plan for total transformation.',
    badge: 'Popular',
    isActive: true,
    displayOrder: 1,
  },
  {
    planId: 'plan-6-months',
    name: '6 Months Transformation',
    durationMonths: 6,
    durationDays: 180,
    priceInPaise: 699900, // ₹6,999
    features: [
      'All 3-Month benefits included',
      'Diet & nutrition consultation',
      'Monthly body composition scan',
      'Sauna & recovery room access',
    ],
    description: 'Half-year commitment for guaranteed physique changes.',
    badge: 'Best Value',
    isActive: true,
    displayOrder: 2,
  },
  {
    planId: 'plan-9-months',
    name: '9 Months Commitment',
    durationMonths: 9,
    durationDays: 270,
    priceInPaise: 949900, // ₹9,499
    features: [
      'All 6-Month benefits included',
      'Dedicated trainer workout plan',
      '1 free guest pass per month',
      'Priority locker access',
    ],
    description: 'Extended commitment with personal workout plans.',
    badge: 'Dedicated',
    isActive: true,
    displayOrder: 3,
  },
  {
    planId: 'plan-12-months',
    name: '12 Months Elite',
    durationMonths: 12,
    durationDays: 365,
    priceInPaise: 1199900, // ₹11,999
    features: [
      'Full 24/7 all-zone facility access',
      'Unlimited group fitness & functional classes',
      'Quarterly personal training review',
      'Complimentary gym kit & merch',
      'Unlimited guest passes',
    ],
    description: 'Ultimate year-round fitness lifestyle with maximum privileges.',
    badge: 'Elite',
    isActive: true,
    displayOrder: 4,
  },
];

async function getOrCreateAuthUser(user) {
  // 1. Try signUp
  const signUpRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        returnSecureToken: true,
      }),
    }
  );

  const signUpData = await signUpRes.json();
  if (signUpData.localId) {
    return { uid: signUpData.localId, idToken: signUpData.idToken };
  }

  // 2. If exists, signIn
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        returnSecureToken: true,
      }),
    }
  );

  const signInData = await signInRes.json();
  if (signInData.localId) {
    return { uid: signInData.localId, idToken: signInData.idToken };
  }

  throw new Error(`Failed to authenticate ${user.email}: ${JSON.stringify(signInData)}`);
}

async function writeFirestoreDoc(collection, docId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

  const firestoreFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      firestoreFields[key] = {
        arrayValue: {
          values: value.map((item) => ({ stringValue: String(item) })),
        },
      };
    }
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to write ${collection}/${docId}: ${errorText}`);
  }

  return res.json();
}

async function runSeed() {
  console.log('--- Starting Firebase Seed ---');
  console.log(`Target Firebase Project: ${PROJECT_ID}\n`);

  // 1. Seed Users in Auth & Firestore
  console.log('1. Seeding Users (Auth + Firestore users collection):');
  for (const u of usersToSeed) {
    process.stdout.write(`   Creating/Verifying ${u.email} (${u.role})... `);
    const authRecord = await getOrCreateAuthUser(u);

    // Update display name in Firebase Auth
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: authRecord.idToken,
          displayName: u.displayName,
          returnSecureToken: true,
        }),
      }
    );

    // Write to Firestore users collection
    await writeFirestoreDoc('users', authRecord.uid, {
      uid: authRecord.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      approvalStatus: 'active',
      phone: u.phone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`[OK] UID: ${authRecord.uid}`);
  }

  // 2. Seed Membership Plans in Firestore
  console.log('\n2. Seeding Membership Plans (3, 6, 9, 12 Months):');
  for (const plan of plansToSeed) {
    process.stdout.write(`   Writing plan: ${plan.name} (₹${plan.priceInPaise / 100})... `);
    await writeFirestoreDoc('membershipPlans', plan.planId, {
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`[OK] Doc: ${plan.planId}`);
  }

  console.log('\n--- Seeding Complete Successfully! ---');
}

runSeed().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});

