// Jarvis, l'assistant du foyer : on lui écrit ou on lui parle (« ajoute du lait, la litière
// est faite »), il répond et agit. Ce fichier tient ses règles, sans réseau ni stockage :
// - ce que Jarvis sait faire (OUTILS_JARVIS) et ses consignes, envoyés au modèle par la
//   fonction serveur supabase/functions/jarvis (copiés par `npm run fonction`) ;
// - ce qu'il sait du foyer (decrireFoyer), préparé par le téléphone ;
// - comment ses actions modifient les données (appliquerActions), sur le téléphone, qui
//   les enregistre dans le Dépôt et peut tout annuler ;
// - le plafond de dépense du foyer (5 CHF par mois).
// Ce qui supprime (une tâche, un produit, un souvenir) ou ce qu'il propose de retenir attend
// le oui de la personne (aConfirmer). Tout se rattrape avec Annuler.
// Il a aussi une mémoire du foyer (memoire.ts) et note ce qu'il ne sait pas encore faire
// comme souhait pour Claude (une note « Idée » des retours de test).

import { CATEGORIES, decrireAgenda, decrireJour, evenementsDe, preparerEvenement, REPETITIONS, type Categorie, type DocAgenda, type Evenement, type Repetition } from "./agenda";
import { decrireBudget, facturesAPayer, formaterMontant as formaterMontantCourt, nouvelleDepense, payerFacture, planDe, POTS, type ArticleTicket, type Depense, type DocBudget, type Pot } from "./budget";
import { completerPaiement } from "./paiements";
import { avisDuPlat, menuDeLaSemaine, type DocChef } from "./chef";
import { apprendreRecette, decrireRecettes, lireBrouillon, recettesDe, SOURCES_RECETTE, type BrouillonRecette, type Recette } from "./recettes";
import { proposer, type ProduitHabituel } from "./catalogue";
import { ajouterPlante, arroser, decrireJardin, nouvellePlante, type Zone } from "./jardin";
import { analyserSaisie, nouvelElement, trouverDoublon } from "./listes";
import type { Meteo } from "./meteo";
import {
  ajouterPesee,
  choseAFaire,
  formaterPoids,
  journalRecent,
  noterEvenement,
  noterSoin,
  poidsDeReference,
  rationDuJour,
  reglerPoidsEtRation,
  soinsAVenir,
  soinsFaits,
  TYPES_EVENEMENT,
  TYPES_SOIN,
  type Animal,
  type TypeEvenement,
  type TypeSoin,
} from "./mitsu";
import { suggestions } from "./habitudes";
import { decrireMemoire, nouveauSouvenir, souvenirSemblable, trouverSouvenir, type Souvenir } from "./memoire";
import { normaliser } from "./rayons";
import { nouveauRetour, type RetourTest } from "./retours";
import { decrirePeremption, LIEUX, nouveauProduit, type Lieu, type Produit } from "./stock";
import { decaler, decrireEcheance, decrireRecurrence, ecartJours, estTerminee, marquerFaite, nouvelleTache } from "./taches";
import type { Contexte, Element, Foyer, Id, Jour, Liste, Recurrence, Tache } from "./types";
import { NOMS_JOURS } from "./texte";
import { enviesDe, lireEnvie, nouvelleEnvie, PIECES, poserTaille, tailleDe, type DocVetement, type Piece } from "./vetements";
export {
  coutMicroChf,
  etatBudget,
  formaterChf,
  OUTILS_JARVIS,
  TOURS_RETENUS,
  type EtatBudget,
  type TourJarvis,
} from "./jarvisModele";

// ----- Ce que Jarvis sait du foyer -----

export interface DonneesFoyer {
  foyer: Foyer;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  animaux: Animal[];
  produits: Produit[];
  /** Les habitudes du foyer (où il range, combien de temps ça se garde). */
  catalogue?: ProduitHabituel[];
  /** Le jardin et sa météo. */
  zones?: Zone[];
  meteo?: Meteo | null;
  /** Ce que Jarvis sait du foyer d'une fois à l'autre. */
  souvenirs?: Souvenir[];
  /** Les notes de test : les souhaits de Jarvis y vont, sans doublon. */
  retours?: RetourTest[];
  /** La version de l'app, marquée sur les souhaits. */
  version?: string;
  /** L'agenda commun. */
  agenda?: readonly DocAgenda[];
  /** Le budget du foyer. */
  budget?: readonly DocBudget[];
  /** Les menus du Chef et les recettes du foyer. */
  menus?: readonly DocChef[];
  /** Les vêtements : tailles, envies et pièces à trier de chacun. */
  vetements?: readonly DocVetement[];
}

/** Les tailles et les envies de chacun, une ligne par personne. */
function decrireVetements(docs: readonly DocVetement[], foyer: Foyer, maintenant: string): string[] {
  const lignes: string[] = [];
  for (const m of foyer.membres) {
    const tailles = PIECES.map((p) => [p.nom, tailleDe(docs, m.id, p.id)?.valeur] as const).filter((x) => x[1]);
    const envies = enviesDe(docs, m.id, maintenant).filter((e) => !e.acheteLe);
    if (!tailles.length && !envies.length) continue;
    lignes.push(
      `Vêtements de ${m.prenom} : ${tailles.length ? `tailles ${tailles.map(([n, v]) => `${n.toLowerCase()} ${v}`).join(", ")}` : "tailles pas notées"}` +
        `${envies.length ? ` ; envies ${envies.map((e) => `${e.titre}${e.prix !== null ? ` (${e.prix} CHF)` : ""}`).join(", ")}` : ""}.`,
    );
  }
  return lignes;
}

const listeCourses = (d: DonneesFoyer) => d.listes.find((l) => l.type === "courses") ?? null;
const prenomDe = (foyer: Foyer, id: Id | null) => foyer.membres.find((m) => m.id === id)?.prenom ?? null;

function nomDuJour(jour: Jour): string {
  const [a, m, j] = jour.split("-").map(Number);
  return NOMS_JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
}

