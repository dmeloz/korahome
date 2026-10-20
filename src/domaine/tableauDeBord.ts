// Le tableau de bord d'accueil : des widgets qu'on ajoute, retire et range.
// Chaque téléphone garde sa disposition. L'ordre choisi reste stable, mais un
// widget qui a quelque chose d'urgent à montrer remonte en haut.

import { sansAccents as retirerAccents } from "./texte";

export type WidgetId = "taches" | "courses" | "listes" | "agenda" | "mitsu" | "stock" | "entretien" | "jardin" | "chef" | "budget" | "infos";

export interface DefinitionWidget {
  id: WidgetId;
  titre: string;
  description: string;
  /** Faux tant que la section n'existe pas encore dans l'app. */
  disponible: boolean;
}

// Le titre d'un widget est aussi celui de sa page : on retrouve toujours le même nom.
export const CATALOGUE: readonly DefinitionWidget[] = [
  { id: "taches", titre: "Tâches", description: "Ce qui est à faire aujourd'hui et ce qui est en retard.", disponible: true },
  { id: "courses", titre: "Courses", description: "Ce qu'il reste à acheter.", disponible: true },
  { id: "listes", titre: "Listes", description: "Cadeaux, bricolage et toutes vos autres listes, à côté des courses.", disponible: true },
  { id: "agenda", titre: "Agenda", description: "Rendez-vous, anniversaires, vacances et sorties, à deux, relié au calendrier de l'iPhone.", disponible: true },
  { id: "mitsu", titre: "Mitsu", description: "Croquettes, litière, poids et vétérinaire.", disponible: true },
  { id: "stock", titre: "Frigo et placards", description: "Ce qu'il y a à la maison et ce qui arrive à sa date.", disponible: true },
  { id: "entretien", titre: "Entretien", description: "Détartrer, changer les filtres, tester le détecteur : un onglet des tâches, rien ne s'oublie.", disponible: true },
  { id: "jardin", titre: "Jardin", description: "Arrosage selon la pluie, alerte gel, calendrier du mois et plantes reconnues en photo.", disponible: true },
  { id: "chef", titre: "Menus de la semaine", description: "Cinq repas du soir qui finissent le frigo, et les courses qui manquent.", disponible: true },
  { id: "budget", titre: "Budget", description: "La carte courses, le plaisir, l'épargne et les factures à payer, calculés comme dans votre Excel.", disponible: true },
  { id: "infos", titre: "Infos de la maison", description: "Contrats, garanties et numéros utiles ; une photo d'un document et Jarvis note l'échéance.", disponible: false },
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

/**
 * L'ordre d'affichage : les widgets urgents d'abord, puis les autres,
 * chaque groupe gardant l'ordre choisi.
 */
export function ordreAffichage(d: Disposition, urgents: ReadonlySet<WidgetId>): Disposition {
  return [...d.filter((id) => urgents.has(id)), ...d.filter((id) => !urgents.has(id))];
}

/** Un widget petit (une case de la grille, le chiffre seul) ou grand (deux cases, avec le détail). */
export type TailleWidget = "petit" | "grand";
export type Tailles = Partial<Record<WidgetId, TailleWidget>>;

/** Relit les tailles enregistrées ; tout ce qui n'est pas « grand » est petit, comme au départ. */
export function nettoyerTailles(brutes: unknown): Tailles {
  const tailles: Tailles = {};
  if (!brutes || typeof brutes !== "object") return tailles;
  for (const [id, taille] of Object.entries(brutes)) {
    if (PAR_ID.has(id as WidgetId) && taille === "grand") tailles[id as WidgetId] = "grand";
  }
  return tailles;
}

export function tailleDe(tailles: Tailles, id: WidgetId): TailleWidget {
  return tailles[id] ?? "petit";
}

export function basculerTaille(tailles: Tailles, id: WidgetId): Tailles {
  const suivantes = { ...tailles };
  if (tailleDe(tailles, id) === "petit") suivantes[id] = "grand";
  else delete suivantes[id];
  return suivantes;
}

// ----- Tous les espaces -----
// Tirer l'accueil vers le bas ouvre « Tous les espaces » : chaque module, rangé par usage du
// quotidien, avec la recherche. Aucune catégorie ne disparaît : un widget retiré de l'accueil
// reste ici. On glisse une tuile sur l'accueil pour en faire un widget.

export type EspaceId = "menage" | "courses" | "cuisine" | "budget" | "agenda";

export interface Espace {
  id: EspaceId;
  titre: string;
  description: string;
  widgets: readonly WidgetId[];
}

export const ESPACES: readonly Espace[] = [
  { id: "menage", titre: "Ménage", description: "Les tâches, l'entretien, Mitsu et le jardin.", widgets: ["taches", "entretien", "mitsu", "jardin"] },
  { id: "courses", titre: "Courses", description: "Ce qu'il reste à acheter et vos autres listes.", widgets: ["courses", "listes"] },
  { id: "cuisine", titre: "Cuisine", description: "Les menus de la semaine, les recettes et ce qu'il y a à la maison.", widgets: ["chef", "stock"] },
  { id: "budget", titre: "Budget", description: "Le budget du foyer et les papiers de la maison.", widgets: ["budget", "infos"] },
  { id: "agenda", titre: "Agenda", description: "Rendez-vous, anniversaires et vacances.", widgets: ["agenda"] },
];

export function espace(id: EspaceId): Espace {
  return ESPACES.find((e) => e.id === id)!;
}

/** Les modules prêts d'un espace, dans l'ordre de l'espace. */
export function modulesDeLEspace(id: EspaceId): WidgetId[] {
  return espace(id).widgets.filter((w) => definition(w).disponible);
}

/** Les autres mots qu'on emploie pour chaque module, pour le retrouver dans « Tous les espaces ». */
export const MOTS_DES_MODULES: Record<WidgetId, readonly string[]> = {
  taches: ["ménage", "corvées", "à faire", "litière", "poubelles", "linge"],
  courses: ["acheter", "supermarché", "coop", "migros", "panier"],
  listes: ["cadeaux", "bricolage", "idées"],
  agenda: ["calendrier", "rendez-vous", "rdv", "anniversaire", "vacances", "icloud"],
  mitsu: ["chat", "croquettes", "vétérinaire", "véto", "litière", "zooplus"],
  stock: ["frigo", "placards", "congélateur", "date", "périmé", "réserve"],
  entretien: ["maison", "filtre", "détartrer", "réparer"],
  jardin: ["plantes", "balcon", "arroser", "météo", "potager", "herbes"],
  chef: ["repas", "menus", "recettes", "cuisine", "manger", "dîner", "souper"],
  budget: ["argent", "dépenses", "factures", "épargne", "compte", "carte", "revolut"],
  infos: ["papiers", "contrats", "garanties", "documents"],
};

const sansAccents = (t: string) => retirerAccents(t).toLowerCase().trim();

/** Les modules prêts dont le nom, la description ou un mot habituel commence comme la recherche. */
export function modulesCherches(recherche: string): WidgetId[] {
  const q = sansAccents(recherche);
  if (q.length < 2) return [];
  return CATALOGUE.filter((w) => w.disponible)
    .filter((w) => [w.titre, w.description, ...MOTS_DES_MODULES[w.id]].some((t) => ` ${sansAccents(t).replace(/[^a-z0-9]+/g, " ")}`.includes(` ${q}`)))
    .map((w) => w.id);
}

/**
 * Pose un widget venu de « Tous les espaces » à la place d'un autre (ou au bout). Déjà sur
 * l'accueil, il se déplace au lieu de se dédoubler.
 */
export function poserWidget(d: Disposition, id: WidgetId, cible: WidgetId | null): Disposition {
  const avec = ajouterWidget(d, id);
  return cible ? deplacerVers(avec, id, cible) : avec;
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
