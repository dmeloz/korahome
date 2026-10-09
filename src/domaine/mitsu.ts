import { ErreurValidation } from "./foyer";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

// Le suivi de Mitsu, la chatte du foyer : sa ration suit son âge et son poids,
// ses provisions annoncent leur fin et le jour où commander, ses pesées et son
// carnet de santé donnent les rappels. Tout est calculé à partir de « aujourd'hui »
// fourni par l'interface : ce module ne lit jamais l'horloge.

export type TypeProvision = "croquettes" | "patee" | "litiere";

export const TYPES_PROVISION: Record<TypeProvision, string> = {
  croquettes: "Croquettes",
  patee: "Pâtée",
  litiere: "Litière",
};

/** Un paquet (ou un lot) acheté, consommé jour après jour. */
export interface Provision {
  id: Id;
  type: TypeProvision;
  /** Le produit, tel qu'il figure sur la facture. */
  nom: string;
  /** Quantité achetée, en grammes. */
  grammes: number;
  achete: Jour;
  /** Consommation par jour en grammes ; null pour les croquettes = la ration du jour. */
  parJour: number | null;
}

export type TypeSoin = "vaccin" | "vermifuge" | "antiparasitaire" | "sterilisation" | "visite" | "autre";

export const TYPES_SOIN: Record<TypeSoin, string> = {
  vaccin: "Vaccin",
  vermifuge: "Vermifuge",
  antiparasitaire: "Antipuces et tiques",
  sterilisation: "Stérilisation",
  visite: "Visite chez le vétérinaire",
  autre: "Autre soin",
};

/** Une ligne du carnet de santé : prévue, puis faite. */
export interface Soin {
  id: Id;
  type: TypeSoin;
  libelle: string;
  date: Jour;
  fait: boolean;
}

export interface Pesee {
  id: Id;
  jour: Jour;
  grammes: number;
  par: Id | null;
}

export interface ReglagesSuivi {
  /** Combien de jours avant la fin d'une provision il faut commander. */
  delaiCommande: number;
  /** Tous les combien de jours la peser tant qu'elle grandit. */
  peseeTousLes: number;
  /** Énergie des croquettes, en kcal par gramme (indiquée sur le paquet). */
  kcalParGramme: number;
  /** La ration du paquet, en grammes par jour ; null = estimée par l'app. */
  rationDuPaquet: number | null;
}

export interface Animal {
  id: Id;
  nom: string;
  naissance: Jour;
  arrivee: Jour | null;
  sterilise: boolean;
  pesees: Pesee[];
  provisions: Provision[];
  soins: Soin[];
  reglages: ReglagesSuivi;
  creeLe: string;
}

export const REGLAGES_DE_DEPART: ReglagesSuivi = {
  delaiCommande: 10,
  peseeTousLes: 14,
  kcalParGramme: 4,
  rationDuPaquet: null,
};

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function verifierJour(jour: Jour, quoi: string): void {
  if (!RE_JOUR.test(jour)) throw new ErreurValidation(`${quoi} : la date est invalide.`);
}

const plusJours = (jour: Jour, n: number) => decaler(jour, { unite: "jour", tous: n });
const plusMois = (jour: Jour, n: number) => decaler(jour, { unite: "mois", tous: n });

export function nouvelAnimal(
  nom: string,
  naissance: Jour,
  arrivee: Jour | null,
  ctx: Contexte,
): Animal {
  const n = nom.trim().replace(/\s+/g, " ");
  if (!n) throw new ErreurValidation("Il faut un nom.");
  verifierJour(naissance, "Naissance");
  if (arrivee) verifierJour(arrivee, "Arrivée");
  return {
    id: ctx.nouvelId(),
    nom: n.charAt(0).toUpperCase() + n.slice(1),
    naissance,
    arrivee,
    sterilise: false,
    pesees: [],
    provisions: [],
    soins: [],
    reglages: { ...REGLAGES_DE_DEPART },
    creeLe: ctx.maintenant(),
  };
}

