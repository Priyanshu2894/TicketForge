
import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/authorize.middleware.js";

import {
  listMyBookings,
  getBookingById,
} from "./bookings.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("CUSTOMER"));

router.get("/me", listMyBookings);
router.get("/:bookingId", getBookingById);

export default router;
