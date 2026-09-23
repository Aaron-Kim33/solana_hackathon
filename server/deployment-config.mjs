import { isAbsolute, relative, resolve, sep } from 'node:path';
import { httpsOrigin } from '../src/game/deployment-policy.ts';
export function serverConfig(env = process.env) {
  const mode = env.LUMBER_SERVER_MODE || 'local';
  if (mode === 'local') return { host: '127.0.0.1', port: 8787, path: resolve('server/local-dev.sqlite'), origin: 'https://lumber-rush.example', mode };
  if (mode !== 'preview' || env.LUMBER_ALLOW_PUBLIC_BIND !== 'true') throw new Error('PREVIEW_BIND_NOT_APPROVED');
  if (!env.LUMBER_DB_PATH || !env.LUMBER_IDENTITY_ORIGIN) throw new Error('PREVIEW_SERVER_CONFIG_REQUIRED');
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  const path = resolve(env.LUMBER_DB_PATH);
  if (env.RAILWAY_PROJECT_ID) {
    if (!env.RAILWAY_VOLUME_MOUNT_PATH) throw new Error('RAILWAY_VOLUME_REQUIRED');
    const withinVolume = relative(resolve(env.RAILWAY_VOLUME_MOUNT_PATH), path);
    if (withinVolume === '..' || withinVolume.startsWith(`..${sep}`) || isAbsolute(withinVolume)) {
      throw new Error('RAILWAY_DB_OUTSIDE_VOLUME');
    }
  }
  return { host: '0.0.0.0', port, path, origin: httpsOrigin(env.LUMBER_IDENTITY_ORIGIN), mode };
}
