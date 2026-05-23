# Email Triggers — Authoritative Inventory

Reference for the future Email Notifications settings page session.
Every auto-email trigger in the codebase is listed here.

**Configurable** = copy or recipient is (or should be) controllable from the admin panel.
**System** = security or operational email; copy should not be editable by admin.

---

## Referrer-facing triggers

| Trigger | Fires when | Recipient | File | Configurable | Status |
|---|---|---|---|---|---|
| Signup email verification | New referrer creates account | New referrer | `server/routes/referrer.js` | No — security | Built |
| Email change verification | Referrer updates email in Manage Account | Referrer | `server/routes/account.js` | No — security | Built |
| PIN reset | Referrer requests forgot-PIN email | Referrer | `server/routes/referrer.js` | No — security | Built |
| Pending referral invite | Referral detected; referrer has no app account | Non-app referrer | `server/utils/pendingReferral.js` → `sendPendingInviteEmail()` | Yes | Fixed Session 66 |
| Cashout received confirmation | Referrer submits cashout request | Referrer | — | Yes | **Not built** |
| Cashout approved | Admin approves cashout | Referrer | — | Yes | **Not built** |
| Cashout denied | Admin denies cashout | Referrer | — | Yes | **Not built** |
| Bank connection required | Stripe auto-transfer blocked; referrer has no bank account connected | Referrer | `server/routes/referrer.js` | Yes | Built |
| Missing referral resolved | Admin resolves a missing referral report | Referrer | `server/routes/admin/index.js` | Yes | Fixed Session 66 |
| Account deletion confirmation | Referrer deletes account | Referrer | `server/routes/account.js` | Yes | Built |

## Referred-client-facing triggers

| Trigger | Fires when | Recipient | File | Configurable | Status |
|---|---|---|---|---|---|
| Credit attribution | Referrer cannot be uniquely matched in Jobber | Referred client | `server/utils/pendingReferral.js` → `sendCreditAttributionEmail()` | Yes | Built (copy has brand review TODO) |
| Experience flow invite | Jobber client-create webhook received | New Jobber client | `server/routes/webhooks/jobber.js` | Yes | Built |

## Admin-facing triggers

| Trigger | Fires when | Recipient | File | Configurable | Status |
|---|---|---|---|---|---|
| New cashout request | Referrer submits cashout | Admin (`notification_email_payouts`) | `server/routes/referrer.js` → `sendAdminNotification()` | Yes (via Notification Settings) | Built |
| Auto-fire blocked | Stripe auto-transfer blocked; no bank account | Admin (`notification_email_payouts`) | `server/routes/referrer.js` → `sendAdminNotification()` | Yes | Built |
| Booking request | Referrer submits inspection booking form | Admin (`booking_email`) | `server/routes/referrer.js` | Yes (via Notification Settings) | Built |
| Account deletion | Referrer deletes account | Admin (`notification_email_general`) | `server/routes/account.js` → `sendAdminNotification()` | Yes | Built |
| Error alert | Backend error logged (first occurrence + every 10th recurrence) | `admin1@roofmiles.com` (hardcoded) | `server/middleware/errorLogger.js` → `logError()` | No — system | Built |

## Bulk / campaign triggers

| Trigger | Fires when | Recipient | File | Configurable | Status |
|---|---|---|---|---|---|
| Campaign batch email | Admin sends an email campaign batch | Contact list (selected referrers) | `server/routes/admin/campaigns.js` → `executeBatchSend()` | Yes — full builder | Built |

---

## SMS triggers

| Trigger | Fires when | Recipient | File | Status |
|---|---|---|---|---|
| Pending referral SMS invite | Same trigger as email invite; gated on `TWILIO_10DLC_ACTIVE=true` | Non-app referrer | `server/utils/pendingReferral.js` → `sendPendingInviteSMS()` | Placeholder copy (same wrong "reward waiting" framing as pre-fix email — fix separately) |

---

## Known gaps / queued fixes

- **Cashout received confirmation** (to referrer) — no email sent when referrer submits cashout. Admin gets notified; referrer gets nothing. Build alongside cashout approved/denied.
- **Cashout approved / denied** (to referrer) — `admin/cashouts.js` updates DB status and fires payout announcement but sends no email to the referrer. Referrer only finds out via the in-app payout popup. Email should be added.
- **SMS invite copy** — `sendPendingInviteSMS()` still says "you have a referral reward waiting." Fix copy to match the corrected email invite in a future session.
- **Credit attribution copy review** — `sendCreditAttributionEmail()` has a TODO for a brand review pass. Copy is functionally correct but hasn't been reviewed against brand guidelines.
- **Sender name on referrer.js / account.js system emails** — PIN reset, signup verification, booking request, account deletion all use `'Rooster Booster <noreply@roofmiles.com>'` as the from field. These should be migrated to the dynamic `COALESCE(email_sender_name, company_name, 'RoofMiles')` pattern used by campaigns and the missing-referral resolved notification.
