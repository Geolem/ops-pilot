import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const endpointSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  method: z.string().default("GET"),
  path: z.string(),
  headers: z.string().optional(),
  query: z.string().optional(),
  body: z.string().optional(),
  bodyType: z.string().optional(),
  tags: z.string().optional(),
  extract: z.string().optional(),
});

export async function endpointRoutes(app: FastifyInstance) {
  app.get("/api/endpoints", async (req) => {
    const { projectId } = req.query as { projectId?: string };
    return prisma.endpoint.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: "desc" },
    });
  });

  app.get("/api/endpoints/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.endpoint.findUnique({ where: { id } });
  });

  app.post("/api/endpoints", async (req, reply) => {
    const data = endpointSchema.parse(req.body);
    const created = await prisma.endpoint.create({ data });
    reply.code(201);
    return created;
  });

  app.patch("/api/endpoints/:id", async (req) => {
    const { id } = req.params as { id: string };
    const data = endpointSchema.partial().parse(req.body);
    return prisma.endpoint.update({ where: { id }, data });
  });

  app.delete("/api/endpoints/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.endpoint.delete({ where: { id } });
    reply.code(204);
    return null;
  });
}
