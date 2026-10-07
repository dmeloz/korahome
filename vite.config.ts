import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import paquet from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(paquet.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "KoraHome",
        short_name: "KoraHome",
        description: "L'app compagnon de la famille : listes, tâches et agenda partagés.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#F7F4EF",
        theme_color: "#F7F4EF",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: { environment: "node" },
});
