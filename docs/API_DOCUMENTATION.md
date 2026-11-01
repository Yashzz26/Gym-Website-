# API Documentation

> Status: **Draft** — Full endpoint list in [TASK1_ARCHITECTURE.md](./TASK1_ARCHITECTURE.md#7-rest-api-endpoints).

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

All protected endpoints require a Firebase ID Token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

The server verifies this token using Firebase Admin SDK and reads the user's role from Firestore.

## Endpoint Groups

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/auth` | Token verification, staff registration |
| Users | `/api/users` | Profiles, staff approval, suspension |
| Plans | `/api/plans` | Membership plan CRUD |
| Members | `/api/members` | Member management and queries |
| Memberships | `/api/memberships` | Subscription creation and renewal |
| Payments | `/api/payments` | Razorpay, manual cash/UPI, receipts |
| Attendance | `/api/attendance` | QR check-in, history, streak |
| QR | `/api/qr` | Token generation and current token |
| Trainer | `/api/trainer` | Assigned members, workout/diet plans |
| Reports | `/api/reports` | Daily and weekly owner reports |
| WhatsApp | `/api/whatsapp` | Message sending and status webhook |
| Settings | `/api/settings` | Gym configuration |
| Coupons | `/api/coupons` | Discount code management |

> Full request/response schemas will be added per endpoint as each phase is implemented.
