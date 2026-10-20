import { readFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import paquet from "./package.json" with { type: "json" };

// Certificats créés par scripts/serveur-mac.sh pour servir l'app en https sur le réseau local.
const dossierHttps = process.env.KORAHOME_HTTPS;
const https = dossierHttps
  ? { key: readFileSync(join(dossierHttps, "serveur.key")), cert: readFileSync(join(dossierHttps, "serveur.crt")) }
  : undefined;

// Le chemin où l'app est servie : « / » sur un domaine à elle, « /korahome/ » sur GitHub Pages
// (https://dmeloz.github.io/korahome/). Réglé par la variable KORAHOME_BASE à la construction.
const base = process.env.KORAHOME_BASE ?? "/";

export default defineConfig({
  base,
  define: { __VERSION__: JSON.stringify(paquet.version) },
  preview: { https },
  plugins: [
    react(),
    VitePWA({
      // « prompt » : la nouvelle version attend le geste « Mettre à jour » (bandeau).
      registerType: "prompt",
      // Au tout premier lancement, l'app est prise en charge tout de suite.
      // Les rappels du matin : réception et toucher d'une notification (public/notifications-sw.js).
      // Le lecteur de codes-barres (WebAssembly) est gardé avec l'app pour marcher hors ligne.
      workbox: {
        clientsClaim: true,
        importScripts: ["notifications-sw.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "KoraHome",
        short_name: "KoraHome",
        description: "L'app compagnon de la famille : listes, tâches et tableau de bord partagés.",
        lang: "fr",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0F1211",
        theme_color: "#0F1211",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // Les copies de travail des assistants (.claude/worktrees) ne sont pas testées avec l'app.
  test: { environment: "node", exclude: ["**/node_modules/**", ".claude/**"] },
});
