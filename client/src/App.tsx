
import { Route, Routes } from "react-router";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./auth/ProtectedRoutes";

import EventsPage from "./pages/EventsPage";
import EventDetailsPage from "./pages/EventsDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import CheckoutPage from "./pages/CheckoutPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import AdminEventsPage from "./pages/admin/AdminEventsPage";
import CreateEventPage from "./pages/admin/CreateEventPage";
import ManageDraftEventPage from "./pages/admin/ManageDraftEventPage";
import EditDraftEventPage from "./pages/admin/EditDraftEventPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public pages */}
        <Route index element={<EventsPage />} />

        <Route
          path="events/:eventId"
          element={<EventDetailsPage />}
        />

        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Customer-only pages */}
        <Route
          element={<ProtectedRoute roles={["CUSTOMER"]} />}
        >
          <Route
            path="checkout/:reservationId"
            element={<CheckoutPage />}
          />

          <Route
  path="bookings"
  element={<MyBookingsPage />}
/>

<Route
  path="bookings/:bookingId"
  element={<BookingDetailsPage />}
/>
        </Route>

        {/* Admin-only pages */}
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
  <Route
    path="admin/events"
    element={<AdminEventsPage />}
  />
  <Route
  path="admin/events/:eventId/manage"
  element={<ManageDraftEventPage />}
/>
  <Route
    path="admin/events/new"
    element={<CreateEventPage />}
  />
  <Route
  path="admin/events/:eventId/edit"
  element={<EditDraftEventPage />}
/>
</Route>

        <Route
          path="*"
          element={<PlaceholderPage title="404 - Page Not Found" />}
        />
      </Route>
    </Routes>
  );
}
