
import { Router } from "express";

import {
  createEvent,
  createTicketType,
  publish,
  listEventsAdmin,
  updateEvent,
} from "./admin-events.controller.js";

const router = Router();

// List all admin events
// GET /api/v1/admin/events
router.get("/", listEventsAdmin);

// Create a new draft event
// POST /api/v1/admin/events
router.post("/", createEvent);

// Update an existing draft event
// PATCH /api/v1/admin/events/:eventId
router.patch("/:eventId", updateEvent);

// Add ticket category to a draft event
// POST /api/v1/admin/events/:eventId/ticket-types
router.post("/:eventId/ticket-types", createTicketType);

// Publish a draft event
// POST /api/v1/admin/events/:eventId/publish
router.post("/:eventId/publish", publish);

export default router;
