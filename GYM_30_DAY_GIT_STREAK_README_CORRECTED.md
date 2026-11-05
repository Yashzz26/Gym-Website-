# Gym Management System --- 30-Day Development & GitHub Streak Plan

> **Planned start date:** 2 November 2026 (adjust to actual start; shift
> all dates accordingly)\
> **Actual start date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (fill on
> Day 1)\
> **Duration:** 30 consecutive planned development days\
> **Target:** 2 meaningful commits per day × 30 days = **60 planned
> commits**

## Project context

This repository already contains the planning/reference documentation
and the gym blueprint PDF. The application source code has not been
confirmed as implemented, so this plan begins by inspecting the existing
repository and then establishing the React/Vite frontend and Express
backend. Do not overwrite or recreate existing documentation
unnecessarily.

### Fixed technology stack

-   React.js + Vite + JavaScript
-   HTML5 + normal CSS3 (no Tailwind CSS)
-   Node.js + Express.js REST API
-   Firebase Authentication (email/password), Cloud Firestore, Firebase
    Storage and Firebase Admin SDK
-   Razorpay for online payments
-   Official Meta WhatsApp Business Cloud API
-   PWA, React Router, Recharts, `html5-qrcode`, Lucide React

### Product scope

-   Single gym, single branch initially
-   Four roles: Owner, Reception, Trainer and Member
-   Website plus installable PWA
-   All 11 screens from `Gym_App_Blueprint_PWS_Coding.pdf`
-   Staff can be created by the owner or self-register pending owner
    approval

## How to use this plan

1.  Give the day's **Task 1** to Claude Code or Antigravity and ask it
    to inspect the existing repository before editing.
2.  Complete the task, run its relevant checks, inspect the diff, and
    commit it using the suggested commit message.
3.  Give **Task 2** to the coding agent. Complete its checks and make
    the second commit.
4.  Push the day's commits to GitHub. Check that both commits appear on
    the intended repository and branch.
5.  Tick the task boxes only after the work is complete, tested and
    committed.

Tasks are outcomes, not 30-minute time limits. A task may take 30
minutes or several hours. Continue until the task is complete; do not
create an empty or misleading commit just to preserve a streak.

**Effort legend:** `[S]` = under 1 hour, `[M]` = 1--3 hours, `[L]` =
3--6 hours, `[XL]` = more than 6 hours. Estimates are approximate and
depend on the coding agent, setup and debugging.

If a task is `[XL]` and cannot be finished cleanly in one commit, split
its implementation into smaller meaningful, tested commits and update
the plan/tracker honestly. Still aim for two commits per day; do not
merge unrelated features just to hit a count.

### If a day is missed

Do not double-commit to catch up. Shift the remaining schedule forward
by one day, update the dates in the checklist and tracker, and continue.
Never create empty or split commits solely to preserve the streak.

### Definition of Done (per task)

-   [ ] Code or documentation is implemented and follows existing
    repository conventions.
-   [ ] Relevant automated test added/updated and passing; for
    documentation-only tasks, validate links, commands, examples and
    consistency instead of adding an artificial software test.
-   [ ] Relevant lint/check command passes (for example, `npm run lint`)
    where configured.
-   [ ] Manual verification steps and test command are included in the
    commit body or task notes.
-   [ ] No `.env`, credentials, service-account files, secrets or
    generated build output are included in the diff.
-   [ ] Commit message matches the plan or is updated to accurately
    describe the actual change.

## Daily Git workflow

Run commands from the repository root. Use the exact task-specific
commit message shown below. Stage specific paths rather than blindly
staging the entire repository.

``` bash
git status
git branch --show-current

# After Task 1 is complete and tested
git add <specific-paths>
git diff --staged
git commit -m "TASK 1 COMMIT MESSAGE"

# After Task 2 is complete and tested
git add <specific-paths>
git diff --staged
git commit -m "TASK 2 COMMIT MESSAGE"

# Push both commits and verify
git push
git status
git log -2 --oneline

# Tag the completed day after both commits are pushed
git tag day-01
git push --tags
```

Replace `day-01` with the correct day number (`day-02`, etc.). Do not
recreate or overwrite an existing tag. If a day is shifted because it
was missed, keep the tag sequence tied to the plan day, not the calendar
date.

Every commit body should state what was tested and the command used, for
example: `Tested: npm test -- auth`. This makes the history
self-documenting.

**Staging safety:** Before committing, inspect `git status` and
`git diff --staged`. Confirm no `.env`, service-account key,
credentials, build output or unrelated files are included. `git add .`
is a fallback only when you have reviewed the entire working tree and
are certain every changed file belongs in that commit.

