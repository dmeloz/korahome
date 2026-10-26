import { lazy, useEffect, type ReactNode } from "react";
import { evenementsDe, ligneWidget, resumeAgenda, type DocAgenda } from "../domaine/agenda";
import type { DocCouple } from "../domaine/bandeau";
import { paiementsAClasser } from "../domaine/paiements";
import { decrireEcheanceFacture, etatDesPots, facturesAPayer, formaterMontant, moisAConfirmer, nommerMois, planDe, type DocBudget } from "../domaine/budget";
import { menuDeLaSemaine, prochainPassage, reglageChef, type DocChef } from "../domaine/chef";
import { recetteDuSoir, recettesDe } from "../domaine/recettes";
import type { Souvenir } from "../domaine/memoire";
import type { RetourTest } from "../domaine/retours";
import { gestesDuJardin, type Zone } from "../domaine/jardin";
import { compterAPrendre } from "../domaine/listes";
import { decrireTemps, formaterTemperatures, meteoDu, type Meteo } from "../domaine/meteo";
import { choseAFaire, decrireAge, formaterPoids, poidsDeReference, rationDuJour, type Animal } from "../domaine/mitsu";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { ProduitHabituel } from "../domaine/catalogue";
import { decrirePeremption, resumeStock, type Produit } from "../domaine/stock";
import { compterDues, decaler, decrireEcheance, organiserTaches } from "../domaine/taches";
import { compterVetements, type DocVetement } from "../domaine/vetements";
import type { Element, Foyer, Jour, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";
import type { ServeurAgenda, ServeurJarvis } from "../donnees/distant";
import { organiserEntretien } from "../domaine/entretien";
import { Courses } from "./ecrans/Listes";
import { Taches } from "./ecrans/Taches";
import { vibrer } from "./haptique";
import type { NomIcone } from "./Icone";
import { Espace, Page } from "./pieces";
import { Entretien } from "./ecrans/Entretien";
import { Vetements } from "./ecrans/Vetements";
import { ignorer } from "./journal";

// Les pages les plus lourdes ne se chargent qu'à leur première ouverture : l'app démarre plus
// vite sur l'iPhone. Elles sont préchargées en silence une fois l'accueil affiché.
const PAGES_DIFFEREES = {
  Agenda: () => import("./ecrans/Agenda").then((m) => ({ default: m.Agenda })),
  Budget: () => import("./ecrans/budget/Budget").then((m) => ({ default: m.Budget })),
  Chef: () => import("./ecrans/Chef").then((m) => ({ default: m.Chef })),
  Jardin: () => import("./ecrans/Jardin").then((m) => ({ default: m.Jardin })),
  Mitsu: () => import("./ecrans/Mitsu").then((m) => ({ default: m.Mitsu })),
  Stock: () => import("./ecrans/Stock").then((m) => ({ default: m.Stock })),
};
const Agenda = lazy(PAGES_DIFFEREES.Agenda);
const Budget = lazy(PAGES_DIFFEREES.Budget);
const Chef = lazy(PAGES_DIFFEREES.Chef);
const Jardin = lazy(PAGES_DIFFEREES.Jardin);
const Mitsu = lazy(PAGES_DIFFEREES.Mitsu);
const Stock = lazy(PAGES_DIFFEREES.Stock);

/** Charge d'avance les pages différées, quand le téléphone n'a rien d'autre à faire. */
export function prechargerPages(): void {
  for (const charger of Object.values(PAGES_DIFFEREES)) void charger().catch(ignorer);
}

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
  /** Le bandeau du couple. */
  couple: DocCouple[];
  /** Les menus du Chef de la semaine et son réglage. */
  menus: DocChef[];
  /** L'agenda commun et l'état des comptes iCloud reliés. */
  agenda: DocAgenda[];
  /** Le budget du foyer : son plan, les mois versés, les dépenses. */
  budget: DocBudget[];
  /** Les vêtements : tailles, envies et pièces à trier de chacun. */
  vetements: DocVetement[];
}

