import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { metricCatalog, metricReadiness } from "@/lib/flows/metrics";
import type { WorkspaceUser } from "@/lib/flows/types";

import {
  createSession,
  hashPassword,
  verifyPassword,
  sessionUser,
  handleAuth,
  setupKey,
} from "../auth";
import { handleWorkspaceRequest } from "../handler";
import { withinTolerance, readyWidgets } from "../metrics";
import { updateStore, readStore } from "../store";
let directory: string;
const account = (
  role: "provider" | "customer",
  dataAccess = true,
): WorkspaceUser => ({
  id: role,
  username: role,
  role,
  dataAccess,
  passwordHash: hashPassword("a-private-pilot-password"),
  credentialVersion: 1,
});
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "bi-security-"));
  vi.stubEnv("CONTROL_CENTER_DATA_DIR", directory);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const request = (route: string, user?: WorkspaceUser, body: unknown = {}) =>
  handleWorkspaceRequest(
    new Request("http://localhost:3002/api/workspace/" + route, {
      method: "POST",
      headers: {
        cookie: user ? `bi_workspace_session=${createSession(user)}` : "",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    route.split("/"),
  );
describe("local pilot roles and governed publication", () => {
  it("hashes passwords and refuses short passwords", () => {
    const hash = hashPassword("a-strong-local-password");
    expect(hash).not.toContain("a-strong");
    expect(verifyPassword("a-strong-local-password", hash)).toBe(true);
    expect(verifyPassword("not-the-password", hash)).toBe(false);
    expect(() => hashPassword("short")).toThrow("passwordLength");
  });
  it("requires the one-time server setup key and never returns the password hash", async () => {
    const key = setupKey();
    const denied = await handleAuth(
      new Request("http://localhost/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({
          username: "owner",
          password: "a-strong-local-password",
          setupKey: "wrong",
        }),
      }),
      "bootstrap",
    );
    expect(denied.status).toBe(403);
    const response = await handleAuth(
      new Request("http://localhost/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({
          username: "owner",
          password: "a-strong-local-password",
          setupKey: key,
          dataAccess: false,
        }),
      }),
      "bootstrap",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("passwordHash");
    expect(existsSync(path.join(directory, "bootstrap.key"))).toBe(false);
    expect(readStore().users[0].dataAccess).toBe(false);
  });
  it("rejects a forged session and invalidates changed credential versions", () => {
    const user = account("provider");
    updateStore((state) => state.users.push(user));
    const cookie = createSession(user);
    expect(sessionUser(cookie)?.id).toBe(user.id);
    expect(sessionUser(cookie + "tampered")).toBeNull();
    updateStore((state) => state.users[0].credentialVersion++);
    expect(sessionUser(cookie)).toBeNull();
  });
  it("rejects anonymous provider operations", async () =>
    expect((await request("settings")).status).toBe(401));
  it("blocks customers from infrastructure, sources and approval APIs on the server", async () => {
    const user = account("customer");
    updateStore((state) => state.users.push(user));
    for (const route of ["settings", "connections", "users"])
      expect((await request(route, user)).status).toBe(403);
  });
  it("does not automatically grant a provider permission to read customer data", async () => {
    const user = account("provider", false);
    updateStore((state) => state.users.push(user));
    expect((await request("analytics", user)).status).toBe(403);
  });
  it("compares reconciliation totals without floating-point rounding", () => {
    expect(
      withinTolerance("1234567890123456.12", "1234567890123456.11", "0.01"),
    ).toBe(true);
    expect(
      withinTolerance("1234567890123456.12", "1234567890123456.10", "0.01"),
    ).toBe(false);
  });
  it("keeps unresolved financial models unsupported", () => {
    expect(
      metricReadiness(
        metricCatalog.find((item) => item.id === "net_profit")!,
        undefined,
        [],
      ),
    ).toBe("unsupported");
  });
  it("blocks ungoverned visuals from publication", () =>
    expect(() =>
      readyWidgets(
        [
          {
            id: "w",
            title: "x",
            flowId: "x",
            kind: "kpi",
            dimension: "",
            measure: "",
            aggregation: "count",
          },
        ],
        [],
        [],
      ),
    ).toThrow("metricNotReady"));
  it("keeps passwords encrypted at rest", () => {
    const user = account("provider");
    updateStore((state) => state.users.push(user));
    expect(
      readFileSync(path.join(directory, "workspace.enc")).toString(),
    ).not.toContain(user.passwordHash);
  });
});
