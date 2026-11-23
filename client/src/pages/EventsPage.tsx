
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { apiGet } from "../lib/api";
import {
  formatEventDate,
  type Event,
} from "../lib/event-types";

function extractEvents(response: unknown): Event[] {
  if (!response || typeof response !== "object") {
    throw new Error("Invalid events response");
  }

  const body = response as { data?: unknown };
  const data = body.data;

  if (Array.isArray(data)) {
    return data as Event[];
  }

  if (data && typeof data === "object") {
    const payload = data as {
      events?: unknown;
      items?: unknown;
    };

    if (Array.isArray(payload.events)) {
      return payload.events as Event[];
    }

    if (Array.isArray(payload.items)) {
      return payload.items as Event[];
    }
  }

  throw new Error("Unexpected events response structure");
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      try {
        const response = await apiGet<unknown>(
          "/events",
          controller.signal
        );

        if (!controller.signal.aborted) {
          setEvents(extractEvents(response));
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load events"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => controller.abort();
  }, []);

  return (
    <section>
      <h1>Discover Events</h1>
      <p>Find your next event and reserve your tickets.</p>

      {loading && <p>Loading events...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p>No published events are available yet.</p>
      )}

      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
            marginTop: 24,
          }}
        >
          {events.map((event) => (
            <article
              key={event.id}
              style={{
                background: "white",
                padding: 24,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            >
              <small>
                {event.category || "Event"}
              </small>

              <h2>{event.title}</h2>

              <p>
                {formatEventDate(event.starts_at)}
              </p>

              <p>
                {event.venue}, {event.city}
              </p>

              <Link to={`/events/${event.id}`}>
                View Event Details
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
