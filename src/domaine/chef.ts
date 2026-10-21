// Le Chef de la semaine : une fois par semaine (le dimanche à 17 h, ou le jour et l'heure
// choisis dans l'app), ou quand on le lance d'un toucher, il lit le frigo et les placards, propose
// cinq repas du soir de saison qui finissent d'abord ce qui arrive à sa date, et ajoute à la
// liste de courses ce qui manque, marqué « proposé par le chef ».
//
// Chaque repas entre dans les recettes du foyer (recettes.ts) avec ses ingrédients et ses étapes ;
// il reprend volontiers les recettes que le foyer aime.
//
// Il ne fait qu'ajouter : jamais il ne touche au stock, aux tâches ni à Mitsu. Les croquettes
// et la litière se commandent sur zooplus : il le signale, sans les mettre sur la liste.
// La fonction serveur supabase/functions/chef embarque ce fichier (`npm run fonction`).

import { coutMicroChf, MODELE_CONSEIL, type Consommation } from "./jarvisModele";
import { analyserSaisie } from "./listes";
import { nouveauSouvenir, souvenirsRetenus, type Souvenir } from "./memoire";
import { prevoir, type Animal } from "./mitsu";
import { apprendreRecette, lireBrouillon, recettesDe, recettesPourLeChef, type BrouillonRecette, type Recette } from "./recettes";
import { heureValide, jourEtHeure, JOURS_SEMAINE } from "./rappels";
import { detecterRayon, normaliser } from "./rayons";
import { decrirePeremption, LIEUX, ORDRE_LIEUX, type Produit } from "./stock";
import { ecartJours } from "./taches";
import { RAYONS, type Contexte, type Element, type Id, type Jour, type Liste, type Rayon } from "./types";
import { NOMS_MOIS } from "./texte";
import { savoirPourLeChef } from "./savoirCuisine";
import { decrireTrame, type TrameSoir } from "./variete";

// Ce dont la fonction serveur a aussi besoin : le compteur de Jarvis et l'heure de Zurich.
export { etatBudget, moisDe } from "./jarvisModele";
export { jourEtHeure } from "./rappels";
export { recettesDe } from "./recettes";
export { tirerSemaine } from "./variete";

/** Le Chef prend le modèle du conseil : une fois par semaine, il peut réfléchir un peu. */
export const MODELE_CHEF = MODELE_CONSEIL;
/** Les produits qui arrivent à leur date dans 5 jours ou moins passent en premier. */
export const JOURS_A_FINIR = 5;
/** Sous 10 jours de croquettes ou de litière, le Chef prévient. */
export const JOURS_ALERTE_MITSU = 10;
export const NOMBRE_REPAS = 5;
/** Au-delà, la liste deviendrait illisible : le reste est ignoré. */
export const AJOUTS_MAX = 30;
/** Il passe par défaut le dimanche à 17 h, heure de Zurich. */
export const JOUR_DU_CHEF = 0;
export const HEURE_DU_CHEF = 17;

export interface RepasChef {
  titre: string;
  /** Une ou deux phrases : ce qu'on prépare et comment. */
  description: string;
  /** Les produits du frigo ou des placards qu'il utilise. */
  avecLeStock: string[];
  /** La fiche du plat dans les recettes du foyer (depuis Kora 0.0.38). */
  recetteId?: Id;
}

/** Un article que le Chef a mis sur la liste de courses. */
export interface AjoutChef {
  elementId: Id;
  texte: string;
  quantite: string | null;
  rayon: Rayon;
}

/** Les menus d'une semaine, un document par jour où le Chef est passé : « menu-AAAA-MM-JJ ». */
export interface MenuSemaine {
  id: Id;
  type: "menu";
  /** Le jour où le Chef a préparé la semaine ; elle court sur les 7 jours suivants. */
  semaine: Jour;
  /** Une phrase d'accueil du Chef. */
  mot: string;
  repas: RepasChef[];
  ajouts: AjoutChef[];
  /** Les produits à finir vite, avec leur date : « Yaourts · demain ». */
  aFinir: string[];
  alertesMitsu: string[];
  /** La trame tirée par Kora pour chaque soir (depuis 0.0.68), dont se souviennent les semaines suivantes. */
  trame?: TrameSoir[];
  /** « auto » : le passage de la semaine ; « maintenant » : lancé depuis l'app. */
  lance: "auto" | "maintenant";
  creeLe: string;
  /** Validé par le foyer : ses recettes restent dans la base, même si le menu est effacé ensuite. */
  valideLe?: string;
}

