import { ErreurValidation } from "./foyer";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

// Le suivi de Mitsu, la chatte du foyer : sa ration suit son âge et son poids,
// ses provisions annoncent leur fin et le jour où commander, ses pesées et son
// carnet de santé donnent les rappels. Tout est calculé à partir de « aujourd'hui »
// fourni par l'interface : ce module ne lit jamais l'horloge.

export type TypeProvision = "croquettes" | "patee" | "friandises" | "litiere" | "filtres";

export const TYPES_PROVISION: Record<TypeProvision, string> = {
  croquettes: "Croquettes",
  patee: "Pâtée",
  friandises: "Friandises",
  litiere: "Litière",
  filtres: "Filtres de fontaine",
};

/** Un paquet (ou un lot) acheté, consommé jour après jour. */
export interface Provision {
  id: Id;
  type: TypeProvision;
  /** Le produit, tel qu'il figure sur la facture. */
  nom: string;
  /** Ce qui reste au jour « achete » : en grammes, en millilitres pour la litière, en pièces pour les filtres. */
  quantite: number;
  /** Jour d'achat, ou du dernier réassort par une commande. */
  achete: Jour;
  /** Consommation par jour (g ou ml) ; null = déduite de la ration ou de la commande. */
  parJour: number | null;
  /** Ce qu'on rachète d'un coup (un sac, une boîte de 6 filtres). */
  lot?: number;
}

/** Les produits qui reviennent à chaque commande, au même rythme. */
export interface ArticleCommande {
  type: TypeProvision;
  nom: string;
  /** Quantité commandée, en grammes (ou millilitres pour la litière). */
  quantite: number;
}

/** La commande en ligne qui revient : tous les 3 mois chez zooplus pour Mitsu. */
export interface CommandeReguliere {
  fournisseur: string;
  tousLesMois: number;
  prochaine: Jour;
  articles: ArticleCommande[];
}

export type TypeSoin = "vaccin" | "vermifuge" | "antiparasitaire" | "sterilisation" | "visite" | "test" | "filtre" | "autre";

export const TYPES_SOIN: Record<TypeSoin, string> = {
  vaccin: "Vaccin",
  vermifuge: "Vermifuge",
  antiparasitaire: "Antipuces et tiques",
  sterilisation: "Stérilisation",
  visite: "Visite chez le vétérinaire",
  test: "Test de dépistage",
  filtre: "Changer le filtre de la fontaine",
  autre: "Autre soin",
};

/** Une ligne du carnet de santé : prévue, puis faite. */
export interface Soin {
  id: Id;
  type: TypeSoin;
  libelle: string;
  date: Jour;
  fait: boolean;
  /** Ce que dit le carnet en plus : produit, lot, dose, résultat d'un test. */
  details?: string;
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
  /** Tous les combien de jours la peser (à la maison ou chez le vétérinaire). */
  peseeTousLes: number;
  /** Énergie des croquettes, en kcal par gramme (indiquée sur le paquet). */
  kcalParGramme: number;
  /** La ration du paquet, en grammes par jour ; null = estimée par l'app. */
  rationDuPaquet: number | null;
  /** Les friandises données chaque jour, en grammes : retirées de la ration de croquettes. */
  friandisesParJour?: number;
  /**
   * Le poids estimé (« elle pèse environ 1,6 kg »), sans pesée au carnet. Il sert à la ration
   * tant qu'aucune pesée plus récente ne le remplace (Kora 0.0.70).
   */
  poidsEstime?: { grammes: number; le: Jour } | null;
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
  commande: CommandeReguliere | null;
  reglages: ReglagesSuivi;
  /** Absent sur les fiches créées avant la 0.0.14 : femelle. */
  sexe?: Sexe;
  /** Ce qui se passe au quotidien : litière, soucis de santé. */
  journal?: EvenementJournal[];
  /** Puce, vétérinaire, assurance, consignes pour la garde. */
  infos?: InfosAnimal;
  /** Les propositions du carnet que le foyer a écartées. */
  carnetEcarte?: string[];
  /** Ce qu'elle a vraiment consommé, appris à chaque paquet fini. */
  consommations?: ConsommationObservee[];
  creeLe: string;
}

/** Un paquet fini : ce qu'il contenait, divisé par les jours qu'il a duré. */
export interface ConsommationObservee {
  type: TypeProvision;
  nom: string;
  parJour: number;
  jour: Jour;
}

export type Sexe = "femelle" | "male";

export interface InfosAnimal {
  /** Le nom écrit dans son carnet, quand on l'appelle autrement (Mitsuha pour Mitsu). */
  nomComplet?: string;
  race?: string;
  pelage?: string;
  puce?: string;
  /** Le jour où la puce a été posée, AAAA-MM-JJ. */
  pucePoseeLe?: string;
  /** La personne inscrite comme propriétaire dans le carnet, avec son adresse. */
  proprietaire?: string;
  veterinaire?: string;
  telephoneVeto?: string;
  adresseVeto?: string;
  emailVeto?: string;
  assurance?: string;
  /** Ce qu'il faut savoir pour la garder (caractère, cachettes, habitudes). */
  consignes?: string;
}

