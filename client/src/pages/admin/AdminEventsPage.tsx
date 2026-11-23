
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../../auth/useAuth";
import { apiGet, ApiError } from "../../lib/api";
import { formatEventDate } from "../../lib/event-types";

type AdminEvent = {
  id: string;
  title: string;
  category: string;
  city: string;
  starts_at: string;
  status: string;
  created_at: string;
};

type AdminEventsResponse = {
  success: boolean;
  data: AdminEvent[];
};

export default function AdminEventsPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    async function loadEvents() {
      try {
        const response = await apiGet<AdminEventsResponse>(
          "/admin/events",
          controller.signal,
          token!
        );

        if (!Array.isArray(response.data)) {
          throw new Error("Unexpected admin events response");
        }

        if (!controller.signal.aborted) {
          setEvents(response.data);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        if (err instanceof ApiError && err.status === 401) {
          setSessionExpired(true);
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load admin events"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => controller.abort();
  }, [token]);

  function handleExpiredSession() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) return <p>Loading admin events...</p>;

  if (error) {
    return (
      <section>
        <p role="alert">{error}</p>

        {sessionExpired && (
          <button onClick={handleExpiredSession}>
            Log in again
          </button>
        )}
      </section>
    );
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage events on TicketForge.</p>
        </div>

        <Link to="/admin/events/new">
          + Create New Event
        </Link>
      </div>

      {events.length === 0 && (
        <p>No events have been created yet.</p>
      )}

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {events.map((event) => (
          <article
            key={event.id}
            style={{
              padding: 24,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {event.title}
              </h2>

              <strong>{event.status}</strong>
            </div>

            <p>
              <strong>Category:</strong> {event.category}
            </p>

            <p>
              <strong>City:</strong> {event.city}
            </p>

            <p>
              <strong>Starts:</strong>{" "}
              {formatEventDate(event.starts_at)}
            </p>

            <p>
              <strong>Created:</strong>{" "}
              {formatEventDate(event.created_at)}
            </p>

           {event.status === "DRAFT" && (
  <div style={{ display: "flex", gap: 20 }}>
    <Link to={`/admin/events/${event.id}/edit`}>
      Edit Draft
    </Link>

    <Link to={`/admin/events/${event.id}/manage`}>
      Configure Tickets
    </Link>
  </div>
)}

            {event.status === "PUBLISHED" && (
              <Link to={`/events/${event.id}`}>
                View Published Event
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
