
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import { useAuth } from "../../auth/useAuth";
import { apiPost, ApiError } from "../../lib/api";

export default function ManageDraftEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const [name, setName] = useState("Early Bird");
  const [priceRupees, setPriceRupees] = useState("399");
  const [quantity, setQuantity] = useState("30");

  const [busy, setBusy] =
    useState<"ticket" | "publish" | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      logout();
      navigate("/login", { replace: true });
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong"
    );
  }

  async function addTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventId || !token || busy) return;

    setError("");
    setMessage("");

    const price = Number(priceRupees);
    const total = Number(quantity);

    if (
      !name.trim() ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      !Number.isSafeInteger(price * 100)
    ) {
      setError(
        "Enter a name, a whole-rupee price, and a positive ticket quantity."
      );
      return;
    }

    setBusy("ticket");

    try {
      await apiPost(
        `/admin/events/${eventId}/ticket-types`,
        {
          name: name.trim(),
          price_minor: price * 100,
          total_quantity: total,
        },
        token
      );

      setAddedCount((count) => count + 1);
      setMessage(
        "Ticket category created successfully."
      );

      setName("");
      setPriceRupees("");
      setQuantity("");
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  }

  async function publishEvent() {
    if (!eventId || !token || busy) return;

    setError("");
    setMessage("");
    setBusy("publish");

    try {
      await apiPost(
        `/admin/events/${eventId}/publish`,
        {},
        token
      );

      navigate("/admin/events", { replace: true });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  }

  if (!eventId) {
    return <p role="alert">Event ID is missing.</p>;
  }

  return (
    <section style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link to="/admin/events">
        Back to Admin Dashboard
      </Link>

      <h1>Manage Draft Event</h1>

      <p>
        Configure ticket categories before publishing your
        event.
      </p>

      <div
        style={{
          background: "white",
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          marginTop: 24,
        }}
      >
        <h2>Add Ticket Category</h2>

        <form onSubmit={(event) => void addTicket(event)}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ticket-name">
              Ticket name
            </label>

            <input
              id="ticket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy !== null}
              placeholder="General / VIP / Early Bird"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ticket-price">
              Price in rupees
            </label>

            <input
              id="ticket-price"
              type="number"
              min="1"
              step="1"
              value={priceRupees}
              onChange={(e) =>
                setPriceRupees(e.target.value)
              }
              required
              disabled={busy !== null}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ticket-quantity">
              Total tickets
            </label>

            <input
              id="ticket-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
              required
              disabled={busy !== null}
            />
          </div>

          <button type="submit" disabled={busy !== null}>
            {busy === "ticket"
              ? "Creating..."
              : "Add Ticket Category"}
          </button>
        </form>
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {addedCount > 0 && (
        <p>
          Ticket categories added during this visit:{" "}
          {addedCount}
        </p>
      )}

      <div
        style={{
          background: "white",
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          marginTop: 24,
        }}
      >
        <h2>Publish Event</h2>

        <p>
          Check your event details and ticket configuration
          before publishing.
        </p>

        <p>
          Publishing makes the event eligible to appear in
          the public event catalogue. Booking availability
          still depends on its booking dates and inventory.
        </p>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void publishEvent()}
        >
          {busy === "publish"
            ? "Publishing..."
            : "Publish Event"}
        </button>
      </div>
    </section>
  );
}
