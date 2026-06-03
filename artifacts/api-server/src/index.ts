import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";

// PORT is injected by the Replit workflow config — fail fast if it is missing
// so the error is obvious rather than silently binding to port NaN.
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure the session table exists before accepting traffic.
// The session middleware silently breaks if the table is missing, so we treat
// a failure here as fatal.
ensureSessionTable()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table");
    process.exit(1);
  });
