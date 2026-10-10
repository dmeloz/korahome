// Le tableau de bord d'accueil : des widgets qu'on ajoute, retire et range.
// Chaque téléphone garde sa disposition. L'ordre choisi reste stable, mais un
// widget qui a quelque chose d'urgent à montrer remonte en haut.

export type WidgetId = "taches" | "courses" | "listes" | "agenda" | "mitsu" | "stock" | "jardin";

export interface DefinitionWidget {
  id: WidgetId;
  titre: string;
  description: string;
  /** Faux tant que la section n'existe pas encore dans l'app. */
  disponible: boolean;
}

export const CATALOGUE: readonly DefinitionWidget[] = [
  { id: "taches", titre: "Tâches de la maison", description: "Ce qui est à faire aujourd'hui et ce qui est en retard.", disponible: true },
  { id: "courses", titre: "Courses", description: "Ce qu'il reste à acheter.", disponible: true },
  { id: "listes", titre: "Autres listes", description: "Cadeaux, bricolage et toutes vos autres listes.", disponible: true },
  { id: "agenda", titre: "Agenda", description: "Les rendez-vous du jour et de la semaine.", disponible: false },
  { id: "mitsu", titre: "Mitsu", description: "Croquettes, litière, poids et vétérinaire.", disponible: true },
  { id: "stock", titre: "Frigo et placards", description: "Les produits qui arrivent à leur date.", disponible: false },
  { id: "jardin", titre: "Jardin", description: "Arrosage, météo et alerte gel.", disponible: false },
];

const PAR_ID = new Map(CATALOGUE.map((w) => [w.id, w]));

export function definition(id: WidgetId): DefinitionWidget {
  return PAR_ID.get(id)!;
}

/** Les widgets posés sur le tableau, dans l'ordre choisi. */
export type Disposition = WidgetId[];

export const DISPOSITION_DE_DEPART: Disposition = ["taches", "courses", "listes"];

/**
 * Relit une disposition enregistrée : ignore ce qui n'existe pas (ou plus),
 * les sections pas encore prêtes et les doublons.
 */
export function nettoyerDisposition(brute: unknown): Disposition {
  if (!Array.isArray(brute)) return [...DISPOSITION_DE_DEPART];
  const vus = new Set<WidgetId>();
  for (const x of brute) {
    const w = PAR_ID.get(x as WidgetId);
    if (w && w.disponible) vus.add(w.id);
  }
  return [...vus];
}

export function ajouterWidget(d: Disposition, id: WidgetId): Disposition {
  if (d.includes(id) || !definition(id)?.disponible) return d;
  return [...d, id];
}

export function retirerWidget(d: Disposition, id: WidgetId): Disposition {
  return d.filter((x) => x !== id);
}

/** Monte (-1) ou descend (+1) un widget d'une place. */
export function deplacerWidget(d: Disposition, id: WidgetId, sens: -1 | 1): Disposition {
  const i = d.indexOf(id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= d.length) return d;
  const copie = [...d];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

/** Ce qu'on peut encore ajouter, et ce qui arrive bientôt. */
export function widgetsAAjouter(d: Disposition): { prets: DefinitionWidget[]; bientot: DefinitionWidget[] } {
  const absents = CATALOGUE.filter((w) => !d.includes(w.id));
  return { prets: absents.filter((w) => w.disponible), bientot: absents.filter((w) => !w.disponible) };
}

/**
 * L'ordre d'affichage : les widgets urgents d'abord, puis les autres,
 * chaque groupe gardant l'ordre choisi.
 */
export function ordreAffichage(d: Disposition, urgents: ReadonlySet<WidgetId>): Disposition {
  return [...d.filter((id) => urgents.has(id)), ...d.filter((id) => !urgents.has(id))];
}
