# Entity Relationship Diagram

> Status: **Draft** — Finalized during Task 1 Architecture phase.
> Full ERD with Mermaid diagram is in [TASK1_ARCHITECTURE.md](./TASK1_ARCHITECTURE.md#6-mermaid-erd).

## Collections Overview

| Collection | Purpose |
|-----------|---------|
| `users` | User profiles, role, contact details and account status |
| `membershipPlans` | Available plans, duration, price and benefits |
| `memberships` | Subscription periods, start/end dates and status |
| `payments` | Razorpay, cash and manually recorded UPI transactions |
| `attendance` | QR check-ins, timestamps and session |
| `qrTokens` | Short-lived rotating tokens for QR attendance |
| `trainerAssignments` | Trainer-to-member assignments |
| `workoutPlans` | Exercises, sets, reps and completion information |
| `workoutLogs` | Daily member exercise completion records |
| `dietPlans` | Calorie targets, macros and meal schedules |
| `notifications` | In-app notifications |
| `reminderLogs` | WhatsApp message attempts and delivery status |
| `gymSettings` | Gym profile and QR configuration |
| `coupons` | Optional discount codes |
| `auditLogs` | Important owner and staff actions |

## Logical Relationships

- A `user` (member) has many `memberships` (one active at a time).
- A `membership` belongs to one `membershipPlan`.
- A `payment` funds a `membership`.
- `attendance` records reference a `user`, their active `membership`, and the `qrToken` used.
- A `trainerAssignment` links one trainer `user` to one member `user`.
- `workoutPlans` and `dietPlans` are created by a trainer for a member.
- `workoutLogs` track daily completion by a member against a `workoutPlan`.
- `reminderLogs` record every WhatsApp message attempt per user.
- `auditLogs` record every sensitive action by staff/owner with actor + target.
