import { pool } from "../../db/pool.js";
import type { z } from "zod";
import type {
  createEventSchema,
  createTicketTypeSchema,
} from "./admin-events.schema.js";
import { updateDraftEventSchema } from "./admin-events.schema.js";

type CreateEvent = z.infer<typeof createEventSchema>;
type CreateTicketType = z.infer<typeof createTicketTypeSchema>;

export async function createDraftEvent(
  data: CreateEvent,
  adminId: string
) {
  const result = await pool.query(
    `INSERT INTO events (
       title, description, category, city, venue,
       starts_at, ends_at,
       booking_opens_at, booking_closes_at,
       status, created_by
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       'DRAFT', $10
     )
     RETURNING *`,
    [
      data.title,
      data.description,
      data.category,
      data.city,
      data.venue,
      data.starts_at,
      data.ends_at,
      data.booking_opens_at,
      data.booking_closes_at,
      adminId,
    ]
  );

  return result.rows[0];
}

export async function addTicketType(
  eventId: string,
  data: CreateTicketType
) {
  const result = await pool.query(
    `WITH draft_event AS (
       SELECT id
       FROM events
       WHERE id = $1 AND status = 'DRAFT'
       FOR UPDATE
     )
     INSERT INTO ticket_types (
       event_id, name, price_minor, total_quantity
     )
     SELECT id, $2, $3, $4
     FROM draft_event
     RETURNING *`,
    [
      eventId,
      data.name,
      data.price_minor,
      data.total_quantity,
    ]
  );

  return result.rows[0] ?? null;
}

export async function publishEvent(eventId: string) {
  const result = await pool.query(
    `UPDATE events AS e
     SET status = 'PUBLISHED',
         updated_at = NOW()
     WHERE e.id = $1
       AND e.status = 'DRAFT'
       AND e.starts_at > NOW()
       AND e.booking_closes_at > NOW()
       AND EXISTS (
         SELECT 1
         FROM ticket_types t
         WHERE t.event_id = e.id
           AND t.total_quantity > 0
       )
     RETURNING *`,
    [eventId]
  );

  return result.rows[0] ?? null;
}

type UpdateDraftEvent = z.infer<typeof updateDraftEventSchema>;

export async function listAdminEvents() {
  const result = await pool.query(`
    SELECT
      id, title, category, city,
      starts_at, status, created_at
    FROM events
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `);

  return result.rows;
}

export async function updateDraftEvent(
  eventId: string,
  data: UpdateDraftEvent
) {
  const result = await pool.query(
    `UPDATE events
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         category = COALESCE($4, category),
         city = COALESCE($5, city),
         venue = COALESCE($6, venue),
         starts_at = COALESCE($7::timestamptz, starts_at),
         ends_at = COALESCE($8::timestamptz, ends_at),
         booking_opens_at = COALESCE($9::timestamptz, booking_opens_at),
         booking_closes_at = COALESCE($10::timestamptz, booking_closes_at),
         updated_at = NOW()
     WHERE id = $1
       AND status = 'DRAFT'
     RETURNING *`,
    [
      eventId,
      data.title ?? null,
      data.description ?? null,
      data.category ?? null,
      data.city ?? null,
      data.venue ?? null,
      data.starts_at ?? null,
      data.ends_at ?? null,
      data.booking_opens_at ?? null,
      data.booking_closes_at ?? null,
    ]
  );

  return result.rows[0] ?? null;
}