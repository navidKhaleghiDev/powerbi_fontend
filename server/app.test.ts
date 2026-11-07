import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

import { createApp } from './app.ts';
import { validateModel } from './model.ts';
import { normalizeSchema } from './schema.ts';

const model = {
  name: 'orders',
  table: 'public.orders',
  measures: [
    { name: 'count', type: 'count' },
    { name: 'total', type: 'sum', sql: 'amount' },
  ],
  dimensions: [{ name: 'status', type: 'string', sql: 'status' }],
};

void test('validates structured models and rejects unsafe paths, types, templates and duplicate names', () => {
  assert.equal(validateModel(model).measures.length, 2);
  for (const invalid of [
    { ...model, name: '../escape' },
    { ...model, table: 'orders; DROP TABLE orders' },
    { ...model, measures: [] },
    { ...model, measures: [{ name: 'count', type: 'unknown' }] },
    { ...model, measures: [{ name: 'total', type: 'sum', sql: '{{ execute() }}' }] },
    { ...model, dimensions: [{ name: 'count', type: 'number', sql: 'id' }] },
  ])
    assert.throws(() => validateModel(invalid));
});

void test('Express authenticates, saves atomically, refuses overwrites and verifies metadata', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cube-management-'));
  const key = 'test-management-key-1234567890';
  let visible = false;
  const cube = createServer((req, res) => {
    if (req.url === '/playground/files') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          files: [
            {
              fileName: 'cubes/orders.yml',
              content: 'cubes: []',
              absPath: '/private/cube/model/cubes/orders.yml',
            },
          ],
        }),
      );
      return;
    }
    if (req.url === '/playground/db-schema') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          tablesSchema: {
            public: { orders: [{ name: 'id', type: 'bigint', attributes: ['primaryKey'] }] },
          },
        }),
      );
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ cubes: visible ? [{ name: 'orders' }] : [] }));
  });
  cube.listen(0, '127.0.0.1');
  await once(cube, 'listening');
  const cubeAddress = cube.address();
  assert.ok(cubeAddress && typeof cubeAddress !== 'string');
  const app = await createApp({
    modelDir: directory,
    schemaDiscoveryUrl: `http://127.0.0.1:${cubeAddress.port}/playground/db-schema`,
    managementKey: key,
    allowedOrigins: ['http://localhost:3001'],
    cubeApiUrl: `http://127.0.0.1:${cubeAddress.port}`,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/cube-management`;
  const headers = { 'X-Management-Key': key, 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/files`)).status, 401);
    const filesResponse = await fetch(`${base}/files`, { headers });
    assert.equal(filesResponse.status, 200);
    assert.deepEqual(await filesResponse.json(), {
      files: [{ name: 'cubes/orders.yml', content: 'cubes: []' }],
    });
    assert.equal((await fetch(`${base}/tables`)).status, 401);
    const schemaResponse = await fetch(`${base}/tables`, { headers });
    assert.equal(schemaResponse.status, 200);
    assert.deepEqual(await schemaResponse.json(), {
      source: 'cube-development-schema',
      tables: [
        {
          schema: 'public',
          name: 'orders',
          columns: [{ name: 'id', type: 'bigint', primaryKey: true }],
        },
      ],
    });
    assert.equal(
      (
        await fetch(`${base}/models`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(model),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/models`, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://untrusted.example' },
          body: JSON.stringify(model),
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}/validate`, { method: 'POST', headers, body: JSON.stringify(model) }))
        .status,
      200,
    );
    assert.equal((await readdir(directory)).length, 0);
    assert.equal(
      (
        await fetch(`${base}/models`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...model, name: '../escape' }),
        })
      ).status,
      400,
    );
    const responses = await Promise.all(
      [1, 2].map(() =>
        fetch(`${base}/models`, { method: 'POST', headers, body: JSON.stringify(model) }),
      ),
    );
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const content = await readFile(path.join(directory, 'control_center_orders.yml'), 'utf8');
    const document = parse(content) as { cubes: { name: string; measures: unknown[] }[] };
    assert.equal(document.cubes[0].name, 'orders');
    assert.equal(document.cubes[0].measures.length, 2);
    assert.deepEqual(await readdir(directory), ['control_center_orders.yml']);
    assert.equal(
      (await fetch(`${base}/models`, { method: 'POST', headers, body: JSON.stringify(model) }))
        .status,
      409,
    );
    assert.equal(
      await readFile(path.join(directory, 'control_center_orders.yml'), 'utf8'),
      content,
    );
    assert.deepEqual(await (await fetch(`${base}/models/orders/status`, { headers })).json(), {
      active: false,
    });
    visible = true;
    assert.deepEqual(await (await fetch(`${base}/models/orders/status`, { headers })).json(), {
      active: true,
    });
    assert.equal(
      (await fetch(`${base}/models`, { method: 'POST', headers, body: 'invalid json' })).status,
      400,
    );
  } finally {
    await Promise.all([
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
      new Promise<void>((resolve, reject) =>
        cube.close((error) => (error ? reject(error) : resolve())),
      ),
    ]);
    await rm(directory, { recursive: true, force: true });
  }
});

void test('schema normalization rejects malformed metadata and preserves empty schemas', () => {
  assert.deepEqual(normalizeSchema({ tablesSchema: {} }), []);
  assert.throws(() => normalizeSchema({ cubes: [] }));
  assert.throws(() => normalizeSchema({ tablesSchema: { public: { orders: [{}] } } }));
});
