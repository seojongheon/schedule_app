# Authentication Provider Operations

## Scope

This runbook covers the Google and Kakao custom OIDC providers and the Naver custom OAuth2 provider. Provider email is optional and never proves ownership of an existing service account. Identity linking is explicit and requires recent authentication.

## Activation checklist

1. Register the production callback URL exactly as `/auth/callback` on the canonical HTTPS origin.
2. Store provider client secrets only in the deployment secret manager.
3. Configure `AUTH_CUSTOM_*_PROVIDER` and enable one provider at a time with `AUTH_*_ENABLED=true`.
4. Confirm state, PKCE, callback origin, continuation allowlist, and link-mode recent-authentication tests.
5. Test new sign-in, cancelled consent, missing provider email, duplicate service email, explicit linking, unlinking, and provider outage.
6. Record activation time, operator, provider application identifier, test evidence, and rollback decision.

## Failure response

- Disable only the affected provider flag; keep email authentication available.
- Do not retry callbacks or link identities manually from provider email claims.
- Emit `auth_provider_failed` with provider name, request ID, bounded error code, and no tokens or personal values.
- Escalate sustained callback failures or signature-validation failures to the incident process.

## Secret rotation

Create the replacement secret, deploy it through the secret manager, run the callback test matrix, then revoke the previous secret. Never place credentials in tickets, logs, screenshots, or repository files.

## Readiness evidence

This document defines the procedure only. A provider is production-ready only after its enabled hosted flow has recorded browser, callback, linking, failure, and rollback evidence. Unit tests or a disabled configuration are not live-provider verification.
