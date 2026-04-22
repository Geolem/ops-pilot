import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { executeRequest } from "../services/executor.js";

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function evalCondition(
  expr: string | null | undefined,
  ctx: { status: number; body: unknown; headers: Record<string, string>; vars: Record<string, unknown> }
): boolean {
  if (!expr?.trim()) return true;
  try {
    const fn = new Function("status", "body", "headers", "vars", `return !!(${expr});`);
    return fn(ctx.status, ctx.body, ctx.headers, ctx.vars);
  } catch {
    return false;
  }
}

const flowSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  nodes: z.string().optional(),
  edges: z.string().optional(),
});

const flowRunSchema = z.object({
  environmentId: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    endpointId: z.string(),
    alias: z.string().optional(),
  })).min(1),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    condition: z.string().optional().nullable(),
  })).optional(),
  extraVariables: z.record(z.unknown()).optional(),
});

export async function flowRoutes(app: FastifyInstance) {
  app.get("/api/flows", async (req) => {
    const { projectId } = req.query as { projectId?: string };
    return prisma.flow.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: "desc" },
    });
  });

  app.get("/api/flows/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.flow.findUnique({ where: { id } });
  });

  app.post("/api/flows", async (req, reply) => {
    const data = flowSchema.parse(req.body);
    const created = await prisma.flow.create({ data });
    reply.code(201);
    return created;
  });

  app.patch("/api/flows/:id", async (req) => {
    const { id } = req.params as { id: string };
    const data = flowSchema.partial().parse(req.body);
    return prisma.flow.update({ where: { id }, data });
  });

  app.delete("/api/flows/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.flow.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  app.post("/api/flows/run", async (req) => {
    const input = flowRunSchema.parse(req.body);
    const env = input.environmentId
      ? await prisma.environment.findUnique({ where: { id: input.environmentId } })
      : null;

    const baseVars = env ? safeParseJson<Record<string, unknown>>(env.variables, {}) : {};
    const envHeaders = env ? safeParseJson<Record<string, string>>(env.headers, {}) : {};
    const scope: Record<string, unknown> = { ...baseVars, ...(input.extraVariables ?? {}) };
    const results: any[] = [];

    const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));
    const edges = input.edges ?? [];

    // build adjacency: nodeId -> outgoing edges
    const outgoing = new Map<string, { target: string; condition?: string | null }[]>();
    const incomingCount = new Map<string, number>();
    for (const n of input.nodes) { outgoing.set(n.id, []); incomingCount.set(n.id, 0); }
    for (const e of edges) {
      outgoing.get(e.source)?.push({ target: e.target, condition: e.condition });
      incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
    }

    // roots = nodes with no incoming edges
    const roots = input.nodes.filter((n) => !incomingCount.get(n.id)).map((n) => n.id);
    if (roots.length === 0 && input.nodes.length > 0) roots.push(input.nodes[0].id);

    const queue: string[] = [...roots];
    const executed = new Set<string>();
    const queued = new Set<string>(roots);

    while (queue.length) {
      const nodeId = queue.shift()!;
      if (executed.has(nodeId)) continue;
      executed.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const ep = await prisma.endpoint.findUnique({ where: { id: node.endpointId } });
      if (!ep) {
        results.push({ nodeId, error: "endpoint not found", skipped: true });
        continue;
      }

      const epHeaders = safeParseJson<Record<string, string>>(ep.headers, {});
      const epQuery = safeParseJson<Record<string, string>>(ep.query, {});
      const epExtract = safeParseJson<Record<string, string>>(ep.extract, {});

      const result = await executeRequest({
        method: ep.method,
        baseUrl: env?.baseUrl ?? "",
        path: ep.path,
        headers: { ...envHeaders, ...epHeaders },
        query: epQuery,
        body: ep.body,
        bodyType: (ep.bodyType as any) ?? "json",
        variables: scope,
        extract: epExtract,
        preScript: ep.preScript ?? "",
        postScript: ep.postScript ?? "",
      });

      const alias = node.alias?.trim() || ep.name.replace(/\s+/g, "_");
      scope[alias] = { status: result.status, body: result.responseBody, headers: result.responseHeaders };
      Object.assign(scope, result.extracted);

      results.push({ nodeId, endpointId: ep.id, endpointName: ep.name, alias, result });

      // evaluate outgoing edges
      const condCtx = {
        status: result.status,
        body: result.responseBody as unknown,
        headers: result.responseHeaders,
        vars: scope,
      };
      for (const edge of (outgoing.get(nodeId) ?? [])) {
        if (executed.has(edge.target) || queued.has(edge.target)) continue;
        if (evalCondition(edge.condition, condCtx)) {
          queued.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    if (env) {
      await prisma.environment.update({
        where: { id: env.id },
        data: { variables: JSON.stringify(scope) },
      });
    }

    return { scope, steps: results };
  });
}
