import { useState, type FormEvent } from "react";
import { creerFoyer, ErreurValidation, listesInitiales } from "../../domaine/foyer";
import type { Depot } from "../../donnees/depot";
import { choisirMembreCourant, contexteReel } from "../contexte";

export function Bienvenue({ depot, onCree }: { depot: Depot; onCree: (membreId: string) => void }) {
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
    <main className="bienvenue">
      <div className="monogramme" aria-hidden>KH</div>
      <h1>Bienvenue dans KoraHome</h1>
      <p className="discret">Votre maison, à deux, au même endroit.</p>
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
    </main>
  );
}
