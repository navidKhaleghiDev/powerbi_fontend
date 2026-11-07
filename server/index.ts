import { createApp } from './app.ts';

const modelDir = process.env.CUBE_MODEL_DIR;
if (!modelDir) throw new Error('Set CUBE_MODEL_DIR to the existing host folder mounted into Cube');
const app = await createApp({
  modelDir,
  schemaDiscoveryUrl: process.env.CUBE_SCHEMA_DISCOVERY_URL,
  managementKey: process.env.CUBE_MANAGEMENT_KEY ?? '',
  allowedOrigins: (
    process.env.CUBE_MANAGEMENT_ORIGINS ?? 'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((origin) => origin.trim()),
  cubeApiUrl: process.env.CUBE_SERVER_API_URL,
  cubeToken: process.env.CUBE_SERVER_TOKEN,
});
const port = Number(process.env.CUBE_MANAGEMENT_PORT ?? 3002);
app.listen(port, process.env.CUBE_MANAGEMENT_HOST ?? '127.0.0.1', () =>
  process.stdout.write(`Cube model management listening on http://127.0.0.1:${port}\n`),
);
