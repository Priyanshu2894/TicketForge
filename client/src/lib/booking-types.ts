
export type BookingSummary = {
  booking_id: string;
  booking_reference: string;
  booking_status: "CONFIRMED" | "CANCELLED";
  total_amount_minor: string;
  confirmed_at: string;

  event_id: string;
  event_title: string;
  city: string;
  venue: string;
  starts_at: string;

  ticket_type: string;
  quantity: number;
  unit_price_minor: string;
};

export type BookingDetails = BookingSummary & {
  reservation_id: string;
  event_description: string | null;
  ends_at: string;
  ticket_type_id: string;
};

export type MyBookingsResponse = {
  success: boolean;
  data: {
    bookings: BookingSummary[];
    page: number;
    limit: number;
  };
};

export type BookingDetailsResponse = {
  success: boolean;
  data: {
    booking: BookingDetails;
  };
};
