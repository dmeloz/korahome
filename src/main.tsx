import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { creerDepotLocal } from "./donnees/depotLocal";
import { App } from "./ui/App";
import { creerMiseAJour } from "./ui/miseAJour";
import "./styles.css";

const miseAJour = creerMiseAJour(
  registerSW,
  (recharger) => navigator.serviceWorker?.addEventListener("controllerchange", recharger),
  () => window.location.reload(),
);

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <App depot={creerDepotLocal()} miseAJour={miseAJour} />
  </StrictMode>,
);