/** Le passage automatique, pour un foyer qui l'a activé : le jour (0 = dimanche) et l'heure, à Zurich. */
export interface ReglageChef {
  id: "reglage";
  type: "reglage";
  actif: boolean;
  jour: number;
  heure: number;
  modifieLe: string;
}

/** La collection « menus » : les menus, le réglage et les recettes du foyer. */
export type DocChef = MenuSemaine | ReglageChef | Recette;

export const idMenu = (jour: Jour): Id => `menu-${jour}`;

const jourSemaine = (jour: Jour) => new Date(`${jour}T12:00:00Z`).getUTCDay();

export const REGLAGE_DE_DEPART: Omit<ReglageChef, "modifieLe"> = { id: "reglage", type: "reglage", actif: false, jour: JOUR_DU_CHEF, heure: HEURE_DU_CHEF };

/** Le réglage du foyer, ou celui de départ (désactivé, dimanche 17 h) ; un jour ou une heure invalide revient au défaut. */
export function reglageChef(docs: readonly DocChef[]): Omit<ReglageChef, "modifieLe"> {
  const r = docs.find((d): d is ReglageChef => d.type === "reglage");
  if (!r) return REGLAGE_DE_DEPART;
  return {
    ...REGLAGE_DE_DEPART,
    actif: r.actif === true,
    jour: Number.isInteger(r.jour) && r.jour >= 0 && r.jour <= 6 ? r.jour : JOUR_DU_CHEF,
    heure: heureValide(r.heure) ? r.heure : HEURE_DU_CHEF,
  };
}

export function reglerChef(changement: Partial<Pick<ReglageChef, "actif" | "jour" | "heure">>, docs: readonly DocChef[], ctx: Contexte): ReglageChef {
  return { ...reglageChef(docs), ...changement, modifieLe: ctx.maintenant() };
}

/** Vrai à l'heure où le Chef passe pour ce foyer, à Zurich. */
export function estLHeureDuChef(instant: Date, reglage: Pick<ReglageChef, "actif" | "jour" | "heure">): boolean {
  if (!reglage.actif) return false;
  const { jour, heure } = jourEtHeure(instant);
  return jourSemaine(jour) === reglage.jour && heure === reglage.heure;
}

/** Les menus en cours : le plus récent préparé dans les 7 derniers jours. */
export function menuDeLaSemaine(docs: readonly DocChef[], aujourdhui: Jour): MenuSemaine | null {
  const menus = docs
    .filter((d): d is MenuSemaine => d.type === "menu")
    .filter((m) => {
      const ecart = ecartJours(m.semaine, aujourdhui);
      return ecart >= 0 && ecart < 7;
    })
    .sort((a, b) => b.semaine.localeCompare(a.semaine));
  return menus[0] ?? null;
}

/** Le nom du jour : « dimanche ». */
export const nomDuJour = (numero: number) => JOURS_SEMAINE.find((j) => j.numero === numero)?.nom ?? "dimanche";

/** Le prochain passage automatique : « ce soir à 17 h », « dimanche à 17 h » ; null s'il est désactivé. */
export function prochainPassage(reglage: Pick<ReglageChef, "actif" | "jour" | "heure">, instant: Date): string | null {
  if (!reglage.actif) return null;
  const { jour, heure } = jourEtHeure(instant);
  if (jourSemaine(jour) === reglage.jour && heure <= reglage.heure) return `aujourd'hui à ${reglage.heure} h`;
  return `${nomDuJour(reglage.jour)} à ${reglage.heure} h`;
}

/** Ce qui arrive à sa date dans les 5 jours, du plus pressé au moins pressé ; les produits déjà périmés n'y sont pas. */
export function produitsAFinir(produits: readonly Produit[], aujourdhui: Jour): Produit[] {
  return produits
    .filter((p) => {
      if (!p.peremption) return false;
      const ecart = ecartJours(aujourdhui, p.peremption);
      return ecart >= 0 && ecart <= JOURS_A_FINIR;
    })
    .sort((a, b) => a.peremption!.localeCompare(b.peremption!) || a.nom.localeCompare(b.nom, "fr"));
}

