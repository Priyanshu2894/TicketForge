
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/useAuth";

export default function LoginPage() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const state = location.state as {
    from?: unknown;
    notice?: unknown;
  } | null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const currentUser = await login(email, password);

      const from = state?.from;

      const destination =
        typeof from === "string" &&
        from.startsWith("/") &&
        !from.startsWith("//")
          ? from
          : currentUser.role === "ADMIN"
            ? "/admin/events"
            : "/";

      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (initializing) return <p>Checking session...</p>;

  if (user) {
    return (
      <Navigate
        to={user.role === "ADMIN" ? "/admin/events" : "/"}
        replace
      />
    );
  }

  return (
    <section style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Login to TicketForge</h1>

      {typeof state?.notice === "string" && (
        <p>{state.notice}</p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ display: "block", width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ display: "block", width: "100%" }}
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
