# Database Schema

> Status: **Draft** — Full Firestore data model documented in [TASK1_ARCHITECTURE.md](./TASK1_ARCHITECTURE.md#5-firestore-data-model).

## Data Conventions

- Use Firebase Authentication UID as `users` document ID.
- Use Firestore document IDs and explicit reference fields for relationships.
- Store dates as Firestore `Timestamp` objects.
- Store money as **integer paise** (not floating-point rupees). e.g. ₹3,999 = `399900`.
- Preserve membership and payment history — never overwrite historical records on renewal.
- Use server-generated timestamps (`FieldValue.serverTimestamp()`) for attendance and financial events.
- Add Firestore indexes for actual query patterns.
- Use transactions or atomic writes when related records must change together.

## Collection Field Reference

> Detailed field definitions, validation rules, and security notes for each collection will be documented here as each phase is implemented.

### Collections to Document

- [ ] `users`
- [ ] `membershipPlans`
- [ ] `memberships`
- [ ] `payments`
- [ ] `attendance`
- [ ] `qrTokens`
- [ ] `trainerAssignments`
- [ ] `workoutPlans`
- [ ] `workoutLogs`
- [ ] `dietPlans`
- [ ] `notifications`
- [ ] `reminderLogs`
- [ ] `gymSettings`
- [ ] `coupons`
- [ ] `auditLogs`
