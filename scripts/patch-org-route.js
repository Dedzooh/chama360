const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const helper = [
  'async function updateOrganizationLifecycle(params: {',
  '  organizationId: string;',
  '  userId: string;',
  "  targetStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';",
  '}) {',
  '  const organization = await requireOrganizationStatus(params.organizationId);',
  '  const membership = await getOrganizationAccess(params.organizationId, params.userId);',
  '',
  '  if (!canManageOrganizationLifecycle(membership)) {',
  "    throw new ForbiddenError('Insufficient permissions to change organization lifecycle');",
  '  }',
  '',
  '  const allowedTransitions: Record<string, string[]> = {',
  "    DRAFT: ['ACTIVE'],",
  "    ACTIVE: ['SUSPENDED', 'CLOSED'],",
  "    SUSPENDED: ['ACTIVE', 'CLOSED'],",
  "    CLOSED: ['ARCHIVED'],",
  '    ARCHIVED: [],',
  '  };',
  '',
  '  if (!allowedTransitions[organization.status]?.includes(params.targetStatus)) {',
  "    throw new BadRequestError('Cannot transition organization from ' + organization.status + ' to ' + params.targetStatus);",
  '  }',
  '',
  '  const before = await db.organization.findUnique({ where: { id: params.organizationId } });',
  '  const updated = await db.organization.update({',
  '    where: { id: params.organizationId },',
  '    data: { status: params.targetStatus as any },',
  '  });',
  '',
  '  await writeOrganizationAudit({',
  '    organizationId: params.organizationId,',
  '    userId: params.userId,',
  "    action: 'UPDATE',",
  "    entityType: 'Organization',",
  '    entityId: params.organizationId,',
  '    oldValues: before,',
  '    newValues: updated,',
  '    metadata: { targetStatus: params.targetStatus },',
  '  });',
  '',
  '  return updated;',
  '}',
  '',
].join('\n');

if (!text.includes('async function updateOrganizationLifecycle')) {
  text = text.replace('async function writeOrganizationAudit(params: {', helper + 'async function writeOrganizationAudit(params: {');
}

const lifecycleRoutes = [
  'router.post(',
  "  '/:id/activate',",
  '  authenticate,',
  '  asyncHandler(async (req: Request, res: Response) => {',
  '    if (!req.user?.id) {',
  "      throw new BadRequestError('User not authenticated');",
  '    }',
  '',
  '    const { id } = req.params as { id: string };',
  '    const organization = await updateOrganizationLifecycle({',
  '      organizationId: id,',
  '      userId: req.user.id as string,',
  "      targetStatus: 'ACTIVE',",
  '    });',
  '',
  '    res.json({ organization });',
  '  })',
  ');',
  '',
  'router.post(',
  "  '/:id/suspend',",
  '  authenticate,',
  '  asyncHandler(async (req: Request, res: Response) => {',
  '    if (!req.user?.id) {',
  "      throw new BadRequestError('User not authenticated');",
  '    }',
  '',
  '    const { id } = req.params as { id: string };',
  '    const organization = await updateOrganizationLifecycle({',
  '      organizationId: id,',
  '      userId: req.user.id as string,',
  "      targetStatus: 'SUSPENDED',",
  '    });',
  '',
  '    res.json({ organization });',
  '  })',
  ');',
  '',
  'router.post(',
  "  '/:id/close',",
  '  authenticate,',
  '  asyncHandler(async (req: Request, res: Response) => {',
  '    if (!req.user?.id) {',
  "      throw new BadRequestError('User not authenticated');",
  '    }',
  '',
  '    const { id } = req.params as { id: string };',
  '    const organization = await updateOrganizationLifecycle({',
  '      organizationId: id,',
  '      userId: req.user.id as string,',
  "      targetStatus: 'CLOSED',",
  '    });',
  '',
  '    res.json({ organization });',
  '  })',
  ');',
  '',
  'router.post(',
  "  '/:id/archive',",
  '  authenticate,',
  '  asyncHandler(async (req: Request, res: Response) => {',
  '    if (!req.user?.id) {',
  "      throw new BadRequestError('User not authenticated');",
  '    }',
  '',
  '    const { id } = req.params as { id: string };',
  '    const organization = await updateOrganizationLifecycle({',
  '      organizationId: id,',
  '      userId: req.user.id as string,',
  "      targetStatus: 'ARCHIVED',",
  '    });',
  '',
  '    res.json({ organization });',
  '  })',
  ');',
  '',
].join('\n');

if (!text.includes("'/:id/activate'")) {
  text = text.replace("router.delete(\n  '/:id',", lifecycleRoutes + "router.delete(\n  '/:id',");
}

text = text.replace(
  '      newValues: {\n        name: organization.name,\n        organizationType: organization.organizationType,\n      },',
  '      newValues: {\n        name: organization.name,\n        organizationType: organization.organizationType,\n        chamaType: (organization as any).chamaType,\n        enabledModules: (organization as any).enabledModules,\n      },'
);

text = text.replace(
  "    res.json({\n      organization: await db.organization.findUnique({\n        where: { id },\n        include: {\n          wallet: true,\n          settings: true,\n          members: {\n            include: {\n              user: true,\n              role: true,\n            },\n          },\n        },\n      }),\n      myRole: access.role?.label ?? 'Member',\n    });",
  "    const organizationRecord = await db.organization.findUnique({\n      where: { id },\n      include: {\n        wallet: true,\n        settings: true,\n        members: {\n          include: {\n            user: true,\n            role: true,\n          },\n        },\n      },\n    });\n\n    res.json({\n      organization: organizationRecord,\n      myRole: access.role?.label ?? 'Member',\n    });"
);

text = text.replace(
  '          description: payload.description,\n          createdBy: req.user!.id,',
  '          description: payload.description,\n          chamaType: payload.chamaType,\n          enabledModules: payload.enabledModules,\n          createdBy: req.user!.id,'
);

text = text.replace(
  '        status: payload.status as any,',
  '        chamaType: payload.chamaType,\n        enabledModules: payload.enabledModules,\n        status: payload.status as any,'
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
