-- Add the organization foundation tables used by /api/v1/organizations.
-- This is intentionally narrow and avoids applying the destructive parts of a full schema diff.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationStatus') THEN
    CREATE TYPE "OrganizationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationMemberStatus') THEN
    CREATE TYPE "OrganizationMemberStatus" AS ENUM (
      'INVITATION_SENT',
      'PENDING_APPROVAL',
      'PENDING',
      'ACTIVE',
      'SUSPENDED',
      'EXITED',
      'ARCHIVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organizationType" TEXT NOT NULL,
  "chamaType" TEXT,
  "enabledModules" JSONB,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_roles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" "MemberRole" NOT NULL,
  "label" TEXT NOT NULL,
  "permissions" JSONB,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT,
  "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'PENDING',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,

  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "organization_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_permissions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_permissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_wallets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_wallets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_settings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contributionRules" JSONB,
  "welfareRules" JSONB,
  "loanRules" JSONB,
  "notificationRules" JSONB,
  "securityRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organization_audit_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "userId" TEXT,
  "oldValues" JSONB,
  "newValues" JSONB,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX IF NOT EXISTS "organizations_organizationType_idx" ON "organizations"("organizationType");
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "organizations_createdById_idx" ON "organizations"("createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_roles_organizationId_name_key" ON "organization_roles"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "organization_roles_organizationId_idx" ON "organization_roles"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "organization_members_organizationId_status_idx" ON "organization_members"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "organization_members_userId_status_idx" ON "organization_members"("userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_permissions_organizationId_key_key" ON "organization_permissions"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "organization_permissions_organizationId_idx" ON "organization_permissions"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_wallets_organizationId_key" ON "organization_wallets"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_settings_organizationId_key" ON "organization_settings"("organizationId");

CREATE INDEX IF NOT EXISTS "organization_audit_logs_organizationId_idx" ON "organization_audit_logs"("organizationId");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_action_idx" ON "organization_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_entityType_idx" ON "organization_audit_logs"("entityType");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_entityId_idx" ON "organization_audit_logs"("entityId");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_userId_idx" ON "organization_audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_createdAt_idx" ON "organization_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "organization_audit_logs_organizationId_entityType_entityId_idx" ON "organization_audit_logs"("organizationId", "entityType", "entityId");
