import { AsyncLocalStorage } from "node:async_hooks";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { FlowStore, WorkspaceState, SessionUser } from "@/lib/flows/types";

import { FlowError } from "./errors";
export const dataDirectory = () =>
  process.env.CONTROL_CENTER_DATA_DIR || path.join(process.cwd(), ".data");
const emptyStore = (): FlowStore => ({
  version: 1,
  users: [],
  audit: [],
  bindings: [],
  infrastructure: {
    clickhouse: { url: "", database: "", user: "", password: "" },
    kafka: { connectUrl: "", brokers: "", user: "", password: "" },
  },
  connections: [],
  flows: [],
  runs: [],
  reports: [],
});
export const storeKey = () => {
  const dir = dataDirectory();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "master.key");
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32), { mode: 0o600, flag: "wx" });
  return readFileSync(file);
};
export const readStore = (): FlowStore => {
  const file = path.join(dataDirectory(), "workspace.enc");
  if (!existsSync(file)) return emptyStore();
  try {
    const data = readFileSync(file);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      storeKey(),
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    const state: FlowStore = JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    if (state.version !== 1) throw new Error();
    return {
      ...state,
      users: state.users || [],
      audit: state.audit || [],
      bindings: state.bindings || [],
    };
  } catch {
    throw new FlowError("storeInvalid", 500);
  }
};
/** Synchronous read/modify/atomic-rename transaction for one Node server process. */
interface AuditContext {
  actorId: string;
  action: string;
  targetId: string;
}
const auditContext = new AsyncLocalStorage<AuditContext>();
export const withAuditContext = <T>(context: AuditContext, work: () => T): T =>
  auditContext.run(context, work);
export const updateStore = <T>(mutate: (store: FlowStore) => T): T => {
  const state = readStore();
  const result = mutate(state);
  const context = auditContext.getStore();
  if (context)
    state.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      ...context,
    });
  const secret = storeKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(state)),
    cipher.final(),
  ]);
  const file = path.join(dataDirectory(), "workspace.enc");
  const tmp = file + "." + randomUUID() + ".tmp";
  writeFileSync(tmp, Buffer.concat([iv, cipher.getAuthTag(), body]), {
    mode: 0o600,
  });
  renameSync(tmp, file);
  return result;
};
export const publicState = (user: SessionUser): WorkspaceState => {
  const state = readStore();
  const { password: chPassword, ...ch } = state.infrastructure.clickhouse;
  const { password: kPassword, ...kafka } = state.infrastructure.kafka;
  return {
    currentUser: user,
    bindings: state.bindings
      .filter(
        (binding) =>
          user.role === "provider" ||
          binding.ownerId === user.id ||
          state.reports.some(
            (report) =>
              report.publishedAt &&
              report.publishedWidgets?.some(
                (widget) => widget.bindingId === binding.id,
              ),
          ),
      )
      .map((binding) =>
        user.dataAccess
          ? binding
          : {
              ...binding,
              actual: undefined,
              expected: undefined,
              tolerance: undefined,
            },
      ),
    users:
      user.role === "provider"
        ? state.users.map((account) => ({
            id: account.id,
            username: account.username,
            role: account.role,
            dataAccess: account.dataAccess,
          }))
        : undefined,
    audit:
      user.role === "provider" ? state.audit.slice(-100).reverse() : undefined,
    infrastructure: {
      clickhouse:
        user.role === "provider"
          ? { ...ch, hasPassword: !!chPassword }
          : { url: "", database: "", user: "", hasPassword: false },
      kafka:
        user.role === "provider"
          ? { ...kafka, hasPassword: !!kPassword }
          : { connectUrl: "", brokers: "", user: "", hasPassword: false },
    },
    connections:
      user.role === "customer"
        ? []
        : state.connections.map(({ password, ...connection }) => ({
            ...connection,
            hasPassword: !!password,
          })),
    flows:
      user.role === "customer"
        ? state.flows.filter((flow) => !!flow.activeLoadId)
        : state.flows,
    runs: user.role === "provider" ? state.runs : [],
    reports: state.reports
      .filter((report) => report.ownerId === user.id || !!report.publishedAt)
      .map((report) =>
        report.ownerId === user.id
          ? report
          : {
              ...report,
              widgets: report.publishedWidgets || [],
              revision: report.publishedRevision || report.revision,
            },
      ),
  };
};
