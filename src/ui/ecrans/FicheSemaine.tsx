import { coursesDeLaFiche, detailLigne, texteFiche, type FicheSemaine as Fiche } from "../../domaine/ficheSemaine";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";
import { copierRapport } from "../rapport";
import { nomDuSoir } from "./Recettes";

// La fiche de la semaine, dans « Menus de la semaine » : les repas côte à côte, chaque
// ingrédient une seule fois avec son total, ce qu'on prépare en une fois, et le manquant
// de toute la semaine aux courses. Les règles sont dans src/domaine/ficheSemaine.ts.

export function FicheSemaine(p: PropsPage & { fiche: Fiche; ouverte: boolean; fermer: () => void; ouvrirRecette: (id: string) => void }) {
  const annoncer = useAnnoncer();
  const { fiche } = p;
  const courses = p.listes.find((l) => l.type === "courses") ?? null;
  const quand = (jour: string | null) => (jour ? nomDuSoir(jour, p.aujourdhui) : "Chef");

  async function mettreAuxCourses() {
    if (!courses) {
      annoncer("Crée d'abord une liste de courses.", () => {});
      return;
    }
    const ajouts = coursesDeLaFiche(fiche, courses, p.elements, p.membreId, contexteReel);
    for (const e of ajouts) await p.depot.enregistrerElement(e);
    vibrer();
    annoncer(
      ajouts.length ? `${ajouts.length} article${ajouts.length > 1 ? "s" : ""} aux courses, avec le total de la semaine.` : "Rien à ajouter : tout est à la maison ou déjà sur la liste.",
      () => p.depot.supprimerElements(ajouts.map((e) => e.id)),
    );
  }

  async function partager() {
    const texte = texteFiche(fiche, quand);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Fiche de la semaine", text: texte });
        return;
      }
    } catch {
      return; // partage annulé
    }
    annoncer((await copierRapport(texte)) ? "Fiche copiée : colle-la dans Notes ou un message." : "La fiche n'a pas pu être copiée.", () => {});
  }

  return (
    <Feuille ouverte={p.ouverte} onFermer={p.fermer} titre="La fiche de la semaine" className="feuille-fiche-semaine">
      <div className="fiche-semaine">
        <p className="surtitre">
          {fiche.plats.length} repas · {fiche.aAcheter.length ? `${fiche.aAcheter.length} à acheter` : "tout est à la maison"}
        </p>

        <ul className="carte groupe fiche-semaine-plats">
          {fiche.plats.map((pl) => (
            <li key={pl.recette.id}>
              <button type="button" className="ligne recette-ligne" onClick={() => p.ouvrirRecette(pl.recette.id)}>
                <span className="fiche-semaine-code">{pl.code}</span>
                <span className="ligne-texte">
                  <span className="recette-titre">{pl.recette.titre}</span>
                  <span className="discret">{quand(pl.quand)} · pour {pl.recette.portions}</span>
                </span>
                <span className="chevron" aria-hidden><Icone nom="suivant" taille={16} /></span>
              </button>
            </li>
          ))}
        </ul>

        {fiche.communs.length > 0 && (
          <>
            <h3>À préparer en une fois</h3>
            <p className="discret">Ces ingrédients servent à plusieurs repas : épluche, taille ou cuis-les d'un coup.</p>
            <ul className="carte groupe fiche-semaine-lignes">
              {fiche.communs.map((l) => (
                <li key={l.cle} className="ligne">
                  <span className="ligne-texte">
                    {l.nom}
                    <span className="discret">{detailLigne(fiche, l)}</span>
                  </span>
                  {l.total && <span className="quantite">{l.total}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Ingrédients de la semaine</h3>
        <ul className="carte groupe recette-ingredients fiche-semaine-lignes">
          {fiche.ingredients.map((l) => (
            <li key={l.cle} className={`ligne${l.aLaMaison ? " a-la-maison" : ""}`}>
              <span className={`recette-point${l.aLaMaison ? " plein" : ""}`} aria-hidden />
              <span className="ligne-texte">
                {l.nom}
                <span className="discret">{detailLigne(fiche, l)}</span>
              </span>
              {l.total && <span className="quantite">{l.total}</span>}
              <span className="visuellement-cache">{l.aLaMaison ? "à la maison" : "à acheter"}</span>
            </li>
          ))}
        </ul>
        <p className="discret">Les quantités sont celles de chaque recette, pour son nombre de personnes.</p>

        <button type="button" className="bouton-secondaire" disabled={fiche.aAcheter.length === 0} onClick={() => void mettreAuxCourses()}>
          <Icone nom="panier" taille={18} />
          {fiche.aAcheter.length ? `Mettre aux courses ce qui manque (${fiche.aAcheter.length})` : "Tout est à la maison"}
        </button>
        <button type="button" className="bouton-secondaire" onClick={() => void partager()}>
          <Icone nom="partage" taille={18} />
          Partager la fiche
        </button>
      </div>
    </Feuille>
  );
}
