import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { startMSW } from "./mocks/browser";

// Start MSW in development mode
if (import.meta.env.DEV) {
  startMSW()
    .then(() => {
      console.log("🎭 MSW initialized, starting React app...");
      renderApp();
    })
    .catch((error) => {
      console.error("❌ Failed to initialize MSW:", error);
      renderApp(); // Start app anyway
    });
} else {
  renderApp();
}

function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
