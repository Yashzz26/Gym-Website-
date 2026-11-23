# WhatsApp Business Cloud API — Message Templates Specification

**Document Version:** 1.0.0  
**Created:** Day 22 (23 November 2026) — Task 43  
**Status:** `SUBMITTED / PENDING_APPROVAL` (Meta Business Cloud API)  
**Fallback Strategy:** Simulated sandbox dispatcher with structured delivery logging (`WHATSAPP_MOCK_DISPATCH=true`)  

---

## 1. Overview & Integration Architecture

The IRONCORE Gym Management System integrates with the **Meta WhatsApp Business Cloud API** (Graph API v21.0) to dispatch transactional notifications and reminders to registered gym members:

1. **Expiring Membership Reminders:** Automated and manual alerts at $T-3$ days and $T-1$ days before subscription expiry.
2. **Expired Subscription Notices:** Immediate notification when an active membership reaches its end date without renewal.
3. **Official Fee Payment Receipts:** Instant confirmation with invoice ID, payment method, amount paid, and new validity dates.
4. **Inactive Member Follow-ups:** Re-engagement messages to members with no attendance records for $\ge 7$ consecutive days.

---

## 2. Template Specifications & Payload Definitions

### Template 1: `ironcore_renewal_reminder_3days`

- **Category:** `UTILITY`
- **Languages:** `en_US` (Primary), `hi` (Hindi Secondary)
- **Trigger:** Automatic cron job at 09:00 AM IST for memberships expiring in $\le 3$ days, or manual single/bulk dispatch from the Reception Renewal List screen.
- **Header:** None
- **Body Text:**
  ```text
  Hello {{1}}, your {{2}} membership at {{3}} is expiring in {{4}} day(s) on {{5}}. 

  Renew your membership now to maintain seamless access to gym facilities, assigned trainers, and workout tracking. 

  Contact reception or visit the gym desk to renew.
  ```
- **Placeholders:**
  - `{{1}}`: Member Full Name (e.g., `Rajesh Sharma`)
  - `{{2}}`: Plan Name (e.g., `3 Months Pro`)
  - `{{3}}`: Gym Name (e.g., `IronPulse Fitness Club`)
  - `{{4}}`: Days Remaining (e.g., `3`)
  - `{{5}}`: Expiry Date (e.g., `26 Nov 2026`)
- **Buttons:**
  - Quick Reply: `Renew Online`
  - Phone Number: `Call Reception` (`+919876543210`)
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891024-REN3D`)

---

### Template 2: `ironcore_membership_expired`

- **Category:** `UTILITY`
- **Languages:** `en_US`, `hi`
- **Trigger:** Dispatched on the day a membership transitions from `active` to `expired`.
- **Body Text:**
  ```text
  Hi {{1}}, your {{2}} membership at {{3}} expired on {{4}}. 

  Your QR attendance gate access has been paused. Please renew your membership to continue your workout streak and fitness progression.
  ```
- **Placeholders:**
  - `{{1}}`: Member Name
  - `{{2}}`: Plan Name
  - `{{3}}`: Gym Name
  - `{{4}}`: Expiration Date
- **Buttons:**
  - Quick Reply: `Renew Today`
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891025-EXP`)

---

### Template 3: `ironcore_payment_receipt`

- **Category:** `UTILITY`
- **Languages:** `en_US`
- **Trigger:** Immediately upon recording a Cash, manual UPI, or online Razorpay payment.
- **Body Text:**
  ```text
  Namaste {{1}}, payment of {{2}} for {{3}} has been successfully recorded at {{4}}.

  Receipt / Payment ID: {{5}}
  Valid from: {{6}} to {{7}}
  Payment Mode: {{8}}

  Thank you for being a committed member of {{4}}!
  ```
- **Placeholders:**
  - `{{1}}`: Member Name
  - `{{2}}`: Formatted INR Amount (e.g., `₹3,999.00`)
  - `{{3}}`: Plan Name (e.g., `3 Months Pro`)
  - `{{4}}`: Gym Name
  - `{{5}}`: Receipt ID (e.g., `REC-20261123-0042`)
  - `{{6}}`: Start Date
  - `{{7}}`: End Date
  - `{{8}}`: Payment Method (`Cash`, `UPI`, `Razorpay Online`)
- **Buttons:**
  - URL: `View Official Receipt` (`https://ironpulse.fit/receipt/{{5}}`)
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891026-RCPT`)

---

### Template 4: `ironcore_inactive_member_checkin`

- **Category:** `UTILITY` (or `MARKETING` based on regional jurisdiction)
- **Languages:** `en_US`, `hi`
- **Trigger:** Manual trigger by Owner from the Inactive Members screen (absent 7+ days).
- **Body Text:**
  ```text
  Hey {{1}}, we missed you at {{2}}! 

  We noticed you haven't checked in for {{3}} days. Consistency is key to reaching your fitness goals. 

  Our trainers are ready to support your next session. See you back on the gym floor soon!
  ```
- **Placeholders:**
  - `{{1}}`: Member Name
  - `{{2}}`: Gym Name
  - `{{3}}`: Days Absent (e.g., `9`)
- **Buttons:**
  - Quick Reply: `I'll be there today!`
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891027-INACT`)

---

## 3. Meta API Environment Configuration

When Meta approves the templates, configure the following in `server/.env`:

```env
# Meta WhatsApp Business Cloud API
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_account_id
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=ironcore_secure_webhook_verify_token
WHATSAPP_MOCK_DISPATCH=false
```

During local development and automated testing, `WHATSAPP_MOCK_DISPATCH=true` safely records the simulated messages and payloads in the `whatsappLogs` Firestore collection without consuming API credits or making external HTTP calls.
