import { ErreurValidation } from "./foyer";
import { meteoDu, type JourMeteo, type Meteo } from "./meteo";
import { ESPECES, espece, EXPOSITIONS, expositionConvient, trouverEspece, type Espece, type Exposition } from "./plantes";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

// Le jardin du foyer : des zones (un bac, un pot, une jardinière) avec leur soleil, et les
// plantes qui y poussent. L'arrosage suit la saison, la chaleur, le contenant et la pluie
// tombée ; le gel annoncé fait rentrer ce qui est frileux ; le calendrier du mois dit quoi
// semer, planter et récolter. Un document par zone : arroser un bac, c'est une seule écriture.

export type TypeZone = "pot" | "jardiniere" | "bac" | "pleine-terre";

export const TYPES_ZONE: Record<TypeZone, string> = {
  pot: "Pot",
  jardiniere: "Jardinière",
  bac: "Bac",
  "pleine-terre": "Pleine terre",
};

/** Ce que la zone reçoit du ciel : la pluie et le froid dehors, le froid seulement sous un toit, ni l'un ni l'autre dedans. */
export type Abri = "dehors" | "couvert" | "interieur";

export const ABRIS: Record<Abri, { nom: string; detail: string }> = {
  dehors: { nom: "Dehors", detail: "reçoit la pluie" },
  couvert: { nom: "Sous un toit", detail: "à l'abri de la pluie, pas du froid" },
  interieur: { nom: "Dedans", detail: "derrière une fenêtre" },
};

export interface Plante {
  id: Id;
  /** Comme on l'a écrit : « Basilic grand vert ». */
  nom: string;
  /** L'espèce reconnue (voir plantes.ts) ; null si Kora ne la connaît pas. */
  espece: string | null;
  /** Depuis quand elle est là. */
  depuis: Jour;
  ajoutePar: Id | null;
}

export interface Zone {
  id: Id;
  nom: string;
  type: TypeZone;
  exposition: Exposition;
  abri: Abri;
  plantes: Plante[];
  arroseeLe: Jour | null;
  arrosePar: Id | null;
  creeLe: string;
}

const nettoyer = (texte: string) => texte.trim().replace(/\s+/g, " ");
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);
const plusJours = (jour: Jour, n: number) => decaler(jour, { unite: "jour", tous: n });
const moisDe = (jour: Jour) => Number(jour.slice(5, 7));

export function nouvelleZone(
  champs: { nom: string; type: TypeZone; exposition: Exposition; abri: Abri },
  ctx: Contexte,
): Zone {
  const nom = nettoyer(champs.nom);
  if (!nom) throw new ErreurValidation("Donne un nom à cette zone, par exemple « Pots du balcon ».");
  return {
    id: ctx.nouvelId(),
    nom: majuscule(nom),
    type: champs.type,
    exposition: champs.exposition,
    abri: champs.abri,
    plantes: [],
    arroseeLe: null,
    arrosePar: null,
    creeLe: ctx.maintenant(),
  };
}

/** Une plante écrite comme on la dit : « basilic », « 2 pieds de tomates cerises ». */
export function nouvellePlante(texte: string, aujourdhui: Jour, par: Id | null, ctx: Contexte): Plante {
  const nom = nettoyer(texte);
  if (!nom) throw new ErreurValidation("Écris le nom de la plante.");
  return { id: ctx.nouvelId(), nom: majuscule(nom), espece: trouverEspece(nom)?.cle ?? null, depuis: aujourdhui, ajoutePar: par };
}

export function ajouterPlante(zone: Zone, plante: Plante): Zone {
  return { ...zone, plantes: [...zone.plantes, plante] };
}

export function retirerPlante(zone: Zone, id: Id): Zone {
  return { ...zone, plantes: zone.plantes.filter((p) => p.id !== id) };
}

export function arroser(zone: Zone, aujourdhui: Jour, par: Id | null): Zone {
  return { ...zone, arroseeLe: aujourdhui, arrosePar: par };
}

export const especeDe = (p: Plante): Espece | null => espece(p.espece);

// ----- Arrosage -----

