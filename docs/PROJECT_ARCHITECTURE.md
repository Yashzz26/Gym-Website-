# Project Architecture

> Status: **Draft** — Full architecture diagrams and decisions in [TASK1_ARCHITECTURE.md](./TASK1_ARCHITECTURE.md#4-system-architecture).

## Overview

A full-stack Gym Management System built with:

- **Frontend**: React + Vite (PWA)
- **Backend**: Node.js + Express (REST API)
- **Database**: Cloud Firestore (Firebase)
- **Auth**: Firebase Authentication (email + password)
- **Payments**: Razorpay
- **Messaging**: Meta WhatsApp Business Cloud API

## Folder Structure

```
gym-management/
├── client/                  # React + Vite frontend (PWA)
│   ├── public/
│   │   ├── icons/           # PWA app icons
│   │   ├── manifest.json    # Web App Manifest
│   │   └── service-worker.js
│   └── src/
│       ├── assets/          # Static assets (images, fonts)
│       ├── components/      # Reusable UI components
│       ├── layouts/         # Page layout wrappers
│       ├── pages/
│       │   ├── auth/        # Login, forgot password
│       │   ├── member/      # Online Joining, QR Attendance, Workout Plan
│       │   ├── reception/   # Today's Attendance, Fees Entry, Renewal List
│       │   ├── trainer/     # My Members, Diet Plan
│       │   └── owner/       # Daily Report, Inactive Members
│       ├── context/         # React Context (Auth, Gym Settings)
│       ├── hooks/           # Custom React hooks
│       ├── services/        # API call functions (axios)
│       ├── styles/          # Global CSS, variables, themes
│       ├── utils/           # Helper functions
│       ├── App.jsx          # Root component + router
│       └── main.jsx         # Entry point
├── server/                  # Node.js + Express backend
│   ├── config/              # Firebase Admin, Razorpay config
│   ├── controllers/         # Route handler logic
│   ├── middleware/          # Auth verification, rate limiting, CORS
│   ├── routes/              # Express router definitions
│   ├── services/            # Razorpay, WhatsApp, QR services
│   ├── utils/               # Shared utilities
│   └── server.js            # Entry point
├── docs/                    # Project documentation
├── .env.example             # Placeholder env vars (no real secrets)
├── .gitignore
└── README.md
```

## Security Model

- Firebase ID tokens verified on every API request by Express middleware.
- User role always read from Firestore server-side — never trusted from client.
- Pending staff blocked from accessing protected endpoints.
- Razorpay and WhatsApp secrets stored only in server `.env`.
- Firebase Admin SDK credentials stored only server-side.
- Firestore Security Rules enforce least-privilege direct client access.

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Login method | Email + password | Per README spec |
| QR strategy | Short-lived rotating tokens | Security — prevents replay attacks |
| Money storage | Integer paise | Avoids floating-point precision errors |
| Membership history | Never overwrite | Audit trail for renewals |
| Offline behavior | Sensitive ops require connectivity | Payments + attendance must be server-confirmed |
