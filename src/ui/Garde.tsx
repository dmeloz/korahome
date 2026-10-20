import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icone } from "./Icone";
import { noter } from "./journal";

// Le filet sous chaque page : si elle plante, ou si son code n'arrive pas à se charger
// (réseau coupé juste après une nouvelle version), l'écran ne reste pas vide. Il dit ce qui
// s'est passé, propose de réessayer ou de revenir à l'accueil, et l'erreur va dans le
// journal Dev. Équivalent natif : il n'y en a pas, SwiftUI ne laisse pas une vue planter.

interface Props {
  revenirALAccueil: (() => void) | null;
  children: ReactNode;
}

interface Etat {
  erreur: Error | null;
  essai: number;
}

/** Le code d'une page n'a pas pu être téléchargé : ce n'est pas un bogue, c'est le réseau. */
const estChargementRate = (e: Error) => /Failed to fetch dynamically imported module|Importing a module script failed|Load failed|ChunkLoadError/i.test(e.message);

export class Garde extends Component<Props, Etat> {
  state: Etat = { erreur: null, essai: 0 };

  static getDerivedStateFromError(erreur: Error): Partial<Etat> {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    noter("erreur", `${erreur.message}${info.componentStack ? ` — ${info.componentStack.trim().split("\n")[0]?.trim()}` : ""}`);
  }

  render() {
    const { erreur, essai } = this.state;
    if (!erreur) return <GardeInterieure key={essai}>{this.props.children}</GardeInterieure>;
    const reseau = estChargementRate(erreur);
    return (
      <main className="page page-secours" role="alert">
        <span className="secours-picto" aria-hidden><Icone nom={reseau ? "nuage" : "outil"} taille={28} /></span>
        <h1>{reseau ? "Cette page n'a pas pu se charger" : "Cette page n'a pas pu s'ouvrir"}</h1>
        <p className="discret">
          {reseau
            ? "Kora n'a pas réussi à télécharger cette partie de l'app. Vérifie le réseau, puis réessaie : rien n'est perdu."
            : "Quelque chose a buté dans l'affichage. Tes données sont en sécurité ; l'erreur est notée dans le journal Dev."}
        </p>
        <div className="secours-actions">
          <button className="bouton-principal" onClick={() => this.setState({ erreur: null, essai: essai + 1 })}>Réessayer</button>
          {this.props.revenirALAccueil && <button className="lien" onClick={this.props.revenirALAccueil}>Retour à l'accueil</button>}
        </div>
        <p className="secours-detail">{erreur.message}</p>
      </main>
    );
  }
}

/** Remonter la clé force React à reconstruire la page : « Réessayer » repart de zéro. */
function GardeInterieure({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** La silhouette d'une page pendant que son code arrive : un titre et trois lignes, qui respirent. */
export function Squelette() {
  return (
    <main className="page squelette" aria-busy="true" aria-label="Chargement">
      <div className="squelette-titre" />
      <div className="squelette-ligne" />
      <div className="squelette-ligne courte" />
      <div className="squelette-ligne" />
    </main>
  );
}
