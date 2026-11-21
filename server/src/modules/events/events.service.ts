import { pool } from "../../db/pool.js";

export async function getPublishedEvents() {
  const result = await pool.query(`
    SELECT
      id, title, description, category,
      city, venue, starts_at, ends_at,
      booking_opens_at, booking_closes_at
    FROM events
    WHERE status = 'PUBLISHED'
      AND ends_at > NOW()
    ORDER BY starts_at ASC, id ASC
  `);

  return result.rows;
}

export async function getPublishedEventById(
  eventId: string
) {
  const eventResult = await pool.query(
    `SELECT
       id, title, description, category,
       city, venue, starts_at, ends_at,
       booking_opens_at, booking_closes_at
     FROM events
     WHERE id = $1
       AND status = 'PUBLISHED'
       AND ends_at > NOW()`,
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    return null;
  }

  const ticketResult = await pool.query(
    `SELECT
       id, name, price_minor,
       total_quantity, held_quantity,
       sold_quantity,
       (total_quantity - held_quantity - sold_quantity)
         AS available_quantity
     FROM ticket_types
     WHERE event_id = $1
     ORDER BY price_minor ASC, name ASC`,
    [eventId]
  );

  return {
    ...eventResult.rows[0],
    ticket_types: ticketResult.rows,
  };
}