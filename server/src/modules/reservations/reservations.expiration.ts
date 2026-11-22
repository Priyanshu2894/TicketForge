
import { pool } from "../../db/pool.js";

type ExpiredReservation = {
  id: string;
  ticket_type_id: string;
  quantity: number;
};

export async function expireReservationBatch(
  batchSize = 50
): Promise<number> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find expired holds and lock them.
    const due = await client.query<ExpiredReservation>(
      `
      SELECT id, ticket_type_id, quantity
      FROM reservations
      WHERE status = 'HELD'
        AND expires_at <= clock_timestamp()
      ORDER BY expires_at, id
      LIMIT $1::integer
      FOR UPDATE SKIP LOCKED
      `,
      [batchSize]
    );

    if (due.rows.length === 0) {
      await client.query("COMMIT");
      return 0;
    }

    const ids = due.rows.map((row) => row.id);

    // Change HELD to EXPIRED.
    const updated = await client.query(
      `
      UPDATE reservations
      SET status = 'EXPIRED',
          updated_at = clock_timestamp()
      WHERE id = ANY($1::uuid[])
        AND status = 'HELD'
      RETURNING id
      `,
      [ids]
    );

    if (updated.rowCount !== due.rows.length) {
      throw new Error("Expiration state mismatch");
    }

    // Group quantities by ticket category.
    const quantities = new Map<string, number>();

    for (const row of due.rows) {
      const existing = quantities.get(row.ticket_type_id) ?? 0;

      quantities.set(
        row.ticket_type_id,
        existing + row.quantity
      );
    }

    // Release inventory in a consistent lock order.
    const groups = [...quantities.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [ticketTypeId, quantity] of groups) {
      const released = await client.query(
        `
        UPDATE ticket_types
        SET held_quantity = held_quantity - $2::integer,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND held_quantity >= $2::integer
        RETURNING id
        `,
        [ticketTypeId, quantity]
      );

      if (released.rowCount !== 1) {
        throw new Error(
          `Inventory mismatch for ticket type ${ticketTypeId}`
        );
      }
    }

    await client.query("COMMIT");

    return due.rows.length;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Expiration rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}
