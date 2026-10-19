import { analyserPhrase, devinerCategorie, type Brouillon } from "./agenda";
import type { WidgetId } from "./tableauDeBord";
import { decaler } from "./taches";
import type { Foyer, Jour, Recurrence } from "./types";

// La barre Jarvis, en bas de chaque page : une seule façon d'ajouter quoi que ce soit.
// On écrit comme on parle ; Kora comprend seul ce qui est simple (sans internet ni frais)
// et confie le reste à Jarvis. Sur une page, la phrase va d'abord à cette page.

/** Où l'on écrit : l'accueil, un module, ou une liste ouverte. */
export type LieuBarre = "accueil" | "liste" | WidgetId;

export type Intention =
  | { type: "courses"; articles: string[] }
  | { type: "liste"; articles: string[] }
  | { type: "tache"; titre: string; recurrence: Recurrence | null; echeance: Jour }
  | { type: "agenda"; brouillon: Brouillon }
  | { type: "stock"; texte: string }
  | { type: "jarvis"; demande: string };

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’]/g, "'");
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const QUESTION = /^(qu'est|qu est|est-ce|est ce|combien|quand|ou |où |pourquoi|comment|quel|quelle|quels|quelles|que |qui |dis-moi|dis moi|rappelle-moi ce|on a |il reste|reste-t-il|y a-t-il)/;
/** Ce que Jarvis fait mieux que Kora seule : retenir, prévenir, raconter. */
const POUR_JARVIS = /^(retiens|souviens|rappelle|note que|dis a|dis à|previens|explique|propose|resume|organise|planifie|cherche|trouve|annule|supprime|efface|retire|enleve)/;
const COURSES = /^(ajoute[rsz]?|acheter|achete|il faut|il nous faut|faut|prendre|prends|mets|mettre|rajoute[rsz]?)\b/;
const VERS_COURSES = /\s+(?:aux|a la liste de|à la liste de|sur la liste de|dans les) courses\s*$|\s+(?:a|à) acheter\s*$/i;
const RYTHME = /\b(chaque (jour|semaine|mois|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)|tous les (jours|mois|\d+ (jours|semaines|mois))|toutes les (\d+ )?semaines|tous les (lundis|mardis|mercredis|jeudis|vendredis|samedis|dimanches))\b/;
const VERBES_TACHE = /^(tache|sortir|faire|nettoyer|ranger|laver|passer|arroser|changer|vider|repasser|aspirer|appeler|payer|reserver|envoyer|plier|trier|recycler|detartrer|degivrer|tondre|tailler|preparer|reparer|monter|deposer|rendre|recuperer|chercher|poster|remplir|commander)\b/;

/** « du lait, des œufs et 2 kg de pommes » → ["Lait", "Œufs", "2 kg de pommes"]. */
export function decouperArticles(texte: string): string[] {
  return texte
    .replace(VERS_COURSES, "")
    .split(/\s*,\s*|\s+et\s+|\s*\+\s*/)
    .map((a) => a.trim().replace(/^(?:(?:du|de la|des|un|une|le|la|les)\s+|(?:de l'|l'|d'))/i, "").trim())
    .filter(Boolean)
    .map(majuscule);
}

/** Retire « ajoute », « il faut », « acheter » du début d'une phrase de courses. */
function sansVerbeDeCourses(texte: string): string {
  const mots = texte.trim();
  const m = sansAccents(mots).match(/^(ajoute[rsz]?|acheter|achete|il nous faut|il faut|faut|prendre|prends|mets|mettre|rajoute[rsz]?)\s+/);
  return m ? mots.slice(m[0].length) : mots;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Le prochain jour nommé à partir d'aujourd'hui compris (« lundi » un lundi : aujourd'hui). */
function prochainJour(numero: number, aujourdhui: Jour): Jour {
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const actuel = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return decaler(aujourdhui, { unite: "jour", tous: (numero - actuel + 7) % 7 });
}

/**
 * Une tâche écrite comme on parle : « Sortir les poubelles chaque mardi »,
 * « Détartrer la bouilloire tous les 3 mois », « Appeler le garage demain ».
 */
export function analyserTache(texte: string, aujourdhui: Jour): { titre: string; recurrence: Recurrence | null; echeance: Jour } {
  let reste = ` ${texte.trim().replace(/^t[aâ]che\s*:?\s*/i, "")} `;
  let recurrence: Recurrence | null = null;
  let echeance = aujourdhui;
  const retirer = (re: RegExp, faire: (m: RegExpMatchArray) => void) => {
    const m = reste.match(re);
    if (m) {
      faire(m);
      reste = reste.replace(m[0], " ");
    }
  };
  retirer(/\b(?:tous les|chaque) (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/i, (m) => {
    recurrence = { unite: "semaine", tous: 1 };
    echeance = prochainJour(JOURS.indexOf(m[1].toLowerCase()), aujourdhui);
  });
  retirer(/\b(?:tous les|toutes les) (\d+) (jours|semaines|mois)\b/i, (m) => {
    const unite = m[2].startsWith("jour") ? "jour" : m[2].startsWith("sem") ? "semaine" : "mois";
    recurrence = { unite, tous: Number(m[1]) };
  });
  retirer(/\b(?:chaque|tous les) jours?\b/i, () => void (recurrence = { unite: "jour", tous: 1 }));
  retirer(/\b(?:chaque|toutes les) semaines?\b/i, () => void (recurrence = { unite: "semaine", tous: 1 }));
  retirer(/\b(?:chaque|tous les) mois\b/i, () => void (recurrence = { unite: "mois", tous: 1 }));
  retirer(/\bapr[eè]s-?demain\b/i, () => void (echeance = decaler(aujourdhui, { unite: "jour", tous: 2 })));
  retirer(/\bdemain\b/i, () => void (echeance = decaler(aujourdhui, { unite: "jour", tous: 1 })));
  retirer(/\b(?:aujourd'hui|aujourd’hui|ce soir|ce matin)\b/i, () => void (echeance = aujourdhui));
  retirer(/(?:(?:à|a) partir (?:de |du )|dès )?\b(?:ce |le )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?\b/i, (m) => {
    echeance = prochainJour(JOURS.indexOf(m[1].toLowerCase()), aujourdhui);
  });
  const titre = reste
    .replace(/\s+/g, " ")
    .replace(/[\s,;:–-]+$/g, "")
    .replace(/\s+(le|la|à|a|au|de|du|pour|et)$/i, "")
    .trim();
  return { titre: majuscule(titre), recurrence, echeance };
}

/** Ce que veut dire une phrase de la barre, selon la page où on l'écrit. */
export function comprendrePhrase(texte: string, lieu: LieuBarre, aujourdhui: Jour, membres: Foyer["membres"] = []): Intention {
  const phrase = texte.trim().replace(/\s+/g, " ");
  const cle = sansAccents(phrase);
  if (phrase.endsWith("?") || QUESTION.test(cle) || POUR_JARVIS.test(cle)) return { type: "jarvis", demande: phrase };

  // Sur une page, la page d'abord.
  if (lieu === "courses") return { type: "courses", articles: decouperArticles(sansVerbeDeCourses(phrase)) };
  if (lieu === "liste") return { type: "liste", articles: decouperArticles(sansVerbeDeCourses(phrase)) };
  if (lieu === "stock") return { type: "stock", texte: phrase };
  if (lieu === "taches" || lieu === "entretien") return { type: "tache", ...analyserTache(phrase, aujourdhui) };
  if (lieu === "agenda") return { type: "agenda", brouillon: analyserPhrase(phrase, aujourdhui, membres) };
  if (lieu !== "accueil") return { type: "jarvis", demande: phrase };

  // Depuis l'accueil, Kora devine.
  if (VERS_COURSES.test(phrase) || COURSES.test(cle)) return { type: "courses", articles: decouperArticles(sansVerbeDeCourses(phrase)) };
  if (RYTHME.test(cle) && !/\b(rdv|rendez-vous|anniv)/.test(cle)) return { type: "tache", ...analyserTache(phrase, aujourdhui) };
  const brouillon = analyserPhrase(phrase, aujourdhui, membres);
  const datee = brouillon.jour !== null || brouillon.heure !== null;
  if (VERBES_TACHE.test(cle) && !brouillon.heure) return { type: "tache", ...analyserTache(phrase, aujourdhui) };
  if (datee && brouillon.titre) return { type: "agenda", brouillon };
  if (devinerCategorie(phrase) !== "autre") return { type: "jarvis", demande: phrase };
  // Une phrase avec un verbe conjugué (« la litière est faite ») : Jarvis comprend mieux.
  if (/\b(est|sont|ai|as|a|avons|ont|fait|faite|faites|fini|finie|termin[ée]e?)\b/.test(phrase.toLowerCase())) return { type: "jarvis", demande: phrase };
  // Deux ou trois mots sans verbe : ce sont des courses (« lait », « pain et beurre »).
  const mots = phrase.split(" ").length;
  if (mots <= 4 || /,| et /.test(phrase)) return { type: "courses", articles: decouperArticles(phrase) };
  return { type: "jarvis", demande: phrase };
}

/** Ce que la barre propose d'écrire, selon la page. */
export function invitation(lieu: LieuBarre): string {
  switch (lieu) {
    case "courses":
      return "Ajouter aux courses…";
    case "liste":
      return "Ajouter à la liste…";
    case "listes":
      return "Nouvelle liste, ex. cadeaux de Noël";
    case "taches":
      return "Une tâche, ex. linge chaque mercredi";
    case "entretien":
      return "Un entretien, ex. détartrer tous les 3 mois";
    case "agenda":
      return "Ex. dentiste jeudi 14h30";
    case "stock":
      return "Ex. 2 yaourts au frigo jusqu'au 25";
    case "accueil":
      return "Ajouter, demander à Jarvis…";
    default:
      return "Demander à Jarvis…";
  }
}

/** La phrase de confirmation, avec ce qui a été compris. */
export function decrireIntention(i: Intention): string {
  if (i.type === "courses" || i.type === "liste") {
    const n = i.articles.length;
    const ou = i.type === "courses" ? "aux courses" : "à la liste";
    return n === 1 ? `${i.articles[0]} ajouté ${ou}.` : `${n} articles ajoutés ${ou}.`;
  }
  if (i.type === "tache") return `Tâche « ${i.titre} » ajoutée.`;
  if (i.type === "agenda") return `« ${i.brouillon.titre} » ajouté à l'agenda.`;
  if (i.type === "stock") return "Ajouté au stock.";
  return "Je demande à Jarvis.";
}

/**
 * Une pesée écrite dans la barre de Mitsu : « 2,45 kg », « pesée 2.5 », « 2450 g ».
 * Renvoie les grammes, ou null quand la phrase n'est pas une pesée.
 */
export function lirePesee(texte: string): number | null {
  const t = sansAccents(texte.trim());
  const m = /^(?:(?:elle |il )?(?:pese|pesee|poids)\s*:?\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|grammes?)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const grammes = m[2]?.startsWith("g") ? Math.round(n) : !m[2] && n > 100 ? Math.round(n) : Math.round(n * 1000);
  return grammes >= 100 && grammes <= 15000 ? grammes : null;
}
