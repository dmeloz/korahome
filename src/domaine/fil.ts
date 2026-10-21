import type { DocCouple } from "./bandeau";
import type { DocBudget } from "./budget";
import type { Zone } from "./jardin";
import type { Element, Foyer, Id, Jour, Tache } from "./types";

// Le fil du foyer : ce que chacun a fait ces derniers jours, dans l'ordre, sans score ni
// classement. Kora savait déjà qui coche une tâche et qui ajoute un article ; ici elle le
// montre, pour éviter le « tu as pensé à… ? » et donner la petite reconnaissance du travail
// de l'autre. Tout vient des données déjà là : rien de nouveau n'est enregistré.

export const JOURS_DU_FIL = 7;

export type GesteFil = "tache" | "article" | "depense" | "arrosage" | "mot";

export interface EntreeFil {
  cle: string;
  /** L'instant du geste (ISO). */
  quand: string;
  par: Id | null;
  geste: GesteFil;
  /** « a coché « Sortir les poubelles » ». */
  texte: string;
  espace: string;
}

export interface JourDuFil {
  jour: Jour;
  titre: string;
  entrees: EntreeFil[];
}

const jourDe = (iso: string, jourLocal: (iso: string) => Jour) => jourLocal(iso);

export function filDuFoyer(
  donnees: { taches: readonly Tache[]; elements: readonly Element[]; budget: readonly DocBudget[]; zones: readonly Zone[]; couple: readonly DocCouple[] },
  maintenant: string,
): EntreeFil[] {
  const limite = new Date(Date.parse(maintenant) - JOURS_DU_FIL * 86_400_000).toISOString();
  const entrees: EntreeFil[] = [];
  for (const t of donnees.taches) {
    for (const f of t.historique ?? []) {
      const quand = f.a ?? `${f.le}T12:00:00.000Z`;
      if (quand >= limite) entrees.push({ cle: `tache-${t.id}-${quand}`, quand, par: f.par, geste: "tache", texte: `a fait « ${t.titre} »`, espace: t.categorie === "entretien" ? "Entretien" : t.categorie === "administratif" ? "Administratif" : "Tâches" });
    }
    // Une tâche faite une seule fois n'a pas toujours d'historique.
    if (!t.historique?.length && t.faiteLe && t.faiteLe >= limite) entrees.push({ cle: `tache-${t.id}-${t.faiteLe}`, quand: t.faiteLe, par: t.faitePar, geste: "tache", texte: `a fait « ${t.titre} »`, espace: "Tâches" });
  }
  for (const e of donnees.elements) {
    if (e.creeLe >= limite) entrees.push({ cle: `article-${e.id}`, quand: e.creeLe, par: e.ajoutePar, geste: "article", texte: `a ajouté « ${e.texte} »`, espace: "Courses" });
  }
  for (const d of donnees.budget) {
    if (d.genre === "depense" && d.creeLe >= limite && d.source !== "applepay" && d.source !== "releve") {
      entrees.push({ cle: `depense-${d.id}`, quand: d.creeLe, par: d.par, geste: "depense", texte: `a noté ${d.libelle} · ${d.montant.toFixed(2)} CHF`, espace: "Budget" });
    }
  }
  for (const z of donnees.zones) {
    if (z.arroseeLe && `${z.arroseeLe}T12:00:00.000Z` >= limite) entrees.push({ cle: `arrosage-${z.id}-${z.arroseeLe}`, quand: `${z.arroseeLe}T12:00:00.000Z`, par: z.arrosePar, geste: "arrosage", texte: `a arrosé ${z.nom}`, espace: "Jardin" });
  }
  for (const c of donnees.couple) {
    if (c.type === "mot" && !c.coeur && c.creeLe >= limite) entrees.push({ cle: `mot-${c.id}`, quand: c.creeLe, par: c.de, geste: "mot", texte: "a laissé un mot", espace: "Nos mots" });
  }
  return entrees.filter((e) => e.quand <= maintenant).sort((a, b) => b.quand.localeCompare(a.quand));
}

/** Les entrées par jour, « Aujourd'hui », « Hier », puis la date. */
export function grouperParJour(entrees: readonly EntreeFil[], aujourdhui: Jour, jourLocal: (iso: string) => Jour): JourDuFil[] {
  const groupes = new Map<Jour, EntreeFil[]>();
  for (const e of entrees) {
    const j = jourDe(e.quand, jourLocal);
    groupes.set(j, [...(groupes.get(j) ?? []), e]);
  }
  const hier = new Date(Date.parse(`${aujourdhui}T12:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
  return [...groupes.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([jour, es]) => ({ jour, titre: jour === aujourdhui ? "Aujourd'hui" : jour === hier ? "Hier" : nommerJour(jour), entrees: es }));
}

function nommerJour(jour: Jour): string {
  const d = new Date(`${jour}T12:00:00.000Z`);
  const nom = d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

/** « Sarah 3 · toi 2 » : le compte du jour, pour la ligne de l'accueil ; vide quand rien n'a bougé. */
export function resumeDuJour(entrees: readonly EntreeFil[], aujourdhui: Jour, jourLocal: (iso: string) => Jour, foyer: Pick<Foyer, "membres">, moi: Id | null): string {
  const duJour = entrees.filter((e) => jourDe(e.quand, jourLocal) === aujourdhui);
  if (duJour.length === 0) return "";
  const parts = foyer.membres
    .map((m) => ({ m, n: duJour.filter((e) => e.par === m.id).length }))
    .filter(({ n }) => n > 0)
    .map(({ m, n }) => `${m.id === moi ? "toi" : m.prenom} ${n}`);
  const sansQui = duJour.filter((e) => !foyer.membres.some((m) => m.id === e.par)).length;
  if (sansQui) parts.push(`sans nom ${sansQui}`);
  return parts.join(" · ");
}

/** Le prénom du geste : « Sarah », « Toi », ou « Quelqu'un » quand le téléphone ne savait pas qui. */
export function quiDe(entree: EntreeFil, foyer: Pick<Foyer, "membres">, moi: Id | null): string {
  if (entree.par && entree.par === moi) return "Toi";
  return foyer.membres.find((m) => m.id === entree.par)?.prenom ?? "Quelqu'un";
}