const PROVISIONS_SURVEILLEES = { croquettes: "croquettes", litiere: "litière" } as const;

/** Les croquettes ou la litière qui s'épuisent dans les 10 jours : à commander sur zooplus. */
export function alertesMitsu(animaux: readonly Animal[], aujourdhui: Jour): string[] {
  const alertes: string[] = [];
  for (const animal of animaux) {
    for (const provision of animal.provisions ?? []) {
      if (provision.type !== "croquettes" && provision.type !== "litiere") continue;
      const p = prevoir(provision, animal, aujourdhui);
      if (!p || p.joursRestants > JOURS_ALERTE_MITSU) continue;
      const quoi = PROVISIONS_SURVEILLEES[provision.type];
      alertes.push(
        p.joursRestants === 0
          ? `Plus de ${quoi} pour ${animal.nom} : commande vite sur zooplus.`
          : `${animal.nom} n'a plus que ${p.joursRestants} jour${p.joursRestants > 1 ? "s" : ""} de ${quoi} : pense à commander sur zooplus.`,
      );
    }
  }
  return alertes;
}


export const CONSIGNES_CHEF = `Tu es le Chef de la semaine de KoraHome, l'app d'un couple qui vit à Renens, dans le canton de Vaud.
Chaque dimanche, tu proposes ${NOMBRE_REPAS} repas du soir pour la semaine, simples (45 minutes au plus), de saison en Suisse romande, pour deux personnes.
Utilise d'abord les produits à finir vite, puis le reste du frigo, du congélateur et des placards. Varie les plats, évite deux fois la même base.
Pour chaque repas, donne la recette complète pour deux personnes : tous ses ingrédients avec leur quantité (ceux du stock compris ; nom court dans « nom », quantité courte dans « quantite » ou vide), puis trois à huit étapes courtes et claires.
Si une recette que le foyer aime convient à la semaine, reprends-la sous son titre exact.
Ensuite, liste les ingrédients qui manquent pour ces repas : un article par ligne, nom court au singulier ou tel qu'on l'écrit sur une liste (« Poireaux », « Crème entière »), quantité courte (« 500 g », « 2 », « 1 l ») ou vide.
Ne remets pas ce qui est déjà dans le stock ou déjà sur la liste de courses. Les épices, le sel, le poivre et l'huile sont supposés à la maison sauf s'ils sont vraiment absents.
Ne mets jamais de croquettes, de litière ni rien pour le chat : cela se commande ailleurs.
Kora a tiré au sort une trame pour chaque soir (une base, une protéine, deux légumes de saison) pour que les semaines ne se ressemblent pas : construis chaque repas sur la trame de son soir, dans l'ordre. Tu peux échanger un élément contre un produit à finir vite, ou contre un plat que le foyer aime, mais garde la variété : pas deux fois la même base dans la semaine.
Appuie-toi sur le savoir de cuisine fourni : légumes de saison, quantités pour deux, temps et températures de cuisson, durée des restes. Les quantités des ingrédients suivent ces repères ; les étapes donnent les temps et les gestes justes. Quand une préparation se fait une fois pour deux soirs (légumineuses, sauce, légumes rôtis), dis-le dans la description, en respectant la durée des restes (jamais de riz cuit gardé plus d'un jour).
Tiens compte de ce que le foyer aime et n'aime pas (sa mémoire) : refais volontiers un plat apprécié de temps en temps, ne repropose jamais un plat à éviter.
Le champ « mot » est une phrase chaleureuse et courte en français, sans emoji, qui dit ce que la semaine permet de finir.
Réponds en français, avec le tutoiement.`;

