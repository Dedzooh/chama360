-- Existing TOTP secrets were stored as plaintext and cannot be trusted to have
-- remained confidential. Require re-enrollment rather than re-encrypting them.
UPDATE "users"
SET "mfaEnabled" = false,
    "mfaSecret" = NULL
WHERE "mfaSecret" IS NOT NULL;
