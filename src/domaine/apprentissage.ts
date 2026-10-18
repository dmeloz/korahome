// Kora apprend de votre usage. Tout se calcule ici, sur le téléphone, sans IA : ce que vous
// rachetez, les tâches qui n'ont pas le bon rythme, ce qui finit périmé, ce que Mitsu mange vraiment, l'heure
// où chacun fait ses tâches, les widgets qu'on ouvre et ceux qu'on oublie.
//
// Rien n'est retenu sans accord : chaque semaine, le bilan du dimanche propose deux ou trois
// choses apprises, qu'on garde ou qu'on refuse d'un geste. Ce qui vient du foyer (courses,
// tâches, stock, Mitsu) va dans la mémoire partagée, que relisent Jarvis et le Chef. Ce qui
// vient d'une personne (ses heures, ses widgets) reste sur son téléphone, jamais envoyé.

import { decrireGaspillage, souventJete, type ProduitHabituel } from "./catalogue";
import { panierHabituel } from "./habitudes";
import { nouveauSouvenir, type Souvenir } from "./memoire";
import { commandeRecalee, prevoir, TYPES_PROVISION, type Animal } from "./mitsu";
import { formaterHeure, HEURE_MAX, HEURE_MIN } from "./rappels";
import { normaliser } from "./rayons";
import { etatProduit, type Produit } from "./stock";
import { definition, type Disposition, type WidgetId } from "./tableauDeBord";
import { decaler, decrireRecurrence, ecartJours, estTerminee } from "./taches";
import type { Contexte, Element, Foyer, Id, Jour, Liste, Recurrence, Tache } from "./types";

// ----- L'usage de ce téléphone -----

/** Un geste qui en dit long : un widget ouvert, une tâche faite. Rien de ce qui est tapé. */
export interface Usage {
  jour: Jour;
  /** L'heure locale, de 0 à 23. */
  heure: number;
  type: "widget" | "tache";
  /** L'identifiant du widget ou de la tâche. */
  cle: string;
}

/** Deux mois d'usage suffisent pour voir des habitudes, et suivent leurs changements. */
export const USAGE_JOURS = 60;
const USAGES_MAX = 3000;

export function ajouterUsage(usages: readonly Usage[], u: Usage): Usage[] {
  const recents = usages.filter((x) => ecartJours(x.jour, u.jour) < USAGE_JOURS);
  return [...recents, u].slice(-USAGES_MAX);
}

/** Relit un usage enregistré ; ce qui est abîmé est ignoré. */
export function nettoyerUsages(brut: unknown): Usage[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(
    (u): u is Usage =>
      !!u && typeof u.jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u.jour) && Number.isInteger(u.heure) && (u.type === "widget" || u.type === "tache") && typeof u.cle === "string",
  );
}

// ----- L'accueil qui s'adapte -----

export type Moment = "matin" | "journee" | "soir";

export function momentDe(heure: number): Moment {
  if (heure < 11) return "matin";
  if (heure < 17) return "journee";
  return "soir";
}

/** Il faut au moins cinq ouvertures à ce moment de la journée pour changer l'ordre. */
const OUVERTURES_MIN = 5;
const JOURS_LUS = 30;

/**
 * L'accueil vivant : les urgents restent en tête, puis les widgets qu'on ouvre le plus à ce
 * moment de la journée (le matin les tâches, le soir le Chef). À égalité, l'ordre choisi.
 */
