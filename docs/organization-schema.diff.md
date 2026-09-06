# Organization Schema Diff

This file shows the Prisma direction for converting the current `Chama`-centric schema into an `Organization`-centric one.

The current schema in [`prisma/schema.prisma`](/G:/chama/prisma/schema.prisma) keeps the existing `Chama` tables for backward compatibility. The diff below is the intended structural replacement.

## 1. Root entity rename

Replace:

```prisma
model Chama {
  id                    String            @id @default(cuid())
  name                  String
  type                  ChamaType
  description           String
  maxMembers            Int
  contributionAmount    Decimal           @db.Decimal(10, 2)
  contributionFrequency Frequency
  currency              String            @default("KES")
  visibility            Visibility        @default(PUBLIC)
  shareableLink         String            @unique
  qrCode                String
  status                ChamaStatus       @default(ACTIVE)
  settings              Json
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  memberships   ChamaMembership[]
  contributions Contribution[]
  loans         Loan[]
  transactions  Transaction[]
  disputes      Dispute[]
  votes         Vote[]
  notifications Notification[]
  auditLogs     AuditLog[]
}
```

With:

```prisma
model Organization {
  id               String             @id @default(cuid())
  name             String
  organizationType OrganizationType
  slug             String             @unique
  description      String?
  status           OrganizationStatus @default(ACTIVE)
  createdBy        String
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  creator          User               @relation(fields: [createdBy], references: [id])
  members          OrganizationMember[]
  roles            OrganizationRole[]
  wallets          OrganizationWallet[]
  settings         OrganizationSettings?
  committees       OrganizationCommittee[]
  branches         OrganizationBranch[]

  contributions    Contribution[]
  loans            Loan[]
  welfareClaims    WelfareClaim[]
  meetings         Meeting[]
  votes            Vote[]
  notifications    Notification[]
  auditLogs        OrganizationAuditLog[]

  @@index([organizationType])
  @@index([status])
  @@index([createdBy])
  @@map("organizations")
}
```

## 2. Member mapping

Replace:

```prisma
model ChamaMembership {
  chamaId          String
  userId           String
  role             MemberRole      @default(MEMBER)
  status           MemberStatus    @default(PENDING)
  reliabilityScore Decimal         @default(0) @db.Decimal(5, 2)
  joinedAt         DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  chama Chama @relation(fields: [chamaId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([chamaId, userId])
  @@map("chama_memberships")
}
```

With:

```prisma
model OrganizationMember {
  organizationId   String
  userId           String
  roleId           String?
  status           OrganizationMemberStatus @default(PENDING)
  reliabilityScore Decimal                 @default(0) @db.Decimal(5, 2)
  joinedAt         DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role             OrganizationRole? @relation(fields: [roleId], references: [id])

  @@id([organizationId, userId])
  @@index([status])
  @@index([roleId])
  @@index([userId, status])
  @@index([organizationId, status])
  @@map("organization_members")
}
```

## 3. Finance mapping

Replace `chamaId` with `organizationId` in:

```prisma
model Contribution {
  organizationId  String
  memberId        String
  ...
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model Loan {
  organizationId  String
  borrowerId      String
  ...
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

## 4. Governance mapping

Replace `chamaId` with `organizationId` in:

```prisma
model Vote {
  organizationId  String
  ...
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

Add welfare-specific and meeting-specific models:

```prisma
model WelfareClaim {
  id              String   @id @default(cuid())
  organizationId  String
  memberId        String
  claimType       String
  amountRequested Decimal  @db.Decimal(10, 2)
  amountApproved  Decimal? @db.Decimal(10, 2)
  status          String
  description     String
  evidence        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  member          User         @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([organizationId, status])
  @@index([memberId, status])
  @@map("welfare_claims")
}

model Meeting {
  id              String   @id @default(cuid())
  organizationId  String
  title           String
  description     String?
  meetingDate     DateTime
  status          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, meetingDate])
  @@map("meetings")
}
```

## 5. Notifications and audit logs

Replace:

```prisma
model Notification {
  chamaId      String?
  ...
  chama        Chama? @relation(fields: [chamaId], references: [id], onDelete: Cascade)
}

model AuditLog {
  chamaId    String?
  ...
  chama      Chama? @relation(fields: [chamaId], references: [id])
}
```

With:

```prisma
model Notification {
  organizationId  String?
  ...
  organization    Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model OrganizationAuditLog {
  id              String   @id @default(cuid())
  organizationId  String
  action          AuditAction
  entityType      String
  entityId        String
  userId          String?
  oldValues       Json?
  newValues       Json?
  metadata        Json?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user            User?        @relation(fields: [userId], references: [id])

  @@index([organizationId, createdAt])
  @@index([organizationId, entityType, entityId])
  @@map("organization_audit_logs")
}
```

## 6. New enums

```prisma
enum OrganizationType {
  CHAMA
  WELFARE
  SACCO
  INVESTMENT_CLUB
  FAMILY_GROUP
  CHURCH_GROUP
  YOUTH_GROUP
  STAFF_WELFARE
  ESTATE_ASSOCIATION
}

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum OrganizationMemberStatus {
  PENDING
  ACTIVE
  SUSPENDED
  EXITED
}

enum OrganizationRoleName {
  FOUNDER
  CHAIR
  TREASURER
  SECRETARY
  AUDITOR
  MEMBER
}
```

## 7. Existing tables to preserve during migration

Keep temporarily:

```prisma
model Chama
model ChamaMembership
```

Then backfill them into:

```prisma
model Organization
model OrganizationMember
```

## 8. Migration order

1. Add new `Organization*` models.
2. Add `organizationId` foreign keys to finance/governance tables.
3. Backfill existing `Chama` rows into `Organization`.
4. Backfill memberships into `OrganizationMember`.
5. Switch services/routes to read from `Organization`.
6. Deprecate `Chama` tables after compatibility is complete.

