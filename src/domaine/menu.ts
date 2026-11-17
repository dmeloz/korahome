import { paiementsAClasser } from "./paiements";
import { compterAPrendre, listesVisibles } from "./listes";
import { compterDues } from "./taches";
import type { DocBudget } from "./budget";
import type { Element, Id, Jour, Liste, Tache } from "./types";

// Le menu latéral de l'iPhone (0.1.18, maquette validée par Melo le 17 novembre 2026) : tout
// Kora d'un coup, chaque espace en petites capitales et ses pages dessous, avec ce qui attend.
// Le titre d'un espace ouvre sa page de cartes, une ligne ouvre la page de l'espace.
// Équivalent natif : une NavigationSplitView repliée en barre latérale (sidebar) sur iPhone.

export type EspaceMenu = "chef" | "maison" | "taches" | "budget";

export interface EntreeMenu {
  libelle: string;
  /** L'onglet de l'espace qu'elle ouvre (`{ nom: "module", id, onglet }`). */
  onglet: string;
}

export interface SectionMenu {
  espace: EspaceMenu;
  titre: string;
  entrees: readonly EntreeMenu[];
}

export const SECTIONS_MENU: readonly SectionMenu[] = [
  { espace: "chef", titre: "Cuisine", entrees: [{ libelle: "Courses", onglet: "courses" }, { libelle: "Menus", onglet: "semaine" }, { libelle: "Recettes", onglet: "recettes" }, { libelle: "Frigo", onglet: "frigo" }] },
  { espace: "maison", titre: "Maison", entrees: [{ libelle: "Entretien", onglet: "entretien" }, { libelle: "Mitsu", onglet: "mitsu" }, { libelle: "Jardin", onglet: "jardin" }, { libelle: "Vêtements", onglet: "vetements" }] },
  { espace: "taches", titre: "Organisation", entrees: [{ libelle: "Tâches", onglet: "taches" }, { libelle: "Agenda", onglet: "agenda" }, { libelle: "Administratif", onglet: "administratif" }] },
  { espace: "budget", titre: "Budget", entrees: [{ libelle: "Ce mois", onglet: "mois" }, { libelle: "Dépenses", onglet: "depenses" }, { libelle: "Charges", onglet: "charges" }] },
];

/** La clé d'une ligne du menu, pour ses pastilles. */
export const cleMenu = (espace: EspaceMenu, onglet: string) => `${espace}:${onglet}`;

/**
 * Les pastilles du menu : ce qui attend, sans rien inventer. Les articles de la liste de courses
 * (celle qu'on voit sur ce téléphone), les tâches dues aujourd'hui ou en retard (comme la page
 * Tâches les met devant), les paiements Apple Pay à classer. Zéro : pas de pastille.
 */
export function comptesDuMenu(e: {
  listes: readonly Liste[];
  elements: readonly Element[];
  taches: readonly Tache[];
  budget: readonly DocBudget[];
  membreId: Id | null;
  aujourdhui: Jour;
}): Record<string, number> {
  const courses = listesVisibles(e.listes, e.membreId).find((l) => l.type === "courses");
  const dues = compterDues([...e.taches], e.aujourdhui);
  const comptes: Record<string, number> = {
    [cleMenu("chef", "courses")]: courses ? compterAPrendre(courses, [...e.elements]) : 0,
    [cleMenu("taches", "taches")]: dues.aujourdhui + dues.enRetard,
    [cleMenu("budget", "depenses")]: paiementsAClasser(e.budget).length,
  };
  return Object.fromEntries(Object.entries(comptes).filter(([, n]) => n > 0));
}

/** « 120 » au-delà de 99 n'apprend rien de plus et déborde de la pastille. */
export const pastille = (n: number) => (n > 99 ? "99+" : String(n));
