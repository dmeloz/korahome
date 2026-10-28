// Le hub Kora sur iPad (0.0.95, proposition 5 de la nuit du 26 octobre, maquette validée par
// Melo le 28 octobre) : un écran posé dans la cuisine, qui se consulte à deux, debout. Dès 760
// points de large, l'accueil remplace ses chiffres, « Ce soir » et ses piles par une grille
// « bento » graphite et laiton : ce soir pour les deux, le menu du Chef, les courses à prendre,
// demain, le dernier mot de l'autre, le balcon et sa météo. Pas de réglages ni de Budget ici.
// Ce fichier compose les six cartes depuis les données déjà là ; l'écran les dessine.

import { resumeAgenda, titreDe, type Evenement } from "./agenda";
import { nosMots, type DocCouple, type Mot } from "./bandeau";
import { repasDuSoir, type ChoseDuJour } from "./aujourdhui";
import { type DocChef } from "./chef";
import { gestesDuJardin, type Zone } from "./jardin";
import { aSortirCeSoir, nomDechet, type ReglageDechets } from "./maison";
import { decrireTemps, meteoDu, meteoFraiche, type Meteo } from "./meteo";
import type { Animal } from "./mitsu";
import { decaler } from "./taches";
import type { Element, Foyer, Id, Jour, Liste } from "./types";

/** Le hub commence à cette largeur de conteneur (l'iPad ; le Duo déplié, à 669, reste en téléphone). */
export const LARGEUR_HUB = 760;
export const COURSES_SUR_LE_HUB = 6;

export interface LigneDemain {
  /** « 08:30 », ou « matin » pour ce qui n'a pas d'heure. */
  quand: string;
  texte: string;
  presse: boolean;
}

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
  /** « pluie demain après-midi » en court : le temps de demain. */
  demain: string | null;
  /** Le geste le plus pressé du jardin, ou une phrase calme. */
  geste: string;
  urgent: boolean;
}

export interface Hub {
  ceSoir: ChoseDuJour[];
  menu: string | null;
  courses: { elements: Element[]; reste: number; liste: Liste | null };
  demain: LigneDemain[];
  mot: MotDuHub | null;
  balcon: BalconDuHub | null;
}

export interface EntreeHub {
  foyer: Foyer;
  membreId: Id | null;
  aujourdhui: Jour;
  maintenant: string;
  choses: readonly ChoseDuJour[];
  menus: readonly DocChef[];
  listes: readonly Liste[];
  elements: readonly Element[];
  evenements: readonly Evenement[];
  animaux: readonly Animal[];
  dechets: ReglageDechets | null;
  couple: readonly DocCouple[];
  zones: readonly Zone[];
  meteo: Meteo | null;
}

const heureDe = (iso: string) => iso.slice(11, 16);

export function composerHub(e: EntreeHub): Hub {
  const liste = e.listes.find((l) => l.type === "courses") ?? null;
  const aPrendre = liste ? e.elements.filter((x) => x.listeId === liste.id && !x.coche).sort((a, b) => a.creeLe.localeCompare(b.creeLe)) : [];

  const demainJour = decaler(e.aujourdhui, { unite: "jour", tous: 1 });
  const agenda = resumeAgenda(e.evenements, e.animaux, e.aujourdhui);
  const demain: LigneDemain[] = agenda.semaine
    .filter((o) => o.debut === demainJour)
    .map((o) => ({ quand: o.evenement.heure ?? "journée", texte: titreDe(o), presse: !!o.evenement.heure }))
    .sort((a, b) => a.quand.localeCompare(b.quand));
  for (const type of aSortirCeSoir(e.dechets, e.aujourdhui)) demain.push({ quand: "matin", texte: `${nomDechet(type)} à la porte`, presse: false });

  const dernier = nosMots(e.couple, e.membreId, e.maintenant).find((m) => m.de !== e.membreId && !m.coeur) ?? null;
  const de = dernier ? e.foyer.membres.find((m) => m.id === dernier.de)?.prenom : null;
  const mot: MotDuHub | null = dernier
    ? { mot: dernier, titre: `De ${de ?? "l'autre"}, à ${heureDe(dernier.visibleDes)}`, coeurDonne: !!e.membreId && dernier.coeurs.includes(e.membreId) }
    : null;

  let balcon: BalconDuHub | null = null;
  if (e.zones.length || e.meteo) {
    const fraiche = meteoFraiche(e.meteo, e.maintenant) ? e.meteo : null;
    const ceSoir = fraiche ? (meteoDu(fraiche, demainJour) ?? meteoDu(fraiche, e.aujourdhui)) : null;
    const lendemain = fraiche ? meteoDu(fraiche, demainJour) : null;
    const gestes = gestesDuJardin(e.zones, e.meteo, e.aujourdhui);
    const premier = gestes.find((g) => g.urgent) ?? gestes[0] ?? null;
    balcon = {
      nuit: ceSoir ? `${Math.round(ceSoir.min)}°` : null,
      demain: lendemain ? `${decrireTemps(lendemain.code).toLowerCase()} demain${lendemain.pluie >= 1 ? `, ${Math.round(lendemain.pluie)} mm` : ""}` : null,
      geste: premier?.texte ?? (e.zones.length ? "Rien à faire au jardin aujourd'hui." : "Pas de zone au jardin pour l'instant."),
      urgent: !!premier?.urgent,
    };
  }

  return {
    ceSoir: [...e.choses],
    menu: repasDuSoir(e.menus, e.aujourdhui),
    courses: { elements: aPrendre.slice(0, COURSES_SUR_LE_HUB), reste: Math.max(0, aPrendre.length - COURSES_SUR_LE_HUB), liste },
    demain,
    mot,
    balcon,
  };
}

/** « 3 à faire », « Tout est fait ». */
export function compterCeSoir(choses: readonly ChoseDuJour[]): string {
  const n = choses.length;
  return n === 0 ? "Tout est fait" : `${n} à faire`;
}
