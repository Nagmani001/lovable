import express, { Request, Response } from "express";
import type { Server } from "node:http";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import { config } from "dotenv";
import cors from "cors";
import { shutdown } from "./lib/utils";
import { initEmail } from "@repo/email/email";

/*
INFO: use these to interact with database and send emails
import { prisma } from "@repo/database/client";
import OtpTemplate from "@repo/email/template/OtpTemplate";
import { sendEmail } from "@repo/email/email";
 */

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: `${path.join(__dirname, "..")}/.env`,
});

app.use(express.json());

app.use(
  cors({
    origin: [process.env.FRONTEND_URL_DEPLOYED!, "http://localhost:3000"],
    optionsSuccessStatus: 200,
  }),
);

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

  server = app.listen(process.env.PORT, () => {
    console.log(`server running on port ${process.env.PORT}`);
  });
}
main();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (err) => {
  console.error("uncaught:", err);
  shutdown(1);
});
