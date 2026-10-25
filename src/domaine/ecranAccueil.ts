import { ligneWidget, type Occurrence } from "./agenda";
import type { Element, Foyer, Id, Jour, Liste } from "./types";

// L'accueil « tout sur un écran » (Kora 0.0.72, variante B de la maquette tirée du kit NEXUS
// de Melo) : quatre chiffres du jour, « Ce soir » qui tourne tout seul, et deux piles de cartes
// sous « En ce moment ». La pile du haut, ce qui demande d'agir ; celle du bas, ce qu'on
// consulte. Leur contenu suit le moment : le matin la journée qui vient, le soir la maison et le
// repas, le dimanche le point de la semaine. Ce qui presse monte toujours dans la pile du haut.
// Équivalent natif : un ScrollView sans défilement, les piles en TabView .page vertical.

export type MomentAccueil = "matin" | "soir" | "dimanche";

/** Le dimanche toute la journée ; en semaine, le matin jusqu'à 14 h, puis le soir (et la nuit). */
export function momentAccueil(heure: number, jourSemaine: number): MomentAccueil {
  if (jourSemaine === 0) return "dimanche";
  return heure >= 4 && heure < 14 ? "matin" : "soir";
}

/** Les cartes des piles : cinq espaces, le fil « Chez nous » et le bilan du dimanche. */
export type CarteId = "maison" | "chef" | "courses" | "agenda" | "budget" | "fil" | "bilan";

export const CARTES: readonly { id: CarteId; titre: string }[] = [
  { id: "maison", titre: "Maison" },
  { id: "chef", titre: "Cuisine" },
  { id: "courses", titre: "Courses" },
  { id: "agenda", titre: "Agenda" },
  { id: "budget", titre: "Budget" },
  { id: "fil", titre: "Chez nous" },
  { id: "bilan", titre: "Bilan de la semaine" },
];

const IDS = new Set<string>(CARTES.map((c) => c.id));

/** Les deux piles de chaque moment : [à faire, à consulter]. */
export const PILES_DU_MOMENT: Record<MomentAccueil, readonly [readonly CarteId[], readonly CarteId[]]> = {
  matin: [["agenda", "maison"], ["courses", "fil"]],
  soir: [["maison", "chef"], ["courses", "fil"]],
  dimanche: [["bilan", "budget"], ["chef", "fil"]],
};

export const RAISON_DU_MOMENT: Record<MomentAccueil, string> = {
  matin: "Le matin : la journée qui vient",
  soir: "Le soir : la maison et le repas",
  dimanche: "Le dimanche : le point de la semaine",
};

/** Une pile garde au plus autant de cartes : au-delà, les tirets ne se lisent plus. */
export const CARTES_PAR_PILE = 4;

/**
 * Les deux piles du moment. Les cartes retirées de l'accueil sur ce téléphone et celles qui n'ont
 * rien à montrer (le bilan hors du dimanche) sortent. Une carte qui presse monte en tête de la pile
 * du haut, même si le moment la rangeait en bas ou ailleurs. Les autres cartes gardées sur
 * l'accueil se rangent au bout de la pile du bas : rien ne disparaît sans qu'on l'ait retiré.
 */
export function composerPiles(
  moment: MomentAccueil,
  o: { urgentes: ReadonlySet<CarteId>; retirees: ReadonlySet<CarteId>; absentes: ReadonlySet<CarteId> },
): [CarteId[], CarteId[]] {
  const garde = (id: CarteId) => !o.retirees.has(id) && !o.absentes.has(id);
  const [haut, bas] = PILES_DU_MOMENT[moment];
  const urgentes = CARTES.map((c) => c.id).filter((id) => o.urgentes.has(id) && garde(id));
  // Les urgentes dans l'ordre du moment d'abord, puis celles d'ailleurs.
  const urgentesOrdonnees = [...[...haut, ...bas].filter((id) => urgentes.includes(id)), ...urgentes.filter((id) => !haut.includes(id) && !bas.includes(id))];
  const pileHaut = [...urgentesOrdonnees, ...haut.filter((id) => garde(id) && !o.urgentes.has(id))].slice(0, CARTES_PAR_PILE);
  const reste = [...bas, ...CARTES.map((c) => c.id)].filter((id, i, tous) => tous.indexOf(id) === i && garde(id) && !pileHaut.includes(id));
  return [pileHaut, reste.slice(0, CARTES_PAR_PILE)];
}

/** Relit les cartes retirées de l'accueil sur ce téléphone : rien d'inconnu, pas de doublon. */
export function nettoyerRetirees(brut: unknown): CarteId[] {
  if (!Array.isArray(brut)) return [];
  return [...new Set(brut.filter((x): x is CarteId => typeof x === "string" && IDS.has(x)))];
}