// ----- Âge -----

/** Âge en mois révolus (le 14 du mois suivant la naissance du 14 = 1 mois). */
export function ageEnMois(naissance: Jour, aujourdhui: Jour): number {
  let mois = 0;
  while (mois < 600 && plusMois(naissance, mois + 1) <= aujourdhui) mois++;
  return mois;
}

/** « 3 semaines », « 5 mois », « 1 an », « 1 an et 2 mois ». */
export function decrireAge(naissance: Jour, aujourdhui: Jour): string {
  const mois = ageEnMois(naissance, aujourdhui);
  if (mois === 0) {
    const semaines = Math.floor(Math.max(0, ecartJours(naissance, aujourdhui)) / 7);
    return semaines <= 1 ? "quelques jours" : `${semaines} semaines`;
  }
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const a = `${ans} an${ans > 1 ? "s" : ""}`;
  return reste ? `${a} et ${reste} mois` : a;
}

/** Vers 12 mois, on passe des croquettes chaton aux croquettes adulte. */
export function passageAdulte(naissance: Jour): Jour {
  return plusMois(naissance, 12);
}

// ----- Poids et ration -----

export function derniereVersion<T extends { jour: Jour }>(liste: readonly T[]): T | null {
  return liste.reduce<T | null>((d, x) => (!d || x.jour >= d.jour ? x : d), null);
}

export function poidsActuel(animal: Animal): Pesee | null {
  return derniereVersion(animal.pesees);
}

/**
 * Multiplicateur du besoin au repos selon l'âge : un chaton en pleine croissance
 * a besoin de bien plus d'énergie qu'un adulte, et un adulte stérilisé un peu moins.
 */
export function facteurCroissance(ageMois: number, sterilise: boolean): number {
  if (ageMois < 4) return 2.5;
  if (ageMois < 6) return 2;
  if (ageMois < 12) return 1.6;
  return sterilise ? 1.2 : 1.4;
}

export interface Ration {
  grammes: number;
  kcal: number;
  /** « paquet » : la ration notée depuis le paquet ; « estimee » : calculée. */
  source: "paquet" | "estimee";
}

/**
 * Ration de croquettes du jour. La ration du paquet, quand elle est notée, fait foi.
 * Sinon : besoin au repos 70 × poids(kg)^0,75 kcal, multiplié selon l'âge, divisé
 * par l'énergie des croquettes. C'est une estimation, à arrondir à 5 g.
 */
export function rationDuJour(animal: Animal, aujourdhui: Jour): Ration | null {
  const k = animal.reglages.kcalParGramme;
  if (animal.reglages.rationDuPaquet) {
    const g = animal.reglages.rationDuPaquet;
    return { grammes: g, kcal: Math.round(g * k), source: "paquet" };
  }
  const poids = poidsActuel(animal);
  if (!poids) return null;
  const repos = 70 * Math.pow(poids.grammes / 1000, 0.75);
  const kcal = repos * facteurCroissance(ageEnMois(animal.naissance, aujourdhui), animal.sterilise);
  return { grammes: Math.round(kcal / k / 5) * 5, kcal: Math.round(kcal), source: "estimee" };
}

export function ajouterPesee(animal: Animal, grammes: number, jour: Jour, par: Id | null, ctx: Contexte): Animal {
  verifierJour(jour, "Pesée");
  if (!Number.isFinite(grammes) || grammes < 100 || grammes > 15000) {
    throw new ErreurValidation("Le poids doit être entre 0,1 et 15 kg.");
  }
  const pesee: Pesee = { id: ctx.nouvelId(), jour, grammes: Math.round(grammes), par };
  // Une seule pesée par jour : la nouvelle remplace celle du même jour.
  return { ...animal, pesees: [...animal.pesees.filter((p) => p.jour !== jour), pesee] };
}

/** Les pesées de la plus récente à la plus ancienne. */
export function historiquePesees(animal: Animal): Pesee[] {
  return [...animal.pesees].sort((a, b) => b.jour.localeCompare(a.jour));
}

