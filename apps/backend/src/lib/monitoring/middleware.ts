import { Request, Response, NextFunction } from "express";
import {
  httpRequestCounter,
  httpRequestDurationHistogram,
  httpRequestsInFlight,
} from "./http";

export const requestCountMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const route = req.route ? req.route.path : "unmatched";
  const labels = { method: req.method, route };

  httpRequestsInFlight.inc(labels);

  const endTimer = httpRequestDurationHistogram.startTimer(labels);

  res.on("finish", () => {
    const status = res.statusCode;
    httpRequestCounter.inc({ ...labels, status_code: status });
    endTimer({ ...labels, status_code: status });
    httpRequestsInFlight.dec(labels);
  });

  next();
};
