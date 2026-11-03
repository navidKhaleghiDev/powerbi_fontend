import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
const root = process.cwd();
const envFile = path.join(root, ".env.compose");
mkdirSync(path.join(root, ".data"), { recursive: true, mode: 0o700 });
mkdirSync(path.join(root, ".data/compose-workspace"), {
  recursive: true,
  mode: 0o700,
});
if (!existsSync(envFile)) {
  const secret = () => randomBytes(24).toString("hex");
  writeFileSync(
    envFile,
    [
      "BI_APP_PORT=3003",
      "BI_APP_BIND=0.0.0.0",
      "POSTGRES_ADMIN_PASSWORD=" + secret(),
      "POSTGRES_CDC_PASSWORD=" + secret(),
      "CLICKHOUSE_PASSWORD=" + secret(),
      "LOCAL_PROVIDER_PASSWORD=" + secret(),
      "LOCAL_CUSTOMER_PASSWORD=" + secret(),
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
}
chmodSync(envFile, 0o600);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
for (const name of [
  "POSTGRES_ADMIN_PASSWORD",
  "POSTGRES_CDC_PASSWORD",
  "CLICKHOUSE_PASSWORD",
  "LOCAL_PROVIDER_PASSWORD",
  "LOCAL_CUSTOMER_PASSWORD",
]) {
  if (!/^[A-Za-z0-9_-]{24,}$/.test(env[name] || ""))
    throw Error("Missing or invalid generated setting: " + name);
}
const access = path.join(root, ".data/compose-access.txt");
writeFileSync(
  access,
  [
    "Local Compose workspace only; existing port 3001 accounts are unchanged.",
    `Login: http://localhost:${env.BI_APP_PORT || "3003"}/fa/login`,
    "Provider username: local_provider",
    "Provider password: " + env.LOCAL_PROVIDER_PASSWORD,
    "Customer username: local_customer",
    "Customer password: " + env.LOCAL_CUSTOMER_PASSWORD,
    "",
    "Accounts become available after npm run stack:provision succeeds.",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
chmodSync(access, 0o600);
console.log(
  "Private settings prepared. Credentials: .data/compose-access.txt (not printed).",
);
