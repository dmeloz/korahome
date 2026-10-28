import { coursesPourLaReserve, etatReserve, grouperReserve, resumeReserve, SOURCE_OFAE } from "../../domaine/reserve";
import type { Produit } from "../../domaine/stock";
import type { Element, Jour, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { sauver } from "../sauver";

// La réserve de secours (0.0.94, proposition 11 de la nuit du 26 octobre) : la liste de la
// Confédération pour une semaine à deux, comparée au stock. Une feuille depuis Cuisine › Frigo :
// ce qui est là coché, ce qui manque en gris, un bouton pour envoyer le manquant aux courses.

export function Reserve(props: {
  ouverte: boolean;
  fermer: () => void;
  depot: Depot;
  produits: Produit[];
  courses: Liste | null;
  elements: Element[];
  membreId: string | null;
  aujourdhui: Jour;
}) {
  const annoncer = useAnnoncer();
  const etat = etatReserve(props.produits, props.aujourdhui);
  const aAjouter = props.courses ? coursesPourLaReserve(etat, props.courses, props.elements, props.membreId, contexteReel) : [];

  async function ajouterAuxCourses() {
    if (!aAjouter.length) return;
    vibrer();
    for (const e of aAjouter) await props.depot.enregistrerElement(e);
    props.fermer();
    annoncer(`${aAjouter.length} article${aAjouter.length > 1 ? "s" : ""} pour la réserve ajouté${aAjouter.length > 1 ? "s" : ""} aux courses.`, () => props.depot.supprimerElements(aAjouter.map((e) => e.id)));
  }

  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre="Notre réserve de secours">
      <div className="formulaire reserve-feuille">
        <p className="discret">{resumeReserve(etat)} · une semaine pour deux</p>
        {grouperReserve(etat).map((g) => (
          <section key={g.groupe}>
            <h2 className="rayon">{g.titre}</h2>
            <ul className="carte groupe">
              {g.articles.map((a) => (
                <li key={a.article.id} className={`reserve-article${a.manque ? " manque" : ""}`}>
                  <span className={`case${a.manque ? "" : " coche"}`} aria-hidden>
                    {a.manque ? "" : "✓"}
                  </span>
                  <span className="tache-texte">
                    <span className="ligne-texte">{a.article.nom}</span>
                    <span className={`tache-details${a.aTourner ? " retard" : ""}`}>
                      {a.manque ? a.article.pourDeux : a.produits.map((p) => p.nom).join(", ")}
                      {a.aTourner ? " · à faire tourner" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {props.courses && aAjouter.length > 0 && (
          <button type="button" className="bouton-principal" onClick={() => sauver(ajouterAuxCourses())}>
            Ajouter les {aAjouter.length} manquants aux courses
          </button>
        )}
        {etat.manquants.length > 0 && aAjouter.length === 0 && <p className="discret">Ce qui manque est déjà sur la liste de courses.</p>}
        <p className="reserve-source">
          Liste de la Confédération ({SOURCE_OFAE}), ramenée à deux personnes. Un produit du stock se marque « Dans la réserve de secours » depuis sa fiche : le Chef n'y puise pas. Vérifie la réserve une fois par saison, depuis Maison › Entretien.
        </p>
      </div>
    </Feuille>
  );
}
