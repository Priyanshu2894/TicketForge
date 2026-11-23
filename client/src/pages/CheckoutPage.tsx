
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "../auth/useAuth";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { formatPrice } from "../lib/event-types";

type Reservation = {
  reservation_id: string;
  reservation_status: string;
  event_title: string;
  ticket_type: string;
  quantity: number;
  total_amount_minor: string | number;
  expires_at: string;
  can_confirm: boolean;
  booking_id: string | null;
  booking_reference: string | null;
};

type ReservationResponse = {
  success: boolean;
  data: {
    reservation: Reservation;
  };
};

type Booking = {
  id: string;
  booking_reference: string;
  status: string;
};

type ConfirmationResponse = {
  success: boolean;
  data: Booking;
};

function formatRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function CheckoutPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const [reservation, setReservation] =
    useState<Reservation | null>(null);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [action, setAction] =
    useState<"confirm" | "cancel" | null>(null);

  const [now, setNow] = useState(() => Date.now());

  // Fetch the actual reservation from PostgreSQL.
  useEffect(() => {
    if (!reservationId || !token) return;

    const controller = new AbortController();

    async function loadReservation() {
      try {
        const response = await apiGet<ReservationResponse>(
          `/reservations/${reservationId}`,
          controller.signal,
          token ?? undefined
        );

        if (!controller.signal.aborted) {
          setReservation(response.data.reservation);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load reservation"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadReservation();

    return () => controller.abort();
  }, [reservationId, token]);

  // Refresh the countdown every second.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function refreshReservation() {
    if (!reservationId || !token) return;

    const response = await apiGet<ReservationResponse>(
      `/reservations/${reservationId}`,
      undefined,
      token
    );

    setReservation(response.data.reservation);
  }

  function handleExpiredSession() {
    logout();

    navigate("/login", {
      replace: true,
      state: {
        from: `/checkout/${reservationId}`,
        notice: "Your session expired. Please log in again.",
      },
    });
  }

  async function handleAction(
    selectedAction: "confirm" | "cancel"
  ) {
    if (!reservationId || !token || action) return;

    setAction(selectedAction);
    setActionError("");

    try {
      if (selectedAction === "confirm") {
        const response = await apiPost<ConfirmationResponse>(
          `/reservations/${reservationId}/confirm`,
          {},
          token
        );

        setBooking(response.data);
      } else {
        await apiPost(
          `/reservations/${reservationId}/cancel`,
          {},
          token
        );
      }

      await refreshReservation();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleExpiredSession();
        return;
      }

      // If the deadline passed or another action already
      // won, show the backend's latest reservation state.
      if (err instanceof ApiError && err.status === 409) {
        try {
          await refreshReservation();
        } catch {
          // Keep the original operation error visible.
        }
      }

      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to complete this operation"
      );
    } finally {
      setAction(null);
    }
  }

  if (!reservationId) {
    return <p role="alert">Reservation ID is missing.</p>;
  }

  if (loading) {
    return <p>Loading checkout...</p>;
  }

  if (error) {
    return (
      <section>
        <p role="alert">{error}</p>
        <Link to="/login">Log in</Link>
      </section>
    );
  }

  if (!reservation) {
    return <p>Reservation not found.</p>;
  }

  const remainingMs = Math.max(
    0,
    new Date(reservation.expires_at).getTime() - now
  );

  const isHeld =
    reservation.reservation_status === "HELD";

  const canAct =
    isHeld &&
    remainingMs > 0 &&
    reservation.can_confirm &&
    action === null;

  return (
    <section style={{ maxWidth: 680, margin: "0 auto" }}>
      <h1>TicketForge Checkout</h1>

      <div
        style={{
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "white",
        }}
      >
        <h2>{reservation.event_title}</h2>

        <p>
          <strong>Ticket category:</strong>{" "}
          {reservation.ticket_type}
        </p>

        <p>
          <strong>Quantity:</strong>{" "}
          {reservation.quantity}
        </p>

        <p>
          <strong>Total amount:</strong>{" "}
          {formatPrice(reservation.total_amount_minor)}
        </p>

        <p>
          <strong>Reservation status:</strong>{" "}
          {reservation.reservation_status}
        </p>

        {isHeld && remainingMs > 0 && (
          <div
            aria-live="off"
            style={{
              background: "#fef3c7",
              padding: 16,
              borderRadius: 8,
              marginTop: 20,
            }}
          >
            <strong>
              Time remaining: {formatRemaining(remainingMs)}
            </strong>

            <p>
              Confirm before the deadline to keep your tickets.
            </p>
          </div>
        )}

        {isHeld && remainingMs === 0 && (
          <p role="status">
            Reservation deadline passed. Confirmation is no
            longer available. The server will recover the
            held inventory.
          </p>
        )}

        {isHeld && remainingMs > 0 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              disabled={!canAct}
              onClick={() => void handleAction("confirm")}
            >
              {action === "confirm"
                ? "Confirming..."
                : "Confirm Booking"}
            </button>

            <button
              type="button"
              disabled={!canAct}
              onClick={() => void handleAction("cancel")}
            >
              {action === "cancel"
                ? "Cancelling..."
                : "Cancel Reservation"}
            </button>
          </div>
        )}

        {actionError && (
          <p role="alert">{actionError}</p>
        )}

        {(booking ||
          reservation.reservation_status === "CONFIRMED") && (
          <div role="status" style={{ marginTop: 20 }}>
            <h3>Booking Confirmed!</h3>

            <p>
              Reference:{" "}
              {booking?.booking_reference ??
                reservation.booking_reference}
            </p>

            {(booking?.id || reservation.booking_id) && (
              <Link
                to={`/bookings/${
                  booking?.id ?? reservation.booking_id
                }`}
              >
                View booking details
              </Link>
            )}
          </div>
        )}

        {reservation.reservation_status === "CANCELLED" && (
          <p role="status">
            Reservation cancelled. Tickets have been released.
          </p>
        )}

        {reservation.reservation_status === "EXPIRED" && (
          <p role="status">
            This reservation has expired.
          </p>
        )}
      </div>

      <p style={{ marginTop: 20 }}>
        <Link to="/">Browse more events</Link>
      </p>
    </section>
  );
}
