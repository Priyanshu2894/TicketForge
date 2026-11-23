
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { apiGet } from "../lib/api";
import {
  formatEventDate,
  formatPrice,
  type Event,
  type TicketType,
} from "../lib/event-types";
import ReserveTicketForm from "../components/ReserveTicketForm";

type EventDetails = {
  event: Event;
  tickets: TicketType[];
};


function isEvent(value: unknown): value is Event {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    typeof event.city === "string" &&
    typeof event.venue === "string" &&
    typeof event.starts_at === "string"
  );
}



function extractDetails(response: unknown): EventDetails {
  const root = response as {
    data?: {
      event?: Event & {
        ticketTypes?: TicketType[];
        ticket_types?: TicketType[];
      };
      ticketTypes?: TicketType[];
      ticket_types?: TicketType[];
    } & Partial<Event>;
  };

  const data = root?.data;

  if (!data) {
    throw new Error("Invalid event response");
  }

  const event = data.event ?? data;

  // Verify that the object is a valid Event
  if (!isEvent(event)) {
    throw new Error("Event information is missing or invalid");
  }

  const tickets =
    data.ticketTypes ??
    data.ticket_types ??
    data.event?.ticketTypes ??
    data.event?.ticket_types ??
    [];

  return { event, tickets };
}


export default function EventDetailsPage() {
  const { eventId } = useParams();
  const [details, setDetails] =
    useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;

    const controller = new AbortController();

    async function loadDetails() {
      try {
        const response = await apiGet<unknown>(
          `/events/${eventId}`,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDetails(extractDetails(response));
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load event"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [eventId]);

  if (!eventId) {
    return <p role="alert">Event ID is missing</p>;
  }

  if (loading) return <p>Loading event...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!details) return <p>Event not found.</p>;

  const { event, tickets } = details;

  return (
    <section>
      <h1>{event.title}</h1>

      <p>{event.description}</p>

      <p>
        <strong>Date:</strong>{" "}
        {formatEventDate(event.starts_at)}
      </p>

      <p>
        <strong>Location:</strong>{" "}
        {event.venue}, {event.city}
      </p>

      <h2>Available Ticket Types</h2>

      {tickets.length === 0 && (
        <p>No ticket categories were returned.</p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {tickets.map((ticket) => {
          const available =
            ticket.available_quantity ??
            ticket.total_quantity -
              ticket.held_quantity -
              ticket.sold_quantity;

          return (
            <article
  key={ticket.id}
  style={{
    padding: 20,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  }}
>
  <h3>{ticket.name}</h3>

  <p>
    <strong>Price:</strong>{" "}
    {formatPrice(ticket.price_minor)}
  </p>

  <p>
    <strong>Available:</strong> {available}
  </p>

  <ReserveTicketForm
    ticket={ticket}
    eventId={event.id}
  />
</article>
          );
        })}
      </div>
    </section>
  );
}
