import type { ReactNode } from "react";
import { compterAPrendre } from "../domaine/listes";
import type { WidgetId } from "../domaine/tableauDeBord";
import { compterDues, decrireEcheance, organiserTaches } from "../domaine/taches";
import type { Element, Foyer, Jour, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";
import { DetailListe } from "./ecrans/DetailListe";
import { Listes } from "./ecrans/Listes";
import { Taches } from "./ecrans/Taches";
import type { NomIcone } from "./Icone";

// Le squelette standard de l'app : un tableau de bord fait de widgets, et chaque
// widget ouvre sa page, qui a son bouton de retour. Un module se branche en
// ajoutant une seule entrée ici : son widget (ce qu'il montre sur l'accueil)
// et sa page. Voir docs/squelette-tableau-de-bord.md.

export interface DonneesModule {
  foyer: Foyer;
  membreId: string | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  aujourdhui: Jour;
}

export interface PropsPage extends DonneesModule {
  depot: Depot;
  /** Ouvre une liste, par-dessus la page du module. */
  ouvrirListe: (id: string) => void;
}

/** Ce qu'un widget montre sur le tableau de bord. */
export interface ApercuWidget {
  /** Le chiffre mis en avant ; rien quand il vaut zéro. */
  chiffre: number;
  legende: string;
  /** Jusqu'à trois lignes de détail. */
  lignes: string[];
  /** Un widget urgent remonte en haut du tableau de bord. */
  urgent: boolean;
}

export interface ModuleUI {
  id: WidgetId;
  picto: NomIcone;
  /** Le nom court affiché sur le bouton de retour. */
  libelle: string;
  widget: (d: DonneesModule) => ApercuWidget;
  page: (p: PropsPage) => ReactNode;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const listeCourses = (d: DonneesModule) => d.listes.find((l) => l.type === "courses");

export const MODULES: Partial<Record<WidgetId, ModuleUI>> = {
  taches: {
    id: "taches",
    picto: "coche",
    libelle: "Tâches",
    widget: (d) => {
      const dues = compterDues(d.taches, d.aujourdhui);
      const total = dues.aujourdhui + dues.enRetard;
      const aFaire = organiserTaches(d.taches, d.aujourdhui).groupes.flatMap((g) => g.taches);
      return {
        chiffre: total,
        legende:
          d.taches.length === 0
            ? "Aucune tâche pour l'instant"
            : dues.enRetard > 0
              ? `à faire, dont ${dues.enRetard} en retard`
              : dues.aujourdhui > 0
                ? "à faire aujourd'hui"
                : "Rien à faire aujourd'hui",
        lignes: aFaire.slice(0, 3).map((t) => `${t.titre} · ${decrireEcheance(t.echeance, d.aujourdhui)}`),
        urgent: total > 0,
      };
    },
    page: (p) => <Taches depot={p.depot} foyer={p.foyer} membreId={p.membreId} taches={p.taches} />,
  },

  courses: {
    id: "courses",
    picto: "panier",
    libelle: "Courses",
    widget: (d) => {
      const courses = listeCourses(d);
      const restant = courses ? compterAPrendre(courses, d.elements) : 0;
      return {
        chiffre: restant,
        legende: restant === 0 ? "Rien à acheter" : "à acheter",
        lignes: d.elements
          .filter((e) => e.listeId === courses?.id && !e.coche)
          .slice(0, 3)
          .map((e) => (e.quantite ? `${e.texte} · ${e.quantite}` : e.texte)),
        urgent: false,
      };
    },
    page: (p) => {
      const courses = listeCourses(p);
      return courses ? (
        <DetailListe depot={p.depot} foyer={p.foyer} membreId={p.membreId} liste={courses} elements={p.elements} />
      ) : (
        <main><p className="vide">La liste de courses n'existe plus.</p></main>
      );
    },
  },

  listes: {
    id: "listes",
    picto: "liste",
    libelle: "Listes",
    widget: (d) => {
      const autres = d.listes.filter((l) => l.type !== "courses");
      return {
        chiffre: autres.length,
        legende: autres.length === 0 ? "Aucune autre liste" : autres.length > 1 ? "listes" : "liste",
        lignes: autres.slice(0, 3).map((l) => {
          const n = compterAPrendre(l, d.elements);
          return n ? `${l.nom} · ${pluriel(n, "élément")}` : l.nom;
        }),
        urgent: false,
      };
    },
    page: (p) => <Listes depot={p.depot} listes={p.listes} elements={p.elements} ouvrirListe={p.ouvrirListe} />,
  },
};

/** Le pictogramme d'une section, y compris celles qui arrivent bientôt. */
export const PICTOS: Record<WidgetId, NomIcone> = {
  taches: "coche",
  courses: "panier",
  listes: "liste",
  agenda: "calendrier",
  mitsu: "chat",
  stock: "frigo",
  jardin: "feuille",
};
