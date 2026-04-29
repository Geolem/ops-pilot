import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export async function backupRoutes(app: FastifyInstance) {
  // Full export — returns JSON snapshot of all data
  app.get("/api/export", async (_req, reply) => {
    const [projects, environments, endpoints, flows] = await Promise.all([
      prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.environment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.endpoint.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.flow.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      environments,
      endpoints,
      flows,
    };
    reply
      .header("Content-Type", "application/json")
      .header(
        "Content-Disposition",
        `attachment; filename="ops-pilot-backup-${new Date().toISOString().slice(0, 10)}.json"`
      )
      .send(JSON.stringify(payload, null, 2));
  });

  // Full import — upserts every record by id
  const projectImportSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
  });

  const environmentImportSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string().min(1),
    baseUrl: z.string(),
    headers: z.string().optional().default("{}"),
    variables: z.string().optional().default("{}"),
  });

  const endpointImportSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    method: z.string().optional().default("GET"),
    path: z.string(),
    headers: z.string().optional().default("{}"),
    query: z.string().optional().default("{}"),
    body: z.string().optional().default(""),
    bodyType: z.string().optional().default("json"),
    tags: z.string().optional().default("[]"),
    extract: z.string().optional().default("{}"),
    preScript: z.string().optional().default(""),
    postScript: z.string().optional().default(""),
    starred: z.boolean().optional().default(false),
  });

  const flowImportSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    nodes: z.string().optional().default("[]"),
    edges: z.string().optional().default("[]"),
  });

  const importSchema = z.object({
    version: z.number().optional(),
    projects: z.array(projectImportSchema).optional().default([]),
    environments: z.array(environmentImportSchema).optional().default([]),
    endpoints: z.array(endpointImportSchema).optional().default([]),
    flows: z.array(flowImportSchema).optional().default([]),
  });

  app.post("/api/import", async (req, reply) => {
    const data = importSchema.parse(req.body);
    const stats = { projects: 0, environments: 0, endpoints: 0, flows: 0 };

    for (const p of data.projects) {
      const { id, ...rest } = p;
      await prisma.project.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
      stats.projects++;
    }

    for (const e of data.environments) {
      const { id, ...rest } = e;
      await prisma.environment.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
      stats.environments++;
    }

    for (const ep of data.endpoints) {
      const { id, ...rest } = ep;
      await prisma.endpoint.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
      stats.endpoints++;
    }

    for (const f of data.flows) {
      const { id, ...rest } = f;
      await prisma.flow.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
      stats.flows++;
    }

    reply.code(200).send({ ok: true, stats });
  });
}
