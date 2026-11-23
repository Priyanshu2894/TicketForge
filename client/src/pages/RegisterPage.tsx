
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { apiPost } from "../lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await apiPost("/auth/register", {
        name,
        email,
        password,
      });

      navigate("/login", {
        replace: true,
        state: {
          notice: "Registration successful. Please log in.",
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Create an Account</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="register-name">Full Name</label>
        <input
          id="register-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: "block", marginBottom: 16 }}
        />

        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: "block", marginBottom: 16 }}
        />

        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          style={{ display: "block", marginBottom: 16 }}
        />

        <label htmlFor="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          style={{ display: "block", marginBottom: 16 }}
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
