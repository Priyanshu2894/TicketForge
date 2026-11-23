# TicketForge

**A full-stack event ticket reservation platform focused on correctness under concurrent demand.**

TicketForge lets customers discover published events, reserve tickets for a limited time, confirm bookings, and review booking history. Administrators can create and edit draft events, configure ticket categories and inventory, and publish events.

Unlike a basic CRUD demo, the central backend challenge is **preventing overselling** when many customers attempt to reserve the same limited inventory. The MVP uses PostgreSQL transactions, atomic conditional SQL updates, database constraints, and an expiration worker to keep inventory consistent.

> **Project status:** Functional, locally tested MVP. Booking confirmation is simulated; no real payment gateway is integrated. This is a development/portfolio project, not a production ticket-sales deployment.

## Features

### Customer

- Register and log in with JWT-based authentication.
- Browse published events and inspect ticket categories, prices, and availability.
- Reserve a quantity of tickets while inventory remains and the booking window is open.
- View the reservation countdown, confirm a booking, or cancel a held reservation.
- View personal booking history and individual booking details.

### Administrator

- Log in with an `ADMIN` account (admin registration is not publicly available).
- View draft and published events.
- Create draft events and edit their details, dates, and booking windows.
- Add ticket categories with a price in minor currency units and a capacity.
- Publish an event only when its configuration passes backend validation.

### Reliability and data integrity

- Conditional inventory updates prevent selling or holding more than available capacity.
- Booking confirmation and cancellation use database transactions.
- A background expiration worker releases inventory from expired reservations.
- PostgreSQL constraints enforce valid event dates, booking windows, statuses, and relevant uniqueness rules.
- Ownership checks restrict customer access to their own reservations and bookings.
- Integration tests cover concurrency, lifecycle transitions, rollback, authorization, and admin updates.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| API | Node.js, Express, TypeScript |
| Database | PostgreSQL 17, `pg` with hand-written parameterized SQL |
| Migrations | Dbmate |
| Authentication | Argon2id password hashing, JWT, role-based authorization |
| Input validation | Zod |
| Backend testing | Vitest, Supertest, PostgreSQL test database |
| Local infrastructure | Docker (PostgreSQL) |

**Architecture choice:** The MVP deliberately uses `pg` and explicit SQL instead of an ORM so transaction boundaries, locking, constraints, and SQL behavior remain visible and testable.

## High-level architecture

```text
Browser
  |
  v
React + TypeScript (Vite dev server)
  |
  | /api/v1/*  [Vite dev proxy]
  v
Express API (TypeScript)
  |-- Public event routes
  |-- Authentication + CUSTOMER / ADMIN authorization
  |-- Admin event / ticket management
  |-- Reservation + booking services
  |-- Reservation expiration worker
  |
  v
PostgreSQL 17
  |-- users
  |-- events
  |-- ticket_types
  |-- reservations
  `-- bookings
