import fs from 'fs';
const path = 'G:/chama/client/src/services/organizationService.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace("import type { Organization, OrganizationMember, MemberRole, MemberStatus, OrganizationType } from '../types';", "import type { Organization, MemberRole, MemberStatus, OrganizationType } from '../types';");
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
