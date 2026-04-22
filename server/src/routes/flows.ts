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

const flowSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  nodes: z.string().optional(),
  edges: z.string().optional(),
});

const flowRunSchema = z.object({
  environmentId: z.string().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        endpointId: z.string(),
        alias: z.string().optional(),
      })
    )
    .min(1),
  edges: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
      })
    )
    .optional(),
  extraVariables: z.record(z.unknown()).optional(),
});

function orderNodesByEdges(
  nodes: { id: string; endpointId: string; alias?: string }[],
  edges: { source: string; target: string }[] | undefined
) {
  if (!edges || edges.length === 0) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, number>();
  const next = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, 0);
    next.set(n.id, []);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    next.get(e.source)!.push(e.target);
  }
  const queue: string[] = [];
  for (const [id, n] of incoming) if (n === 0) queue.push(id);
  const ordered: typeof nodes = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const target of next.get(id) ?? []) {
      const remaining = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, remaining);
      if (remaining <= 0) queue.push(target);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) ordered.push(n);
  return ordered;
}

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

    const ordered = orderNodesByEdges(input.nodes, input.edges);

    for (const node of ordered) {
      const ep = await prisma.endpoint.findUnique({ where: { id: node.endpointId } });
      if (!ep) {
        results.push({ nodeId: node.id, error: "endpoint not found" });
        break;
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
      });
      const alias = node.alias?.trim() || ep.name.replace(/\s+/g, "_");
      scope[alias] = {
        status: result.status,
        body: result.responseBody,
        headers: result.responseHeaders,
      };
      Object.assign(scope, result.extracted);
      results.push({
        nodeId: node.id,
        endpointId: ep.id,
        endpointName: ep.name,
        result,
      });
      if (result.error || result.status >= 400) break;
    }

    if (env && Object.keys(scope).length) {
      await prisma.environment.update({
        where: { id: env.id },
        data: { variables: JSON.stringify(scope) },
      });
    }

    return { scope, steps: results };
  });
}