/** Le message du dimanche : le stock, ce qui presse, la liste de courses actuelle. */
export function messageChef(d: { produits: readonly Produit[]; enCourses: readonly Element[]; aujourdhui: Jour; souvenirs?: readonly Souvenir[]; recettes?: readonly Recette[]; trame?: readonly TrameSoir[] }): string {
  const aFinir = produitsAFinir(d.produits, d.aujourdhui);
  const urgents = new Set(aFinir.map((p) => p.id));
  const decrire = (p: Produit) => [p.nom, p.quantite, p.peremption && decrirePeremption(p, d.aujourdhui)].filter(Boolean).join(" · ");
  const lignes = [`Nous sommes le ${Number(d.aujourdhui.slice(8, 10))} ${NOMS_MOIS[Number(d.aujourdhui.slice(5, 7)) - 1]} ${d.aujourdhui.slice(0, 4)}.`, ""];
  lignes.push("À finir vite :", ...(aFinir.length ? aFinir.map((p) => `- ${decrire(p)}`) : ["- rien de pressé"]), "");
  for (const lieu of ORDRE_LIEUX) {
    const ici = d.produits.filter((p) => p.lieu === lieu && !urgents.has(p.id));
    if (ici.length) lignes.push(`${LIEUX[lieu]} :`, ...ici.map((p) => `- ${decrire(p)}`), "");
  }
  if (!d.produits.length) lignes.push("Le stock est vide : propose des repas simples avec des ingrédients courants.", "");
  lignes.push("Déjà sur la liste de courses :", ...(d.enCourses.length ? d.enCourses.map((e) => `- ${e.texte}${e.quantite ? ` · ${e.quantite}` : ""}`) : ["- rien"]));
  const memoire = souvenirsRetenus(d.souvenirs ?? []).sort((a, b) => a.creeLe.localeCompare(b.creeLe)).slice(-SOUVENIRS_DU_CHEF);
  if (memoire.length) lignes.push("", "Ce que le foyer aime, n'aime pas ou a l'habitude de faire :", ...memoire.map((s) => `- ${s.texte}`));
  const avis = (r: Recette) => avisDuPlat(d.souvenirs ?? [], r.titre)?.avis ?? null;
  const reprendre = recettesPourLeChef(d.recettes ?? [], (r) => avis(r) === "aime", (r) => avis(r) === "non");
  if (reprendre.length) lignes.push("", "Recettes du foyer qu'il aime refaire :", ...reprendre.map((t) => `- ${t}`));
  if (d.trame?.length) lignes.push("", "La trame tirée par Kora pour cette semaine :", ...decrireTrame(d.trame));
  lignes.push("", savoirPourLeChef(Number(d.aujourdhui.slice(5, 7))));
  return lignes.join("\n");
}

/** La forme exacte de la réponse du Chef (sorties structurées de l'API). */
export const SCHEMA_CHEF = {
  type: "object",
  additionalProperties: false,
  required: ["mot", "repas", "aAcheter"],
  properties: {
    mot: { type: "string" },
    repas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titre", "description", "avecLeStock", "portions", "ingredients", "etapes"],
        properties: {
          titre: { type: "string" },
          description: { type: "string" },
          avecLeStock: { type: "array", items: { type: "string" } },
          portions: { type: "integer" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["nom", "quantite"],
              properties: { nom: { type: "string" }, quantite: { type: "string" } },
            },
          },
          etapes: { type: "array", items: { type: "string" } },
        },
      },
    },
    aAcheter: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texte", "quantite", "rayon"],
        properties: {
          texte: { type: "string" },
          quantite: { type: "string" },
          rayon: { type: "string", enum: [...RAYONS] },
        },
      },
    },
  },
} as const;

export interface PropositionChef {
  mot: string;
  repas: RepasChef[];
  /** La recette de chaque repas, dans le même ordre ; null quand ses ingrédients manquent. */
  recettes: (BrouillonRecette | null)[];
  aAcheter: { texte: string; quantite: string | null; rayon: Rayon | null }[];
}

const chaine = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Relit la réponse du modèle sans lui faire confiance : champs vides écartés, longueurs bornées. */
export function lireProposition(brut: unknown): PropositionChef | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const lus = (Array.isArray(o.repas) ? o.repas : [])
    .map((r: Record<string, unknown>) => ({
      repas: {
        titre: chaine(r?.titre, 80),
        description: chaine(r?.description, 300),
        avecLeStock: (Array.isArray(r?.avecLeStock) ? r.avecLeStock : []).map((s: unknown) => chaine(s, 60)).filter(Boolean).slice(0, 8),
      },
      recette: lireBrouillon(r, "chef"),
    }))
    .filter((r) => r.repas.titre)
    .slice(0, NOMBRE_REPAS);
  if (!lus.length) return null;
  const repas = lus.map((l) => l.repas);
  const recettes = lus.map((l) => l.recette);
  const aAcheter = (Array.isArray(o.aAcheter) ? o.aAcheter : [])
    .map((a: Record<string, unknown>) => {
      const rayon = chaine(a?.rayon, 40);
      return {
        texte: chaine(a?.texte, 60),
        quantite: chaine(a?.quantite, 20) || null,
        rayon: (RAYONS as readonly string[]).includes(rayon) ? (rayon as Rayon) : null,
      };
    })
    .filter((a) => a.texte);
  return { mot: chaine(o.mot, 200), repas, recettes, aAcheter };
}

