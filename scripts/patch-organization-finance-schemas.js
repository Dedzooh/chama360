const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

text = text.replace(
`const contributionCreateSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive(),
  contributionType: z.string().min(1),
  paymentMethod: z.string().min(1),
  reference: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REVERSED']).default('PENDING'),
  paidAt: z.string().datetime().optional(),
});`,
`const contributionCreateSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive(),
  contributionType: z.string().min(1),
  period: z.string().min(1).optional(),
  paymentMethod: z.string().min(1),
  reference: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REVERSED']).default('PAID'),
  paidAt: z.string().datetime().optional(),
});`
);

text = text.replace(
`const welfareCreateSchema = z.object({
  memberId: z.string().cuid(),
  claimType: z.string().min(1),
  reason: z.string().min(1),
  amountRequested: z.number().positive(),
  supportingDocument: z.string().optional(),
});`,
`const welfareCreateSchema = z.object({
  memberId: z.string().cuid(),
  claimType: z.string().min(1),
  reason: z.string().min(1),
  amountRequested: z.number().positive(),
  documents: z.array(z.string()).default([]),
});`
);

text = text.replace(
`function isOwnerLike(roleName: string) {
  return roleName === 'OWNER' || roleName === 'FOUNDER';
}`, 
`function isOwnerLike(roleName: string) {
  return roleName === 'OWNER' || roleName === 'FOUNDER' || roleName === 'ADMIN';
}

function isFinanceManager(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  return isOwnerLike((membership.role as any)?.name || '') || (membership.role as any)?.name === 'TREASURER';
}

function isWelfareApprover(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  const roleName = ((membership.role as any)?.name || '') as string;
  return isOwnerLike(roleName) || roleName === 'CHAIR' || roleName === 'SECRETARY';
}`
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