export function ordreVivant(ordre: Disposition, urgents: ReadonlySet<WidgetId>, usages: readonly Usage[], heure: number, aujourdhui: Jour): Disposition {
  const moment = momentDe(heure);
  const compte = new Map<string, number>();
  for (const u of usages) {
    if (u.type !== "widget" || momentDe(u.heure) !== moment || ecartJours(u.jour, aujourdhui) >= JOURS_LUS) continue;
    compte.set(u.cle, (compte.get(u.cle) ?? 0) + 1);
  }
  const total = ordre.reduce((s, id) => s + (compte.get(id) ?? 0), 0);
  if (total < OUVERTURES_MIN) return ordre;
  const rang = new Map(ordre.map((id, i) => [id, i]));
  const autres = ordre.filter((id) => !urgents.has(id)).sort((a, b) => (compte.get(b) ?? 0) - (compte.get(a) ?? 0) || rang.get(a)! - rang.get(b)!);
  return [...ordre.filter((id) => urgents.has(id)), ...autres];
}

/** Un widget pas ouvert depuis trois semaines est proposé au retrait. */
export const JOURS_DELAISSE = 21;

/** Les widgets du tableau jamais ouverts depuis trois semaines, quand on a ce recul. */
export function widgetsDelaisses(disposition: Disposition, usages: readonly Usage[], aujourdhui: Jour): WidgetId[] {
  const premier = usages.reduce<Jour | null>((min, u) => (min === null || u.jour < min ? u.jour : min), null);
  if (!premier || ecartJours(premier, aujourdhui) < JOURS_DELAISSE) return [];
  const ouverts = new Set(usages.filter((u) => u.type === "widget" && ecartJours(u.jour, aujourdhui) < JOURS_DELAISSE).map((u) => u.cle));
  return disposition.filter((id) => !ouverts.has(id));
}

// ----- Les rappels au bon moment -----

const TACHES_MIN = 5;

/**
 * L'heure de rappel qui colle à la vie de cette personne : une heure avant le moment où elle
 * fait vraiment ses tâches (la médiane du dernier mois). Rien tant qu'elle reçoit déjà son
 * rappel à moins de deux heures de là.
 */
export function heureConseillee(usages: readonly Usage[], heureActuelle: number, aujourdhui: Jour): number | null {
  const heures = usages
    .filter((u) => u.type === "tache" && ecartJours(u.jour, aujourdhui) < JOURS_LUS)
    .map((u) => u.heure)
    .sort((a, b) => a - b);
  if (heures.length < TACHES_MIN) return null;
  const mediane = heures[Math.floor(heures.length / 2)];
  const conseil = Math.min(HEURE_MAX, Math.max(HEURE_MIN, mediane - 1));
  return Math.abs(conseil - heureActuelle) >= 2 ? conseil : null;
}

// ----- Ce que Kora a appris -----

export type ActionApprise =
  /** Simplement le retenir : Jarvis et le Chef le relisent. */
  | { type: "retenir" }
  | { type: "heureRappel"; heure: number }
  | { type: "retirerWidget"; widget: WidgetId }
  | { type: "recalerCommande"; animalId: Id; jour: Jour }
  | { type: "rythmeTache"; tacheId: Id; recurrence: Recurrence };

export interface Apprentissage {
  /** Pour ne jamais reproposer ce qui a été gardé ou refusé. */
  cle: string;
  /** « foyer » : va dans la mémoire partagée ; « perso » : reste sur ce téléphone. */
  portee: "foyer" | "perso";
  /** Ce qui est montré au bilan, en une phrase. */
  texte: string;
  /** Ce qui est retenu si on le garde, dit comme un fait. */
  fait: string;
  /** Le bouton qui le garde : « Garder », « Décaler », « Retirer ». */
  oui: string;
  action: ActionApprise;
  /** Les plus utiles passent devant. */
  poids: number;
}

const cleTexte = (t: string) => normaliser(t).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const jourCourt = (jour: Jour) => `${Number(jour.slice(8, 10))}.${jour.slice(5, 7)}`;

