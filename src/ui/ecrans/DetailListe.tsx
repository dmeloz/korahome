import { useRef, useState, type FormEvent } from "react";
import { noterAchat, oublierAchat, suggestions } from "../../domaine/habitudes";
import { basculerCoche, nouvelElement, organiserListe, trouverDoublon } from "../../domaine/listes";
import type { Element, Foyer, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";

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
  const annoncer = useAnnoncer();

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

  const courses = props.liste.type === "courses";
  // La dernière version connue : celle qui vient d'être écrite ici, jusqu'à ce que la base renvoie la suivante.
  const derniere = useRef(props.liste);
  const recue = useRef(props.liste);
  if (recue.current !== props.liste) {
    recue.current = props.liste;
    derniere.current = props.liste;
  }
  const aujourdhui = aujourdhuiLocal();
  const devinees = courses ? suggestions(props.liste, props.elements, aujourdhui, 5) : [];

  async function basculer(el: Element) {
    vibrer();
    const apres = basculerCoche(el, contexteReel);
    await props.depot.enregistrerElement(apres);
    // Chaque achat coché apprend à Kora le rythme du foyer.
    // Plusieurs cases cochées d'affilée : chaque achat part de la version qui vient d'être écrite.
    if (courses) {
      const avant = derniere.current;
      const liste = apres.coche ? noterAchat(avant, apres, aujourdhui) : oublierAchat(avant, apres, aujourdhui);
      derniere.current = liste;
      if (liste !== avant) await props.depot.enregistrerListe(liste);
    }
  }
  const ajouterDevinee = (texte: string) => props.depot.enregistrerElement(nouvelElement(props.liste, texte, props.membreId, contexteReel));
  const viderCoches = () => props.depot.supprimerElements(coches.map((c) => c.id));
  async function supprimer(el: Element) {
    await props.depot.supprimerElements([el.id]);
    annoncer(`« ${el.texte} » supprimé.`, () => props.depot.enregistrerElement(el));
  }
  const prenom = (id: string | null) => props.foyer.membres.find((m) => m.id === id);

  function ligne(el: Element) {
    const auteur = prenom(el.ajoutePar);
    return (
      <li key={el.id}>
        <Glissable onSupprimer={() => void supprimer(el)}>
        <button className={`ligne element${el.coche ? " coche" : ""}`} onClick={() => void basculer(el)}>
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
        </Glissable>
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
      {devinees.length > 0 && (
        <section className="devinees" aria-label="Bientôt à racheter">
          <p className="surtitre">Bientôt à racheter</p>
          <div className="puces">
            {devinees.map((d) => (
              <button key={d.texte} className="puce" title={d.rythme} onClick={() => void ajouterDevinee(d.texte)}>
                + {d.texte}
              </button>
            ))}
          </div>
        </section>
      )}

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
