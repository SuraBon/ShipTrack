import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { ParcelStoreProvider } from "./contexts/ParcelStoreContext";
import { AuthProvider } from "./contexts/AuthContext";
import { registerSW } from "virtual:pwa-register";

// Register Service Worker for PWA auto-updates
let updateServiceWorker: ReturnType<typeof registerSW> | undefined;
updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent("shiptrack:pwa-update", {
        detail: { updateServiceWorker },
      }),
    );
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("shiptrack:pwa-offline-ready"));
  },
});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ParcelStoreProvider>
      <App />
    </ParcelStoreProvider>
  </AuthProvider>
);