/** Une pluie d'au moins 5 mm vaut un arrosage, pour une zone dehors. */
export const PLUIE_QUI_ARROSE_MM = 5;
/** Pour une plante que Kora ne connaît pas : tous les 3 jours en été. */
const ARROSAGE_PAR_DEFAUT = 3;

/** L'hiver, la terre sèche bien moins vite ; dedans, le chauffage la sèche quand même. */
const FACTEUR_SAISON = [4, 4, 2, 1.5, 1, 1, 1, 1, 1.2, 1.5, 2.5, 4];
/** Plus il y a de terre, plus elle garde l'eau. */
const FACTEUR_CONTENANT: Record<TypeZone, number> = { pot: 1, jardiniere: 1.2, bac: 1.5, "pleine-terre": 2 };

function facteurChaleur(jour: JourMeteo | null, abri: Abri): number {
  if (!jour || abri === "interieur") return 1;
  if (jour.max >= 30) return 0.5;
  if (jour.max >= 26) return 0.75;
  return 1;
}

/** Tous les combien de jours arroser cette zone aujourd'hui ; null tant qu'elle est vide. */
export function intervalleArrosage(zone: Zone, aujourdhui: Jour, meteo: Meteo | null): number | null {
  if (zone.plantes.length === 0) return null;
  const base = Math.min(...zone.plantes.map((p) => especeDe(p)?.arrosageJours ?? ARROSAGE_PAR_DEFAUT));
  const saison = FACTEUR_SAISON[moisDe(aujourdhui) - 1];
  const s = zone.abri === "interieur" ? Math.min(saison, 2) : saison;
  const n = base * s * FACTEUR_CONTENANT[zone.type] * facteurChaleur(meteoDu(meteo, aujourdhui), zone.abri);
  return Math.max(1, Math.round(n));
}

export interface EtatArrosage {
  intervalle: number;
  /** Le dernier arrosage, à la main ou par la pluie. */
  dernier: Jour | null;
  parLaPluie: boolean;
  prochain: Jour;
  /** La pluie qui arrive aujourd'hui ou demain et dispense d'arroser (zone dehors). */
  pluiePrevue: JourMeteo | null;
  /** À arroser aujourd'hui. */
  du: boolean;
}

export function etatArrosage(zone: Zone, aujourdhui: Jour, meteo: Meteo | null): EtatArrosage | null {
  const intervalle = intervalleArrosage(zone, aujourdhui, meteo);
  if (intervalle === null) return null;
  const dehors = zone.abri === "dehors";
  const pluies = dehors ? (meteo?.jours ?? []).filter((j) => j.pluie >= PLUIE_QUI_ARROSE_MM) : [];
  const derniereAverse = pluies.filter((j) => j.jour < aujourdhui).map((j) => j.jour).sort().pop() ?? null;
  const parLaPluie = !!derniereAverse && (!zone.arroseeLe || derniereAverse > zone.arroseeLe);
  const dernier = parLaPluie ? derniereAverse : zone.arroseeLe;
  const prochain = dernier ? plusJours(dernier, intervalle) : aujourdhui;
  const pluiePrevue = pluies.find((j) => j.jour === aujourdhui || j.jour === plusJours(aujourdhui, 1)) ?? null;
  const du = prochain <= aujourdhui && !pluiePrevue;
  return { intervalle, dernier, parLaPluie, prochain, pluiePrevue, du };
}

const dansNJours = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`);

/** « À arroser aujourd'hui », « Pluie prévue demain : pas besoin », « Prochain arrosage dans 2 jours ». */
export function decrireArrosage(etat: EtatArrosage, aujourdhui: Jour): string {
  const retard = ecartJours(etat.prochain, aujourdhui);
  if (etat.du) {
    if (!etat.dernier) return "À arroser";
    return retard > 0 ? `À arroser, en retard de ${retard} jour${retard > 1 ? "s" : ""}` : "À arroser aujourd'hui";
  }
  if (etat.pluiePrevue && etat.prochain <= plusJours(aujourdhui, 1)) {
    return `Pluie prévue ${etat.pluiePrevue.jour === aujourdhui ? "aujourd'hui" : "demain"} : pas besoin d'arroser`;
  }
  const avant = etat.dernier === aujourdhui ? "Arrosé aujourd'hui" : etat.parLaPluie ? "Arrosé par la pluie" : null;
  const suite = `prochain arrosage ${dansNJours(Math.max(0, ecartJours(aujourdhui, etat.prochain)))}`;
  return avant ? `${avant} · ${suite}` : majuscule(suite);
}

