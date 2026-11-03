import { spawnSync } from "node:child_process";
const action = process.argv[2] || "status";
const actions = {
  up: ["up", "-d", "--build", "--wait", "--wait-timeout", "300"],
  status: ["ps"],
  logs: ["logs", "--tail", "80"],
  stop: ["stop"],
  provision: ["exec", "-T", "app", "npm", "run", "stack:seed"],
  verify: [
    "exec",
    "-T",
    "app",
    "npm",
    "run",
    "stack:seed",
    "--",
    "--verify-only",
  ],
  change: [
    "exec",
    "-T",
    "app",
    "npm",
    "run",
    "stack:seed",
    "--",
    "--exercise-cdc",
  ],
};
if (!Object.hasOwn(actions, action)) throw Error("Unknown stack action");
if (action === "up") {
  const init = spawnSync(process.execPath, ["scripts/init-local-stack.mjs"], {
    stdio: "inherit",
  });
  if (init.status !== 0) process.exit(init.status || 1);
}
const result = spawnSync(
  "docker",
  ["compose", "--env-file", ".env.compose", ...actions[action]],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(
    "Docker is missing or unavailable. Install Docker Engine and the Compose plugin, then retry.",
  );
  process.exit(1);
}
process.exit(result.status || 0);
