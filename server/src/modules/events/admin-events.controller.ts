import type { Request, Response } from "express";
import { z } from "zod";

import {
  createEventSchema,
  createTicketTypeSchema,
} from "./admin-events.schema.js";

import {
  createDraftEvent,
  addTicketType,
  publishEvent,
} from "./admin-events.service.js";

import {
  listAdminEvents,
  updateDraftEvent,
} from "./admin-events.service.js";

import { updateDraftEventSchema } from "./admin-events.schema.js";

function isUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function createEvent(
  req: Request,
  res: Response
) {
  const parsed = createEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid event data",
      errors: parsed.error.issues,
    });
    return;
  }

  const adminId = req.authUser!.id;
  const event = await createDraftEvent(parsed.data, adminId);

  res.status(201).json({
    success: true,
    data: event,
  });
}

export async function createTicketType(
  req: Request<{ eventId: string }>,
  res: Response
) {
  const eventId = z.uuid().safeParse(req.params.eventId);
  const parsed = createTicketTypeSchema.safeParse(req.body);

  if (!eventId.success || !parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid ticket-type request",
    });
    return;
  }

  try {
    const ticket = await addTicketType(
      eventId.data,
      parsed.data
    );

    if (!ticket) {
      res.status(409).json({
        success: false,
        message: "Event not found or not in DRAFT",
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({
        success: false,
        message: "Ticket category already exists",
      });
      return;
    }

    throw error;
  }
}

export async function publish(
  req: Request<{ eventId: string }>,
  res: Response
) {
  const eventId = z.uuid().safeParse(req.params.eventId);

  if (!eventId.success) {
    res.status(400).json({
      success: false,
      message: "Invalid event ID",
    });
    return;
  }

  const event = await publishEvent(eventId.data);

  if (!event) {
    res.status(409).json({
      success: false,
      message:
        "Event cannot be published. Check its status, dates and ticket inventory.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Event published successfully",
    data: event,
  });
}

export async function listEventsAdmin(
  _req: Request,
  res: Response
) {
  const events = await listAdminEvents();

  res.status(200).json({
    success: true,
    data: events,
  });
}

export async function updateEvent(
  req: Request<{ eventId: string }>,
  res: Response
) {
  const eventId = z.uuid().safeParse(req.params.eventId);
  const body = updateDraftEventSchema.safeParse(req.body);

  if (!eventId.success || !body.success) {
    res.status(400).json({
      success: false,
      message: "Invalid update request",
    });
    return;
  }

  try {
    const event = await updateDraftEvent(
      eventId.data,
      body.data
    );

    if (!event) {
      res.status(409).json({
        success: false,
        message: "Event not found or no longer DRAFT",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23514"
    ) {
      res.status(400).json({
        success: false,
        message: "Event violates a database CHECK constraint",
      });
      return;
    }

    throw error;
  }
}