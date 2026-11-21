import { z } from "zod";

const dateTime = z.iso.datetime({ offset: true });

export const createEventSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
    category: z.string().trim().min(1).max(80),
    city: z.string().trim().min(1).max(120),
    venue: z.string().trim().min(1).max(255),
    starts_at: dateTime,
    ends_at: dateTime,
    booking_opens_at: dateTime,
    booking_closes_at: dateTime,
  })
  .refine(
    (data) =>
      Date.parse(data.ends_at) >
      Date.parse(data.starts_at),
    {
      message: "Event must end after it starts",
    }
  )
  .refine(
    (data) =>
      Date.parse(data.booking_opens_at) <
        Date.parse(data.booking_closes_at) &&
      Date.parse(data.booking_closes_at) <=
        Date.parse(data.starts_at),
    {
      message: "Invalid booking window",
    }
  );

export const createTicketTypeSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  price_minor: z.number().int().min(0).max(1_000_000_000),
  total_quantity: z.number().int().min(0).max(1_000_000),
});

export const updateDraftEventSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    venue: z.string().trim().min(1).max(255).optional(),
    starts_at: dateTime.optional(),
    ends_at: dateTime.optional(),
    booking_opens_at: dateTime.optional(),
    booking_closes_at: dateTime.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });