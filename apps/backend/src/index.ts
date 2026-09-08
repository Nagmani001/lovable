import { config } from "dotenv";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({
  path: `${path.join(__dirname, "..")}/.env`,
});
import client from "@prometheus-io/client";
import express, { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import cors from "cors";
import { shutdown } from "./lib/utils";
import { initEmail } from "./lib/email";
import { auth } from "./lib/auth";
import { projectRouter } from "./router/projectRouter";
import { authMiddleware } from "./middleware/authMiddleware";
import { initOrchestrator, shutdownOrchestrator } from "./lib/orchestrator";
import { initRedis } from "./lib/redis";
import { chatRouter } from "./router/chatRouter";
import { preetifyChatRouter } from "./router/preetifyChatRouter";
import { sandboxRouter } from "./router/sandboxRouter";
import { deployRouter } from "./router/deployRouter";
import { Server } from "http";
import { requestCountMiddleware } from "./lib/monitoring/middleware";
import { logger } from "./lib/logger";

const app = express();
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

app.use((req: Request, res: Response, next: () => void) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:5000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());

app.use(requestCountMiddleware);

app.get("/metrics", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", client.contentType);
  res.send(await client.register.metrics());
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    message: "backend is healthy",
  });
});

app.get("/error", (req: Request, res: Response) => {
  res.status(400).json({
    message: "error",
  });
});

app.use("/api/v1/project", authMiddleware, projectRouter);
app.use("/api/v1/chat", authMiddleware, chatRouter);
app.use("/api/v1/prettify", authMiddleware, preetifyChatRouter);
app.use("/api/v1/sandbox", authMiddleware, sandboxRouter);
app.use("/api/v1/deploy", authMiddleware, deployRouter);

export let server: Server;
async function main() {
  initEmail();
  await initRedis();
  initOrchestrator();

  server = app.listen(process.env.PORT, () => {
    logger.info(`server running on port ${process.env.PORT}`);
  });
}
main();

process.on("SIGINT", async () => {
  await shutdownOrchestrator();
  shutdown(0);
});
process.on("SIGTERM", async () => {
  await shutdownOrchestrator();
  shutdown(0);
});

process.on("uncaughtException", async (err) => {
  logger.error({ err }, "uncaught exception");
  await shutdownOrchestrator();
  shutdown(1);
});
