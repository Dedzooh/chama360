-- Remove identity-document image payloads from historical KYC audit JSON.
-- Document metadata is retained so the verification trail remains intelligible.
UPDATE "audit_logs" AS audit
SET "newValues" = jsonb_set(
  audit."newValues",
  '{documents}',
  COALESCE((
    SELECT jsonb_agg(
      (item.value - 'frontImage' - 'backImage') ||
      jsonb_build_object(
        'frontImageProvided', item.value ? 'frontImage',
        'backImageProvided', item.value ? 'backImage',
        'imagesExcludedFromAudit', true
      )
    )
    FROM jsonb_array_elements(audit."newValues"->'documents') AS item(value)
  ), '[]'::jsonb)
) - 'ipAddress' - 'userAgent'
WHERE audit."entityType" = 'KYC_DATA'
  AND jsonb_typeof(audit."newValues"->'documents') = 'array';

UPDATE "audit_logs" AS audit
SET "oldValues" = jsonb_set(
  audit."oldValues",
  '{documents}',
  COALESCE((
    SELECT jsonb_agg(
      (item.value - 'frontImage' - 'backImage') ||
      jsonb_build_object(
        'frontImageProvided', item.value ? 'frontImage',
        'backImageProvided', item.value ? 'backImage',
        'imagesExcludedFromAudit', true
      )
    )
    FROM jsonb_array_elements(audit."oldValues"->'documents') AS item(value)
  ), '[]'::jsonb)
) - 'ipAddress' - 'userAgent'
WHERE audit."entityType" = 'KYC_DATA'
  AND jsonb_typeof(audit."oldValues"->'documents') = 'array';
