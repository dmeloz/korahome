import { nettoyerJournal, toutLu, type RappelRecu } from "../domaine/centreRappels";
import type { Jour } from "../domaine/types";

// Les rappels reçus, gardés par le service worker (public/notifications-sw.js) dans
// le cache du téléphone. On les relit à l'ouverture de la cloche.

const CACHE = "korahome-rappels";
// Même adresse que le service worker (public/notifications-sw.js), sous le chemin de l'app (« /korahome/ » sur GitHub Pages).
const ADRESSE = `${import.meta.env.BASE_URL}__rappels.json`;

export async function lireRappels(aujourdhui: Jour): Promise<RappelRecu[]> {
  try {
    if (typeof caches === "undefined") return [];
    const reponse = await (await caches.open(CACHE)).match(ADRESSE);
    return nettoyerJournal(reponse ? await reponse.json() : [], aujourdhui);
  } catch {
    return [];
  }
}

export async function marquerRappelsLus(journal: readonly RappelRecu[]): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    await (await caches.open(CACHE)).put(ADRESSE, new Response(JSON.stringify(toutLu(journal)), { headers: { "content-type": "application/json" } }));
  } catch {
    // Cache indisponible : la pastille reviendra, sans gravité.
  }
}
