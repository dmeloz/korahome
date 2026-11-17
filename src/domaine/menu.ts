import { paiementsAClasser } from "./paiements";
import { compterAPrendre, listesVisibles } from "./listes";
import { compterDues } from "./taches";
import type { DocBudget } from "./budget";
import type { Element, Id, Jour, Liste, Tache } from "./types";

// Le menu latéral de l'iPhone (0.1.18, maquette validée par Melo le 17 novembre 2026 ; version
// minimaliste en 0.1.19, plus près de sa référence) : un panneau étroit, trois sections en petites
// capitales, une icône et un mot par ligne. Espaces : les cinq ; Raccourcis : ce qu'on ouvre le
// plus ; Général : Réglages. Les autres pages restent à un toucher depuis leur espace.
// Équivalent natif : une NavigationSplitView repliée en barre latérale (sidebar) sur iPhone.

export type EspaceMenu = "aujourdhui" | "chef" | "maison" | "taches" | "budget" | "reglages";

/** Où mène une ligne, et où l'on est : un espace, ou l'une de ses pages (`onglet`). */
export interface LieuMenu {
  espace: EspaceMenu;
  onglet?: string;
}

export interface EntreeMenu extends LieuMenu {
  libelle: string;
}

export interface SectionMenu {
  titre: string;
  entrees: readonly EntreeMenu[];
}

export const SECTIONS_MENU: readonly SectionMenu[] = [
  {
    titre: "Espaces",
    entrees: [
      { libelle: "Aujourd'hui", espace: "aujourdhui" },
      { libelle: "Cuisine", espace: "chef" },
      { libelle: "Maison", espace: "maison" },
      { libelle: "Organisation", espace: "taches" },
      { libelle: "Budget", espace: "budget" },
    ],
  },
  {
    titre: "Raccourcis",
    entrees: [
      { libelle: "Courses", espace: "chef", onglet: "courses" },
      { libelle: "Tâches", espace: "taches", onglet: "taches" },
      { libelle: "Agenda", espace: "taches", onglet: "agenda" },
    ],
  },
  { titre: "Général", entrees: [{ libelle: "Réglages", espace: "reglages" }] },
];

/** La clé d'une ligne du menu, pour ses pastilles et la ligne active. */
export const cleMenu = (l: LieuMenu) => (l.onglet ? `${l.espace}:${l.onglet}` : l.espace);

/**
 * La ligne en laiton : celle de la page ouverte, sinon celle de son espace (sur Menus ou Frigo,
 * c'est Cuisine qui s'allume). Hors des espaces (une liste, Chez nous) : aucune.
 */
export function cleActive(ici: LieuMenu | null): string | null {
  if (!ici) return null;
  const toutes = SECTIONS_MENU.flatMap((s) => s.entrees.map(cleMenu));
  const exacte = cleMenu(ici);
  return toutes.includes(exacte) ? exacte : toutes.includes(ici.espace) ? ici.espace : null;
}

/**
 * Les pastilles du menu : ce qui attend, sans rien inventer. Les articles de la liste de courses
 * (celle qu'on voit sur ce téléphone), les tâches dues aujourd'hui ou en retard (comme la page
 * Tâches les met devant), les paiements Apple Pay à classer (sur Budget). Zéro : pas de pastille.
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
    [cleMenu({ espace: "chef", onglet: "courses" })]: courses ? compterAPrendre(courses, [...e.elements]) : 0,
    [cleMenu({ espace: "taches", onglet: "taches" })]: dues.aujourdhui + dues.enRetard,
    [cleMenu({ espace: "budget" })]: paiementsAClasser(e.budget).length,
  };
  return Object.fromEntries(Object.entries(comptes).filter(([, n]) => n > 0));
}

/** « 120 » au-delà de 99 n'apprend rien de plus et déborde de la pastille. */
export const pastille = (n: number) => (n > 99 ? "99+" : String(n));
