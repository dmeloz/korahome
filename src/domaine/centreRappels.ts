import { ecartJours } from "./taches";
import type { Jour } from "./types";

// Le centre des rappels : la cloche de l'accueil garde ce que Kora a envoyé (le rappel
// du matin, un mot de l'autre, une alerte du Chef), pour le relire après avoir
// balayé la notification. Propre à chaque téléphone.

export interface RappelRecu {
  /** L'instant de réception (ISO 8601). */
  le: string;
  titre: string;
  corps: string;
  /** « rappel-du-matin », « mot », « chef »… ; un même genre le même jour remplace le précédent. */
  genre: string;
  lu?: boolean;
}

/** On garde un mois de rappels, pas plus. */
export const JOURS_GARDES = 30;

/** Range un rappel reçu : le plus récent d'abord, sans doublon du jour, un mois au plus. */
export function ajouterRappel(journal: readonly RappelRecu[], rappel: RappelRecu, aujourdhui: Jour): RappelRecu[] {
  const jour = rappel.le.slice(0, 10);
  const sansDoublon = journal.filter((r) => !(r.genre === rappel.genre && r.le.slice(0, 10) === jour && rappel.genre === "rappel-du-matin") && !(r.le === rappel.le && r.titre === rappel.titre));
  return nettoyerJournal([rappel, ...sansDoublon], aujourdhui);
}

export function nettoyerJournal(brut: unknown, aujourdhui: Jour): RappelRecu[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((r): r is RappelRecu => !!r && typeof r === "object" && typeof r.le === "string" && typeof r.titre === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.le))
    .map((r) => ({ le: r.le, titre: r.titre, corps: typeof r.corps === "string" ? r.corps : "", genre: typeof r.genre === "string" ? r.genre : "rappel", ...(r.lu ? { lu: true } : {}) }))
    .filter((r) => ecartJours(r.le.slice(0, 10), aujourdhui) < JOURS_GARDES)
    .sort((a, b) => b.le.localeCompare(a.le));
}

export const nonLus = (journal: readonly RappelRecu[]) => journal.filter((r) => !r.lu).length;

export const toutLu = (journal: readonly RappelRecu[]): RappelRecu[] => journal.map((r) => ({ ...r, lu: true }));

/** Par jour : « Aujourd'hui », « Hier », puis « Lundi 12 octobre ». */
export function grouperParJour(journal: readonly RappelRecu[], aujourdhui: Jour, jourLocal: (iso: string) => Jour = (iso) => iso.slice(0, 10)): { titre: string; rappels: RappelRecu[] }[] {
  const groupes: { titre: string; rappels: RappelRecu[] }[] = [];
  for (const r of journal) {
    const jour = jourLocal(r.le);
    const ecart = ecartJours(jour, aujourdhui);
    const titre = ecart <= 0 ? "Aujourd'hui" : ecart === 1 ? "Hier" : nomDuJour(jour);
    const g = groupes.find((x) => x.titre === titre);
    if (g) g.rappels.push(r);
    else groupes.push({ titre, rappels: [r] });
  }
  return groupes;
}

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function nomDuJour(jour: Jour): string {
  const [a, m, j] = jour.split("-").map(Number);
  return `${JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j} ${MOIS[m - 1]}`;
}
