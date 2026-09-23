import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/identity-site');
await mkdir(output, { recursive: true });
await cp(join(root, 'identity-site/index.html'), join(output, 'index.html'));
await cp(join(root, 'assets/lumber-rush-icon-v2.png'), join(output, 'icon.png'));
console.log(`Identity site prepared at ${output}. Deploy only after choosing and configuring its HTTPS subdomain.`);
