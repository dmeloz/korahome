import { evenementsDe } from "../../domaine/agenda";
import { depenses } from "../../domaine/budget";
import { listesVisibles } from "../../domaine/listes";
import { recettesDe } from "../../domaine/recettes";
import { rechercher, type OuRecherche } from "../../domaine/recherche";
import { definition, modulesCherches, type WidgetId } from "../../domaine/tableauDeBord";
import { Icone } from "../Icone";
import { PICTOS, type DonneesModule } from "../modules";
import { AuDessusDeLaBarre, useSaisieBarre } from "./barre";

// La recherche passe par la fée (Kora 0.0.73, demande de Melo) : sur l'accueil, ce qu'on lui
// écrit cherche aussi dans Kora, et les trouvailles montent juste au-dessus de la saisie. Les
// toucher ouvre leur page ; « Envoyer » confie toujours la phrase à la fée.
// Équivalent natif : les suggestions d'un .searchable posées au-dessus du champ.

/** Au-delà, la liste couvrirait l'accueil : la fée reste la réponse au reste. */
const TROUVAILLES_MAX = 5;

/** Tout ce que la recherche fouille ; les listes rien qu'à l'autre n'y sont pas. */
function donneesRecherche(d: DonneesModule) {
  const listes = listesVisibles(d.listes, d.membreId);
  const ids = new Set(listes.map((l) => l.id));
  return {
    ...d,
    listes,
    elements: d.elements.filter((e) => ids.has(e.listeId)),
    evenements: evenementsDe(d.agenda),
    recettes: recettesDe(d.menus),
    depenses: depenses(d.budget),
    mots: d.couple.filter((c) => c.type === "mot"),
  };
}

export function RechercheFee(props: { donnees: DonneesModule; aller: (ou: OuRecherche) => void; ouvrirModule: (id: WidgetId) => void }) {
  const { texte, changer } = useSaisieBarre();
  if (texte.trim().length < 2) return null;
  const modules = modulesCherches(texte).slice(0, 3);
  const trouvailles = rechercher(donneesRecherche(props.donnees), texte).slice(0, TROUVAILLES_MAX);
  if (!modules.length && !trouvailles.length) return null;

  // La saisie se referme avec le clavier, puis la page s'ouvre.
  const partir = (ouvrir: () => void) => {
    changer("");
    (document.activeElement as HTMLElement | null)?.blur();
    ouvrir();
  };

  return (
    <AuDessusDeLaBarre>
      <div className="recherche-fee" role="list" aria-label="Trouvé dans Kora">
        <p className="surtitre">Trouvé dans Kora</p>
        {modules.map((id) => (
          <button key={id} role="listitem" className="trouvaille" onPointerDown={(e) => e.preventDefault()} onClick={() => partir(() => props.ouvrirModule(id))}>
            <Icone nom={PICTOS[id]} taille={16} />
            <span className="trouvaille-texte">{definition(id).titre}</span>
            <Icone nom="suivant" taille={14} />
          </button>
        ))}
        {trouvailles.map((t) => (
          <button key={t.cle} role="listitem" className="trouvaille" onPointerDown={(e) => e.preventDefault()} onClick={() => partir(() => props.aller(t.ou))}>
            <Icone nom="loupe" taille={16} />
            <span className="trouvaille-texte">
              {t.titre}
              <span className="discret">{t.detail}</span>
            </span>
            <Icone nom="suivant" taille={14} />
          </button>
        ))}
      </div>
    </AuDessusDeLaBarre>
  );
}
