
export type Event = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  city: string;
  venue: string;
  starts_at: string;
  ends_at?: string;
};

export type TicketType = {
  id: string;
  name: string;
  price_minor: string | number;
  total_quantity: number;
  held_quantity: number;
  sold_quantity: number;
  available_quantity?: number;
};

export function formatPrice(
  priceMinor: string | number
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(priceMinor) / 100);
}

export function formatEventDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
