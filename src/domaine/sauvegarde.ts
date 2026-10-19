import type { DocAgenda } from "./agenda";
import type { DocCouple } from "./bandeau";
import type { ProduitHabituel } from "./catalogue";
import type { DocChef } from "./chef";
import { ErreurValidation } from "./foyer";
import type { Zone } from "./jardin";
import type { Souvenir } from "./memoire";
import type { Animal } from "./mitsu";
import type { RetourTest } from "./retours";
import type { Produit } from "./stock";
import { ecartJours } from "./taches";
import type { Element, Foyer, Jour, Liste, Tache } from "./types";

// La sauvegarde de la semaine : tout le foyer dans un seul fichier, que l'iPhone range
// dans Fichiers (iCloud Drive, le dossier de l'Atelier sur le Mac). Un toucher pour
// l'écrire, un toucher pour la reprendre. Le serveur partagé garde déjà tout ; ce
// fichier est la copie qui ne dépend de personne.

export const FORMAT_SAUVEGARDE = "korahome-sauvegarde";
/** La forme du fichier ; une version plus récente de Kora sait relire les plus anciennes. */
export const VERSION_FORMAT = 1;

export interface ContenuFoyer {
  foyer: Foyer;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  animaux: Animal[];
  produits: Produit[];
  catalogue: ProduitHabituel[];
  zones: Zone[];
  souvenirs: Souvenir[];
  couple: DocCouple[];
  menus: DocChef[];
  agenda: DocAgenda[];
  retours: RetourTest[];
}

export interface Sauvegarde extends ContenuFoyer {
  format: typeof FORMAT_SAUVEGARDE;
  versionFormat: number;
  /** La version de Kora qui l'a écrite. */
  versionKora: string;
  creeLe: string;
}

const COLLECTIONS = ["listes", "elements", "taches", "animaux", "produits", "catalogue", "zones", "souvenirs", "couple", "menus", "agenda", "retours"] as const;

export function creerSauvegarde(contenu: ContenuFoyer, versionKora: string, maintenant: string): Sauvegarde {
  return { format: FORMAT_SAUVEGARDE, versionFormat: VERSION_FORMAT, versionKora, creeLe: maintenant, ...contenu };
}

/** « KoraHome Cassa 2026-10-19.json » : le foyer et le jour, rangés dans l'ordre. */
export function nomFichier(foyer: Foyer, maintenant: string): string {
  const nom = foyer.nom.replace(/[^\p{L}\p{N} -]/gu, "").trim() || "foyer";
  return `KoraHome ${nom} ${maintenant.slice(0, 10)}.json`;
}

/** Relit un fichier de sauvegarde ; refuse tout ce qui n'en est pas un. */
export function lireSauvegarde(texte: string): Sauvegarde {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ErreurValidation("Ce fichier n'est pas une sauvegarde de Kora.");
  }
  const s = brut as Partial<Sauvegarde> | null;
  if (!s || typeof s !== "object" || s.format !== FORMAT_SAUVEGARDE) throw new ErreurValidation("Ce fichier n'est pas une sauvegarde de Kora.");
  if (typeof s.versionFormat !== "number" || s.versionFormat > VERSION_FORMAT) throw new ErreurValidation("Cette sauvegarde vient d'une version plus récente de Kora : mets l'app à jour d'abord.");
  if (!s.foyer || typeof s.foyer !== "object" || typeof s.foyer.id !== "string" || !Array.isArray(s.foyer.membres)) throw new ErreurValidation("La sauvegarde ne contient pas de foyer.");
  const propre = { ...s } as Sauvegarde;
  for (const c of COLLECTIONS) {
    const valeur = s[c];
    // Une collection absente (sauvegarde ancienne) est vide ; chaque document doit avoir son identifiant.
    const liste = Array.isArray(valeur) ? valeur.filter((d): d is never => !!d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string") : [];
    (propre as unknown as Record<string, unknown[]>)[c] = liste;
  }
  return propre;
}

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;

/** « 2 listes, 34 articles, 6 tâches, 12 rendez-vous » : ce qu'on va reprendre. */
export function resumeSauvegarde(s: ContenuFoyer): string {
  const rdv = s.agenda.filter((d) => "titre" in d).length;
  return [
    pluriel(s.listes.length, "liste"),
    pluriel(s.elements.length, "article"),
    pluriel(s.taches.length, "tâche"),
    pluriel(rdv, "rendez-vous", "rendez-vous"),
    pluriel(s.produits.length, "produit"),
    s.animaux.length ? s.animaux.map((a) => a.nom).join(" et ") : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Une semaine sans sauvegarde, ou jamais : il est temps. */
export const JOURS_ENTRE_SAUVEGARDES = 7;

export function sauvegardeDue(derniere: string | null, aujourdhui: Jour): boolean {
  if (!derniere) return true;
  return ecartJours(derniere.slice(0, 10), aujourdhui) >= JOURS_ENTRE_SAUVEGARDES;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « Jamais », « aujourd'hui », « hier », « dimanche », « le 12.10 ». */
export function decrireDerniere(derniere: string | null, aujourdhui: Jour): string {
  if (!derniere) return "jamais";
  const jour = derniere.slice(0, 10);
  const ecart = ecartJours(jour, aujourdhui);
  if (ecart <= 0) return "aujourd'hui";
  if (ecart === 1) return "hier";
  if (ecart < 7) {
    const [a, m, j] = jour.split("-").map(Number);
    return JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
  }
  return `le ${jour.slice(8, 10)}.${jour.slice(5, 7)}`;
}
