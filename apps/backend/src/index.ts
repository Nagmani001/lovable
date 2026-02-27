import express, { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import type { Server } from "node:http";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import { config } from "dotenv";
import cors from "cors";
import { shutdown } from "./lib/utils";
import { initEmail } from "@repo/email/email";
import { auth } from "./lib/auth";
import { projectRouter } from "./router/projectRouter";
import { authMiddleware } from "./middleware/authMiddleware";
import { initOrchestrator, shutdownOrchestrator } from "./lib/orchestrator";
import { chatRouter } from "./router/chatRouter";
import { sandboxRouter } from "./router/sandboxRouter";
import { deployRouter } from "./router/deployRouter";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: `${path.join(__dirname, "..")}/.env`,
});

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({
    message: "healthy",
  });
});

app.get("/error", (req: Request, res: Response) => {
  res.status(400).json({
    message: "error",
  });
});

app.use("/api/v1/project", authMiddleware, projectRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/sandbox", authMiddleware, sandboxRouter);
app.use("/api/v1/deploy", authMiddleware, deployRouter);

export let server: Server;

async function main() {
  if (process.env.RESEND_API_KEY) {
    initEmail({
      resendApiKey: process.env.RESEND_API_KEY,
    });
  } else {
    initEmail({
      smtp: {
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT!),
        user: process.env.SMTP_USER!,
        password: process.env.SMTP_PASSWORD!,
      },
    });
  }

  initOrchestrator();

  server = app.listen(process.env.PORT, () => {
    console.log(`server running on port ${process.env.PORT}`);
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
  console.error("uncaught:", err);
  await shutdownOrchestrator();
  shutdown(1);
});
