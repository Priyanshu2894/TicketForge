
import app from "./app.js";
import { startReservationWorker } from "./modules/reservations/reservations.worker.js";

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`TicketForge API running on port ${PORT}`);
});

// Run the PostgreSQL-backed expiration worker.
startReservationWorker();
