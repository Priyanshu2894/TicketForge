
import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/authorize.middleware.js";

import {
  reserveTickets,
  cancelTickets,
  confirmTickets,
  listMyReservations,
  getReservationById,
} from "./reservations.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("CUSTOMER"));

// Read endpoints
router.get("/me", listMyReservations);
router.get("/:reservationId", getReservationById);

// Write endpoints
router.post("/", reserveTickets);
router.post("/:reservationId/cancel", cancelTickets);
router.post("/:reservationId/confirm", confirmTickets);

export default router;
