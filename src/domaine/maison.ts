// La maison (Kora 0.0.79) : les jours des déchets et nos appareils. Collection partagée
// `maison` : un seul document « dechets » (les collectes à la porte, réglées une fois pour le
// foyer), un document par appareil (lave-linge, frigo… avec sa garantie), et depuis 0.0.87 une
// entrée par ligne du carnet de la maison (le concierge, la gérance, le compteur d'eau).
// Les jours de collecte changent de rue en rue (à Renens, par secteur) : le foyer les règle
// lui-même, Kora calcule les prochaines dates, dit « Sortir le papier » la veille au soir sur
// l'accueil, et le rappel du matin le redit le jour même.

import { ErreurValidation } from "./foyer";
import { normaliser } from "./rayons";
import { decrireEcheance, ecartJours } from "./taches";
import { NOMS_JOURS } from "./texte";
import type { Contexte, Id, Jour } from "./types";

export const TYPES_DECHETS = [
  { id: "ordures", nom: "Ordures ménagères", sortir: "Sortir les ordures" },
  { id: "papier", nom: "Papier et carton", sortir: "Sortir le papier et le carton" },
  { id: "verre", nom: "Verre", sortir: "Sortir le verre" },
  { id: "verts", nom: "Déchets verts", sortir: "Sortir les déchets verts" },
  { id: "encombrants", nom: "Encombrants", sortir: "Sortir les encombrants" },
] as const;
export type TypeDechet = (typeof TYPES_DECHETS)[number]["id"];

export const RYTHMES = [
  { id: "semaine", nom: "Chaque semaine" },
  { id: "quinzaine", nom: "Toutes les deux semaines" },
  { id: "mois", nom: "Une fois par mois" },
] as const;
export type Rythme = (typeof RYTHMES)[number]["id"];

export interface Collecte {
  type: TypeDechet;
  /** 0 = dimanche … 6 = samedi, comme Date.getDay(). */
  jour: number;
  rythme: Rythme;
  /** Pour « toutes les deux semaines » : une date de collecte connue, qui fixe la bonne semaine. */
  reference?: Jour;
  /** Pour « une fois par mois » : le 1er, 2e, 3e ou 4e jour du mois de ce nom. */
  semaineDuMois?: 1 | 2 | 3 | 4;
}

export interface ReglageDechets {
  id: "dechets";
  type: "dechets";
  collectes: Collecte[];
  modifieLe: string;
}

export interface Appareil {
  id: Id;
  type: "appareil";
  nom: string;
  acheteLe: Jour | null;
  /** La durée de la garantie en mois ; null si on ne sait pas. */
  garantieMois: number | null;
  prix: number | null;
  magasin: string | null;
  /** Où est la notice, le numéro de série, ce qu'on veut retenir. */
  note: string | null;
  creeLe: string;
  modifieLe: string;
}

/** Une ligne du carnet de la maison : « Concierge » → « M. Rossi, 079 123 45 67 ». */
export interface EntreeCarnet {
  id: Id;
  type: "carnet";
  titre: string;
  valeur: string;
  creeLe: string;
  modifieLe: string;
}

export type DocMaison = ReglageDechets | Appareil | EntreeCarnet;

export const ID_DECHETS = "dechets";
export const reglageDechets = (docs: readonly DocMaison[]): ReglageDechets | null => docs.find((d): d is ReglageDechets => d.type === "dechets") ?? null;
export const appareilsDe = (docs: readonly DocMaison[]): Appareil[] =>
  docs.filter((d): d is Appareil => d.type === "appareil").sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

export const nomDechet = (type: TypeDechet) => TYPES_DECHETS.find((t) => t.id === type)!.nom;

