import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { creerDepotLocal } from "./donnees/depotLocal";
import { configurationSupabase, creerServicesSupabase } from "./donnees/supabase";
import { creerSynchro } from "./donnees/synchro";
import { App, ecranAffiche } from "./ui/App";
import { Moteur } from "./ui/moteur/Moteur";
import { installerJournal } from "./ui/journal";
import { creerMiseAJour, surveillerMisesAJour } from "./ui/miseAJour";
import { appliquerVerre } from "./ui/accueilLocal";
import { appliquerTheme, lireTheme } from "./ui/theme";
import "./styles/index.css";

const miseAJour = creerMiseAJour(
  registerSW,
  (recharger) => navigator.serviceWorker?.addEventListener("controllerchange", recharger),
  () => window.location.reload(),
);

// Le thème et le verre de ce téléphone, avant le premier affichage.
appliquerTheme(lireTheme());
appliquerVerre();

installerJournal(ecranAffiche);
// Les ressorts d'Anime.js arrivent juste après le premier écran, sans l'alourdir.
void import("./ui/moteur/anime").then((m) => m.installerRessorts());

// Au retour dans l'app, on regarde si une version attend.
const auRetour: (() => void)[] = [];
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") auRetour.forEach((f) => f());
});
surveillerMisesAJour(miseAJour, (f) => auRetour.push(f), (f, ms) => setInterval(f, ms));

const depot = creerDepotLocal();
// Sans adresse de serveur (.env.local sur le Mac), l'app reste sur ce téléphone seulement.
const config = configurationSupabase();
const distant = config ? creerServicesSupabase(config.url, config.cle) : null;
const partage = distant ? { compte: distant, synchro: creerSynchro(depot, distant), rappels: distant, jarvis: distant, agenda: distant, tempsReel: distant } : null;

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <Moteur>
      <App depot={depot} miseAJour={miseAJour} partage={partage} />
    </Moteur>
  </StrictMode>,
);