Do not use `git commit --allow-empty` or split one unchanged file into
artificial commits. Each commit must deliver a distinct, useful change.
If a task cannot be safely separated, make one honest commit and adjust
the plan rather than padding the streak.

GitHub contribution activity depends on repository settings, branch,
commit email association and contribution display rules. Ensure your Git
commit email is associated with your GitHub account and push to the
repository's default branch (or another qualifying branch). Two commits
do not guarantee two separate contribution squares; GitHub generally
counts contribution days, not the number of commits as separate squares.

## 30-day task checklist

### Day 1 --- Monday, 02 November 2026 --- Project foundation

-   [x] **Task 1: Initialize the React + Vite frontend** \[M\]
    -   Create the client app with a clean Vite React structure, verify
        it starts, and remove unused starter content.
    -   Commit: `chore(client): initialize React and Vite frontend`
    -   Commit hash: `930bdfd`
-   [x] **Task 2: Initialize the Express backend** \[M\]
    -   Create the server package, Express entry point, health-check
        route and environment-variable loading. Verify the server
        starts.
    -   Commit:
        `chore(server): initialize Express backend and health check`
    -   Commit hash: `a42185b`
-   [x] Both planned commits pushed and visible on GitHub (Day 1).

### Day 2 --- Tuesday, 03 November 2026 --- Frontend and backend foundation

-   [x] **Task 3: Set up global CSS and design tokens** \[S\]
    -   Create CSS variables for colors, typography, spacing, radii and
        shadows based on the PDF's navy/black and lime visual direction.
        Verify `.env`, service-account files and build outputs are
        ignored with
        `git check-ignore -v .env server/serviceAccount.json client/dist`
        (use representative paths if files do not exist).
    -   Commit: `feat(client): add global styles and design tokens`
    -   Commit hash: `e624b9a`
-   [x] **Task 4: Add Express middleware foundation** \[M\]
    -   Add structured error handling, request validation (Zod or Joi),
        structured request logging, CORS configured from environment
        variables, and basic rate limiting. Wire middleware in the
        correct order and document configuration.
    -   Commit:
        `chore(server): add error, validation, logging, CORS and rate-limit middleware`
-   [x] Both planned commits pushed and visible on GitHub (Day 2).

### Day 3 --- Wednesday, 04 November 2026 --- Routing, shared UI and CI foundation

-   [x] **Task 5: Configure React Router and the shared application
    shell** \[M\]
    -   Create route groups for auth, member, reception, trainer and
        owner areas, a not-found page, and reusable responsive
        header/sidebar/content navigation. Use placeholder destinations
        only where screens are not implemented yet.
    -   Commit:
        `feat(client): configure routing and responsive application shell`
    -   Commit hash: `d3e374e`
-   [x] **Task 6: Add linting, formatting, tests and GitHub Actions CI**
    \[M\]
    -   Configure ESLint and Prettier for client/server, `lint` scripts,
        Husky + lint-staged, Vitest + React Testing Library for the
        client, and Jest or Vitest + Supertest for the server. Add at
        least one smoke test for each side and a GitHub Actions workflow
        that runs lint/tests on push and pull request. Create a root
        `DECISIONS.md` ADR log for non-trivial choices (integer paise,
        QR nonce policy, server-side activation, UTC timestamps, etc.)
        and append decisions as the project evolves.
    -   Commit: `chore(ci): add lint, format, tests and CI workflow`
-   [x] Both planned commits pushed and visible on GitHub (Day 3).

### Day 4 --- Thursday, 05 November 2026 --- Firebase client setup

-   [x] **Task 7: Configure Firebase client SDK** \[S\]
    -   Add Firebase initialization using Vite environment variables and
        document the required public Firebase config keys.
    -   Commit: `chore(firebase): configure client SDK`
-   Commit hash: `4e6507f`
-   [x] **Task 8: Add Firebase Auth email/password screens** \[M\]
    -   Build register and login forms with validation and Firebase
        email/password methods. Do not add role selection as a trusted
        privilege. Decide and document whether login requires verified
        email; if required, enforce `emailVerified` on protected routes
        and explain the user experience for unverified accounts.
    -   Commit: `feat(auth): add email and password authentication`
-   [ ] Both planned commits pushed and visible on GitHub (Day 4).

### Day 5 --- Friday, 06 November 2026 --- Authentication experience

-   [ ] **Task 9: Implement logout and password reset** \[S\]
    -   Add logout and forgot-password flows using Firebase Auth; show
        useful success and error messages.
    -   Commit: `feat(auth): add logout and password reset`