export function basculerRetiree(retirees: readonly CarteId[], id: CarteId): CarteId[] {
  return retirees.includes(id) ? retirees.filter((x) => x !== id) : [...retirees, id];
}

/** La carte d'un espace de « Tous les espaces » : Mitsu et le jardin vont dans Maison, le frigo dans Cuisine. */
export function carteDeLEspace(id: string): CarteId | null {
  if (id === "mitsu" || id === "jardin") return "maison";
  if (id === "stock") return "chef";
  if (id === "listes") return "courses";
  return IDS.has(id) && id !== "bilan" && id !== "fil" ? (id as CarteId) : null;
}

/** « Pommes · 2 kg » : le texte à gauche, la fin à droite, comme une ligne de réglage. */
export function decouperLigne(ligne: string): { texte: string; fin: string } {
  const i = ligne.lastIndexOf(" · ");
  if (i < 0) return { texte: ligne, fin: "" };
  const fin = ligne.slice(i + 3);
  // Une fin longue est une phrase, pas une mesure : la ligne reste entière.
  return fin.length > 14 ? { texte: ligne, fin: "" } : { texte: ligne.slice(0, i), fin };
}

/** La tuile Agenda : « Jeu. » en grand, « 17:30 Vétérinaire » dessous. */
export function tuileAgenda(o: Occurrence | undefined, aujourdhui: Jour): { valeur: string; pied: string } {
  if (!o) return { valeur: "—", pied: "rien prévu" };
  const ligne = ligneWidget(o, aujourdhui);
  const i = ligne.indexOf(" · ");
  const [quand, ...heure] = ligne.slice(0, i).split(" ");
  return { valeur: quand === "Demain" ? "Dem." : quand, pied: [...heure, ligne.slice(i + 3)].join(" ") };
}

// ----- En direct -----

/** Des articles cochés depuis moins de 20 minutes : quelqu'un est en train de faire les courses. */
export const EN_DIRECT_MINUTES = 20;
/** Il en faut au moins deux : un seul coché, c'est peut-être un oubli rattrapé. */
const EN_DIRECT_MIN = 2;

export interface EnDirect {
  /** Le prénom de l'autre, ou « Quelqu'un » quand le téléphone qui coche ne le dit pas. */
  qui: string;
  coches: number;
  total: number;
}

/**
 * La pastille « en direct » : l'autre coche les courses en ce moment (« Sarah fait les courses ·
 * 4 sur 6 »). Un article coché sans `cochePar` vient d'une ancienne version de Kora, donc d'un
 * autre téléphone : il compte pour l'autre quand on est deux.
 */
export function enDirect(
  d: { listes: readonly Liste[]; elements: readonly Element[]; foyer: Pick<Foyer, "membres">; membreId: Id | null },
  maintenant: string,
): EnDirect | null {
  const liste = d.listes.find((l) => l.type === "courses");
  if (!liste) return null;
  const siens = d.elements.filter((e) => e.listeId === liste.id);
  const depuis = new Date(Date.parse(maintenant) - EN_DIRECT_MINUTES * 60_000).toISOString();
  const autres = d.foyer.membres.filter((m) => m.id !== d.membreId);
  const recents = siens.filter((e) => e.coche && e.cocheLe && e.cocheLe >= depuis && e.cocheLe <= maintenant && (e.cochePar ?? null) !== d.membreId);
  const parQui = new Map<string, number>();
  for (const e of recents) {
    const qui = e.cochePar ?? (autres.length === 1 ? autres[0].id : "");
    parQui.set(qui, (parQui.get(qui) ?? 0) + 1);
  }
  const [qui, n] = [...parQui.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (n < EN_DIRECT_MIN) return null;
  return {
    qui: d.foyer.membres.find((m) => m.id === qui)?.prenom ?? "Quelqu'un",
    coches: siens.filter((e) => e.coche).length,
    total: siens.length,
  };
}

/** Coche ou décoche en notant qui : la pastille « en direct » de l'autre téléphone le lit. */
export function noterCocheur(avant: Element, apres: Element, par: Id | null): Element {
  return apres.coche && !avant.coche ? { ...apres, cochePar: par } : { ...apres, cochePar: null };
}

// ----- Les gestes, découverts en douceur -----

/** « Glisse quand c'est fait » se montre les premières fois seulement. */
export const INDICE_FOIS = 3;

/** Le petit mot du geste : tant qu'il n'a pas été vu assez et que le geste n'a jamais été fait. */
export function montrerIndice(vues: number, geste: boolean): boolean {
  return !geste && vues < INDICE_FOIS;
}

/** « Ce soir » tourne d'une chose à la suivante toutes les six secondes. */
export const ROTATION_MS = 6000;

export function suivante(index: number, nombre: number): number {
  return nombre ? (index + 1) % nombre : 0;
}
