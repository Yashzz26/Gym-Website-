# WhatsApp Business Cloud API — Message Templates & Integration Specification

**Document Version:** 1.1.0  
**Updated:** Day 24 (25 November 2026) — Task 48 (WhatsApp Cloud API Foundation)  
**Status:** `SUBMITTED / PENDING_APPROVAL` (Meta Business Cloud API)  
**Fallback Strategy:** Simulated sandbox dispatcher (`WHATSAPP_MOCK_DISPATCH=true`) with local structured logging in `whatsappLogs` and `reminderLogs`

---

## 1. Overview & Integration Architecture

The IRONCORE Gym Management System integrates with the **Meta WhatsApp Business Cloud API** (Graph API `v21.0`) to deliver compliant, opt-in transactional alerts and retention notifications to registered members:

1. **New Member Welcome (`ironcore_gym_welcome`):** Onboarding confirmation triggered when a member's first plan activates.
2. **Expiring Membership Reminders (`ironcore_renewal_reminder_3days`):** Automated and manual alerts at 3 days prior to subscription expiry.
3. **Expired Subscription Notices (`ironcore_membership_expired`):** Immediate notification when an active membership reaches its end date without renewal.
4. **Official Fee Payment Receipts (`ironcore_payment_receipt`):** Instant confirmation with invoice/receipt ID, payment mode, amount paid, and new validity dates.
5. **Inactive Member Follow-ups (`ironcore_inactive_member_checkin`):** Re-engagement outreach for active members with no check-ins for 7 or more consecutive days.

---

## 2. Template Catalog Summary

| Template Name | Message Purpose | Variables | Languages | Category | Approval Status |
|---|---|---|---|---|---|
| `ironcore_gym_welcome` | Confirm new membership activation and welcome member | `{{1}}` memberName, `{{2}}` gymName, `{{3}}` planName | `en_US`, `hi` | `UTILITY` | `PENDING_APPROVAL` |
| `ironcore_renewal_reminder_3days` | Alert active members 3 days before membership expiration | `{{1}}` memberName, `{{2}}` planName, `{{3}}` gymName, `{{4}}` daysRemaining, `{{5}}` expiryDate | `en_US`, `hi` | `UTILITY` | `PENDING_APPROVAL` |
| `ironcore_membership_expired` | Notify member when plan expires and gate access pauses | `{{1}}` memberName, `{{2}}` planName, `{{3}}` gymName, `{{4}}` expiryDate | `en_US`, `hi` | `UTILITY` | `PENDING_APPROVAL` |
| `ironcore_payment_receipt` | Send official payment receipt after online or desk fee entry | `{{1}}` memberName, `{{2}}` formattedAmount, `{{3}}` planName, `{{4}}` gymName, `{{5}}` receiptId, `{{6}}` startDate, `{{7}}` endDate, `{{8}}` paymentMethod | `en_US` | `UTILITY` | `PENDING_APPROVAL` |
| `ironcore_inactive_member_checkin` | Encourage active members absent 7+ days to resume workouts | `{{1}}` memberName, `{{2}}` gymName, `{{3}}` daysAbsent | `en_US`, `hi` | `UTILITY` | `PENDING_APPROVAL` |

---

## 3. Template Specifications & Payload Definitions

### Template 1: `ironcore_gym_welcome`

- **Purpose:** Welcome onboarding confirmation dispatched when a new membership becomes active via Razorpay capture or reception desk activation.
- **Category:** `UTILITY`
- **Languages:** `en_US` (Primary), `hi` (Hindi Secondary)
- **Header:** None
- **Body Text:**
  ```text
  Welcome to {{2}}, {{1}}!

  Your {{3}} membership is now active. Open the member app at reception or scan the gym entrance QR code on your next visit to start tracking your workout streak.
  ```
- **Placeholders:**
  - `{{1}}`: Member Full Name (e.g., `Rahul Sharma`)
  - `{{2}}`: Gym Name (e.g., `IRONCORE Fitness Club`)
  - `{{3}}`: Plan Name (e.g., `3 Months Pro`)
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891023-WELC`)

---

### Template 2: `ironcore_renewal_reminder_3days`

- **Purpose:** Proactive renewal reminder for memberships expiring in 3 days or fewer.
- **Category:** `UTILITY`
- **Languages:** `en_US` (Primary), `hi` (Hindi Secondary)
- **Trigger:** Scheduled daily reminder job or manual single/bulk dispatch from Reception Renewal List.
- **Header:** None
- **Body Text:**
  ```text
  Hello {{1}}, your {{2}} membership at {{3}} is expiring in {{4}} day(s) on {{5}}. 

  Renew your membership now to maintain seamless access to gym facilities, assigned trainers, and workout tracking. 

  Contact reception or visit the gym desk to renew.
  ```
- **Placeholders:**
  - `{{1}}`: Member Full Name
  - `{{2}}`: Plan Name
  - `{{3}}`: Gym Name
  - `{{4}}`: Days Remaining
  - `{{5}}`: Expiry Date
- **Buttons:**
  - Quick Reply: `Renew Online`
  - Phone Number: `Call Reception` (`+919876543210`)
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891024-REN3D`)

