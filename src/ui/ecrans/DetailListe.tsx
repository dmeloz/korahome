import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ProduitHabituel } from "../../domaine/catalogue";
import { devinerArticles, noterAchat, oublierAchat, panierHabituel, suggestions } from "../../domaine/habitudes";
import { analyserSaisie, basculerCoche, nouvelElement, organiserListe } from "../../domaine/listes";
import type { Element, Foyer, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Ligne, ListeVivante } from "../moteur/pieces";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { ajouterArticles } from "../ajouts";
import { AuDessusDeLaBarre, Page, useSaisieBarre } from "../pieces";

// Une liste (les courses ou une autre). On ajoute en le disant à la fée ; ce qui
// est tapé fait apparaître les articles déjà achetés. Toucher ou glisser vers la droite
// coche ; la ligne reste barrée deux secondes avant de rejoindre le panier, pour voir ce
// qu'on vient de cocher et se rattraper.

/** Le temps pendant lequel un article coché reste à sa place, barré. */
const RESTE_BARRE_MS = 2000;

export function DetailListe(props: {
  depot: Depot;
  foyer: Foyer;
  membreId: string | null;
  liste: Liste;
  elements: Element[];
  /** La Base du stock : ce qui finit souvent périmé y est compté. */
  catalogue?: ProduitHabituel[];
  /** Ce qui vient sous le titre (les onglets de la page Courses). */
  avant?: ReactNode;
}) {
  const { texte: saisie, changer: setSaisie } = useSaisieBarre();
  const [message, setMessage] = useState<string | null>(null);
  // Les articles cochés il y a moins de deux secondes restent à leur place, barrés.
  const [recents, setRecents] = useState<ReadonlySet<string>>(new Set());
  const minuteries = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);
  const elementsVus = props.elements.map((e) => (recents.has(e.id) && e.coche ? { ...e, coche: false } : e));
  const { aPrendre, coches } = organiserListe(props.liste, elementsVus);
  const annoncer = useAnnoncer();

  /** Sans quantité tapée, Kora reprend celle de d'habitude ; il prévient quand le produit finit souvent périmé. */
  async function ajouterArticle(texte: string) {
    const r = await ajouterArticles(props.depot, props.liste, props.elements, [texte], props.membreId, props.catalogue);
    setMessage(r.doublons.length ? `« ${r.doublons[0]} » est déjà sur la liste.` : r.conseil);
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
    if (apres.coche) {
      clearTimeout(minuteries.current.get(el.id));
      setRecents((r) => new Set(r).add(el.id));
      minuteries.current.set(
        el.id,
        setTimeout(() => {
          minuteries.current.delete(el.id);
          setRecents((r) => {
            const s = new Set(r);
            s.delete(el.id);
            return s;
          });
        }, RESTE_BARRE_MS),
      );
    }
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

  // Le premier article à prendre, en grand.
  const phare = aPrendre[0]?.elements.find((e) => !e.coche)?.id ?? null;

  function ligne(vu: Element) {
    // La version enregistrée : un article coché il y a un instant est barré, mais encore à sa place.
    const el = props.elements.find((e) => e.id === vu.id) ?? vu;
    const auteur = prenom(el.ajoutePar);
    // Le prénom de qui l'a ajouté, seulement quand ce n'est pas soi.
    const autre = auteur && auteur.id !== props.membreId && props.foyer.membres.length > 1;
    return (
      <Ligne key={el.id} className={el.id === phare ? "phare-ligne" : undefined}>
        <Glissable onSupprimer={() => void supprimer(el)} onFait={el.coche ? undefined : () => void basculer(el)} libelleFait="Pris">
        <button className={`ligne element${el.coche ? " coche" : ""}${recents.has(el.id) ? " vient-detre-coche" : ""}`} onClick={() => void basculer(el)}>
          <span className="case" aria-hidden>{el.coche ? "✓" : ""}</span>
          <span className="ligne-texte">
            {el.texte}
            {el.quantite && <span className="quantite"> · {el.quantite}</span>}
            {el.source === "chef" && <span className="etiquette-chef" title="Proposé par le Chef de la semaine">Chef</span>}
          </span>
          {autre && (
            <span className="initiale" style={{ background: auteur.couleur }} title={`Ajouté par ${auteur.prenom}`}>
              {auteur.prenom.charAt(0)}
            </span>
          )}
        </button>
        </Glissable>
      </Ligne>
    );
  }

  const restant = aPrendre.reduce((n, g) => n + g.elements.length, 0);
  return (
    <Page
      titre={props.liste.nom}
      sousTitre={restant ? `${restant} à prendre` : coches.length ? "Tout est pris" : undefined}
      aide={courses ? { cle: "courses", texte: "Dis-le à ta fée (un appui long sur elle pour l'écrire) : « 2 kg de pommes, du lait et du pain ». Touche un article ou glisse-le vers la droite quand il est pris ; vers la gauche pour le retirer." } : undefined}
    >
      {props.avant}
      {enSaisie.length > 0 && (
        <AuDessusDeLaBarre>
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
        </AuDessusDeLaBarre>
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
          <ListeVivante className="carte groupe">{g.elements.map(ligne)}</ListeVivante>
        </section>
      ))}

      {coches.length > 0 && (
        <section>
          <div className="entete-coches">
            <h2 className="rayon">Dans le panier ({coches.length})</h2>
            <button className="lien" onClick={viderCoches}>Vider</button>
          </div>
          <ListeVivante className="carte groupe">{coches.map(ligne)}</ListeVivante>
        </section>
      )}
    </Page>
  );
}
