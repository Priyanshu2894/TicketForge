import { pool } from "../../db/pool.js";
import type { CreateReservationInput } from "./reservations.schema.js";
import { randomUUID } from "node:crypto";

type HeldTicket = {
  id: string;
  price_minor: string;
};

export async function createReservation(
  userId: string,
  input: CreateReservationInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Atomically hold available inventory
    const inventory = await client.query<HeldTicket>(
      `
      UPDATE ticket_types AS t
      SET
        held_quantity = t.held_quantity + $2,
        updated_at = clock_timestamp()
      FROM events AS e
      WHERE t.id = $1
        AND e.id = t.event_id
        AND e.status = 'PUBLISHED'
        AND e.booking_opens_at <= clock_timestamp()
        AND e.booking_closes_at > clock_timestamp()
        AND e.starts_at > clock_timestamp()
        AND t.total_quantity
            - t.held_quantity
            - t.sold_quantity >= $2
      RETURNING t.id, t.price_minor
      `,
      [input.ticketTypeId, input.quantity]
    );

    if (inventory.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    // Step 2: Use the trusted database price
    const priceMinor = inventory.rows[0]!.price_minor;

    // Step 3: Create the temporary reservation
    
const result = await client.query(
  `
  INSERT INTO reservations (
    user_id,
    ticket_type_id,
    quantity,
    unit_price_minor,
    total_amount_minor,
    expires_at
  )
  VALUES (
    $1,
    $2,
    $3::integer,
    $4::bigint,
    $4::bigint * ($3::integer)::bigint,
    clock_timestamp() + INTERVAL '10 minutes'
  )
  RETURNING
    id,
    ticket_type_id,
    quantity,
    unit_price_minor,
    total_amount_minor,
    status,
    expires_at
  `,
  [
    userId,
    input.ticketTypeId,
    input.quantity,
    priceMinor,
  ]
);

    // Step 4: Commit both changes together
    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Reservation rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}


type CancelledReservation = {
  id: string;
  ticket_type_id: string;
  quantity: number;
  status: "CANCELLED";
};

type CancelResult =
  | {
      outcome: "cancelled";
      reservation: CancelledReservation;
    }
  | { outcome: "not_found" }
  | { outcome: "not_cancellable" };

export async function cancelReservation(
  reservationId: string,
  userId: string
): Promise<CancelResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Transition only an owned, active HELD reservation.
    const result = await client.query<CancelledReservation>(
      `
      UPDATE reservations
      SET
        status = 'CANCELLED',
        updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
        AND status = 'HELD'
        AND expires_at > clock_timestamp()
      RETURNING
        id,
        ticket_type_id,
        quantity,
        status
      `,
      [reservationId, userId]
    );

    if (result.rowCount !== 1) {
      // Distinguish an unknown reservation from
      // one that is no longer cancellable.
      const existing = await client.query(
        `SELECT id
         FROM reservations
         WHERE id = $1::uuid
           AND user_id = $2::uuid`,
        [reservationId, userId]
      );

      await client.query("ROLLBACK");

      return existing.rowCount === 0
        ? { outcome: "not_found" }
        : { outcome: "not_cancellable" };
    }

    const reservation = result.rows[0]!;

    // 2. Release the held tickets.
    const inventory = await client.query(
      `
      UPDATE ticket_types
      SET
        held_quantity = held_quantity - $2::integer,
        updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND held_quantity >= $2::integer
      RETURNING id
      `,
      [reservation.ticket_type_id, reservation.quantity]
    );

    if (inventory.rowCount !== 1) {
      throw new Error(
        "Inventory inconsistency during cancellation"
      );
    }

    // 3. Commit both database changes.
    await client.query("COMMIT");

    return {
      outcome: "cancelled",
      reservation,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Cancellation rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}



type ConfirmedReservation = {
  id: string;
  user_id: string;
  ticket_type_id: string;
  quantity: number;
  total_amount_minor: string;
  confirmed_at: Date;
};

type Booking = {
  id: string;
  reservation_id: string;
  booking_reference: string;
  total_amount_minor: string;
  status: string;
  confirmed_at: Date;
};

type ConfirmResult =
  | { outcome: "confirmed"; booking: Booking }
  | { outcome: "not_found" }
  | { outcome: "not_confirmable" };

export async function confirmReservation(
  reservationId: string,
  userId: string
): Promise<ConfirmResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Atomically claim an active HELD reservation
    const result = await client.query<ConfirmedReservation>(
      `
      UPDATE reservations
      SET
        status = 'CONFIRMED',
        confirmed_at = clock_timestamp(),
        updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
        AND status = 'HELD'
        AND expires_at > clock_timestamp()
      RETURNING
        id,
        user_id,
        ticket_type_id,
        quantity,
        total_amount_minor,
        confirmed_at
      `,
      [reservationId, userId]
    );

    if (result.rowCount !== 1) {
      const existing = await client.query(
        `
        SELECT id
        FROM reservations
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        `,
        [reservationId, userId]
      );

      await client.query("ROLLBACK");

      return existing.rowCount === 0
        ? { outcome: "not_found" }
        : { outcome: "not_confirmable" };
    }

    const reservation = result.rows[0]!;

    // Step 2: Convert held inventory to sold inventory
    const inventory = await client.query(
      `
      UPDATE ticket_types
      SET
        held_quantity = held_quantity - $2::integer,
        sold_quantity = sold_quantity + $2::integer,
        updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND held_quantity >= $2::integer
      RETURNING id
      `,
      [
        reservation.ticket_type_id,
        reservation.quantity,
      ]
    );

    if (inventory.rowCount !== 1) {
      throw new Error(
        "Inventory inconsistency during confirmation"
      );
    }

    // Step 3: Create the permanent booking
    const bookingReference = `TF-${randomUUID()}`;

    const bookingResult = await client.query<Booking>(
      `
      INSERT INTO bookings (
        reservation_id,
        user_id,
        booking_reference,
        total_amount_minor,
        confirmed_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4::bigint,
        $5::timestamptz
      )
      RETURNING
        id,
        reservation_id,
        booking_reference,
        total_amount_minor,
        status,
        confirmed_at
      `,
      [
        reservation.id,
        reservation.user_id,
        bookingReference,
        reservation.total_amount_minor,
        reservation.confirmed_at,
      ]
    );

    if (bookingResult.rowCount !== 1) {
      throw new Error("Booking creation failed");
    }

    // Step 4: Commit all changes
    await client.query("COMMIT");

    return {
      outcome: "confirmed",
      booking: bookingResult.rows[0]!,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Confirmation rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}



const reservationSelectSql = `
  SELECT
    r.id AS reservation_id,
    r.status AS reservation_status,
    r.quantity,
    r.unit_price_minor,
    r.total_amount_minor,
    r.created_at,
    r.expires_at,
    r.confirmed_at,

    (
      r.status = 'HELD'
      AND r.expires_at > clock_timestamp()
    ) AS can_confirm,

    t.id AS ticket_type_id,
    t.name AS ticket_type,

    e.id AS event_id,
    e.title AS event_title,
    e.city,
    e.venue,
    e.starts_at,

    b.id AS booking_id,
    b.booking_reference

  FROM reservations r

  JOIN ticket_types t
    ON t.id = r.ticket_type_id

  JOIN events e
    ON e.id = t.event_id

  LEFT JOIN bookings b
    ON b.reservation_id = r.id
`;

export async function getMyReservations(
  userId: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `
    ${reservationSelectSql}
    WHERE r.user_id = $1::uuid
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT $2::integer
    OFFSET $3::integer
    `,
    [userId, limit, offset]
  );

  return result.rows;
}

export async function getReservationDetails(
  reservationId: string,
  userId: string
) {
  const result = await pool.query(
    `
    ${reservationSelectSql}
    WHERE r.id = $1::uuid
      AND r.user_id = $2::uuid
    LIMIT 1
    `,
    [reservationId, userId]
  );

  return result.rows[0] ?? null;
}

