import { useState, type ReactNode } from "react";
import {
  ajouterWidget,
  definition,
  deplacerWidget,
  nettoyerDisposition,
  ordreAffichage,
  retirerWidget,
  widgetsAAjouter,
  type Disposition,
  type WidgetId,
} from "../../domaine/tableauDeBord";
import { enregistrerDisposition, lireDisposition } from "../contexte";
import { Icone } from "../Icone";
import { MODULES, PICTOS, type ApercuWidget, type DonneesModule } from "../modules";

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

export function Accueil(props: {
  donnees: DonneesModule;
  ouvrirModule: (id: WidgetId) => void;
  ouvrirReglages: () => void;
  /** Une nouvelle version attend : pastille rouge sur les Réglages. */
  nouvelleVersion: boolean;
}) {
  const [disposition, setDisposition] = useState<Disposition>(() => nettoyerDisposition(lireDisposition()));
  const [edition, setEdition] = useState(false);
  const { foyer, membreId } = props.donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const date = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });

  const changer = (d: Disposition) => {
    setDisposition(d);
    enregistrerDisposition(d);
  };

  // Ce que montre chaque widget, calculé par son module.
  const apercus = new Map<WidgetId, ApercuWidget>();
  for (const id of disposition) {
    const module = MODULES[id];
    if (module) apercus.set(id, module.widget(props.donnees));
  }

  const urgents = new Set(disposition.filter((id) => apercus.get(id)?.urgent));
  const affiches = edition ? disposition : ordreAffichage(disposition, urgents);
  const { prets, bientot } = widgetsAAjouter(disposition);

  return (
    <main className="tableau">
      <header className="entete-accueil">
        <div>
          <p className="surtitre">{date}</p>
          <h1>
            {salutation(new Date().getHours())}
            {moi ? `, ${moi.prenom}` : ""}
          </h1>
        </div>
        <button
          className="bouton-icone avec-alerte"
          onClick={props.ouvrirReglages}
          aria-label={props.nouvelleVersion ? "Réglages, nouvelle version disponible" : "Réglages"}
        >
          <Icone nom="reglages" taille={22} />
          {props.nouvelleVersion && <span className="alerte" aria-hidden />}
        </button>
      </header>

      {affiches.length === 0 && !edition && (
        <div className="carte vide-tableau">
          <p>Ton tableau de bord est vide.</p>
          <button className="bouton-principal" onClick={() => setEdition(true)}>Ajouter des widgets</button>
        </div>
      )}

      <div className="widgets">
        {affiches.map((id, i) => {
          const c = apercus.get(id);
          if (!c) return null;
          const def = definition(id);
          const corps: ReactNode = (
            <>
              <span className="widget-haut">
                <span className="pictogramme"><Icone nom={PICTOS[id]} taille={20} /></span>
                <span className="widget-titre">{def.titre}</span>
                {!edition && c.urgent && <span className="signal">À faire</span>}
              </span>
              <span className="widget-chiffre">
                {c.chiffre > 0 && <strong>{c.chiffre}</strong>}
                <span>{c.legende}</span>
              </span>
              {!edition && c.lignes.length > 0 && (
                <span className="widget-apercu">
                  {c.lignes.map((ligne) => <span key={ligne}>{ligne}</span>)}
                </span>
              )}
            </>
          );
          return edition ? (
            <div key={id} className="widget en-edition">
              {corps}
              <span className="widget-outils">
                <button className="bouton-icone" onClick={() => changer(deplacerWidget(disposition, id, -1))} disabled={i === 0} aria-label={`Monter ${def.titre}`}>
                  <Icone nom="haut" taille={20} />
                </button>
                <button className="bouton-icone" onClick={() => changer(deplacerWidget(disposition, id, 1))} disabled={i === affiches.length - 1} aria-label={`Descendre ${def.titre}`}>
                  <Icone nom="bas" taille={20} />
                </button>
                <button className="bouton-icone retirer" onClick={() => changer(retirerWidget(disposition, id))} aria-label={`Retirer ${def.titre}`}>
                  <Icone nom="moins" taille={20} />
                </button>
              </span>
            </div>
          ) : (
            <button key={id} className={`widget${c.urgent ? " urgent" : ""}`} onClick={() => props.ouvrirModule(id)}>
              {corps}
            </button>
          );
        })}
      </div>

      {edition && (
        <section className="ajout-widgets">
          {prets.length > 0 && <h2 className="rayon">Ajouter</h2>}
          {prets.map((w) => (
            <button key={w.id} className="carte proposition" onClick={() => changer(ajouterWidget(disposition, w.id))}>
              <span className="pictogramme"><Icone nom={PICTOS[w.id]} taille={20} /></span>
              <span className="proposition-texte">
                <strong>{w.titre}</strong>
                <span className="discret">{w.description}</span>
              </span>
              <Icone nom="ajouter" taille={20} />
            </button>
          ))}
          {bientot.length > 0 && <h2 className="rayon">Bientôt</h2>}
          {bientot.map((w) => (
            <div key={w.id} className="carte proposition inactive">
              <span className="pictogramme"><Icone nom={PICTOS[w.id]} taille={20} /></span>
              <span className="proposition-texte">
                <strong>{w.titre}</strong>
                <span className="discret">{w.description}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <button className="lien modifier" onClick={() => setEdition(!edition)}>
        {edition ? "Terminé" : "Modifier le tableau de bord"}
      </button>
    </main>
  );
}
