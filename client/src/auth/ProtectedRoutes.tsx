
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router";

import { useAuth } from "./useAuth";
import type { UserRole } from "./types";

export default function ProtectedRoute({
  roles,
}: {
  roles: UserRole[];
}) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <p>Checking authentication...</p>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <section>
        <h1>403 — Forbidden</h1>
        <p>You don't have permission to view this page.</p>
      </section>
    );
  }

  return <Outlet />;
}
