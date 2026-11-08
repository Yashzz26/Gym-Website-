# Local Development Setup

> This guide covers the Firebase Emulator Suite, seed data for all four roles,
> and all required environment variables (placeholders only — never commit real credentials).

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| npm | 10 | bundled with Node 20 |
| Java JDK | 11+ | Required by Firebase Emulator Suite |
| Firebase CLI | 13+ | `npm install -g firebase-tools` |

---

## 1. Clone & Install Dependencies

```bash
git clone https://github.com/Yashzz26/Gym-Website-.git
cd "Gym Website"

# Install root dependencies (if any)
npm install

# Install server dependencies
npm --prefix server install

# Install client dependencies
npm --prefix client install
```

---

## 2. Environment Variables

### Server (`server/.env`)

Copy from the provided template and fill in real values:

```bash
cp server/.env.example server/.env
```

**Required variables** (never commit `server/.env`):

```
# Firebase Admin SDK — choose ONE of the two options below
FIREBASE_SERVICE_ACCOUNT_JSON=<single-line JSON string of service account>
# OR
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json

# Firebase project
FIREBASE_PROJECT_ID=your-project-id

# Server
NODE_ENV=development
PORT=5000

# CORS — comma-separated allowed frontend origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Firebase Emulator (for local dev without real Firebase)
# Uncomment when running emulators:
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

# Razorpay (Day 13+)
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder_secret
RAZORPAY_WEBHOOK_SECRET=placeholder_webhook_secret

# WhatsApp Business API (Day 20+)
WHATSAPP_ACCESS_TOKEN=placeholder_token
WHATSAPP_APP_SECRET=placeholder_app_secret
WHATSAPP_PHONE_NUMBER_ID=placeholder_id
```

### Client (`client/.env`)

```bash
cp client/.env.example client/.env
```

**Required variables** (safe to commit `.env.example`; these are public Firebase config keys):

```
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Backend API URL (matches PORT above)
VITE_API_URL=http://localhost:5000

# Firebase Auth Emulator (uncomment for local dev)
# VITE_FIREBASE_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
```

---

## 3. Firebase Emulator Suite

The Firebase Emulator Suite lets you develop and test locally without touching production data.

### Start emulators

```bash
# From the repository root
firebase emulators:start --only auth,firestore
```

Ports (from `firebase.json`):

| Service | Port |
|---------|------|
| Auth Emulator | 9099 |
| Firestore Emulator | 8080 |
| Emulator UI | 4000 |

Open the Emulator UI at [http://127.0.0.1:4000](http://127.0.0.1:4000) to browse collections and auth users visually.

### Connect server to emulators

Uncomment in `server/.env`:

```
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

### Connect client to emulators

Uncomment in `client/.env`:

```
VITE_FIREBASE_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
```

---

## 4. Seed Data — One Test User Per Role

After starting the Firebase Auth and Firestore emulators, seed the following test users.
Use the Emulator UI or run the seed script below.

> ⚠️ **Never use real credentials in seed data.** These are local emulator accounts only.

### Seed users table

| Role | Email | Password | `approvalStatus` | UID (emulator assigns one) |
|------|-------|----------|-----------------|---------------------------|
| owner | `owner@gym.local` | `Owner@1234` | `active` | auto-assigned |
| reception | `reception@gym.local` | `Reception@1234` | `active` | auto-assigned |
| trainer | `trainer@gym.local` | `Trainer@1234` | `active` | auto-assigned |
| member | `member@gym.local` | `Member@1234` | `active` | auto-assigned |

### Seed script

After users are created in Firebase Auth Emulator, create matching Firestore documents:

```javascript
// scripts/seed.js — run with: node scripts/seed.js (emulators must be running)
// Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 before running

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const app = initializeApp({ projectId: 'gym-management-system' });
const db = getFirestore(app);

const users = [
  {
    uid: 'owner-seed-uid',
    email: 'owner@gym.local',
    displayName: 'Gym Owner',
    role: 'owner',
    approvalStatus: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    uid: 'reception-seed-uid',
    email: 'reception@gym.local',
    displayName: 'Reception Staff',
    role: 'reception',
    approvalStatus: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    uid: 'trainer-seed-uid',
    email: 'trainer@gym.local',
    displayName: 'Head Trainer',
    role: 'trainer',
    approvalStatus: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    uid: 'member-seed-uid',
    email: 'member@gym.local',
    displayName: 'Test Member',
    role: 'member',
    approvalStatus: 'active',
    createdAt: new Date().toISOString(),
  },
];

for (const user of users) {
  const { uid, ...data } = user;
  await db.collection('users').doc(uid).set(data);
  console.log(`Seeded user: ${data.role} (${data.email})`);
}

console.log('Seed complete.');
```

> **Note:** Match the UIDs in `users` collection documents to the UIDs created by Firebase Auth Emulator. After creating auth users in the Emulator UI, copy their UIDs and update the seed script above.

---

## 5. Running the Application Locally

### Start the backend server

```bash
cd server
npm run dev
# Server starts on http://localhost:5000
```

### Start the frontend dev server

```bash
cd client
npm run dev
# Client starts on http://localhost:5173
```

### Run all tests

```bash
# From repository root
npm test
# Runs: vitest (client) + node --test (server)
```

---

## 6. Testing Firestore Security Rules

Security rules require the Firebase Emulator to be running. Start it and then run:

```bash
firebase emulators:start --only firestore
npm --prefix server test
# Emulator-dependent tests run; static tests always run
```

---

## 7. Quick Reference

| Task | Command |
|------|---------|
| Start emulators | `firebase emulators:start --only auth,firestore` |
| Start dev server | `npm --prefix server run dev` |
| Start client | `npm --prefix client run dev` |
| Run all tests | `npm test` |
| Run server tests only | `npm --prefix server test` |
| Run client tests only | `npm --prefix client test` |
| Lint | `npm run lint` |
