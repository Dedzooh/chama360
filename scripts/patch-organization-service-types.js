import fs from 'fs';
const path = 'G:/chama/client/src/services/organizationService.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "export interface OrganizationSummary extends Pick<Organization, 'id' | 'name' | 'organizationType' | 'slug' | 'description' | 'status' | 'createdAt' | 'updatedAt'> {\n  chamaType?: string | null;\n  enabledModules?: Record<string, boolean> | null;\n  role?: string;\n  balance?: number;\n}",
  "export interface OrganizationSummary extends Pick<Organization, 'id' | 'name' | 'organizationType' | 'slug' | 'description' | 'status' | 'createdAt' | 'updatedAt'> {\n  chamaType?: string | null;\n  enabledModules?: Record<string, boolean> | null;\n  role?: string;\n  balance?: number;\n  wallet?: {\n    balance: number;\n    currency: string;\n  } | null;\n  members?: OrganizationMemberRecord[];\n}"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
