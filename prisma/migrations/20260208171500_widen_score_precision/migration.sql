-- Widen score precision to support 0-100 scale values.
ALTER TABLE "chama_memberships"
  ALTER COLUMN "reliabilityScore" TYPE DECIMAL(5,2);

ALTER TABLE "loans"
  ALTER COLUMN "riskScore" TYPE DECIMAL(5,2);
