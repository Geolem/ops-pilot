import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { executeRequest } from "../services/executor.js";

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const overrideSchema = z
  .object({
    method: z.string().optional(),
    path: z.string().optional(),
    headers: z.record(z.string()).optional(),
    query: z.record(z.string()).optional(),
    body: z.string().optional(),
    bodyType: z.enum(["json", "form", "text", "none"]).optional(),
    extract: z.record(z.string()).optional(),
  })
  .optional();

const runSchema = z.object({
  endpointId: z.string().optional(),
  environmentId: z.string().optional(),
  extraVariables: z.record(z.unknown()).optional(),
  override: overrideSchema,
  ad_hoc: z
    .object({
      method: z.string(),
      baseUrl: z.string().optional(),
      path: z.string(),
      headers: z.record(z.string()).optional(),
      query: z.record(z.string()).optional(),
      body: z.string().optional(),
      bodyType: z.enum(["json", "form", "text", "none"]).optional(),
    })
    .optional(),
});

export async function executeRoutes(app: FastifyInstance) {
  app.post("/api/run", async (req) => {
    const input = runSchema.parse(req.body);

    let env = null;
    if (input.environmentId) {
      env = await prisma.environment.findUnique({ where: { id: input.environmentId } });
    }

    let endpoint = null;
    if (input.endpointId) {
      endpoint = await prisma.endpoint.findUnique({ where: { id: input.endpointId } });
    }

    const envVars = env ? safeParseJson<Record<string, unknown>>(env.variables, {}) : {};
    const envHeaders = env ? safeParseJson<Record<string, string>>(env.headers, {}) : {};
    const scope = { ...envVars, ...(input.extraVariables ?? {}) };

    const method = input.override?.method ?? endpoint?.method ?? input.ad_hoc?.method ?? "GET";
    const path = input.override?.path ?? endpoint?.path ?? input.ad_hoc?.path ?? "";
    const baseUrl = env?.baseUrl ?? input.ad_hoc?.baseUrl ?? "";
    const endpointHeaders = endpoint ? safeParseJson<Record<string, string>>(endpoint.headers, {}) : {};
    const endpointQuery = endpoint ? safeParseJson<Record<string, string>>(endpoint.query, {}) : {};
    const endpointExtract = endpoint ? safeParseJson<Record<string, string>>(endpoint.extract, {}) : {};
    const mergedHeaders = {
      ...envHeaders,
      ...endpointHeaders,
      ...(input.ad_hoc?.headers ?? {}),
      ...(input.override?.headers ?? {}),
    };
    const mergedQuery = {
      ...endpointQuery,
      ...(input.ad_hoc?.query ?? {}),
      ...(input.override?.query ?? {}),
    };
    const body = input.override?.body ?? endpoint?.body ?? input.ad_hoc?.body ?? "";
    const bodyType =
      (input.override?.bodyType as any) ??
      (endpoint?.bodyType as any) ??
      input.ad_hoc?.bodyType ??
      "json";
    const extract = { ...endpointExtract, ...(input.override?.extract ?? {}) };

    const result = await executeRequest({
      method,
      baseUrl,
      path,
      headers: mergedHeaders,
      query: mergedQuery,
      body,
      bodyType,
      variables: scope,
      extract,
    });

    await prisma.history.create({
      data: {
        endpointId: endpoint?.id,
        environmentId: env?.id,
        method: result.method,
        url: result.url,
        status: result.status,
        durationMs: result.durationMs,
        requestHeaders: JSON.stringify(result.requestHeaders),
        requestBody: result.requestBody,
        responseHeaders: JSON.stringify(result.responseHeaders),
        responseBody: result.responseText?.slice(0, 200_000) ?? null,
        error: result.error ?? null,
      },
    });

    if (env && Object.keys(result.extracted).length) {
      const merged = { ...envVars, ...result.extracted };
      await prisma.environment.update({
        where: { id: env.id },
        data: { variables: JSON.stringify(merged) },
      });
    }

    return result;
  });

  app.get("/api/history", async (req) => {
    const { endpointId, limit } = req.query as { endpointId?: string; limit?: string };
    return prisma.history.findMany({
      where: endpointId ? { endpointId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit ? Math.min(Number(limit) || 20, 200) : 50,
    });
  });
}