/** Les achats assez réguliers pour en parler : au moins quatre fois, à un rythme stable. */
function rachats(liste: Liste): Apprentissage[] {
  const appris: Apprentissage[] = [];
  for (const a of liste.achats ?? []) {
    if (a.jours.length < 4) continue;
    const ecarts = a.jours.slice(1).map((j, i) => ecartJours(a.jours[i], j));
    const moyenne = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
    if (moyenne < 2) continue;
    const variation = Math.sqrt(ecarts.reduce((s, e) => s + (e - moyenne) ** 2, 0) / ecarts.length) / moyenne;
    if (variation > 0.35) continue;
    const rythme = Math.round(moyenne);
    const fait = `Le foyer rachète ${minuscule(a.texte)} tous les ${rythme} jours environ${a.quantite ? ` (${a.quantite})` : ""}.`;
    appris.push({ cle: `rachat:${cleTexte(a.texte)}`, portee: "foyer", texte: fait, fait, oui: "Garder", action: { type: "retenir" }, poids: 1 + a.jours.length / 10 });
  }
  return appris;
}

function panier(liste: Liste, elements: readonly Element[]): Apprentissage[] {
  const p = panierHabituel(liste, elements);
  if (!p) return [];
  const exemple = [...p.habituels].sort((a, b) => b.jours.length - a.jours.length).slice(0, 4).map((a) => minuscule(a.texte)).join(", ");
  const fait = `Les courses se font plutôt le ${p.nomDuJour}${exemple ? `, avec presque toujours : ${exemple}` : ""}.`;
  return [{ cle: `panier:${p.jour}`, portee: "foyer", texte: `${fait} Le bouton « Comme d'habitude » remplit la liste en un toucher.`, fait, oui: "Garder", action: { type: "retenir" }, poids: 2.5 }];
}

/** Une recurrence en jours, pour comparer des rythmes. */
const enJours = (r: Recurrence) => r.tous * (r.unite === "jour" ? 1 : r.unite === "semaine" ? 7 : 30);

/** Le rythme le plus simple pour un écart en jours : en semaines quand il tombe près d'un multiple de 7. */
export function rythmeProche(jours: number): Recurrence {
  const semaines = Math.round(jours / 7);
  if (semaines >= 1 && Math.abs(jours - semaines * 7) <= 1) return { unite: "semaine", tous: semaines };
  return { unite: "jour", tous: Math.max(1, Math.round(jours)) };
}

/**
 * Une tâche qui revient mais qui, dans les faits, se fait nettement moins souvent (l'arrosage
 * « chaque semaine » fait tous les 10 jours) : son rythme n'est pas le bon, elle reste en retard.
 */
function tachesAuVraiRythme(taches: readonly Tache[]): Apprentissage[] {
  const appris: Apprentissage[] = [];
  for (const t of taches) {
    if (!t.recurrence || estTerminee(t)) continue;
    const fois = (t.historique ?? []).slice(-5);
    if (fois.length < 4) continue;
    const ecarts = fois.slice(1).map((f, i) => ecartJours(fois[i].le, f.le));
    const moyenne = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
    const prevu = enJours(t.recurrence);
    if (moyenne < prevu * 1.3 || moyenne - prevu < 3 || moyenne > 120) continue;
    const rythme = rythmeProche(moyenne);
    const dit = decrireRecurrence(rythme).toLowerCase();
    const titre = `« ${t.titre} »`;
    appris.push({
      cle: `rythme:${t.id}:${rythme.unite}:${rythme.tous}`,
      portee: "foyer",
      texte: `${titre} est prévue ${decrireRecurrence(t.recurrence).toLowerCase()}, mais se fait plutôt ${dit}. La passer à ce rythme, pour qu'elle ne soit plus toujours en retard ?`,
      fait: `${titre} se fait ${dit} : son rythme a été ajusté.`,
      oui: "Ajuster",
      action: { type: "rythmeTache", tacheId: t.id, recurrence: rythme },
      poids: 3,
    });
  }
  return appris;
}

