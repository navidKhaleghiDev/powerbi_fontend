import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";

import type { SessionUser, WorkspaceUser } from "@/lib/flows/types";

import { FlowError } from "./errors";
import { readJsonBody } from "./request-body";
import { dataDirectory, readStore, storeKey, updateStore } from "./store";
export const SESSION_COOKIE = "bi_workspace_session";
export const hashPassword = (password: string): string => {
  if (password.length < 12 || password.length > 128)
    throw new FlowError("passwordLength");
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
const matches = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const verifyPassword = (password: string, hash: string): boolean => {
  if (password.length > 128) return false;
  const [salt, value] = hash.split(":");
  return (
    !!salt &&
    !!value &&
    matches(scryptSync(password, salt, 64).toString("hex"), value)
  );
};
const publicUser = (user: WorkspaceUser): SessionUser => ({
  id: user.id,
  username: user.username,
  role: user.role,
  dataAccess: user.dataAccess,
});
export const createSession = (user: WorkspaceUser): string => {
  const body = Buffer.from(
    JSON.stringify({
      id: user.id,
      version: user.credentialVersion,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  return (
    body +
    "." +
    createHmac("sha256", storeKey()).update(body).digest("base64url")
  );
};
export const sessionUser = (cookie: string | undefined): SessionUser | null => {
  if (!cookie) return null;
  try {
    const [body, signature] = cookie.split(".");
    if (
      !body ||
      !signature ||
      !matches(
        createHmac("sha256", storeKey()).update(body).digest("base64url"),
        signature,
      )
    )
      return null;
    const value: { id: string; version: number; exp: number } = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    );
    if (value.exp <= Date.now()) return null;
    const user = readStore().users.find(
      (item) =>
        item.id === value.id && item.credentialVersion === value.version,
    );
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
};
export const requestUser = (request: Request): SessionUser | null =>
  sessionUser(
    request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(SESSION_COOKIE + "="))
      ?.slice(SESSION_COOKIE.length + 1),
  );
export const audit = (actorId: string, action: string, targetId: string) =>
  updateStore((state) =>
    state.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      actorId,
      action,
      targetId,
    }),
  );
export const setupKey = (): string => {
  const dir = dataDirectory();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "bootstrap.key");
  if (!existsSync(file))
    writeFileSync(file, randomBytes(24).toString("base64url"), {
      mode: 0o600,
      flag: "wx",
    });
  return readFileSync(file, "utf8").trim();
};
const failures = new Map<string, { count: number; reset: number }>();
export const handleAuth = async (
  request: Request,
  action: string,
): Promise<Response> => {
  try {
    if (request.method === "GET") {
      if (action === "session") {
        const needsSetup = readStore().users.length === 0;
        if (needsSetup) setupKey();
        return Response.json(
          { user: requestUser(request), needsSetup },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      throw new FlowError("notFound", 404);
    }
    const origin = request.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !==
        (request.headers.get("host") || new URL(request.url).host)
    )
      throw new FlowError("originRejected", 403);
    if (action === "logout")
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
          },
        },
      );
    const raw = await readJsonBody(request, 16000, "invalid");
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new FlowError("invalid");
    const input = raw as Record<string, unknown>;
    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(username))
      throw new FlowError("invalid");
    let user: WorkspaceUser | undefined;
    if (action === "bootstrap") {
      if (
        readStore().users.length ||
        typeof input.setupKey !== "string" ||
        !matches(input.setupKey, setupKey())
      )
        throw new FlowError("setupDenied", 403);
      user = {
        id: randomUUID(),
        username,
        role: "provider",
        dataAccess: input.dataAccess === true,
        passwordHash: hashPassword(password),
        credentialVersion: 1,
      };
      const created = user;
      updateStore((state) => {
        if (state.users.length) throw new FlowError("setupDenied", 403);
        state.users.push(created);
      });
      unlinkSync(path.join(dataDirectory(), "bootstrap.key"));
      audit(user.id, "provider.bootstrapped", user.id);
    } else if (action === "login") {
      const identity = username.toLowerCase();
      const attempt = failures.get(identity);
      if (attempt && attempt.reset > Date.now() && attempt.count >= 8)
        throw new FlowError("loginLimited", 429);
      user = readStore().users.find(
        (account) => account.username.toLowerCase() === identity,
      );
      if (!user || !verifyPassword(password, user.passwordHash)) {
        const previous = failures.get(identity);
        failures.set(identity, {
          count:
            previous && previous.reset > Date.now() ? previous.count + 1 : 1,
          reset: Date.now() + 15 * 60 * 1000,
        });
        throw new FlowError("loginFailed", 401);
      }
      failures.delete(identity);
      audit(user.id, "session.login", user.id);
    } else throw new FlowError("notFound", 404);
    const secure =
      new URL(request.url).protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";
    return Response.json(
      { user: publicUser(user) },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": `${SESSION_COOKIE}=${createSession(user)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? "; Secure" : ""}`,
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof FlowError ? error.code : "invalid" },
      {
        status: error instanceof FlowError ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
};