// ----- Gel et chaleur -----

/** Sous 2 °C annoncés, une plante frileuse gèle au petit matin. */
export const SEUIL_GEL = 2;
/** Sous −5 °C, même les vivaces en pot souffrent : leurs racines n'ont pas la terre pour les protéger. */
export const SEUIL_FORT_GEL = -5;
export const SEUIL_CHALEUR = 30;

export interface AlerteGel {
  /** Le matin où il gèle : demain matin, c'est « cette nuit ». */
  jour: Jour;
  min: number;
  /** Les plantes à rentrer ou à couvrir. */
  plantes: string[];
}

/**
 * Le gel annoncé pour les deux nuits qui viennent, et ce qu'il menace. La minimale d'un
 * jour tombe au petit matin : celle de demain, c'est la nuit qui vient.
 */
export function alerteGel(zones: readonly Zone[], meteo: Meteo | null, aujourdhui: Jour): AlerteGel | null {
  const froid = (meteo?.jours ?? [])
    .filter((j) => j.jour > aujourdhui && j.jour <= plusJours(aujourdhui, 2) && j.min <= SEUIL_GEL)
    .sort((a, b) => a.jour.localeCompare(b.jour))[0];
  if (!froid) return null;
  const plantes = new Set<string>();
  for (const z of zones) {
    if (z.abri === "interieur") continue;
    for (const p of z.plantes) {
      const x = especeDe(p);
      const enPot = z.type === "pot" || z.type === "jardiniere";
      if (x?.gelive || (froid.min <= SEUIL_FORT_GEL && enPot)) plantes.add(p.nom.toLowerCase());
    }
  }
  return plantes.size ? { jour: froid.jour, min: froid.min, plantes: [...plantes] } : null;
}

export interface GesteJardin {
  texte: string;
  /** Urgent : le widget remonte en haut du tableau de bord. */
  urgent: boolean;
  /** La zone concernée, pour l'arroser d'un geste. */
  zoneId?: Id;
}

const enumerer = (mots: string[]) =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/** Tout ce qui demande un geste au jardin aujourd'hui, du plus pressé au moins pressé. */
export function gestesDuJardin(zones: readonly Zone[], meteo: Meteo | null, aujourdhui: Jour): GesteJardin[] {
  const gestes: GesteJardin[] = [];
  const gel = alerteGel(zones, meteo, aujourdhui);
  if (gel) {
    const quand = gel.jour === plusJours(aujourdhui, 1) ? "cette nuit" : "demain dans la nuit";
    gestes.push({ texte: `Gel ${quand} (${Math.round(gel.min)}°) : rentre ou couvre ${enumerer(gel.plantes.slice(0, 4))}`, urgent: true });
  }
  for (const z of zones) {
    const etat = etatArrosage(z, aujourdhui, meteo);
    if (etat?.du) gestes.push({ texte: `Arroser : ${z.nom.toLowerCase()}`, urgent: true, zoneId: z.id });
  }
  const jour = meteoDu(meteo, aujourdhui);
  if (jour && jour.max >= SEUIL_CHALEUR && zones.some((z) => z.plantes.length && z.abri !== "interieur")) {
    gestes.push({ texte: `Forte chaleur (${Math.round(jour.max)}°) : arrose tôt le matin ou le soir`, urgent: false });
  }
  return gestes;
}

// ----- Le calendrier -----

export interface CalendrierMois {
  semerAbri: Espece[];
  semerDehors: Espece[];
  planter: Espece[];
  recolter: Espece[];
}

/** Les espèces cultivées par le foyer, une seule fois chacune. */
export function especesDuJardin(zones: readonly Zone[]): Espece[] {
  const vues = new Map<string, Espece>();
  for (const z of zones) for (const p of z.plantes) {
    const x = especeDe(p);
    if (x) vues.set(x.cle, x);
  }
  return [...vues.values()];
}