/** L'état du foyer, en quelques lignes, envoyé avec chaque demande. */
export function decrireFoyer(d: DonneesFoyer, membreId: Id | null, aujourdhui: Jour): string {
  const lignes: string[] = [];
  const moi = prenomDe(d.foyer, membreId);
  lignes.push(`Aujourd'hui : ${nomDuJour(aujourdhui)} ${aujourdhui}.`);
  lignes.push(`Foyer « ${d.foyer.nom} » : ${d.foyer.membres.map((m) => m.prenom).join(", ")}.`);
  lignes.push(moi ? `La personne qui parle : ${moi}.` : "La personne qui parle n'est pas connue.");
  lignes.push(...decrireMemoire(d.souvenirs ?? []));

  const liste = listeCourses(d);
  const aPrendre = liste ? d.elements.filter((e) => e.listeId === liste.id && !e.coche) : [];
  lignes.push(
    !liste
      ? "Pas de liste de courses."
      : aPrendre.length === 0
        ? "Liste de courses : vide."
        : `Liste de courses : ${aPrendre.map((e) => (e.quantite ? `${e.texte} (${e.quantite})` : e.texte)).join(", ")}.`,
  );
  const habitudes = liste ? suggestions(liste, d.elements, aujourdhui, 8) : [];
  if (habitudes.length) lignes.push(`Bientôt à racheter, d'après les habitudes : ${habitudes.map((h) => `${h.texte} (${h.rythme})`).join(", ")}.`);

  const taches = d.taches
    .filter((t) => !estTerminee(t) && ecartJours(aujourdhui, t.echeance) <= 14)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));
  lignes.push(taches.length === 0 ? "Tâches des deux semaines : aucune." : "Tâches des deux semaines :");
  for (const t of taches) {
    const qui = prenomDe(d.foyer, t.responsable) ?? "libre";
    lignes.push(`- ${t.titre} : ${decrireEcheance(t.echeance, aujourdhui)}, ${qui}, ${decrireRecurrence(t.recurrence).toLowerCase()}`);
  }

  if (d.produits.length > 0) {
    lignes.push("Stock :");
    for (const p of d.produits) {
      const date = decrirePeremption(p, aujourdhui);
      lignes.push(`- ${p.nom}${p.quantite ? ` (${p.quantite})` : ""}, ${LIEUX[p.lieu].toLowerCase()}${date ? `, ${date.toLowerCase()}` : ""}`);
    }
  } else {
    lignes.push("Stock : rien de noté.");
  }

  for (const a of d.animaux) {
    const poids = poidsDeReference(a);
    const ration = rationDuJour(a, aujourdhui);
    const aFaire = choseAFaire(a, aujourdhui).map((c) => c.texte);
    lignes.push(
      `Animal ${a.nom} : ${poids ? `${formaterPoids(poids.grammes)} (${poids.estime ? "estimé" : "pesé"} le ${poids.jour})` : "pas encore pesé"}` +
        `${ration ? `, ration ${ration.grammes} g par jour` : ""}${aFaire.length ? `, à faire : ${aFaire.join(" ; ")}` : ""}.`,
    );
    const soins = soinsAVenir(a).slice(0, 4);
    if (soins.length) lignes.push(`Carnet de ${a.nom}, prévu : ${soins.map((x) => `${x.libelle} le ${x.date}`).join(", ")}.`);
    const faits = soinsFaits(a).slice(0, 5);
    if (faits.length) lignes.push(`Carnet de ${a.nom}, derniers soins faits : ${faits.map((x) => `${x.libelle} le ${x.date}`).join(", ")}.`);
    const journal = journalRecent(a).slice(0, 5);
    if (journal.length) lignes.push(`Journal de ${a.nom} : ${journal.map((e) => `${TYPES_EVENEMENT[e.quoi].toLowerCase()}${e.note ? ` (${e.note})` : ""} le ${e.jour}`).join(", ")}.`);
  }
  if (d.menus) {
    const menu = menuDeLaSemaine(d.menus, aujourdhui);
    if (menu) lignes.push(`Menus du Chef cette semaine : ${menu.repas.map((r) => r.titre).join(", ")}.`);
    const avis = (r: Recette) => avisDuPlat(d.souvenirs ?? [], r.titre)?.avis ?? null;
    lignes.push(...decrireRecettes(recettesDe(d.menus), d.produits, aujourdhui, avis));
  }
  if (d.zones?.length) lignes.push(...decrireJardin(d.zones, d.meteo ?? null, aujourdhui));
  if (d.agenda) lignes.push(...decrireAgenda(evenementsDe(d.agenda), d.foyer, aujourdhui));
  if (d.budget) lignes.push(...decrireBudget(d.budget, (id) => prenomDe(d.foyer, id) ?? "", aujourdhui));
  if (d.vetements?.length) lignes.push(...decrireVetements(d.vetements, d.foyer, `${aujourdhui}T12:00:00.000Z`));
  return lignes.join("\n");
}

// ----- Les actions -----