/** Prochaine pesée : au rythme choisi tant qu'elle grandit, chaque mois une fois adulte. */
export function prochainePesee(animal: Animal, aujourdhui: Jour): Jour {
  const derniere = poidsActuel(animal);
  if (!derniere) return aujourdhui;
  const adulte = ageEnMois(animal.naissance, aujourdhui) >= 12;
  return plusJours(derniere.jour, adulte ? 30 : animal.reglages.peseeTousLes);
}

/** « 2,45 kg ». */
export function formaterPoids(grammes: number): string {
  return `${(grammes / 1000).toLocaleString("fr-CH", { maximumFractionDigits: 2 })} kg`;
}

// ----- Provisions -----

export function nouvelleProvision(
  champs: { type: TypeProvision; nom: string; grammes: number; achete: Jour; parJour: number | null },
  ctx: Contexte,
): Provision {
  verifierJour(champs.achete, "Achat");
  if (!Number.isFinite(champs.grammes) || champs.grammes <= 0) throw new ErreurValidation("Indique la quantité achetée.");
  if (champs.parJour !== null && (!Number.isFinite(champs.parJour) || champs.parJour <= 0)) {
    throw new ErreurValidation("La consommation par jour doit être positive.");
  }
  const nom = champs.nom.trim().replace(/\s+/g, " ") || TYPES_PROVISION[champs.type];
  return { id: ctx.nouvelId(), type: champs.type, nom, grammes: Math.round(champs.grammes), achete: champs.achete, parJour: champs.parJour };
}

export function ajouterProvision(animal: Animal, provision: Provision): Animal {
  return { ...animal, provisions: [...animal.provisions, provision] };
}

export function retirerProvision(animal: Animal, id: Id): Animal {
  return { ...animal, provisions: animal.provisions.filter((p) => p.id !== id) };
}

export function consommationParJour(provision: Provision, animal: Animal, aujourdhui: Jour): number | null {
  if (provision.parJour) return provision.parJour;
  if (provision.type === "croquettes") return rationDuJour(animal, aujourdhui)?.grammes || null;
  return null;
}

export interface Prevision {
  restant: number;
  joursRestants: number;
  fin: Jour;
  commanderLe: Jour;
  etat: "ok" | "commander" | "epuise";
}

/** Combien il reste, quand ce sera fini, et quand commander pour ne jamais manquer. */
export function prevoir(provision: Provision, animal: Animal, aujourdhui: Jour): Prevision | null {
  const parJour = consommationParJour(provision, animal, aujourdhui);
  if (!parJour) return null;
  const ecoules = Math.max(0, ecartJours(provision.achete, aujourdhui));
  const restant = Math.max(0, provision.grammes - ecoules * parJour);
  const joursRestants = Math.floor(restant / parJour);
  const fin = plusJours(aujourdhui, joursRestants);
  const commanderLe = plusJours(fin, -animal.reglages.delaiCommande);
  const etat = joursRestants === 0 ? "epuise" : commanderLe <= aujourdhui ? "commander" : "ok";
  return { restant: Math.round(restant), joursRestants, fin, commanderLe, etat };
}

/** Ce qu'on ajoute à la liste de courses quand une provision touche à sa fin. */
export function texteCourses(provision: Provision, animal: Animal): string {
  const type = TYPES_PROVISION[provision.type];
  const produit = provision.nom === type ? "" : ` (${provision.nom})`;
  return `${type} ${animal.nom}${produit}`;
}

// ----- Santé -----

export function nouveauSoin(type: TypeSoin, date: Jour, libelle: string, ctx: Contexte): Soin {
  verifierJour(date, "Soin");
  return { id: ctx.nouvelId(), type, libelle: libelle.trim() || TYPES_SOIN[type], date, fait: false };
}

export function ajouterSoin(animal: Animal, soin: Soin): Animal {
  return { ...animal, soins: [...animal.soins, soin] };
}

