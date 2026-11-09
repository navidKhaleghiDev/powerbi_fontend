# Cube model management API

Express creates Cube YAML models from the existing frontend builder. It is a separate local management service, not a database server or a user authentication system. It does not install Cube, change database credentials, overwrite existing models or restart containers.

## Run with your existing Docker Cube

1. Find the **host source folder** mounted into your Cube container:

   ```bash
   docker inspect YOUR_CUBE_CONTAINER --format '{{json .Mounts}}'
   ```

   Cube must read the files Express writes. Cube's default schema directory is `/cube/conf/schema`; for example, mount `./cube/model:/cube/conf/schema` and point Express at the same host `./cube/model` directory. If your Cube deployment uses a different schema path, use that actual path. Do not mount the Docker socket.

2. In this repository:

   ```bash
   cp server/config.example.env .env.server
   node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
   ```

   Set `CUBE_MANAGEMENT_KEY` to the generated value in `.env.server` and set `CUBE_MODEL_DIR` to the absolute shared host directory. Never prefix the key with `VITE_`. Set `CUBE_SERVER_API_URL` to the API URL reachable by Express. In local Cube development mode, `CUBE_SERVER_TOKEN` can remain empty.

3. Start two terminals:

   ```bash
   pnpm dev:server
   ```

   ```bash
   pnpm dev
   ```

   Vite proxies `/api/cube-management` to `127.0.0.1:3002`. If you change the backend port, update the Vite proxy too. The backend refuses to start without an existing directory and a key of at least 24 characters.

4. Open **Configuration → Overview → Cube data → model builder**. Enter a model name, table, measures and dimensions. Use **Validate on server**, then **Create model on server**. The API independently validates the payload, even if validation was skipped in the UI.

5. Use **Check Cube model visibility**. A saved file is not proof of activation. In local development Cube generally reloads changed models; check its logs if the model does not appear. Production requires your normal Cube deployment/reload procedure. After visibility succeeds, test the Cube connection again and run a real measure query.

## API

All endpoints except health require `X-Management-Key`. Browser origins are checked against `CUBE_MANAGEMENT_ORIGINS`; CORS is not used as authentication. The local Vite proxy supplies the key from the server environment.

- `GET /api/cube-management/health`: process liveness.
- `POST /api/cube-management/validate`: structural validation and generated YAML, with no disk write.
- `POST /api/cube-management/models`: exclusively creates `control_center_<name>.yml` in the configured folder. Returns 201 for a saved file and 409 on conflicts.
- `GET /api/cube-management/models/:name/status`: checks visibility in the server-configured Cube metadata endpoint. It does not verify database SQL execution.

POST bodies contain `name`, `table`, `measures` and `dimensions`. Each member has `name`, `type` and, except `count`, `sql`. SQL table names use simple `schema.table` identifiers. SQL expressions are single-line; template directives are unsupported. Payloads are limited to 64 KiB and 100 members per group.

Files are written through temporary files and an exclusive hard link, so Cube sees complete files and existing targets are not replaced. The configured folder must support hard links. Symlinked files are not scanned. Static YAML and literal JavaScript cube names are checked for duplicates; dynamically generated JavaScript/Python models require manual conflict review. The service is intended to be the single model writer for this folder; it cannot lock out external editors or separate API processes.

## Docker backend image

```bash
docker build --target management -t cube-management .
```

Run it on the same Docker network as Cube, with the **same host model folder** mounted at `/models`:

```bash
docker run --rm --name cube-management \
  --network YOUR_CUBE_NETWORK \
  --env-file .env.server \
  -e CUBE_MODEL_DIR=/models \
  -e CUBE_SERVER_API_URL=http://YOUR_CUBE_CONTAINER:4000/cubejs-api/v1 \
  -p 127.0.0.1:3002:3002 \
  --mount type=bind,src=/absolute/host/path/to/cube/model/cubes,dst=/models \
  cube-management
```

The existing default Docker production target still serves the SPA with nginx. For deployed frontend use, configure your HTTPS reverse proxy to route `/api/cube-management/` to Express and set allowed origins to the actual frontend origin. Do not expose the management service directly to public users. The management key grants model creation privileges and is not a replacement for organization-level admin authentication.

## Verification

```bash
pnpm check-types
pnpm test:server
pnpm build
```

Backend tests use temporary directories and a fake Cube HTTP service. They never write to the configured real model directory.

## Browse physical database tables

Set `CUBE_SCHEMA_DISCOVERY_URL=http://localhost:4000/playground/db-schema` in `.env.server` and restart Express. In the model builder, choose **Load / refresh database tables**. Search by schema/table name, select a table, inspect column types and primary keys, and use it to fill the model table field. This does not execute row queries or create models.

`GET /api/cube-management/tables` is authenticated and normalizes metadata from the fixed server-configured endpoint. This integration uses Cube's local development API and is unavailable when development mode is disabled or that endpoint is unsupported. It discovers the default data source visible to Cube, not every database on the server. Do not enable Cube development mode in production to use this browser. Production schema discovery requires a separately protected database metadata connector.

### Environment-managed browser access

The UI no longer asks for a management key. For local development, set `CUBE_MANAGEMENT_KEY` in `.env.server` (or the Vite process environment), then restart both `pnpm dev` and `pnpm dev:server`. Vite reads that file server-side and injects `X-Management-Key` into proxied management requests. The key is never included in the SPA bundle. Keep the development server restricted to trusted users.

For production, configure the protected HTTPS reverse proxy to overwrite `X-Management-Key` with the server-side `CUBE_MANAGEMENT_KEY` for `/api/cube-management/`. Restrict access to authorized administrators before injecting the header. Static nginx hosting alone does not read `.env.server`; never use a `VITE_` variable for this secret.
