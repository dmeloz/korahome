import { compterAPrendre, nouvelleListe } from "../../domaine/listes";
import type { Element, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Icone } from "../Icone";
import { Page, useGestionnaireBarre } from "../pieces";

export function Listes(props: {
  depot: Depot;
  listes: Liste[];
  elements: Element[];
  ouvrirListe: (id: string) => void;
}) {
  const annoncer = useAnnoncer();

  // La liste de courses est celle de tout le foyer : elle ne se supprime pas.
  async function supprimer(l: Liste) {
    const siens = props.elements.filter((e) => e.listeId === l.id);
    await props.depot.supprimerListe(l.id);
    annoncer(`Liste « ${l.nom} » supprimée.`, async () => {
      await props.depot.enregistrerListe(l);
      for (const e of siens) await props.depot.enregistrerElement(e);
    });
  }

  // Sur cette page, la barre crée une liste du nom écrit ; une question part chez Jarvis.
  useGestionnaireBarre("module:listes", async (texte) => {
    const nom = texte.trim().replace(/^(nouvelle |une )?liste\s*(de |des |du |pour )?/i, "");
    if (!nom || nom.endsWith("?")) return false;
    const liste = nouvelleListe(nom.charAt(0).toUpperCase() + nom.slice(1), "📝", "simple", contexteReel);
    await props.depot.enregistrerListe(liste);
    annoncer(`Liste « ${liste.nom} » créée.`, () => props.depot.supprimerListe(liste.id));
    return true;
  });

  return (
    <Page titre="Listes" sousTitre="Les courses et vos autres listes" aide={{ cle: "listes", texte: "Écris le nom d'une nouvelle liste dans la barre du bas (cadeaux, bricolage, vacances). Glisse une liste vers la gauche pour la retirer." }}>
      <ul className="carte groupe">
        {props.listes.map((l) => {
          const n = compterAPrendre(l, props.elements);
          const ligne = (
            <button className="ligne" onClick={() => props.ouvrirListe(l.id)}>
              <span className="pictogramme"><Icone nom={l.type === "courses" ? "panier" : "liste"} taille={20} /></span>
              <span className="ligne-texte">{l.nom}</span>
              {n > 0 && <span className="pastille">{n}</span>}
              <span className="chevron"><Icone nom="suivant" taille={18} /></span>
            </button>
          );
          return (
            <li key={l.id}>
              {l.type === "courses" ? ligne : <Glissable onSupprimer={() => void supprimer(l)}>{ligne}</Glissable>}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
