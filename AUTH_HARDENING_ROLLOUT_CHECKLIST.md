# Auth Hardening Rollout Checklist

Use this checklist for phased rollout and production validation gates.

## Phase 0: Secrets Containment

- [ ] Rotate Supabase service role, anon, and Resend keys.
- [ ] Confirm no hardcoded secrets in repository (`rg` scan clean).
- [ ] Verify edge-function secrets are set in Supabase (`supabase secrets list`).
- [ ] Validate privileged functions are not deployed with `--no-verify-jwt`.

Gate: deployment blocked unless all critical secrets are rotated and old keys invalidated.

## Phase 1: Edge Function Auth Hardening

- [ ] `admin-user-ops` denies out-of-scope manager requests.
- [ ] `send-invitation-email` derives actor from JWT and generates links server-side.
- [ ] `send-notification-email` derives recipients from DB, not caller payload.
- [ ] `send-password-reset-email` returns generic responses and enforces redirect allowlist.

Gate: run `npm run test` and manually verify invitation/resend/reset flows in staging.

## Phase 2: SQL/RLS Hardening

- [ ] Apply `030_auth_hardening.sql`.
- [ ] Apply `031_public_share_capability_rpcs.sql`.
- [ ] Apply `032_role_semantics_unify.sql`.
- [ ] Run SQL policy checks: `npm run test:sql-authz`.

Gate: SQL checks pass and no policy drift detected.

## Phase 3: Public Share Cutover

- [ ] Public process page uses `get_public_process_bundle`.
- [ ] Public org page uses `get_public_org_share_bundle`.
- [ ] Verify expired/revoked links return the same generic "not available" UX.
- [ ] Verify `include_contact_info=false` masks contact data in payload and UI.

Gate: public share smoke tests pass for both process and org-chart links.

## Phase 4: Observability

- [ ] Edge logs include `requestId`, `actorId`, action, and decision reason.
- [ ] Frontend error messages include mapped authz reason + request reference ID.
- [ ] Support runbook includes how to trace denied actions by request ID.

Gate: one denied-action test is traceable end-to-end in logs.

## Phase 5: Regression Enforcement

- [ ] `authz-regression-matrix.json` updated with current policy decisions.
- [ ] Vitest authz suite passes in CI.
- [ ] SQL authz job configured with `DATABASE_URL` secret in CI.

Gate: CI red if authz matrix/tests regress.