```

The Vite proxy is for local development. A production deployment would need an appropriate frontend/API hosting and routing configuration.

## Reservation and booking lifecycle

1. A customer selects a published event and ticket category while its booking window is open.
2. `POST /api/v1/reservations` attempts an **atomic conditional update** of ticket inventory in PostgreSQL. A successful claim creates a `HELD` reservation with a **10-minute expiration**.
3. The checkout screen displays the expiration deadline provided by the backend. The browser countdown is informational; **the backend determines eligibility**.
4. Confirming a valid reservation converts held inventory into sold inventory and creates a booking transactionally.
5. Cancelling a held reservation releases its inventory. Expired reservations are recovered by a background worker using PostgreSQL row locking (`FOR UPDATE SKIP LOCKED`).
6. A uniqueness constraint prevents more than one booking from being created for the same reservation. A failed booking insert rolls back the encompassing transaction.

**Inventory invariant:**

```text
available_quantity = total_quantity - held_quantity - sold_quantity
```

The system does not trust the displayed availability for final acceptance: competing requests are resolved by database conditions and transactions.

## Database schema

Five versioned SQL migrations create the core tables:

| Table | Purpose |
| --- | --- |
| `users` | Customer/admin accounts and authentication data |
| `events` | Event details, publishing state, and booking window |
| `ticket_types` | Ticket category, price in minor units, capacity, held and sold quantities |
| `reservations` | Temporary or finalized ticket claims, quantity, price snapshot, expiration, and ownership |
| `bookings` | Confirmed booking records and references |

Relevant rules include `ends_at > starts_at`, `booking_opens_at < booking_closes_at`, and `booking_closes_at <= starts_at`. The actual SQL migrations in [`server/db/migrations`](server/db/migrations) are the source of truth for exact columns and constraints.

## API overview

Base prefix: `/api/v1`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/events` | List published events |
| `GET` | `/events/:eventId` | Event details and ticket categories |
| `POST` | `/auth/register` | Customer registration |
| `POST` | `/auth/login` | Login and receive an access token |
| `GET` | `/auth/me` | Current authenticated user |
| `GET` | `/admin/events` | Admin event listing |
| `POST` | `/admin/events` | Create a draft event |
| `PATCH` | `/admin/events/:eventId` | Edit a draft event |
| `POST` | `/admin/events/:eventId/ticket-types` | Add a ticket category to a draft |
| `POST` | `/admin/events/:eventId/publish` | Publish a valid draft |
| `POST` | `/reservations` | Hold ticket inventory |
| `GET` | `/reservations/me` | Customer's reservations |
| `GET` | `/reservations/:reservationId` | Customer-owned reservation details |
| `POST` | `/reservations/:reservationId/confirm` | Confirm reservation and create booking |
| `POST` | `/reservations/:reservationId/cancel` | Cancel a held reservation |
| `GET` | `/bookings/me` | Customer's booking history |
| `GET` | `/bookings/:bookingId` | Customer-owned booking details |

Health checks: `GET /health/live` and `GET /health/ready`.

Admin routes require the `ADMIN` role; reservation and booking routes require customer authentication and appropriate ownership. Refer to the Express route files for complete payload and response contracts.

## Local setup

### Prerequisites

- Node.js and npm (development was verified with Node.js 24).
- Docker Desktop or another running Docker engine.
- Git.

Two npm projects live in `server/` and `client/`; install dependencies separately.

### 1. Clone and install

```bash
git clone https://github.com/Priyanshu2894/TicketForge.git
cd TicketForge

cd server
npm ci
cd ../client
npm ci
```

### 2. Start PostgreSQL 17

The following is an **example for a fresh local setup**, not a command to run against the existing TicketForge database. Choose your own local password and keep it out of source control.

```bash
docker run -d \
  --name ticketforge-postgres \
  -e POSTGRES_USER=ticketforge \
  -e POSTGRES_PASSWORD=replace-with-a-local-password \
  -e POSTGRES_DB=ticketforge \
  -p 127.0.0.1:5432:5432 \
  -v ticketforge_pg_data:/var/lib/postgresql/data \
  postgres:17
```

For an existing setup, start the existing container instead of creating another one:

```bash
docker start ticketforge-postgres
```

### 3. Configure the backend environment

From `server/`:

```bash
cp .env.example .env
```

Configure the values in `server/.env` for your local environment:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port (local frontend proxy expects `4000`) |
| `DATABASE_URL` | PostgreSQL connection URL pointing to the **development** `ticketforge` database |
| `JWT_SECRET` | Long, unpredictable JWT signing secret |

A typical local connection URL has this shape:

```text
postgres://ticketforge:<YOUR_LOCAL_PASSWORD>@127.0.0.1:5432/ticketforge?sslmode=disable
```

Substitute your actual local credentials. If your password includes URL-special characters, URL-encode them. Generate a JWT secret with a cryptographic random generator rather than using a committed example secret.

**Never commit `server/.env`.** The repository intentionally tracks only `.env.example`.

### 4. Apply migrations

From `server/`, with `server/.env` configured:

```bash
npx --no-install dbmate status
npx --no-install dbmate up
npx --no-install dbmate status
```

The five migrations are:

```text
20261120085311_create_users.sql
20261120114537_create_events.sql
20261120115325_create_ticket_types.sql
20261120115853_create_reservations.sql
20261120115943_create_bookings.sql
```

On the verified local development machine all five were applied, with zero pending. Do not use `dbmate drop`, `reset`, or rollback against a database containing data you want to preserve.