---

### Template 3: `ironcore_membership_expired`

- **Purpose:** Transactional expiration notice when a plan transitions from `active` to `expired`.
- **Category:** `UTILITY`
- **Languages:** `en_US`, `hi`
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

### Template 4: `ironcore_payment_receipt`

- **Purpose:** Official digital fee receipt for Razorpay and reception payments.
- **Category:** `UTILITY`
- **Languages:** `en_US`
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
  - `{{3}}`: Plan Name
  - `{{4}}`: Gym Name
  - `{{5}}`: Receipt ID
  - `{{6}}`: Start Date
  - `{{7}}`: End Date
  - `{{8}}`: Payment Method (`Cash`, `UPI`, `Razorpay Online`)
- **Buttons:**
  - URL: `View Official Receipt` (`https://ironcore.fit/receipt/{{1}}`)
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891026-RCPT`)

---

### Template 5: `ironcore_inactive_member_checkin`

- **Purpose:** Retention outreach to active members with no attendance scans for 7+ consecutive days.
- **Category:** `UTILITY` (may be reclassified as `MARKETING` depending on regional Meta review rules)
- **Languages:** `en_US`, `hi`
- **Trigger:** Owner Inactive Members console or scheduled retention automation.
- **Body Text:**
  ```text
  Hey {{1}}, we missed you at {{2}}! 

  We noticed you haven't checked in for {{3}} days. Consistency is key to reaching your fitness goals. 

  Our trainers are ready to support your next session. See you back on the gym floor soon!
  ```
- **Placeholders:**
  - `{{1}}`: Member Name
  - `{{2}}`: Gym Name
  - `{{3}}`: Days Absent
- **Buttons:**
  - Quick Reply: `I'll be there today!`
- **Meta Status:** `PENDING_APPROVAL` (Submission ID: `WABA-TMPL-891027-INACT`)

---

## 4. Meta Business Manager Template Submission Guidance

Follow these steps to obtain Meta production approval before enabling live template dispatch:

1. **Create & Verify Meta App + WABA:**
   - Register a Meta Business App at [developers.facebook.com](https://developers.facebook.com) and add the **WhatsApp** product.
   - Link your gym's verified business phone number inside Meta Business Manager to obtain `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID`.
   - Generate a permanent **System User Access Token** scoped to `whatsapp_business_messaging` and `whatsapp_business_management`.

2. **Submit Templates for Review (Utility Category):**
   - Navigate to **WhatsApp Manager → Account Tools → Message Templates → Create Template**.
   - Select **Utility** category for transactional receipts and expiry alerts (note: Meta may re-categorize `ironcore_inactive_member_checkin` under **Marketing** if promotional copy is included — avoid discount percentages inside template text).
   - Provide realistic sample values for every `{{N}}` variable during submission (Meta rejects templates without concrete variable examples).
   - Submit both `en_US` and `hi` translations where required, matching exact placeholder indices (`{{1}}`, `{{2}}`, ...).

3. **Configure Webhook Verification (`GET / POST /api/whatsapp/webhook`):**
   - Set a strong random secret for `WHATSAPP_VERIFY_TOKEN` and copy your Meta App's `App Secret` into `WHATSAPP_APP_SECRET` in `server/.env`.
   - In the Meta App Dashboard under **WhatsApp → Configuration → Webhook**, configure:
     - **Callback URL:** `https://<your-api-domain>/api/whatsapp/webhook`
     - **Verify Token:** value matching `WHATSAPP_VERIFY_TOKEN`
   - Meta performs an immediate `GET` challenge request (`hub.mode=subscribe`), verified automatically by `whatsappController.verifyWebhook`.
   - Subscribe to the `messages` webhook field so Meta sends delivery status updates (`sent`, `delivered`, `read`, `failed`) signed with `X-Hub-Signature-256`.

4. **Safe Local Testing & Opt-In Compliance:**
   - Keep `WHATSAPP_MOCK_DISPATCH=true` in local `.env` files during development.
   - Never commit real tokens or `.env` files to Git. Only use placeholder entries in `server/.env.example`.
   - Automated sending jobs (Day 25) must check `user.whatsappOptIn === true` and verify template `approvalStatus === 'APPROVED'` (or mock mode) before dispatching.

---

## 5. Server Environment Configuration Reference

Configure the following environment variables strictly in `server/.env`:

```env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_whatsapp_business_account_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_APP_SECRET=your_whatsapp_app_secret
WHATSAPP_VERIFY_TOKEN=your_custom_webhook_verify_token
WHATSAPP_MOCK_DISPATCH=true
```
