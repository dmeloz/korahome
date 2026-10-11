// La saisie du stock en une phrase, tapée ou dictée au clavier de l'iPhone :
// « 2 yaourts au frigo jusqu'à vendredi », « 500 g de beurre congélo 3 mois ».
// On y lit le nom, la quantité, le lieu et la date ; ce qui n'est pas dit reste à null.

import type { Lieu, Unite } from "./stock";
import { decaler, ecartJours } from "./taches";
import type { Jour } from "./types";

export interface SaisieComprise {
  nom: string;
  nombre: number | null;
  unite: Unite | null;
  lieu: Lieu | null;
  peremption: Jour | null;
}

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, cinquante: 50, cent: 100, demi: 0.5,
};
const NOMBRE = `(\\d+(?:[.,]\\d+)?|${Object.keys(NOMBRES).join("|")})`;
const lireNombre = (s: string) => NOMBRES[s.toLowerCase()] ?? Number(s.replace(",", "."));

const LIEUX_DITS: [RegExp, Lieu][] = [
  [/(?:au |dans le |le )?(?:cong[ée]lateur|cong[ée]lo|congel|freezer|surgel[ée]s?)\b/i, "congelateur"],
  [/(?:au |dans le |le )?(?:frigo|r[ée]frig[ée]rateur|frigidaire)\b/i, "frigo"],
  [/(?:au |à la |dans le |dans la |le |la )?(?:placard|cellier|garde-manger|cave|armoire)\b/i, "placard"],
];

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const AVANT = `(?:(?:à consommer |a consommer )?(?:jusqu'(?:au|à|a)|avant(?: le)?|pour|le|dlc|date)\\s+)?`;

const UNITES_DITES: [RegExp, Unite, number][] = [
  [/^(?:kg|kilos?|kilogrammes?)$/i, "kg", 1],
  [/^(?:g|gr|grammes?)$/i, "g", 1],
  [/^(?:l|litres?)$/i, "l", 1],
  [/^(?:cl|centilitres?)$/i, "ml", 10],
  [/^(?:ml|millilitres?)$/i, "ml", 1],
  [/^(?:pièces?|pieces?|x)$/i, "piece", 1],
];
const UNITE = "(kg|kilos?|kilogrammes?|grammes?|gr|g|litres?|l|centilitres?|cl|millilitres?|ml|pièces?|pieces?|x)";

function lireUnite(mot: string | undefined): { unite: Unite; facteur: number } | null {
  if (!mot) return null;
  for (const [re, unite, facteur] of UNITES_DITES) if (re.test(mot)) return { unite, facteur };
  return null;
}

/** La prochaine fois que tombe ce jour du mois (aujourd'hui compris). */
function prochainJourDuMois(jourDuMois: number, mois: number | null, annee: number | null, aujourdhui: Jour): Jour | null {
  const [a, m] = aujourdhui.split("-").map(Number);
  const essai = (an: number, mo: number): Jour | null => {
    const d = new Date(Date.UTC(an, mo - 1, jourDuMois));
    if (d.getUTCMonth() !== mo - 1) return null;
    return d.toISOString().slice(0, 10);
  };
  if (mois !== null) {
    const an = annee ?? a;
    const j = essai(an, mois);
    if (!j) return null;
    return annee === null && ecartJours(aujourdhui, j) < 0 ? essai(an + 1, mois) : j;
  }
  const ceMois = essai(a, m);
  if (ceMois && ecartJours(aujourdhui, ceMois) >= 0) return ceMois;
  return m === 12 ? essai(a + 1, 1) : essai(a, m + 1);
}

