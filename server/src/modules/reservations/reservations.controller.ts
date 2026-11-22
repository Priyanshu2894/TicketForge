import type { Request, Response } from "express";

import { createReservationSchema } from "./reservations.schema.js";
import { createReservation } from "./reservations.service.js";
import { z } from "zod";
import { cancelReservation } from "./reservations.service.js";
import { confirmReservation } from "./reservations.service.js";
import {getMyReservations,getReservationDetails} from "./reservations.service.js"

export async function reserveTickets(
  req: Request,
  res: Response
) {
  const parsed = createReservationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid reservation request",
    });
    return;
  }

  const userId = req.authUser!.id;

  const reservation = await createReservation(
    userId,
    parsed.data
  );

  if (!reservation) {
    res.status(409).json({
      success: false,
      message: "Tickets unavailable or booking not open",
    });
    return;
  }

  res.status(201).json({
    success: true,
    message: "Tickets reserved successfully",
    data: reservation,
  });
}


export async function cancelTickets(
  req: Request<{ reservationId: string }>,
  res: Response
) {
  const parsed = z.uuid().safeParse(
    req.params.reservationId
  );

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid reservation ID",
    });
    return;
  }

  const result = await cancelReservation(
    parsed.data,
    req.authUser!.id
  );

  if (result.outcome === "not_found") {
    res.status(404).json({
      success: false,
      message: "Reservation not found",
    });
    return;
  }

  if (result.outcome === "not_cancellable") {
    res.status(409).json({
      success: false,
      message: "Reservation is not eligible for cancellation",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Reservation cancelled successfully",
    data: result.reservation,
  });
}



export async function confirmTickets(
  req: Request<{ reservationId: string }>,
  res: Response
) {
  const parsed = z.uuid().safeParse(
    req.params.reservationId
  );

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid reservation ID",
    });
    return;
  }

  const result = await confirmReservation(
    parsed.data,
    req.authUser!.id
  );

  if (result.outcome === "not_found") {
    res.status(404).json({
      success: false,
      message: "Reservation not found",
    });
    return;
  }

  if (result.outcome === "not_confirmable") {
    res.status(409).json({
      success: false,
      message: "Reservation cannot be confirmed",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Booking confirmed successfully",
    data: result.booking,
  });
}



const reservationQuerySchema = z.object({
  page: z.coerce.number()
    .int()
    .min(1)
    .max(100000)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(20),
});

export async function listMyReservations(
  req: Request,
  res: Response
) {
  const parsed = reservationQuerySchema.safeParse(
    req.query
  );

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid pagination parameters",
    });
    return;
  }

  const { page, limit } = parsed.data;

  const reservations = await getMyReservations(
    req.authUser!.id,
    page,
    limit
  );

  res.status(200).json({
    success: true,
    data: {
      reservations,
      page,
      limit,
    },
  });
}

export async function getReservationById(
  req: Request<{ reservationId: string }>,
  res: Response
) {
  const parsed = z.uuid().safeParse(
    req.params.reservationId
  );

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid reservation ID",
    });
    return;
  }

  const reservation = await getReservationDetails(
    parsed.data,
    req.authUser!.id
  );

  if (!reservation) {
    res.status(404).json({
      success: false,
      message: "Reservation not found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { reservation },
  });
}

