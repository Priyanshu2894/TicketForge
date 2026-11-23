
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../../auth/useAuth";
import { apiPost, ApiError } from "../../lib/api";

type CreateEventResponse = {
  success: boolean;
  data: {
    id: string;
    status: string;
  };
};

const initialForm = {
  title: "",
  description: "",
  category: "",
  city: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  booking_opens_at: "",
  booking_closes_at: "",
};

type FormField = keyof typeof initialForm;

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: FormField, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    const start = new Date(form.starts_at);
    const end = new Date(form.ends_at);
    const opens = new Date(form.booking_opens_at);
    const closes = new Date(form.booking_closes_at);

    if (
      [start, end, opens, closes].some(
        (date) => Number.isNaN(date.getTime())
      )
    ) {
      setError("Please enter valid event dates.");
      return;
    }

    if (end <= start) {
      setError("Event end must be after event start.");
      return;
    }

    if (opens >= closes) {
      setError(
        "Booking closing time must be after opening time."
      );
      return;
    }

    if (closes > start) {
      setError(
        "Booking must close before or when the event starts."
      );
      return;
    }

    if (!token) {
      setError("Please log in as an admin.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiPost<CreateEventResponse>(
        "/admin/events",
        {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          city: form.city.trim(),
          venue: form.venue.trim(),

          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          booking_opens_at: opens.toISOString(),
          booking_closes_at: closes.toISOString(),
        },
        token
      );

      if (!response.data?.id) {
        throw new Error("Event ID missing from response");
      }

      navigate("/admin/events", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create event"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const textFields: {
    key: FormField;
    label: string;
  }[] = [
    { key: "title", label: "Event title" },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "city", label: "City" },
    { key: "venue", label: "Venue" },
  ];

  const dateFields: {
    key: FormField;
    label: string;
  }[] = [
    { key: "starts_at", label: "Event starts" },
    { key: "ends_at", label: "Event ends" },
    {
      key: "booking_opens_at",
      label: "Booking opens",
    },
    {
      key: "booking_closes_at",
      label: "Booking closes",
    },
  ];

  return (
    <section style={{ maxWidth: 680, margin: "0 auto" }}>
      <Link to="/admin/events">Back to Admin Events</Link>

      <h1>Create Event</h1>
      <p>
        Create a draft event. Ticket categories and publishing
        will be configured afterward.
      </p>

      <form onSubmit={handleSubmit}>
        {textFields.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label htmlFor={key}>{label}</label>

            <input
              id={key}
              value={form[key]}
              onChange={(e) =>
                updateField(key, e.target.value)
              }
              required
              style={{
                width: "100%",
                padding: 10,
                display: "block",
              }}
            />
          </div>
        ))}

        {dateFields.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label htmlFor={key}>{label}</label>

            <input
              id={key}
              type="datetime-local"
              value={form[key]}
              onChange={(e) =>
                updateField(key, e.target.value)
              }
              required
              style={{
                width: "100%",
                padding: 10,
                display: "block",
              }}
            />
          </div>
        ))}

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Draft Event"}
        </button>
      </form>
    </section>
  );
}
