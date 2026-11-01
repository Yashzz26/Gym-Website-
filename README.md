# Gym Management System

A responsive Gym Management Website and installable Progressive Web App
(PWA), based on the 16-page `Gym_App_Blueprint_PWS_Coding.pdf`.

The system supports four roles---Owner, Reception, Trainer, and
Member---and implements the 11 core screens described in the blueprint.

## 1. Technology Stack

### Frontend

-   React.js
-   JavaScript
-   Vite
-   React Router
-   HTML5 and CSS3
-   Lucide React
-   Recharts
-   React Hook Form
-   `html5-qrcode`

### Backend

-   Node.js
-   Express.js
-   REST APIs

### Firebase

-   Firebase Authentication (email and password)
-   Cloud Firestore
-   Firebase Storage
-   Firebase Admin SDK

### Integrations

-   Razorpay for online payments
-   Official Meta WhatsApp Business Cloud API for messages

### Application delivery

-   Responsive website
-   Installable PWA
-   Web App Manifest
-   Service worker and offline fallback

> This project uses Firebase/Firestore as its database, not MongoDB. It
> is therefore a React + Node/Express + Firebase stack rather than a
> traditional MongoDB-based MERN stack.

## 2. User Roles and Permissions

  -----------------------------------------------------------------------
  Role                                Main responsibilities
  ----------------------------------- -----------------------------------
  Owner                               Full gym administration, staff
                                      approvals, plans, reports, settings
                                      and audit history

  Reception                           Member registration, attendance,
                                      fees, renewals and receipts

  Trainer                             Assigned members, workout plans,
                                      diet plans and progress

  Member                              Online joining, payments, QR
                                      attendance, membership, workout and
                                      diet plans
  -----------------------------------------------------------------------

All privileged operations must be authorized by the Express backend.
Never trust a role supplied by the browser.

### Account creation rules

-   Users authenticate with email and password through Firebase
    Authentication.
-   The owner can create reception and trainer accounts.
-   Staff can also self-register, but self-registered staff accounts
    remain pending until approved by the owner.
-   Public registration must never allow a user to assign themselves the
    Owner role.
-   Members can register through the online joining flow.
-   Include forgot-password and logout functionality.

## 3. Core Screens

The following 11 screens are based on the supplied gym blueprint.

  -----------------------------------------------------------------------------
                \# Screen       Role         Main                Blueprint page
                                             functionality     
  ---------------- ------------ ------------ ----------------- ----------------
                 1 Online       Member       Membership plans,                4
                   Joining                   registration,     
                                             Razorpay payment  
                                             and welcome       
                                             message           

                 2 QR           Member       Scan gym QR,                     5
                   Attendance                record check-in,  
                                             session and       
                                             attendance streak 

                 3 Workout Plan Member       Daily exercises,                 6
                                             sets, reps,       
                                             completion and    
                                             progress          

                 4 Today's      Reception    Daily count,                     7
                   Attendance                morning/evening   
                                             split and member  
                                             entry times       

                 5 Fees Entry   Reception    Member search,                   8
                                             plan selection,   
                                             cash/UPI          
                                             recording and     
                                             receipt           

                 6 Renewal List Reception    Expiring                         9
                                             memberships,      
                                             remaining days    
                                             and reminders     

                 7 My Members   Trainer      Assigned members,               10
                                             goals, weight     
                                             progress and      
                                             attendance        

                 8 Diet Plan    Trainer      Calories, macros,               11
                                             meals and member  
                                             sharing           

                 9 Daily Report Owner        Revenue, payment                12
                                             split, pending    
                                             fees, attendance  
                                             and charts        

                10 Inactive     Owner        Members absent                  13
                   Members                   for 7+ days and   
                                             follow-up         
                                             reminders         

                11 Login        All          Email/password                  14
                                             login, role-based 
                                             access and logout 
  -----------------------------------------------------------------------------

Other useful blueprint references: - Pages 2--3: Business problems,
solution overview and member journey. - Page 15: Potential future
features such as WhatsApp automation, online payment links, RFID and
multiple branches. - Page 16: Project overview and implementation
expectations.

## 4. Proposed Project Structure

