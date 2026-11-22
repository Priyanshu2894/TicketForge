
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { createAccessToken } from "../src/modules/auth/auth.service.js";

let adminId = "";
let customerId = "";
let eventId = "";
let ticketTypeId = "";
let customerToken = "";

beforeAll(async () => {
  // Create isolated test users
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Test Admin', $1, 'test-only', 'ADMIN')
     RETURNING id`,
    [`admin-${randomUUID()}@example.test`]
  );
  adminId = admin.rows[0]!.id;

  const customer = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Test Customer', $1, 'test-only', 'CUSTOMER')
     RETURNING id`,
    [`customer-${randomUUID()}@example.test`]
  );
  customerId = customer.rows[0]!.id;

  customerToken = createAccessToken(customerId);

  // Create a test event with an open booking window
  const event = await pool.query<{ id: string }>(
    `INSERT INTO events (
      title, description, category, city, venue,
      starts_at, ends_at,
      booking_opens_at, booking_closes_at,
      status, created_by
    )
    VALUES (
      $1, 'Concurrency experiment', 'Technology',
      'Bhopal', 'Test Venue',
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days 8 hours',
      NOW() - INTERVAL '1 hour',
      NOW() + INTERVAL '29 days',
      'PUBLISHED', $2
    )
    RETURNING id`,
    [`Concurrency Test ${randomUUID()}`, adminId]
  );
  eventId = event.rows[0]!.id;

  // Only 10 tickets are available
  const ticket = await pool.query<{ id: string }>(
    `INSERT INTO ticket_types (
      event_id, name, price_minor, total_quantity
    )
    VALUES ($1, 'General', 29900, 10)
    RETURNING id`,
    [eventId]
  );
  ticketTypeId = ticket.rows[0]!.id;
});

afterAll(async () => {
  try {
    // Clean up only the records created by this test
    if (ticketTypeId) {
      await pool.query(
        "DELETE FROM reservations WHERE ticket_type_id = $1",
        [ticketTypeId]
      );
      await pool.query(
        "DELETE FROM ticket_types WHERE id = $1",
        [ticketTypeId]
      );
    }

    if (eventId) {
      await pool.query("DELETE FROM events WHERE id = $1", [eventId]);
    }

    if (customerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [customerId]);
    }

    if (adminId) {
      await pool.query("DELETE FROM users WHERE id = $1", [adminId]);
    }
  } finally {
    await pool.end();
  }
});

describe("TicketForge reservation concurrency", () => {
  it("never oversells 10 tickets across 100 requests", async () => {
    // Send 100 requests concurrently
    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        request(app)
          .post("/api/v1/reservations")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            ticketTypeId,
            quantity: 1,
          })
      )
    );

    const successful = responses.filter(r => r.status === 201);
    const rejected = responses.filter(r => r.status === 409);

    // Only 10 tickets can be reserved
    expect(successful).toHaveLength(10);
    expect(rejected).toHaveLength(90);

    // Verify the actual database inventory
    const inventory = await pool.query<{
      total_quantity: number;
      held_quantity: number;
      sold_quantity: number;
    }>(
      `SELECT total_quantity, held_quantity, sold_quantity
       FROM ticket_types
       WHERE id = $1`,
      [ticketTypeId]
    );

    const row = inventory.rows[0]!;

    expect(row.total_quantity).toBe(10);
    expect(row.held_quantity).toBe(10);
    expect(row.sold_quantity).toBe(0);

    // Every held ticket must have a reservation record
    const reservations = await pool.query<{
      count: string;
    }>(
      `SELECT COUNT(*) AS count
       FROM reservations
       WHERE ticket_type_id = $1
         AND status = 'HELD'`,
      [ticketTypeId]
    );

    expect(Number(reservations.rows[0]!.count)).toBe(10);
  }, 30000);
});
