import fs from 'fs';
const path = 'G:/chama/client/src/components/auth/RequireAuth.tsx';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);",
  "  const isAuthenticated = useAuthStore((state) => state.isAuthenticated || Boolean(localStorage.getItem('accessToken')));"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
