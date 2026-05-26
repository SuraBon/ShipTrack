import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const plugins = [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: [
      "favicon.svg",
      "icon-192.png",
      "icon-512.png",
      "fonts/material-symbols-outlined.ttf",
      "fonts/noto-sans-thai-400.ttf",
      "fonts/noto-sans-thai-500.ttf",
      "fonts/noto-sans-thai-600.ttf",
      "fonts/noto-sans-thai-700.ttf",
      "fonts/noto-sans-thai-800.ttf",
    ],
    manifest: {
      name: "ShipTrack — ระบบติดตามรายการส่ง",
      short_name: "ShipTrack",
      description: "ระบบติดตามพัสดุและรายการส่งของสาขาและพนักงาน",
      theme_color: "#091426",
      background_color: "#091426",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      icons: [
        {
          src: "icon-192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    }
  })
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    // Deploy target for Vercel/static hosting: repoRoot/dist
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("leaflet")) return "map";
          if (id.includes("qrcode")) return "qr";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react") || id.includes("react-dom")) return "react";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
  },
});
