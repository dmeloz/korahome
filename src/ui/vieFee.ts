import { useEffect, useRef } from "react";
import type { CarteDuJour, ChoseDuJour, DestinationChose } from "../domaine/aujourdhui";
import { comptesAVenir, type DocCouple } from "../domaine/bandeau";
import { decrireTemps, formaterTemperatures, meteoDu, type Meteo } from "../domaine/meteo";
import type { Element, Id, Jour, Liste, Tache } from "../domaine/types";
import {
  alerteAFaire,
  allureMeteo,
  eclatDuFoyer,
  estLaNuit,
  jourAMontrerLaNuit,
  jourJ,
  minuscule,
  nouveautesDeLAutre,
  nuitApprise,
  resumeDuMatin,
  tacheDeLHeure,
} from "../domaine/vieFee";
import { changerEtatFee, direSiCalme, estEveillee, feteFee, lireEtatFee, tinter, type Parole } from "./fee";
import { lireUsages } from "./usage";

// Le moteur de la vie de la fée, sur l'accueil : il regarde le foyer toutes les vingt secondes
// et décide si elle dort, scintille près d'un widget, rappelle une tâche à son heure, fête un
// jour J ou dit bonjour au réveil. Les règles sont dans `domaine/vieFee.ts`.

const minuteDuJour = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** La nuit en ce moment, et le jour que l'accueil montre (demain, une fois la nuit tombée le soir). */
export function nuitDeCeTelephone(aujourdhui: Jour, maintenant = new Date()): { nuit: boolean; montrer: "demain" | "aujourdhui" } {
  const n = nuitApprise(lireUsages(), aujourdhui);
  const m = minuteDuJour(maintenant);
  const nuit = estLaNuit(m, n) && !estEveillee();
  return { nuit, montrer: nuit ? jourAMontrerLaNuit(m, n) : "aujourdhui" };
}

// ----- Ce qu'elle a déjà fait aujourd'hui (par téléphone) -----

function lireDuJour(cle: string, jour: Jour): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(cle) ?? "null") as { jour?: string; cles?: unknown } | null;
    return v?.jour === jour && Array.isArray(v.cles) ? new Set(v.cles.filter((c): c is string => typeof c === "string")) : new Set();
  } catch {
    return new Set();
  }
}
function noterDuJour(cle: string, jour: Jour, cles: Set<string>): void {
  try {
    localStorage.setItem(cle, JSON.stringify({ jour, cles: [...cles] }));
  } catch {
    // Vaut pour cette visite.
  }
}

const CLE_ALERTES = "korahome.feeAlertes";
const CLE_HEURES = "korahome.feeHeures";
const CLE_RITUELS = "korahome.feeRituels";
const CLE_COURSES_VUES = "korahome.feeCoursesVues";
const CLE_COURSES_DIT = "korahome.feeCoursesDit";
/** Elle ne parle des courses ajoutées par l'autre qu'une fois par heure au plus. */
const ENTRE_COURSES_MS = 60 * 60_000;
/** Une alerte que personne ne touche cesse de scintiller après deux minutes. */
const ALERTE_MS = 2 * 60_000;
const TICK_MS = 20_000;
const SUR_LA_DATE = ".page-dessus .grande-date .date-chiffre";

function lireCoursesVues(): Set<string> | null {
  try {
    const brut = localStorage.getItem(CLE_COURSES_VUES);
    return brut === null ? null : new Set(JSON.parse(brut) as string[]);
  } catch {
    return new Set();
  }
}

export interface EntreeVie {
  actif: boolean;
  aujourdhui: Jour;
  carte: CarteDuJour;
  taches: readonly Tache[];
  membreId: Id | null;
  autre: string | null;
  couple: readonly DocCouple[];
  meteo: Meteo | null;
  listes: readonly Liste[];
  elements: readonly Element[];
  /** Le prochain rendez-vous, déjà dit en une ligne (« Jeu. 14:30 · Dentiste »). */
  rdv: string | null;
  ouvrir: (destination: DestinationChose | "courses") => void;
  cocher: (c: ChoseDuJour) => void;
  /** « Dans 15 min » : l'heure de la tâche recule d'un quart d'heure. */
  repousser: (c: ChoseDuJour) => void;
}

