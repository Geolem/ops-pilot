import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { prisma } from "./prisma.js";

export const SESSION_COOKIE = "ops_pilot_session";
const SESSION_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? 7);
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123456";

export type AuthUser = {
  id: string;
  username: string;
  otpEnabled: boolean;
  otpBoundAt: Date | null;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const iterations = 210_000;
  const digest = "sha512";
  const key = crypto.pbkdf2Sync(password, salt, iterations, 64, digest).toString("base64url");
  return `pbkdf2$${digest}$${iterations}$${salt}$${key}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [kind, digest, iterationsRaw, salt, expected] = encoded.split("$");
  if (kind !== "pbkdf2" || !digest || !iterationsRaw || !salt || !expected) return false;
  const actual = crypto
    .pbkdf2Sync(password, salt, Number(iterationsRaw), 64, digest)
    .toString("base64url");
  return timingSafeEqual(actual, expected);
}

export function randomSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

export async function ensureAdminUser() {
  const existing = await prisma.adminUser.findUnique({ where: { username: DEFAULT_ADMIN_USERNAME } });
  if (existing) return existing;

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[auth] ADMIN_PASSWORD is not set. Created default admin/admin123456; change it before exposing this service."
    );
  }

  return prisma.adminUser.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    },
  });
}

export async function createSession(reply: FastifyReply, userId: string) {
  const token = randomSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.adminSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeCurrentSession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(req: FastifyRequest): Promise<AuthUser | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    otpEnabled: session.user.otpEnabled,
    otpBoundAt: session.user.otpBoundAt,
  };
}

export function registerAuthGuard(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const url = req.raw.url ?? "";
    if (!url.startsWith("/api")) return;
    if (isPublicApi(url)) return;

    const user = await getSessionUser(req);
    if (!user) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "请先登录" });
      return;
    }
    req.authUser = user;
  });
}

function isPublicApi(url: string) {
  return url.startsWith("/api/auth/") || url === "/api/admin/auth/otp/reset" || url === "/api/health";
}

export function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
