import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import pinoHttp from "pino-http";
import { createServer } from "http";
import { logger } from "./lib/logger";
import { pool } from "./db";
import healthRoutes from "./routes/index";

let app: Express;
let server: ReturnType<typeof createServer>;

async function buildApp() {
  const expressApp = express();

  expressApp.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  expressApp.set("trust proxy", 1);

  expressApp.use("/api", healthRoutes);

  expressApp.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }));

  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.headers.origin) {
      res.header("Access-Control-Allow-Origin", req.headers.origin);
    }
    if (req.method === "OPTIONS") {
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      return res.status(200).end();
    }
    next();
  });

  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("Content-Security-Policy-Report-Only");
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://www.google.com https://www.gstatic.com https://maps.googleapis.com https://*.youtube.com https://*.ytimg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.youtube.com https://*.ytimg.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http: https://*.ytimg.com https://*.youtube.com https://*.ggpht.com",
      "media-src 'self' data: blob: https: http: https://*.youtube.com https://*.googlevideo.com",
      "connect-src 'self' ws: wss: https: http: https://*.youtube.com https://*.googlevideo.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://player.vimeo.com https://www.google.com https://maps.googleapis.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "child-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com",
    ];
    res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  // Doubled from 50mb so banner-slide saves (including the inline/base64
  // fallback used when object storage is unavailable) can hold larger images.
  expressApp.use(express.json({ limit: "200mb" }));
  expressApp.use(express.urlencoded({ extended: true, limit: "200mb" }));
  expressApp.use(cookieParser());

  // DMCA quarantine gate: 404 any media request for a quarantined file before
  // any storage proxy / static / direct-file route can serve it. Fails closed.
  const { quarantineGateMiddleware } = await import("./dmca/quarantine");
  expressApp.use(quarantineGateMiddleware());
  // Legal holds: turn a refused permanent delete into a clear 423 response
  // even when the route's own catch block would answer a generic 500.
  const { legalHoldResponseMiddleware } = await import("./dmca/storage-guards");
  expressApp.use(legalHoldResponseMiddleware());
  const { stripServerOnlyBodyFieldsMiddleware } = await import("./dmca/server-only-fields");
  expressApp.use(stripServerOnlyBodyFieldsMiddleware());

  const connectPgSimple = (await import("connect-pg-simple")).default;
  const PgSession = connectPgSimple(session);

  const isProduction = process.env.NODE_ENV === "production" ||
    process.env.REPLIT_DEPLOYMENT === "true";

  const sessionConfig = {
    store: new PgSession({
      pool: pool,
      tableName: "session",
    }),
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "dev_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
    },
    proxy: true,
  };

  expressApp.use(session(sessionConfig));

  const { setupAuth } = await import("./auth");
  setupAuth(expressApp);

  const dmcaEvidenceRouter = (await import("./routes/dmca-evidence")).default;
  expressApp.use("/api/dmca", dmcaEvidenceRouter);

  try {
    const { analyticsMiddleware } = await import("./analytics-service");
    expressApp.use(analyticsMiddleware);
  } catch (e) {
    logger.warn({ err: e }, "Could not load analytics middleware");
  }

  const httpServer = createServer(expressApp);

  const { registerRoutes } = await import("./main-routes");
  await registerRoutes(expressApp);

  const optionalMiddlewares: Array<{ name: string; load: () => Promise<(...args: any[]) => any> }> = [
    { name: "calendarMediaFallbackMiddleware", load: async () => (await import("./calendar-media-fallback")).calendarMediaFallbackMiddleware },
    { name: "forumMediaRedirectMiddleware",    load: async () => (await import("./forum-media-redirect-middleware")).default },
    { name: "attachmentMediaMiddleware",       load: async () => (await import("./attachment-media-middleware")).attachmentMediaMiddleware },
    { name: "attachmentStorageProxyMiddleware",load: async () => (await import("./attachment-storage-proxy")).attachmentStorageProxyMiddleware },
    { name: "directFileServerMiddleware",      load: async () => (await import("./direct-file-server")).directFileServerMiddleware },
    { name: "ogTagsMiddleware",                load: async () => (await import("./og-tags-middleware")).ogTagsMiddleware },
  ];

  for (const { name, load } of optionalMiddlewares) {
    try {
      const fn = await load();
      if (typeof fn === "function") {
        expressApp.use(fn);
      } else {
        logger.warn({ middleware: name }, "Optional middleware loaded but is not a function — skipping");
      }
    } catch (e) {
      logger.warn({ middleware: name, err: e instanceof Error ? e.message : String(e) }, "Optional middleware failed to load — skipping");
    }
  }

  expressApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Multer raises a file-size error when an upload exceeds the configured
    // limit. Surface it as a clear 413 so the client can show a friendly toast
    // instead of a generic 500 / silently stuck Save button.
    if (err && err.code === "LIMIT_FILE_SIZE") {
      logger.warn({ url: req.url }, "Upload rejected: file too large");
      if (!res.headersSent) {
        res.status(413).json({
          message: "File too large. Please choose a file under 200MB.",
        });
      }
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    logger.error({ err, url: req.url }, "Unhandled error");
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  return { app: expressApp, server: httpServer };
}

let appPromise: Promise<{ app: Express; server: ReturnType<typeof createServer> }> | null = null;

export function getApp() {
  if (!appPromise) {
    appPromise = buildApp();
  }
  return appPromise;
}

export default getApp;