-   [ ] **Task 10: Add auth state handling** \[M\]
    -   Create an auth context/provider that observes Firebase auth
        state and handles loading, signed-in and signed-out states.
    -   Commit: `feat(auth): manage authenticated user state`
-   [ ] Both planned commits pushed and visible on GitHub (Day 5).

### Day 6 --- Saturday, 07 November 2026 --- Backend Firebase security foundation

-   [ ] **Task 11: Configure Firebase Admin and ID-token verification**
    \[M\]
    -   Initialize Firebase Admin in the server using environment
        configuration. Add middleware to verify Firebase ID tokens on
        protected API requests and return consistent 401 responses. Keep
        service-account credentials out of source control.
    -   Commit:
        `feat(server): configure Firebase Admin and verify ID tokens`
-   [ ] **Task 12: Author Firestore security rules v1 and emulator
    tests** \[L\]
    -   Add least-privilege rules for `users`, `membershipPlans`,
        `memberships`, `attendance`, `payments` and `notifications`.
        Configure the Firebase Emulator and rule-unit tests for
        permitted and denied access. Document how to run the tests.
        Remember Admin SDK bypasses Firestore Security Rules; test
        client rules through the emulator.
    -   Commit:
        `feat(firebase): add Firestore security rules and emulator tests`
-   [ ] Both planned commits pushed and visible on GitHub (Day 6).

### Day 7 --- Sunday, 08 November 2026 --- Authorization foundation

-   [ ] **Task 13: Create server-side role and account-status
    middleware** \[M\]
    -   Read role/status from trusted Firestore user data. Support
        owner, reception, trainer and member; block pending or suspended
        accounts. Create `docs/LOCAL_SETUP.md` covering Firebase
        Emulator setup, seed data, one test user per role and required
        environment-variable names (placeholders only).
    -   Commit: `feat(server): enforce role and account status`
-   [ ] **Task 14: Protect frontend routes** \[M\]
    -   Add route guards based on verified auth/profile state and role.
        Treat frontend guards as UX only; backend remains authoritative.
    -   Commit: `feat(client): protect routes by role`
-   [ ] Both planned commits pushed and visible on GitHub (Day 7).

### Day 8 --- Monday, 09 November 2026 --- User profiles and staff approval

-   [ ] **Task 15: Create user profile API and Firestore model** \[M\]
    -   Implement safe profile creation/read/update endpoints and
        validate allowed fields. Prevent users from changing their own
        role or approval status. Add a test proving `PATCH /users/me`
        with `{role: 'owner'}` or `{approvalStatus: 'approved'}` returns
        403 and leaves Firestore unchanged.
    -   Commit: `feat(users): add profile API and validation`
-   [ ] **Task 16: Build staff registration and owner approval UI**
    \[M\]
    -   Allow staff self-registration as pending and owner-created staff
        accounts/approval actions. Public registration must never grant
        owner role. Members joining online become active only after
        verified payment; staff self-registration always requires owner
        approval; public registration must never grant the owner role.
    -   Commit: `feat(users): add staff approval workflow`
-   [ ] Both planned commits pushed and visible on GitHub (Day 8).

### Day 9 --- Tuesday, 10 November 2026 --- Owner dashboard shell

-   [ ] **Task 17: Build owner dashboard layout** \[M\]
    -   Create the owner dashboard page with navigation and clear empty
        states for report cards, member totals and quick actions.
    -   Commit: `feat(owner): build dashboard layout`
-   [ ] **Task 18: Add gym settings management** \[M\]
    -   Create gym profile and session-time settings UI/API with
        owner-only editing and validated defaults. Define session
        settings as gym operating hours plus configurable
        morning/evening session windows and durations; store them in gym
        settings and expose them only to authorized views.
    -   Commit: `feat(settings): manage gym profile and sessions`
-   [ ] Both planned commits pushed and visible on GitHub (Day 9).

### Day 10 --- Wednesday, 11 November 2026 --- Membership plans

-   [ ] **Task 19: Create membership plan backend APIs** \[M\]
    -   Implement owner-only create, update, activate/deactivate and
        list endpoints. Store duration and price in integer paise. Add
        `firestore.indexes.json` with composite indexes required by plan
        listing and active-plan queries, and document index deployment.
    -   Commit: `feat(plans): add membership plan APIs`
-   [ ] **Task 20: Build membership plan management UI** \[M\]
    -   Create plan list and forms for 1-month, 3-month and 12-month
        plans; support benefits, price, duration and active status.
    -   Commit: `feat(owner): manage membership plans`
