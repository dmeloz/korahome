import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  ajouterWidget,
  basculerTaille,
  definition,
  deplacerVers,
  nettoyerDisposition,
  nettoyerTailles,
  ordreAffichage,
  retirerWidget,
  tailleDe,
  widgetsAAjouter,
  type Disposition,
  type Tailles,
  type WidgetId,
} from "../../domaine/tableauDeBord";
import { enregistrerDisposition, enregistrerTailles, lireDisposition, lireTailles } from "../contexte";
import { Icone } from "../Icone";
import { MODULES, PICTOS, type ApercuWidget, type DonneesModule } from "../modules";

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

/** Durée d'appui pour passer en mode modification, comme sur l'écran d'accueil de l'iPhone. */
const APPUI_LONG_MS = 450;
/** Au-delà de ce déplacement, le doigt fait défiler la page : pas d'appui long. */
const TOLERANCE_PX = 10;

export function Accueil(props: {
  donnees: DonneesModule;
  ouvrirModule: (id: WidgetId) => void;
  ouvrirReglages: () => void;
  /** Une nouvelle version attend : pastille rouge sur les Réglages. */
  nouvelleVersion: boolean;
}) {
  const [disposition, setDisposition] = useState<Disposition>(() => nettoyerDisposition(lireDisposition()));
  const [tailles, setTailles] = useState<Tailles>(() => nettoyerTailles(lireTailles()));
  const [edition, setEdition] = useState(false);
  const [glisse, setGlisse] = useState<WidgetId | null>(null);
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const ignorerClic = useRef(false);
  const { foyer, membreId } = props.donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const date = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });

  const changer = (d: Disposition) => {
    setDisposition(d);
    enregistrerDisposition(d);
  };
  const changerTaille = (id: WidgetId) => {
    const suivantes = basculerTaille(tailles, id);
    setTailles(suivantes);
    enregistrerTailles(suivantes);
  };

  // Appui long sur un widget : on passe en mode modification, sans ouvrir la page.
  const lacher = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
    appui.current = null;
  };
  const appuyer = (e: PointerEvent) => {
    lacher();
    appui.current = {
      x: e.clientX,
      y: e.clientY,
      minuterie: setTimeout(() => {
        appui.current = null;
        ignorerClic.current = true;
        navigator.vibrate?.(10);
        setEdition(true);
      }, APPUI_LONG_MS),
    };
  };
  const bouger = (e: PointerEvent) => {
    const a = appui.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > TOLERANCE_PX) lacher();
  };

  // En mode modification, un widget se glisse à la place d'un autre.
  const commencerGlisse = (e: PointerEvent<HTMLDivElement>, id: WidgetId) => {
    if ((e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setGlisse(id);
  };
  const suivreGlisse = (e: PointerEvent) => {
    if (!glisse) return;
    const cible = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-widget]")?.dataset.widget as
      | WidgetId
      | undefined;
    if (cible && cible !== glisse) changer(deplacerVers(disposition, glisse, cible));
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

  const terminer = () => {
    setEdition(false);
    setGlisse(null);
  };

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
        {edition ? (
          <button className="bouton-termine" onClick={terminer}>Terminé</button>
        ) : (
          <button
            className="bouton-icone avec-alerte"
            onClick={props.ouvrirReglages}
            aria-label={props.nouvelleVersion ? "Réglages, nouvelle version disponible" : "Réglages"}
          >
            <Icone nom="reglages" taille={22} />
            {props.nouvelleVersion && <span className="alerte" aria-hidden />}
          </button>
        )}
      </header>

      {affiches.length === 0 && !edition && (
        <div className="carte vide-tableau">
          <p>Ton tableau de bord est vide.</p>
          <button className="bouton-principal" onClick={() => setEdition(true)}>Ajouter des widgets</button>
        </div>
      )}

      <div className={`widgets${edition ? " en-edition" : ""}`}>
        {affiches.map((id, i) => {
          const c = apercus.get(id);
          if (!c) return null;
          const def = definition(id);
          const taille = tailleDe(tailles, id);
          const classes = `widget ${taille}${c.urgent && !edition ? " urgent" : ""}`;
          const corps: ReactNode = (
            <>
              <span className="widget-haut">
                <span className="pictogramme"><Icone nom={PICTOS[id]} taille={20} /></span>
                <span className="widget-titre">{def.titre}</span>
                {!edition && c.urgent && taille === "grand" && <span className="signal">À faire</span>}
              </span>
              <span className="widget-chiffre">
                {c.chiffre > 0 && <strong>{c.chiffre}</strong>}
                <span>{c.legende}</span>
              </span>
              {taille === "grand" && c.lignes.length > 0 && (
                <span className="widget-apercu">
                  {c.lignes.map((ligne) => <span key={ligne}>{ligne}</span>)}
                </span>
              )}
            </>
          );
          return edition ? (
            <div
              key={id}
              data-widget={id}
              className={`${classes} en-edition${glisse === id ? " glisse" : ""}`}
              style={{ animationDelay: `${(i % 3) * -0.09}s` }}
              onPointerDown={(e) => commencerGlisse(e, id)}
              onPointerMove={suivreGlisse}
              onPointerUp={() => setGlisse(null)}
              onPointerCancel={() => setGlisse(null)}
            >
              {corps}
              <button className="badge-widget retirer" onClick={() => changer(retirerWidget(disposition, id))} aria-label={`Retirer ${def.titre}`}>
                <Icone nom="moins" taille={14} />
              </button>
              <button
                className="badge-widget taille"
                onClick={() => changerTaille(id)}
                aria-label={taille === "grand" ? `Réduire ${def.titre}` : `Agrandir ${def.titre}`}
              >
                <Icone nom={taille === "grand" ? "reduire" : "agrandir"} taille={14} />
              </button>
            </div>
          ) : (
            <button
              key={id}
              data-widget={id}
              className={classes}
              onPointerDown={appuyer}
              onPointerMove={bouger}
              onPointerUp={lacher}
              onPointerCancel={lacher}
              onPointerLeave={lacher}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (ignorerClic.current) {
                  ignorerClic.current = false;
                  return;
                }
                props.ouvrirModule(id);
              }}
            >
              {corps}
            </button>
          );
        })}
      </div>

      {edition && (
        <section className="ajout-widgets">
          {affiches.length > 0 && (
            <p className="discret aide-edition">Glisse un widget pour le déplacer. Les flèches changent sa taille.</p>
          )}
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

      {!edition && affiches.length > 0 && (
        <button className="lien modifier" onClick={() => setEdition(true)}>
          Modifier le tableau de bord
        </button>
      )}
    </main>
  );
}