function gaspillage(catalogue: readonly ProduitHabituel[]): Apprentissage[] {
  return catalogue.filter(souventJete).map((h) => {
    const fait = `${h.nom} finit souvent périmé (${decrireGaspillage(h)}) : en acheter moins à la fois.`;
    return { cle: `gaspi:${h.cle}`, portee: "foyer", texte: fait, fait, oui: "Garder", action: { type: "retenir" }, poids: 3 } satisfies Apprentissage;
  });
}

function mitsu(animaux: readonly Animal[], aujourdhui: Jour): Apprentissage[] {
  const appris: Apprentissage[] = [];
  for (const animal of animaux) {
    const recale = commandeRecalee(animal, aujourdhui);
    if (!recale || !animal.commande) continue;
    const type = TYPES_PROVISION[recale.provision.type].toLowerCase();
    const plusTot = recale.jour < animal.commande.prochaine;
    appris.push({
      cle: `commande:${animal.id}:${recale.jour}`,
      portee: "foyer",
      texte: `Au rythme où ${animal.nom} consomme vraiment ${type === "litière" ? "sa litière" : `ses ${type}`}, il faut commander le ${jourCourt(recale.jour)} plutôt que le ${jourCourt(animal.commande.prochaine)}. Recaler la commande ${plusTot ? "plus tôt" : "plus tard"} ?`,
      fait: `La commande de ${animal.nom} suit ce qu'elle consomme vraiment : recalée au ${jourCourt(recale.jour)}.`,
      oui: "Recaler",
      action: { type: "recalerCommande", animalId: animal.id, jour: recale.jour },
      poids: 4,
    });
  }
  return appris;
}

function personnels(d: { usages: readonly Usage[]; disposition: Disposition; heureRappel: number | null; aujourdhui: Jour }): Apprentissage[] {
  const appris: Apprentissage[] = [];
  if (d.heureRappel !== null) {
    const h = heureConseillee(d.usages, d.heureRappel, d.aujourdhui);
    if (h !== null) {
      appris.push({
        cle: `heure:${h}`,
        portee: "perso",
        texte: `Tu fais tes tâches plutôt vers ${formaterHeure(h + 1)}. Recevoir ton rappel à ${formaterHeure(h)} plutôt qu'à ${formaterHeure(d.heureRappel)} ?`,
        fait: `Ton rappel arrive à ${formaterHeure(h)}, une heure avant le moment où tu fais d'habitude tes tâches.`,
        oui: "Changer l'heure",
        action: { type: "heureRappel", heure: h },
        poids: 3,
      });
    }
  }
  for (const w of widgetsDelaisses(d.disposition, d.usages, d.aujourdhui)) {
    const titre = definition(w).titre;
    appris.push({
      cle: `widget:${w}`,
      portee: "perso",
      texte: `Tu n'as pas ouvert « ${titre} » depuis trois semaines. Le retirer de ton accueil ? Il se remet quand tu veux.`,
      fait: `« ${titre} » a quitté ton accueil : tu ne l'ouvrais plus.`,
      oui: "Retirer",
      action: { type: "retirerWidget", widget: w },
      poids: 2,
    });
  }
  return appris;
}

export interface EntreeApprentissage {
  listes: readonly Liste[];
  elements: readonly Element[];
  taches: readonly Tache[];
  catalogue: readonly ProduitHabituel[];
  animaux: readonly Animal[];
  souvenirs: readonly Souvenir[];
  usages: readonly Usage[];
  disposition: Disposition;
  /** L'heure du rappel de ce téléphone ; null quand les rappels ne sont pas en place. */
  heureRappel: number | null;
  /** Les apprentissages personnels déjà gardés ou refusés sur ce téléphone. */
  decisionsPerso: Readonly<Record<string, "garde" | "refuse">>;
  aujourdhui: Jour;
}

