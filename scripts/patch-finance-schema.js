const fs = require('fs');
const path = 'G:/chama/prisma/schema.prisma';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

text = text.replace(
`model Contribution {
  id             String   @id @default(cuid())
  chamaId        String
  organizationId String?
  memberId       String
  amount         Decimal  @db.Decimal(10, 2)
  dueDate        DateTime
  paidDate       DateTime?
  status         ContributionStatus @default(PENDING)
  paymentMethod  PaymentMethod?
  transactionRef String?
  penalties      Decimal  @default(0) @db.Decimal(10, 2)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  chama          Chama @relation(fields: [chamaId], references: [id], onDelete: Cascade)
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  member         User  @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([dueDate])
  @@index([chamaId, status])
  @@index([organizationId, status])
  @@index([memberId, status])
  @@index([chamaId, dueDate])
  @@index([organizationId, dueDate])
  @@index([transactionRef])
  @@map("contributions")
}
`,
`model Contribution {
  id             String   @id @default(cuid())
  chamaId        String
  organizationId String?
  memberId       String
  amount         Decimal  @db.Decimal(10, 2)
  contributionType String?
  period         String?
  dueDate        DateTime
  paidDate       DateTime?
  paidAt         DateTime?
  status         ContributionStatus @default(PENDING)
  paymentMethod  PaymentMethod?
  reference      String?
  transactionRef String?
  recordedById   String?
  reversedById   String?
  reverseReason  String?
  reversedAt     DateTime?
  penalties      Decimal  @default(0) @db.Decimal(10, 2)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  chama          Chama @relation(fields: [chamaId], references: [id], onDelete: Cascade)
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  member         User  @relation(fields: [memberId], references: [id], onDelete: Cascade)
  recordedBy     User? @relation("ContributionRecordedBy", fields: [recordedById], references: [id], onDelete: SetNull)
  reversedBy     User? @relation("ContributionReversedBy", fields: [reversedById], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([dueDate])
  @@index([chamaId, status])
  @@index([organizationId, status])
  @@index([memberId, status])
  @@index([chamaId, dueDate])
  @@index([organizationId, dueDate])
  @@index([transactionRef])
  @@index([reference])
  @@index([recordedById])
  @@map("contributions")
}
`
);

text = text.replace(
`model WelfareClaim {
  id               String   @id @default(cuid())
  organizationId   String
  requestedById    String
  type             WelfareClaimType
  amountRequested  Decimal  @db.Decimal(14, 2)
  amountApproved   Decimal? @db.Decimal(14, 2)
  status           WelfareClaimStatus @default(PENDING)
  description      String
  supportingDocuments Json?
  reviewedById     String?
  reviewedAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  requestedBy      User @relation("WelfareClaimRequestedBy", fields: [requestedById], references: [id], onDelete: Cascade)
  reviewedBy       User? @relation("WelfareClaimReviewedBy", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([organizationId, status])
  @@index([requestedById, status])
  @@map("welfare_claims")
}
`,
`model WelfareClaim {
  id               String   @id @default(cuid())
  organizationId   String
  requestedById    String
  memberId         String?
  type             WelfareClaimType
  claimType        String?
  amountRequested  Decimal  @db.Decimal(14, 2)
  amountApproved   Decimal? @db.Decimal(14, 2)
  reason           String?
  status           WelfareClaimStatus @default(PENDING)
  description      String
  documents        Json?
  supportingDocuments Json?
  reviewedById     String?
  reviewedAt       DateTime?
  paidAt           DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  requestedBy      User @relation("WelfareClaimRequestedBy", fields: [requestedById], references: [id], onDelete: Cascade)
  reviewedBy       User? @relation("WelfareClaimReviewedBy", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([organizationId, status])
  @@index([requestedById, status])
  @@map("welfare_claims")
}
`
);

text = text.replace(
`enum ContributionStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
}
`,
`enum ContributionStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
  REVERSED
}
`
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
