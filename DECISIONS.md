# Architecture Decision Records (ADRs)

This document records the architectural and design decisions made for the **Gym Management System** throughout its 30-day development cycle. Each record outlines context, alternatives considered, the chosen solution, and the rationale.

---

## ADR 001: Monetary Values Stored in Integer Paise

### Status
Accepted

### Context
Financial transactions in the Gym Management System involve membership plan fees, renewals, online payments via Razorpay, cash receipts, and coupons. In JavaScript, standard IEEE 754 floating-point arithmetic (`0.1 + 0.2 !== 0.3`) causes precision errors and rounding drift over time when calculating totals, taxes, and splits.

### Decision
All monetary values (prices, fees, receipts, discounts, payments) are stored as integer amounts representing **paise** (1 INR = 100 paise) across the Firestore database, Express backend, and Razorpay API payloads.
- ₹1,500/month plan is represented as `150000`.
- Display formatting to INR (e.g. `₹1,500.00`) is performed strictly at the UI layer using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

### Consequences
- Prevents rounding bugs and decimal discrepancies.
- Directly aligns with Razorpay's API requirement where `amount` must be in paise.
- Simplifies aggregation queries for daily revenue reporting without float conversions.

---

## ADR 002: Rotating QR Token Nonce Policy for Attendance

### Status
Accepted

### Context
Member attendance must prevent fraud and proxies (e.g. members taking a photo or screenshot of the gym's entrance QR code to check in remotely or check in multiple friends).

### Decision
1. The gym entrance display screen fetches a temporary rotating QR token from `GET /api/qr/current`.
2. QR tokens expire automatically every **5 to 10 minutes** (configurable via `gymSettings.qrTokenExpirySeconds`).
3. Tokens are generated server-side with cryptographic entropy (`crypto.randomUUID()`).
4. When a member scans the QR code via `html5-qrcode`, `POST /api/attendance/check-in` validates the token server-side:
   - Verifies the token has not expired (`expiresAt > now`).
   - Verifies the member has an active, valid membership.
   - Enforces a single check-in per member per calendar day (duplicates return `409 Conflict`).
   - Atomically records the attendance doc and invalidates single-use nonces in a Firestore transaction.

### Consequences
- QR screenshots become useless within minutes.
- Guarantees physical presence at the gym door.
- Fully automated without requiring reception staff to manually mark attendance for every entry.

---

## ADR 003: Server-Authoritative Roles & Zero-Trust Client

### Status
Accepted

### Context
The application supports four user roles: **Owner**, **Reception**, **Trainer**, and **Member**. Allowing the client to assert its own role or approval status creates severe privilege escalation vulnerabilities.

### Decision
1. Firebase Auth is used exclusively for identity verification (email/password authentication).
2. The client provides a signed Firebase ID token in the `Authorization: Bearer <token>` header on every API request.
3. The Express backend verifies the token using the Firebase Admin SDK.
4. User roles (`owner`, `reception`, `trainer`, `member`) and account statuses (`active`, `pending`, `suspended`) are stored authoritatively in the server Firestore `users/{uid}` collection.
5. Client-side route guards in React are purely for UI/UX convenience; every sensitive API route strictly enforces role verification server-side.
6. Public registration endpoints can never create an account with `role: "owner"`. Staff self-registration requires explicit approval by an owner.

### Consequences
- Role tampering or forged claims are impossible from the client.
- Deactivated or suspended staff immediately lose access to all API operations.

---

## ADR 004: UTC Timestamps & Asia/Kolkata Gym Display Timezone

### Status
Accepted

### Context
Attendance check-ins, fee receipts, membership start/end dates, and expiry reminder jobs must remain consistent regardless of the server hosting location, client device timezone, or daylight changes.

### Decision
1. All timestamp fields in Firestore (`createdAt`, `updatedAt`, `checkInTime`, `startDate`, `endDate`, `expiresAt`) are stored as Firestore `Timestamp` objects or UTC ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
2. The business calendar day (e.g. determining whether today is 04 Nov 2026, and identifying morning vs. evening workout sessions) is computed according to the gym's official operational timezone stored in `gymSettings.timezone` (defaulting to `Asia/Kolkata`).
3. Session determination (Morning 06:00–12:00 vs. Evening 16:00–22:00) evaluates the local time in the gym's configured timezone.

### Consequences
- Eliminates edge cases where a member checking in at 11:30 PM UTC is logged on the wrong local date.
- Consistent reports between reception, member app, and owner analytics.

---

## ADR 005: Offline Behavior Policy (Server-Confirmed Operations)

### Status
Accepted

### Context
The gym app will be installable as a Progressive Web App (PWA). PWA offline caching is beneficial for static assets, but business-critical transactions must remain secure.

### Decision
1. Service worker caches static assets (HTML, CSS, JS, app icons, fonts) to allow instant PWA launch.
2. Sensitive, irreversible actions (**Attendance Check-in** and **Fee Payments**) strictly require network connectivity and server confirmation.
3. Attendance and payments will **never** be optimistically faked or queued offline without verified server write.
4. If a member scans a QR code without internet connectivity, the app displays a clear offline alert explaining that an internet connection is required to record verified attendance.

### Consequences
- Avoids reconciliation conflicts, phantom check-ins, and duplicate payments.
- Ensures receipts and streak counts are always verified facts.

---

## ADR 006: Vanilla CSS Variables & Design Tokens (No Tailwind)

### Status
Accepted

### Context
Per project specifications, the frontend stack requires clean HTML5 and standard CSS3 without third-party utility frameworks like Tailwind CSS.

### Decision
1. Design tokens are authored in `client/src/styles/variables.css` under the `:root` scope.
2. Tokens capture dark navy/black surfaces (`#0a0e1a`, `#0f172a`), electric neon lime accent (`#c6f135`), 4px spacing grid, typography scale, radii, and elevation shadows.
3. Global utility classes (`.btn`, `.btn-primary`, `.card`, `.badge`, `.text-accent`) are defined in `client/src/index.css`.
4. Component-specific layout styles are structured in co-located CSS files (e.g. `AppShell.css`, `AuthLayout.css`).

### Consequences
- Zero build complexity or dependency overhead for CSS compilation.
- Seamless CSS variable re-theming and full compliance with the project stack guidelines.

---

## ADR 007: Automated Testing Strategy (Vitest Client + Node Native Server)

### Status
Accepted

### Context
Both frontend and backend require fast, deterministic smoke and unit tests that run reliably locally and in GitHub Actions CI without hanging or flaking on network/database calls.

### Decision
1. **Frontend**: Vitest with `@testing-library/react` and `jsdom` for testing React component rendering, routing transitions, and layout shells.
2. **Backend**: Node.js native test runner (`node --test`) with Express app factory (`createApp()`) for testing middleware, Zod validation, error handling, CORS, and rate limiting in memory without port conflicts.
3. **CI**: GitHub Actions workflow executes lint, test, and build across both packages on every push and pull request to `main`.

### Consequences
- Lightning-fast test runs (under 2 seconds total).
- No external test daemon or database dependencies required for CI smoke validation.
