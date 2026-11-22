
import { pool } from "../../db/pool.js";

export async function getMyBookings(
  userId: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `
    SELECT
      b.id AS booking_id,
      b.booking_reference,
      b.status AS booking_status,
      b.total_amount_minor,
      b.confirmed_at,

      e.id AS event_id,
      e.title AS event_title,
      e.city,
      e.venue,
      e.starts_at,

      t.name AS ticket_type,
      r.quantity,
      r.unit_price_minor

    FROM bookings b

    JOIN reservations r
      ON b.reservation_id = r.id

    JOIN ticket_types t
      ON r.ticket_type_id = t.id

    JOIN events e
      ON t.event_id = e.id

    WHERE b.user_id = $1::uuid

    ORDER BY b.confirmed_at DESC, b.id DESC

    LIMIT $2::integer OFFSET $3::integer
    `,
    [userId, limit, offset]
  );

  return result.rows;
}



export async function getBookingDetails(
  bookingId: string,
  userId: string
) {
  const result = await pool.query(
    `
    SELECT
      b.id AS booking_id,
      b.booking_reference,
      b.status AS booking_status,
      b.total_amount_minor,
      b.confirmed_at,

      r.id AS reservation_id,
      r.quantity,
      r.unit_price_minor,

      e.id AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.city,
      e.venue,
      e.starts_at,
      e.ends_at,

      t.id AS ticket_type_id,
      t.name AS ticket_type

    FROM bookings b

    JOIN reservations r
      ON b.reservation_id = r.id

    JOIN ticket_types t
      ON r.ticket_type_id = t.id

    JOIN events e
      ON t.event_id = e.id

    WHERE b.id = $1::uuid
      AND b.user_id = $2::uuid

    LIMIT 1
    `,
    [bookingId, userId]
  );

  return result.rows[0] ?? null;
}