-   [ ] Both planned commits pushed and visible on GitHub (Day 10).

### Day 11 --- Thursday, 12 November 2026 --- Member registration

-   [ ] **Task 21: Build reception member registration** \[M\]
    -   Create a validated member form and backend flow that
        creates/links Firebase Auth identity and profile safely. Handle
        duplicate email cases.
    -   Commit: `feat(reception): add member registration`
-   [ ] **Task 22: Build online joining plan selection** \[M\]
    -   Create the public/member-facing joining page with plan
        comparison, registration details and clear payment-pending
        states. For online joining, create a member profile with
        `role: 'member'` and a distinct payment/membership status such
        as `payment_pending`; only verified payment activates the
        membership. Document the state machine in
        `docs/DATABASE_SCHEMA.md`.
    -   Commit: `feat(member): build online joining flow`
-   [ ] Both planned commits pushed and visible on GitHub (Day 11).

### Day 12 --- Friday, 13 November 2026 --- Membership lifecycle

-   [ ] **Task 23: Create membership creation and renewal APIs** \[M\]
    -   Implement membership records with start/end dates, status, plan
        reference and renewal history. Never overwrite old membership
        periods. Store dates as Firestore Timestamps (or consistently
        documented UTC ISO strings where appropriate). Store the gym
        display timezone in gym settings and document the convention in
        `docs/DATABASE_SCHEMA.md`.
    -   Commit: `feat(memberships): add membership lifecycle APIs`
-   [ ] **Task 24: Build member profile and membership views** \[M\]
    -   Show member profile, current/previous memberships, expiry date
        and status to permitted roles.
    -   Commit: `feat(members): add profile and membership views`
-   [ ] Both planned commits pushed and visible on GitHub (Day 12).

### Day 13 --- Saturday, 14 November 2026 --- Payments foundation

-   [ ] **Task 25: Create Razorpay order API** \[M\]
    -   Add server-side Razorpay client configuration and authenticated
        order creation. Validate plan/amount on the server; never accept
        a trusted amount from React. Reject order creation if the plan
        is inactive or the amount differs from the server-stored plan
        price. Check for overlapping active membership periods and
        require an explicit renewal/extension policy rather than
        silently creating overlapping subscriptions. Arrange a public
        HTTPS tunnel or staging URL before Day 14 webhook testing; use
        Razorpay test mode until live KYC/approval is complete.
    -   Commit: `feat(payments): create Razorpay orders`
-   [ ] **Task 26: Integrate Razorpay Checkout UI** \[M\]
    -   Connect the joining flow to Razorpay Checkout using the
        server-created order and show pending/success/failure states
        without activating membership yet.
    -   Commit: `feat(client): integrate Razorpay Checkout`
-   [ ] Both planned commits pushed and visible on GitHub (Day 13).

### Day 14 --- Sunday, 15 November 2026 --- Payment verification

-   [ ] **Task 27: Implement payment signature verification** \[M\]
    -   Verify Razorpay payment signatures on Express and persist
        payment status with idempotent handling.
    -   Commit: `feat(payments): verify Razorpay signatures`
-   [ ] **Task 28: Implement Razorpay webhook handling** \[L\]
    -   Add raw-body webhook signature verification, event deduplication
        and safe payment/membership activation after confirmed capture.
        Verify the signature against the raw request body before JSON
        parsing for the webhook route. Process events idempotently using
        Razorpay `event.id`, store processed event IDs, and activate
        membership only after a verified captured-payment event.
    -   Commit: `feat(payments): process verified Razorpay webhooks`
-   [ ] Both planned commits pushed and visible on GitHub (Day 14).

### Day 15 --- Monday, 16 November 2026 --- Reception fees

-   [ ] **Task 29: Add cash and manual UPI payment APIs** \[M\]
    -   Allow authorized reception users to record cash/manual UPI
        payments with amount, member, plan, staff ID and audit data.
        Write an `auditLogs` record for each manual payment with
        `actorId`, `action`, `targetId`, `amountPaise`, `method`,
        `timestamp` and `requestId`; define the collection shape in
        `docs/DATABASE_SCHEMA.md`.
    -   Commit: `feat(payments): record cash and manual UPI`
-   [ ] **Task 30: Build fees entry and receipt screen** \[M\]
    -   Build member search, plan selection, payment method, receipt
        details and payment history. Clearly distinguish manual UPI from
        Razorpay.
    -   Commit: `feat(reception): build fees entry and receipts`