/** Ce qui se commande sur zooplus n'a rien à faire sur la liste du magasin. */
const POUR_LE_CHAT = /\b(croquettes?|litieres?|patees?|friandises? pour chat|zooplus)\b/;

/**
 * Les articles à ajouter à la liste de courses : sans doublon avec ce qui y est déjà (non coché)
 * ni entre eux, sans rien pour le chat, 30 au plus. Chacun porte la marque du Chef.
 */
export function preparerAjouts(
  aAcheter: PropositionChef["aAcheter"],
  liste: Liste,
  elements: readonly Element[],
  ctx: Contexte,
): Element[] {
  const deja = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => normaliser(e.texte)));
  const ajouts: Element[] = [];
  for (const a of aAcheter) {
    const { texte, quantite } = analyserSaisie(a.texte);
    const cle = normaliser(texte);
    if (!cle || deja.has(cle) || POUR_LE_CHAT.test(cle) || a.rayon === "Animaux") continue;
    deja.add(cle);
    ajouts.push({
      id: ctx.nouvelId(),
      listeId: liste.id,
      texte,
      quantite: a.quantite ?? quantite,
      rayon: a.rayon ?? detecterRayon(texte),
      coche: false,
      ajoutePar: null,
      source: "chef",
      creeLe: ctx.maintenant(),
      cocheLe: null,
    });
    if (ajouts.length >= AJOUTS_MAX) break;
  }
  return ajouts;
}

/**
 * Relancer le Chef la même semaine remplace ses propres articles : ceux qu'il avait ajoutés
 * et que personne n'a encore cochés. Le reste de la liste n'est jamais touché.
 */
export function articlesARemplacer(ancien: MenuSemaine | null, elements: readonly Element[]): Id[] {
  if (!ancien) return [];
  const siens = new Set(ancien.ajouts.map((a) => a.elementId));
  return elements.filter((e) => siens.has(e.id) && !e.coche && e.source === "chef").map((e) => e.id);
}

/**
 * Les repas du Chef entrent dans les recettes du foyer : une recette déjà là monte sans être
 * copiée. Rend les recettes à enregistrer et les repas reliés à leur fiche.
 */
export function recettesDuChef(proposition: PropositionChef, docs: readonly DocChef[], ctx: Contexte): { repas: RepasChef[]; recettes: Recette[] } {
  let base = recettesDe(docs);
  const recettes: Recette[] = [];
  const repas = proposition.repas.map((r, i) => {
    const b = proposition.recettes[i];
    if (!b) return r;
    const { recette } = apprendreRecette(base, { ...b, titre: r.titre }, ctx);
    base = [...base.filter((x) => x.id !== recette.id), recette];
    if (!recettes.some((x) => x.id === recette.id)) recettes.push(recette);
    else recettes.splice(recettes.findIndex((x) => x.id === recette.id), 1, recette);
    return { ...r, recetteId: recette.id };
  });
  return { repas, recettes };
}

export function nouveauMenu(
  d: { proposition: PropositionChef; repas?: RepasChef[]; ajouts: readonly Element[]; produits: readonly Produit[]; animaux: readonly Animal[]; aujourdhui: Jour; lance: MenuSemaine["lance"]; trame?: TrameSoir[] },
  ctx: Contexte,
): MenuSemaine {
  return {
    id: idMenu(d.aujourdhui),
    type: "menu",
    semaine: d.aujourdhui,
    mot: d.proposition.mot,
    repas: d.repas ?? d.proposition.repas,
    ajouts: d.ajouts.map((e) => ({ elementId: e.id, texte: e.texte, quantite: e.quantite, rayon: e.rayon })),
    aFinir: produitsAFinir(d.produits, d.aujourdhui).map((p) => `${p.nom} · ${decrirePeremption(p, d.aujourdhui)}`),
    alertesMitsu: alertesMitsu(d.animaux, d.aujourdhui),
    ...(d.trame?.length ? { trame: d.trame } : {}),
    lance: d.lance,
    creeLe: ctx.maintenant(),
  };
}

