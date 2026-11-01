# Security Rules

> Status: **Draft** — Will be finalized during Phase 3 (Auth) and reviewed before production.

## Firestore Security Rules Philosophy

- **Least privilege**: Every collection defaults to deny-all; access explicitly granted per role.
- **Server-side writes for sensitive data**: Payments, attendance, and audit logs are written only by the Express backend (Firebase Admin SDK bypasses rules). Direct client writes to these collections are denied.
- **Members can only read/write their own data**: Profile, membership, workout, diet.
- **Trainers can read their assigned members' data** and write workout/diet plans.
- **Reception can read all members** and record fees.
- **Owner has read access to all collections**.

## Rule Stubs (to be implemented in Phase 3)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    function getRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isOwner() { return isSignedIn() && getRole() == 'owner'; }
    function isReception() { return isSignedIn() && getRole() == 'reception'; }
    function isTrainer() { return isSignedIn() && getRole() == 'trainer'; }
    function isMember() { return isSignedIn() && getRole() == 'member'; }
    function isOwnDocument(uid) { return isSignedIn() && request.auth.uid == uid; }

    // Users collection
    match /users/{uid} {
      allow read: if isOwner() || isReception() || isTrainer() || isOwnDocument(uid);
      allow write: if false; // Server-side only (Admin SDK)
    }

    // Membership Plans — public read
    match /membershipPlans/{planId} {
      allow read: if true;
      allow write: if false; // Owner via server only
    }

    // Memberships — members read own; server writes
    match /memberships/{id} {
      allow read: if isOwner() || isReception() || isOwnDocument(resource.data.userId);
      allow write: if false; // Server-side only
    }

    // Payments — server writes only
    match /payments/{id} {
      allow read: if isOwner() || isReception() || isOwnDocument(resource.data.userId);
      allow write: if false; // Server-side only
    }

    // Attendance — server writes only
    match /attendance/{id} {
      allow read: if isOwner() || isReception() || isTrainer() || isOwnDocument(resource.data.userId);
      allow write: if false; // Server-side only
    }

    // Workout Plans — trainer creates; member reads own
    match /workoutPlans/{id} {
      allow read: if isOwner() || isTrainer() || isOwnDocument(resource.data.memberId);
      allow write: if false; // Server-side only
    }

    // Diet Plans — trainer creates; member reads own
    match /dietPlans/{id} {
      allow read: if isOwner() || isTrainer() || isOwnDocument(resource.data.memberId);
      allow write: if false; // Server-side only
    }

    // Gym Settings — all authenticated read; owner writes via server
    match /gymSettings/{id} {
      allow read: if isSignedIn();
      allow write: if false;
    }

    // Audit Logs — owner reads; server writes
    match /auditLogs/{id} {
      allow read: if isOwner();
      allow write: if false;
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Express Middleware Security

- `verifyFirebaseToken` — verifies ID token on every protected route
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
