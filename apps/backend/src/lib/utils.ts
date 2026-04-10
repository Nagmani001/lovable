import { server } from "..";
import { Request } from "express";

export function shutdown(code = 0) {
  console.log("Shutting down gracefully...");
  server.close(() => {
    process.exit(code);
  });
  setTimeout(() => {
    process.exit(code);
  }, 5000);
}

export function getParam(req: Request, name: string): string {
  const val = req.params[name];
  if (typeof val === "string") return val;
  throw new Error(`Missing param: ${name}`);
}
