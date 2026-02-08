import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { iapAuthMiddleware } from "./iap.js";
import { logError } from "./logger.js";
import { router } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== config.publicBaseUrl) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use("/api", iapAuthMiddleware, router);

  const publicDir = process.env.STATIC_DIR
    ? path.resolve(process.env.STATIC_DIR)
    : path.resolve(__dirname, "../../web/dist");
  app.use(express.static(publicDir));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logError("Unhandled error", { message: err.message });
    res.status(500).json({ error: err.message });
  });

  return app;
}
