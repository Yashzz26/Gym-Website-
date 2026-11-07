# Security Rules

> Status: **Implemented (v1)** — Configured in `firestore.rules` and tested via emulator / unit tests.

## Firestore Security Rules Philosophy

- **Least privilege**: Every collection defaults to deny-all; access explicitly granted per role.
- **Server-side writes for sensitive data**: Users, payments, memberships, attendance, workout/diet plans, gym settings, and audit logs are written exclusively by the Express backend (Firebase Admin SDK bypasses rules). Direct client writes to these collections are denied.
- **Members can only read their own data**: Profile, membership, payment receipts, attendance history, workout plans, and diet plans.
- **Client field-level updates**: The `notifications` collection permits a recipient user to update only `isRead` and `readAt` via atomic field diff checks.
- **Trainers can read their assigned members' data**: Workout plans, diet plans, and attendance.
- **Reception can read member directories and financial receipts**: To record desk walk-ins and verify active access.
- **Owner has broad read oversight**: Over all collections, including audit logs and administrative settings.

## Active Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================================
    // Helper Functions
    // ============================================================

    function isSignedIn() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function getRole() {
      return isSignedIn() ? getUserData().role : null;
    }

    function isOwner() {
      return isSignedIn() && getRole() == 'owner';
    }

    function isReception() {
      return isSignedIn() && (getRole() == 'reception' || isOwner());
    }

    function isTrainer() {
      return isSignedIn() && (getRole() == 'trainer' || isOwner());
    }

    function isMember() {
      return isSignedIn() && getRole() == 'member';
    }

    function isOwnDocument(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // ============================================================
    // Collection Rules
    // ============================================================

    // 1. Users Collection
    // Staff can read member profiles; members can read their own profile.
    // All writes are strictly restricted to the server (Firebase Admin SDK).
    match /users/{uid} {
      allow read: if isOwner() || isReception() || isTrainer() || isOwnDocument(uid);
      allow write: if false;
    }

    // 2. Membership Plans Collection
    // Publicly readable so prospective and active members can browse plans.
    // Modifiable only by the owner via the Express server.
    match /membershipPlans/{planId} {
      allow read: if true;
      allow write: if false;
    }

    // 3. Memberships Collection
    // Members can read their own memberships; Owner and Reception have full read.
    // Created, renewed, and status-managed strictly server-side upon verified payment.
    match /memberships/{membershipId} {
      allow read: if isOwner() || isReception() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if false;
    }

    // 4. Attendance Collection
    // Owner, Reception, and Trainers can read; members can read their own history.
    // Check-in entries are atomic server writes validated against rotating QR nonces.
    match /attendance/{attendanceId} {
      allow read: if isOwner() || isReception() || isTrainer() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if false;
    }

    // 5. Payments Collection
    // Members can read their own payment receipts; Owner and Reception have read access.
    // Written only by the backend upon Razorpay webhook verification or reception fees entry.
    match /payments/{paymentId} {
      allow read: if isOwner() || isReception() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if false;
    }

    // 6. Notifications Collection
    // Users can read their own notifications; Owner has oversight read.
    // Users may only update the 'isRead' and 'readAt' fields of their own notifications.
    // Creation and deletion are server-side only.
    match /notifications/{notificationId} {
      allow read: if isOwner() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow update: if isSignedIn()
        && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRead', 'readAt']);
      allow create, delete: if false;
    }

    // 7. Workout Plans Collection
    // Assigned members and trainers can view workout regimens; server writes.
    match /workoutPlans/{planId} {
      allow read: if isOwner() || isTrainer() || (isSignedIn() && resource.data.memberId == request.auth.uid);
      allow write: if false;
    }

    // 8. Diet Plans Collection
    // Assigned members and trainers can view meal plans; server writes.
    match /dietPlans/{planId} {
      allow read: if isOwner() || isTrainer() || (isSignedIn() && resource.data.memberId == request.auth.uid);
      allow write: if false;
    }

    // 9. Gym Settings Collection
    // Authenticated users can read operating hours and session configurations.
    // Edited only by the owner via the backend API.
    match /gymSettings/{settingId} {
      allow read: if isSignedIn();
      allow write: if false;
    }

    // 10. Audit Logs Collection
    // Accessible only by the gym owner; logged strictly server-side.
    match /auditLogs/{logId} {
      allow read: if isOwner();
      allow write: if false;
    }

    // ============================================================
    // Default Deny-All Rule
    // ============================================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Testing Firestore Rules

Firestore rules are covered by tests in `server/tests/firestore-rules.test.js`:
- Static structural verification validating default-deny, server-write enforcement, notifications read status diff restriction, and public plan visibility.
- Integration tests via `@firebase/rules-unit-testing` when the Firebase Local Emulator Suite is running (`firebase emulators:start --only firestore`).

To run the test suite:
```bash
cd server
npm test
```

## Express Middleware Security

- `verifyFirebaseToken` (`server/middleware/auth.js`) — verifies ID token on every protected route
- `requireRole(...roles)` — checks role from Firestore against allowed roles
- `requireActiveStatus` — blocks pending/suspended users
- Rate limiting on all routes (general) and stricter limits on auth/payment endpoints
- CORS restricted to approved frontend origins only
- Helmet.js for HTTP security headers
- Raw body preserved for Razorpay and WhatsApp webhook signature verification

## Secrets Management

| Secret | Location |
|--------|----------|
| Firebase Admin Service Account | `server/.env` → `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Razorpay Key ID | `server/.env` → `RAZORPAY_KEY_ID` |
| Razorpay Key Secret | `server/.env` → `RAZORPAY_KEY_SECRET` |
| Razorpay Webhook Secret | `server/.env` → `RAZORPAY_WEBHOOK_SECRET` |
| WhatsApp Access Token | `server/.env` → `WHATSAPP_ACCESS_TOKEN` |
| WhatsApp App Secret | `server/.env` → `WHATSAPP_APP_SECRET` |
| Firebase Client Config | `client/.env` → `VITE_FIREBASE_*` (public keys, safe) |

> ⚠️ Never commit `.env` files. Only `.env.example` with placeholder values is committed.
