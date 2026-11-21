import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/authorize.middleware.js";
import adminEventsRouter from "../events/admin-events.routes.js";

const router = Router();

// Protect every route under /api/v1/admin
router.use(authenticate);
router.use(requireRole("ADMIN"));

router.use("/events", adminEventsRouter);

export default router;