/** Le menu sans un article, quand on le retire de la liste depuis la page du Chef. */
export function retirerAjout(menu: MenuSemaine, elementId: Id): MenuSemaine {
  return { ...menu, ajouts: menu.ajouts.filter((a) => a.elementId !== elementId) };
}

/** Les articles du Chef encore sur la liste, et lesquels sont déjà achetés. */
export function etatDesAjouts(menu: MenuSemaine, elements: readonly Element[]): { ajout: AjoutChef; element: Element | null }[] {
  const parId = new Map(elements.map((e) => [e.id, e]));
  return menu.ajouts.map((ajout) => ({ ajout, element: parId.get(ajout.elementId) ?? null }));
}

/** Le menu validé : ses recettes sont gardées pour de bon. */
export function validerMenu(menu: MenuSemaine, ctx: Contexte): MenuSemaine {
  return { ...menu, valideLe: ctx.maintenant() };
}

/**
 * Ce qu'efface « Effacer ce menu » : le menu, les articles du Chef pas encore cochés et, si le
 * menu n'a pas été validé, ses recettes jamais cuisinées ni proposées une autre semaine.
 */
export function ceQuEfface(
  menu: MenuSemaine,
  recettes: readonly { id: Id; source: string; fois: number; vue: number }[],
  elements: readonly Element[],
): { recettes: Id[]; elements: Id[] } {
  const duMenu = new Set(menu.repas.map((r) => r.recetteId).filter((id): id is Id => !!id));
  const aRetirer = menu.valideLe ? [] : recettes.filter((r) => duMenu.has(r.id) && r.source === "chef" && r.fois === 0 && r.vue <= 1).map((r) => r.id);
  const articles = etatDesAjouts(menu, elements).flatMap(({ element }) => (element && !element.coche ? [element.id] : []));
  return { recettes: aRetirer, elements: articles };
}

/** Le texte de la notification quand les menus sont prêts. */
export function notificationChef(menu: MenuSemaine): { titre: string; corps: string } {
  const n = menu.ajouts.length;
  const courses = n ? `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses.` : "Rien à ajouter aux courses.";
  return { titre: "Les menus de la semaine sont prêts", corps: [menu.repas.map((r) => r.titre).slice(0, 3).join(", "), courses].filter(Boolean).join(" · ") };
}

export function coutChef(u: Consommation): number {
  return coutMicroChf(u, MODELE_CHEF);
}

/** Ce que le Chef relit de la mémoire du foyer : les goûts, les plats aimés et refusés. */
export const SOUVENIRS_DU_CHEF = 40;

export type AvisPlat = "aime" | "non";

const clePlat = (titre: string) => normaliser(titre).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
export const cleAvis = (titre: string, avis: AvisPlat) => `chef:${avis}:${clePlat(titre)}`;

/** L'avis donné sur un plat, retenu dans la mémoire du foyer : le Chef le relit chaque semaine. */
export function avisSurPlat(titre: string, avis: AvisPlat, auteur: Id | null, ctx: Contexte): Souvenir {
  const texte = avis === "aime" ? `Plat apprécié, à refaire de temps en temps : ${titre}` : `Plat à ne plus proposer : ${titre}`;
  return { ...nouveauSouvenir(texte, "bilan", auteur, ctx), cle: cleAvis(titre, avis) };
}

/** L'avis déjà donné sur ce plat, et le souvenir qui le porte. */
export function avisDuPlat(souvenirs: readonly Souvenir[], titre: string): { avis: AvisPlat; souvenir: Souvenir } | null {
  for (const avis of ["aime", "non"] as const) {
    const souvenir = souvenirs.find((s) => !s.refuse && s.cle === cleAvis(titre, avis));
    if (souvenir) return { avis, souvenir };
  }
  return null;
}
