import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
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

// ลบ HTML splash screen หลัง React mount พร้อม fade out
function removeSplash() {
  const splash = document.querySelector<HTMLElement>(".splash-container");
  if (!splash) return;
  splash.style.transition = "opacity 0.4s ease-out";
  splash.style.opacity = "0";
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  // fallback กรณี transition ไม่ทำงาน
  setTimeout(() => splash.remove(), 600);
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ParcelStoreProvider>
      <App />
    </ParcelStoreProvider>
  </AuthProvider>
);

// ลบ splash หลัง React render รอบแรกเสร็จ
requestAnimationFrame(() => requestAnimationFrame(removeSplash));
