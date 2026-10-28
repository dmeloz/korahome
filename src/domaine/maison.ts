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

/** Un rangement (Kora 0.0.93) : un lieu de la maison et ce qu'il y a dedans. « Cave : perceuse, skis, valise rouge ». */
export interface Rangement {
  id: Id;
  type: "rangement";
  lieu: string;
  objets: string[];
  creeLe: string;
  modifieLe: string;
}

export type DocMaison = ReglageDechets | Appareil | EntreeCarnet | Rangement;

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

// ----- Les rangements : « Où est le… » -----
// Les lieux du foyer (cave, placard du haut, boîte bleue, valise) et ce qu'il y a dedans. On
// demande « Tael, où est la perceuse ? » ; la recherche de la fée fouille aussi les rangements.

export const LONGUEUR_LIEU = 40;
export const LONGUEUR_OBJET = 60;
export const OBJETS_PAR_RANGEMENT = 80;
/** Au-delà, la fée reçoit les premiers rangements seulement. */
export const RANGEMENTS_FEE = 40;

const cleObjet = (t: string) => normaliser(t).replace(/^(le|la|les|l'|un|une|des|mon|ma|mes|notre|nos) /, "");

/** Les objets propres : sans vide, sans doublon, chacun borné. */
export function nettoyerObjets(objets: readonly string[]): string[] {
  const vus = new Set<string>();
  const propres: string[] = [];
  for (const o of objets) {
    const t = propre(o, LONGUEUR_OBJET);
    const cle = cleObjet(t);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    propres.push(t);
  }
  return propres.slice(0, OBJETS_PAR_RANGEMENT);
}

/** Un rangement, ou sa nouvelle version quand `avant` est donné. Un lieu vide est refusé ; un mot de passe aussi. */
export function nouveauRangement(lieu: string, objets: readonly string[], ctx: Contexte, avant?: Rangement): Rangement {
  const l = propre(lieu, LONGUEUR_LIEU);
  if (!l) throw new ErreurValidation("Donne un lieu : « Cave », « Placard du haut », « Boîte bleue ».");
  if (ressembleASecret(`${l} ${objets.join(" ")}`)) throw new ErreurValidation(PHRASE_SECRET);
  const maintenant = ctx.maintenant();
  return { id: avant?.id ?? ctx.nouvelId(), type: "rangement", lieu: l, objets: nettoyerObjets(objets), creeLe: avant?.creeLe ?? maintenant, modifieLe: maintenant };
}

export const rangementsDe = (docs: readonly DocMaison[]): Rangement[] =>
  docs.filter((d): d is Rangement => d.type === "rangement").sort((a, b) => a.lieu.localeCompare(b.lieu, "fr"));

/** Le rangement de ce lieu, quel que soit l'article ou la casse (« la cave » = « Cave »). */
export function rangementDuMemeLieu(docs: readonly DocMaison[], lieu: string): Rangement | null {
  const cle = cleObjet(lieu);
  return rangementsDe(docs).find((r) => cleObjet(r.lieu) === cle) ?? null;
}

/** « Cave : perceuse, skis, valise rouge » écrit d'un trait : le lieu avant les deux-points, les objets après, séparés par des virgules. */
export function lireRangement(texte: string): { lieu: string; objets: string[] } {
  const i = texte.indexOf(":");
  if (i < 0) return { lieu: texte.trim(), objets: [] };
  return { lieu: texte.slice(0, i).trim(), objets: separerObjets(texte.slice(i + 1)) };
}

/** Des objets séparés par des virgules, des points-virgules ou des retours à la ligne. */
export const separerObjets = (texte: string): string[] => nettoyerObjets(texte.split(/[,;\n]+| et /));

/** Range des objets dans un lieu : le rangement existant s'enrichit (sans doublon), sinon un nouveau. */
export function rangerObjets(docs: readonly DocMaison[], lieu: string, objets: readonly string[], ctx: Contexte): Rangement {
  const avant = rangementDuMemeLieu(docs, lieu);
  return nouveauRangement(avant?.lieu ?? lieu, [...(avant?.objets ?? []), ...objets], ctx, avant ?? undefined);
}

/** Où est cet objet : chaque mot demandé commence un mot de l'objet (« perceuse » trouve « perceuse sans fil »). */
export function ouEst(docs: readonly DocMaison[], objet: string): { lieu: string; objet: string }[] {
  const mots = cleObjet(objet).split(" ").filter(Boolean);
  if (!mots.length) return [];
  const trouves: { lieu: string; objet: string }[] = [];
  for (const r of rangementsDe(docs)) {
    for (const o of r.objets) {
      const cible = ` ${cleObjet(o)}`;
      if (mots.every((m) => cible.includes(` ${m}`))) trouves.push({ lieu: r.lieu, objet: o });
    }
  }
  return trouves;
}

/** « La perceuse est dans la cave », « Rien de rangé sous ce nom ». */
export function phraseOuEst(docs: readonly DocMaison[], objet: string): string {
  const trouves = ouEst(docs, objet);
  if (!trouves.length) return `Rien de rangé sous « ${objet.trim()} ».`;
  if (trouves.length === 1) return `${majusculeInitiale(trouves[0].objet)} : ${trouves[0].lieu.toLowerCase()}.`;
  return trouves.map((t) => `${majusculeInitiale(t.objet)} : ${t.lieu.toLowerCase()}`).join(" · ");
}

const majusculeInitiale = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Les rangements pour l'état du foyer lu par la fée : une ligne par lieu. */
export function decrireRangements(docs: readonly DocMaison[]): string[] {
  const rangements = rangementsDe(docs).filter((r) => r.objets.length);
  if (!rangements.length) return [];
  return ["Rangements (où est quoi) :", ...rangements.slice(0, RANGEMENTS_FEE).map((r) => `- ${r.lieu} : ${r.objets.join(", ")}`)];
}
