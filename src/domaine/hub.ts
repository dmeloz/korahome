// Ce qu'il reste du hub iPad (0.0.95, retiré avec Kora 0.1) : deux cartes de l'écran Aujourd'hui
// composées depuis les données déjà là, le dernier mot de l'autre et le jardin avec sa nuit.
// Le reste de l'écran (la carte du moment, « Demain ») est dans `aujourdhui.ts`.

import { nosMots, type DocCouple, type Mot } from "./bandeau";
import { gestesDuJardin, type Zone } from "./jardin";
import { meteoDu, meteoFraiche, type Meteo } from "./meteo";
import { decaler } from "./taches";
import type { Foyer, Id, Jour } from "./types";

export interface MotDuHub {
  mot: Mot;
  /** « De Sarah, à 17:05 ». */
  titre: string;
  /** La personne du hub a déjà répondu d'un cœur. */
  coeurDonne: boolean;
}

export interface BalconDuHub {
  /** « 4° » : le minimum de la nuit qui vient, null sans météo fraîche. */
  nuit: string | null;
  /** Le geste le plus pressé du jardin, ou une phrase calme. */
  geste: string;
  urgent: boolean;
}

export interface Hub {
  mot: MotDuHub | null;
  balcon: BalconDuHub | null;
}

export interface EntreeHub {
  foyer: Foyer;
  membreId: Id | null;
  aujourdhui: Jour;
  maintenant: string;
  couple: readonly DocCouple[];
  zones: readonly Zone[];
  meteo: Meteo | null;
}

const heureDe = (iso: string) => iso.slice(11, 16);

export function composerHub(e: EntreeHub): Hub {
  const dernier = nosMots(e.couple, e.membreId, e.maintenant).find((m) => m.de !== e.membreId && !m.coeur) ?? null;
  const de = dernier ? e.foyer.membres.find((m) => m.id === dernier.de)?.prenom : null;
  const mot: MotDuHub | null = dernier
    ? { mot: dernier, titre: `De ${de ?? "l'autre"}, à ${heureDe(dernier.visibleDes)}`, coeurDonne: !!e.membreId && dernier.coeurs.includes(e.membreId) }
    : null;

  // Le jardin n'a sa carte que s'il a une zone : sans zone, il n'y a rien à y faire (0.1.14).
  let balcon: BalconDuHub | null = null;
  if (e.zones.length) {
    const fraiche = meteoFraiche(e.meteo, e.maintenant) ? e.meteo : null;
    const demainJour = decaler(e.aujourdhui, { unite: "jour", tous: 1 });
    const ceSoir = fraiche ? (meteoDu(fraiche, demainJour) ?? meteoDu(fraiche, e.aujourdhui)) : null;
    const gestes = gestesDuJardin(e.zones, e.meteo, e.aujourdhui);
    const premier = gestes.find((g) => g.urgent) ?? gestes[0] ?? null;
    balcon = {
      nuit: ceSoir ? `${Math.round(ceSoir.min)}°` : null,
      geste: premier?.texte ?? "Rien à faire au jardin aujourd'hui.",
      urgent: !!premier?.urgent,
    };
  }

  return { mot, balcon };
}
