// Workers static assets use wrangler.jsonc for SPA routing; the Pages/Netlify _redirects file is rejected there.
import { cpSync, existsSync, rmSync } from 'node:fs';

if (!existsSync('dist')) throw new Error('Run "npm run build" first.');
rmSync('.cf-dist', { recursive: true, force: true });
cpSync('dist', '.cf-dist', { recursive: true });
rmSync('.cf-dist/_redirects', { force: true });
console.log('prepared .cf-dist');
