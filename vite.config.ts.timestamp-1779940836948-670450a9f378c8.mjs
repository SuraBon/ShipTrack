// vite.config.ts
import tailwindcss from "file:///C:/Users/Desktop/Documents/GI/web/%E0%B8%AA%E0%B8%B2%E0%B8%82%E0%B8%B2map/doc%20track/node_modules/.pnpm/@tailwindcss+vite@4.1.14_vi_0bfd4ad0e849e4ce571c20bb6a963122/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///C:/Users/Desktop/Documents/GI/web/%E0%B8%AA%E0%B8%B2%E0%B8%82%E0%B8%B2map/doc%20track/node_modules/.pnpm/@vitejs+plugin-react@5.0.4__ecb14c0dd35732cecfec7da63d76639c/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
import { defineConfig } from "file:///C:/Users/Desktop/Documents/GI/web/%E0%B8%AA%E0%B8%B2%E0%B8%82%E0%B8%B2map/doc%20track/node_modules/.pnpm/vite@7.1.9_@types+node@24.7_67bbd228fb1351016eb14b98f9cc4eb7/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///C:/Users/Desktop/Documents/GI/web/%E0%B8%AA%E0%B8%B2%E0%B8%82%E0%B8%B2map/doc%20track/node_modules/.pnpm/vite-plugin-pwa@1.3.0_vite@_e7f5303c667c79ffc8f066ddc1ad23ea/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Desktop\\Documents\\GI\\web\\\u0E2A\u0E32\u0E02\u0E32map\\doc track";
var plugins = [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: "prompt",
    includeAssets: [
      "favicon.svg",
      "apple-touch-icon-v2.png",
      "icon-192-v2.png",
      "icon-512-v2.png"
    ],
    workbox: {
      globIgnores: ["**/fonts/**", "**/map-*.js", "**/map-*.css"],
      importScripts: ["shiptrack-sw-sync.js"]
    },
    manifest: {
      name: "ShipTrack \u2014 \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07",
      short_name: "ShipTrack",
      description: "\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E1E\u0E31\u0E2A\u0E14\u0E38\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E32\u0E02\u0E32\u0E41\u0E25\u0E30\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19",
      theme_color: "#091426",
      background_color: "#091426",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      icons: [
        {
          src: "icon-192-v2.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "icon-512-v2.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    }
  })
];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "client", "src"),
      "@assets": path.resolve(__vite_injected_original_dirname, "attached_assets")
    }
  },
  envDir: path.resolve(__vite_injected_original_dirname),
  root: path.resolve(__vite_injected_original_dirname, "client"),
  build: {
    // Deploy target for Vercel/static hosting: repoRoot/dist
    outDir: path.resolve(__vite_injected_original_dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return void 0;
          if (id.includes("leaflet")) return "map";
          if (id.includes("qrcode")) return "qr";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react") || id.includes("react-dom")) return "react";
          return "vendor";
        }
      }
    }
  },
  server: {
    port: 3e3,
    strictPort: false,
    // Will find next available port if 3000 is busy
    host: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxEZXNrdG9wXFxcXERvY3VtZW50c1xcXFxHSVxcXFx3ZWJcXFxcXHUwRTJBXHUwRTMyXHUwRTAyXHUwRTMybWFwXFxcXGRvYyB0cmFja1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcRGVza3RvcFxcXFxEb2N1bWVudHNcXFxcR0lcXFxcd2ViXFxcXFx1MEUyQVx1MEUzMlx1MEUwMlx1MEUzMm1hcFxcXFxkb2MgdHJhY2tcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0Rlc2t0b3AvRG9jdW1lbnRzL0dJL3dlYi8lRTAlQjglQUElRTAlQjglQjIlRTAlQjglODIlRTAlQjglQjJtYXAvZG9jJTIwdHJhY2svdml0ZS5jb25maWcudHNcIjtpbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuY29uc3QgcGx1Z2lucyA9IFtcbiAgcmVhY3QoKSxcbiAgdGFpbHdpbmRjc3MoKSxcbiAgVml0ZVBXQSh7XG4gICAgcmVnaXN0ZXJUeXBlOiBcInByb21wdFwiLFxuICAgIGluY2x1ZGVBc3NldHM6IFtcbiAgICAgIFwiZmF2aWNvbi5zdmdcIixcbiAgICAgIFwiYXBwbGUtdG91Y2gtaWNvbi12Mi5wbmdcIixcbiAgICAgIFwiaWNvbi0xOTItdjIucG5nXCIsXG4gICAgICBcImljb24tNTEyLXYyLnBuZ1wiLFxuICAgIF0sXG4gICAgd29ya2JveDoge1xuICAgICAgZ2xvYklnbm9yZXM6IFtcIioqL2ZvbnRzLyoqXCIsIFwiKiovbWFwLSouanNcIiwgXCIqKi9tYXAtKi5jc3NcIl0sXG4gICAgICBpbXBvcnRTY3JpcHRzOiBbXCJzaGlwdHJhY2stc3ctc3luYy5qc1wiXSxcbiAgICB9LFxuICAgIG1hbmlmZXN0OiB7XG4gICAgICBuYW1lOiBcIlNoaXBUcmFjayBcdTIwMTQgXHUwRTIzXHUwRTMwXHUwRTFBXHUwRTFBXHUwRTE1XHUwRTM0XHUwRTE0XHUwRTE1XHUwRTMyXHUwRTIxXHUwRTIzXHUwRTMyXHUwRTIyXHUwRTAxXHUwRTMyXHUwRTIzXHUwRTJBXHUwRTQ4XHUwRTA3XCIsXG4gICAgICBzaG9ydF9uYW1lOiBcIlNoaXBUcmFja1wiLFxuICAgICAgZGVzY3JpcHRpb246IFwiXHUwRTIzXHUwRTMwXHUwRTFBXHUwRTFBXHUwRTE1XHUwRTM0XHUwRTE0XHUwRTE1XHUwRTMyXHUwRTIxXHUwRTFFXHUwRTMxXHUwRTJBXHUwRTE0XHUwRTM4XHUwRTQxXHUwRTI1XHUwRTMwXHUwRTIzXHUwRTMyXHUwRTIyXHUwRTAxXHUwRTMyXHUwRTIzXHUwRTJBXHUwRTQ4XHUwRTA3XHUwRTAyXHUwRTJEXHUwRTA3XHUwRTJBXHUwRTMyXHUwRTAyXHUwRTMyXHUwRTQxXHUwRTI1XHUwRTMwXHUwRTFFXHUwRTE5XHUwRTMxXHUwRTAxXHUwRTA3XHUwRTMyXHUwRTE5XCIsXG4gICAgICB0aGVtZV9jb2xvcjogXCIjMDkxNDI2XCIsXG4gICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwOTE0MjZcIixcbiAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxuICAgICAgb3JpZW50YXRpb246IFwicG9ydHJhaXRcIixcbiAgICAgIHN0YXJ0X3VybDogXCIvXCIsXG4gICAgICBpY29uczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBcImljb24tMTkyLXYyLnBuZ1wiLFxuICAgICAgICAgIHNpemVzOiBcIjE5MngxOTJcIixcbiAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6IFwiaWNvbi01MTItdjIucG5nXCIsXG4gICAgICAgICAgc2l6ZXM6IFwiNTEyeDUxMlwiLFxuICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXG4gICAgICAgICAgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIlxuICAgICAgICB9XG4gICAgICBdXG4gICAgfVxuICB9KVxuXTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2lucyxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIsIFwic3JjXCIpLFxuICAgICAgXCJAYXNzZXRzXCI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImF0dGFjaGVkX2Fzc2V0c1wiKSxcbiAgICB9LFxuICB9LFxuICBlbnZEaXI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lKSxcbiAgcm9vdDogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIpLFxuICBidWlsZDoge1xuICAgIC8vIERlcGxveSB0YXJnZXQgZm9yIFZlcmNlbC9zdGF0aWMgaG9zdGluZzogcmVwb1Jvb3QvZGlzdFxuICAgIG91dERpcjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiZGlzdFwiKSxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKCFpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJsZWFmbGV0XCIpKSByZXR1cm4gXCJtYXBcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJxcmNvZGVcIikpIHJldHVybiBcInFyXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVjaGFydHNcIikpIHJldHVybiBcImNoYXJ0c1wiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkByYWRpeC11aVwiKSkgcmV0dXJuIFwicmFkaXhcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWFjdFwiKSB8fCBpZC5pbmNsdWRlcyhcInJlYWN0LWRvbVwiKSkgcmV0dXJuIFwicmVhY3RcIjtcbiAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3JcIjtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSwgLy8gV2lsbCBmaW5kIG5leHQgYXZhaWxhYmxlIHBvcnQgaWYgMzAwMCBpcyBidXN5XG4gICAgaG9zdDogdHJ1ZSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2WCxPQUFPLGlCQUFpQjtBQUNyWixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUp4QixJQUFNLG1DQUFtQztBQU16QyxJQUFNLFVBQVU7QUFBQSxFQUNkLE1BQU07QUFBQSxFQUNOLFlBQVk7QUFBQSxFQUNaLFFBQVE7QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLGVBQWU7QUFBQSxNQUNiO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsYUFBYSxDQUFDLGVBQWUsZUFBZSxjQUFjO0FBQUEsTUFDMUQsZUFBZSxDQUFDLHNCQUFzQjtBQUFBLElBQ3hDO0FBQUEsSUFDQSxVQUFVO0FBQUEsTUFDUixNQUFNO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixhQUFhO0FBQUEsTUFDYixhQUFhO0FBQUEsTUFDYixrQkFBa0I7QUFBQSxNQUNsQixTQUFTO0FBQUEsTUFDVCxhQUFhO0FBQUEsTUFDYixXQUFXO0FBQUEsTUFDWCxPQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsT0FBTztBQUFBLFVBQ1AsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixTQUFTO0FBQUEsUUFDWDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQXFCLFVBQVUsS0FBSztBQUFBLE1BQ3RELFdBQVcsS0FBSyxRQUFRLGtDQUFxQixpQkFBaUI7QUFBQSxJQUNoRTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVEsS0FBSyxRQUFRLGdDQUFtQjtBQUFBLEVBQ3hDLE1BQU0sS0FBSyxRQUFRLGtDQUFxQixRQUFRO0FBQUEsRUFDaEQsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRLEtBQUssUUFBUSxrQ0FBcUIsTUFBTTtBQUFBLElBQ2hELGFBQWE7QUFBQSxJQUNiLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGFBQWEsSUFBSTtBQUNmLGNBQUksQ0FBQyxHQUFHLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFDekMsY0FBSSxHQUFHLFNBQVMsU0FBUyxFQUFHLFFBQU87QUFDbkMsY0FBSSxHQUFHLFNBQVMsUUFBUSxFQUFHLFFBQU87QUFDbEMsY0FBSSxHQUFHLFNBQVMsVUFBVSxFQUFHLFFBQU87QUFDcEMsY0FBSSxHQUFHLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDckMsY0FBSSxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUM3RCxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQTtBQUFBLElBQ1osTUFBTTtBQUFBLEVBQ1I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
