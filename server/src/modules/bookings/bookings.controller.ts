
import type { Request, Response } from "express";
import { z } from "zod";

import { getMyBookings } from "./bookings.service.js";

import {
  getBookingDetails,
} from "./bookings.service.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function listMyBookings(
  req: Request,
  res: Response
) {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid pagination parameters",
    });
    return;
  }

  const { page, limit } = parsed.data;

  const bookings = await getMyBookings(
    req.authUser!.id,
    page,
    limit
  );

  res.status(200).json({
    success: true,
    data: {
      bookings,
      page,
      limit,
    },
  });
}



export async function getBookingById(
  req: Request<{ bookingId: string }>,
  res: Response
) {
  const parsed = z.uuid().safeParse(req.params.bookingId);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid booking ID",
    });
    return;
  }

  const booking = await getBookingDetails(
    parsed.data,
    req.authUser!.id
  );

  if (!booking) {
    res.status(404).json({
      success: false,
      message: "Booking not found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { booking },
  });
}

