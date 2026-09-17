import fs from 'fs';
const path = 'G:/chama/client/src/services/organizationService.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "  role?: string;\n  balance?: number;",
  "  role?: string;\n  myRole?: string;\n  balance?: number;"
);
text = text.replace(
  "export interface ContributionRecord {\n  id: string;\n  memberId: string;\n  amount: number;\n  dueDate: string;",
  "export interface ContributionRecord {\n  id: string;\n  memberId: string;\n  amount: number;\n  contributionType?: string;\n  dueDate: string;"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
