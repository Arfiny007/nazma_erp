# CURRENT_PHASE.md



Current Phase:



PHASE_11D_ENTERPRISE_NOTIFICATION_CERTIFICATION



Status:



COMPLETE



---



# PHASE_11D_ENTERPRISE_NOTIFICATION_CERTIFICATION



Status: COMPLETE (2026-07-13)



## Objectives



Read-only certification of PHASE_11A–11C notification infrastructure.



* `src/lib/certification/notifications/` — Rules 1–12

* `runNotificationCertification()` / `runNotificationCertificationWithReport()`

* `NotificationAuditCoverageReport` — covered / partial / missing

* ADR-056



## Completion Criteria



* NotificationDeliveryAttempt append-only verified: ✓

* Queue lifecycle transitions certified: ✓

* Retry policy (+5m, +30m, permanent FAILED) verified: ✓

* Auth provider isolation scan clean: ✓

* Authentication audit chains verified: ✓

* Notification security (disabled/archived, resend permissions) verified: ✓

* Queue safety (SKIP LOCKED, stale recovery, idempotency) verified: ✓

* SMTP abstraction and provider factory certified: ✓

* Financial boundary scan clean: ✓

* Ten notification audit actions covered: ✓

* Architecture import boundary scan clean: ✓

* Performance structural audit: ✓

* `phase11dApproved: true`: ✓

* `notification-certification.test.ts` — 21 tests: ✓

* Governance docs + ADR-056: ✓



## Explicitly NOT Changed



* posting-service, ledger, due engine, territory RBAC, dashboard

* notification-service, auth-notifications, queue worker (PHASE_11A–11C unchanged)

* SMTP deployment / cron scheduling



## Next Phase



**PHASE_12** development may proceed or **Dashboard Exports**



---



# PHASE_11C_ENTERPRISE_NOTIFICATION_DELIVERY_QUEUE_ENGINE



Status: COMPLETE (2026-07-13)



## Objectives



Production-ready notification delivery infrastructure.



* SMTP provider abstraction (`SmtpNotificationProvider` + `ConsoleEmailProvider` fallback)

* Database-backed queue worker with `FOR UPDATE SKIP LOCKED` batch claiming

* Retry scheduling (+5m, +30m) via `nextRetryAt`

* Operations UI — queue metrics, delivery health, Super Admin controls

* Background script `scripts/process-notifications.ts`

* ADR-055



## Completion Criteria



* Prisma additive fields + indexes + `NotificationQueueConfig`: ✓

* Provider factory (env-driven SMTP, swappable): ✓

* Worker: `processPendingNotifications`, batch claim, concurrent-safe: ✓

* Auth flows queue-only (no direct provider calls): ✓

* Server actions: process queue, metrics, retry failed, pause: ✓

* Permission `notifications:manage` — Super_Admin only: ✓

* Audit events: `NOTIFICATION_PROCESSING_STARTED`, `NOTIFICATION_PROVIDER_*`, `NOTIFICATION_QUEUE_PROCESSED`, `NOTIFICATION_BATCH_RETRIED`: ✓

* `notification-worker.test.ts` + `notification-queue.test.ts`: ✓

* Governance docs + ADR-055: ✓



## Explicitly NOT Changed



* posting-service, ledger, due engine, territory RBAC, dashboard

* authentication token security, certification modules

* SMS / push / notification center UI



## Next Phase



**PHASE_11D — Notification Certification** or **Dashboard Exports**



---



# PHASE_11B_ENTERPRISE_AUTHENTICATION_NOTIFICATION_INTEGRATION



Status: COMPLETE (2026-07-13)



## Objectives



Wire certified authentication flows into PHASE_11A notification infrastructure.



* `auth-notifications.ts` + `auth-template-mappers.ts`

* Activation + password reset notification dispatch

* Admin resend (Super_Admin) on `/settings/users`

* ADR-054



## Completion Criteria



* `createUserRecord` dispatches activation notification: ✓

* `requestPasswordReset` dispatches reset notification: ✓

* All delivery via `createNotification` → `queueNotification` → `sendNotification`: ✓

* Audit sequences verified: ✓

* Admin resend with `retryNotification` for failed deliveries: ✓

* `auth-notification.test.ts` — 9 tests: ✓

* Governance docs + ADR-054: ✓



## Explicitly NOT Changed



* posting-service, ledger, due engine, territory RBAC, dashboard

* notification-service lifecycle

* SMTP/SMS delivery



## Next Phase



**PHASE_11C — SMTP Provider** or **Dashboard Exports**



---



# PHASE_11A_ENTERPRISE_NOTIFICATION_FOUNDATION



Status: COMPLETE (2026-07-13)



## Objectives



Provider-agnostic notification infrastructure for future email/SMS consumers.



* `src/lib/notifications/` — service, provider, templates, audit, queue

* `Notification` / `NotificationTemplate` / `NotificationDeliveryAttempt` models

* `ConsoleEmailProvider` — log-only delivery (no SMTP)

* `/settings/notifications` — read-only console

* ADR-053



## Completion Criteria



* Prisma enums + models + migration: ✓

* Lifecycle transitions guarded in service layer: ✓

* Bilingual template seeds (en/bn): ✓

* Audit integration (`NOTIFICATION_*` actions): ✓

* Permissions (`notifications:view/create/retry`) — Super_Admin + Accounts: ✓

* `notification.test.ts` — 12 tests: ✓

* Governance docs + ADR-053: ✓



## Explicitly NOT Changed



* posting-service, due engine, territory RBAC engines, dashboard, financial engines

* Authentication flows and certifications

* Real email/SMS delivery