export type ActionJarvis =
  | { outil: "ajouter_courses"; articles: string[] }
  | { outil: "cocher_courses"; articles: string[] }
  | { outil: "ajouter_tache"; titre: string; echeance: Jour; responsable: string | null; frequence: Recurrence | null }
  | { outil: "tache_faite"; titre: string }
  | { outil: "attribuer_tache"; titre: string; responsable: string | null }
  | { outil: "ajouter_au_stock"; produits: { nom: string; lieu: Lieu; peremption: Jour | null }[] }
  | { outil: "noter_pesee"; animal: string; grammes: number; jour?: Jour | null }
  | { outil: "regler_animal"; animal: string; poidsEstime: number | null; ration: number | null }
  | { outil: "noter_journal"; animal: string; quoi: TypeEvenement; note: string; jour: Jour | null }
  | { outil: "noter_soin"; animal: string; type: TypeSoin; libelle: string; date: Jour; fait: boolean }
  | { outil: "ajouter_plante"; plantes: string[]; zone: string | null }
  | { outil: "arrosage_fait"; zone: string | null }
  | { outil: "modifier_tache"; titre: string; nouveauTitre: string | null; echeance: Jour | null }
  | { outil: "supprimer_tache"; titre: string }
  | { outil: "retirer_du_stock"; produits: string[] }
  | { outil: "retenir"; fait: string; propose: boolean }
  | { outil: "oublier"; fait: string }
  | { outil: "noter_souhait"; demande: string; manque: string }
  | { outil: "enregistrer_recette"; recette: BrouillonRecette }
  | {
      outil: "ajouter_evenement";
      titre: string;
      jour: Jour;
      fin: Jour | null;
      heure: string | null;
      heureFin: string | null;
      pour: string | null;
      categorie: Categorie;
      repetition: Repetition;
      lieu: string | null;
    }
  | { outil: "supprimer_evenement"; titre: string; jour: Jour | null }
  | { outil: "noter_depense"; montant: number; libelle: string; magasin: string | null; pot: Pot; jour: Jour | null; charge: string | null; articles: ArticleTicket[] }
  | { outil: "noter_taille"; pour: string; piece: Piece; valeur: string }
  | { outil: "noter_envie"; pour: string; envie: string };

/**
 * Ce qui attend le oui de la personne avant de se faire : supprimer. Ce que Jarvis remarque seul,
 * il le retient tout de suite (Kora 0.0.70, souhait du foyer) ; « Annuler » ou sa page l'efface.
 */
export function aConfirmer(action: ActionJarvis, demande = ""): boolean {
  // Une page web derrière un lien pourrait glisser une fausse information à retenir : avec un
  // lien dans la demande, « retenir » attend le oui (veille du 26 octobre 2026).
  if (action.outil === "retenir" && /https?:\/\//i.test(demande)) return true;
  return (
    action.outil === "supprimer_tache" ||
    action.outil === "retirer_du_stock" ||
    action.outil === "oublier" ||
    action.outil === "supprimer_evenement"
  );
}

/** La question posée avant une action à confirmer, et le libellé de son bouton « oui ». */
export function questionPour(action: ActionJarvis): { question: string; oui: string } {
  switch (action.outil) {
    case "supprimer_tache":
      return { question: `Supprimer la tâche « ${action.titre} » ?`, oui: "Supprimer" };
    case "retirer_du_stock":
      return { question: `Retirer du stock : ${enumerer(action.produits)} ?`, oui: "Retirer" };
    case "oublier":
      return { question: `Oublier « ${action.fait} » ?`, oui: "Oublier" };
    case "supprimer_evenement":
      return { question: `Retirer « ${action.titre} » de l'agenda ?`, oui: "Retirer" };
    case "retenir":
      return { question: `J'ai remarqué : « ${action.fait} ». Je le retiens ?`, oui: "Retenir" };
    default:
      return { question: decrireAction(action), oui: "Oui" };
  }
}

const estTexte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const textes = (v: unknown): string[] => (Array.isArray(v) ? v.filter(estTexte) : []);
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourOuNul = (v: unknown): Jour | null => (typeof v === "string" && RE_JOUR.test(v) ? v : null);
const heureOuNul = (v: unknown): string | null => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);

/**
 * Relit les demandes d'outils renvoyées par le modèle ; ce qui est incomplet est ignoré.
 * Le modèle respecte les schémas, mais rien ne part dans les données sans être vérifié.
 */
