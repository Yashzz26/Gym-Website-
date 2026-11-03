# API Documentation

> Status: **In Progress** — Middleware foundation added on Day 2 (Task 4). Full endpoint list in [TASK1_ARCHITECTURE.md](./TASK1_ARCHITECTURE.md#7-rest-api-endpoints).

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

All protected endpoints require a Firebase ID Token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

The server verifies this token using Firebase Admin SDK and reads the user's role from Firestore.

---

## Middleware Pipeline & Architecture

Requests pass through the following middleware in order:

```
Incoming Request
  │
  ▼
1. requestLogger         Assigns X-Request-Id (UUID) & logs duration/status/IP
  │
  ▼
2. configureCors         Validates Origin header against CORS_ORIGIN env var
  │
  ▼
3. configureRateLimiter  Rate-limits per IP (RATE_LIMIT_WINDOW_MS & RATE_LIMIT_MAX; skips /api/health)
  │
  ▼
4. express.json          Parses JSON request bodies (limit: 10mb)
   express.urlencoded    Parses URL-encoded bodies (limit: 10mb)
  │
  ▼
5. Feature Routes        /api/health, /api/auth, /api/users, etc.
   └── validate()        Validates body, query, and params via Zod schemas
  │
  ▼
6. notFound              Catch-all: generates 404 NotFoundError for unmapped paths
  │
  ▼
7. errorHandler          Centralized error formatter for Zod, AppError & 500s
```

### Standard Error Response Format

All error responses return a standardized JSON structure:

```json
{
  "status": "error",
  "statusCode": 422,
  "message": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address",
      "code": "invalid_string"
    }
  ],
  "requestId": "3f8e5c4a-6d2b-4e1a-8c7f-9b2e4d5a6f7a"
}
```

### Request Validation with Zod

The `validate` middleware factory validates `body`, `query`, or `params`:

```javascript
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

router.post('/login', validate({ body: loginSchema }), loginController);
```

### Environment Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Port for Express server |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `LOG_FORMAT` | `dev` | Log output format (`dev` colorized or `json` structured) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15m) | Rate-limiting evaluation window in milliseconds |
| `RATE_LIMIT_MAX` | `100` | Max requests allowed per window per IP |

---

## Endpoint Groups

| Group | Prefix | Description |
|-------|--------|-------------|
| Health | `/api/health` | Server uptime and health status (unthrottled) |
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
