import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  createSession,
  ensureAdminUser,
  getSessionUser,
  hashPassword,
  revokeCurrentSession,
  SESSION_COOKIE,
  timingSafeEqual,
  verifyPassword,
} from "../lib/auth.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from "../lib/totp.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  otpCode: z.string().optional(),
});

const otpVerifySchema = z.object({
  code: z.string().min(6),
});

const otpResetSchema = z.object({
  username: z.string().min(1).optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(12, "新密码至少需要 12 位")
    .max(128, "新密码最多 128 位")
    .refine((value) => /[a-z]/.test(value), "新密码需要包含小写字母")
    .refine((value) => /[A-Z]/.test(value), "新密码需要包含大写字母")
    .refine((value) => /\d/.test(value), "新密码需要包含数字")
    .refine((value) => /[^A-Za-z0-9]/.test(value), "新密码需要包含特殊字符"),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) {
      reply.code(401);
      return { error: "UNAUTHORIZED", message: "请先登录" };
    }
    return { user };
  });

  app.post("/api/auth/login", async (req, reply) => {
    await ensureAdminUser();
    const data = loginSchema.parse(req.body);
    const user = await prisma.adminUser.findUnique({ where: { username: data.username } });

    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      reply.code(401);
      return { error: "INVALID_CREDENTIALS", message: "用户名或密码错误" };
    }

    if (user.otpEnabled) {
      if (!data.otpCode) {
        reply.code(401);
        return { error: "OTP_REQUIRED", message: "请输入动态验证码" };
      }
      if (!user.otpSecret || !verifyTotp(data.otpCode, user.otpSecret)) {
        reply.code(401);
        return { error: "INVALID_OTP", message: "动态验证码无效或已过期" };
      }
    }

    await createSession(reply, user.id);
    return {
      user: {
        id: user.id,
        username: user.username,
        otpEnabled: user.otpEnabled,
        otpBoundAt: user.otpBoundAt,
      },
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await revokeCurrentSession(req, reply);
    reply.code(204);
    return null;
  });

  app.post("/api/auth/password", async (req, reply) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      reply.code(401);
      return { error: "UNAUTHORIZED", message: "请先登录" };
    }

    const data = passwordChangeSchema.parse(req.body);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: sessionUser.id } });
    if (!verifyPassword(data.currentPassword, user.passwordHash)) {
      reply.code(400);
      return { error: "INVALID_CURRENT_PASSWORD", message: "当前密码不正确" };
    }
    if (verifyPassword(data.newPassword, user.passwordHash)) {
      reply.code(400);
      return { error: "PASSWORD_REUSED", message: "新密码不能与当前密码相同" };
    }

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(data.newPassword) },
      }),
      prisma.adminSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/auth/otp/setup", async (req, reply) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      reply.code(401);
      return { error: "UNAUTHORIZED", message: "请先登录" };
    }

    const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: sessionUser.id } });
    if (user.otpEnabled) {
      reply.code(409);
      return { error: "OTP_ALREADY_BOUND", message: "OTP 已绑定，如需重置请在后台操作" };
    }

    const secret = user.otpSecret ?? generateTotpSecret();
    if (!user.otpSecret) {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { otpSecret: secret },
      });
    }

    return {
      secret,
      otpauthUri: buildOtpAuthUri({
        issuer: process.env.OTP_ISSUER ?? "OpsPilot",
        account: user.username,
        secret,
      }),
    };
  });

  app.post("/api/auth/otp/verify", async (req, reply) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      reply.code(401);
      return { error: "UNAUTHORIZED", message: "请先登录" };
    }

    const data = otpVerifySchema.parse(req.body);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: sessionUser.id } });
    if (!user.otpSecret || !verifyTotp(data.code, user.otpSecret)) {
      reply.code(400);
      return { error: "INVALID_OTP", message: "动态验证码无效或已过期" };
    }

    const updated = await prisma.adminUser.update({
      where: { id: user.id },
      data: { otpEnabled: true, otpBoundAt: new Date() },
    });

    return {
      user: {
        id: updated.id,
        username: updated.username,
        otpEnabled: updated.otpEnabled,
        otpBoundAt: updated.otpBoundAt,
      },
    };
  });

  app.post("/api/admin/auth/otp/reset", async (req, reply) => {
    const resetToken = process.env.ADMIN_OTP_RESET_TOKEN;
    const providedToken = req.headers["x-admin-reset-token"];
    if (!resetToken || typeof providedToken !== "string" || !timingSafeEqual(providedToken, resetToken)) {
      reply.code(403);
      return { error: "FORBIDDEN", message: "后台 OTP 重置 token 无效" };
    }

    const data = otpResetSchema.parse(req.body ?? {});
    const username = data.username ?? process.env.ADMIN_USERNAME ?? "admin";
    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user) {
      reply.code(404);
      return { error: "NOT_FOUND", message: "管理员不存在" };
    }

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: user.id },
        data: { otpSecret: null, otpEnabled: false, otpBoundAt: null },
      }),
      prisma.adminSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true };
  });
}
