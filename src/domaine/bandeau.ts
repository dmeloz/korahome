// Ce qui se dit entre vous deux : les mots que l'un écrit à l'autre (ils attendent au-dessus de
// la fée), l'humeur du jour de chacun (un signe de l'accueil), les comptes à rebours et le clin
// d'œil du jour que dit la fée. Page « Nos mots ». Tout se partage entre les deux iPhone dans la
// collection « couple ».

import { ErreurValidation } from "./foyer";
import { ecartJours } from "./taches";
import type { Contexte, Foyer, Id, Jour } from "./types";

/** Un mot de l'un à l'autre ; programmé, il n'apparaît qu'à partir de `visibleDes`. */
export interface Mot {
  type: "mot";
  id: Id;
  de: Id | null;
  texte: string;
  creeLe: string;
  visibleDes: string;
  /** Écrit pour plus tard (ce soir, demain matin) : le serveur le notifie à son heure. */
  programme: boolean;
  /** Ceux qui ont envoyé un cœur en retour. */
  coeurs: Id[];
  /** Un cœur envoyé seul, sans mot, depuis la fée. */
  coeur?: boolean;
}

/** L'humeur d'une personne pour un jour : une seule par personne et par jour. */
export interface Humeur {
  type: "humeur";
  id: Id;
  de: Id;
  jour: Jour;
  emoji: string;
}

/** « Vacances dans 12 jours ». */
export interface CompteARebours {
  type: "compte";
  id: Id;
  titre: string;
  jour: Jour;
  creePar: Id | null;
  creeLe: string;
}

/** Le clin d'œil du jour de Jarvis, demandé une seule fois par jour pour tout le foyer. */
export interface ClinDOeil {
  type: "clin";
  id: Id;
  jour: Jour;
  texte: string;
}

export type DocCouple = Mot | Humeur | CompteARebours | ClinDOeil;

export const LONGUEUR_MOT = 140;

// L'emoji reste l'identifiant enregistré (les humeurs déjà notées restent lisibles) ;
// l'écran montre un pictogramme au trait et le nom, qui ne dit ni « il » ni « elle ».
export const HUMEURS: { emoji: string; nom: string }[] = [
  { emoji: "😊", nom: "Bien" },
  { emoji: "🥰", nom: "Plein d'amour" },
  { emoji: "😌", nom: "Zen" },
  { emoji: "🎉", nom: "En forme" },
  { emoji: "😴", nom: "Fatigue" },
  { emoji: "😤", nom: "Tension" },
  { emoji: "🤯", nom: "Débordement" },
  { emoji: "🤒", nom: "Malade" },
];

/** Le nom d'une humeur enregistrée. */
export const nomHumeur = (emoji: string) => HUMEURS.find((h) => h.emoji === emoji)?.nom ?? emoji;

const est = <T extends DocCouple["type"]>(type: T) => (d: DocCouple): d is Extract<DocCouple, { type: T }> => d.type === type;

export function nouveauMot(texte: string, de: Id | null, ctx: Contexte, visibleDes?: string): Mot {
  const propre = texte.trim().replace(/\s+/g, " ");
  if (!propre) throw new ErreurValidation("Le mot est vide.");
  if (propre.length > LONGUEUR_MOT) throw new ErreurValidation(`Un mot tient en ${LONGUEUR_MOT} caractères.`);
  const creeLe = ctx.maintenant();
  const plusTard = !!visibleDes && visibleDes > creeLe;
  return { type: "mot", id: ctx.nouvelId(), de, texte: propre, creeLe, visibleDes: plusTard ? visibleDes : creeLe, programme: plusTard, coeurs: [] };
}

/** Un cœur seul, envoyé d'un toucher à l'autre. */
export function nouveauCoeur(de: Id | null, ctx: Contexte): Mot {
  return { ...nouveauMot("♥", de, ctx), coeur: true };
}

export const estVisible = (m: Mot, maintenant: string) => m.visibleDes <= maintenant;

/** Un cœur en retour, ou on le reprend. */
export function basculerCoeur(m: Mot, membre: Id): Mot {
  return { ...m, coeurs: m.coeurs.includes(membre) ? m.coeurs.filter((c) => c !== membre) : [...m.coeurs, membre] };
}

