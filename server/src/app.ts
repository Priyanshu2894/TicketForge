import express from "express";
import { pool } from "./db/pool.js";
import eventsRouter from "./modules/events/events.routes.js";
import type {
  Request,
  Response,
  NextFunction,
} from "express";
import authRouter from "./modules/auth/auth.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";

const app = express();

app.use(express.json());

// Liveness check
app.get("/health/live", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TicketForge API is running",
  });
});

// Readiness check
app.get("/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      success: true,
      message: "Database connection is healthy",
    });
  } catch {
    res.status(503).json({
      success: false,
      message: "Database unavailable",
    });
  }
});

app.use("/api/v1/events", eventsRouter);

app.use("/api/v1/auth", authRouter);

app.use("/api/v1/admin", adminRouter);

app.use((
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Request failed:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;