/** Cherche une date dans la phrase ; rend la date et la phrase sans elle. */
function trouverDate(s: string, aujourdhui: Jour): { jour: Jour; reste: string } | null {
  const essais: [RegExp, (m: RegExpMatchArray) => Jour | null][] = [
    // 16.10, 16/10, 16.10.26, 16/10/2026
    [new RegExp(`${AVANT}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?\\b`, "i"), (m) => {
      const an = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
      return prochainJourDuMois(Number(m[1]), Number(m[2]), an, aujourdhui);
    }],
    // 16 octobre
    [new RegExp(`${AVANT}(\\d{1,2})(?:er)?\\s+(${MOIS.join("|")}|fevrier|aout|decembre)\\b`, "i"), (m) => {
      const nom = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const mois = MOIS.findIndex((x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "") === nom) + 1;
      return prochainJourDuMois(Number(m[1]), mois, null, aujourdhui);
    }],
    [/(?:jusqu'(?:à|a) |pour )?apr[èe]s-demain\b/i, () => decaler(aujourdhui, { unite: "jour", tous: 2 })],
    [/(?:jusqu'(?:à|a) |pour )?demain\b/i, () => decaler(aujourdhui, { unite: "jour", tous: 1 })],
    [/(?:jusqu'(?:à|a) |pour )?aujourd'hui\b/i, () => aujourdhui],
    // vendredi : le prochain, jamais aujourd'hui
    [new RegExp(`(?:jusqu'(?:à|a)|avant|pour)?\\s*(${JOURS.join("|")})(?: prochain)?\\b`, "i"), (m) => {
      const cible = JOURS.indexOf(m[1].toLowerCase());
      const [a, mo, j] = aujourdhui.split("-").map(Number);
      const actuel = new Date(Date.UTC(a, mo - 1, j)).getUTCDay();
      const ecart = ((cible - actuel + 7) % 7) || 7;
      return decaler(aujourdhui, { unite: "jour", tous: ecart });
    }],
    // dans 3 jours, 1 semaine, 2 mois, un an
    [new RegExp(`(?:dans |encore |pendant )?${NOMBRE}\\s+(jours?|semaines?|mois|ans?)\\b`, "i"), (m) => {
      const n = lireNombre(m[1]);
      if (!Number.isInteger(n)) return null;
      const u = m[2].toLowerCase();
      if (u.startsWith("jour")) return decaler(aujourdhui, { unite: "jour", tous: n });
      if (u.startsWith("semaine")) return decaler(aujourdhui, { unite: "semaine", tous: n });
      if (u === "mois") return decaler(aujourdhui, { unite: "mois", tous: n });
      return decaler(aujourdhui, { unite: "mois", tous: 12 * n });
    }],
    // le 16
    [/(?:jusqu'(?:au|à|a)|avant le|le)\s+(\d{1,2})(?:er)?\b(?!\s*(?:kg|g|l|ml|cl|x)\b)/i, (m) => prochainJourDuMois(Number(m[1]), null, null, aujourdhui)],
  ];
  for (const [re, lire] of essais) {
    const m = s.match(re);
    if (!m || m.index === undefined) continue;
    const jour = lire(m);
    if (jour) return { jour, reste: `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}` };
  }
  return null;
}

const MOTS_DE_LIAISON = /^(?:,|et|au|aux|à|a|le|la|les|dans|de|du|des|d'|pour|jusqu'au|jusqu'à)\s+|\s+(?:,|et|au|aux|à|a|le|la|les|dans|de|du|des|pour|jusqu'au|jusqu'à)$/i;

function nettoyer(s: string): string {
  let r = s.replace(/\s+/g, " ").replace(/\s*(?:(?<!\d),|,(?!\d))\s*/g, " ").trim();
  let avant = "";
  while (avant !== r) {
    avant = r;
    r = r.replace(MOTS_DE_LIAISON, "").trim();
  }
  return r;
}

/** Lit une phrase de stock. Le nom garde l'écriture de la personne, avec une majuscule. */
export function comprendreSaisie(texte: string, aujourdhui: Jour): SaisieComprise {
  let s = ` ${texte.replace(/[’]/g, "'").replace(/\s+/g, " ").trim()} `;

  let lieu: Lieu | null = null;
  for (const [re, l] of LIEUX_DITS) {
    const m = s.match(re);
    if (m && m.index !== undefined) {
      lieu = l;
      s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`;
      break;
    }
  }

  let peremption: Jour | null = null;
  const date = trouverDate(s, aujourdhui);
  if (date) {
    peremption = date.jour;
    s = date.reste;
  }

  s = nettoyer(s);
  let nombre: number | null = null;
  let unite: Unite | null = null;
  // « 500 g de beurre », « 2 yaourts », « une douzaine d'œufs », « 1,5l lait »
  const debut = s.match(new RegExp(`^${NOMBRE}\\s*${UNITE}?(?:\\s+|$)(?:de\\s+|d')?(.*)$`, "i"));
  const douzaine = s.match(/^(?:une\s+)?douzaine\s+(?:de\s+|d')?(.*)$/i);
  const fin = s.match(new RegExp(`^(.+?)\\s+(?:x\\s*)?${NOMBRE}\\s*${UNITE}?$`, "i"));
  if (douzaine) {
    nombre = 12;
    unite = "piece";
    s = douzaine[1];
  } else if (debut && debut[3].trim()) {
    const u = lireUnite(debut[2]);
    nombre = lireNombre(debut[1]) * (u?.facteur ?? 1);
    unite = u?.unite ?? "piece";
    s = debut[3];
  } else if (fin) {
    const u = lireUnite(fin[3]);
    nombre = lireNombre(fin[2]) * (u?.facteur ?? 1);
    unite = u?.unite ?? "piece";
    s = fin[1];
  }

  const nom = nettoyer(s);
  return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), nombre, unite, lieu, peremption };
}
