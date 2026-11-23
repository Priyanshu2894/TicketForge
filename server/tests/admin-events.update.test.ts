
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

// Never allow database-writing tests on the dev database.
const databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl ||
  new URL(databaseUrl).pathname !== "/ticketforge_test"
) {
  throw new Error(
    "Admin update tests require ticketforge_test database"
  );
}

const DAY = 24 * 60 * 60 * 1000;
const password = "AdminPatchTest@123";

const adminEmail =
  `patch-admin-${randomUUID()}@example.test`;

const customerEmail =
  `patch-customer-${randomUUID()}@example.test`;

type EventSnapshot = {
  id: string;
  title: string;
  venue: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  booking_opens_at: Date;
  booking_closes_at: Date;
};

describe("TicketForge admin event updates", () => {
  let adminToken = "";
  let customerToken = "";
  let draftEventId = "";
  let publishedEventId = "";

  const createdEvents: string[] = [];
  const createdUsers: string[] = [];

  async function register(
    name: string,
    email: string
  ) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name, email, password });

    expect(response.status).toBe(201);
    createdUsers.push(email);
  }

  async function login(email: string): Promise<string> {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);

    const token = response.body.data?.accessToken;

    if (typeof token !== "string") {
      throw new Error("Access token missing");
    }

    return token;
  }

  async function createDraft(title: string) {
    const now = Date.now();

    const response = await request(app)
      .post("/api/v1/admin/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title,
        description: "Admin PATCH regression test event",
        category: "Technology",
        city: "Bhopal",
        venue: "Original Test Hall",
        booking_opens_at: new Date(
          now - DAY
        ).toISOString(),
        booking_closes_at: new Date(
          now + 14 * DAY
        ).toISOString(),
        starts_at: new Date(
          now + 30 * DAY
        ).toISOString(),
        ends_at: new Date(
          now + 31 * DAY
        ).toISOString(),
      });

    expect(response.status).toBe(201);

    const id = response.body.data?.id;

    if (typeof id !== "string") {
      throw new Error("Created event ID missing");
    }

    createdEvents.push(id);
    return id;
  }

  async function getEvent(id: string) {
    const result = await pool.query<EventSnapshot>(
      `
      SELECT
        id, title, venue, status,
        starts_at, ends_at,
        booking_opens_at, booking_closes_at
      FROM events
      WHERE id = $1::uuid
      `,
      [id]
    );

    if (!result.rows[0]) {
      throw new Error("Test event not found");
    }

    return result.rows[0];
  }

  beforeAll(async () => {
    // Confirm the actual connected database, not just
    // the environment variable.
    const database = await pool.query<{
      name: string;
    }>(
      "SELECT current_database() AS name"
    );

    if (database.rows[0]?.name !== "ticketforge_test") {
      throw new Error("Connected to the wrong database!");
    }

    // Create users using the real registration endpoint.
    await register("Admin Patch Test", adminEmail);
    await register("Customer Patch Test", customerEmail);

    // Test-only ADMIN fixture creation.
    // Public registration must never grant ADMIN.
    const promoted = await pool.query(
      `
      UPDATE users
      SET role = 'ADMIN'
      WHERE email = $1
      RETURNING id
      `,
      [adminEmail]
    );

    expect(promoted.rowCount).toBe(1);

    // Obtain real JWTs with the real login endpoint.
    adminToken = await login(adminEmail);
    customerToken = await login(customerEmail);

    draftEventId = await createDraft(
      "PATCH Test Draft Event"
    );

    publishedEventId = await createDraft(
      "PATCH Test Published Event"
    );

    // Give the second draft a ticket category.
    const ticket = await request(app)
      .post(
        `/api/v1/admin/events/${publishedEventId}/ticket-types`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "General",
        price_minor: 29900,
        total_quantity: 50,
      });

    expect(ticket.status).toBe(201);

    // Publish through the actual API.
    const publish = await request(app)
      .post(
        `/api/v1/admin/events/${publishedEventId}/publish`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(publish.status).toBe(200);
  }, 30_000);

  afterAll(async () => {
    try {
      // Delete only records created by this test suite.
      if (createdEvents.length > 0) {
        await pool.query(
          `
          DELETE FROM ticket_types
          WHERE event_id = ANY($1::uuid[])
          `,
          [createdEvents]
        );

        await pool.query(
          `
          DELETE FROM events
          WHERE id = ANY($1::uuid[])
          `,
          [createdEvents]
        );
      }

      if (createdUsers.length > 0) {
        await pool.query(
          `
          DELETE FROM users
          WHERE email = ANY($1::text[])
          `,
          [createdUsers]
        );
      }
    } finally {
      await pool.end();
    }
  });

  it("updates a DRAFT event successfully", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/admin/events/${draftEventId}`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        venue: "Updated Regression Test Hall",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const event = await getEvent(draftEventId);

    expect(event.venue).toBe(
      "Updated Regression Test Hall"
    );

    expect(event.status).toBe("DRAFT");
  });

  it("rejects an end date before the start date", async () => {
    const before = await getEvent(draftEventId);

    const invalidEnd = new Date(
      before.starts_at.getTime() - 60_000
    ).toISOString();

    const response = await request(app)
      .patch(
        `/api/v1/admin/events/${draftEventId}`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ends_at: invalidEnd,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const after = await getEvent(draftEventId);

    // PostgreSQL rejected the update atomically.
    expect(after.ends_at.toISOString()).toBe(
      before.ends_at.toISOString()
    );
  });

  it("rejects an invalid booking closing time", async () => {
    const before = await getEvent(draftEventId);

    const invalidClose = new Date(
      before.starts_at.getTime() + 60_000
    ).toISOString();

    const response = await request(app)
      .patch(
        `/api/v1/admin/events/${draftEventId}`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        booking_closes_at: invalidClose,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const after = await getEvent(draftEventId);

    expect(after.booking_closes_at.toISOString()).toBe(
      before.booking_closes_at.toISOString()
    );
  });

  it("rejects updates to a PUBLISHED event", async () => {
    const before = await getEvent(publishedEventId);

    expect(before.status).toBe("PUBLISHED");

    const response = await request(app)
      .patch(
        `/api/v1/admin/events/${publishedEventId}`
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        venue: "Unauthorized Published Change",
      });

    expect(response.status).toBe(409);

    const after = await getEvent(publishedEventId);

    expect(after.venue).toBe(before.venue);
    expect(after.status).toBe("PUBLISHED");
  });

  it("rejects CUSTOMER attempts to edit events", async () => {
    const before = await getEvent(draftEventId);

    const response = await request(app)
      .patch(
        `/api/v1/admin/events/${draftEventId}`
      )
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        venue: "Customer Unauthorized Change",
      });

    expect(response.status).toBe(403);

    const after = await getEvent(draftEventId);

    expect(after.venue).toBe(before.venue);
  });
});
