import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readdir, readFile, realpath, writeFile, link, unlink } from 'node:fs/promises';
import path from 'node:path';

import express, { json, type ErrorRequestHandler } from 'express';
import { parse } from 'yaml';

import { ApiError, serializeModel, validateModel } from './model.ts';
import { normalizeSchema } from './schema.ts';

export interface ServerConfig {
  schemaDiscoveryUrl?: string;
  modelDir: string;
  managementKey: string;
  allowedOrigins: string[];
  cubeApiUrl?: string;
  cubeToken?: string;
}
export const createApp = async (config: ServerConfig) => {
  if (config.managementKey.length < 24)
    throw new Error('CUBE_MANAGEMENT_KEY must contain at least 24 characters');
  const directory = await realpath(config.modelDir);
  const app = express();
  const locks = new Set<string>();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/cube-management/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/cube-management', (req, res, next) => {
    if (req.headers.origin && !config.allowedOrigins.includes(req.headers.origin))
      return res.status(403).json({ error: 'Origin is not allowed' });
    const supplied = Buffer.from(req.get('X-Management-Key') ?? '');
    const expected = Buffer.from(config.managementKey);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return res.status(401).json({ error: 'A valid management key is required' });
    next();
  });
  app.use(json({ limit: '64kb' }));
  app.get('/api/cube-management/files', async (_req, res) => {
    if (!config.schemaDiscoveryUrl)
      throw new ApiError(503, 'Cube development model files endpoint is not configured');
    const url = new URL('files', config.schemaDiscoveryUrl);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok) throw new ApiError(502, 'Cube model files are unavailable');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('files' in body) || !Array.isArray(body.files))
      throw new ApiError(502, 'Invalid Cube files metadata');
    const files = body.files.map((file: unknown) => {
      if (
        !file ||
        typeof file !== 'object' ||
        !('fileName' in file) ||
        typeof file.fileName !== 'string' ||
        !('content' in file) ||
        typeof file.content !== 'string'
      )
        throw new ApiError(502, 'Invalid model file');
      return { name: file.fileName, content: file.content };
    });
    res.json({ files });
  });
  app.get('/api/cube-management/tables', async (_req, res) => {
    if (!config.schemaDiscoveryUrl)
      throw new ApiError(
        503,
        'Database schema discovery is not configured; it requires a local Cube development instance',
      );
    let response: Response;
    try {
      response = await fetch(config.schemaDiscoveryUrl, {
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      });
    } catch {
      throw new ApiError(502, 'Cube database schema discovery is unavailable');
    }
    if (!response.ok)
      throw new ApiError(
        502,
        'Cube database schema discovery failed; check development mode and the database connection',
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(502, 'Cube did not return database schema JSON');
    }
    res.json({ tables: normalizeSchema(body), source: 'cube-development-schema' });
  });
  app.post('/api/cube-management/validate', (req, res) => {
    const model = validateModel(req.body as unknown);
    res.json({ model, yaml: serializeModel(model), validation: 'structural' });
  });
  app.post('/api/cube-management/models', async (req, res) => {
    const model = validateModel(req.body as unknown);
    const lock = model.name.toLowerCase();
    if (locks.has(lock)) throw new ApiError(409, 'A model with this name is being saved');
    locks.add(lock);
    try {
      // Refuse duplicate definitions anywhere in the mounted YAML model tree.
      const entries = await readdir(directory, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !/\.(ya?ml|js)$/i.test(entry.name)) continue;
        const content = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
        if (/\.js$/i.test(entry.name)) {
          if (new RegExp(`\\bcube\\s*\\(\\s*['"\x60]${model.name}['"\x60]`, 'i').test(content))
            throw new ApiError(409, 'Cube already exists; existing models are never overwritten');
        } else {
          const document: unknown = parse(content);
          if (
            document &&
            typeof document === 'object' &&
            'cubes' in document &&
            Array.isArray(document.cubes) &&
            document.cubes.some(
              (cube: unknown) =>
                cube &&
                typeof cube === 'object' &&
                'name' in cube &&
                typeof cube.name === 'string' &&
                cube.name.toLowerCase() === lock,
            )
          )
            throw new ApiError(409, 'Cube already exists; existing models are never overwritten');
        }
      }
      const filename = `control_center_${model.name}.yml`;
      const target = path.join(directory, filename);
      const temporary = path.join(directory, `.control-center-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, serializeModel(model), { flag: 'wx', mode: 0o644 });
        await link(temporary, target);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')
          throw new ApiError(409, 'Model file already exists');
        throw error;
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
      res
        .status(201)
        .json({ name: model.name, filename, status: 'saved', activation: 'not_verified' });
    } finally {
      locks.delete(lock);
    }
  });
  app.get('/api/cube-management/models/:name/status', async (req, res) => {
    const name = req.params.name;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) throw new ApiError(400, 'Invalid cube name');
    if (!config.cubeApiUrl)
      return res.json({
        active: false,
        reason: 'Cube API URL is not configured on the management service',
      });
    const response = await fetch(`${config.cubeApiUrl.replace(/\/+$/, '')}/meta`, {
      headers: config.cubeToken ? { Authorization: config.cubeToken } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ApiError(502, 'Cube metadata request failed');
    const data: unknown = await response.json();
    const active = !!(
      data &&
      typeof data === 'object' &&
      'cubes' in data &&
      Array.isArray(data.cubes) &&
      data.cubes.some(
        (cube: unknown) => cube && typeof cube === 'object' && 'name' in cube && cube.name === name,
      )
    );
    res.json({ active });
  });
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: 'Invalid JSON or existing YAML model syntax' });
    if (error && typeof error === 'object' && 'status' in error && error.status === 413)
      return res.status(413).json({ error: 'Request is too large' });
    res.status(500).json({
      error:
        'Model operation failed; check the service configuration, model files and folder permissions',
    });
  };
  app.use(errorHandler);
  return app;
};
