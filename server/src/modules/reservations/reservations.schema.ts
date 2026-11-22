import { z } from "zod";

export const createReservationSchema = z.strictObject({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().min(1).max(4),
});

export type CreateReservationInput =
  z.infer<typeof createReservationSchema>;