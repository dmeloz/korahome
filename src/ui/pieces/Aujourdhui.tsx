import { useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { choseDuMoment, resteAFaire, type CarteDuJour, type ChoseDuJour } from "../../domaine/aujourdhui";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { Chiffre } from "../moteur/Chiffre";
import { m, Presence } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";
import { toucherFiable } from "../toucher";

// « Ce soir » en haut de l'accueil, sans cadre : posé sur le fond, pour ne pas faire un bloc
// de plus à côté des widgets. Un fil fin relie les ronds, avec l'heure à gauche quand la chose
// en a une : une petite ligne de temps. La chose du moment est en grand ; on la glisse vers la
// droite (ou on touche son rond) pour la faire : elle file à droite et la suivante glisse à sa
// place en grandissant (moteur de mouvement, ressort « ligne »). Ses données
// (domaine/aujourdhui.ts) sont celles que reprendront le widget de l'iPhone et Siri.
// Équivalent natif : une List en .plain avec un swipeAction(.leading) sur la première ligne.

/** Au-delà de ce glissement vers la droite, la chose du moment est faite. */
const SEUIL_FAIT = 84;
/** Sous la chose du moment, les suivantes montrées d'emblée ; « Voir les N autres » déplie le reste. */
const SUIVANTES_VISIBLES = 3;

export function CarteAujourdhui(props: {
  carte: CarteDuJour;
  /** « Ce matin », « Cet après-midi », « Ce soir ». */
  titre: string;
  /** L'heure du téléphone, « HH:MM » : une heure passée s'affiche en rouge. */
  maintenant: string;
  toucher: (chose: ChoseDuJour) => void;
  /** Coche une tâche sur place. */
  cocher: (chose: ChoseDuJour) => void;
  /** Toucher l'heure d'une tâche : la changer. */
  changerHeure?: (chose: ChoseDuJour) => void;
  /** Qui s'en occupe, pour la ligne sous la chose du moment. */
  qui?: (chose: ChoseDuJour) => string | null;
  voirTout?: () => void;
}) {
  const { carte } = props;
  const groupe = useId();
  const phare = choseDuMoment(carte);
  const [deplie, setDeplie] = useState(false);
  const toutes = carte.choses.slice(1);
  // Pas de liste qui défile dans la page : une ligne coupée à moitié ne se touche pas bien.
  const suivantes = deplie ? toutes : toutes.slice(0, SUIVANTES_VISIBLES);
  const cachees = toutes.length - suivantes.length;
  const reste = resteAFaire(carte);
  const avecHeures = carte.choses.some((c) => c.heure || c.tacheId);

  const heure = (c: ChoseDuJour) => {
    const passee = !!c.heure && c.heure < props.maintenant;
    if (c.tacheId && props.changerHeure) {
      return (
        <button className={`moment-heure${passee ? " passee" : ""}`} onClick={() => props.changerHeure?.(c)} aria-label={c.heure ? `Heure : ${c.heure}, changer` : "Donner une heure"}>
          {c.heure ?? ""}
        </button>
      );
    }
    return <span className={`moment-heure${passee ? " passee" : ""}`}>{c.heure ?? ""}</span>;
  };
  const rond = (c: ChoseDuJour) =>
    c.tacheId ? (
      <button className={`moment-rond ${c.etat}`} {...toucherFiable(() => props.cocher(c))} aria-label={`Faire « ${c.texte} »`}>
        <Icone nom="coche" taille={13} />
      </button>
    ) : (
      <span className={`moment-rond point ${c.etat}`} aria-hidden />
    );

  return (
    <section className={`ce-moment${avecHeures ? " avec-heures" : ""}`} aria-label={props.titre}>
      <header className="ce-moment-entete">
        <h2>{props.titre}</h2>
        {reste > 0 && <span className="discret"><Chiffre valeur={reste} /> à faire</span>}
      </header>
      {!phare ? (
        <p className="ce-moment-vide">{carte.faites ? "Tout est fait. Belle journée." : "Rien de prévu, rien ne presse."}</p>
      ) : (
        <ol className="fil">
          <Presence initial={false}>
          <Phare key={phare.cle} groupe={groupe} chose={phare} faire={phare.tacheId ? () => props.cocher(phare) : undefined}>
            {heure(phare)}
            {rond(phare)}
            <button className="moment-corps" onClick={() => props.toucher(phare)}>
              <span className="moment-texte">{phare.texte}</span>
              <span className={`moment-sous ${phare.etat}`}>
                {[props.qui?.(phare), phare.heure && phare.quand === phare.heure ? null : phare.quand].filter(Boolean).join(" · ")}
                {phare.tacheId ? <span className="moment-geste"> · glisse pour la faire →</span> : null}
              </span>
            </button>
          </Phare>
          {suivantes.map((c) => (
            <m.li
              key={c.cle}
              className="suivante"
              layoutId={`${groupe}-${c.cle}`}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={ressortMotion("ligne")}
            >
              {heure(c)}
              {rond(c)}
              <button className="moment-corps" onClick={() => props.toucher(c)}>
                <span className="moment-texte">{c.texte}</span>
                {c.etat === "urgent" || !c.tacheId ? <span className={`moment-quand ${c.etat}`}>{c.heure && c.quand === c.heure ? "" : c.quand}</span> : null}
                {c.tacheId && c.etat !== "urgent" && props.qui?.(c) ? <span className="moment-quand">{props.qui(c)}</span> : null}
              </button>
            </m.li>
          ))}
          </Presence>
        </ol>
      )}
      {cachees > 0 && (
        <button className="lien ce-moment-plus" onClick={() => setDeplie(true)}>
          {cachees === 1 ? "Voir l'autre" : `Voir les ${cachees} autres`}
        </button>
      )}
      {cachees === 0 && carte.autres > 0 && props.voirTout && (
        <button className="lien ce-moment-plus" onClick={props.voirTout}>
          {carte.autres === 1 ? "Et une autre chose" : `Et ${carte.autres} autres choses`}
        </button>
      )}
    </section>
  );
}

/** La chose du moment : glissée vers la droite, elle est faite. */
function Phare({ chose, faire, groupe, children }: { chose: ChoseDuJour; faire?: () => void; groupe: string; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const geste = useRef<{ x: number; y: number; h: boolean } | null>(null);
  const debut = (e: PointerEvent<HTMLLIElement>) => {
    if (!faire || (e.target as Element).closest(".moment-heure")) return;
    geste.current = { x: e.clientX, y: e.clientY, h: false };
  };
  const mouvement = (e: PointerEvent<HTMLLIElement>) => {
    const g = geste.current;
    if (!g) return;
    const x = e.clientX - g.x;
    if (!g.h) {
      if (Math.abs(e.clientY - g.y) > 10) geste.current = null;
      else if (x > 10) {
        g.h = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    setDx(Math.max(0, x));
  };
  const fin = () => {
    const g = geste.current;
    geste.current = null;
    if (!g?.h) return;
    if (dx > SEUIL_FAIT && faire) {
      vibrer();
      faire();
    }
    setDx(0);
  };
  return (
    <m.li
      layoutId={`${groupe}-${chose.cle}`}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 120 }}
      transition={ressortMotion("ligne")}
      className={`phare ${chose.etat}${dx ? " glisse" : ""}`}
      style={dx ? { ["--glisse" as string]: `${dx}px` } : undefined}
      onPointerDown={debut}
      onPointerMove={mouvement}
      onPointerUp={fin}
      onPointerCancel={fin}
      onClickCapture={(e) => {
        // Le clic qui suit un glissement n'ouvre pas la page.
        if (dx) e.stopPropagation();
      }}
    >
      {children}
    </m.li>
  );
}