/** Tout ce que Kora a remarqué et qui n'a pas encore été gardé ni refusé, le plus utile d'abord. */
export function apprentissages(d: EntreeApprentissage): Apprentissage[] {
  const courses = d.listes.find((l) => l.type === "courses");
  const tous = [
    ...(courses ? [...panier(courses, d.elements), ...rachats(courses)] : []),
    ...tachesAuVraiRythme(d.taches),
    ...gaspillage(d.catalogue),
    ...mitsu(d.animaux, d.aujourdhui),
    ...personnels(d),
  ];
  const decides = new Set(d.souvenirs.map((s) => s.cle).filter(Boolean));
  return tous.filter((a) => !decides.has(a.cle) && !d.decisionsPerso[a.cle]).sort((a, b) => b.poids - a.poids);
}

/** Le bilan du dimanche : deux ou trois choses, pas plus, avec au plus deux rachats. */
export const BILAN_MAX = 3;

export function bilanDeLaSemaine(appris: readonly Apprentissage[]): Apprentissage[] {
  const choisis: Apprentissage[] = [];
  let rachatsPris = 0;
  for (const a of appris) {
    if (choisis.length >= BILAN_MAX) break;
    if (a.cle.startsWith("rachat:")) {
      if (rachatsPris >= 2) continue;
      rachatsPris++;
    }
    choisis.push(a);
  }
  return choisis;
}

/** Le dimanche qui ouvre la semaine de ce jour. */
export function semaineDe(jour: Jour): Jour {
  const n = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return decaler(jour, { unite: "jour", tous: -n });
}

/** Le bilan s'ouvre chaque dimanche et attend toute la semaine qu'on le regarde. */
export function bilanAOuvrir(aujourdhui: Jour, dernierBilan: Jour | null, nombre: number): boolean {
  if (nombre === 0) return false;
  return dernierBilan === null || semaineDe(dernierBilan) < semaineDe(aujourdhui);
}

/** Un apprentissage du foyer, gardé ou refusé, tel qu'il entre dans la mémoire partagée. */
export function souvenirAppris(a: Apprentissage, garde: boolean, auteur: Id | null, ctx: Contexte): Souvenir {
  const souvenir: Souvenir = { ...nouveauSouvenir(a.fait, "bilan", auteur, ctx), cle: a.cle };
  return garde ? souvenir : { ...souvenir, refuse: true };
}

// ----- La remarque du jour de Jarvis -----

export interface Remarque {
  cle: string;
  texte: string;
  /** La page qu'elle ouvre d'un toucher. */
  module: WidgetId | null;
}

/**
 * Le petit mot du jour, quand Jarvis remarque quelque chose d'utile, par ordre d'importance :
 * Mitsu qui va manquer, ce qui arrive à sa date aujourd'hui, le jour des courses habituel, une
 * de mes tâches qui attend. Rien sinon : il ne parle pas pour ne rien dire.
 */