export function lireActions(appels: readonly { nom: string; entree: unknown }[]): ActionJarvis[] {
  const actions: ActionJarvis[] = [];
  for (const { nom, entree } of appels) {
    const e = (entree ?? {}) as Record<string, unknown>;
    if (nom === "ajouter_courses" || nom === "cocher_courses") {
      const articles = textes(e.articles);
      if (articles.length) actions.push({ outil: nom, articles });
    } else if (nom === "ajouter_tache") {
      const echeance = jourOuNul(e.echeance);
      if (!estTexte(e.titre) || !echeance) continue;
      const f = e.frequence as { unite?: unknown; tous?: unknown } | null;
      const unite = f?.unite;
      const frequence: Recurrence | null =
        (unite === "jour" || unite === "semaine" || unite === "mois") && Number.isInteger(f?.tous) && (f?.tous as number) >= 1
          ? { unite, tous: f?.tous as number }
          : null;
      actions.push({ outil: nom, titre: e.titre, echeance, responsable: estTexte(e.responsable) ? e.responsable : null, frequence });
    } else if (nom === "tache_faite") {
      if (estTexte(e.titre)) actions.push({ outil: nom, titre: e.titre });
    } else if (nom === "attribuer_tache") {
      if (estTexte(e.titre)) actions.push({ outil: nom, titre: e.titre, responsable: estTexte(e.responsable) ? e.responsable : null });
    } else if (nom === "ajouter_au_stock") {
      const produits = (Array.isArray(e.produits) ? e.produits : [])
        .map((p) => (p ?? {}) as Record<string, unknown>)
        .filter((p) => estTexte(p.nom) && typeof p.lieu === "string" && p.lieu in LIEUX)
        .map((p) => ({ nom: p.nom as string, lieu: p.lieu as Lieu, peremption: jourOuNul(p.peremption) }));
      if (produits.length) actions.push({ outil: nom, produits });
    } else if (nom === "noter_pesee") {
      if (estTexte(e.animal) && typeof e.grammes === "number") actions.push({ outil: nom, animal: e.animal, grammes: e.grammes, jour: jourOuNul(e.jour) });
    } else if (nom === "regler_animal") {
      const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      const poidsEstime = nombre(e.poids_estime);
      const ration = nombre(e.ration);
      if (estTexte(e.animal) && (poidsEstime !== null || ration !== null)) actions.push({ outil: nom, animal: e.animal, poidsEstime, ration });
    } else if (nom === "noter_journal") {
      if (estTexte(e.animal) && typeof e.quoi === "string" && e.quoi in TYPES_EVENEMENT) {
        actions.push({ outil: nom, animal: e.animal, quoi: e.quoi as TypeEvenement, note: typeof e.note === "string" ? e.note : "", jour: jourOuNul(e.jour) });
      }
    } else if (nom === "noter_soin") {
      const date = jourOuNul(e.date);
      if (estTexte(e.animal) && typeof e.type === "string" && e.type in TYPES_SOIN && e.type !== "filtre" && date) {
        actions.push({ outil: nom, animal: e.animal, type: e.type as TypeSoin, libelle: estTexte(e.libelle) ? e.libelle : "", date, fait: e.fait === true });
      }
    } else if (nom === "ajouter_plante") {
      const plantes = textes(e.plantes);
      if (plantes.length) actions.push({ outil: nom, plantes, zone: estTexte(e.zone) ? e.zone : null });
    } else if (nom === "arrosage_fait") {
      actions.push({ outil: nom, zone: estTexte(e.zone) ? e.zone : null });
    } else if (nom === "modifier_tache") {
      const nouveauTitre = estTexte(e.nouveau_titre) ? e.nouveau_titre : null;
      const echeance = jourOuNul(e.echeance);
      if (estTexte(e.titre) && (nouveauTitre || echeance)) actions.push({ outil: nom, titre: e.titre, nouveauTitre, echeance });
    } else if (nom === "supprimer_tache") {
      if (estTexte(e.titre)) actions.push({ outil: nom, titre: e.titre });
    } else if (nom === "retirer_du_stock") {
      const produits = textes(e.produits);
      if (produits.length) actions.push({ outil: nom, produits });
    } else if (nom === "retenir") {
      if (estTexte(e.fait)) actions.push({ outil: nom, fait: e.fait.trim(), propose: e.propose !== false });
    } else if (nom === "oublier") {
      if (estTexte(e.fait)) actions.push({ outil: nom, fait: e.fait.trim() });
    } else if (nom === "ajouter_evenement") {
      const jour = jourOuNul(e.jour);
      if (!estTexte(e.titre) || !jour) continue;
      actions.push({
        outil: nom,
        titre: e.titre.trim(),
        jour,
        fin: jourOuNul(e.fin),
        heure: heureOuNul(e.heure),
        heureFin: heureOuNul(e.heure_fin),
        pour: estTexte(e.pour) ? e.pour : null,
        categorie: typeof e.categorie === "string" && e.categorie in CATEGORIES ? (e.categorie as Categorie) : "autre",
        repetition: typeof e.repetition === "string" && e.repetition in REPETITIONS ? (e.repetition as Repetition) : "aucune",
        lieu: estTexte(e.lieu) ? e.lieu : null,
      });
    } else if (nom === "supprimer_evenement") {
      if (estTexte(e.titre)) actions.push({ outil: nom, titre: e.titre, jour: jourOuNul(e.jour) });
    } else if (nom === "noter_depense") {
      const montant = typeof e.montant === "number" ? e.montant : NaN;
      if (!(montant > 0) || montant > 100_000) continue;
      const pot = typeof e.pot === "string" && e.pot in POTS ? (e.pot as Pot) : "courses";
      actions.push({
        outil: nom,
        montant,
        libelle: estTexte(e.libelle) ? e.libelle.trim() : "",
        magasin: estTexte(e.magasin) ? e.magasin.trim() : null,
        pot,
        jour: jourOuNul(e.jour),
        charge: estTexte(e.charge) ? e.charge.trim() : null,
        articles: (Array.isArray(e.articles) ? e.articles : [])
          .filter((a): a is { nom: string; prix: number } => !!a && typeof a === "object" && estTexte(a.nom) && typeof a.prix === "number" && a.prix > 0 && a.prix < 10_000)
          .slice(0, 80)
          .map((a) => ({ nom: a.nom.trim(), prix: a.prix })),
      });
    } else if (nom === "noter_taille") {
      const piece = PIECES.find((p) => p.id === e.piece)?.id;
      if (estTexte(e.pour) && estTexte(e.valeur) && piece) actions.push({ outil: nom, pour: e.pour.trim(), piece, valeur: e.valeur.trim() });
    } else if (nom === "noter_envie") {
      if (estTexte(e.pour) && estTexte(e.envie)) actions.push({ outil: nom, pour: e.pour.trim(), envie: e.envie.trim() });
    } else if (nom === "enregistrer_recette") {
      const recette = lireBrouillon(e, estTexte(e.lien) ? "lien" : "jarvis");
      if (recette) actions.push({ outil: nom, recette });
    } else if (nom === "noter_souhait") {
      if (estTexte(e.demande)) actions.push({ outil: nom, demande: e.demande.trim(), manque: estTexte(e.manque) ? e.manque.trim() : "" });
    }
  }
  return actions;
}

/**
 * Un document modifié par Jarvis, avec sa version d'avant pour pouvoir annuler (null : il vient
 * d'être créé). `supprime` : le document part ; Annuler le remet tel qu'il était (avant).
 */
export type Modification =
  | { collection: "elements"; avant: Element | null; apres: Element }
  | { collection: "taches"; avant: Tache | null; apres: Tache; supprime?: true }
  | { collection: "stock"; avant: Produit | null; apres: Produit; supprime?: true }
  | { collection: "animaux"; avant: Animal; apres: Animal }
  | { collection: "jardin"; avant: Zone; apres: Zone }
  | { collection: "memoire"; avant: Souvenir | null; apres: Souvenir; supprime?: true }
  | { collection: "retours"; avant: null; apres: RetourTest }
  | { collection: "agenda"; avant: Evenement | null; apres: Evenement; supprime?: true }
  | { collection: "budget"; avant: Depense | null; apres: Depense }
  | { collection: "menus"; avant: Recette | null; apres: Recette }
  | { collection: "vetements"; avant: DocVetement | null; apres: DocVetement };

export interface ResultatActions {
  modifications: Modification[];
  /** Ce qui a été fait, phrase par phrase : « Ajouté aux courses : lait, beurre. » */
  faits: string[];
  /** Ce qui n'a pas pu se faire, et pourquoi. */
  echecs: string[];
}