/** Ce que le calendrier dit pour ces espèces, ce mois-ci. */
export function calendrierDuMois(especes: readonly Espece[], mois: number): CalendrierMois {
  const de = (champ: "semisAbri" | "semisDehors" | "plantation" | "recolte") => especes.filter((x) => x[champ].includes(mois));
  return { semerAbri: de("semisAbri"), semerDehors: de("semisDehors"), planter: de("plantation"), recolter: de("recolte") };
}

/**
 * Ce qu'on pourrait semer ou planter ce mois-ci et qui n'est pas encore au jardin, en
 * commençant par ce qui convient au soleil des zones existantes.
 */
export function ideesDuMois(zones: readonly Zone[], mois: number, max = 6): Espece[] {
  const deja = new Set(especesDuJardin(zones).map((x) => x.cle));
  const expositions = new Set(zones.map((z) => z.exposition));
  const convient = (x: Espece) => expositions.size === 0 || [...expositions].some((e) => expositionConvient(x.exposition, e));
  return ESPECES.filter((x) => !deja.has(x.cle) && (x.semisDehors.includes(mois) || x.plantation.includes(mois)))
    .sort((a, b) => Number(convient(b)) - Number(convient(a)))
    .slice(0, max);
}

/** Le conseil de saison, s'il y en a un. */
export function conseilDeSaison(aujourdhui: Jour): string | null {
  const mois = moisDe(aujourdhui);
  const jour = Number(aujourdhui.slice(8, 10));
  if (mois === 4 || (mois === 5 && jour <= 15)) {
    return "Attends les Saints de glace, mi-mai, pour sortir tomates, basilic et courgettes : il peut encore geler la nuit.";
  }
  if (mois === 10 || mois === 11) return "Avant les premières gelées, rentre ce qui est frileux et paille le pied des vivaces.";
  if (mois === 12 || mois <= 2) return "Le jardin dort : arrose seulement quand la terre est sèche, et jamais par temps de gel.";
  return null;
}

/** Les plantes mal placées : elles veulent plus de soleil que la zone n'en reçoit. */
export function plantesMalPlacees(zone: Zone): { plante: Plante; veut: Exposition }[] {
  return zone.plantes.flatMap((p) => {
    const x = especeDe(p);
    return x && !expositionConvient(x.exposition, zone.exposition) ? [{ plante: p, veut: x.exposition }] : [];
  });
}

/** « Basilic : plein soleil conseillé ». */
export function decrireMalPlacee(m: { plante: Plante; veut: Exposition }): string {
  return `${m.plante.nom} : ${EXPOSITIONS[m.veut].nom.toLowerCase()} conseillé${m.veut === "ombre" ? "e" : ""}`;
}

/** Le résumé du jardin pour Jarvis. */
export function decrireJardin(zones: readonly Zone[], meteo: Meteo | null, aujourdhui: Jour): string[] {
  if (zones.length === 0) return ["Jardin : aucune zone notée."];
  const lignes = ["Jardin :"];
  for (const z of zones) {
    const etat = etatArrosage(z, aujourdhui, meteo);
    const plantes = z.plantes.length ? z.plantes.map((p) => p.nom.toLowerCase()).join(", ") : "vide";
    lignes.push(
      `- ${z.nom} (${TYPES_ZONE[z.type].toLowerCase()}, ${EXPOSITIONS[z.exposition].nom.toLowerCase()}, ${ABRIS[z.abri].nom.toLowerCase()}) : ${plantes}` +
        (etat ? ` ; ${decrireArrosage(etat, aujourdhui).toLowerCase()}` : ""),
    );
  }
  const jour = meteoDu(meteo, aujourdhui);
  if (jour) lignes.push(`Météo du jour : ${Math.round(jour.min)} à ${Math.round(jour.max)} °C, ${Math.round(jour.pluie)} mm de pluie.`);
  for (const g of gestesDuJardin(zones, meteo, aujourdhui)) if (!g.zoneId) lignes.push(`Alerte : ${g.texte}.`);
  return lignes;
}

