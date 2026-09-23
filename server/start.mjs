import { createApi } from './http-api.mjs';
import { serverConfig } from './deployment-config.mjs';
const config = serverConfig();
const server = createApi({ path: config.path, origin: config.origin, mode: config.mode });
server.listen(config.port, config.host, () => console.log(`Lumber Rush API: ${config.mode} on ${config.host}:${config.port} (Devnet test; preview requires a TLS reverse proxy)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