-   [ ] Both planned commits pushed and visible on GitHub (Day 15).

### Day 16 --- Tuesday, 17 November 2026 --- QR attendance foundation

-   [ ] **Task 31: Create rotating QR token service** \[M\]
    -   Generate short-lived signed gym QR tokens on the backend,
        store/validate expiry and prevent token replay. Use an
        HMAC-signed token or signed JWT containing `gymId`, `iat`, `exp`
        (default 60 seconds) and a nonce. Atomically consume each nonce
        server-side with expiry so replay attempts are rejected. Return
        distinct `expired`, `invalid` and `replayed` error codes.
    -   Commit: `feat(qr): generate short-lived attendance tokens`
-   [ ] **Task 32: Build gym QR display screen** \[M\]
    -   Create an owner/reception screen that displays and refreshes the
        current gym QR token with expiry/refresh feedback.
    -   Commit: `feat(qr): add gym QR display`
-   [ ] Both planned commits pushed and visible on GitHub (Day 16).

### Day 17 --- Wednesday, 18 November 2026 --- Member attendance

-   [ ] **Task 33: Build member QR scanner** \[M\]
    -   Use html5-qrcode to scan the gym QR on supported HTTPS devices;
        handle camera permission, invalid QR and scan errors.
    -   Commit: `feat(attendance): build member QR scanner`
-   [ ] **Task 34: Implement secure attendance check-in** \[M\]
    -   Validate token, user, active membership, session and duplicate
        rules on the backend; record server timestamp and return a
        definitive result. Perform check-in in a Firestore transaction:
        read membership status and relevant attendance records, validate
        session and duplicate rules, then write. Never accept
        client-supplied timestamps.
    -   Commit: `feat(attendance): validate and record check-ins`
-   [ ] Both planned commits pushed and visible on GitHub (Day 17).

### Day 18 --- Thursday, 19 November 2026 --- Attendance reporting

-   [ ] **Task 35: Build member attendance history and streak** \[M\]
    -   Display member check-in history, weekly calendar and streak
        calculated from server records.
    -   Commit: `feat(member): show attendance history and streak`
-   [ ] **Task 36: Build reception today's attendance** \[M\]
    -   Show daily total, morning/evening counts, member names and
        server-recorded entry times with search/filter.
    -   Commit: `feat(reception): build daily attendance screen`
-   [ ] Both planned commits pushed and visible on GitHub (Day 18).

### Day 19 --- Friday, 20 November 2026 --- Trainer assignments

-   [ ] **Task 37: Create trainer assignment APIs** \[M\]
    -   Allow owner/authorized staff to assign and unassign members to
        trainers; enforce trainer access only to assigned members.
    -   Commit: `feat(trainer): add member assignment APIs`
-   [ ] **Task 38: Build trainer member list** \[M\]
    -   Create the trainer's assigned-member view with fitness goal,
        attendance summary and available progress information.
    -   Commit: `feat(trainer): build assigned members screen`
-   [ ] Both planned commits pushed and visible on GitHub (Day 19).

### Day 20 --- Saturday, 21 November 2026 --- Workout plans

-   [ ] **Task 39: Create workout plan APIs and validation** \[M\]
    -   Allow trainers to create/update plans for assigned members with
        exercise name, sets, reps, weekday and optional video URL.
    -   Commit: `feat(workouts): add workout plan APIs`
-   [ ] **Task 40: Build member workout and completion tracking** \[M\]
    -   Display the member's workout, allow exercise completion and
        persist daily workout logs/progress.
    -   Commit: `feat(workouts): add member workout tracking`
-   [ ] Both planned commits pushed and visible on GitHub (Day 20).

### Day 21 --- Sunday, 22 November 2026 --- Diet plans

-   [ ] **Task 41: Create diet plan APIs** \[M\]
    -   Allow trainers to create/update diet plans for assigned members
        with calories, macros and meal breakdown.
    -   Commit: `feat(diet): add diet plan APIs`
-   [ ] **Task 42: Build trainer diet editor and member diet view**
    \[M\]
    -   Build diet plan creation/editing and a member-facing read-only
        diet view with meal and macro details.
    -   Commit: `feat(diet): build diet plan interfaces`
-   [ ] Both planned commits pushed and visible on GitHub (Day 21).

### Day 22 --- Monday, 23 November 2026 --- Renewals

-   [ ] **Task 43: Create expiring membership query/API** \[M\]
    -   Return memberships expiring within the configured window, sorted
        by expiry, with correct timezone/date handling. Begin
        preparing/submitting WhatsApp templates for Meta approval by
        this stage so approval delays do not block later automation;
        document any pending approval.
    -   Commit: `feat(renewals): add expiring membership API`