export const REGLAGES_DE_DEPART: ReglagesSuivi = {
  delaiCommande: 10,
  // Melo et Sarah la pèsent environ tous les 6 mois, et à chaque visite chez le vétérinaire.
  peseeTousLes: 180,
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
    commande: null,
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

/** Le poids qui compte pour la ration : la dernière pesée, ou le poids estimé s'il est plus récent. */
export function poidsDeReference(animal: Animal): { grammes: number; jour: Jour; estime: boolean } | null {
  const pesee = poidsActuel(animal);
  const estime = animal.reglages.poidsEstime;
  if (estime && (!pesee || estime.le >= pesee.jour)) return { grammes: estime.grammes, jour: estime.le, estime: true };
  return pesee ? { grammes: pesee.grammes, jour: pesee.jour, estime: false } : null;
}

/** Corrige le poids estimé et, si on la donne, la ration du jour, sans toucher au carnet des pesées. */
export function reglerPoidsEtRation(animal: Animal, changement: { poidsEstime?: number | null; ration?: number | null }, aujourdhui: Jour): Animal {
  const reglages = { ...animal.reglages };
  if (changement.poidsEstime !== undefined) {
    if (changement.poidsEstime === null) reglages.poidsEstime = null;
    else {
      if (!Number.isFinite(changement.poidsEstime) || changement.poidsEstime < 100 || changement.poidsEstime > 15000) throw new ErreurValidation("Le poids doit être entre 0,1 et 15 kg.");
      reglages.poidsEstime = { grammes: Math.round(changement.poidsEstime), le: aujourdhui };
    }
  }
  if (changement.ration !== undefined) {
    if (changement.ration !== null && (!Number.isFinite(changement.ration) || changement.ration < 1 || changement.ration > 500)) throw new ErreurValidation("La ration doit être entre 1 et 500 g par jour.");
    reglages.rationDuPaquet = changement.ration === null ? null : Math.round(changement.ration);
  }
  return { ...animal, reglages };
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
  /** Croquettes du jour, friandises déjà retirées. */
  grammes: number;
  /** Tout ce qu'il lui faut dans la journée, friandises comprises. */
  kcal: number;
  /** « paquet » : la ration notée depuis le paquet ; « estimee » : calculée. */
  source: "paquet" | "estimee";
  /** Les friandises ne dépassent pas 10 % de ce qu'elle mange : au plus tant de grammes. */
  friandisesMax: number;
}

/** Énergie moyenne d'une friandise pour chat, en kcal par gramme. */
export const KCAL_PAR_GRAMME_FRIANDISE = 3.5;

/**
 * Ration de croquettes du jour. La ration du paquet, quand elle est notée, fait foi.
 * Sinon : besoin au repos 70 × poids(kg)^0,75 kcal, multiplié selon l'âge, divisé
 * par l'énergie des croquettes. C'est une estimation, à arrondir à 5 g.
 * Les friandises du jour, quand elles sont notées, sont retirées des croquettes.
 */
export function rationDuJour(animal: Animal, aujourdhui: Jour): Ration | null {
  const k = animal.reglages.kcalParGramme;
  const friandises = animal.reglages.friandisesParJour ?? 0;
  const max = (kcal: number) => Math.max(1, Math.round((kcal * 0.1) / KCAL_PAR_GRAMME_FRIANDISE));
  if (animal.reglages.rationDuPaquet) {
    const g = animal.reglages.rationDuPaquet;
    const kcal = Math.round(g * k);
    const grammes = Math.max(0, Math.round(g - (friandises * KCAL_PAR_GRAMME_FRIANDISE) / k));
    return { grammes, kcal, source: "paquet", friandisesMax: max(kcal) };
  }
  const poids = poidsDeReference(animal);
  if (!poids) return null;
  const repos = 70 * Math.pow(poids.grammes / 1000, 0.75);
  const kcal = repos * facteurCroissance(ageEnMois(animal.naissance, aujourdhui), animal.sterilise);
  const croquettes = Math.max(0, kcal - friandises * KCAL_PAR_GRAMME_FRIANDISE);
  return { grammes: Math.round(croquettes / k / 5) * 5, kcal: Math.round(kcal), source: "estimee", friandisesMax: max(kcal) };
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

/** Prochaine pesée, au rythme choisi après la dernière. */
export function prochainePesee(animal: Animal, aujourdhui: Jour): Jour {
  const derniere = poidsActuel(animal);
  if (!derniere) return aujourdhui;
  return plusJours(derniere.jour, animal.reglages.peseeTousLes);
}

/** « 2,45 kg ». */
export function formaterPoids(grammes: number): string {
  return `${(grammes / 1000).toLocaleString("fr-CH", { maximumFractionDigits: 2 })} kg`;
}

// ----- Provisions -----

/** Un filtre de fontaine dure un mois. */
export const JOURS_PAR_FILTRE = 30;

/** Les filtres se comptent à la pièce ; la litière en litres, le reste en kilos. */
export function formaterQuantite(type: TypeProvision, quantite: number): string {
  if (type === "filtres") {
    const n = Math.round(quantite);
    return `${n} filtre${n > 1 ? "s" : ""}`;
  }
  const n = (quantite / 1000).toLocaleString("fr-CH", { maximumFractionDigits: 2 });
  return type === "litiere" ? `${n} L` : `${n} kg`;
}

export function nouvelleProvision(
  champs: { type: TypeProvision; nom: string; quantite: number; achete: Jour; parJour: number | null },
  ctx: Contexte,
): Provision {
  verifierJour(champs.achete, "Achat");
  if (!Number.isFinite(champs.quantite) || champs.quantite <= 0) throw new ErreurValidation("Indique la quantité achetée.");
  if (champs.parJour !== null && (!Number.isFinite(champs.parJour) || champs.parJour <= 0)) {
    throw new ErreurValidation("La consommation par jour doit être positive.");
  }
  const nom = champs.nom.trim().replace(/\s+/g, " ") || TYPES_PROVISION[champs.type];
  const quantite = champs.type === "filtres" ? champs.quantite : Math.round(champs.quantite);
  return { id: ctx.nouvelId(), type: champs.type, nom, quantite, achete: champs.achete, parJour: champs.parJour, lot: quantite };
}

export function ajouterProvision(animal: Animal, provision: Provision): Animal {
  return { ...animal, provisions: [...animal.provisions, provision] };
}

export function retirerProvision(animal: Animal, id: Id): Animal {
  return { ...animal, provisions: animal.provisions.filter((p) => p.id !== id) };
}

/** L'article de la commande régulière qui réapprovisionne cette provision. */
export function articleDe(provision: Provision, animal: Animal): ArticleCommande | undefined {
  return animal.commande?.articles.find((a) => a.type === provision.type && a.nom === provision.nom);
}

/** Durée d'un cycle de commande, en jours. */
function joursDuCycle(commande: CommandeReguliere): number {
  return ecartJours(commande.prochaine, plusMois(commande.prochaine, commande.tousLesMois));
}

/** Les derniers paquets finis comptent : assez pour lisser, assez récents pour suivre sa croissance. */
const CONSOMMATIONS_GARDEES = 6;
const CONSOMMATIONS_LUES = 3;
/** Un paquet fini en moins de 3 jours ne dit rien de son rythme (ouvert puis jeté, erreur). */
const JOURS_MIN_PAQUET = 3;

/** Ce qu'elle consomme vraiment par jour de ce produit (ou de ce type), d'après les derniers paquets finis. */
export function consommationApprise(animal: Animal, provision: Pick<Provision, "type" | "nom">): number | null {
  const toutes = (animal.consommations ?? []).filter((c) => c.type === provision.type);
  const memes = toutes.filter((c) => c.nom === provision.nom);
  const lues = (memes.length ? memes : toutes).slice(-CONSOMMATIONS_LUES);
  if (!lues.length) return null;
  return Math.round((lues.reduce((s, c) => s + c.parJour, 0) / lues.length) * 10) / 10;
}

/**
 * Le paquet est fini : il quitte les provisions, et Kora retient ce qu'elle en a mangé par
 * jour. Rend aussi l'écart avec ce que Kora prévoyait, pour le dire (« elle mange plus que prévu »).
 */
export function paquetFini(animal: Animal, provisionId: Id, aujourdhui: Jour): { animal: Animal; observee: ConsommationObservee | null; prevue: number | null } {
  const p = animal.provisions.find((x) => x.id === provisionId);
  const sans = retirerProvision(animal, provisionId);
  if (!p || p.type === "filtres") return { animal: sans, observee: null, prevue: null };
  const jours = ecartJours(p.achete, aujourdhui);
  if (jours < JOURS_MIN_PAQUET || p.quantite <= 0) return { animal: sans, observee: null, prevue: null };
  const prevue = consommationParJour(p, animal, aujourdhui);
  const observee: ConsommationObservee = { type: p.type, nom: p.nom, parJour: Math.round((p.quantite / jours) * 10) / 10, jour: aujourdhui };
  const consommations = [...(animal.consommations ?? []), observee].slice(-CONSOMMATIONS_GARDEES);
  return { animal: { ...sans, consommations }, observee, prevue };
}

/** Au-delà d'une semaine d'écart, la commande régulière mérite d'être recalée. */
const ECART_COMMANDE_JOURS = 7;

/**
 * La date de commande qui suit son vrai rythme : quand une provision de la commande
 * régulière, comptée avec ce qu'elle mange vraiment, demande de commander plus tôt (ou bien
 * plus tard) que prévu. Seulement quand Kora a déjà appris de vrais paquets finis.
 */
export function commandeRecalee(animal: Animal, aujourdhui: Jour): { jour: Jour; provision: Provision } | null {
  const commande = animal.commande;
  if (!commande || !animal.consommations?.length) return null;
  let plusTot: { jour: Jour; provision: Provision } | null = null;
  for (const p of animal.provisions) {
    if (!articleDe(p, animal) || !consommationApprise(animal, p)) continue;
    const prevision = prevoir(p, animal, aujourdhui);
    if (!prevision) continue;
    const jour = prevision.commanderLe < aujourdhui ? aujourdhui : prevision.commanderLe;
    if (!plusTot || jour < plusTot.jour) plusTot = { jour, provision: p };
  }
  if (!plusTot || Math.abs(ecartJours(commande.prochaine, plusTot.jour)) < ECART_COMMANDE_JOURS) return null;
  return plusTot;
}

/** Déplace la prochaine commande régulière. */
export function recalerCommande(animal: Animal, jour: Jour): Animal {
  return animal.commande ? { ...animal, commande: { ...animal.commande, prochaine: jour } } : animal;
}

/**
 * Consommation par jour, dans l'ordre : celle notée sur la provision, la ration du jour
 * pour les croquettes (quand on connaît son poids ou la ration du paquet), sinon ce que la
 * commande régulière laisse supposer (6 kg tous les 3 mois ≈ 65 g par jour).
 */
export function consommationParJour(provision: Provision, animal: Animal, aujourdhui: Jour): number | null {
  if (provision.parJour) return provision.parJour;
  if (provision.type === "filtres") return 1 / JOURS_PAR_FILTRE;
  const apprise = consommationApprise(animal, provision);
  if (apprise) return apprise;
  if (provision.type === "croquettes") {
    const ration = rationDuJour(animal, aujourdhui);
    if (ration) return ration.grammes;
  }
  const article = articleDe(provision, animal);
  if (article && animal.commande) return Math.round(article.quantite / joursDuCycle(animal.commande));
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
  const restant = Math.max(0, provision.quantite - ecoules * parJour);
  const joursRestants = Math.floor(restant / parJour + 1e-9);
  const fin = plusJours(aujourdhui, joursRestants);
  const commanderLe = plusJours(fin, -animal.reglages.delaiCommande);
  const etat = joursRestants === 0 ? "epuise" : commanderLe <= aujourdhui ? "commander" : "ok";
  // Les filtres se comptent entiers : celui qui est dans la fontaine n'est plus dans le placard.
  const arrondi = provision.type === "filtres" ? Math.floor(restant + 1e-9) : Math.round(restant);
  return { restant: arrondi, joursRestants, fin, commanderLe, etat };
}

/** Ce qu'on ajoute à la liste de courses quand une provision touche à sa fin. */
export function texteCourses(provision: Provision, animal: Animal): string {
  const type = TYPES_PROVISION[provision.type];
  const produit = provision.nom === type ? "" : ` (${provision.nom})`;
  return `${type} ${animal.nom}${produit}`;
}

// ----- Commande régulière -----

export function definirCommande(
  animal: Animal,
  champs: { fournisseur: string; tousLesMois: number; prochaine: Jour; articles: ArticleCommande[] },
): Animal {
  verifierJour(champs.prochaine, "Prochaine commande");
  if (!Number.isInteger(champs.tousLesMois) || champs.tousLesMois < 1) throw new ErreurValidation("Le rythme doit être d'au moins un mois.");
  const articles = champs.articles.filter((a) => a.nom.trim() && a.quantite > 0);
  return { ...animal, commande: { ...champs, fournisseur: champs.fournisseur.trim() || "la boutique", articles } };
}

/**
 * La commande est passée : chaque article remplit sa provision (ce qui reste plus ce qui
 * arrive, compté à partir d'aujourd'hui), comme les extras ajoutés cette fois (un lot de
 * filtres), et la suivante est prévue un cycle plus tard.
 */
export function passerCommande(animal: Animal, aujourdhui: Jour, ctx: Contexte, extras: readonly Id[] = []): Animal {
  const commande = animal.commande;
  if (!commande) return animal;
  let provisions = [...animal.provisions];
  for (const article of commande.articles) {
    const existante = provisions.find((p) => p.type === article.type && p.nom === article.nom);
    if (existante) {
      const reste = prevoir(existante, animal, aujourdhui)?.restant ?? 0;
      provisions = provisions.map((p) => (p === existante ? { ...p, quantite: reste + article.quantite, achete: aujourdhui } : p));
    } else {
      provisions.push({ id: ctx.nouvelId(), type: article.type, nom: article.nom, quantite: article.quantite, achete: aujourdhui, parJour: null });
    }
  }
  provisions = provisions.map((p) => {
    if (!extras.includes(p.id)) return p;
    const reste = prevoir(p, animal, aujourdhui)?.restant ?? 0;
    return { ...p, quantite: reste + (p.lot ?? p.quantite), achete: aujourdhui };
  });
  const depart = commande.prochaine > aujourdhui ? commande.prochaine : aujourdhui;
  return { ...animal, provisions, commande: { ...commande, prochaine: plusMois(depart, commande.tousLesMois) } };
}

/**
 * Conseil pour la prochaine commande : si elle couvre ses 1 an, il faut prévoir la
 * transition vers les croquettes adulte (un sac chaton plus petit et un sac adulte).
 */
export function conseilCommande(animal: Animal): string | null {
  const commande = animal.commande;
  if (!commande || !commande.articles.some((a) => a.type === "croquettes")) return null;
  const adulte = passageAdulte(animal.naissance);
  const finDuCycle = plusMois(commande.prochaine, commande.tousLesMois);
  if (adulte <= commande.prochaine) {
    return ageEnMois(animal.naissance, commande.prochaine) < 13 ? "Elle a passé 1 an : commande des croquettes adulte." : null;
  }
  if (adulte < finDuCycle) {
    return `Cette commande couvre ses 1 an (${adulte.slice(8, 10)}/${adulte.slice(5, 7)}) : prends moins de croquettes chaton et un sac adulte pour la transition.`;
  }
  return null;
}

/** Rappeler la commande régulière quelques jours avant. */
export const RAPPEL_COMMANDE_JOURS = 3;
/** Délai de livraison compté pour savoir si le stock tiendra. */
export const LIVRAISON_JOURS = 3;

/** Les provisions de la commande qui seront vides avant que la prochaine arrive. */
export function videsAvantLivraison(animal: Animal, aujourdhui: Jour): { provision: Provision; fin: Jour }[] {
  const commande = animal.commande;
  if (!commande) return [];
  const arrivee = plusJours(commande.prochaine, LIVRAISON_JOURS);
  return animal.provisions.flatMap((p) => {
    if (!articleDe(p, animal)) return [];
    const prev = prevoir(p, animal, aujourdhui);
    return prev && prev.fin < arrivee ? [{ provision: p, fin: prev.fin }] : [];
  });
}

/**
 * Ce qui ne revient pas à chaque commande (les filtres : 6 pour 6 mois) mais sera vide
 * avant la commande d'après : à ajouter à la prochaine.
 */
export function aAjouterALaCommande(animal: Animal, aujourdhui: Jour): { provision: Provision; fin: Jour }[] {
  const commande = animal.commande;
  if (!commande) return [];
  const suivante = plusJours(plusMois(commande.prochaine, commande.tousLesMois), LIVRAISON_JOURS);
  return animal.provisions.flatMap((p) => {
    if (articleDe(p, animal)) return [];
    const prev = prevoir(p, animal, aujourdhui);
    return prev && prev.fin < suivante ? [{ provision: p, fin: prev.fin }] : [];
  });
}

/** La première date après aujourd'hui qui tombe au même rythme qu'un départ (le 2 de chaque mois…). */
export function prochaineOccurrence(depart: Jour, tousLesMois: number, aujourdhui: Jour): Jour {
  let n = 0;
  while (n < 1200 && plusMois(depart, n * tousLesMois) < aujourdhui) n++;
  return plusMois(depart, n * tousLesMois);
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
  if (type === "antiparasitaire" || type === "filtre") return 1;
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

// ----- Croissance -----

/** Poids médian d'une chatte, mois par mois jusqu'à 1 an (en grammes). Les mâles pèsent environ 20 % de plus. */
const POIDS_FEMELLE = [100, 500, 900, 1400, 1900, 2300, 2700, 3000, 3200, 3400, 3500, 3600, 3700];

export interface Repere {
  min: number;
  median: number;
  max: number;
}

/**
 * Le poids habituel d'un chat de cet âge, avec une marge large (± 25 %) : les chats varient
 * beaucoup, c'est un repère pour repérer une courbe qui décroche, pas une norme. Après 1 an,
 * le repère reste celui de 12 mois.
 */
export function poidsRepere(naissance: Jour, jour: Jour, sexe: Sexe = "femelle"): Repere {
  const mois = Math.max(0, ecartJours(naissance, jour) / 30.44);
  const i = Math.min(Math.floor(mois), POIDS_FEMELLE.length - 1);
  const suivant = POIDS_FEMELLE[Math.min(i + 1, POIDS_FEMELLE.length - 1)];
  const femelle = POIDS_FEMELLE[i] + (suivant - POIDS_FEMELLE[i]) * Math.min(1, mois - i);
  const median = Math.round(femelle * (sexe === "male" ? 1.2 : 1));
  return { min: Math.round(median * 0.75), median, max: Math.round(median * 1.25) };
}

export interface AlertePoids {
  texte: string;
  urgent: boolean;
}

/** Ce que disent ses dernières pesées : une perte de poids, ou un poids loin du repère de son âge. */
export function alertePoids(animal: Animal): AlertePoids | null {
  const [derniere, precedente] = historiquePesees(animal);
  if (!derniere) return null;
  if (precedente) {
    const perte = precedente.grammes - derniere.grammes;
    const chaton = ageEnMois(animal.naissance, derniere.jour) < 12;
    // Un chaton grandit : toute perte nette compte. Un adulte varie un peu.
    if (perte > 0 && (chaton ? perte >= 50 : perte >= precedente.grammes * 0.05)) {
      return { texte: `${animal.nom} a perdu ${perte} g depuis le ${precedente.jour.slice(8, 10)}/${precedente.jour.slice(5, 7)} : à signaler au vétérinaire`, urgent: true };
    }
  }
  const repere = poidsRepere(animal.naissance, derniere.jour, animal.sexe);
  if (derniere.grammes < repere.min) return { texte: "Poids sous le repère de son âge : à montrer au vétérinaire", urgent: false };
  if (derniere.grammes > repere.max) return { texte: "Poids au-dessus du repère de son âge : à montrer au vétérinaire", urgent: false };
  return null;
}

// ----- Carnet de santé prérempli -----

export interface PropositionCarnet {
  /** Identifie la proposition, pour pouvoir l'écarter. */
  cle: string;
  type: TypeSoin;
  libelle: string;
  date: Jour;
}

const VACCIN_PRIMO = "Vaccin typhus et coryza";

/**
 * Le calendrier habituel d'un chaton, à confirmer avec son carnet : vaccins typhus et coryza
 * à 8, 12 et 16 semaines puis un rappel un an plus tard, vermifuge et antipuces s'il n'y en a
 * aucun de noté, et la question de la stérilisation vers 6 mois. Ce qui figure déjà dans le
 * carnet (même type à trois semaines près) ou a été écarté n'est pas proposé.
 */
export function propositionsCarnet(animal: Animal, aujourdhui: Jour): PropositionCarnet[] {
  const n = animal.naissance;
  const toutes: PropositionCarnet[] = suiteDesVaccins(animal);
  if (!animal.soins.some((s) => s.type === "vermifuge")) {
    toutes.push({ cle: "vermifuge", type: "vermifuge", libelle: TYPES_SOIN.vermifuge, date: aujourdhui });
  }
  if (!animal.soins.some((s) => s.type === "antiparasitaire")) {
    toutes.push({ cle: "antiparasitaire", type: "antiparasitaire", libelle: TYPES_SOIN.antiparasitaire, date: aujourdhui });
  }
  if (!animal.sterilise && !animal.soins.some((s) => s.type === "sterilisation" || /st[ée]rilis/i.test(s.libelle))) {
    // « Autre » : en parler ne la rend pas stérilisée, et ne revient pas chaque année.
    const sixMois = plusMois(n, 6);
    toutes.push({ cle: "sterilisation", type: "autre", libelle: "Parler de la stérilisation au vétérinaire", date: sixMois > aujourdhui ? sixMois : aujourdhui });
  }
  const ecartees = new Set(animal.carnetEcarte ?? []);
  return toutes.filter(
    (p) => !ecartees.has(p.cle) && !animal.soins.some((s) => s.type === p.type && Math.abs(ecartJours(s.date, p.date)) <= 21),
  );
}

/**
 * Les vaccins à proposer. Sans vaccin noté, le calendrier type d'un chaton. Dès qu'un vrai vaccin
 * est noté, la suite part de lui : un seul vaccin de chaton appelle une 2e injection 3 à 4 semaines
 * après (la primovaccination en demande deux), puis le rappel un an après la dernière. Un vaccin
 * déjà prévu dans le carnet suffit : rien n'est proposé en plus.
 */
function suiteDesVaccins(animal: Animal): PropositionCarnet[] {
  const n = animal.naissance;
  const vaccins = animal.soins.filter((s) => s.type === "vaccin");
  if (vaccins.some((s) => !s.fait)) return [];
  const faits = vaccins.map((s) => s.date).sort();
  if (!faits.length) {
    return [
      { cle: "vaccin-8s", type: "vaccin", libelle: `${VACCIN_PRIMO} (1re injection)`, date: plusJours(n, 56) },
      { cle: "vaccin-12s", type: "vaccin", libelle: `${VACCIN_PRIMO} (2e injection)`, date: plusJours(n, 84) },
      { cle: "vaccin-16s", type: "vaccin", libelle: `${VACCIN_PRIMO} (3e injection)`, date: plusJours(n, 112) },
      { cle: "vaccin-rappel", type: "vaccin", libelle: "Rappel des vaccins (un an après)", date: plusMois(plusJours(n, 112), 12) },
    ];
  }
  const dernier = faits[faits.length - 1];
  if (faits.length === 1 && ageEnMois(n, dernier) < 12) {
    return [{ cle: "vaccin-2e", type: "vaccin", libelle: "2e injection du vaccin, à demander au vétérinaire", date: plusJours(dernier, 28) }];
  }
  return [{ cle: "vaccin-rappel", type: "vaccin", libelle: "Rappel des vaccins (un an après)", date: plusMois(dernier, 12) }];
}

/**
 * Reprend une proposition dans le carnet : « fait » la note comme faite à sa date (sans prévoir de
 * suivant, le carnet dit déjà la suite) ; sinon elle est prévue, au plus tôt aujourd'hui.
 */
export function reprendreProposition(animal: Animal, p: PropositionCarnet, fait: boolean, aujourdhui: Jour, ctx: Contexte): Animal {
  const date = fait ? (p.date > aujourdhui ? aujourdhui : p.date) : p.date < aujourdhui ? aujourdhui : p.date;
  const apres = ajouterSoin(animal, { id: ctx.nouvelId(), type: p.type, libelle: p.libelle, date, fait });
  // Vermifuge et antipuces reviennent : le suivant est prévu tout de suite.
  const rythme = fait && (p.type === "vermifuge" || p.type === "antiparasitaire") ? rythmeDuSoin(p.type, ageEnMois(animal.naissance, date)) : null;
  return rythme ? ajouterSoin(apres, { id: ctx.nouvelId(), type: p.type, libelle: p.libelle, date: plusMois(date, rythme), fait: false }) : apres;
}

export function ecarterProposition(animal: Animal, cle: string): Animal {
  return { ...animal, carnetEcarte: [...new Set([...(animal.carnetEcarte ?? []), cle])] };
}

/** Un soin noté d'un coup, par exemple relu sur une photo du carnet : fait (à sa date) ou à venir. */
export function noterSoin(animal: Animal, champs: { type: TypeSoin; libelle: string; date: Jour; fait: boolean; details?: string }, ctx: Contexte): Animal {
  const details = champs.details?.trim();
  const soin: Soin = { ...nouveauSoin(champs.type, champs.date, champs.libelle, ctx), fait: champs.fait, ...(details ? { details } : {}) };
  // Le même soin à la même date n'est noté qu'une fois.
  if (animal.soins.some((s) => s.type === soin.type && s.date === soin.date && s.libelle === soin.libelle)) return animal;
  return { ...ajouterSoin(animal, soin), sterilise: animal.sterilise || (soin.type === "sterilisation" && soin.fait) };
}

// ----- Journal du quotidien -----

export type TypeEvenement = "litiere" | "vomi" | "pas_mange" | "selles" | "boite" | "cachee" | "autre";

export const TYPES_EVENEMENT: Record<TypeEvenement, string> = {
  litiere: "Litière changée",
  vomi: "A vomi",
  pas_mange: "N'a pas mangé",
  selles: "Selles molles",
  boite: "Boite",
  cachee: "Se cache, abattue",
  autre: "Autre",
};

/** Les événements qui sont des soucis de santé (la litière et « autre » n'en sont pas). */
export const SOUCIS: readonly TypeEvenement[] = ["vomi", "pas_mange", "selles", "boite", "cachee"];

export interface EvenementJournal {
  id: Id;
  jour: Jour;
  quoi: TypeEvenement;
  note: string;
  par: Id | null;
  creeLe: string;
}

export function noterEvenement(animal: Animal, quoi: TypeEvenement, jour: Jour, note: string, par: Id | null, ctx: Contexte): Animal {
  verifierJour(jour, "Journal");
  if (!(quoi in TYPES_EVENEMENT)) throw new ErreurValidation("Cet événement n'existe pas.");
  const texte = note.trim().replace(/\s+/g, " ");
  if (quoi === "autre" && !texte) throw new ErreurValidation("Écris ce qui s'est passé.");
  const evenement: EvenementJournal = { id: ctx.nouvelId(), jour, quoi, note: texte, par, creeLe: ctx.maintenant() };
  return { ...animal, journal: [...(animal.journal ?? []), evenement] };
}

export function retirerEvenement(animal: Animal, id: Id): Animal {
  return { ...animal, journal: (animal.journal ?? []).filter((e) => e.id !== id) };
}

/** Le journal, du plus récent au plus ancien. */
export function journalRecent(animal: Animal): EvenementJournal[] {
  return [...(animal.journal ?? [])].sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));
}

export function derniereLitiere(animal: Animal): EvenementJournal | null {
  return journalRecent(animal).find((e) => e.quoi === "litiere") ?? null;
}

/**
 * Un souci qui revient appelle le vétérinaire : ne pas manger deux jours sur trois (un chat qui
 * ne mange plus se met vite en danger), vomir ou avoir les selles molles trois fois en une
 * semaine, boiter ou se cacher deux fois en une semaine.
 */
export function alertesJournal(animal: Animal, aujourdhui: Jour): string[] {
  const journal = animal.journal ?? [];
  const depuis = (jours: number, quoi: TypeEvenement) =>
    journal.filter((e) => e.quoi === quoi && e.jour <= aujourdhui && ecartJours(e.jour, aujourdhui) < jours);
  const alertes: string[] = [];
  const pasMange = new Set(depuis(3, "pas_mange").map((e) => e.jour)).size;
  if (pasMange >= 2) alertes.push(`${animal.nom} n'a pas mangé ${pasMange} jours : appeler le vétérinaire`);
  for (const [quoi, seuil] of [["vomi", 3], ["selles", 3], ["boite", 2], ["cachee", 2]] as const) {
    const n = depuis(7, quoi).length;
    if (n >= seuil) alertes.push(`${TYPES_EVENEMENT[quoi]} ${n} fois en 7 jours : appeler le vétérinaire`);
  }
  return alertes;
}

// ----- Fiches à partager -----

const dateFr = (jour: Jour) => `${jour.slice(8, 10)}.${jour.slice(5, 7)}.${jour.slice(0, 4)}`;

/** La dernière visite chez le vétérinaire (une visite ou un vaccin faits), pour savoir depuis quand résumer. */
export function derniereVisite(animal: Animal): Jour | null {
  return soinsFaits(animal).find((s) => s.type === "visite" || s.type === "vaccin")?.date ?? null;
}

/** Le résumé à montrer au vétérinaire : poids, alimentation, soins, et les soucis notés depuis la dernière visite. */
export function resumeVeto(animal: Animal, aujourdhui: Jour): string {
  const l: string[] = [];
  const i = animal.infos ?? {};
  const race = [i.race, i.pelage?.toLowerCase()].filter(Boolean).join(" ");
  l.push(`${animal.nom}${i.nomComplet ? ` (${i.nomComplet})` : ""}, ${animal.sexe === "male" ? "mâle" : "femelle"}${animal.sterilise ? (animal.sexe === "male" ? " castré" : " stérilisée") : ""}${race ? `, ${race}` : ""}, née le ${dateFr(animal.naissance)} (${decrireAge(animal.naissance, aujourdhui)}).`);
  if (i.puce) l.push(`Puce : ${i.puce}${i.pucePoseeLe ? `, posée le ${dateFr(i.pucePoseeLe)}` : ""}.`);
  const pesees = historiquePesees(animal);
  l.push(pesees.length ? `Poids : ${pesees.slice(0, 4).map((p) => `${formaterPoids(p.grammes)} le ${dateFr(p.jour)}`).join(", ")}.` : "Poids : pas de pesée notée.");
  const croquettes = animal.provisions.filter((p) => p.type === "croquettes").map((p) => p.nom);
  const ration = rationDuJour(animal, aujourdhui);
  l.push(`Alimentation : ${croquettes.length ? croquettes.join(", ") : "croquettes"}${ration ? `, environ ${ration.grammes} g par jour` : ""}${animal.reglages.friandisesParJour ? `, ${animal.reglages.friandisesParJour} g de friandises` : ""}.`);
  const faits = soinsFaits(animal).filter((s) => s.type !== "filtre");
  if (faits.length) l.push(`Soins faits : ${faits.slice(0, 8).map((s) => `${s.libelle} (${dateFr(s.date)}${s.details ? `, ${s.details}` : ""})`).join(", ")}.`);
  const avenir = soinsAVenir(animal).filter((s) => s.type !== "filtre");
  if (avenir.length) l.push(`Prévu : ${avenir.slice(0, 5).map((s) => `${s.libelle} (${dateFr(s.date)})`).join(", ")}.`);
  const depuis = derniereVisite(animal) ?? plusMois(aujourdhui, -6);
  const soucis = journalRecent(animal).filter((e) => SOUCIS.includes(e.quoi) && e.jour >= depuis);
  l.push(
    soucis.length
      ? `Depuis le ${dateFr(depuis)} : ${soucis.map((e) => `${TYPES_EVENEMENT[e.quoi].toLowerCase()} le ${dateFr(e.jour)}${e.note ? ` (${e.note})` : ""}`).join(", ")}.`
      : `Aucun souci noté depuis le ${dateFr(depuis)}.`,
  );
  const autres = journalRecent(animal).filter((e) => e.quoi === "autre" && e.jour >= depuis);
  if (autres.length) l.push(`Remarques : ${autres.map((e) => `${e.note} (${dateFr(e.jour)})`).join(", ")}.`);
  return l.join("\n");
}

/** Ce qu'il faut à la personne qui la garde : repas, litière, fontaine, vétérinaire. */
export function ficheDeGarde(animal: Animal, aujourdhui: Jour): string {
  const l: string[] = [`Garder ${animal.nom} (${decrireAge(animal.naissance, aujourdhui)})`];
  const ration = rationDuJour(animal, aujourdhui);
  const croquettes = animal.provisions.find((p) => p.type === "croquettes")?.nom;
  l.push(`Repas : ${ration ? `${ration.grammes} g de croquettes par jour` : "croquettes"}${croquettes ? ` (${croquettes})` : ""}, en deux ou trois fois. Eau fraîche dans la fontaine.`);
  if (ration) l.push(`Friandises : ${ration.friandisesMax} g par jour au plus.`);
  const litiere = animal.provisions.find((p) => p.type === "litiere")?.nom;
  l.push(`Litière : retirer les selles chaque jour${litiere ? ` (${litiere})` : ""}.`);
  if (animal.provisions.some((p) => p.type === "filtres")) l.push("Fontaine : le filtre se change une fois par mois.");
  const i = animal.infos ?? {};
  if (i.consignes) l.push(`À savoir : ${i.consignes}`);
  if (i.veterinaire || i.telephoneVeto) l.push(`Vétérinaire : ${[i.veterinaire, i.adresseVeto, i.telephoneVeto, i.emailVeto].filter(Boolean).join(", ")}.`);
  if (i.puce) l.push(`Puce : ${i.puce}.`);
  if (i.assurance) l.push(`Assurance : ${i.assurance}.`);
  l.push("Appeler le vétérinaire si elle ne mange plus pendant un jour, vomit plusieurs fois ou se cache sans ressortir.");
  return l.join("\n");
}

export function modifierInfos(animal: Animal, infos: InfosAnimal): Animal {
  const propre: InfosAnimal = {};
  for (const [cle, valeur] of Object.entries(infos) as [keyof InfosAnimal, string | undefined][]) {
    const v = valeur?.trim();
    if (v) propre[cle] = v;
  }
  return { ...animal, infos: propre };
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

  const commande = animal.commande;
  if (commande) {
    const ecart = ecartJours(aujourdhui, commande.prochaine);
    if (ecart <= RAPPEL_COMMANDE_JOURS) {
      const quand = ecart < 0 ? "en retard" : ecart === 0 ? "aujourd'hui" : ecart === 1 ? "demain" : `dans ${ecart} jours`;
      urgentes.push({ texte: `Commande ${commande.fournisseur} ${quand}`, urgent: true });
      for (const { provision } of aAjouterALaCommande(animal, aujourdhui)) {
        urgentes.push({ texte: `Ajouter ${provision.nom} à la commande`, urgent: true });
      }
    }
    for (const { provision, fin } of videsAvantLivraison(animal, aujourdhui)) {
      if (ecart <= RAPPEL_COMMANDE_JOURS) continue; // déjà rappelée juste au-dessus
      urgentes.push({ texte: `${provision.nom} : vide vers le ${fin.slice(8, 10)}/${fin.slice(5, 7)}, avant la commande`, urgent: true });
    }
  }

  for (const p of animal.provisions) {
    // Les articles de la commande régulière suivent son rythme (ci-dessus).
    if (articleDe(p, animal)) continue;
    const prev = prevoir(p, animal, aujourdhui);
    if (!prev || prev.etat === "ok") continue;
    // Ce qui tient jusqu'à l'arrivée de la prochaine commande peut l'attendre : on l'y ajoutera.
    if (commande && prev.fin >= plusJours(commande.prochaine, LIVRAISON_JOURS)) continue;
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

  for (const texte of alertesJournal(animal, aujourdhui)) urgentes.unshift({ texte, urgent: true });
  const poids = alertePoids(animal);
  if (poids) (poids.urgent ? urgentes : bientot).push(poids);

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
