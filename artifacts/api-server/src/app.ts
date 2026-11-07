import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind a reverse proxy (Render, Railway, Fly, Nginx…) so req.protocol/ip are correct.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// The web app is served from the same origin (Vite proxy in dev, static files
// below in production), so CORS is only needed when CORS_ORIGIN is set
// explicitly, e.g. a frontend hosted on another domain.
const corsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (corsOrigins?.length) {
  app.use(cors({ credentials: true, origin: corsOrigins }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Reads CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from the environment.
app.use(clerkMiddleware());

app.use("/api", router);

// In production, serve the built web app (artifacts/barberflow/dist/public).
const staticDir = path.resolve(
  // dist/index.mjs -> ../../barberflow/dist/public
  process.env.STATIC_DIR ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../barberflow/dist/public"),
);
if (existsSync(path.join(staticDir, "index.html"))) {
  app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
  // SPA fallback: any non-API GET returns index.html.
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving web app");
}

export default app;
