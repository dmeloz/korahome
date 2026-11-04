import { CLES, ecrireTexte, lireTexte } from "./stockageLocal";

// L'apparence de ce téléphone (Kora 0.1, choix de Melo du 4 novembre 2026) : Sombre, graphite et
// laiton, par défaut ; ou « Suit l'iPhone », clair le jour si l'iPhone l'est. Propre à chaque
// téléphone, jamais partagé.

export type Theme = "sombre" | "auto";

export const THEMES: readonly { id: Theme; libelle: string; detail: string }[] = [
  { id: "sombre", libelle: "Sombre", detail: "Graphite et laiton, toujours" },
  { id: "auto", libelle: "Suit l'iPhone", detail: "Clair le jour si l'iPhone l'est" },
];

/** Le réglage gardé ; « clair » des anciennes versions compte comme « Suit l'iPhone ». */
export function lireTheme(): Theme {
  const t = lireTexte(CLES.theme);
  return t === "auto" || t === "clair" ? "auto" : "sombre";
}

/** La couleur de la barre d'état de l'iPhone suit le fond du thème. */
const FOND = { sombre: "#0F1012", clair: "#F3F1EC" } as const;

export function appliquerTheme(theme: Theme): void {
  const html = document.documentElement;
  html.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const clair = meta.media.includes("light");
    meta.content = theme === "auto" && clair ? FOND.clair : FOND.sombre;
  }
}

export function choisirTheme(theme: Theme): void {
  // Stockage indisponible : le thème vaut pour cette visite.
  ecrireTexte(CLES.theme, theme);
  appliquerTheme(theme);
}
