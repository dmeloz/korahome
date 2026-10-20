import { decrireJour, type Evenement } from "./agenda";
import type { Zone } from "./jardin";
import type { Souvenir } from "./memoire";
import type { Animal } from "./mitsu";
import { decrirePeremption, LIEUX, type Produit } from "./stock";
import type { WidgetId } from "./tableauDeBord";
import { decrireEcheance, estTerminee } from "./taches";
import type { Element, Jour, Liste, Tache } from "./types";
import { sansAccents } from "./texte";

// Chercher partout depuis l'accueil (on tire la page vers le bas) : un article, un
// rendez-vous, un produit, un vaccin de Mitsu, un numéro retenu par Jarvis.
// Les accents et les majuscules ne comptent pas ; chaque mot tapé doit se retrouver.

export type OuRecherche = { type: "module"; id: WidgetId } | { type: "liste"; id: string } | { type: "memoire" };

export interface Trouvaille {
  cle: string;
  titre: string;
  detail: string;
  section: string;
  ou: OuRecherche;
}

export interface DonneesRecherche {
  listes: readonly Liste[];
  elements: readonly Element[];
  taches: readonly Tache[];
  evenements: readonly Evenement[];
  produits: readonly Produit[];
  animaux: readonly Animal[];
  zones: readonly Zone[];
  souvenirs: readonly Souvenir[];
  aujourdhui: Jour;
}

export const normaliserRecherche = (t: string) =>
  sansAccents(t).toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();

/** Chaque mot de la recherche commence un mot du texte : « den » trouve « Dentiste ». */
export function correspond(texte: string, recherche: string): boolean {
  const mots = normaliserRecherche(recherche).split(" ").filter(Boolean);
  if (mots.length === 0) return false;
  const cible = ` ${normaliserRecherche(texte).replace(/[^a-z0-9]+/g, " ")}`;
  return mots.every((m) => cible.includes(` ${m}`));
}

/** Au plus tant de résultats par section, pour garder la feuille lisible. */
const PAR_SECTION = 6;

export function rechercher(d: DonneesRecherche, recherche: string): Trouvaille[] {
  if (normaliserRecherche(recherche).length < 2) return [];
  const sections: Trouvaille[][] = [];
  const nomListe = new Map(d.listes.map((l) => [l.id, l]));

  sections.push(
    d.elements
      .filter((e) => correspond(e.texte, recherche))
      .sort((a, b) => Number(a.coche) - Number(b.coche))
      .map((e) => {
        const liste = nomListe.get(e.listeId);
        const courses = liste?.type === "courses";
        return {
          cle: `element-${e.id}`,
          titre: e.quantite ? `${e.texte} · ${e.quantite}` : e.texte,
          detail: `${liste?.nom ?? "Liste"}${e.coche ? ", déjà pris" : ""}`,
          section: "Listes",
          ou: courses ? ({ type: "module", id: "courses" } as const) : ({ type: "liste", id: e.listeId } as const),
        };
      }),
  );

  sections.push(
    d.evenements
      .filter((e) => correspond(`${e.titre} ${e.lieu ?? ""} ${e.note ?? ""}`, recherche))
      .sort((a, b) => Math.abs(Date.parse(a.jour) - Date.parse(d.aujourdhui)) - Math.abs(Date.parse(b.jour) - Date.parse(d.aujourdhui)))
      .map((e) => ({
        cle: `agenda-${e.id}`,
        titre: e.titre,
        detail: `${decrireJour(e.jour, d.aujourdhui)}${e.heure ? `, ${e.heure}` : ""}${e.lieu ? ` · ${e.lieu}` : ""}`,
        section: "Agenda",
        ou: { type: "module", id: "agenda" } as const,
      })),
  );

  sections.push(
    d.taches
      .filter((t) => correspond(t.titre, recherche))
      .map((t) => ({
        cle: `tache-${t.id}`,
        titre: t.titre,
        detail: estTerminee(t) ? "faite" : decrireEcheance(t.echeance, d.aujourdhui),
        section: t.categorie === "entretien" ? "Entretien" : "Tâches",
        ou: { type: "module", id: t.categorie === "entretien" ? "entretien" : "taches" } as const,
      })),
  );

  sections.push(
    d.produits
      .filter((p) => correspond(p.nom, recherche))
      .map((p) => ({
        cle: `stock-${p.id}`,
        titre: p.quantite ? `${p.nom} · ${p.quantite}` : p.nom,
        detail: [LIEUX[p.lieu], decrirePeremption(p, d.aujourdhui)].filter(Boolean).join(", "),
        section: "Frigo et placards",
        ou: { type: "module", id: "stock" } as const,
      })),
  );

  sections.push(
    d.animaux.flatMap((a) => [
      ...a.soins
        .filter((s) => correspond(`${s.libelle} ${a.nom}`, recherche))
        .sort((x, y) => y.date.localeCompare(x.date))
        .map((s) => ({
          cle: `soin-${s.id}`,
          titre: s.libelle,
          detail: `${a.nom}, ${s.fait ? "fait" : "prévu"} le ${s.date.slice(8, 10)}.${s.date.slice(5, 7)}.${s.date.slice(2, 4)}`,
          section: a.nom,
          ou: { type: "module", id: "mitsu" } as const,
        })),
      ...a.provisions
        .filter((p) => correspond(p.nom, recherche))
        .map((p) => ({ cle: `provision-${p.id}`, titre: p.nom, detail: `Provisions de ${a.nom}`, section: a.nom, ou: { type: "module", id: "mitsu" } as const })),
    ]),
  );

  sections.push(
    d.zones.flatMap((z) =>
      z.plantes
        .filter((p) => correspond(`${p.nom} ${p.espece ?? ""}`, recherche))
        .map((p) => ({ cle: `plante-${p.id}`, titre: p.nom, detail: z.nom, section: "Jardin", ou: { type: "module", id: "jardin" } as const })),
    ),
  );

  sections.push(
    d.souvenirs
      .filter((s) => !s.refuse && correspond(s.texte, recherche))
      .map((s) => ({ cle: `souvenir-${s.id}`, titre: s.texte, detail: "Retenu par ta fée", section: "Ce que Kora sait", ou: { type: "memoire" } as const })),
  );

  return sections.flatMap((s) => s.slice(0, PAR_SECTION));
}

/** Les résultats rangés par section, dans l'ordre où ils sont venus. */
export function grouperTrouvailles(trouvailles: readonly Trouvaille[]): { section: string; trouvailles: Trouvaille[] }[] {
  const groupes: { section: string; trouvailles: Trouvaille[] }[] = [];
  for (const t of trouvailles) {
    const g = groupes.find((x) => x.section === t.section);
    if (g) g.trouvailles.push(t);
    else groupes.push({ section: t.section, trouvailles: [t] });
  }
  return groupes;
}