## Next Phase



**PHASE_11B — Email Integration** or **PHASE_11C — SMS Provider**



---



# PHASE_10D_ENTERPRISE_AUTHENTICATION_CERTIFICATION



Status: COMPLETE (2026-07-13)



## Objectives



Read-only certification of PHASE_10C authentication and activation expansion.



* `src/lib/certification/auth/` — Rules 1–12

* `runAuthenticationCertification()` / `runAuthenticationCertificationWithReport()`

* `AuthenticationAuditCoverageReport` — covered / partial / missing

* ADR-052



## Completion Criteria



* Password bcrypt enforcement verified: ✓

* Token hashing, expiry, replay protection verified: ✓

* mustChangePassword middleware enforcement verified: ✓

* Activation and reset flow certified: ✓

* Privilege escalation blocked: ✓

* Five authentication audit writers covered: ✓

* Financial boundary scan clean: ✓

* Architecture import scan clean: ✓

* Performance structural audit: ✓

* `phase10dApproved: true`: ✓

* `authentication-certification.test.ts` — 24 tests: ✓

* Governance docs + ADR-052: ✓



## Explicitly NOT Changed



* posting-service, due engine, territory RBAC engines, dashboard, financial engines

* Auth service, UI, permissions, schema (PHASE_10C unchanged)

* Email/SMS delivery



## Next Phase



**Email Integration** or **Dashboard Exports**



---



# PHASE_10C_ENTERPRISE_AUTHENTICATION_ACTIVATION_EXPANSION



Status: COMPLETE (2026-07-13)



## Objectives



Enterprise authentication expansion — login enforcement, activation tokens, password change gating, password reset foundation.



* `mustChangePassword` enforced at login + middleware

* `UserActivationToken` issuance on user provisioning

* `UserPasswordResetToken` additive model + reset foundation

* Routes: `/auth/activate`, `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`

* Server actions: `activateUserAccount`, `changePassword`, `requestPasswordReset`, `resetPassword`

* Audit writers: `USER_PASSWORD_CHANGED`, `USER_PASSWORD_RESET_REQUESTED`, `USER_PASSWORD_RESET_COMPLETED`, `USER_ACTIVATION_STARTED`, `USER_ACTIVATION_COMPLETED`

* ADR-051



## Completion Criteria



* `mustChangePassword` redirect at login: ✓

* Middleware blocks dashboard/settings/reports when flag set: ✓

* Activation tokens hashed, expiring, one-time-use: ✓

* Password reset foundation (no email): ✓

* Bilingual auth UI components: ✓

* `authentication-expansion.test.ts`: ✓

* Governance docs + ADR-051: ✓



## Explicitly NOT Changed



* posting-service, due engine, territory RBAC engines, dashboard, financial engines

* RBAC permission matrix, role system



## Next Phase



**PHASE_10D — Enterprise Authentication Certification** ✓



---



# PHASE_10B_ENTERPRISE_USER_MANAGEMENT_CERTIFICATION



Status: COMPLETE (2026-07-13)



## Objectives



Read-only certification of PHASE_10A user management before activation UX.



* `src/lib/certification/users/` — Rules 1–12

* `runUserCertification()` / `runUserCertificationWithReport()`

* `UserAuditCoverageReport` — covered / partial / missing

* ADR-050



## Completion Criteria



* Super Admin authority verified: ✓

* Manager / SR / Accounts isolation verified: ✓

* Privilege escalation blocked: ✓

* Lifecycle state machine certified: ✓

* Territory leakage scan clean: ✓

* Financial boundary scan clean: ✓

* Architecture import scan clean: ✓

* Performance structural + live audit: ✓

* `phase10cApproved: true`: ✓

* `user-certification.test.ts` — 20 tests: ✓

* Governance docs + ADR-050: ✓



## Explicitly NOT Changed



* posting-service, due engine, territory RBAC engines, dashboard, financial engines, audit export engine

* User service, UI, permissions, schema



## Next Phase



**PHASE_10C — User Activation UX** ✓



---



# PHASE_10A_ENTERPRISE_USER_MANAGEMENT_FOUNDATION



Status: COMPLETE (2026-07-13)



## Objectives



Enterprise user provisioning foundation with lifecycle state machine, granular RBAC, territory-scoped manager access, and audit writers closing ADR-047 gaps.



* `UserLifecycleStatus` enum + additive Prisma models (`UserProfile`, `UserInvitation`, `UserActivationToken`)

* `src/lib/users/` — lifecycle, service, validation, audit, password helpers

* Server actions: `createUser`, `updateUser`, `activateUser`, `disableUser`, `listUsers`, `getUser`, `searchUsers`

* UI: `/settings/users` — table, filters, details panel, create/disable dialogs

* Permissions: `users:view`, `users:create`, `users:update`, `users:disable`, `users:activate`

* Audit writers: `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`

* ADR-049



## Completion Criteria



* Additive schema migration (no destructive changes): ✓

* Super Admin full lifecycle control: ✓

* Manager limited SR draft/create in territories: ✓

* Accounts read-only visibility: ✓

* SR self-profile via `getUser`: ✓

* Territory scope via `buildTerritoryScope()`: ✓

* Temporary password generation (no email/OTP): ✓

* `user-management.test.ts` — 11 tests: ✓

* Governance docs + ADR-049: ✓

* `npm run build` — succeeds: ✓



## Explicitly NOT Changed



* posting-service, due engine, territory RBAC engines, dashboard, financial engines, audit export engine

* Auth login flow, email sending, OTP, password reset UI



## Next Phase



**PHASE_10C — User Activation UX** ✓



---

