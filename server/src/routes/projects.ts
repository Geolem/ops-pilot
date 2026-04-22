import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async () => {
    return prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        environments: true,
        _count: { select: { endpoints: true, flows: true } },
      },
    });
  });

  app.get("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.project.findUnique({
      where: { id },
      include: { environments: true, endpoints: true, flows: true },
    });
  });

  app.post("/api/projects", async (req, reply) => {
    const data = projectSchema.parse(req.body);
    const created = await prisma.project.create({ data });
    reply.code(201);
    return created;
  });

  app.patch("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const data = projectSchema.partial().parse(req.body);
    return prisma.project.update({ where: { id }, data });
  });

  app.delete("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.project.delete({ where: { id } });
    reply.code(204);
    return null;
  });
}
