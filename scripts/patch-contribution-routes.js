const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

if (!text.includes('reverseContributionSchema')) {
  text = text.replace(
    "const welfareCreateSchema = z.object({\n  memberId: z.string().cuid(),\n  claimType: z.string().min(1),\n  reason: z.string().min(1),\n  amountRequested: z.number().positive(),\n  documents: z.array(z.string()).default([]),\n});",
    "const reverseContributionSchema = z.object({\n  reason: z.string().min(1),\n});\n\nconst welfareCreateSchema = z.object({\n  memberId: z.string().cuid(),\n  claimType: z.string().min(1),\n  reason: z.string().min(1),\n  amountRequested: z.number().positive(),\n  documents: z.array(z.string()).default([]),\n});"
  );
}

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'RECORD_CONTRIBUTIONS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to create contributions');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isFinanceManager(access)) {\n      throw new ForbiddenError('Only Treasurer or Admin can record contributions');\n    }"
);

text = text.replace(
  "    const payload = contributionCreateSchema.parse(req.body);\n    const contribution = await db.contribution.create({\n      data: {\n        organizationId: id,\n        memberId: payload.memberId,\n        amount: payload.amount,\n        contributionType: payload.contributionType as any,\n        paymentMethod: payload.paymentMethod as any,\n        transactionRef: payload.reference,\n        status: payload.status as any,\n        paidDate: payload.paidAt ? new Date(payload.paidAt) : undefined,\n        dueDate: payload.paidAt ? new Date(payload.paidAt) : new Date(),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'CREATE',\n      entityType: 'Contribution',\n      entityId: contribution.id,\n      newValues: contribution,\n    });\n\n    res.status(201).json({ contribution });",
  "    const payload = contributionCreateSchema.parse(req.body);\n    const contribution = await db.contribution.create({\n      data: {\n        organizationId: id,\n        memberId: payload.memberId,\n        amount: payload.amount,\n        contributionType: payload.contributionType,\n        period: payload.period,\n        paymentMethod: payload.paymentMethod as any,\n        reference: payload.reference,\n        transactionRef: payload.reference,\n        recordedById: (req.user.id as string),\n        status: payload.status as any,\n        paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),\n        paidDate: payload.paidAt ? new Date(payload.paidAt) : new Date(),\n        dueDate: payload.period ? new Date(`${payload.period}-01T00:00:00.000Z`) : new Date(),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'CREATE',\n      entityType: 'Contribution',\n      entityId: contribution.id,\n      newValues: contribution,\n    });\n\n    res.status(201).json({ contribution });"
);

text = text.replace(
  "    const contributions = await db.contribution.findMany({\n      where: { organizationId: id },\n      orderBy: { createdAt: 'desc' },\n    });",
  "    const contributions = await db.contribution.findMany({\n      where: { organizationId: id },\n      include: { member: true, recordedBy: true, reversedBy: true },\n      orderBy: { createdAt: 'desc' },\n    });"
);

text = text.replace(
  "    const [total, paid, pending] = await Promise.all([\n      db.contribution.count({ where: { organizationId: id } }),\n      db.contribution.count({ where: { organizationId: id, status: 'PAID' } }),\n      db.contribution.count({ where: { organizationId: id, status: 'PENDING' } }),\n    ]);\n\n    res.json({ total, paid, pending });",
  "    const [total, paid, pending, reversed] = await Promise.all([\n      db.contribution.count({ where: { organizationId: id } }),\n      db.contribution.count({ where: { organizationId: id, status: 'PAID' } }),\n      db.contribution.count({ where: { organizationId: id, status: 'PENDING' } }),\n      db.contribution.count({ where: { organizationId: id, status: 'REVERSED' } }),\n    ]);\n\n    res.json({ total, paid, pending, reversed });"
);

if (!text.includes("'/:id/contributions/:contributionId/reverse'")) {
  const insertAfter = "router.get(\n  '/:id/contributions/summary',";
  const reverseRoute = `router.post(\n  '/:id/contributions/:contributionId/reverse',\n  authenticate,\n  asyncHandler(async (req: Request, res: Response) => {\n    if (!req.user?.id) {\n      throw new BadRequestError('User not authenticated');\n    }\n\n    const { id, contributionId } = req.params as { id: string; contributionId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isFinanceManager(access)) {\n      throw new ForbiddenError('Only Treasurer or Admin can reverse contributions');\n    }\n\n    const payload = reverseContributionSchema.parse(req.body);\n    const existing = await db.contribution.findUnique({\n      where: { id: contributionId },\n    });\n\n    if (!existing || existing.organizationId !== id) {\n      throw new NotFoundError('Contribution not found');\n    }\n\n    if (existing.status === 'REVERSED') {\n      throw new BadRequestError('Contribution has already been reversed');\n    }\n\n    const reversed = await db.contribution.update({\n      where: { id: contributionId },\n      data: {\n        status: 'REVERSED' as any,\n        reverseReason: payload.reason,\n        reversedAt: new Date(),\n        reversedById: (req.user.id as string),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'UPDATE',\n      entityType: 'Contribution',\n      entityId: contributionId,\n      oldValues: existing,\n      newValues: reversed,\n      metadata: { reverseReason: payload.reason },\n    });\n\n    res.json({ contribution: reversed });\n  })\n);\n\n`;
  text = text.replace(insertAfter, reverseRoute + insertAfter);
}

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
