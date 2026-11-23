
import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../auth/useAuth";
import { apiPost, ApiError } from "../lib/api";
import {
  formatPrice,
  type TicketType,
} from "../lib/event-types";

type CreateReservationResponse = {
  success: boolean;
  data: {
    id?: string;
    reservation?: {
      id: string;
    };
  };
};

type Props = {
  ticket: TicketType;
  eventId: string;
};

export default function ReserveTicketForm({
  ticket,
  eventId,
}: Props) {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const available =
    ticket.available_quantity ??
    ticket.total_quantity -
      ticket.held_quantity -
      ticket.sold_quantity;

  async function handleReserve() {
    setError("");

    if (!user || !token) {
      navigate("/login", {
        state: {
          from: `/events/${eventId}`,
          notice: "Please log in to reserve tickets.",
        },
      });
      return;
    }

    if (user.role !== "CUSTOMER") {
      setError("Only customers can reserve tickets.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiPost<CreateReservationResponse>(
        "/reservations",
        {
          ticketTypeId: ticket.id,
          quantity,
        },
        token
      );

      const reservationId =
        response.data?.reservation?.id ??
        response.data?.id;

      if (!reservationId) {
        throw new Error(
          "Reservation created, but its ID was not returned. Check My Reservations before retrying."
        );
      }

      navigate(`/checkout/${reservationId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        navigate("/login", {
          state: {
            from: `/events/${eventId}`,
            notice: "Your session expired. Please log in again.",
          },
        });
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to reserve tickets"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const maxQuantity = Math.min(4, available);
  const totalPrice = Number(ticket.price_minor) * quantity;

  return (
    <div style={{ marginTop: 16 }}>
      {available > 0 && (
        <>
          <label htmlFor={`quantity-${ticket.id}`}>
            Number of tickets
          </label>

          <select
            id={`quantity-${ticket.id}`}
            value={quantity}
            onChange={(e) =>
              setQuantity(Number(e.target.value))
            }
            disabled={submitting}
            style={{ margin: "0 12px", padding: 8 }}
          >
            {Array.from(
              { length: maxQuantity },
              (_, index) => index + 1
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <p>
            <strong>Total:</strong>{" "}
            {formatPrice(totalPrice)}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => void handleReserve()}
        disabled={
          available <= 0 ||
          submitting ||
          user?.role === "ADMIN"
        }
      >
        {available <= 0
          ? "Sold out"
          : submitting
            ? "Reserving..."
            : "Reserve Tickets"}
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
