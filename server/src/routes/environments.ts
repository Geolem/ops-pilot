import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const envSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  baseUrl: z.string(),
  headers: z.string().optional(),
  variables: z.string().optional(),
});

export async function environmentRoutes(app: FastifyInstance) {
  app.get("/api/environments", async (req) => {
    const { projectId } = req.query as { projectId?: string };
    return prisma.environment.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { name: "asc" },
    });
  });

  app.post("/api/environments", async (req, reply) => {
    const data = envSchema.parse(req.body);
    const created = await prisma.environment.create({ data });
    reply.code(201);
    return created;
  });

  app.patch("/api/environments/:id", async (req) => {
    const { id } = req.params as { id: string };
    const data = envSchema.partial().parse(req.body);
    return prisma.environment.update({ where: { id }, data });
  });

  app.delete("/api/environments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.environment.delete({ where: { id } });
    reply.code(204);
    return null;
  });
}