const jourDeLaSemaine = (jour: Jour) => new Date(`${jour}T12:00:00Z`).getUTCDay();
const decalerJours = (jour: Jour, n: number): Jour => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Le premier jour de ce nom à partir de `depuis` (lui compris). */
function prochainJourNomme(depuis: Jour, jour: number): Jour {
  return decalerJours(depuis, (jour - jourDeLaSemaine(depuis) + 7) % 7);
}

/** Le n-ième jour de ce nom dans le mois de `jour`. */
function jourDuMois(jour: Jour, nomJour: number, n: number): Jour {
  const premier = prochainJourNomme(`${jour.slice(0, 7)}-01`, nomJour);
  return decalerJours(premier, (n - 1) * 7);
}

/** Vrai si ce jour est un jour de collecte. */
export function collecteCeJour(c: Collecte, jour: Jour): boolean {
  if (jourDeLaSemaine(jour) !== c.jour) return false;
  if (c.rythme === "semaine") return true;
  if (c.rythme === "quinzaine") {
    const ref = c.reference ? prochainJourNomme(c.reference, c.jour) : prochainJourNomme("2026-01-01", c.jour);
    return Math.abs(ecartJours(ref, jour)) % 14 === 0;
  }
  return jourDuMois(jour, c.jour, c.semaineDuMois ?? 1) === jour;
}

/** La prochaine collecte à partir d'aujourd'hui (aujourd'hui compris). */
export function prochaineCollecte(c: Collecte, aujourdhui: Jour): Jour {
  let jour = prochainJourNomme(aujourdhui, c.jour);
  for (let i = 0; i < 8 && !collecteCeJour(c, jour); i++) jour = decalerJours(jour, 7);
  return jour;
}

export interface ProchaineCollecte {
  collecte: Collecte;
  jour: Jour;
  /** « demain », « jeudi 30 », « dans 12 jours ». */
  quand: string;
}

/** Les prochaines collectes, la plus proche d'abord. */
export function prochainesCollectes(reglage: ReglageDechets | null, aujourdhui: Jour): ProchaineCollecte[] {
  if (!reglage) return [];
  return reglage.collectes
    .map((collecte) => {
      const jour = prochaineCollecte(collecte, aujourdhui);
      const ecart = ecartJours(aujourdhui, jour);
      const quand = ecart <= 1 ? decrireEcheance(jour, aujourdhui) : ecart < 7 ? `${NOMS_JOURS[jourDeLaSemaine(jour)].toLowerCase()} ${Number(jour.slice(8, 10))}` : decrireEcheance(jour, aujourdhui);
      return { collecte, jour, quand };
    })
    .sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Ce qu'il faut sortir ce soir : les collectes de demain. */
export function aSortirCeSoir(reglage: ReglageDechets | null, aujourdhui: Jour): TypeDechet[] {
  if (!reglage) return [];
  const demain = decalerJours(aujourdhui, 1);
  return reglage.collectes.filter((c) => collecteCeJour(c, demain)).map((c) => c.type);
}

/** Les collectes du jour, pour le rappel du matin. */
export function collectesDuJour(reglage: ReglageDechets | null, aujourdhui: Jour): TypeDechet[] {
  if (!reglage) return [];
  return reglage.collectes.filter((c) => collecteCeJour(c, aujourdhui)).map((c) => c.type);
}

/** « Sortir le papier et le carton », « Sortir les ordures et le verre ». */
export function phraseSortir(types: readonly TypeDechet[]): string {
  if (!types.length) return "";
  if (types.length === 1) return TYPES_DECHETS.find((t) => t.id === types[0])!.sortir;
  const noms = types.map((t) => nomDechet(t).toLowerCase());
  return `Sortir : ${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Pose ou remplace une collecte (une par type) ; `null` la retire. */
export function reglerCollecte(reglage: ReglageDechets | null, type: TypeDechet, collecte: Omit<Collecte, "type"> | null, ctx: Contexte): ReglageDechets {
  const autres = (reglage?.collectes ?? []).filter((c) => c.type !== type);
  const ordre = TYPES_DECHETS.map((t) => t.id);
  const collectes = collecte ? [...autres, { ...collecte, type }] : autres;
  return { id: "dechets", type: "dechets", collectes: collectes.sort((a, b) => ordre.indexOf(a.type) - ordre.indexOf(b.type)), modifieLe: ctx.maintenant() };
}

// ----- Les appareils -----

export const LONGUEUR_NOM_APPAREIL = 60;
/** Une garantie qui finit dans moins de deux mois mérite qu'on le dise. */
export const JOURS_GARANTIE_BIENTOT = 60;

export function nouvelAppareil(nom: string, ctx: Contexte): Appareil | null {
  const n = nom.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_NOM_APPAREIL);
  if (!n) return null;
  return { id: ctx.nouvelId(), type: "appareil", nom: n, acheteLe: null, garantieMois: null, prix: null, magasin: null, note: null, creeLe: ctx.maintenant(), modifieLe: ctx.maintenant() };
}

export function modifierAppareil(a: Appareil, changements: Partial<Omit<Appareil, "id" | "type" | "creeLe" | "modifieLe">>, ctx: Contexte): Appareil {
  const nom = changements.nom === undefined ? a.nom : changements.nom.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_NOM_APPAREIL) || a.nom;
  return { ...a, ...changements, nom, modifieLe: ctx.maintenant() };
}

/** Le dernier jour de la garantie, ou null quand on ne sait pas. */
export function finDeGarantie(a: Appareil): Jour | null {
  if (!a.acheteLe || !a.garantieMois) return null;
  const d = new Date(`${a.acheteLe}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + a.garantieMois);
  return decalerJours(d.toISOString().slice(0, 10), -1);
}