-   [ ] **Task 44: Build reception renewal list and renewal action**
    \[M\]
    -   Show days remaining and allow authorized staff to initiate a
        renewal while preserving the previous membership record.
    -   Commit: `feat(reception): build renewal management`
-   [ ] Both planned commits pushed and visible on GitHub (Day 22).

### Day 23 --- Tuesday, 24 November 2026 --- Inactive members

-   [ ] **Task 45: Create inactive-member detection API** \[M\]
    -   Find members with active memberships and no attendance for at
        least seven days; exclude expired or ineligible accounts.
    -   Commit: `feat(members): detect inactive members`
-   [ ] **Task 46: Build owner inactive-members screen** \[M\]
    -   Display last visit and days absent, with search/filter and a
        clear follow-up action.
    -   Commit: `feat(owner): build inactive members screen`
-   [ ] Both planned commits pushed and visible on GitHub (Day 23).

### Day 24 --- Wednesday, 25 November 2026 --- Notifications foundation

-   [ ] **Task 47: Create in-app notification service** \[M\]
    -   Create notification records and APIs for listing, marking read
        and role-appropriate delivery.
    -   Commit: `feat(notifications): add in-app notification service`
-   [ ] **Task 48: Create WhatsApp Cloud API service foundation** \[M\]
    -   Add server-side configuration, message template service and
        webhook verification structure. Use test credentials only
        through environment variables. Include template submission
        guidance and create `docs/WHATSAPP_TEMPLATES.md` listing message
        purpose, variables, language and approval status for each
        proposed template.
    -   Commit: `feat(whatsapp): add Cloud API service foundation`
-   [ ] Both planned commits pushed and visible on GitHub (Day 24).

### Day 25 --- Thursday, 26 November 2026 --- WhatsApp automation

-   [ ] **Task 49: Implement WhatsApp template sending and delivery
    logs** \[L\]
    -   Send approved templates through Meta Cloud API and record
        message IDs, statuses and failures. Respect opt-in and opt-out.
        Check stored opt-out status before sending. Send only templates
        approved for the intended WhatsApp account/language, and log
        Meta message ID plus delivery status.
    -   Commit: `feat(whatsapp): send templates and track delivery`
-   [ ] **Task 50: Add renewal and inactive-member reminder jobs** \[L\]
    -   Add idempotent scheduled jobs for three-day expiry reminders and
        inactive-member follow-ups; prevent duplicate sends.
    -   Commit: `feat(automation): schedule membership reminders`
-   [ ] Both planned commits pushed and visible on GitHub (Day 25).

### Day 26 --- Friday, 27 November 2026 --- Owner reports

-   [ ] **Task 51: Create daily and weekly report APIs** \[M\]
    -   Aggregate verified payment and attendance records for daily
        revenue, cash/UPI split, pending dues, new members and renewals.
        Define pending dues separately from upcoming renewals: include
        overdue unpaid invoices and payments awaiting verification; show
        memberships expiring within seven days as upcoming renewals, not
        automatically as debt.
    -   Commit: `feat(reports): add daily and weekly analytics APIs`
-   [ ] **Task 52: Build owner reports dashboard** \[M\]
    -   Display report cards and weekly attendance chart using real API
        data, with loading, empty and error states.
    -   Commit: `feat(owner): build reports dashboard`
-   [ ] Both planned commits pushed and visible on GitHub (Day 26).

### Day 27 --- Saturday, 28 November 2026 --- PWA and responsive polish

-   [ ] **Task 53: Add PWA manifest, icons and install experience**
    \[M\]
    -   Configure app name, theme, icons and installability; test
        install prompts on supported browsers.
    -   Commit: `feat(pwa): add manifest and install experience`
-   [ ] **Task 54: Add safe service worker caching and responsive
    review** \[M\]
    -   Cache static assets only, provide offline fallback, avoid
        caching sensitive data, and review key screens on
        mobile/tablet/desktop.
    -   Commit: `feat(pwa): add safe caching and responsive polish`
-   [ ] Both planned commits pushed and visible on GitHub (Day 27).

### Day 28 --- Sunday, 29 November 2026 --- Critical-path testing and PWA polish

-   [ ] **Task 55: Raise test coverage on critical paths** \[L\]
    -   Raise coverage on authentication, role restrictions, payment
        verification, attendance and Firestore rules. Earlier tasks
        should already include focused tests; add missing cases rather
        than postponing all testing until the end. Include emulator
        tests for each role and protected collection.
    -   Commit:
        `test(quality): cover critical security and business paths`
