// Le tableau de bord d'accueil : des widgets qu'on ajoute, retire et range.
// Chaque téléphone garde sa disposition. L'ordre choisi reste stable, mais un
// widget qui a quelque chose d'urgent à montrer remonte en haut.

export type WidgetId = "taches" | "courses" | "listes" | "agenda" | "mitsu" | "stock" | "entretien" | "jardin" | "chef";

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
  { id: "agenda", titre: "Agenda commun", description: "Rendez-vous, anniversaires, vacances et sorties, à deux, relié au calendrier de l'iPhone.", disponible: true },
  { id: "mitsu", titre: "Mitsu", description: "Croquettes, litière, poids et vétérinaire.", disponible: true },
  { id: "stock", titre: "Frigo et placards", description: "Ce qu'il y a à la maison et ce qui arrive à sa date.", disponible: true },
  { id: "entretien", titre: "Entretien", description: "Détartrer, changer les filtres, tester le détecteur : rien ne s'oublie.", disponible: true },
  { id: "jardin", titre: "Jardin", description: "Arrosage selon la pluie, alerte gel, calendrier du mois et plantes reconnues en photo.", disponible: true },
  { id: "chef", titre: "Chef de la semaine", description: "Cinq repas du soir qui finissent le frigo, et les courses qui manquent.", disponible: true },
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

/** Un widget petit (une case, le chiffre seul) ou grand (toute la largeur, avec le détail). */
export type TailleWidget = "petit" | "grand";
export type Tailles = Partial<Record<WidgetId, TailleWidget>>;

/** Relit les tailles enregistrées ; tout ce qui n'est pas « petit » est grand. */
export function nettoyerTailles(brutes: unknown): Tailles {
  const tailles: Tailles = {};
  if (!brutes || typeof brutes !== "object") return tailles;
  for (const [id, taille] of Object.entries(brutes)) {
    if (PAR_ID.has(id as WidgetId) && taille === "petit") tailles[id as WidgetId] = "petit";
  }
  return tailles;
}

export function tailleDe(tailles: Tailles, id: WidgetId): TailleWidget {
  return tailles[id] ?? "grand";
}

export function basculerTaille(tailles: Tailles, id: WidgetId): Tailles {
  const suivantes = { ...tailles };
  if (tailleDe(tailles, id) === "grand") suivantes[id] = "petit";
  else delete suivantes[id];
  return suivantes;
}

/** Glisse un widget à la place d'un autre, comme sur l'écran d'accueil de l'iPhone. */
export function deplacerVers(d: Disposition, id: WidgetId, cible: WidgetId): Disposition {
  const i = d.indexOf(id);
  const j = d.indexOf(cible);
  if (i < 0 || j < 0 || i === j) return d;
  const copie = d.filter((x) => x !== id);
  copie.splice(j, 0, id);
  return copie;
}
