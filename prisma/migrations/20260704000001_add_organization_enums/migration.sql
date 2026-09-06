-- Ensure organization enums exist in the target schema before the foundation
-- tables are created. The following migration's legacy pg_type check is not
-- schema-scoped, so it can incorrectly detect a type from another schema.
DO $$ BEGIN
  CREATE TYPE "OrganizationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationMemberStatus" AS ENUM (
    'INVITATION_SENT',
    'PENDING_APPROVAL',
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'EXITED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
