import { useState, type FormEvent } from "react";
import { creerFoyer, ErreurValidation, listesInitiales } from "../../domaine/foyer";
import { normaliserCode } from "../../domaine/synchro";
import type { Depot } from "../../donnees/depot";
import { choisirMembreCourant, contexteReel } from "../contexte";

// Premier lancement. Avec le partage, le cas courant est de retrouver le foyer déjà
// créé : le code de l'autre iPhone suffit, sans compte ni rien à ressaisir. Créer un
// nouveau foyer reste possible juste en dessous.

/** Sur iPhone, Safari et l'app de l'écran d'accueil ne partagent pas leurs données. */
function dansSafariSurIPhone(): boolean {
  if (typeof navigator === "undefined" || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return false;
  const installee = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return !installee;
}

export function Bienvenue({
  depot,
  onCree,
  rejoindre,
}: {
  depot: Depot;
  onCree: (membreId: string) => void;
  /** Rejoint le foyer de ce code ; null quand l'app n'a pas de serveur partagé. */
  rejoindre: ((code: string) => Promise<void>) | null;
}) {
  const [creation, setCreation] = useState(rejoindre === null);
  return (
    <main className="bienvenue">
      <div className="monogramme" aria-hidden>KH</div>
      <h1>Bienvenue dans KoraHome</h1>
      <p className="discret">Votre maison, à deux, au même endroit.</p>
      {dansSafariSurIPhone() && (
        <div className="carte bienvenue-safari">
          <p><strong>D'abord, pose KoraHome sur l'écran d'accueil.</strong></p>
          <p className="discret">
            Touche Partager, puis « Sur l'écran d'accueil », et ouvre l'app depuis son icône. Ce qui est fait ici, dans
            Safari, n'y serait pas.
          </p>
        </div>
      )}
      {creation || !rejoindre ? <Creation depot={depot} onCree={onCree} /> : <Retrouver rejoindre={rejoindre} />}
      {rejoindre && (
        <button className="lien bienvenue-rejoindre" onClick={() => setCreation(!creation)}>
          {creation ? "Retrouver notre foyer avec son code" : "Créer un nouveau foyer"}
        </button>
      )}
    </main>
  );
}

function Retrouver({ rejoindre }: { rejoindre: (code: string) => Promise<void> }) {
  const [saisie, setSaisie] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const code = normaliserCode(saisie);

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!code) return;
    setErreur(null);
    setOccupe(true);
    try {
      await rejoindre(code);
    } catch (err) {
      setErreur(err instanceof Error && err.message ? err.message : "Ça n'a pas marché, réessaie.");
      setOccupe(false);
    }
  }

  return (
    <form onSubmit={valider} className="carte formulaire partage-choix">
      <p className="partage-etape">Retrouver notre foyer</p>
      <label>
        Code du foyer
        <input
          className="partage-saisie-code"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="K7Q-M4P"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <p className="discret">Il s'affiche sur l'autre iPhone, dans Réglages, puis Partage. Listes, tâches et Mitsu reviennent seuls.</p>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <button type="submit" className="bouton-principal" disabled={occupe || !code}>
        {occupe ? "Connexion au foyer…" : "Retrouver le foyer"}
      </button>
    </form>
  );
}

function Creation({ depot, onCree }: { depot: Depot; onCree: (membreId: string) => void }) {
  const [nom, setNom] = useState("");
  const [moi, setMoi] = useState("");
  const [autre, setAutre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider(e: FormEvent) {
    e.preventDefault();
    try {
      const foyer = creerFoyer(nom, [moi, autre], contexteReel);
      await depot.enregistrerFoyer(foyer);
      for (const liste of listesInitiales(contexteReel)) await depot.enregistrerListe(liste);
      choisirMembreCourant(foyer.membres[0].id);
      onCree(foyer.membres[0].id);
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  return (
    <form onSubmit={valider} className="carte formulaire">
      <label>
        Nom du foyer
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Chez nous" autoComplete="off" />
      </label>
      <label>
        Ton prénom
        <input value={moi} onChange={(e) => setMoi(e.target.value)} placeholder="Melo" autoComplete="given-name" />
      </label>
      <label>
        L'autre membre du foyer
        <input value={autre} onChange={(e) => setAutre(e.target.value)} placeholder="Prénom" autoComplete="off" />
      </label>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <button type="submit" className="bouton-principal">Créer notre foyer</button>
    </form>
  );
}
