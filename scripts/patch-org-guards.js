const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'INVITE_MEMBERS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to add members');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'INVITE_MEMBERS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to add members');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Archived organizations are read-only');\n    }"
);

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to update members');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to update members');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Archived organizations are read-only');\n    }"
);

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to remove members');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to remove members');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Archived organizations are read-only');\n    }"
);

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'RECORD_CONTRIBUTIONS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to create contributions');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'RECORD_CONTRIBUTIONS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to create contributions');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Closed organizations cannot accept new contributions');\n    }"
);

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'SUBMIT_LOAN_APPLICATION') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to apply for a loan');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'SUBMIT_LOAN_APPLICATION') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to apply for a loan');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Closed organizations cannot accept new loans');\n    }"
);

text = text.replace(
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'APPROVE_LOANS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to approve loans');\n    }",
  "    const access = await getOrganizationAccess(id, (req.user.id as string));\n    if (!hasOrganizationPermission(access, 'APPROVE_LOANS') && !isOwnerLike((access.role as any)?.name || '')) {\n      throw new ForbiddenError('Insufficient permissions to approve loans');\n    }\n\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Closed organizations cannot approve loans');\n    }"
);

text = text.replace(
  "    const { id, loanId } = req.params as { id: string; loanId: string };\n    await getOrganizationAccess(id, (req.user.id as string));\n",
  "    const { id, loanId } = req.params as { id: string; loanId: string };\n    const currentOrganization = await requireOrganizationStatus(id);\n    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {\n      throw new ForbiddenError('Closed organizations cannot record repayments');\n    }\n    await getOrganizationAccess(id, (req.user.id as string));\n"
);

fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
