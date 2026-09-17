const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

text = text.replace(
  "    const payload = welfareCreateSchema.parse(req.body);\n    const claim = await db.welfareClaim.create({\n      data: {\n        organizationId: id,\n        requestedById: (req.user.id as string),\n        type: payload.claimType as any,\n        amountRequested: payload.amountRequested,\n        description: payload.reason,\n        supportingDocuments: payload.supportingDocument ? { file: payload.supportingDocument } : undefined,\n      },\n    });",
  "    const payload = welfareCreateSchema.parse(req.body);\n    const claim = await db.welfareClaim.create({\n      data: {\n        organizationId: id,\n        requestedById: (req.user.id as string),\n        memberId: payload.memberId,\n        type: payload.claimType as any,\n        claimType: payload.claimType,\n        amountRequested: payload.amountRequested,\n        reason: payload.reason,\n        description: payload.reason,\n        documents: payload.documents,\n        supportingDocuments: payload.documents.length ? payload.documents : undefined,\n      },\n    });"
);

text = text.replace(
  "    const { id } = req.params as { id: string };\n    await getOrganizationAccess(id, (req.user.id as string));\n\n    const claims = await db.welfareClaim.findMany({\n      where: { organizationId: id },\n      orderBy: { createdAt: 'desc' },\n    });",
  "    const { id } = req.params as { id: string };\n    await getOrganizationAccess(id, (req.user.id as string));\n\n    const claims = await db.welfareClaim.findMany({\n      where: { organizationId: id },\n      include: { requestedBy: true, reviewedBy: true },\n      orderBy: { createdAt: 'desc' },\n    });"
);

text = text.replace(
  "    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'APPROVE_WELFARE_CLAIMS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to approve welfare claims');\n    }",
  "    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can approve welfare claims');\n    }"
);

text = text.replace(
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });",
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        amountApproved: (await db.welfareClaim.findUnique({ where: { id: claimId } }))?.amountRequested,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });"
);

text = text.replace(
  "    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'APPROVE_WELFARE_CLAIMS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to reject welfare claims');\n    }",
  "    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can reject welfare claims');\n    }"
);

text = text.replace(
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'REJECTED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });",
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'REJECTED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });"
);

if (!text.includes("'/:id/welfare/claims/:claimId/pay'")) {
  const insertAfter = "router.patch(\n  '/:id/welfare/claims/:claimId/reject',";
  const paidRoute = `router.patch(\n  '/:id/welfare/claims/:claimId/pay',\n  authenticate,\n  asyncHandler(async (req: Request, res: Response) => {\n    if (!req.user?.id) {\n      throw new BadRequestError('User not authenticated');\n    }\n\n    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isFinanceManager(access)) {\n      throw new ForbiddenError('Only Treasurer or Admin can mark welfare claims as paid');\n    }\n\n    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });\n    if (!existing || existing.organizationId !== id) {\n      throw new NotFoundError('Welfare claim not found');\n    }\n\n    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {\n      throw new BadRequestError('Only approved welfare claims can be marked as paid');\n    }\n\n    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'PAID' as any,\n        paidAt: new Date(),\n        reviewedById: existing.reviewedById ?? (req.user.id as string),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'UPDATE',\n      entityType: 'WelfareClaim',\n      entityId: claimId,\n      oldValues: existing,\n      newValues: claim,\n      metadata: { paid: true },\n    });\n\n    res.json({ claim });\n  })\n);\n\n`;
  text = text.replace(insertAfter, paidRoute + insertAfter);
}

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
