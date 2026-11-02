import { useState } from "react";
import type { DocChef } from "../../domaine/chef";
import { lirePhraseRepas, nomDuSoirPasse, noterRepas, repasDuJour, repasRecents, type RepasMange } from "../../domaine/repas";
import { recetteDuSoir, type Recette } from "../../domaine/recettes";
import type { Id } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Ligne, ListeVivante } from "../moteur/pieces";
import { LigneAjout, useGestionnaireBarre, useInvitationBarre } from "../pieces";

// « Ce soir on a mangé » (Kora 0.0.98) : en tête de Cuisine › Menus, une ligne par soir, écrite
// ici ou dite à la fée (« ce soir pâtes au pesto », « hier soir raclette »), même sans menu ni
// Chef. Les règles sont dans src/domaine/repas.ts ; le Chef lit ces soirs pour varier.

/** Les recettes qu'on refait le plus, proposées d'un toucher (la recette prévue ce soir d'abord). */
function propositions(recettes: readonly Recette[], aujourdhui: string): Recette[] {
  const prevue = recetteDuSoir(recettes, aujourdhui);
  const souvent = [...recettes].filter((r) => r.fois > 0 && r.id !== prevue?.id).sort((a, b) => b.fois - a.fois);
  return [...(prevue ? [prevue] : []), ...souvent].slice(0, 3);
}

export function JournalRepas(props: { depot: Depot; menus: DocChef[]; recettes: Recette[]; aujourdhui: string; membreId: Id | null }) {
  const { depot, aujourdhui } = props;
  const annoncer = useAnnoncer();
  const [modifier, setModifier] = useState(false);
  const [texte, setTexte] = useState("");
  const ceSoir = repasDuJour(props.menus, aujourdhui);
  const recents = repasRecents(props.menus, aujourdhui);
  const proposees = ceSoir ? [] : propositions(props.recettes, aujourdhui);

  async function noter(titre: string, jour: string) {
    const note = noterRepas({ titre, jour, recettes: props.recettes, membreId: props.membreId }, contexteReel);
    if (!note) return;
    const avant = repasDuJour(props.menus, jour);
    const recetteAvant = note.recette ? props.recettes.find((r) => r.id === note.recette!.id) ?? null : null;
    vibrer();
    setModifier(false);
    setTexte("");
    await depot.enregistrerMenu(note.repas);
    if (note.recette) await depot.enregistrerMenu(note.recette);
    const quand = jour === aujourdhui ? "ce soir" : nomDuSoirPasse(jour, aujourdhui).toLowerCase();
    annoncer(`« ${note.repas.titre} » noté pour ${quand}.`, async () => {
      if (avant) await depot.enregistrerMenu(avant);
      else await depot.supprimerMenu(note.repas.id);
      if (recetteAvant) await depot.enregistrerMenu(recetteAvant);
    });
  }

  async function retirer(r: RepasMange) {
    await depot.supprimerMenu(r.id);
    annoncer(`« ${r.titre} » retiré du journal.`, () => depot.enregistrerMenu(r));
  }

  // La fée sur cette page : « ce soir on a mangé… » s'écrit ici, le reste suit son chemin.
  // (Nos recettes prend la même clé, mais les deux onglets ne sont jamais ouverts ensemble.)
  useInvitationBarre("Ce soir on a mangé…");
  useGestionnaireBarre("module:chef", async (phrase) => {
    const lu = lirePhraseRepas(phrase, aujourdhui);
    if (!lu) return false;
    await noter(lu.titre, lu.jour);
    return true;
  });

  return (
    <section className="journal-repas" aria-labelledby="journal-repas-titre">
      <h2 className="rayon" id="journal-repas-titre">Ce soir on a mangé</h2>
      <ListeVivante className="carte groupe">
        {ceSoir && !modifier ? (
          <Ligne key="ce-soir">
            <Glissable onSupprimer={() => void retirer(ceSoir)} libelle="Retirer">
              <button
                type="button"
                className="ligne recette-ligne"
                onClick={() => {
                  setTexte(ceSoir.titre);
                  setModifier(true);
                }}
                aria-label={`Ce soir : ${ceSoir.titre}. Changer`}
              >
                <span className="surtitre recette-soir">Ce soir</span>
                <span className="ligne-texte">{ceSoir.titre}</span>
                <span className="discret journal-changer">Changer</span>
              </button>
            </Glissable>
          </Ligne>
        ) : (
          <Ligne key="saisie">
            <LigneAjout placeholder="Ce soir, ex. pâtes au pesto" texte={texte} onChange={setTexte} ajouter={(t) => noter(t, aujourdhui)} />
          </Ligne>
        )}
        {recents.map((r) => (
          <Ligne key={r.id}>
            <Glissable onSupprimer={() => void retirer(r)} libelle="Retirer">
              <div className="ligne recette-ligne journal-passe">
                <span className="surtitre recette-soir">{nomDuSoirPasse(r.jour, aujourdhui)}</span>
                <span className="ligne-texte">{r.titre}</span>
              </div>
            </Glissable>
          </Ligne>
        ))}
      </ListeVivante>
      {modifier && ceSoir && (
        <button
          type="button"
          className="lien journal-garder"
          onClick={() => {
            setModifier(false);
            setTexte("");
          }}
        >
          Garder « {ceSoir.titre} »
        </button>
      )}
      {proposees.length > 0 && (
        <div className="puces journal-propositions" aria-label="Nos recettes">
          {proposees.map((r) => (
            <button key={r.id} type="button" className="puce" onClick={() => void noter(r.titre, aujourdhui)}>{r.titre}</button>
          ))}
        </div>
      )}
      {!ceSoir && recents.length === 0 && <p className="discret journal-aide">Une ligne par soir, même sans le Chef. Il s'en sert pour ne pas reproposer ce que vous venez de manger.</p>}
    </section>
  );
}
