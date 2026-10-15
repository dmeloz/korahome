import type { ReactNode } from "react";
import type { Souvenir } from "../domaine/memoire";
import type { RetourTest } from "../domaine/retours";
import { gestesDuJardin, type Zone } from "../domaine/jardin";
import { compterAPrendre } from "../domaine/listes";
import { decrireTemps, formaterTemperatures, meteoDu, type Meteo } from "../domaine/meteo";
import { choseAFaire, decrireAge, formaterPoids, poidsActuel, rationDuJour, type Animal } from "../domaine/mitsu";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { ProduitHabituel } from "../domaine/catalogue";
import { decrirePeremption, resumeStock, type Produit } from "../domaine/stock";
import { compterDues, decrireEcheance, organiserTaches } from "../domaine/taches";
import type { Element, Foyer, Jour, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import { organiserEntretien } from "../domaine/entretien";
import { DetailListe } from "./ecrans/DetailListe";
import { Entretien } from "./ecrans/Entretien";
import { Jardin } from "./ecrans/Jardin";
import { Listes } from "./ecrans/Listes";
import { Mitsu } from "./ecrans/Mitsu";
import { Stock } from "./ecrans/Stock";
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
  animaux: Animal[];
  produits: Produit[];
  catalogue: ProduitHabituel[];
  zones: Zone[];
  /** La météo du jardin, récente ; null hors ligne ou sans jardin. */
  meteo: Meteo | null;
  aujourdhui: Jour;
  /** La mémoire de Jarvis, qu'il relit à chaque demande. */
  souvenirs: Souvenir[];
  /** Les notes de test : les souhaits de Jarvis y vont, sans doublon. */
  retours: RetourTest[];
}

export interface PropsPage extends DonneesModule {
  depot: Depot;
  /** Ouvre une liste, par-dessus la page du module. */
  ouvrirListe: (id: string) => void;
  /** Jarvis, quand le foyer est partagé (il passe par son serveur). */
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
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

  mitsu: {
    id: "mitsu",
    picto: "chat",
    libelle: "Mitsu",
    widget: (d) => {
      const animal = d.animaux[0];
      if (!animal) return { chiffre: 0, legende: "Créer sa fiche", lignes: [], urgent: false };
      const aFaire = choseAFaire(animal, d.aujourdhui);
      const poids = poidsActuel(animal);
      const ration = rationDuJour(animal, d.aujourdhui);
      const portrait = [decrireAge(animal.naissance, d.aujourdhui), poids && formaterPoids(poids.grammes), ration && `${ration.grammes} g par jour`]
        .filter(Boolean)
        .join(" · ");
      return {
        chiffre: aFaire.length,
        legende: aFaire.length ? "à faire" : portrait,
        lignes: aFaire.length ? aFaire.slice(0, 3).map((c) => c.texte) : [],
        urgent: aFaire.some((c) => c.urgent),
      };
    },
    page: (p) => (
      <Mitsu depot={p.depot} foyer={p.foyer} membreId={p.membreId} animaux={p.animaux} listes={p.listes} elements={p.elements} />
    ),
  },

  stock: {
    id: "stock",
    picto: "frigo",
    libelle: "Frigo",
    widget: (d) => {
      const { aConsommer, urgent } = resumeStock(d.produits, d.aujourdhui);
      return {
        chiffre: aConsommer.length,
        legende:
          d.produits.length === 0
            ? "Ajoute ce qu'il y a au frigo"
            : aConsommer.length
              ? "à consommer bientôt"
              : `${pluriel(d.produits.length, "produit")}, rien ne presse`,
        lignes: aConsommer.slice(0, 3).map((p) => `${p.nom} · ${decrirePeremption(p, d.aujourdhui)}`),
        urgent,
      };
    },
    page: (p) => (
      <Stock depot={p.depot} membreId={p.membreId} produits={p.produits} catalogue={p.catalogue} listes={p.listes} elements={p.elements} aujourdhui={p.aujourdhui} />
    ),
  },

  entretien: {
    id: "entretien",
    picto: "outil",
    libelle: "Entretien",
    widget: (d) => {
      const lignes = organiserEntretien(d.taches, d.aujourdhui);
      const dus = lignes.filter((l) => l.du);
      return {
        chiffre: dus.length,
        legende: lignes.length === 0 ? "Choisis ce qui concerne la maison" : dus.length ? "à faire cette semaine" : "Rien cette semaine",
        lignes: (dus.length ? dus : lignes).slice(0, 3).map((l) => `${l.tache.titre} · ${l.quand}`),
        urgent: lignes.some((l) => l.quand.startsWith("en retard")),
      };
    },
    page: (p) => <Entretien depot={p.depot} membreId={p.membreId} taches={p.taches} aujourdhui={p.aujourdhui} />,
  },

  jardin: {
    id: "jardin",
    picto: "feuille",
    libelle: "Jardin",
    widget: (d) => {
      const jour = meteoDu(d.meteo, d.aujourdhui);
      const temps = jour ? `${decrireTemps(jour.code)} · ${formaterTemperatures(jour)}` : null;
      if (d.zones.length === 0) return { chiffre: 0, legende: "Ajoute tes pots et tes bacs", lignes: temps ? [temps] : [], urgent: false };
      const gestes = gestesDuJardin(d.zones, d.meteo, d.aujourdhui);
      const urgents = gestes.filter((g) => g.urgent);
      return {
        chiffre: urgents.length,
        legende: urgents.length ? "à faire au jardin" : (temps ?? "Rien à faire aujourd'hui"),
        lignes: gestes.slice(0, 3).map((g) => g.texte),
        urgent: urgents.length > 0,
      };
    },
    page: (p) => <Jardin {...p} />,
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
  entretien: "outil",
  jardin: "feuille",
};
