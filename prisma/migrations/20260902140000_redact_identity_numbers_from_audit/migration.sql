-- Recursively replace historical national/document identifiers in audit JSON
-- with the final four characters. The helper is removed after the update.
CREATE OR REPLACE FUNCTION redact_identity_numbers(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(redact_identity_numbers(item)), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) AS items(item);
    RETURN result;
  ELSIF jsonb_typeof(value) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(
      CASE
        WHEN key = 'nationalId' THEN 'nationalIdLast4'
        WHEN key = 'documentNumber' THEN 'documentNumberLast4'
        ELSE key
      END,
      CASE
        WHEN key IN ('nationalId', 'documentNumber') THEN to_jsonb(right(value_text, 4))
        ELSE redact_identity_numbers(nested_value)
      END
    ), '{}'::jsonb)
    INTO result
    FROM jsonb_each(value) AS entries(key, nested_value)
    CROSS JOIN LATERAL (SELECT nested_value #>> '{}' AS value_text) AS scalar;
    RETURN result;
  END IF;
  RETURN value;
END;
$$;

UPDATE "audit_logs"
SET "oldValues" = redact_identity_numbers("oldValues"),
    "newValues" = redact_identity_numbers("newValues"),
    "metadata" = redact_identity_numbers("metadata")
WHERE "oldValues" IS NOT NULL OR "newValues" IS NOT NULL OR "metadata" IS NOT NULL;

DROP FUNCTION redact_identity_numbers(jsonb);
