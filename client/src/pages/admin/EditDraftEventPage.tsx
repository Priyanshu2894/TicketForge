
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "../../auth/useAuth";
import { apiGet } from "../../lib/api";

type EditableFields = {
  title: string;
  description: string;
  category: string;
  city: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  booking_opens_at: string;
  booking_closes_at: string;
};

type AdminEvent = EditableFields & {
  id: string;
  status: string;
};

type AdminEventsResponse = {
  success: boolean;
  data: AdminEvent[];
};

type LoadedEvent = {
  eventId: string;
  status: string;
  original: EditableFields;
  form: EditableFields;
};

const textFields = [
  { key: "title", label: "Event Title" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "venue", label: "Venue" },
] as const;

const dateFields = [
  { key: "starts_at", label: "Event Starts" },
  { key: "ends_at", label: "Event Ends" },
  { key: "booking_opens_at", label: "Booking Opens" },
  { key: "booking_closes_at", label: "Booking Closes" },
] as const;

const dateKeys: (keyof EditableFields)[] =
  dateFields.map((field) => field.key);

// Convert a UTC timestamp to the browser's local
// date/time input format.
function toLocalInput(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date received from server");
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, 16);
}

function eventToForm(event: AdminEvent): EditableFields {
  const required = [
    "title",
    "category",
    "city",
    "venue",
    "starts_at",
    "ends_at",
    "booking_opens_at",
    "booking_closes_at",
  ] as const;

  for (const field of required) {
    if (typeof event[field] !== "string" || !event[field]) {
      throw new Error(
        `Admin API response is missing ${field}`
      );
    }
  }

  return {
    title: event.title,
    description: event.description ?? "",
    category: event.category,
    city: event.city,
    venue: event.venue,
    starts_at: toLocalInput(event.starts_at),
    ends_at: toLocalInput(event.ends_at),
    booking_opens_at: toLocalInput(event.booking_opens_at),
    booking_closes_at: toLocalInput(event.booking_closes_at),
  };
}

export default function EditDraftEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const [loaded, setLoaded] = useState<LoadedEvent | null>(
    null
  );

  const [loadError, setLoadError] = useState<{
    eventId: string;
    message: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId || !token) return;

    const controller = new AbortController();

    async function loadEvent() {
      try {
        const response = await apiGet<AdminEventsResponse>(
          "/admin/events",
          controller.signal,
          token!
        );

        if (!Array.isArray(response.data)) {
          throw new Error("Unexpected admin events response");
        }

        const event = response.data.find(
          (item) => item.id === eventId
        );

        if (!event) {
          throw new Error("Event not found");
        }

        const form = eventToForm(event);

        if (!controller.signal.aborted) {
          setLoaded({
            eventId: eventId!,
            status: event.status,
            original: form,
            form,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setLoadError({
          eventId: eventId!,
          message:
            err instanceof Error
              ? err.message
              : "Unable to load event",
        });
      }
    }

    void loadEvent();

    return () => controller.abort();
  }, [eventId, token]);

  function updateField(
    field: keyof EditableFields,
    value: string
  ) {
    setLoaded((current) => {
      if (!current || current.eventId !== eventId) {
        return current;
      }

      return {
        ...current,
        form: {
          ...current.form,
          [field]: value,
        },
      };
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!loaded || loaded.eventId !== eventId ||
        !token || saving) {
      return;
    }

    setError("");

    if (loaded.status !== "DRAFT") {
      setError("Only DRAFT events can be edited.");
      return;
    }

    const { form, original } = loaded;

    // Validate important date relationships.
    const start = new Date(form.starts_at);
    const end = new Date(form.ends_at);
    const opens = new Date(form.booking_opens_at);
    const closes = new Date(form.booking_closes_at);

    if (
      [start, end, opens, closes].some(
        (date) => Number.isNaN(date.getTime())
      )
    ) {
      setError("Enter valid dates.");
      return;
    }

    if (end <= start) {
      setError("Event end must be after event start.");
      return;
    }

    if (opens >= closes || closes > start) {
      setError(
        "Booking must open before it closes and close no later than the event start."
      );
      return;
    }

    const changes: Partial<EditableFields> = {};

    const keys = Object.keys(form) as
      (keyof EditableFields)[];

    for (const key of keys) {
      const value = form[key].trim();

      if (!value && key !== "description") {
        setError("All required fields must be filled.");
        return;
      }

      if (value !== original[key]) {
        if (key === "description" && !value) {
          setError("Description cannot be empty.");
          return;
        }

        changes[key] = dateKeys.includes(key)
          ? new Date(value).toISOString()
          : value;
      }
    }

    if (Object.keys(changes).length === 0) {
      setError("No changes to save.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/v1/admin/events/${eventId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(changes),
        }
      );

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ??
            `Unable to update event (${response.status})`
        );
      }

      navigate("/admin/events", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update event"
      );
    } finally {
      setSaving(false);
    }
  }

  if (!eventId) {
    return <p role="alert">Missing event ID.</p>;
  }

  if (!token) {
    return <p role="alert">Please log in as ADMIN.</p>;
  }

  if (loadError?.eventId === eventId &&
      loaded?.eventId !== eventId) {
    return <p role="alert">{loadError.message}</p>;
  }

  if (!loaded || loaded.eventId !== eventId) {
    return <p>Loading event...</p>;
  }

  if (loaded.status !== "DRAFT") {
    return (
      <section>
        <h1>Editing Unavailable</h1>
        <p>Only draft events can be edited.</p>
        <Link to="/admin/events">
          Back to Admin Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link to="/admin/events">
        Back to Admin Dashboard
      </Link>

      <h1>Edit Draft Event</h1>

      <p>
        Change the event information and booking window
        before publishing.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {textFields.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label htmlFor={key}>{label}</label>

            {key === "description" ? (
              <textarea
                id={key}
                value={loaded.form[key]}
                onChange={(e) =>
                  updateField(key, e.target.value)
                }
                required
                disabled={saving}
                style={{
                  width: "100%",
                  padding: 10,
                  minHeight: 100,
                }}
              />
            ) : (
              <input
                id={key}
                value={loaded.form[key]}
                onChange={(e) =>
                  updateField(key, e.target.value)
                }
                required
                disabled={saving}
                style={{ width: "100%", padding: 10 }}
              />
            )}
          </div>
        ))}

        <h2>Event and Booking Dates</h2>

        {dateFields.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label htmlFor={key}>{label}</label>

            <input
              id={key}
              type="datetime-local"
              value={loaded.form[key]}
              onChange={(e) =>
                updateField(key, e.target.value)
              }
              required
              disabled={saving}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
        ))}

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
