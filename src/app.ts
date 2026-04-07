import express from "express";
import { Role } from "@prisma/client";
import swaggerUi from "swagger-ui-express";

import analyticsRoutes from "./routes/analytics.routes";
import brandRoutes from "./routes/brand.routes";
import { openApiSpec } from "./swagger";

const app = express();
app.use(express.json());

// Replace with your JWT/session middleware.
// For local testing, pass x-user-id and x-user-role headers.
app.use((req, _res, next) => {
  const userId = req.header("x-user-id");
  const userRole = req.header("x-user-role") as Role | undefined;

  if (userId && userRole && Object.values(Role).includes(userRole)) {
    req.user = { id: userId, role: userRole };
  }

  next();
});

app.use("/brands", brandRoutes);
app.use("/analytics/logs", analyticsRoutes);
app.get("/docs.json", (_req, res) => res.json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

export default app;
