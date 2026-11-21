import type { Request, Response } from "express";
import { z } from "zod";

import {
  getPublishedEvents,
  getPublishedEventById,
} from "./events.service.js";

export async function listEvents(
  _req: Request,
  res: Response
) {
  const events = await getPublishedEvents();

  res.status(200).json({
    success: true,
    data: events,
  });
}

export async function getEvent(
  req: Request<{ eventId: string }>,
  res: Response
) {
  const validation = z.uuid().safeParse(
    req.params.eventId
  );

  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Invalid event ID",
    });
    return;
  }

  const event = await getPublishedEventById(
    validation.data
  );

  if (!event) {
    res.status(404).json({
      success: false,
      message: "Event not found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: event,
  });
}