const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

text = text.replace(
  "    const { id } = req.params as { id: string };\n    await getOrganizationAccess(id, (req.user.id as string));\n\n    const payload = welfareCreateSchema.parse(req.body);",
  "    const { id } = req.params as { id: string };\n    await getOrganizationAccess(id, (req.user.id as string));\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Closed organizations cannot accept new welfare claims');\n    }\n\n    const payload = welfareCreateSchema.parse(req.body);"
);

text = text.replace(
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });\n\n    res.json({ claim });",
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'APPROVED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'UPDATE',\n      entityType: 'WelfareClaim',\n      entityId: claimId,\n      newValues: claim,\n      metadata: { reviewedAction: 'APPROVED' },\n    });\n\n    res.json({ claim });"
);

text = text.replace(
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'REJECTED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });\n\n    res.json({ claim });",
  "    const claim = await db.welfareClaim.update({\n      where: { id: claimId },\n      data: {\n        status: 'REJECTED' as any,\n        reviewedById: (req.user.id as string),\n        reviewedAt: new Date(),\n      },\n    });\n\n    await writeOrganizationAudit({\n      organizationId: id,\n      userId: (req.user.id as string),\n      action: 'UPDATE',\n      entityType: 'WelfareClaim',\n      entityId: claimId,\n      newValues: claim,\n      metadata: { reviewedAction: 'REJECTED' },\n    });\n\n    res.json({ claim });"
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