/** Trouve un nom dans une liste, sans tenir compte des majuscules ni des accents ; d'abord le nom exact, sinon le plus proche. */
function trouverParNom<T>(elements: readonly T[], nom: string, nomDe: (t: T) => string): T | undefined {
  const cle = normaliser(nom);
  return (
    elements.find((e) => normaliser(nomDe(e)) === cle) ??
    elements.find((e) => normaliser(nomDe(e)).includes(cle) || cle.includes(normaliser(nomDe(e))))
  );
}

const enumerer = (mots: string[]) =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/**
 * Applique les actions de Jarvis aux données du foyer. Ne touche à rien : renvoie les
 * documents à enregistrer, chacun avec sa version d'avant, et le récit de ce qui a été fait.
 */
export function appliquerActions(
  actions: readonly ActionJarvis[],
  donnees: DonneesFoyer,
  membreId: Id | null,
  aujourdhui: Jour,
  ctx: Contexte,
): ResultatActions {
  const modifications: Modification[] = [];
  const faits: string[] = [];
  const echecs: string[] = [];
  // Les éléments évoluent au fil des actions : « ajoute du lait » puis « coche le lait » se suivent.
  let elements = [...donnees.elements];
  let taches = [...donnees.taches];
  let animaux = [...donnees.animaux];
  let zones = [...(donnees.zones ?? [])];
  let produits = [...donnees.produits];
  let souvenirs = [...(donnees.souvenirs ?? [])];
  let evenements = evenementsDe(donnees.agenda ?? []).filter((e) => !e.source);
  let recettes = recettesDe(donnees.menus ?? []);
  const liste = listeCourses(donnees);

  /** Une zone modifiée : la version d'avant reste celle de sa première modification. */
  const modifierZone = (avant: Zone, apres: Zone) => {
    zones = zones.map((z) => (z.id === apres.id ? apres : z));
    const deja = modifications.find((m): m is Extract<Modification, { collection: "jardin" }> => m.collection === "jardin" && m.apres.id === apres.id);
    if (deja) deja.apres = apres;
    else modifications.push({ collection: "jardin", avant, apres });
  };
  /** La zone nommée ; sans nom, la seule zone du jardin. */
  const zoneNommee = (nom: string | null): Zone | string => {
    if (nom) return trouverParNom(zones, nom, (z) => z.nom) ?? `Je ne trouve pas la zone « ${nom} » au jardin.`;
    if (zones.length === 1) return zones[0];
    return zones.length === 0 ? "Crée d'abord une zone dans le Jardin (un pot, un bac)." : "Dans quelle zone du jardin ?";
  };

  for (const action of actions) {
    try {
      switch (action.outil) {
        case "ajouter_courses": {
          if (!liste) {
            echecs.push("Il n'y a pas encore de liste de courses.");
            break;
          }
          const ajoutes: string[] = [];
          const deja: string[] = [];
          for (const article of action.articles) {
            const surLaListe = elements.filter((e) => e.listeId === liste.id);
            const doublon = trouverDoublon(surLaListe, article);
            if (doublon) {
              deja.push(doublon.texte.toLowerCase());
              continue;
            }
            const element = nouvelElement(liste, article, membreId, ctx);
            elements.push(element);
            modifications.push({ collection: "elements", avant: null, apres: element });
            ajoutes.push(element.quantite ? `${element.texte.toLowerCase()} (${element.quantite})` : element.texte.toLowerCase());
          }
          if (ajoutes.length) faits.push(`Ajouté aux courses : ${enumerer(ajoutes)}.`);
          if (deja.length) faits.push(`Déjà sur la liste : ${enumerer(deja)}.`);
          break;
        }
        case "cocher_courses": {
          const coches: string[] = [];
          for (const article of action.articles) {
            const aPrendre = elements.filter((e) => e.listeId === liste?.id && !e.coche);
            const element = trouverParNom(aPrendre, analyserSaisie(article).texte, (e) => e.texte);
            if (!element) {
              echecs.push(`« ${article} » n'est pas sur la liste.`);
              continue;
            }
            const coche: Element = { ...element, coche: true, cocheLe: ctx.maintenant() };
            elements = elements.map((e) => (e.id === coche.id ? coche : e));
            modifications.push({ collection: "elements", avant: element, apres: coche });
            coches.push(element.texte.toLowerCase());
          }
          if (coches.length) faits.push(`Coché : ${enumerer(coches)}.`);
          break;
        }
        case "ajouter_tache": {
          const responsable = action.responsable ? trouverParNom(donnees.foyer.membres, action.responsable, (m) => m.prenom) : undefined;
          const tache = { ...nouvelleTache(action.titre, action.frequence, action.echeance, ctx, responsable?.id ?? null), creePar: membreId };
          taches.push(tache);
          modifications.push({ collection: "taches", avant: null, apres: tache });
          const qui = responsable ? `, pour ${responsable.prenom}` : "";
          faits.push(`Tâche ajoutée : ${tache.titre.toLowerCase()}, ${decrireEcheance(tache.echeance, aujourdhui)}${qui}.`);
          break;
        }
        case "tache_faite": {
          const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
          if (!tache) {
            echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
            break;
          }
          const faite = marquerFaite(tache, membreId, aujourdhui, ctx);
          taches = taches.map((t) => (t.id === faite.id ? faite : t));
          modifications.push({ collection: "taches", avant: tache, apres: faite });
          faits.push(
            faite.recurrence
              ? `C'est noté : ${tache.titre.toLowerCase()} est faite, prochaine fois ${decrireEcheance(faite.echeance, aujourdhui)}.`
              : `C'est noté : ${tache.titre.toLowerCase()} est faite.`,
          );
          break;
        }
        case "attribuer_tache": {
          const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
          if (!tache) {
            echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
            break;
          }
          const membre = action.responsable ? trouverParNom(donnees.foyer.membres, action.responsable, (m) => m.prenom) : undefined;
          if (action.responsable && !membre) {
            echecs.push(`Je ne connais personne nommé ${action.responsable}.`);
            break;
          }
          const confiee: Tache = { ...tache, responsable: membre?.id ?? null };
          taches = taches.map((t) => (t.id === confiee.id ? confiee : t));
          modifications.push({ collection: "taches", avant: tache, apres: confiee });
          faits.push(membre ? `${tache.titre} : pour ${membre.prenom}.` : `${tache.titre} : libre.`);
          break;
        }
        case "ajouter_au_stock": {
          const ranges: string[] = [];
          for (const p of action.produits) {
            // Sans date (un ticket de caisse), la durée habituelle du foyer, sinon celle que Kora connaît.
            const duree = p.peremption ? null : proposer(donnees.catalogue ?? [], p.nom)?.dureeJours;
            const peremption = p.peremption ?? (duree ? decaler(aujourdhui, { unite: "jour", tous: duree }) : null);
            const produit = nouveauProduit({ texte: p.nom, lieu: p.lieu, peremption }, membreId, ctx);
            modifications.push({ collection: "stock", avant: null, apres: produit });
            ranges.push(`${produit.nom.toLowerCase()} (${LIEUX[produit.lieu].toLowerCase()})`);
          }
          faits.push(`Rangé : ${enumerer(ranges)}.`);
          break;
        }
        case "noter_pesee":
        case "regler_animal":
        case "noter_journal":
        case "noter_soin": {
          const animal = trouverParNom(animaux, action.animal, (a) => a.nom);
          if (!animal) {
            echecs.push(`Je ne connais pas d'animal nommé ${action.animal}.`);
            break;
          }
          let apres: Animal;
          if (action.outil === "noter_pesee") {
            apres = ajouterPesee(animal, action.grammes, action.jour ?? aujourdhui, membreId, ctx);
            faits.push(`Pesée notée : ${animal.nom}, ${formaterPoids(Math.round(action.grammes))}${action.jour && action.jour !== aujourdhui ? ` le ${action.jour}` : ""}.`);
          } else if (action.outil === "regler_animal") {
            apres = reglerPoidsEtRation(animal, { ...(action.poidsEstime !== null ? { poidsEstime: action.poidsEstime } : {}), ...(action.ration !== null ? { ration: action.ration } : {}) }, aujourdhui);
            const ration = rationDuJour(apres, aujourdhui);
            faits.push(
              `${animal.nom} : ${action.poidsEstime !== null ? `environ ${formaterPoids(Math.round(action.poidsEstime))}` : "poids inchangé"}${ration ? `, ration ${ration.grammes} g par jour` : ""} (sans pesée au carnet).`,
            );
          } else if (action.outil === "noter_journal") {
            apres = noterEvenement(animal, action.quoi, action.jour ?? aujourdhui, action.note, membreId, ctx);
            faits.push(`Noté pour ${animal.nom} : ${TYPES_EVENEMENT[action.quoi].toLowerCase()}${action.note ? ` (${action.note})` : ""}.`);
          } else {
            apres = noterSoin(animal, action, ctx);
            if (apres === animal) break;
            faits.push(`Carnet de ${animal.nom} : ${apres.soins[apres.soins.length - 1].libelle.toLowerCase()}, ${action.fait ? "fait" : "prévu"} le ${action.date}.`);
          }
          animaux = animaux.map((a) => (a.id === apres.id ? apres : a));
          // Plusieurs notes sur le même animal dans une demande : la version d'avant reste la toute première.
          const deja = modifications.find(
            (m): m is Extract<Modification, { collection: "animaux" }> => m.collection === "animaux" && m.apres.id === animal.id,
          );
          if (deja) deja.apres = apres;
          else modifications.push({ collection: "animaux", avant: animal, apres });
          break;
        }
        case "ajouter_plante": {
          const zone = zoneNommee(action.zone);
          if (typeof zone === "string") {
            echecs.push(zone);
            break;
          }
          let apres = zone;
          for (const texte of action.plantes) apres = ajouterPlante(apres, nouvellePlante(texte, aujourdhui, membreId, ctx));
          modifierZone(zone, apres);
          faits.push(`Planté dans ${zone.nom.toLowerCase()} : ${enumerer(action.plantes.map((p) => p.toLowerCase()))}.`);
          break;
        }
        case "arrosage_fait": {
          // Sans zone nommée : tout le jardin a été arrosé.
          const cibles = action.zone ? [zoneNommee(action.zone)] : zones.filter((z) => z.plantes.length > 0);
          const arrosees: string[] = [];
          for (const zone of cibles) {
            if (typeof zone === "string") {
              echecs.push(zone);
              continue;
            }
            modifierZone(zone, arroser(zone, aujourdhui, membreId));
            arrosees.push(zone.nom.toLowerCase());
          }
          if (arrosees.length) faits.push(`Arrosage noté : ${enumerer(arrosees)}.`);
          else if (!action.zone) echecs.push("Il n'y a encore rien à arroser au jardin.");
          break;
        }
        case "modifier_tache": {
          const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
          if (!tache) {
            echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
            break;
          }
          const modifiee: Tache = { ...tache, titre: action.nouveauTitre?.trim() || tache.titre, echeance: action.echeance ?? tache.echeance };
          taches = taches.map((t) => (t.id === modifiee.id ? modifiee : t));
          modifications.push({ collection: "taches", avant: tache, apres: modifiee });
          faits.push(`Tâche modifiée : ${modifiee.titre.toLowerCase()}, ${decrireEcheance(modifiee.echeance, aujourdhui)}.`);
          break;
        }
        case "supprimer_tache": {
          const tache = trouverParNom(taches, action.titre, (t) => t.titre);
          if (!tache) {
            echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
            break;
          }
          taches = taches.filter((t) => t.id !== tache.id);
          modifications.push({ collection: "taches", avant: tache, apres: tache, supprime: true });
          faits.push(`Tâche supprimée : ${tache.titre.toLowerCase()}.`);
          break;
        }
        case "retirer_du_stock": {
          const retires: string[] = [];
          for (const nom of action.produits) {
            const produit = trouverParNom(produits, nom, (p) => p.nom);
            if (!produit) {
              echecs.push(`« ${nom} » n'est pas dans le stock.`);
              continue;
            }
            produits = produits.filter((p) => p.id !== produit.id);
            modifications.push({ collection: "stock", avant: produit, apres: produit, supprime: true });
            retires.push(produit.nom.toLowerCase());
          }
          if (retires.length) faits.push(`Retiré du stock : ${enumerer(retires)}.`);
          break;
        }
        case "retenir": {
          const deja = souvenirSemblable(souvenirs, action.fait);
          if (deja) {
            faits.push(`Je le savais déjà : ${deja.texte.charAt(0).toLowerCase()}${deja.texte.slice(1)}.`);
            break;
          }
          const souvenir = nouveauSouvenir(action.fait, action.propose ? "remarque" : "demande", membreId, ctx);
          souvenirs.push(souvenir);
          modifications.push({ collection: "memoire", avant: null, apres: souvenir });
          faits.push(`Retenu : ${souvenir.texte.charAt(0).toLowerCase()}${souvenir.texte.slice(1)}.`);
          break;
        }
        case "oublier": {
          const souvenir = trouverSouvenir(souvenirs, action.fait);
          if (!souvenir) {
            echecs.push(`Je n'avais pas retenu « ${action.fait} ».`);
            break;
          }
          souvenirs = souvenirs.filter((s) => s.id !== souvenir.id);
          modifications.push({ collection: "memoire", avant: souvenir, apres: souvenir, supprime: true });
          faits.push(`Oublié : ${souvenir.texte.charAt(0).toLowerCase()}${souvenir.texte.slice(1)}.`);
          break;
        }
        case "ajouter_evenement": {
          const membre = action.pour ? trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom) : undefined;
          const doublon = evenements.find((x) => x.jour === action.jour && normaliser(x.titre) === normaliser(action.titre));
          if (doublon) {
            faits.push(`Déjà dans l'agenda : ${doublon.titre.toLowerCase()}, ${decrireJour(doublon.jour, aujourdhui).toLowerCase()}.`);
            break;
          }
          const evenement = preparerEvenement({ ...action, pour: membre?.id ?? null }, membreId, ctx);
          evenements.push(evenement);
          modifications.push({ collection: "agenda", avant: null, apres: evenement });
          const heure = evenement.heure ? ` à ${evenement.heure}` : "";
          const qui = membre ? `, pour ${membre.prenom}` : "";
          faits.push(`Dans l'agenda : ${evenement.titre.toLowerCase()}, ${decrireJour(evenement.jour, aujourdhui).toLowerCase()}${heure}${qui}.`);
          break;
        }
        case "supprimer_evenement": {
          const candidats = action.jour ? evenements.filter((x) => x.jour === action.jour) : evenements;
          const evenement = trouverParNom(candidats, action.titre, (x) => x.titre);
          if (!evenement) {
            echecs.push(`Je ne trouve pas « ${action.titre} » dans l'agenda.`);
            break;
          }
          evenements = evenements.filter((x) => x.id !== evenement.id);
          modifications.push({ collection: "agenda", avant: evenement, apres: evenement, supprime: true });
          faits.push(`Retiré de l'agenda : ${evenement.titre.toLowerCase()}.`);
          break;
        }
        case "noter_depense": {
          const plan = planDe(donnees.budget ?? []);
          if (!plan) {
            echecs.push("Le budget n'est pas encore en place : ouvre la page Budget.");
            break;
          }
          const jour = action.jour ?? aujourdhui;
          const poste = action.charge ? trouverParNom(plan.postes.filter((p) => p.qui === null), action.charge, (p) => p.libelle) : undefined;
          let depense: Depense;
          if (poste) {
            const facture = facturesAPayer(plan, donnees.budget ?? [], jour, 45).find((f) => f.poste.id === poste.id);
            depense = facture
              ? { ...payerFacture(facture, jour, membreId, ctx, "jarvis"), montant: Math.round(action.montant * 100) / 100 }
              : nouvelleDepense({ montant: action.montant, pot: poste.pot && poste.pot !== "commun" ? poste.pot : "factures", libelle: poste.libelle, jour, posteId: poste.id, source: "jarvis" }, membreId, ctx);
          } else {
            depense = nouvelleDepense(
              { montant: action.montant, pot: action.pot, libelle: action.libelle || action.magasin || POTS[action.pot].nom, magasin: action.magasin, jour, source: "jarvis", articles: action.articles },
              membreId,
              ctx,
            );
          }
          // Déjà payé par Apple Pay ce jour-là, du même montant : le ticket complète ce paiement.
          const complete = completerPaiement(depense, donnees.budget ?? []);
          if (complete) {
            const avant = (donnees.budget ?? []).find((d): d is Depense => d.genre === "depense" && d.id === complete.id) ?? null;
            modifications.push({ collection: "budget", avant, apres: complete });
            faits.push(`Ajouté au paiement Apple Pay de ${formaterMontantCourt(complete.montant)} (${(complete.magasin ?? complete.libelle).toLowerCase()}).`);
            break;
          }
          modifications.push({ collection: "budget", avant: null, apres: depense });
          faits.push(`Noté au budget : ${depense.libelle.toLowerCase()}, ${formaterMontantCourt(depense.montant)} (${POTS[depense.pot].nom.toLowerCase()}).`);
          break;
        }
        case "enregistrer_recette": {
          const { recette, avant } = apprendreRecette(recettes, action.recette, ctx);
          recettes = [...recettes.filter((r) => r.id !== recette.id), recette];
          const deja = modifications.find((m): m is Extract<Modification, { collection: "menus" }> => m.collection === "menus" && m.apres.id === recette.id);
          if (deja) deja.apres = recette;
          else modifications.push({ collection: "menus", avant, apres: recette });
          faits.push(avant ? `« ${recette.titre} » était déjà dans vos recettes : elle monte dans la liste.` : `« ${recette.titre} » rangée dans vos recettes.`);
          break;
        }
        case "noter_taille": {
          const personne = trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom);
          if (!personne) {
            echecs.push(`Je ne connais pas « ${action.pour} » dans le foyer.`);
            break;
          }
          const avant = tailleDe(donnees.vetements ?? [], personne.id, action.piece);
          const apres = poserTaille(personne.id, action.piece, action.valeur, ctx);
          if (!apres) break;
          modifications.push({ collection: "vetements", avant, apres });
          faits.push(`Taille notée pour ${personne.prenom} : ${PIECES.find((p) => p.id === action.piece)!.nom.toLowerCase()} ${apres.valeur}.`);
          break;
        }
        case "noter_envie": {
          const personne = trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom);
          if (!personne) {
            echecs.push(`Je ne connais pas « ${action.pour} » dans le foyer.`);
            break;
          }
          const envie = nouvelleEnvie(action.envie, personne.id, membreId, ctx);
          if (!envie) break;
          modifications.push({ collection: "vetements", avant: null, apres: envie });
          faits.push(`Envie notée pour ${personne.prenom} : ${envie.titre.toLowerCase()}${envie.prix !== null ? ` (${formaterMontantCourt(envie.prix)})` : ""}.`);
          break;
        }
        case "noter_souhait": {
          const texte = `Souhait pour Jarvis : ${action.demande}${action.manque ? ` (il faudrait : ${action.manque})` : ""}`;
          const deja = (donnees.retours ?? []).some((r) => !r.regleLe && normaliser(r.texte) === normaliser(texte));
          if (deja) {
            faits.push("Ce souhait était déjà noté pour Claude.");
            break;
          }
          const retour = nouveauRetour({ texte, genre: "idee", ecran: "Jarvis", version: donnees.version ?? "", auteur: membreId }, ctx);
          modifications.push({ collection: "retours", avant: null, apres: retour });
          faits.push("Souhait noté pour Claude.");
          break;
        }
      }
    } catch (e) {
      echecs.push(e instanceof Error ? e.message : "Cette action n'a pas pu se faire.");
    }
  }
  return { modifications, faits, echecs };
}

