import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou des styles (Kora 0.1.6). Deux défauts sont passés trois fois sans qu'aucun test ne les voie :
 * un même nom de classe donné à deux choses (les graphiques de l'Analyse écrasés par les petites barres
 * de « Tes dépenses »), et des classes encore écrites dans un écran dont la règle était partie avec un
 * fichier supprimé (la carte qui propose, à la refonte 0.1). Ces deux tests les arrêtent.
 */
const STYLES = new URL("./", import.meta.url);
const UI = new URL("../ui/", import.meta.url);

const feuilles = [...readFileSync(new URL("index.css", STYLES), "utf8").matchAll(/@import\s+"\.\/([^"]+)"/g)].map((m) => m[1]);
const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

interface Regle {
  selecteurs: string[];
  ou: string;
  /** Hors de tout @media, @supports ou @keyframes. */
  racine: boolean;
  proprietes: Record<string, string>;
}

function reglesDe(fichier: string): Regle[] {
  const css = sansCommentaires(readFileSync(new URL(fichier, STYLES), "utf8"));
  const regles: Regle[] = [];
  const pile: { selecteur: string; debut: number }[] = [];
  let debut = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      pile.push({ selecteur: css.slice(debut, i).trim(), debut: i + 1 });
      debut = i + 1;
    } else if (c === "}") {
      const bloc = pile.pop();
      if (bloc && !bloc.selecteur.startsWith("@")) {
        const proprietes: Record<string, string> = {};
        for (const d of css.slice(bloc.debut, i).split(";")) {
          const deux = d.indexOf(":");
          if (deux > 0) proprietes[d.slice(0, deux).trim()] = d.slice(deux + 1).trim().replace(/\s+/g, " ");
        }
        regles.push({
          selecteurs: bloc.selecteur.split(",").map((s) => s.trim()),
          ou: `${fichier}:${css.slice(0, bloc.debut).split("\n").length}`,
          racine: pile.length === 0,
          proprietes,
        });
      }
      debut = i + 1;
    } else if (c === ";") debut = i + 1;
  }
  return regles;
}

const regles = feuilles.flatMap(reglesDe);

function fichiersDe(dossier: URL): URL[] {
  return readdirSync(dossier).flatMap((nom) => {
    const u = new URL(nom, dossier);
    if (statSync(u).isDirectory()) return fichiersDe(new URL(`${nom}/`, dossier));
    return /\.tsx?$/.test(nom) && !nom.includes(".test.") ? [u] : [];
  });
}

/**
 * Les noms de page ou de pièce posés comme repères, sans style à eux. Une classe nouvelle sans règle
 * n'a rien à faire ici : ou bien elle a sa règle, ou bien on ne l'écrit pas.
 */
const REPERES = new Set([
  "bilan", "conseil", "budget", "cuisine", "courses-c", "maison", "organisation", "taches-c", "feuille-fiche-semaine",
  "fee-nuit", "fee-geste", "maison-rangements", "mitsu", "nos-mots", "rappels", "partage", "recettes-photo",
  "feuille-recette", "page-stock", "flotte", "ailes", "journal-tael", "fin",
]);

describe("les styles", () => {
  it("toutes les feuilles du dossier sont importées par index.css", () => {
    const presentes = readdirSync(STYLES).filter((f) => f.endsWith(".css") && f !== "index.css").sort();
    expect([...feuilles].sort()).toEqual(presentes);
  });

  it("une classe seule ne règle pas deux fois la même propriété", () => {
    // « .nom { … } » seul et hors @media : la règle écrite plus bas gagne toujours sur celle du haut.
    // Deux valeurs pour la même propriété, c'est donc un nom donné à deux choses, ou une valeur morte.
    const seules = new Map<string, Regle[]>();
    for (const r of regles) {
      if (!r.racine || r.selecteurs.length !== 1 || !/^\.[\w-]+$/.test(r.selecteurs[0])) continue;
      seules.set(r.selecteurs[0], [...(seules.get(r.selecteurs[0]) ?? []), r]);
    }
    const doublons: string[] = [];
    for (const [classe, liste] of seules) {
      for (let a = 0; a < liste.length; a++) {
        for (let b = a + 1; b < liste.length; b++) {
          const communes = Object.keys(liste[a].proprietes).filter((p) => p in liste[b].proprietes);
          if (communes.length) doublons.push(`${classe} : ${communes.join(", ")} (${liste[a].ou} puis ${liste[b].ou})`);
        }
      }
    }
    expect(doublons).toEqual([]);
  });

  it("chaque classe écrite dans un écran a sa règle", () => {
    const definies = new Set<string>();
    for (const r of regles) for (const s of r.selecteurs) for (const m of s.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) definies.add(m[1]);
    const prefixe = (debut: string) => [...definies].some((c) => c.startsWith(debut));

    const orphelines: string[] = [];
    for (const fichier of fichiersDe(UI)) {
      const source = readFileSync(fichier, "utf8");
      // className="a b", className={`a ${x} b-${y}`} et les props « classe » des pièces.
      for (const m of source.matchAll(/(?:className|classe)\s*[=:]\s*(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        const brut = (m[1] ?? m[2]).replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, "\u0000");
        for (const mot of brut.split(/\s+/)) {
          if (!mot || mot.startsWith("\u0000")) continue;
          const coupe = mot.indexOf("\u0000");
          const nom = coupe < 0 ? mot : mot.slice(0, coupe);
          if (!/^[a-zA-Z][\w-]*$/.test(nom)) continue;
          const connue = coupe < 0 ? definies.has(nom) || REPERES.has(nom) : prefixe(nom);
          if (!connue) orphelines.push(`${nom}${coupe < 0 ? "" : "…"} (${fichier.pathname.split("/src/")[1]})`);
        }
      }
    }
    expect([...new Set(orphelines)]).toEqual([]);
  });

  it("un repère sans style reste sans style", () => {
    // S'il reçoit une règle un jour, il sort de la liste : elle ne doit pas grossir de noms oubliés.
    const definies = new Set(regles.flatMap((r) => r.selecteurs.flatMap((s) => [...s.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))));
    expect([...REPERES].filter((c) => definies.has(c))).toEqual([]);
  });
});
