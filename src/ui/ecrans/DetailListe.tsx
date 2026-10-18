import { useRef, useState, type FormEvent } from "react";
import { decrireGaspillage, souventJete, trouverHabituel, type ProduitHabituel } from "../../domaine/catalogue";
import { devinerArticles, noterAchat, oublierAchat, panierHabituel, quantiteHabituelle, suggestions } from "../../domaine/habitudes";
import { analyserSaisie, basculerCoche, nouvelElement, organiserListe, trouverDoublon } from "../../domaine/listes";
import type { Element, Foyer, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";

export function DetailListe(props: {
  depot: Depot;
  foyer: Foyer;
  membreId: string | null;
  liste: Liste;
  elements: Element[];
  /** La Base du stock : ce qui finit souvent périmé y est compté. */
  catalogue?: ProduitHabituel[];
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
    await ajouterArticle(saisie);
    setSaisie("");
  }

  /** Sans quantité tapée, Kora reprend celle de d'habitude ; il prévient quand le produit finit souvent périmé. */
  async function ajouterArticle(texte: string) {
    const element = nouvelElement(props.liste, texte, props.membreId, contexteReel);
    const habituelle = courses && !element.quantite ? quantiteHabituelle(props.liste, element.texte) : null;
    await props.depot.enregistrerElement(habituelle ? { ...element, quantite: habituelle } : element);
    const base = props.catalogue ? trouverHabituel(props.catalogue, element.texte) : null;
    setMessage(base && souventJete(base) ? `${base.nom} a souvent fini périmé (${decrireGaspillage(base)}) : prends-en un peu moins.` : null);
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
  // Pendant la saisie, les articles déjà achetés qui commencent pareil.
  const tape = analyserSaisie(saisie).texte;
  const enSaisie = courses ? devinerArticles(props.liste, props.elements, tape) : [];
  const panier = courses ? panierHabituel(props.liste, props.elements) : null;

  async function commeDHabitude() {
    if (!panier?.articles.length) return;
    vibrer();
    const ajoutes = panier.articles.map((a) => {
      const e = nouvelElement(props.liste, a.texte, props.membreId, contexteReel);
      return { ...e, rayon: a.rayon, quantite: a.quantite ?? e.quantite };
    });
    for (const e of ajoutes) await props.depot.enregistrerElement(e);
    annoncer(`${ajoutes.length === 1 ? "Un article ajouté" : `${ajoutes.length} articles ajoutés`}, comme d'habitude.`, () => props.depot.supprimerElements(ajoutes.map((e) => e.id)));
  }

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
  const ajouterDevinee = (texte: string) => ajouterArticle(texte);
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
            {el.source === "chef" && <span className="etiquette-chef" title="Proposé par le Chef de la semaine">Chef</span>}
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
      {enSaisie.length > 0 && (
        <div className="puces saisie-devinee" aria-label="Déjà acheté">
          {enSaisie.map((a) => (
            <button
              key={a.texte}
              className="puce"
              onClick={() => {
                const quantite = analyserSaisie(saisie).quantite;
                void ajouterArticle(quantite ? `${quantite} ${a.texte}` : a.texte);
                setSaisie("");
              }}
            >
              {a.texte}
              {a.quantite && <span className="quantite"> · {a.quantite}</span>}
            </button>
          ))}
        </div>
      )}
      {message && <p className="discret" role="status">{message}</p>}
      {panier && panier.articles.length > 0 && !saisie && (
        <button className="carte proposition comme-habitude" onClick={() => void commeDHabitude()}>
          <span className="pictogramme"><Icone nom="panier" taille={20} /></span>
          <span className="proposition-texte">
            <strong>Comme d'habitude</strong>
            <span className="discret">
              Les courses du {panier.nomDuJour} : {panier.articles.slice(0, 4).map((a) => a.texte.toLowerCase()).join(", ")}
              {panier.articles.length > 4 ? ` et ${panier.articles.length - 4} autres` : ""}.
            </span>
          </span>
          <Icone nom="ajouter" taille={20} />
        </button>
      )}
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
