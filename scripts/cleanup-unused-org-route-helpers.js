import fs from 'fs';
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace("const organizationLifecycleStatuses = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED'] as const;\n\n", '');
text = text.replace("function canArchiveOrganization(status: string) {\n  return status === 'CLOSED';\n}\n\n", '');
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
