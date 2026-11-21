
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

afterAll(async () => {
  await pool.end();
});

describe("TicketForge API smoke tests", () => {
  it("responds to liveness checks", async () => {
    const response = await request(app)
      .get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("connects to PostgreSQL", async () => {
    const response = await request(app)
      .get("/health/ready");

    expect(response.status).toBe(200);
  });

  it("lists published events", async () => {
    const response = await request(app)
      .get("/api/v1/events");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("rejects an invalid event UUID", async () => {
    const response = await request(app)
      .get("/api/v1/events/invalid-id");

    expect(response.status).toBe(400);
  });

  it("rejects unauthenticated admin requests", async () => {
    const response = await request(app)
      .get("/api/v1/admin/events");

    expect(response.status).toBe(401);
  });

  it("rejects invalid JWTs", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("rejects public ADMIN registration", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Unauthorized Admin",
        email: "blocked-admin@example.test",
        password: "TestPassword#123",
        role: "ADMIN",
      });

    expect(response.status).toBe(400);
  });
});