export interface PropsPage extends DonneesModule {
  depot: Depot;
  /** Ouvre une liste, par-dessus la page du module. */
  ouvrirListe: (id: string) => void;
  /** Jarvis, quand le foyer est partagé (il passe par son serveur). */
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  /** La synchro de l'agenda avec iCloud, quand le foyer est partagé. */
  agendaDistant: { serveur: ServeurAgenda; foyerId: string } | null;
  /** Ouvre Réglages › Partage, quand une page a besoin du serveur du foyer. */
  ouvrirPartage: () => void;
  /** Ouvre Réglages › Calendrier de l'iPhone. */
  ouvrirCalendrier: () => void;
  /** L'onglet ouvert, quand la page en a (« listes » dans Courses, « entretien » dans Tâches, « frigo » dans Cuisine, « jardin » dans Maison). */
  onglet?: string;
  changerOnglet: (onglet: string | undefined) => void;
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
  /** Une jauge (le Budget : ce qui est dépensé sur ce qui est prévu), de 0 à 1. */
  jauge?: number;
}

export interface ModuleUI {
  id: WidgetId;
  picto: NomIcone;
  /** Le nom court affiché sur le bouton de retour. */
  libelle: string;
  widget: (d: DonneesModule) => ApercuWidget;
  /** Sa page ; un widget sans page propre ouvre un onglet de la page d'un autre module. */
  page?: (p: PropsPage) => ReactNode;
  ouvre?: { id: WidgetId; onglet: string };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const listeCourses = (d: DonneesModule) => d.listes.find((l) => l.type === "courses");


// Les widgets des sections fusionnées : Cuisine et Maison les reprennent.
const widgetMitsu = (d: DonneesModule): ApercuWidget => {
  const animal = d.animaux[0];
  if (!animal) return { chiffre: 0, legende: "Créer sa fiche", lignes: [], urgent: false };
  const aFaire = choseAFaire(animal, d.aujourdhui);
  const poids = poidsDeReference(animal);
  const ration = rationDuJour(animal, d.aujourdhui);
  const portrait = [decrireAge(animal.naissance, d.aujourdhui), poids && `${poids.estime ? "≈ " : ""}${formaterPoids(poids.grammes)}`, ration && `${ration.grammes} g par jour`]
    .filter(Boolean)
    .join(" · ");
  return {
    chiffre: aFaire.length,
    legende: aFaire.length ? "à faire" : portrait,
    lignes: aFaire.length ? aFaire.slice(0, 3).map((c) => c.texte) : [],
    urgent: aFaire.some((c) => c.urgent),
  };
};

const widgetStock = (d: DonneesModule): ApercuWidget => {
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
};

const widgetMenus = (d: DonneesModule): ApercuWidget => {
  const menu = menuDeLaSemaine(d.menus, d.aujourdhui);
  const passage = prochainPassage(reglageChef(d.menus), new Date());
  const ceSoir = recetteDuSoir(recettesDe(d.menus), d.aujourdhui);
  const soir = ceSoir ? [`Ce soir : ${ceSoir.titre}`] : [];
  if (!menu) return { chiffre: 0, legende: passage ? `Prochains menus ${passage}` : "Lance le Chef pour la semaine", lignes: soir, urgent: false };
  return {
    chiffre: menu.repas.length,
    legende: "repas cette semaine",
    lignes: [...soir, ...menu.alertesMitsu.slice(0, 1), ...menu.repas.map((r) => r.titre)].slice(0, 3),
    urgent: false,
  };
};

const widgetJardin = (d: DonneesModule): ApercuWidget => {
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
};

const widgetEntretien = (d: DonneesModule): ApercuWidget => {
  const lignes = organiserEntretien(d.taches, d.aujourdhui);
  const dus = lignes.filter((l) => l.du);
  return {
    chiffre: dus.length,
    legende: lignes.length === 0 ? "Choisis ce qui concerne la maison" : dus.length ? "à faire cette semaine" : "Rien cette semaine",
    lignes: (dus.length ? dus : lignes).slice(0, 3).map((l) => `${l.tache.titre} · ${l.quand}`),
    urgent: lignes.some((l) => l.quand.startsWith("en retard")),
  };
};

/** Maison : Mitsu et le jardin, ce qui presse d'abord ; l'entretien en retard s'y ajoute. */
function widgetMaison(d: DonneesModule): ApercuWidget {
  const mitsu = widgetMitsu(d);
  const jardin = widgetJardin(d);
  const entretien = widgetEntretien(d);
  const [premier, second] = jardin.urgent && !mitsu.urgent ? [jardin, mitsu] : [mitsu, jardin];
  const chiffre = mitsu.chiffre + jardin.chiffre;
  const nom = d.animaux[0]?.nom ?? "Mitsu";
  return {
    chiffre,
    legende: !chiffre ? mitsu.legende : mitsu.chiffre && jardin.chiffre ? `à faire pour ${nom} et au jardin` : premier.chiffre ? premier.legende : second.legende,
    lignes: [...premier.lignes, ...second.lignes, ...(entretien.urgent ? entretien.lignes.slice(0, 1).map((l) => `Entretien : ${l}`) : [])].slice(0, 3),
    urgent: mitsu.urgent || jardin.urgent || entretien.urgent,
  };
}

/** Cuisine : les menus de la semaine, et ce qui arrive à sa date au frigo. */
function widgetCuisine(d: DonneesModule): ApercuWidget {
  const menus = widgetMenus(d);
  const frigo = widgetStock(d);
  if (!frigo.urgent) return menus;
  return { ...menus, lignes: [...frigo.lignes.slice(0, 1).map((l) => `Frigo : ${l}`), ...menus.lignes].slice(0, 3), urgent: true };
}

/** L'onglet de Maison qui s'ouvre : Mitsu s'il presse, sinon le jardin, sinon l'entretien dû, sinon Mitsu. */
const ongletMaison = (d: DonneesModule): "entretien" | "mitsu" | "jardin" =>
  widgetMitsu(d).urgent ? "mitsu" : widgetJardin(d).urgent ? "jardin" : widgetEntretien(d).chiffre > 0 ? "entretien" : "mitsu";

/** Cuisine (0.0.75) : les courses et les autres listes, les menus de la semaine, les recettes et le frigo. */
function PageCuisine(p: PropsPage) {
  // « recette:<id> » : une recette trouvée par la recherche, ouverte sur l'onglet Recettes.
  const recette = p.onglet?.startsWith("recette:") ? p.onglet.slice("recette:".length) : null;
  const aConsommer = resumeStock(p.produits, p.aujourdhui).aConsommer.length;
  const courses = listeCourses(p);
  const aPrendre = courses ? compterAPrendre(courses, p.elements) : 0;
  // Sans onglet demandé (0.0.77, choix de Melo) : les courses s'il y a quelque chose à acheter, sinon les menus.
  const onglet =
    p.onglet === "courses" || p.onglet === "listes"
      ? "courses"
      : p.onglet === "recettes" || recette
        ? "recettes"
        : p.onglet === "frigo"
          ? "frigo"
          : p.onglet === "semaine" || aPrendre === 0
            ? "semaine"
            : "courses";
  return (
    <Espace
      titre="Cuisine"
      libelle="Courses, menus, recettes ou frigo"
      onglets={[
        { id: "courses", libelle: "Courses", compte: aPrendre },
        { id: "semaine", libelle: "Menus" },
        { id: "recettes", libelle: "Recettes", compte: recettesDe(p.menus).length },
        { id: "frigo", libelle: "Frigo", compte: aConsommer },
      ] as const}
      actif={onglet}
      changer={(o) => {
        vibrer();
        p.changerOnglet(o);
      }}
    >
      {onglet === "courses" ? (
        // Les puces Courses et Autres listes de la page restent sous les onglets de Cuisine.
        <Courses {...p} onglet={p.onglet === "listes" ? "listes" : undefined} changerOnglet={(o) => p.changerOnglet(o ?? "courses")} />
      ) : onglet === "frigo" ? (
        <Stock depot={p.depot} membreId={p.membreId} produits={p.produits} catalogue={p.catalogue} listes={p.listes} elements={p.elements} aujourdhui={p.aujourdhui} jarvis={p.jarvis} donnees={p} />
      ) : (
        <Chef {...p} onglet={onglet} recette={recette} />
      )}
    </Espace>
  );
}

/** Organisation (0.0.75) : les tâches, l'agenda et les démarches administratives. */
function PageOrganisation(p: PropsPage) {
  const onglet = p.onglet === "agenda" || p.onglet === "administratif" ? p.onglet : "taches";
  return (
    <Espace
      titre="Organisation"
      libelle="Tâches, agenda ou administratif"
      onglets={[
        { id: "taches", libelle: "Tâches" },
        { id: "agenda", libelle: "Agenda" },
        { id: "administratif", libelle: "Administratif" },
      ] as const}
      actif={onglet}
      changer={(o) => {
        vibrer();
        p.changerOnglet(o === "taches" ? undefined : o);
      }}
    >
      {onglet === "agenda" ? (
        <Agenda {...p} />
      ) : (
        <Taches depot={p.depot} foyer={p.foyer} membreId={p.membreId} taches={p.taches} administratif={onglet === "administratif"} />
      )}
    </Espace>
  );
}

/** Maison : l'entretien, Mitsu et le jardin, chacun dans son onglet. */
function PageMaison(p: PropsPage) {
  const onglet = p.onglet === "jardin" || p.onglet === "mitsu" || p.onglet === "entretien" || p.onglet === "vetements" ? p.onglet : null;
  const { changerOnglet } = p;
  const parDefaut = ongletMaison(p);
  // L'onglet choisi à l'ouverture reste en place, même si l'urgence change en route.
  useEffect(() => {
    if (!onglet) changerOnglet(parDefaut);
  }, [onglet, parDefaut, changerOnglet]);
  const actif = onglet ?? parDefaut;
  return (
    <Espace
      titre="Maison"
      libelle="Entretien, Mitsu, jardin ou vêtements"
      onglets={[
        { id: "entretien", libelle: "Entretien", compte: widgetEntretien(p).chiffre },
        { id: "mitsu", libelle: p.animaux[0]?.nom ?? "Mitsu" },
        { id: "jardin", libelle: "Jardin" },
        { id: "vetements", libelle: "Vêtements", compte: compterVetements(p.vetements, p.membreId, `${p.aujourdhui}T12:00:00.000Z`) },
      ] as const}
      actif={actif}
      changer={(o) => {
        vibrer();
        changerOnglet(o);
      }}
    >
      {actif === "jardin" ? (
        <Jardin {...p} />
      ) : actif === "vetements" ? (
        <Page titre="Vêtements" sousTitre="Tailles, envies, à trier" aide={{ cle: "vetements-aide", texte: "Les tailles et les envies de chacun, partagées : de quoi trouver un cadeau qui va." }}>
          <Vetements depot={p.depot} foyer={p.foyer} membreId={p.membreId} vetements={p.vetements} aujourdhui={p.aujourdhui} />
        </Page>
      ) : actif === "entretien" ? (
        <Page titre="Entretien" sousTitre="Ce qui revient pour la maison">
          <Entretien depot={p.depot} membreId={p.membreId} taches={p.taches} aujourdhui={p.aujourdhui} />
        </Page>
      ) : (
        <Mitsu depot={p.depot} foyer={p.foyer} membreId={p.membreId} animaux={p.animaux} listes={p.listes} elements={p.elements} />
      )}
    </Espace>
  );
}

export const MODULES: Partial<Record<WidgetId, ModuleUI>> = {
  taches: {
    id: "taches",
    picto: "coche",
    libelle: "Organisation",
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
    page: (p) => <PageOrganisation {...p} />,
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
    ouvre: { id: "chef", onglet: "courses" },
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
    ouvre: { id: "chef", onglet: "listes" },
  },

  agenda: {
    id: "agenda",
    picto: "calendrier",
    libelle: "Agenda",
    widget: (d) => {
      const { aujourdhui, semaine } = resumeAgenda(evenementsDe(d.agenda), d.animaux, d.aujourdhui);
      const prochain = semaine[0];
      return {
        chiffre: aujourdhui.length,
        legende: aujourdhui.length
          ? "aujourd'hui"
          : prochain
            ? `Rien aujourd'hui, ${pluriel(semaine.length, "événement")} cette semaine`
            : "Rien de prévu cette semaine",
        lignes: [...aujourdhui, ...semaine].slice(0, 3).map((o) => ligneWidget(o, d.aujourdhui)),
        urgent: false,
      };
    },
    ouvre: { id: "taches", onglet: "agenda" },
  },

  maison: {
    id: "maison",
    picto: "maison",
    libelle: "Maison",
    widget: widgetMaison,
    page: (p) => <PageMaison {...p} />,
  },

  mitsu: {
    id: "mitsu",
    picto: "chat",
    libelle: "Mitsu",
    widget: widgetMitsu,
    ouvre: { id: "maison", onglet: "mitsu" },
  },

  stock: {
    id: "stock",
    picto: "frigo",
    libelle: "Frigo et placards",
    widget: widgetStock,
    ouvre: { id: "chef", onglet: "frigo" },
  },

  entretien: {
    id: "entretien",
    picto: "outil",
    libelle: "Entretien",
    widget: widgetEntretien,
    ouvre: { id: "maison", onglet: "entretien" },
  },

  jardin: {
    id: "jardin",
    picto: "feuille",
    libelle: "Jardin",
    widget: widgetJardin,
    ouvre: { id: "maison", onglet: "jardin" },
  },

  chef: {
    id: "chef",
    picto: "toque",
    libelle: "Cuisine",
    widget: widgetCuisine,
    page: (p) => <PageCuisine {...p} />,
  },

  budget: {
    id: "budget",
    picto: "portefeuille",
    libelle: "Budget",
    widget: (d) => {
      const plan = planDe(d.budget);
      if (!plan) return { chiffre: 0, legende: "Le budget du foyer, à commencer", lignes: [], urgent: false };
      const pots = etatDesPots(plan, d.budget, d.aujourdhui);
      const aPayer = facturesAPayer(plan, d.budget, d.aujourdhui, 14);
      const courses = pots.courses;
      const aNoter = moisAConfirmer(plan, d.budget, d.aujourdhui);
      const aClasser = paiementsAClasser(d.budget).length;
      return {
        chiffre: Math.max(0, Math.floor(courses.solde)),
        legende: aNoter ? (aNoter > plan.depart.mois ? `${nommerMois(decaler(`${aNoter}-01`, { unite: "mois", tous: -1 }).slice(0, 7)).replace(/^./, (c) => c.toUpperCase())} à clôturer` : `Versements de ${nommerMois(aNoter)} à noter`) : courses.solde < 1 ? "Carte courses vide" : "CHF sur la carte courses",
        lignes: [
          ...(aClasser ? [aClasser === 1 ? "Un paiement à classer" : `${aClasser} paiements à classer`] : []),
          `Plaisir : ${formaterMontant(pots.plaisir.solde)}`,
          ...aPayer.slice(0, 1).map((f) => `${f.poste.libelle} · ${decrireEcheanceFacture(f.echeance, d.aujourdhui)}`),
          `Épargne : ${formaterMontant(pots.epargne.solde)}`,
        ].slice(0, 3),
        urgent: aPayer.some((f) => f.echeance <= d.aujourdhui),
        jauge: courses.budgetDuMois > 0 ? Math.min(1, courses.depenseDuMois / courses.budgetDuMois) : undefined,
      };
    },
    page: (p) => <Budget {...p} />,
  },
};

/** Le pictogramme d'une section, y compris celles qui arrivent bientôt. */
export const PICTOS: Record<WidgetId, NomIcone> = {
  taches: "coche",
  courses: "panier",
  listes: "liste",
  agenda: "calendrier",
  maison: "maison",
  mitsu: "chat",
  stock: "frigo",
  entretien: "outil",
  jardin: "feuille",
  chef: "toque",
  budget: "portefeuille",
  infos: "dossier",
};
