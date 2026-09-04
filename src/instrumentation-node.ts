import { closeDb } from "@/db";

declare global {
  var recoupShutdownHandlersRegistered: boolean | undefined;
}

if (!globalThis.recoupShutdownHandlersRegistered) {
  globalThis.recoupShutdownHandlersRegistered = true;

  const shutdown = async (signal: NodeJS.Signals) => {
    console.info(`Received ${signal}; closing database connections.`);
    const forcedExit = setTimeout(() => process.exit(1), 9_000);
    forcedExit.unref();

    try {
      await closeDb();
      process.exit(0);
    } catch (error) {
      console.error("Graceful shutdown failed", error);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