export function retirerSoin(animal: Animal, id: Id): Animal {
  return { ...animal, soins: animal.soins.filter((s) => s.id !== id) };
}

/**
 * Le rythme habituel d'un soin, pour prévoir le suivant : vaccin et visite chaque année,
 * antiparasitaire chaque mois, vermifuge chaque mois jusqu'à 6 mois puis tous les 3 mois.
 * Le vétérinaire a toujours le dernier mot : la date proposée se corrige.
 */
export function rythmeDuSoin(type: TypeSoin, ageMois: number): number | null {
  if (type === "vaccin" || type === "visite") return 12;
  if (type === "antiparasitaire") return 1;
  if (type === "vermifuge") return ageMois < 6 ? 1 : 3;
  return null;
}

/** Marque le soin fait aujourd'hui et prévoit le suivant quand il revient. */
export function marquerSoinFait(animal: Animal, id: Id, aujourdhui: Jour, ctx: Contexte): Animal {
  const soin = animal.soins.find((s) => s.id === id);
  if (!soin) return animal;
  const soins = animal.soins.map((s) => (s.id === id ? { ...s, fait: true, date: aujourdhui } : s));
  const rythme = rythmeDuSoin(soin.type, ageEnMois(animal.naissance, aujourdhui));
  if (rythme) soins.push({ ...soin, id: ctx.nouvelId(), date: plusMois(aujourdhui, rythme), fait: false });
  const sterilise = animal.sterilise || soin.type === "sterilisation";
  return { ...animal, soins, sterilise };
}

/** Les soins à venir, du plus proche au plus lointain. */
export function soinsAVenir(animal: Animal): Soin[] {
  return animal.soins.filter((s) => !s.fait).sort((a, b) => a.date.localeCompare(b.date));
}

export function soinsFaits(animal: Animal): Soin[] {
  return animal.soins.filter((s) => s.fait).sort((a, b) => b.date.localeCompare(a.date));
}

// ----- Ce qui est à faire -----

export interface ChoseAFaire {
  texte: string;
  /** Urgent : le widget remonte en haut du tableau de bord. */
  urgent: boolean;
}

/** Quand rappeler un soin : une semaine avant. */
export const RAPPEL_SOIN_JOURS = 7;

/** Tout ce qui demande un geste, du plus pressé au moins pressé. */
export function choseAFaire(animal: Animal, aujourdhui: Jour): ChoseAFaire[] {
  const urgentes: ChoseAFaire[] = [];
  const bientot: ChoseAFaire[] = [];

  for (const p of animal.provisions) {
    const prev = prevoir(p, animal, aujourdhui);
    if (!prev || prev.etat === "ok") continue;
    urgentes.push({
      texte: prev.etat === "epuise" ? `${p.nom} : c'est fini` : `Commander ${p.nom} : ${prev.joursRestants} j de stock`,
      urgent: true,
    });
  }

  for (const s of soinsAVenir(animal)) {
    const ecart = ecartJours(aujourdhui, s.date);
    if (ecart > RAPPEL_SOIN_JOURS) continue;
    const quand = ecart < 0 ? "en retard" : ecart === 0 ? "aujourd'hui" : ecart === 1 ? "demain" : `dans ${ecart} jours`;
    urgentes.push({ texte: `${s.libelle} ${quand}`, urgent: true });
  }

  const pesee = prochainePesee(animal, aujourdhui);
  if (pesee <= aujourdhui) {
    bientot.push({ texte: animal.pesees.length ? "La peser" : "La peser une première fois", urgent: false });
  }

  const adulte = passageAdulte(animal.naissance);
  const avant = ecartJours(aujourdhui, adulte);
  if (avant >= 0 && avant <= 30) {
    bientot.push({ texte: `Passer aux croquettes adulte ${avant === 0 ? "aujourd'hui" : `dans ${avant} jours`}`, urgent: false });
  }

  return [...urgentes, ...bientot];
}