export function remarqueDuJour(d: {
  animaux: readonly Animal[];
  produits: readonly Produit[];
  taches: readonly Tache[];
  listes: readonly Liste[];
  elements: readonly Element[];
  membreId: Id | null;
  aujourdhui: Jour;
}): Remarque | null {
  for (const animal of d.animaux) {
    for (const p of animal.provisions) {
      if (p.type !== "croquettes" && p.type !== "litiere") continue;
      const prevision = prevoir(p, animal, d.aujourdhui);
      if (!prevision || prevision.joursRestants > 7) continue;
      const quoi = p.type === "croquettes" ? "croquettes" : "litière";
      const texte =
        prevision.joursRestants === 0
          ? `Il n'y a plus de ${quoi} pour ${animal.nom}.`
          : `Il ne reste de la ${quoi === "croquettes" ? "nourriture" : "litière"} pour ${animal.nom} que pour ${prevision.joursRestants === 1 ? "un jour" : `${prevision.joursRestants} jours`}.`;
      return { cle: `mitsu:${p.id}`, texte, module: "mitsu" };
    }
  }

  const duJour = d.produits.filter((p) => etatProduit(p, d.aujourdhui) === "aujourdhui");
  if (duJour.length) {
    const noms = duJour.slice(0, 3).map((p) => minuscule(p.nom));
    const liste = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
    return { cle: `stock:${d.aujourdhui}`, texte: `${liste.charAt(0).toUpperCase() + liste.slice(1)} ${duJour.length === 1 ? "arrive" : "arrivent"} à ${duJour.length === 1 ? "sa" : "leur"} date aujourd'hui : de quoi penser au repas du soir.`, module: "stock" };
  }

  const courses = d.listes.find((l) => l.type === "courses");
  const p = courses ? panierHabituel(courses, d.elements) : null;
  if (p && p.articles.length && new Date(`${d.aujourdhui}T12:00:00Z`).getUTCDay() === p.jour) {
    return { cle: `panier:${d.aujourdhui}`, texte: `C'est ${p.nomDuJour}, jour des courses. Ta liste habituelle se remplit d'un toucher.`, module: "courses" };
  }

  if (d.membreId) {
    const enRetard = d.taches
      .filter((t) => t.responsable === d.membreId && !estTerminee(t) && ecartJours(t.echeance, d.aujourdhui) >= 2)
      .sort((a, b) => a.echeance.localeCompare(b.echeance))[0];
    if (enRetard) {
      const jours = ecartJours(enRetard.echeance, d.aujourdhui);
      return { cle: `tache:${enRetard.id}:${d.aujourdhui}`, texte: `« ${enRetard.titre} » t'attend depuis ${jours} jours.`, module: "taches" };
    }
  }
  return null;
}

// ----- L'équilibre des tâches -----

/** Il ne se montre que si tout le foyer a dit oui. */
export function equilibreVisible(foyer: Foyer): boolean {
  return foyer.membres.length > 1 && foyer.membres.every((m) => foyer.equilibre?.includes(m.id));
}

export function accepterEquilibre(foyer: Foyer, membreId: Id, oui: boolean): Foyer {
  const avant = (foyer.equilibre ?? []).filter((id) => id !== membreId);
  return { ...foyer, equilibre: oui ? [...avant, membreId] : avant };
}

export interface Equilibre {
  parMembre: { membreId: Id; prenom: string; couleur: string; fois: number }[];
  phrase: string;
}

/** Qui a fait quoi ces 30 derniers jours, dit avec douceur. */
export function equilibreDesTaches(taches: readonly Tache[], foyer: Foyer, aujourdhui: Jour, jours = 30): Equilibre {
  const compte = new Map<Id, number>();
  for (const t of taches) {
    for (const f of t.historique ?? []) {
      if (f.par && ecartJours(f.le, aujourdhui) < jours) compte.set(f.par, (compte.get(f.par) ?? 0) + 1);
    }
  }
  const parMembre = foyer.membres.map((m) => ({ membreId: m.id, prenom: m.prenom, couleur: m.couleur, fois: compte.get(m.id) ?? 0 }));
  const total = parMembre.reduce((s, m) => s + m.fois, 0);
  if (total === 0) return { parMembre, phrase: "Rien de noté ce mois-ci pour l'instant." };
  const tries = [...parMembre].sort((a, b) => b.fois - a.fois);
  const ecart = (tries[0].fois - tries[tries.length - 1].fois) / total;
  if (ecart <= 0.2) return { parMembre, phrase: "Bien partagé ce mois-ci." };
  return { parMembre, phrase: `${tries[0].prenom} en a fait un peu plus ce mois-ci : ${tries[tries.length - 1].prenom} pourrait prendre les prochaines.` };
}

/** La tâche passe à son vrai rythme, à compter de la dernière fois où elle a été faite. */
export function ajusterRythme(tache: Tache, recurrence: Recurrence): Tache {
  const derniere = tache.historique?.at(-1)?.le;
  return { ...tache, recurrence, echeance: derniere ? decaler(derniere, recurrence) : tache.echeance };
}