/** Tous les mots déjà visibles, du plus récent au plus ancien ; ceux qu'on a programmés soi-même aussi. */
export function nosMots(docs: readonly DocCouple[], moi: Id | null, maintenant: string): Mot[] {
  return docs
    .filter(est("mot"))
    .filter((m) => estVisible(m, maintenant) || m.de === moi)
    .sort((a, b) => b.visibleDes.localeCompare(a.visibleDes));
}

export function humeurDu(docs: readonly DocCouple[], de: Id, jour: Jour): Humeur | undefined {
  return docs.filter(est("humeur")).find((h) => h.de === de && h.jour === jour);
}

/** Une humeur par personne et par jour : l'identifiant le garantit, la nouvelle remplace l'ancienne. */
export function noterHumeur(de: Id, jour: Jour, emoji: string): Humeur {
  return { type: "humeur", id: `humeur-${de}-${jour}`, de, jour, emoji };
}

export function nouveauCompte(titre: string, jour: Jour, creePar: Id | null, aujourdhui: Jour, ctx: Contexte): CompteARebours {
  const propre = titre.trim();
  if (!propre) throw new ErreurValidation("Donne un nom au compte à rebours.");
  if (jour < aujourdhui) throw new ErreurValidation("Cette date est déjà passée.");
  return { type: "compte", id: ctx.nouvelId(), titre: propre, jour, creePar, creeLe: ctx.maintenant() };
}

/** « Vacances dans 12 jours », « Vacances demain », « C'est aujourd'hui : vacances » ; null une fois passé. */
export function decrireCompte(c: CompteARebours, aujourdhui: Jour): string | null {
  const n = ecartJours(aujourdhui, c.jour);
  if (n < 0) return null;
  if (n === 0) return `C'est aujourd'hui : ${c.titre.charAt(0).toLowerCase()}${c.titre.slice(1)}`;
  if (n === 1) return `${c.titre} demain`;
  return `${c.titre} dans ${n} jours`;
}

export function comptesAVenir(docs: readonly DocCouple[], aujourdhui: Jour): CompteARebours[] {
  return docs
    .filter(est("compte"))
    .filter((c) => c.jour >= aujourdhui)
    .sort((a, b) => a.jour.localeCompare(b.jour));
}

export const idClin = (jour: Jour) => `clin-${jour}`;
export function clinDuJour(docs: readonly DocCouple[], jour: Jour): ClinDOeil | undefined {
  return docs.filter(est("clin")).find((c) => c.jour === jour);
}
export function nouveauClin(jour: Jour, texte: string): ClinDOeil | null {
  const propre = texte.trim().replace(/\s+/g, " ").replace(/^["«»\s]+|["«»\s]+$/g, "");
  return propre ? { type: "clin", id: idClin(jour), jour, texte: propre.slice(0, 160) } : null;
}

/** Ce qu'on demande à Jarvis chaque jour, une fois pour tout le foyer. */
export const DEMANDE_CLIN =
  "Écris le clin d'œil du jour, que la fée dira à l'accueil : une seule phrase courte et chaleureuse (au plus 90 caractères), pour vous deux, tirée de ce que tu sais du foyer (ta mémoire, la saison, la semaine, Mitsu, le jardin). Pas d'outil, pas de guillemets, pas d'emoji au début.";

/**
 * Les mots programmés que le passage de l'heure doit annoncer : ceux devenus visibles depuis
 * le passage précédent. Fenêtre calée sur l'heure pleine, pour qu'un passage en retard de
 * quelques secondes n'en oublie ni n'en double aucun.
 */
export function fenetreMotsProgrammes(maintenant: Date): { apres: string; jusqua: string } {
  const heure = Math.floor(maintenant.getTime() / 3_600_000) * 3_600_000;
  return { apres: new Date(heure - 3_600_000).toISOString(), jusqua: new Date(heure).toISOString() };
}

/** Le titre de la notification d'un mot. */
export function notificationMot(foyer: Foyer, m: Mot): { titre: string; corps: string } {
  const prenom = foyer.membres.find((x) => x.id === m.de)?.prenom;
  return { titre: prenom ? `Un mot de ${prenom}` : "Un petit mot", corps: m.texte };
}