export type EtatGarantie = { etat: "inconnue" } | { etat: "en-cours"; fin: Jour; texte: string } | { etat: "bientot"; fin: Jour; texte: string } | { etat: "finie"; fin: Jour; texte: string };

/** « Garantie jusqu'au 12.03.2028 », « Garantie finit dans 23 jours », « Plus sous garantie ». */
export function etatGarantie(a: Appareil, aujourdhui: Jour): EtatGarantie {
  const fin = finDeGarantie(a);
  if (!fin) return { etat: "inconnue" };
  const ecart = ecartJours(aujourdhui, fin);
  const date = `${fin.slice(8, 10)}.${fin.slice(5, 7)}.${fin.slice(0, 4)}`;
  if (ecart < 0) return { etat: "finie", fin, texte: "Plus sous garantie" };
  if (ecart <= JOURS_GARANTIE_BIENTOT) return { etat: "bientot", fin, texte: ecart === 0 ? "Garantie finit aujourd'hui" : `Garantie finit dans ${ecart} jour${ecart > 1 ? "s" : ""}` };
  return { etat: "en-cours", fin, texte: `Garantie jusqu'au ${date}` };
}

/** « Acheté le 12.03.2026 chez Galaxus · 899 CHF ». */
export function decrireAchat(a: Appareil): string {
  const parts = [
    a.acheteLe ? `Acheté le ${a.acheteLe.slice(8, 10)}.${a.acheteLe.slice(5, 7)}.${a.acheteLe.slice(0, 4)}${a.magasin ? ` chez ${a.magasin}` : ""}` : a.magasin ? `Chez ${a.magasin}` : null,
    a.prix !== null ? `${a.prix % 1 === 0 ? a.prix : a.prix.toFixed(2)} CHF` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

// ----- Le carnet de la maison -----
// Ce qu'on cherche toujours : le concierge, la gérance, le numéro du compteur, le modèle de la
// chaudière, où est la vanne d'eau. Jamais un mot de passe ni un code : ils restent dans le
// trousseau de l'iPhone, qui les protège mieux qu'une liste partagée.

export const LONGUEUR_TITRE_CARNET = 60;
export const LONGUEUR_VALEUR_CARNET = 300;
/** Au-delà, la fée reçoit les premières lignes seulement. */
export const LIGNES_CARNET_FEE = 40;

const SECRET = /\b(mots? de passe|mdp|password|passcode|code (pin|secret|confidentiel|de (la )?carte|du wi-?fi|wi-?fi)|pin|cvv|cvc|puk)\b/;
export const PHRASE_SECRET = "Les mots de passe et les codes restent dans le trousseau de l'iPhone, pas dans Kora.";

/** Vrai quand le texte parle d'un mot de passe ou d'un code secret. */
export function ressembleASecret(texte: string): boolean {
  return SECRET.test(normaliser(texte));
}

const propre = (texte: string, longueur: number) => texte.trim().replace(/\s+/g, " ").slice(0, longueur);

/** Une entrée du carnet, ou sa nouvelle version quand `avant` est donné. */
export function entreeCarnet(titre: string, valeur: string, ctx: Contexte, avant?: EntreeCarnet): EntreeCarnet {
  const t = propre(titre, LONGUEUR_TITRE_CARNET);
  const v = propre(valeur, LONGUEUR_VALEUR_CARNET);
  if (!t) throw new ErreurValidation("Donne un nom à la ligne : « Concierge », « Compteur d'eau ».");
  if (!v) throw new ErreurValidation(`Qu'est-ce qu'on note pour « ${t} » ?`);
  if (ressembleASecret(`${t} ${v}`)) throw new ErreurValidation(PHRASE_SECRET);
  const maintenant = ctx.maintenant();
  return { id: avant?.id ?? ctx.nouvelId(), type: "carnet", titre: t, valeur: v, creeLe: avant?.creeLe ?? maintenant, modifieLe: maintenant };
}

export const carnetDe = (docs: readonly DocMaison[]): EntreeCarnet[] =>
  docs.filter((d): d is EntreeCarnet => d.type === "carnet").sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

/** L'entrée du même nom (« concierge » retrouve « Concierge ») : la fée la remplace au lieu d'en ajouter une. */
export function entreeDuMemeNom(docs: readonly DocMaison[], titre: string): EntreeCarnet | null {
  const cle = normaliser(titre).replace(/^(le|la|les|l'|notre|nos) /, "");
  return carnetDe(docs).find((e) => normaliser(e.titre).replace(/^(le|la|les|l'|notre|nos) /, "") === cle) ?? null;
}

/** Les lignes que la fée reçoit pour répondre « qui est le concierge ? ». */
export function decrireCarnet(docs: readonly DocMaison[]): string[] {
  const carnet = carnetDe(docs);
  if (!carnet.length) return [];
  const lignes = carnet.slice(0, LIGNES_CARNET_FEE).map((e) => `- ${e.titre} : ${e.valeur}`);
  return ["Carnet de la maison :", ...lignes];
}

/** « Concierge : M. Rossi, 079… » écrit d'un trait : le nom avant les deux-points, le reste après. */
export function lireLigneCarnet(texte: string): { titre: string; valeur: string } {
  const i = texte.indexOf(":");
  if (i < 0) return { titre: texte.trim(), valeur: "" };
  return { titre: texte.slice(0, i).trim(), valeur: texte.slice(i + 1).trim() };
}

/** Le numéro suisse d'une ligne (« 079 123 45 67 », « +41 21 555 00 00 »), prêt pour « Appeler » ; null sans numéro. */
export function numeroDe(valeur: string): string | null {
  const m = valeur.match(/(?:\+|00)41[\s.]?\(?0?\)?\d{2}(?:[\s.]?\d){7}|\b0\d{2}(?:[\s.]?\d){7}\b/);
  if (!m) return null;
  const chiffres = m[0].replace(/[^\d+]/g, "").replace(/^00/, "+");
  return chiffres.startsWith("+") ? chiffres.replace(/^\+410/, "+41") : `+41${chiffres.slice(1)}`;
}
