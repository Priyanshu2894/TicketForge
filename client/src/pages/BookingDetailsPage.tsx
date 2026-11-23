
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "../auth/useAuth";
import { apiGet, ApiError } from "../lib/api";
import {
  formatEventDate,
  formatPrice,
} from "../lib/event-types";

import type {
  BookingDetails,
  BookingDetailsResponse,
} from "../lib/booking-types";

type LoadResult =
  | {
      bookingId: string;
      userId: string;
      booking: BookingDetails;
      error: "";
    }
  | {
      bookingId: string;
      userId: string;
      booking: null;
      error: string;
    };

export default function BookingDetailsPage() {
  const { bookingId } = useParams();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [result, setResult] = useState<LoadResult | null>(
    null
  );

  const userId = user?.id;

  useEffect(() => {
    if (!bookingId || !token || !userId) return;

    const controller = new AbortController();

    async function loadBooking() {
      try {
        const response = await apiGet<BookingDetailsResponse>(
          `/bookings/${bookingId}`,
          controller.signal,
          token!
        );

        if (!response.data?.booking?.booking_id) {
          throw new Error("Invalid booking response");
        }

        if (!controller.signal.aborted) {
          setResult({
            bookingId: bookingId!,
            userId: userId!,
            booking: response.data.booking,
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
              from: `/bookings/${bookingId}`,
              notice: "Your session expired.",
            },
          });
          return;
        }

        setResult({
          bookingId: bookingId!,
          userId: userId!,
          booking: null,
          error:
            err instanceof Error
              ? err.message
              : "Unable to load booking",
        });
      }
    }

    void loadBooking();

    return () => controller.abort();
  }, [bookingId, token, userId, logout, navigate]);

  if (!bookingId) {
    return <p role="alert">Booking ID is missing.</p>;
  }

  const current =
    result?.bookingId === bookingId &&
    result.userId === userId
      ? result
      : null;

  if (!current) {
    return <p>Loading booking details...</p>;
  }

  if (current.error) {
    return (
      <section>
        <p role="alert">{current.error}</p>
        <Link to="/bookings">Back to My Bookings</Link>
      </section>
    );
  }

  const booking = current.booking;

  if (!booking) return null;

  return (
    <section style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link to="/bookings">← Back to My Bookings</Link>

      <h1>Booking Details</h1>

      <div
        style={{
          padding: 28,
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
        }}
      >
        <h2>{booking.event_title}</h2>

        <p>
          <strong>Status:</strong>{" "}
          {booking.booking_status}
        </p>

        <p>
          <strong>Booking reference:</strong>{" "}
          {booking.booking_reference}
        </p>

        <hr />

        <h3>Event Information</h3>

        <p>{booking.event_description}</p>

        <p>
          <strong>Starts:</strong>{" "}
          {formatEventDate(booking.starts_at)}
        </p>

        <p>
          <strong>Ends:</strong>{" "}
          {formatEventDate(booking.ends_at)}
        </p>

        <p>
          <strong>Location:</strong>{" "}
          {booking.venue}, {booking.city}
        </p>

        <hr />

        <h3>Ticket Information</h3>

        <p>
          <strong>Ticket type:</strong>{" "}
          {booking.ticket_type}
        </p>

        <p>
          <strong>Quantity:</strong>{" "}
          {booking.quantity}
        </p>

        <p>
          <strong>Price per ticket:</strong>{" "}
          {formatPrice(booking.unit_price_minor)}
        </p>

        <p>
          <strong>Total paid (simulated):</strong>{" "}
          {formatPrice(booking.total_amount_minor)}
        </p>

        <hr />

        <p>
          <strong>Confirmed on:</strong>{" "}
          {formatEventDate(booking.confirmed_at)}
        </p>

        <Link to={`/events/${booking.event_id}`}>
          View Event
        </Link>
      </div>
    </section>
  );
}