/** Une action proposée, en une ligne, pour la valider ou l'écarter (conseil du dimanche). */
export function decrireAction(action: ActionJarvis): string {
  switch (action.outil) {
    case "ajouter_courses":
      return `Courses : ${enumerer(action.articles)}`;
    case "cocher_courses":
      return `Cocher : ${enumerer(action.articles)}`;
    case "ajouter_tache":
      return `Nouvelle tâche : ${action.titre}, le ${action.echeance}${action.responsable ? `, pour ${action.responsable}` : ""}`;
    case "tache_faite":
      return `Marquer faite : ${action.titre}`;
    case "attribuer_tache":
      return action.responsable ? `${action.titre} → ${action.responsable}` : `${action.titre} → libre`;
    case "ajouter_au_stock":
      return `Ranger : ${enumerer(action.produits.map((p) => p.nom))}`;
    case "noter_pesee":
      return `Pesée de ${action.animal} : ${action.grammes} g`;
    case "regler_animal":
      return `${action.animal} : ${[action.poidsEstime !== null ? `environ ${action.poidsEstime} g` : "", action.ration !== null ? `ration ${action.ration} g par jour` : ""].filter(Boolean).join(", ")}`;
    case "noter_journal":
      return `${action.animal} : ${TYPES_EVENEMENT[action.quoi].toLowerCase()}${action.note ? ` (${action.note})` : ""}`;
    case "noter_soin":
      return `Carnet de ${action.animal} : ${action.libelle || TYPES_SOIN[action.type]}, ${action.fait ? "fait" : "prévu"} le ${action.date}`;
    case "ajouter_plante":
      return `Planter : ${enumerer(action.plantes)}${action.zone ? ` (${action.zone})` : ""}`;
    case "arrosage_fait":
      return action.zone ? `Arrosé : ${action.zone}` : "Arrosé : tout le jardin";
    case "modifier_tache":
      return `Modifier : ${action.titre}${action.nouveauTitre ? ` → ${action.nouveauTitre}` : ""}${action.echeance ? `, le ${action.echeance}` : ""}`;
    case "supprimer_tache":
      return `Supprimer la tâche : ${action.titre}`;
    case "retirer_du_stock":
      return `Retirer du stock : ${enumerer(action.produits)}`;
    case "retenir":
      return `Retenir : ${action.fait}`;
    case "oublier":
      return `Oublier : ${action.fait}`;
    case "noter_souhait":
      return `Souhait pour Claude : ${action.demande}`;
    case "enregistrer_recette":
      return `Recette : ${action.recette.titre} (${SOURCES_RECETTE[action.recette.source].toLowerCase()})`;
    case "ajouter_evenement":
      return `Agenda : ${action.titre}, le ${action.jour}${action.heure ? ` à ${action.heure}` : ""}${action.pour ? `, pour ${action.pour}` : ""}`;
    case "supprimer_evenement":
      return `Retirer de l'agenda : ${action.titre}`;
    case "noter_depense":
      return `Budget : ${action.charge ?? action.libelle ?? action.magasin ?? ""} ${formaterMontantCourt(action.montant)}`;
    case "noter_taille":
      return `Taille de ${action.pour} : ${PIECES.find((p) => p.id === action.piece)!.nom.toLowerCase()} ${action.valeur}`;
    case "noter_envie":
      return `Envie de ${action.pour} : ${lireEnvie(action.envie).titre}`;
  }
}

/** Ce qui remet chaque document dans son état d'avant, dans l'ordre inverse. */
export function annulation(modifications: readonly Modification[]): { collection: Modification["collection"]; id: Id; remettre: unknown | null }[] {
  const vus = new Set<string>();
  const resultat: { collection: Modification["collection"]; id: Id; remettre: unknown | null }[] = [];
  // La version d'avant d'un document est celle de sa première modification.
  for (const m of modifications) {
    const cle = `${m.collection}/${m.apres.id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push({ collection: m.collection, id: m.apres.id, remettre: m.avant });
  }
  return resultat.reverse();
}