### 5. Run backend and frontend

**Terminal A — backend:**

```bash
cd server
npm run dev
```

**Terminal B — frontend:**

```bash
cd client
npm run dev
```

The frontend is normally available at `http://localhost:5173`, and its Vite configuration proxies `/api` and `/health` to the backend at `http://localhost:4000`.

> **Admin access:** Public registration does not create admins. For local development, provision an admin through a trusted, restricted setup process; do not expose an endpoint that lets arbitrary visitors assign themselves the `ADMIN` role. No real or local demo passwords are stored in this repository.

## Testing and quality checks

### Backend

From `server/`:

```bash
npm run typecheck
npm run build
```

**Database-writing tests must run against a separate `ticketforge_test` database.** Never run them against `ticketforge` or production data.

For a **fresh** local installation, create the test database:

```bash
docker exec ticketforge-postgres \
  psql -U ticketforge -d postgres \
  -c 'CREATE DATABASE ticketforge_test OWNER ticketforge;'
```

Apply the same migrations to the test database by temporarily supplying a test `DATABASE_URL` to Dbmate. Example (replace the placeholder with your own local password):

```bash
DATABASE_URL='postgres://ticketforge:<YOUR_LOCAL_PASSWORD>@127.0.0.1:5432/ticketforge_test?sslmode=disable' \
  npx --no-install dbmate up
```

**Run tests with a safety-checked test URL derived from the configured development URL** (from `server/`):

```bash
node -r dotenv/config <<'NODE'
const { spawnSync } = require('node:child_process');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is missing');
const url = new URL(databaseUrl);
if (url.pathname !== '/ticketforge') {
  throw new Error('Expected the development ticketforge URL');
}
url.pathname = '/ticketforge_test';
const result = spawnSync('npm', ['test'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.toString() },
});
process.exit(result.status ?? 1);
NODE
```

**Verified backend baseline:** 21 passing tests in four suites:

| Suite | Tests |
| --- | ---: |
| API smoke | 7 |
| Reservation concurrency | 1 |
| Booking lifecycle and rollback | 8 |
| Admin event update regression | 5 |

The booking rollback suite intentionally causes a PostgreSQL unique-constraint violation and verifies the transaction rolls back. An error message in this **passing test** is expected.

### Frontend

From `client/`:

```bash
npm run lint
npm run build
```

Both passed during the final MVP verification. The project does not currently include an automated frontend test suite.

## Important implementation decisions

- **Hand-written SQL (`pg`):** makes locking, transactions, and query behavior explicit.
- **Atomic inventory claim:** avoids unsafe read-then-write patterns under concurrency.
- **Transactions:** ensure reservation confirmation cannot partially update inventory and bookings.
- **Reservation expiration worker:** reclaims stale held inventory; `SKIP LOCKED` allows concurrent workers to avoid claiming the same locked rows.
- **Database constraints:** enforce important invariants even when API-level validation is incomplete.
- **Separate test database:** protects development data from destructive integration tests.
- **Price in minor units:** stores currency amounts as integers rather than binary floating point.

## Known MVP limitations / future work

- **Simulated payment confirmation:** no payment provider, webhook reconciliation, refund processing, or real charges.
- **Frontend token storage:** the MVP uses `sessionStorage` for access tokens. This has XSS exposure and warrants a production authentication/security review.
- **Production operations:** hosting, HTTPS, hardened security headers/CORS, monitoring, alerting, rate limiting, and deployment automation require further work or verification.
- **Frontend automated tests:** browser flows were exercised manually; comprehensive component/E2E automation remains future work.
- **Advanced infrastructure:** Redis caching, BullMQ/background-job infrastructure, and observability can be introduced after the MVP when a measured need justifies them.

## Repository structure

```text
TicketForge/
├── .gitignore
├── README.md
├── server/
│   ├── db/migrations/
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
└── client/
    ├── src/
    ├── public/
    ├── vite.config.ts
    ├── package.json
    └── package-lock.json
```

---

**Scope:** TicketForge is a portfolio-focused, learning-first MVP demonstrating practical backend design, transaction integrity, concurrency handling, role-based APIs, and full-stack integration.
