# Android direct distribution

CHAMAZ360 Android releases are distributed as signed APKs from the official HTTPS website.

## One-time setup

1. Create a production Android keystore and keep encrypted offline backups.
2. Copy `client/android/keystore.properties.example` to `client/android/keystore.properties` and enter the real values. Neither file nor the keystore may be committed.
3. Confirm the release build script embeds `https://chamaz360.co.ke/api/v1` for both `VITE_API_URL` and `VITE_ANDROID_API_URL`.
4. Host the final signed APK at a stable HTTPS URL on the official domain.
5. Configure the backend mobile-release environment variables documented in `.env.example`.

## Release procedure

1. Increase `versionCode`, `versionName`, and the client package version.
2. Build and sign the release APK with `npm --prefix client run mobile:release`. This command uses the fixed production API; emulator and LAN settings remain confined to development builds.
3. Generate metadata:

   ```text
   npm --prefix client run mobile:release-metadata -- client/android/app/build/outputs/apk/release/app-release.apk
   ```

4. Upload the APK without changing it after calculating the checksum.
5. Copy the generated SHA-256, byte size, and release timestamp into the backend production environment. Set the version, minimum supported version, HTTPS download URL, force-update flag, and release notes.
6. Run `npm run release:check` and deploy the backend metadata.
7. Open `/download` on the production website and verify the version, size, checksum, and APK URL.
8. Download the hosted file and independently compare its SHA-256 with the published value.

Android verifies that upgrades use the same signing certificate as the installed app. Never rotate or lose the release keystore without a documented migration plan.

## Session token storage

The Android app stores access and refresh tokens in private application preferences encrypted with AES-GCM. The encryption key is generated and retained by Android Keystore and is not exported to JavaScript. Browser sessions use `sessionStorage` and end when the browser session closes. Legacy `localStorage` token keys and the former Zustand authentication snapshot are removed automatically during restoration.

Uninstalling the Android app removes the encrypted token data. If Android invalidates the Keystore key, restoration fails closed, the unreadable encrypted values are cleared, and the user must sign in again.

The server stores only SHA-256 fingerprints of refresh tokens, not reusable token values. Active Redis sessions are indexed per user so password changes, account deletion, and “log out all devices” remove access sessions immediately without a broad Redis key scan. The `20260902120000_hash_refresh_tokens` migration intentionally deletes legacy refresh tokens, and the versioned Redis session namespace invalidates legacy access sessions, so every existing user must sign in again after this deployment.

The Profile and Security page lists every live indexed device session, ordered by recent activity, and identifies the current device. Missing, expired, or incorrectly associated Redis records are excluded and removed from the user’s session index during listing.

Users can sign out an individual non-current device. The server validates session ownership before deletion, and removing one session does not revoke unrelated devices. The selected device’s refresh token becomes unusable immediately because refresh verification requires its bound Redis session to remain live. The current device must use the normal logout action.

MFA enrollment uses RFC 6238-compatible TOTP with a 30-second period, six digits, SHA-1, and a one-period clock-drift allowance. Enabling MFA requires scanning the returned `otpauth://` QR code and confirming a current code in a second request; disabling it also requires a current code. Pending enrollment secrets expire from Redis after ten minutes. Login challenges are invalidated after five bad codes, and an accepted code cannot be replayed during its validity window.

Profile and Security provides the complete enrollment UI: QR scan, manual secret fallback, six-digit confirmation, and authenticated disablement. The setup secret remains only in component memory and the short-lived Redis enrollment record. Enabling or disabling MFA revokes all existing sessions and requires a fresh sign-in so an earlier session cannot retain outdated assurance.

Successful enrollment produces ten single-use recovery codes with 64 bits of randomness each. Only user-bound SHA-256 fingerprints are stored in `mfa_recovery_codes`; plaintext codes are displayed once in component memory. A recovery code is atomically marked used before a session is created and cannot be replayed. Disabling MFA deletes all remaining recovery codes.

Persisted TOTP secrets use AES-256-GCM with a random nonce and the user ID as authenticated additional data. Production requires a dedicated `MFA_ENCRYPTION_KEY` containing 32 random bytes encoded as 64 hexadecimal characters; store and back it up in the deployment secret manager. The `20260902130000_encrypt_mfa_secrets` migration disables legacy plaintext MFA secrets, so previously enrolled users must enroll MFA again.

Each server-side session records whether MFA was actually completed. Sensitive-route middleware checks that assurance on the current session instead of trusting only the account-level MFA setting. Refresh tokens must remain bound to a live Redis session, and token rotation carries the MFA assurance forward only from that verified session.

For gradual adoption, high-risk financial actions require verified session assurance whenever the acting user has enabled MFA. This currently covers payment-request approval, contribution reversal, loan approval and disbursement, and welfare-claim approval and payout. Users who have not enrolled are not locked out during rollout; requiring MFA enrollment for privileged roles remains a deployment governance decision.

Those financial actions also use an atomic Redis-backed per-user, per-route limit of ten attempts per minute. Responses publish `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; blocked requests return HTTP 429 with `Retry-After`. Rate-limit keys use one-way fingerprints rather than raw user and route identifiers.

## Sensitive logging

HTTP access logs exclude request bodies, headers, query strings, and full URLs. Structured logging applies recursive redaction to credentials, tokens, secrets, national IDs, document images, email addresses, phone numbers, and postal addresses. KYC audit events retain verification metadata but exclude front and back document images.

KYC images are stored in the configured private S3-compatible bucket with AES-256 server-side encryption, or AWS KMS when `AWS_S3_KMS_KEY_ID` is configured. The bucket must have all public access blocked, object access logging enabled, TLS-only bucket policy, least-privilege application credentials, and a lifecycle policy consistent with the approved retention schedule. Full document numbers are not stored in the document table; the service stores a keyed SHA-256 digest and the final four characters. Use a dedicated, backed-up `DOCUMENT_HASH_SECRET` and do not reuse an application or JWT secret.

KYC audit payloads exclude full national IDs and document numbers, retaining only their final four characters for support correlation. The profile API also returns only a masked national ID. Migration `20260902140000_redact_identity_numbers_from_audit` recursively redacts historical identity-number fields from audit JSON.

Core user national IDs use a keyed SHA-256 fingerprint for duplicate detection and a separate final-four field for masked display. Migration `20260904100000_protect_core_national_ids` adds the protected fields and prevents new plaintext writes. After applying it, back up the database and run `npm run identity:backfill -- --apply`; the idempotent command fingerprints existing identifiers, clears the legacy values, verifies that none remain, and validates the database constraint. Production requires a dedicated `IDENTITY_HASH_SECRET`; losing or changing it breaks duplicate matching, so retain it in the secret manager and encrypted backups.

Deployment order for this migration is: configure `IDENTITY_HASH_SECRET`, stop application writes, back up the database, apply the Prisma migration, regenerate Prisma Client, run the identity backfill with `--apply`, verify its zero-remaining result, and only then start the new application version.

## Account deletion retention

`ACCOUNT_DELETION_GRACE_DAYS` intentionally has no default. When it is omitted, deletion requests disable accounts immediately but automated anonymization remains paused. Configure it only after the retention schedule has been approved. The anonymization worker removes core identity, authentication, notification, and stored KYC audit payloads while preserving pseudonymous financial and governance records that may be legally required.

Account deletion requires an authenticated session, the literal confirmation `DELETE`, and successful verification of the current password before any account or session state changes. Five failed password confirmations temporarily block further deletion attempts for 15 minutes without locking normal sign-in. The client clears the deletion password from component state after each submission attempt. A deletion reason remains optional.
