import type { WidgetId } from "../domaine/tableauDeBord";
import type { OngletMemoire } from "./ecrans/Memoire";

// Les pages de Kora, telles que la pile de App.tsx les empile. Les six espaces (Aujourd'hui,
// Cuisine, Maison, Organisation, Budget, Réglages) sont les pages de départ, choisies par la
// navigation ; les autres s'ouvrent par-dessus, avec leur retour.

export type Page =
  | { nom: "accueil" }
  /**
   * Un espace (sans onglet : sa page de cartes) ou l'une de ses pages (onglet : « courses », « agenda »…).
   * ancre : la carte de cette page où arriver (« carnet », « rangements »), quand on vient d'une tuile qui la montre.
   */
  | { nom: "module"; id: WidgetId; onglet?: string; ancre?: string }
  | { nom: "liste"; id: string }
  | { nom: "reglages" }
  | { nom: "partage" }
  | { nom: "notifications" }
  | { nom: "telephone" }
  | { nom: "apparence" }
  | { nom: "retours" }
  | { nom: "jarvis" }
  | { nom: "conseil" }
  | { nom: "memoire"; onglet?: OngletMemoire }
  | { nom: "mots" }
  | { nom: "bilan" }
  | { nom: "rappels" }
  | { nom: "sauvegarde" }
  | { nom: "corbeille" }
  | { nom: "fil" }
  | { nom: "calendrier" }
  | { nom: "siri" }
  | { nom: "fee" };
