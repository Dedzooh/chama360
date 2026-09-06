import fs from 'fs';
const path = 'G:/chama/client/src/services/organizationService.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "export interface OrganizationSummary extends Pick<Organization, 'id' | 'name' | 'organizationType' | 'slug' | 'description' | 'status' | 'createdAt' | 'updatedAt'> {",
  "export interface OrganizationSummary extends Pick<Organization, 'id' | 'name' | 'organizationType' | 'slug' | 'description' | 'status'> {\n  createdAt?: string;\n  updatedAt?: string;"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