export function useVieFee(e: EntreeVie): void {
  const entree = useRef(e);
  entree.current = e;
  const finAlerte = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const etaitNuit = useRef<boolean | null>(null);

  useEffect(() => {
    if (!e.actif) return;
    const vivre = () => {
      const x = entree.current;
      const maintenant = new Date();
      const jour = x.aujourdhui;
      const { nuit } = nuitDeCeTelephone(jour, maintenant);
      document.documentElement.classList.toggle("nuit-kora", nuit);

      // La nuit, elle dort sur la date ; rien d'autre.
      if (nuit) {
        etaitNuit.current = true;
        changerEtatFee({ nuit: true, alerte: null, cible: SUR_LA_DATE, allure: null });
        return;
      }
      const vie = lireEtatFee();
      changerEtatFee({
        nuit: false,
        eclat: eclatDuFoyer(x.carte, hhmm(maintenant)),
        allure: allureMeteo(x.meteo, jour),
        cible: vie.cible === SUR_LA_DATE ? null : vie.cible,
      });
      const rituels = lireDuJour(CLE_RITUELS, jour);

      // Le réveil : le premier matin où elle ne dort plus, elle s'étire et résume la journée.
      if (!rituels.has("reveil") && maintenant.getHours() < 12) {
        const m = meteoDu(x.meteo, jour);
        const parole: Parole = {
          cle: `reveil:${jour}`,
          texte: resumeDuMatin(x.carte, { rdv: x.rdv ? `${x.rdv}.` : null, meteo: m ? `${formaterTemperatures(m)}, ${decrireTemps(m.code).toLowerCase()}.` : null }),
        };
        if (etaitNuit.current) {
          changerEtatFee({ etire: true });
          setTimeout(() => changerEtatFee({ etire: false }), 2400);
        }
        if (direSiCalme(parole)) {
          rituels.add("reveil");
          noterDuJour(CLE_RITUELS, jour, rituels);
          etaitNuit.current = false;
          return;
        }
      }

      // L'heure d'une tâche : elle le dit tout de suite, même à une heure où elle se tait.
      const dites = lireDuJour(CLE_HEURES, jour);
      const t = tacheDeLHeure(x.carte, x.taches, x.membreId, hhmm(maintenant), dites);
      if (t) {
        const parole: Parole = {
          cle: `heure:${t.cle}`,
          texte: `C'est l'heure : ${minuscule(t.texte)}.`,
          actions: [
            { texte: "C'est fait", faire: () => entree.current.cocher(t) },
            {
              texte: "Dans 15 min",
              faire: () => {
                const d = lireDuJour(CLE_HEURES, jour);
                d.delete(t.cle);
                noterDuJour(CLE_HEURES, jour, d);
                entree.current.repousser(t);
              },
            },
          ],
        };
        if (direSiCalme(parole, true)) {
          tinter();
          dites.add(t.cle);
          noterDuJour(CLE_HEURES, jour, dites);
          return;
        }
      }

      // Une chose urgente : elle file au coin de son widget et scintille ; la toucher la fait parler.
      const signalees = lireDuJour(CLE_ALERTES, jour);
      const a = vie.alerte ? null : alerteAFaire(x.carte, signalees);
      if (a) {
        const cible = `.page-dessus [data-widget="${a.destination}"]`;
        const finir = () => changerEtatFee({ cible: null });
        changerEtatFee({
          alerte: {
            cle: `alerte:${a.cle}`,
            texte: a.quand && a.quand !== "aujourd'hui" ? `${a.texte}, ${a.quand}.` : `${a.texte}.`,
            actions: [
              { texte: "Ouvrir", faire: () => (finir(), entree.current.ouvrir(a.destination)) },
              { texte: "Plus tard", faire: finir },
            ],
          },
          cible: document.querySelector(cible) ? cible : null,
        });
        tinter();
        signalees.add(a.cle);
        noterDuJour(CLE_ALERTES, jour, signalees);
        clearTimeout(finAlerte.current);
        finAlerte.current = setTimeout(() => {
          if (lireEtatFee().alerte) changerEtatFee({ alerte: null, cible: null });
        }, ALERTE_MS);
        return;
      }

      // Le jour J d'un compte à rebours : elle fête, une fois.
      const fete = rituels.has("jourJ") ? null : jourJ(comptesAVenir(x.couple, jour), jour);
      if (fete && direSiCalme({ cle: `jourJ:${jour}`, texte: fete })) {
        feteFee();
        rituels.add("jourJ");
        noterDuJour(CLE_RITUELS, jour, rituels);
        return;
      }

      // Ce que l'autre a ajouté aux courses : elle va voir, une fois par heure au plus.
      const courses = x.listes.find((l) => l.type === "courses")?.id ?? null;
      const vues = lireCoursesVues();
      const ids = x.elements.filter((el) => el.listeId === courses).map((el) => el.id);
      if (vues === null) {
        // La première fois, ce qui est déjà là compte comme vu.
        localStorage.setItem(CLE_COURSES_VUES, JSON.stringify(ids));
        return;
      }
      const nouveautes = nouveautesDeLAutre(x.elements, courses, x.membreId, vues);
      const dernier = Number(localStorage.getItem(CLE_COURSES_DIT) ?? 0);
      if (nouveautes.length && x.autre && Date.now() - dernier > ENTRE_COURSES_MS && !vie.alerte) {
        const noms = nouveautes.slice(0, 3).map((n) => minuscule(n.texte));
        const liste = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
        const plus = nouveautes.length > 3 ? ` et ${nouveautes.length - 3} autre${nouveautes.length > 4 ? "s" : ""}` : "";
        const cible = '.page-dessus [data-widget="courses"]';
        const finir = () => changerEtatFee({ cible: null });
        const dit = direSiCalme({
          cle: `courses:${nouveautes[0].id}`,
          texte: `${x.autre} a ajouté ${liste}${plus} aux courses.`,
          actions: [{ texte: "Voir", faire: () => (finir(), entree.current.ouvrir("courses")) }, { texte: "Merci", faire: finir }],
          sansSuite: finir,
        });
        if (dit) {
          if (document.querySelector(cible)) changerEtatFee({ cible });
          try {
            localStorage.setItem(CLE_COURSES_DIT, String(Date.now()));
            localStorage.setItem(CLE_COURSES_VUES, JSON.stringify(ids));
          } catch {
            // Elle en reparlera.
          }
        }
      }
    };
    const premier = setTimeout(vivre, 1500);
    const id = setInterval(vivre, TICK_MS);
    return () => {
      clearTimeout(premier);
      clearInterval(id);
    };
  }, [e.actif]);

  // En quittant l'accueil, elle quitte le widget ou la date et la page n'est plus assombrie.
  useEffect(() => {
    if (e.actif) return;
    document.documentElement.classList.remove("nuit-kora");
    changerEtatFee({ cible: null, alerte: null });
  }, [e.actif]);
  useEffect(() => () => clearTimeout(finAlerte.current), []);
}
