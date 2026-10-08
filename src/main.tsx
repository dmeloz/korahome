import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { creerDepotLocal } from "./donnees/depotLocal";
import { App, ecranAffiche } from "./ui/App";
import { installerJournal } from "./ui/journal";
import { creerMiseAJour } from "./ui/miseAJour";
import "./styles.css";

const miseAJour = creerMiseAJour(
  registerSW,
  (recharger) => navigator.serviceWorker?.addEventListener("controllerchange", recharger),
  () => window.location.reload(),
);

installerJournal(ecranAffiche);

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <App depot={creerDepotLocal()} miseAJour={miseAJour} />
  </StrictMode>,
);
