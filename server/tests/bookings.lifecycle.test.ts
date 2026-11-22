
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { expireReservationBatch } from "../src/modules/reservations/reservations.expiration.js";

// Safety: never run these tests against our development DB.
if (!process.env.DATABASE_URL?.includes("/ticketforge_test")) {
  throw new Error(
    "Lifecycle tests must use ticketforge_test database"
  );
}

describe("TicketForge booking lifecycle", () => {
  let userId = "";
  let eventId = "";
  let ticketTypeId = "";
  let token = "";

  const email = `lifecycle-${randomUUID()}@example.test`;
  const password = "TestPassword@123";

  async function getInventory() {
    const result = await pool.query<{
      held_quantity: number;
      sold_quantity: number;
    }>(
      `
      SELECT held_quantity, sold_quantity
      FROM ticket_types
      WHERE id = $1::uuid
      `,
      [ticketTypeId]
    );

    return result.rows[0]!;
  }

  async function reserve(quantity: number) {
    const response = await request(app)
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${token}`)
      .send({ ticketTypeId, quantity });

    expect(response.status).toBe(201);

    const id =
      response.body.data?.reservation?.id ??
      response.body.data?.id;

    if (typeof id !== "string") {
      throw new Error("Reservation ID missing from response");
    }

    return id;
  }

  beforeAll(async () => {
    // Create a customer through our real API.
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Lifecycle Test Customer",
        email,
        password,
      });

    expect(registered.status).toBe(201);

    const user = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    userId = user.rows[0]!.id;

    // Obtain a real JWT through login.
    const loggedIn = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(loggedIn.status).toBe(200);

    token = loggedIn.body.data.accessToken;

    // Insert an isolated published event.
    const event = await pool.query<{ id: string }>(
      `
      INSERT INTO events (
        title, description, category, city, venue,
        starts_at, ends_at,
        booking_opens_at, booking_closes_at,
        status, created_by
      )
      VALUES (
        'Lifecycle Test Event',
        'Automated booking tests',
        'Technology',
        'Bhopal',
        'Test Auditorium',
        clock_timestamp() + INTERVAL '30 days',
        clock_timestamp() + INTERVAL '31 days',
        clock_timestamp() - INTERVAL '1 day',
        clock_timestamp() + INTERVAL '25 days',
        'PUBLISHED',
        $1::uuid
      )
      RETURNING id
      `,
      [userId]
    );

    eventId = event.rows[0]!.id;

    // Create inventory specifically for these tests.
    const tickets = await pool.query<{ id: string }>(
      `
      INSERT INTO ticket_types (
        event_id, name, price_minor, total_quantity
      )
      VALUES ($1::uuid, 'General', 29900, 20)
      RETURNING id
      `,
      [eventId]
    );

    ticketTypeId = tickets.rows[0]!.id;
  });

  afterAll(async () => {
    // Delete only fixtures created by this test file.
    try {
      if (userId) {
        await pool.query(
          `DELETE FROM bookings WHERE user_id = $1::uuid`,
          [userId]
        );

        await pool.query(
          `DELETE FROM reservations WHERE user_id = $1::uuid`,
          [userId]
        );
      }

      if (ticketTypeId) {
        await pool.query(
          `DELETE FROM ticket_types WHERE id = $1::uuid`,
          [ticketTypeId]
        );
      }

      if (eventId) {
        await pool.query(
          `DELETE FROM events WHERE id = $1::uuid`,
          [eventId]
        );
      }

      if (userId) {
        await pool.query(
          `DELETE FROM users WHERE id = $1::uuid`,
          [userId]
        );
      }
    } finally {
      await pool.end();
    }
  });

  it("confirms a reservation exactly once", async () => {
    const id = await reserve(2);

    const before = await getInventory();
    expect(before.held_quantity).toBe(2);
    expect(before.sold_quantity).toBe(0);

    const confirmed = await request(app)
      .post(`/api/v1/reservations/${id}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(confirmed.status).toBe(200);

    // A duplicate confirmation must be rejected.
    const duplicate = await request(app)
      .post(`/api/v1/reservations/${id}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(duplicate.status).toBe(409);

    const after = await getInventory();
    expect(after.held_quantity).toBe(0);
    expect(after.sold_quantity).toBe(2);

    // Exactly one permanent booking must exist.
    const bookings = await pool.query(
      `SELECT id FROM bookings WHERE reservation_id = $1::uuid`,
      [id]
    );

    expect(bookings.rowCount).toBe(1);

    // It must appear in the customer's booking history.
    const history = await request(app)
      .get("/api/v1/bookings/me")
      .set("Authorization", `Bearer ${token}`);

    expect(history.status).toBe(200);
    expect(
      history.body.data.bookings.some(
        (booking: { booking_id: string }) =>
          booking.booking_id === bookings.rows[0].id
      )
    ).toBe(true);
  });

  it("releases tickets exactly once on cancellation", async () => {
    const id = await reserve(2);

    const first = await request(app)
      .post(`/api/v1/reservations/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(first.status).toBe(200);

    const duplicate = await request(app)
      .post(`/api/v1/reservations/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(duplicate.status).toBe(409);

    const inventory = await getInventory();
    expect(inventory.held_quantity).toBe(0);
    expect(inventory.sold_quantity).toBe(2);

    const result = await pool.query<{ status: string }>(
      `SELECT status FROM reservations WHERE id = $1::uuid`,
      [id]
    );

    expect(result.rows[0]!.status).toBe("CANCELLED");
  });

  it("expires abandoned reservations without double release", async () => {
    const id = await reserve(3);

    // Simulate the passage of time in the TEST database.
    // No need to wait ten real minutes.
    
    // Simulate a reservation created 11 minutes ago
    // whose 10-minute hold expired 1 minute ago.
    await pool.query(
      `
      WITH test_clock AS (
        SELECT clock_timestamp() AS current_time
      )
      UPDATE reservations AS r
      SET
        created_at = test_clock.current_time - INTERVAL '11 minutes',
        expires_at = test_clock.current_time - INTERVAL '1 minute'
      FROM test_clock
      WHERE r.id = $1::uuid
      `,
      [id]
    );


    const firstRun = await expireReservationBatch();
    expect(firstRun).toBe(1);

    // Running the worker again must not release tickets twice.
    const secondRun = await expireReservationBatch();
    expect(secondRun).toBe(0);

    const inventory = await getInventory();
    expect(inventory.held_quantity).toBe(0);
    expect(inventory.sold_quantity).toBe(2);

    const result = await pool.query<{ status: string }>(
      `SELECT status FROM reservations WHERE id = $1::uuid`,
      [id]
    );

    expect(result.rows[0]!.status).toBe("EXPIRED");

    const confirmation = await request(app)
      .post(`/api/v1/reservations/${id}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(confirmation.status).toBe(409);
  });

  it("allows only one winner in confirm vs cancel race", async () => {
    const id = await reserve(2);
    const before = await getInventory();

    // Fire both requests without waiting for either one.
    const [confirmation, cancellation] = await Promise.all([
      request(app)
        .post(`/api/v1/reservations/${id}/confirm`)
        .set("Authorization", `Bearer ${token}`),

      request(app)
        .post(`/api/v1/reservations/${id}/cancel`)
        .set("Authorization", `Bearer ${token}`),
    ]);

    expect(
      [confirmation.status, cancellation.status].sort()
    ).toEqual([200, 409]);

    const after = await getInventory();

    // Both outcomes must release this reservation's hold.
    expect(after.held_quantity).toBe(
      before.held_quantity - 2
    );

    const reservation = await pool.query<{ status: string }>(
      `SELECT status FROM reservations WHERE id = $1::uuid`,
      [id]
    );

    const status = reservation.rows[0]!.status;

    expect(["CONFIRMED", "CANCELLED"]).toContain(status);

    const bookings = await pool.query(
      `SELECT id FROM bookings WHERE reservation_id = $1::uuid`,
      [id]
    );

    if (status === "CONFIRMED") {
      expect(after.sold_quantity).toBe(
        before.sold_quantity + 2
      );
      expect(bookings.rowCount).toBe(1);
    } else {
      expect(after.sold_quantity).toBe(
        before.sold_quantity
      );
      expect(bookings.rowCount).toBe(0);
    }
  });

    it("rolls back confirmation when booking creation fails", async () => {
  // Create a valid HELD reservation.
  const id = await reserve(2);

  // Record inventory before attempting confirmation.
  const before = await getInventory();

  const reservationData = await pool.query<{
    total_amount_minor: string;
  }>(
    `
    SELECT total_amount_minor
    FROM reservations
    WHERE id = $1::uuid
    `,
    [id]
  );

  // Deliberately insert a conflicting booking.
  // This is test-only failure injection.
  await pool.query(
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
      clock_timestamp()
    )
    `,
    [
      id,
      userId,
      `TF-${randomUUID()}`,
      reservationData.rows[0]!.total_amount_minor,
    ]
  );

  try {
    // Confirmation should fail because this reservation
    // already has a booking row.
    const response = await request(app)
      .post(`/api/v1/reservations/${id}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(600);

    // Check that the reservation transition rolled back.
    const reservation = await pool.query<{
      status: string;
      confirmed_at: Date | null;
    }>(
      `
      SELECT status, confirmed_at
      FROM reservations
      WHERE id = $1::uuid
      `,
      [id]
    );

    expect(reservation.rows[0]!.status).toBe("HELD");
    expect(reservation.rows[0]!.confirmed_at).toBeNull();

    // Check that inventory changes also rolled back.
    const after = await getInventory();

    expect(after.held_quantity).toBe(before.held_quantity);
    expect(after.sold_quantity).toBe(before.sold_quantity);

    // Only our deliberately inserted booking should exist.
    const bookings = await pool.query(
      `
      SELECT id
      FROM bookings
      WHERE reservation_id = $1::uuid
      `,
      [id]
    );

    expect(bookings.rowCount).toBe(1);
  } finally {
    // Remove the deliberately inconsistent test fixture.
    await pool.query(
      `
      DELETE FROM bookings
      WHERE reservation_id = $1::uuid
      `,
      [id]
    );
  }
});


it("lists and retrieves the customer's own reservations", async () => {
  const id = await reserve(1);

  const list = await request(app)
    .get("/api/v1/reservations/me?page=1&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(list.status).toBe(200);

  expect(
    list.body.data.reservations.some(
      (reservation: { reservation_id: string }) =>
        reservation.reservation_id === id
    )
  ).toBe(true);

  const details = await request(app)
    .get(`/api/v1/reservations/${id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(details.status).toBe(200);
  expect(details.body.data.reservation.reservation_id).toBe(id);
  expect(details.body.data.reservation.reservation_status).toBe("HELD");
  expect(details.body.data.reservation.can_confirm).toBe(true);

  const invalid = await request(app)
    .get("/api/v1/reservations/abc")
    .set("Authorization", `Bearer ${token}`);

  expect(invalid.status).toBe(400);

  const unauthenticated = await request(app)
    .get(`/api/v1/reservations/${id}`);

  expect(unauthenticated.status).toBe(401);
});

it("does not expose a reservation to another customer", async () => {
  const id = await reserve(1);
  const otherEmail = `other-${randomUUID()}@example.test`;

  try {
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Another Test Customer",
        email: otherEmail,
        password,
      });

    expect(registered.status).toBe(201);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: otherEmail,
        password,
      });

    expect(login.status).toBe(200);

    const otherToken = login.body.data.accessToken;

    const details = await request(app)
      .get(`/api/v1/reservations/${id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(details.status).toBe(404);

    const list = await request(app)
      .get("/api/v1/reservations/me")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data.reservations).toEqual([]);
  } finally {
    await pool.query(
      `DELETE FROM users WHERE email = $1`,
      [otherEmail]
    );
  }
});


it("handles concurrent expiration workers and confirmation safely", async () => {
  // 1. Create a reservation for two tickets.
  const id = await reserve(2);

  const before = await getInventory();

  // 2. Make it expired while preserving valid timestamps.
  await pool.query(
    `
    WITH test_clock AS (
      SELECT clock_timestamp() AS current_time
    )
    UPDATE reservations AS r
    SET
      created_at = test_clock.current_time - INTERVAL '11 minutes',
      expires_at = test_clock.current_time - INTERVAL '1 minute'
    FROM test_clock
    WHERE r.id = $1::uuid
    `,
    [id]
  );

  // 3. Start two cleanup workers and a confirmation
  // request concurrently.
  const [worker1, worker2, confirmation] = await Promise.all([
    expireReservationBatch(50),
    expireReservationBatch(50),
    request(app)
      .post(`/api/v1/reservations/${id}/confirm`)
      .set("Authorization", `Bearer ${token}`),
  ]);

  // Only one worker should process this expired hold.
  expect(worker1 + worker2).toBe(1);

  // Confirmation is forbidden after expiration.
  expect(confirmation.status).toBe(409);

  // 4. Verify the reservation's final state.
  const reservation = await pool.query<{
    status: string;
    confirmed_at: Date | null;
  }>(
    `
    SELECT status, confirmed_at
    FROM reservations
    WHERE id = $1::uuid
    `,
    [id]
  );

  expect(reservation.rows[0]!.status).toBe("EXPIRED");
  expect(reservation.rows[0]!.confirmed_at).toBeNull();

  // 5. Inventory must be released exactly once.
  const after = await getInventory();

  expect(after.held_quantity).toBe(
    before.held_quantity - 2
  );

  expect(after.sold_quantity).toBe(
    before.sold_quantity
  );

  // 6. No booking should have been created.
  const bookings = await pool.query(
    `
    SELECT id
    FROM bookings
    WHERE reservation_id = $1::uuid
    `,
    [id]
  );

  expect(bookings.rowCount).toBe(0);
});


});
