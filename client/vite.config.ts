import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version?: string };
const localApkPath = new URL(`./public/downloads/chamaz360-${packageJson.version}.apk`, import.meta.url);

const localApkDownload = {
  name: 'chamaz360-local-apk-download',
  configureServer(server: { middlewares: { use: (path: string, handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
    server.middlewares.use(`/downloads/chamaz360-${packageJson.version}.apk`, (req, res, next) => {
      if (!existsSync(localApkPath)) return next();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="chamaz360-${packageJson.version}.apk"`);
      res.setHeader('Content-Length', statSync(localApkPath).size);
      if (req.method === 'HEAD') return res.end();
      createReadStream(localApkPath).pipe(res);
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version ?? '0.0.0'),
  },
  plugins: [localApkDownload, react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