``` text
gym-management/
├── Gym_App_Blueprint_PWS_Coding.pdf
├── client/
│   ├── public/
│   │   ├── icons/
│   │   ├── manifest.json
│   │   └── service-worker.js
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── layouts/
│       ├── pages/
│       │   ├── auth/
│       │   ├── member/
│       │   ├── reception/
│       │   ├── trainer/
│       │   └── owner/
│       ├── context/
│       ├── hooks/
│       ├── services/
│       ├── styles/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.js
├── docs/
│   ├── ERD.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DOCUMENTATION.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── SECURITY_RULES.md
├── .gitignore
└── README.md
```

The structure may be adjusted where there is a clear technical reason.
Keep frontend and backend responsibilities separate.

## 5. Firestore Data Model

Create and document these collections:

  Collection             Purpose
  ---------------------- ---------------------------------------------------------
  `users`                User profiles, role, contact details and account status
  `membershipPlans`      Available plans, duration, price and benefits
  `memberships`          Subscription periods, start/end dates and status
  `payments`             Razorpay, cash and manually recorded UPI transactions
  `attendance`           QR check-ins, timestamps and session
  `trainerAssignments`   Trainer-to-member assignments
  `workoutPlans`         Exercises, sets, reps and completion information
  `dietPlans`            Calorie targets, macros and meal schedules
  `notifications`        In-app notifications
  `reminderLogs`         WhatsApp message attempts and delivery status
  `gymSettings`          Gym profile and QR configuration
  `coupons`              Optional discount codes
  `auditLogs`            Important owner and staff actions

### Data conventions

-   Use the Firebase Authentication UID as the `users` document ID.
-   Use Firestore document IDs and explicit reference fields for
    relationships.
-   Store dates as Firestore Timestamps.
-   Store money as integer paise, not floating-point rupees.
-   Preserve membership and payment history; do not overwrite historical
    records during renewal.
-   Use server-generated timestamps for attendance and financial events.
-   Add indexes for actual query patterns.
-   Use transactions or atomic writes when related records must change
    together.
-   Document collection fields, validation, relationships and security
    rules.

Firestore is a NoSQL database. The ERD should describe logical
relationships, not imply SQL foreign-key enforcement.

## 6. Payment Workflow --- Razorpay

Implement Razorpay through the Express backend.

1.  Member selects a membership plan.
2.  React requests an order from the backend.
3.  Express creates a Razorpay order using server-side credentials.
4.  React opens Razorpay Checkout using the order details.
5.  The payment result is sent to the backend.
6.  Express verifies the payment signature.
7.  A verified Razorpay webhook independently updates payment status.
8.  Activate the membership only after trusted server-side confirmation.

Requirements: - Keep Razorpay secrets on the server. - Verify webhook
signatures using the raw request body as required by Razorpay. - Store
order ID, payment ID, amount in paise and status. - Make webhook
processing idempotent. - Handle failed, pending, duplicate and delayed
payment events. - Support reception-recorded cash and manual UPI
payments with staff identity and audit history. - Never trust a frontend
success callback as proof of payment.

## 7. QR Attendance Workflow

The member scans a QR code displayed at the gym entrance.

Recommended implementation: - Generate a short-lived, signed or rotating
QR token. - Member scans using the device camera. - Send the token to
the Express API. - Verify token validity and expiry on the server. -
Verify that the member account and membership are eligible. - Apply a
duplicate check-in rule. - Record the check-in time using server time. -
Determine the configured morning/evening session. - Return a clear
success or failure result.

Do not rely on a permanent, unrestricted QR value. Do not show
attendance as successful while offline or before server confirmation.

## 8. WhatsApp Automation

Use the official Meta WhatsApp Business Cloud API.

Planned message types: - New member welcome message. - Payment
receipt. - Membership expiry reminder. - Three-day renewal reminder. -
Inactive-member follow-up.

Requirements: - Configure and use approved message templates where
required. - Record user opt-in and respect opt-outs. - Verify incoming
webhook requests. - Track sent, delivered, read and failed statuses
where available. - Store message history in `reminderLogs`. - Prevent
duplicate scheduled messages. - Keep access tokens and app secrets in
server environment variables. - Follow Meta's current messaging policies
and applicable consent requirements.

## 9. PWA Requirements

The application must work as a responsive website and an installable
PWA.

Implement: - Web App Manifest. - Appropriate app icons. - Theme and
background colors. - Service worker. - Installability. - Offline
fallback page. - Safe static-asset caching. - Responsive desktop, tablet
and mobile layouts.

Do not indiscriminately cache member records, authentication data,
payment data or other sensitive information. Payment and attendance
operations require a live server response. Camera access and service
workers require HTTPS in production.

