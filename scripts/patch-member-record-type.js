import fs from 'fs';
const path = 'G:/chama/client/src/services/organizationService.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "export interface OrganizationMemberRecord extends Omit<OrganizationMember, 'role' | 'status'> {\n  role: MemberRole | string;\n  status: MemberStatus | string;\n  user?: {\n    id: string;\n    firstName: string;\n    lastName: string;\n    email: string;\n    phone?: string;\n  } | null;\n  roleLabel?: string | null;\n}",
  "export interface OrganizationMemberRecord {\n  id: string;\n  organizationId: string;\n  userId?: string;\n  role: MemberRole | string;\n  status: MemberStatus | string;\n  joinedAt: string;\n  updatedAt?: string;\n  reliabilityScore?: number;\n  organization?: Organization;\n  user?: {\n    id: string;\n    firstName: string;\n    lastName: string;\n    email: string;\n    phone?: string;\n  } | null;\n  roleLabel?: string | null;\n}"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
