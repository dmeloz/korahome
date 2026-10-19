// Le thème de ce téléphone : Auto (comme l'iPhone), Sombre laiton ou Clair doux.
// Propre à chaque téléphone, jamais partagé : Melo peut rester en sombre et Sarah en clair.

export type Theme = "auto" | "sombre" | "clair";

export const THEMES: readonly { id: Theme; libelle: string; detail: string }[] = [
  { id: "auto", libelle: "Auto", detail: "Comme l'iPhone, sombre le soir s'il l'est" },
  { id: "sombre", libelle: "Sombre", detail: "Graphite et laiton" },
  { id: "clair", libelle: "Clair doux", detail: "Papier chaud et laiton" },
];

const CLE = "korahome.theme";

export function lireTheme(): Theme {
  try {
    const t = localStorage.getItem(CLE);
    return t === "sombre" || t === "clair" ? t : "auto";
  } catch {
    return "auto";
  }
}

/** La couleur de la barre d'état de l'iPhone suit le fond du thème. */
const FOND = { sombre: "#0F1211", clair: "#F4EFE6" } as const;

export function appliquerTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme === "auto") delete html.dataset.theme;
  else html.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const clair = meta.media.includes("light");
    meta.content = theme === "auto" ? (clair ? FOND.clair : FOND.sombre) : FOND[theme];
  }
}

export function choisirTheme(theme: Theme): void {
  try {
    if (theme === "auto") localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, theme);
  } catch {
    // Stockage indisponible : le thème vaut pour cette visite.
  }
  appliquerTheme(theme);
}
