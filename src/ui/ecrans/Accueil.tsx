import { useState, type ReactNode } from "react";
import { compterAPrendre } from "../../domaine/listes";
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
import { compterDues, decrireEcheance, organiserTaches } from "../../domaine/taches";
import type { Element, Foyer, Liste, Tache } from "../../domaine/types";
import { aujourdhuiLocal, enregistrerDisposition, lireDisposition } from "../contexte";
import { Icone, type NomIcone } from "../Icone";

const PICTOS: Record<WidgetId, NomIcone> = {
  taches: "coche",
  courses: "panier",
  listes: "liste",
  agenda: "calendrier",
  mitsu: "chat",
  stock: "frigo",
  jardin: "feuille",
};

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

interface Contenu {
  chiffre: string;
  legende: string;
  apercu: string[];
  urgent: boolean;
  ouvrir: () => void;
}

export function Accueil(props: {
  foyer: Foyer;
  membreId: string | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  ouvrirListe: (id: string) => void;
  ouvrirListes: () => void;
  ouvrirTaches: () => void;
  ouvrirReglages: () => void;
}) {
  const [disposition, setDisposition] = useState<Disposition>(() => nettoyerDisposition(lireDisposition()));
  const [edition, setEdition] = useState(false);
  const aujourdhui = aujourdhuiLocal();
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const date = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });

  const changer = (d: Disposition) => {
    setDisposition(d);
    enregistrerDisposition(d);
  };

  // Ce que montre chaque widget.
  const courses = props.listes.find((l) => l.type === "courses");
  const autres = props.listes.filter((l) => l.type !== "courses");
  const dues = compterDues(props.taches, aujourdhui);
  const aFaire = organiserTaches(props.taches, aujourdhui).groupes.flatMap((g) => g.taches);

  const contenus: Partial<Record<WidgetId, Contenu>> = {
    taches: {
      chiffre: String(dues.aujourdhui + dues.enRetard),
      legende:
        props.taches.length === 0
          ? "Aucune tâche pour l'instant"
          : dues.enRetard > 0
            ? `à faire, dont ${dues.enRetard} en retard`
            : dues.aujourdhui > 0
              ? "à faire aujourd'hui"
              : "Rien à faire aujourd'hui",
      apercu: aFaire.slice(0, 3).map((t) => `${t.titre} · ${decrireEcheance(t.echeance, aujourdhui)}`),
      urgent: dues.aujourdhui + dues.enRetard > 0,
      ouvrir: props.ouvrirTaches,
    },
    courses: courses && {
      chiffre: String(compterAPrendre(courses, props.elements)),
      legende: compterAPrendre(courses, props.elements) === 0 ? "Rien à acheter" : "à acheter",
      apercu: props.elements
        .filter((e) => e.listeId === courses.id && !e.coche)
        .slice(0, 3)
        .map((e) => (e.quantite ? `${e.texte} · ${e.quantite}` : e.texte)),
      urgent: false,
      ouvrir: () => props.ouvrirListe(courses.id),
    },
    listes: {
      chiffre: String(autres.length),
      legende: autres.length === 0 ? "Aucune autre liste" : autres.length > 1 ? "listes" : "liste",
      apercu: autres.slice(0, 3).map((l) => {
        const n = compterAPrendre(l, props.elements);
        return n ? `${l.nom} · ${pluriel(n, "élément")}` : l.nom;
      }),
      urgent: false,
      ouvrir: props.ouvrirListes,
    },
  };

  const urgents = new Set(disposition.filter((id) => contenus[id]?.urgent));
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
        <button className="bouton-icone" onClick={props.ouvrirReglages} aria-label="Réglages">
          <Icone nom="reglages" taille={22} />
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
          const c = contenus[id];
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
                {c.chiffre !== "0" && <strong>{c.chiffre}</strong>}
                <span>{c.legende}</span>
              </span>
              {!edition && c.apercu.length > 0 && (
                <span className="widget-apercu">
                  {c.apercu.map((ligne) => <span key={ligne}>{ligne}</span>)}
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
            <button key={id} className={`widget${c.urgent ? " urgent" : ""}`} onClick={c.ouvrir}>
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
