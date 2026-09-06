const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
"function isWelfareApprover(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {\n  const roleName = ((membership.role as any)?.name || '') as string;\n  return isOwnerLike(roleName) || roleName === 'CHAIR' || roleName === 'SECRETARY';\n}",
"function isWelfareApprover(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {\n  const roleName = ((membership.role as any)?.name || '') as string;\n  return isOwnerLike(roleName) || roleName === 'CHAIR';\n}"
);

text = text.replace(
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can approve welfare claims');\n    }\n\n    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        amountApproved: (await db.welfareClaim.findUnique({ where: { id: claimId } }))?.amountRequested,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });",
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can approve welfare claims');\n    }\n\n    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });\n    if (!existing || existing.organizationId !== id) {\n      throw new NotFoundError('Welfare claim not found');\n    }\n\n    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        amountApproved: existing.amountRequested,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });"
);

text = text.replace(
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isFinanceManager(access)) {\n      throw new ForbiddenError('Only Treasurer or Admin can mark welfare claims as paid');\n    }\n\n    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });",
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isFinanceManager(access)) {\n      throw new ForbiddenError('Only Treasurer or Admin can mark welfare claims as paid');\n    }\n\n    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });"
);

text = text.replace(
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can reject welfare claims');\n    }\n\n    const claim = await db.welfareClaim.update({\n      where: { id: claimId },",
"    const { id, claimId } = req.params as { id: string; claimId: string };\n    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!isWelfareApprover(access)) {\n      throw new ForbiddenError('Only Chairperson or Admin can reject welfare claims');\n    }\n\n    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });\n    if (!existing || existing.organizationId !== id) {\n      throw new NotFoundError('Welfare claim not found');\n    }\n\n    const claim = await db.welfareClaim.update({\n      where: { id: claimId },"
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
