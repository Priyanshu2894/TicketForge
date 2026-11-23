
import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/useAuth";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <header
        style={{
          padding: 20,
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <h2>TicketForge</h2>

        <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <NavLink to="/">Events</NavLink>

          {user?.role === "CUSTOMER" && (
            <NavLink to="/bookings">My Bookings</NavLink>
          )}

          {user?.role === "ADMIN" && (
            <NavLink to="/admin/events">Admin</NavLink>
          )}

          {!user ? (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          ) : (
            <>
              <span>{user.name || user.email}</span>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>

      <main
        style={{
          maxWidth: 1100,
          padding: 24,
          margin: "0 auto",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
