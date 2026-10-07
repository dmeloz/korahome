import { useState, type FormEvent } from "react";
import { basculerCoche, nouvelElement, organiserListe, trouverDoublon } from "../../domaine/listes";
import type { Element, Foyer, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { contexteReel } from "../contexte";

export function DetailListe(props: {
  depot: Depot;
  foyer: Foyer;
  membreId: string | null;
  liste: Liste;
  elements: Element[];
}) {
  const [saisie, setSaisie] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { aPrendre, coches } = organiserListe(props.liste, props.elements);
  const siens = props.elements.filter((e) => e.listeId === props.liste.id);

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!saisie.trim()) return;
    const doublon = trouverDoublon(siens, saisie);
    if (doublon) {
      setMessage(`« ${doublon.texte} » est déjà sur la liste.`);
      return;
    }
    await props.depot.enregistrerElement(nouvelElement(props.liste, saisie, props.membreId, contexteReel));
    setSaisie("");
    setMessage(null);
  }

  const basculer = (el: Element) => props.depot.enregistrerElement(basculerCoche(el, contexteReel));
  const viderCoches = () => props.depot.supprimerElements(coches.map((c) => c.id));
  const prenom = (id: string | null) => props.foyer.membres.find((m) => m.id === id);

  function ligne(el: Element) {
    const auteur = prenom(el.ajoutePar);
    return (
      <li key={el.id}>
        <button className={`ligne element${el.coche ? " coche" : ""}`} onClick={() => basculer(el)}>
          <span className="case" aria-hidden>{el.coche ? "✓" : ""}</span>
          <span className="ligne-texte">
            {el.texte}
            {el.quantite && <span className="quantite"> · {el.quantite}</span>}
          </span>
          {auteur && props.foyer.membres.length > 1 && (
            <span className="initiale" style={{ background: auteur.couleur }} title={`Ajouté par ${auteur.prenom}`}>
              {auteur.prenom.charAt(0)}
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <main>
      <h1>{props.liste.nom}</h1>
      <form onSubmit={ajouter} className="ajout">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={props.liste.type === "courses" ? "Ajouter (ex. 2 kg de pommes)" : "Ajouter un élément"}
          enterKeyHint="done"
          autoFocus
        />
        <button type="submit" disabled={!saisie.trim()} aria-label="Ajouter">+</button>
      </form>
      {message && <p className="discret" role="status">{message}</p>}

      {aPrendre.length === 0 && coches.length === 0 && <p className="vide">La liste est vide.</p>}
      {aPrendre.map((g) => (
        <section key={g.rayon}>
          {props.liste.type === "courses" && <h2 className="rayon">{g.rayon}</h2>}
          <ul className="carte groupe">{g.elements.map(ligne)}</ul>
        </section>
      ))}

      {coches.length > 0 && (
        <section>
          <div className="entete-coches">
            <h2 className="rayon">Dans le panier ({coches.length})</h2>
            <button className="lien" onClick={viderCoches}>Vider</button>
          </div>
          <ul className="carte groupe">{coches.map(ligne)}</ul>
        </section>
      )}
    </main>
  );
}
