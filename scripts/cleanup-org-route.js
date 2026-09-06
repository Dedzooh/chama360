const fs = require('fs');
const path = 'G:/chama/src/routes/organization.ts';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  '          description: payload.description,\n          chamaType: payload.chamaType,\n          enabledModules: payload.enabledModules,\n          createdBy: req.user!.id,',
  '          description: payload.description,\n          createdBy: req.user!.id,'
);
text = text.replace(
  '        description: payload.description,\n        chamaType: payload.chamaType,\n        enabledModules: payload.enabledModules,\n        status: payload.status as any,',
  '        description: payload.description,\n        status: payload.status as any,'
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
