
import { expireReservationBatch } from "./reservations.expiration.js";

const INTERVAL_MS = 15_000;
let running = false;

async function runCleanup() {
  if (running) return;

  running = true;

  try {
    let expired: number;

    do {
      expired = await expireReservationBatch(50);

      if (expired > 0) {
        console.log(`Expired ${expired} reservations`);
      }
    } while (expired === 50);
  } catch (error) {
    console.error("Reservation expiration failed:", error);
  } finally {
    running = false;
  }
}

export function startReservationWorker() {
  // Check outstanding reservations when the server starts.
  void runCleanup();

  // Continue checking periodically.
  const timer = setInterval(() => {
    void runCleanup();
  }, INTERVAL_MS);

  timer.unref();
}