-   [ ] **Task 56: Add safe service-worker caching and responsive
    review** \[M\]
    -   Cache static assets only, provide an offline fallback, avoid
        caching sensitive member/payment data, and review key screens on
        mobile, tablet and desktop.
    -   Commit: `feat(pwa): add safe caching and responsive polish`
-   [ ] Both planned commits pushed and visible on GitHub (Day 28).

### Day 29 --- Monday, 30 November 2026 --- Deployment preparation

-   [ ] **Task 57: Prepare production deployment configuration** \[M\]
    -   Configure production build settings, frontend/backend
        environment variable documentation, approved CORS origins,
        health checks and deployment instructions. Do not add real
        secrets.
    -   Commit: `chore(deploy): prepare production configuration`
-   [ ] **Task 58: Deploy a staging build** \[L\]
    -   Deploy the frontend and backend to a staging environment,
        configure HTTPS and environment variables, and verify the health
        endpoint and app loading. Use test credentials only.
    -   Commit: `chore(deploy): publish staging environment`
-   [ ] Both planned commits pushed and visible on GitHub (Day 29).

### Day 30 --- Tuesday, 01 December 2026 --- Final verification and release

-   [ ] **Task 59: Run end-to-end role and feature smoke tests** \[L\]
    -   Test login, role access, member joining, membership, test
        payments, QR attendance, trainer plans, reports and PWA
        installability. Record any blocked external integrations
        honestly.
    -   Commit: `test(e2e): verify core gym management workflows`
-   [ ] **Task 60: Finalize release documentation and GitHub project**
    \[M\]
    -   Update README with actual implemented status, setup, environment
        variables, deployment URLs if available, known limitations and
        next steps. Review Git status and repository secrets before
        final push. Create `docs/RELEASE_STATUS.md` recording each
        integration as sandbox-tested, live or blocked, with date and
        evidence/test ID. State clearly that sandbox-tested does not
        mean production-live.
    -   Commit: `docs(release): finalize project documentation`
-   [ ] Both planned commits pushed and visible on GitHub (Day 30).

## Completion tracker

  ----------------------------------------------------------------------------------
       Day Date        Task 1      Task 2      Pushed      Commits Blocked   Notes
           (shift if                                               on        
           missed)                                                           
  -------- --------- ----------- ----------- ----------- --------- --------- -------
         1 02 Nov       \[x\]       \[x\]       \[x\]            2           930bdfd, a42185b

         2 03 Nov       \[x\]       \[x\]       \[x\]            2           e624b9a

         3 04 Nov       \[x\]       \[x\]       \[x\]            2           d3e374e

         4 05 Nov       \[x\]       \[x\]       \[ \]            2           4e6507f; Task 2 commit in git history

         5 06 Nov       \[ \]       \[ \]       \[ \]            0           

         6 07 Nov       \[ \]       \[ \]       \[ \]            0           

         7 08 Nov       \[ \]       \[ \]       \[ \]            0           

         8 09 Nov       \[ \]       \[ \]       \[ \]            0           

         9 10 Nov       \[ \]       \[ \]       \[ \]            0           

        10 11 Nov       \[ \]       \[ \]       \[ \]            0           

        11 12 Nov       \[ \]       \[ \]       \[ \]            0           

        12 13 Nov       \[ \]       \[ \]       \[ \]            0           

        13 14 Nov       \[ \]       \[ \]       \[ \]            0           

        14 15 Nov       \[ \]       \[ \]       \[ \]            0           

        15 16 Nov       \[ \]       \[ \]       \[ \]            0           

        16 17 Nov       \[ \]       \[ \]       \[ \]            0           

        17 18 Nov       \[ \]       \[ \]       \[ \]            0           

        18 19 Nov       \[ \]       \[ \]       \[ \]            0           

        19 20 Nov       \[ \]       \[ \]       \[ \]            0           

        20 21 Nov       \[ \]       \[ \]       \[ \]            0           

        21 22 Nov       \[ \]       \[ \]       \[ \]            0           

        22 23 Nov       \[ \]       \[ \]       \[ \]            0           

        23 24 Nov       \[ \]       \[ \]       \[ \]            0           

        24 25 Nov       \[ \]       \[ \]       \[ \]            0           

        25 26 Nov       \[ \]       \[ \]       \[ \]            0           

        26 27 Nov       \[ \]       \[ \]       \[ \]            0           

        27 28 Nov       \[ \]       \[ \]       \[ \]            0           

        28 29 Nov       \[ \]       \[ \]       \[ \]            0           

        29 30 Nov       \[ \]       \[ \]       \[ \]            0           

        30 01 Dec       \[ \]       \[ \]       \[ \]            0           
  ----------------------------------------------------------------------------------

