-- Apply the DRAFT default after the enum value has been committed.

ALTER TABLE "chamas"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
