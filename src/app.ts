import express, { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import swaggerUi from "swagger-ui-express";

import analyticsRoutes from "./routes/analytics.routes";
import authRoutes from "./routes/auth.routes";
import brandRoutes from "./routes/brand.routes";
import contactRoutes from "./routes/contact.routes";
import departmentRoutes from "./routes/department.routes";
import employeeTypeRoutes from "./routes/employee-type.routes";
import logRoutes from "./routes/log.routes";
import searchRoutes from "./routes/search.routes";
import { decryptEncryptedRequest, encryptEncryptedResponse } from "./middleware/encryption";
import { openApiSpec } from "./swagger";
import { verifyAccessToken } from "./utils/jwt";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const requireHttps = process.env.REQUIRE_HTTPS === "1" || process.env.NODE_ENV === "production";
if (requireHttps) {
  app.use((req, res, next) => {
    const proto = req.header("x-forwarded-proto");
    const isHttps = req.secure || proto === "https";
    if (isHttps) return next();
    return res.status(426).json({ message: "HTTPS is required" });
  });
  app.use((_req, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
}

app.use(decryptEncryptedRequest);
app.use(encryptEncryptedResponse);
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const userTag = req.user ? `${req.user.id} (${req.user.role})` : "anonymous";
    console.log(
      `[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms) user=${userTag}`,
    );
  });
  next();
});

// Replace with your JWT/session middleware.
// Supports Authorization Bearer token. For local testing, x-user-id/x-user-role still work.
app.use((req, _res, next) => {
  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = { id: decoded.userId, role: decoded.role };
      return next();
    }
  }

  const userId = req.header("x-user-id");
  const userRole = req.header("x-user-role") as Role | undefined;

  if (userId && userRole && Object.values(Role).includes(userRole)) {
    req.user = { id: userId, role: userRole };
  }

  next();
});

app.use("/auth", authRoutes);
app.use("/brands", brandRoutes);
app.use("/contacts", contactRoutes);
app.use("/departments", departmentRoutes);
app.use("/employee-types", employeeTypeRoutes);
app.use("/logs", logRoutes);
app.use("/search", searchRoutes);
app.use("/analytics/logs", analyticsRoutes);
app.get("/docs.json", (_req, res) => res.json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

// 404 – unknown route
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

// Global error handler – catches ValidationError, unhandled throws, etc.
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  const message = status < 500 ? err.message : "Internal server error";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ message });
});

export default app;