## Instructions for Claude Code / Antigravity

Paste this instruction before asking the agent to perform each task:

> You are working in my existing Gym Management System Git repository.
> Read the root README and relevant files in `docs/` before making
> changes. Follow the existing React + Vite + JavaScript + CSS,
> Node.js + Express and Firebase architecture. Do not replace the stack,
> overwrite completed work, or introduce unrelated features. First
> inspect the current repository and report the files you intend to
> change. Implement only the task I provide, use reusable and secure
> code, and preserve existing conventions. Run relevant checks/tests,
> fix errors, and summarize changed files and test results. Do not
> commit or push unless I explicitly ask. Never commit `.env`,
> credentials, Firebase service-account files, secrets or generated
> build output.

After each task, ask the agent to provide: - Files created or
modified. - What functionality is now working. - Commands/tests run and
their results. - Any manual setup or credentials still required. - Any
known limitations or follow-up work.

## Security and quality checklist

-   [ ] `.env` files and service-account keys are ignored and never
    committed.
-   [ ] Only `.env.example` placeholders are tracked.
-   [ ] Backend verifies Firebase ID tokens and reads roles from trusted
    server-side data.
-   [ ] Pending/suspended users cannot access protected operations.
-   [ ] Razorpay secrets stay on the backend; payment signatures and
    webhooks are verified.
-   [ ] WhatsApp credentials stay on the backend; opt-in/opt-out,
    approved templates and webhook verification are respected.
-   [ ] QR tokens are short-lived, signed, atomically single-use and
    protected against replay.
-   [ ] Attendance and payment success are never faked in offline mode.
-   [ ] Firestore client rules are tested using the Firebase Emulator;
    Express authorization is tested separately because Admin SDK
    bypasses Firestore Rules.
-   [ ] Every task receives relevant verification before its commit.

## Important project references

-   `Gym_App_Blueprint_PWS_Coding.pdf` --- original 16-page product
    blueprint and 11 screen designs.
-   `TASK1_ARCHITECTURE.md` --- architecture, user journey, data model,
    ERD and API planning.
-   `README.md` --- project requirements and setup overview.
-   `docs/ERD.md` --- logical Firestore entity relationships.
-   `docs/DATABASE_SCHEMA.md` --- Firestore collection conventions.
-   `docs/API_DOCUMENTATION.md` --- API groups and authentication
    convention.
-   `docs/PROJECT_ARCHITECTURE.md` --- application structure and
    security model.
-   `docs/SECURITY_RULES.md` --- Firestore access rules and security
    tests.
-   `docs/LOCAL_SETUP.md` --- local setup, emulator, seed data, test
    users and environment keys (create on Day 7).
-   `docs/WHATSAPP_TEMPLATES.md` --- proposed message templates and
    approval status (create on Day 24).
-   `docs/RELEASE_STATUS.md` --- integration status and evidence (create
    on Day 30).
-   `DECISIONS.md` --- lightweight architecture decision record (ADR)
    log; create on Day 3 and update as decisions are made.
-   `firestore.indexes.json` --- Firestore composite index definitions
    (create/update on Day 10).

## External integration dependencies

-   Razorpay webhook testing on Day 14 requires a publicly reachable
    HTTPS URL. Use a secure tunnel (such as ngrok or Cloudflare Tunnel)
    or staging deployment prepared by Day 13. Use Razorpay test mode
    until live KYC and account approval are complete.
-   Prepare and submit WhatsApp templates around Days 22--24. Meta
    approval can take time. If approval is pending, document the blocker
    and test the integration with permitted test templates or mocks; do
    not claim production messaging is live.
-   Firebase Emulator tests require the Firebase CLI and the appropriate
    emulator/test dependencies. Document exact setup commands in
    `docs/LOCAL_SETUP.md`.

## End goal

By the end of Day 30, the target is a tested first release covering the
11 blueprint screens, four roles, Firebase authentication and Firestore,
membership management, Razorpay payment flow, QR attendance, trainer
workout/diet features, owner/reception reports, WhatsApp integration
foundation/automation, and PWA installation. External integrations must
be reported accurately as sandbox-tested, live or blocked.
Sandbox-tested does not mean production-live.

**Streak principle: two real tasks, two useful commits, one push per
day. Build the product properly; do not sacrifice code quality for green
squares.**