## 10. Security Requirements

-   Verify Firebase ID tokens in Express middleware.
-   Enforce roles and permissions on the server.
-   Validate and sanitize request data.
-   Configure CORS for approved frontend origins.
-   Add appropriate rate limiting.
-   Protect sensitive endpoints.
-   Keep Firebase Admin credentials and integration secrets server-side.
-   Configure Firestore Security Rules with least privilege.
-   Restrict direct client writes to payments, attendance and other
    privileged records.
-   Verify Razorpay webhooks.
-   Verify WhatsApp webhook requests.
-   Add audit logs for sensitive staff and owner actions.
-   Never store passwords directly.
-   Avoid logging secrets, tokens or sensitive personal data.

## 11. UI/UX Direction

Use the supplied PDF as the visual and functional reference.

Suggested visual direction: - Premium gym-management dashboard. - Dark
navy and black surfaces. - Neon lime-green accent. - Clear typography
and hierarchy. - Consistent spacing and reusable components. -
Professional cards, tables, forms and charts. - Responsive sidebar on
desktop. - Mobile-friendly navigation. - Accessible forms and clear
validation. - Loading, empty, error and success states.

Use normal CSS files, CSS variables and reusable components. Recreate
the screens as real React interfaces; do not use PDF screenshots as the
application UI.

## 12. Development Phases

1.  **Analysis and architecture:** Review all PDF pages, finalize
    requirements, ERD, Firestore schema, API plan and security model.
2.  **Project foundation:** Set up Vite/React, Express, Firebase
    configuration, environment variables and PWA foundation.
3.  **Authentication and roles:** Email/password login, protected
    routes, role authorization, staff approval and account management.
4.  **Members and memberships:** Member profiles, online joining,
    reception registration, plans and membership history.
5.  **Payments:** Razorpay order creation, Checkout, server
    verification, webhooks, cash/UPI recording and receipts.
6.  **Attendance:** Gym QR generation, member scanning, server
    validation, check-in history and attendance reports.
7.  **Trainer features:** Member assignments, workout plans, diet plans
    and progress.
8.  **Reception and owner dashboards:** Fees, renewals, daily reports
    and inactive-member lists.
9.  **Automation:** WhatsApp templates, reminders, scheduling, webhooks
    and delivery logs.
10. **PWA completion:** Installability, icons, service worker and
    offline fallback.
11. **Testing and deployment:** Role/security tests, integration tests,
    responsive testing, production configuration and documentation.

## 13. Required Documentation

Create and maintain:

-   `docs/ERD.md`
-   `docs/DATABASE_SCHEMA.md`
-   `docs/API_DOCUMENTATION.md`
-   `docs/PROJECT_ARCHITECTURE.md`
-   `docs/SECURITY_RULES.md`

The root README must include setup instructions, required environment
variables, development commands, Firebase configuration, integration
setup and deployment notes.

Provide an `.env.example` containing placeholder names only. Never put
real credentials in the repository.

## 14. Working Rules for the Coding Agent

-   Study the attached PDF before coding.
-   Preserve all 11 required screens.
-   Ask questions where a requirement is genuinely ambiguous.
-   Do not silently invent business rules.
-   Do not generate the entire application in one unreviewed step.
-   Work phase by phase.
-   Explain files created and important implementation decisions.
-   Provide exact commands to install and run the application.
-   Test each feature before marking it complete.
-   Clearly label demo data and mock integrations.
-   Never claim a payment, message or attendance operation works until
    it has been tested against the relevant integration or a clearly
    identified test environment.

## 15. First Task --- Architecture Only

Before implementation:

1.  Analyze all 16 pages of the attached PDF.
2.  List and explain all 11 screens.
3.  Create the user journey diagram.
4.  Propose the final architecture.
5.  Create the Firestore data model.
6.  Create the Mermaid ERD.
7.  List REST API endpoints.
8.  Explain authentication and authorization.
9.  Document Razorpay flow.
10. Document QR attendance flow.
11. Document WhatsApp automation.
12. Document PWA architecture.
13. Identify unresolved decisions and risks.
14. Present the implementation roadmap.

Do not start coding until I approve this architecture.

# FINAL GOAL

Deliver a complete, secure, responsive and installable Gym Management
System using React, CSS, Node.js, Express and Firebase, with Razorpay
payment integration and official WhatsApp automation.

All 11 screens from the attached gym blueprint must be implemented as
functional application features.
