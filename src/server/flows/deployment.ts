import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

import type { DeploymentStatus } from "@/lib/flows/types";

import { dataDirectory } from "./store";

/** Read-only local readiness; never run Docker or expose private credentials. */
export const deploymentStatus = (): DeploymentStatus => {
  let docker: DeploymentStatus["docker"] = "missing";
  if (process.env.LOCAL_STACK_ENABLED === "1") docker = "external";
  else if (existsSync("/var/run/docker.sock")) {
    try {
      accessSync("/var/run/docker.sock", constants.R_OK | constants.W_OK);
      docker = "accessible";
    } catch {
      docker = "permission_required";
    }
  }
  const candidates = [
    path.join(dataDirectory(), "reports/local-stack-verification.json"),
    path.join(
      dataDirectory(),
      "compose-workspace/reports/local-stack-verification.json",
    ),
  ];
  let verifiedAt: string | null = null;
  for (const file of candidates) {
    try {
      if (statSync(file).size > 65536) continue;
      const evidence: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (!evidence || typeof evidence !== "object") continue;
      const value = evidence as Record<string, unknown>;
      if (
        typeof value.at !== "string" ||
        !Number.isFinite(Date.parse(value.at)) ||
        !Array.isArray(value.checks) ||
        !value.checks.length
      )
        continue;
      const names = new Set<string>();
      const complete = value.checks.every((entry: unknown) => {
        if (!entry || typeof entry !== "object") return false;
        const check = entry as Record<string, unknown>;
        if (typeof check.name === "string") names.add(check.name);
        return check.passed === true;
      });
      if (
        complete &&
        [
          "debezium-task",
          "published-snapshot",
          "published-dashboard",
          "record_count",
          "sales_amount",
          "customer-redaction",
        ].every((name) => names.has(name))
      ) {
        if (!verifiedAt || Date.parse(value.at) > Date.parse(verifiedAt))
          verifiedAt = value.at;
      }
    } catch {
      /* Missing or malformed evidence is unverified, never success. */
    }
  }
  let localAppPort = 3003;
  try {
    const file = path.join(process.cwd(), ".env.compose");
    if (statSync(file).size <= 65536) {
      const match = /^BI_APP_PORT=(\d{1,5})$/m.exec(readFileSync(file, "utf8"));
      if (match && Number(match[1]) > 0 && Number(match[1]) <= 65535)
        localAppPort = Number(match[1]);
    }
  } catch {
    /* Default private local-stack port; no env content is returned. */
  }
  return {
    localAppPort,
    docker,
    composePrepared: existsSync(path.join(process.cwd(), "compose.yaml")),
    verifiedAt,
    checkedAt: new Date().toISOString(),
  };
};
