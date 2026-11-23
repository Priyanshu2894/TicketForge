
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../auth/useAuth";
import { apiGet, ApiError } from "../lib/api";
import {
  formatEventDate,
  formatPrice,
} from "../lib/event-types";

import type {
  BookingSummary,
  MyBookingsResponse,
} from "../lib/booking-types";

const PAGE_SIZE = 10;

type LoadResult = {
  userId: string;
  page: number;
  bookings: BookingSummary[];
  error: string;
};

export default function MyBookingsPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LoadResult | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!token || !userId) return;

    const controller = new AbortController();

    async function loadBookings() {
      try {
        const response = await apiGet<MyBookingsResponse>(
          `/bookings/me?page=${page}&limit=${PAGE_SIZE}`,
          controller.signal,
          token!
        );

        if (!Array.isArray(response.data?.bookings)) {
          throw new Error("Unexpected bookings response");
        }

        if (!controller.signal.aborted) {
          setResult({
            userId: userId!,
            page,
            bookings: response.data.bookings,
            error: "",
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        if (err instanceof ApiError && err.status === 401) {
          logout();
          navigate("/login", {
            replace: true,
            state: {
              from: "/bookings",
              notice: "Your session expired. Please log in.",
            },
          });
          return;
        }

        setResult({
          userId: userId!,
          page,
          bookings: [],
          error:
            err instanceof Error
              ? err.message
              : "Unable to load bookings",
        });
      }
    }

    void loadBookings();

    return () => controller.abort();
  }, [token, userId, page, logout, navigate]);

  // Only show results for the current user and page.

const current =
  result !== null &&
  result.userId === userId &&
  result.page === page
    ? result
    : null;

  if (!current) {
    return <p>Loading your bookings...</p>;
  }

  if (current.error) {
    return <p role="alert">{current.error}</p>;
  }

  const bookings = current.bookings;

  return (
    <section>
      <h1>My Bookings</h1>

      <p>View and manage your TicketForge booking history.</p>

      {bookings.length === 0 && (
        <div style={{ padding: 24, background: "white" }}>
          <p>
            {page === 1
              ? "You don't have any confirmed bookings yet."
              : "No bookings on this page."}
          </p>

          <Link to="/">Explore Events</Link>
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {bookings.map((booking) => (
          <article
            key={booking.booking_id}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {booking.event_title}
              </h2>

              <strong>{booking.booking_status}</strong>
            </div>

            <p>
              <strong>Date:</strong>{" "}
              {formatEventDate(booking.starts_at)}
            </p>

            <p>
              <strong>Venue:</strong>{" "}
              {booking.venue}, {booking.city}
            </p>

            <p>
              <strong>Tickets:</strong>{" "}
              {booking.ticket_type} × {booking.quantity}
            </p>

            <p>
              <strong>Total:</strong>{" "}
              {formatPrice(booking.total_amount_minor)}
            </p>

            <p>
              <strong>Reference:</strong>{" "}
              {booking.booking_reference}
            </p>

            <Link to={`/bookings/${booking.booking_id}`}>
              View Booking Details
            </Link>
          </article>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginTop: 24,
        }}
      >
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>

        <span>Page {page}</span>

        <button
          type="button"
          disabled={bookings.length < PAGE_SIZE}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
