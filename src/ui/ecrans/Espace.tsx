import { definition, espace, modulesDeLEspace, type EspaceId, type WidgetId } from "../../domaine/tableauDeBord";
import { Icone } from "../Icone";
import { MODULES, PICTOS, type DonneesModule } from "../modules";
import { Page } from "../pieces";
import { noterUsage } from "../usage";

// La page d'une bulle de l'accueil : tous les modules d'un usage du quotidien, avec leur
// aperçu, qu'ils soient posés sur le tableau de bord ou non. Chacun ouvre sa page.
export function Espace(props: { id: EspaceId; donnees: DonneesModule; ouvrirModule: (id: WidgetId) => void }) {
  const e = espace(props.id);
  const modules = modulesDeLEspace(props.id);
  return (
    <Page titre={e.titre} sousTitre={e.description} className="espace">
      <div className="widgets">
        {modules.map((id) => {
          const module = MODULES[id];
          if (!module) return null;
          const c = module.widget(props.donnees);
          return (
            <button
              key={id}
              className={`widget grand${c.urgent ? " urgent" : ""}`}
              onClick={() => {
                noterUsage("widget", id);
                props.ouvrirModule(id);
              }}
            >
              <span className="widget-haut">
                <Icone nom={PICTOS[id]} taille={18} />
                <span className="widget-titre">{definition(id).titre}</span>
                {c.urgent && <span className="point-etat urgent" aria-label="À faire" />}
              </span>
              <span className="widget-bas">
                <span className="widget-valeur">{c.chiffre > 0 ? `${c.chiffre} ${c.legende}` : c.legende}</span>
                {c.jauge !== undefined && (
                  <span className="widget-jauge" aria-hidden><span style={{ width: `${Math.round(Math.min(1, c.jauge) * 100)}%` }} /></span>
                )}
                {c.lignes.length > 0 && (
                  <span className="widget-apercu">
                    {c.lignes.map((ligne) => <span key={ligne}>{ligne}</span>)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Page>
  );
}
