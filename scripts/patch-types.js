import fs from 'fs';
const path = 'G:/chama/client/src/types/index.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "  description?: string;\n  status: ChamaStatus;\n  createdBy: string;\n  createdAt: string;\n  updatedAt: string;",
  "  description?: string;\n  status: ChamaStatus;\n  createdBy: string;\n  createdAt: string;\n  updatedAt: string;\n  chamaType?: string | null;\n  enabledModules?: Record<string, boolean> | null;"
);
text = text.replace(
  "  organization: Organization;\n  role: MemberRole;\n  status: MemberStatus;",
  "  organization: Organization;\n  role: MemberRole;\n  status: MemberStatus;\n  user?: User;"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
