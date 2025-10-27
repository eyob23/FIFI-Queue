import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// Setup the MSW worker with our handlers
export const worker = setupWorker(...handlers);

// Start the worker in development mode
export const startMSW = async () => {
  if (import.meta.env.DEV) {
    try {
      await worker.start({
        onUnhandledRequest: "bypass", // Let unhandled requests pass through
        serviceWorker: {
          url: "/mockServiceWorker.js", // Default MSW service worker location
        },
      });
      console.log("🚀 MSW: Mock Service Worker started successfully");
      console.log("🎭 MSW: Intercepting requests to /api/*");
    } catch (error) {
      console.error("❌ MSW: Failed to start Mock Service Worker:", error);
    }
  }
};

// Stop the worker
export const stopMSW = () => {
  worker.stop();
  console.log("🛑 MSW: Mock Service Worker stopped");
};
