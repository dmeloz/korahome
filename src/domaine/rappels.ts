import { choseAFaire, type Animal } from "./mitsu";
import { ecartJours, estTerminee } from "./taches";
import type { Foyer, Id, Jour, Tache } from "./types";

// Le rappel du matin : une seule notification par personne, à 8 h, qui résume ce
// qui l'attend ce jour-là. Chacun reçoit ses tâches et les tâches libres (pas
// celles que l'autre a prises), et ce qui presse pour Mitsu. Rien à signaler :
// pas de notification. Ce module sert aussi au serveur qui envoie les rappels
// (supabase/functions/rappels) : il reste sans dépendance.

/** Ce que chaque personne choisit de recevoir, sur son téléphone. */
export interface PreferencesRappels {
  taches: boolean;
  mitsu: boolean;
}

export const PREFERENCES_DE_DEPART: PreferencesRappels = { taches: true, mitsu: true };

/** L'heure du rappel, décidée avec le foyer. */
export const HEURE_DU_RAPPEL = 8;
export const FUSEAU_DU_FOYER = "Europe/Zurich";

export interface RappelDuMatin {
  titre: string;
  corps: string;
  /** Le nombre de choses rappelées, pour la pastille. */
  nombre: number;
}

/** Au plus trois noms par ligne, puis « et 2 autres ». */
const MAX_PAR_LIGNE = 3;

function enumerer(noms: string[]): string {
  if (noms.length <= MAX_PAR_LIGNE) return noms.join(", ");
  const reste = noms.length - MAX_PAR_LIGNE;
  return `${noms.slice(0, MAX_PAR_LIGNE).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/** Les tâches de cette personne et les tâches libres, dues aujourd'hui ou en retard. */
export function tachesDuMatin(taches: Tache[], membreId: Id | null, aujourdhui: Jour): { aujourdhui: Tache[]; enRetard: Tache[] } {
  const miennes = taches
    .filter((t) => !estTerminee(t) && (membreId === null || t.responsable === null || t.responsable === membreId))
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
  return {
    aujourdhui: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) === 0),
    enRetard: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) < 0),
  };
}

export function rappelDuMatin(entree: {
  foyer: Foyer | null;
  membreId: Id | null;
  taches: Tache[];
  animaux: Animal[];
  aujourdhui: Jour;
  preferences: PreferencesRappels;
}): RappelDuMatin | null {
  const { preferences, aujourdhui } = entree;
  const lignes: string[] = [];
  let nombre = 0;

  if (preferences.taches) {
    const t = tachesDuMatin(entree.taches, entree.membreId, aujourdhui);
    if (t.aujourdhui.length) lignes.push(`Aujourd'hui : ${enumerer(t.aujourdhui.map((x) => x.titre))}`);
    if (t.enRetard.length) lignes.push(`En retard : ${enumerer(t.enRetard.map((x) => x.titre))}`);
    nombre += t.aujourdhui.length + t.enRetard.length;
  }

  if (preferences.mitsu) {
    for (const animal of entree.animaux) {
      const urgentes = choseAFaire(animal, aujourdhui).filter((c) => c.urgent);
      if (!urgentes.length) continue;
      lignes.push(`${animal.nom} : ${urgentes.slice(0, 2).map((c) => c.texte).join(" · ")}${urgentes.length > 2 ? "…" : ""}`);
      nombre += urgentes.length;
    }
  }

  if (nombre === 0) return null;
  const prenom = entree.foyer?.membres.find((m) => m.id === entree.membreId)?.prenom;
  return { titre: prenom ? `Bonjour ${prenom}` : "Bonjour", corps: lignes.join("\n"), nombre };
}

/** La date et l'heure d'un instant dans le fuseau du foyer (l'heure d'été est prise en compte). */
export function jourEtHeure(instant: Date, fuseau: string = FUSEAU_DU_FOYER): { jour: Jour; heure: number } {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { jour: `${parties.year}-${parties.month}-${parties.day}`, heure: Number(parties.hour) };
}

/**
 * Le serveur passe chaque heure : un téléphone reçoit son rappel au premier passage
 * à partir de son heure, une seule fois par jour (un passage manqué est rattrapé
 * dans la matinée, jamais l'après-midi).
 */
export function rappelDu(instant: Date, heure: number, dernierEnvoi: Jour | null, fuseau: string = FUSEAU_DU_FOYER): Jour | null {
  const local = jourEtHeure(instant, fuseau);
  if (local.heure < heure || local.heure >= Math.max(heure + 1, 12)) return null;
  return dernierEnvoi === local.jour ? null : local.jour;
}
