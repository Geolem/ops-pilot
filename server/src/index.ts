import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { projectRoutes } from "./routes/projects.js";
import { environmentRoutes } from "./routes/environments.js";
import { endpointRoutes } from "./routes/endpoints.js";
import { executeRoutes } from "./routes/execute.js";
import { flowRoutes } from "./routes/flows.js";
import { backupRoutes } from "./routes/backup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(cors, { origin: true, credentials: true });

  app.get("/api/health", async () => ({ ok: true, ts: Date.now() }));

  await app.register(projectRoutes);
  await app.register(environmentRoutes);
  await app.register(endpointRoutes);
  await app.register(executeRoutes);
  await app.register(flowRoutes);
  await app.register(backupRoutes);

  const webRoot = path.resolve(__dirname, "../../web/dist");
  if (fs.existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api")) {
        reply.code(404).send({ error: "Not Found" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`OpsPilot server listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
