import type { CSSProperties, ReactNode } from "react";
import { lundiDe } from "../../domaine/agenda";
import { decaler } from "../../domaine/taches";
import type { Jour } from "../../domaine/types";
import { useCartesTouchees, useRespiration } from "../moteur/langage";
import { Orbe } from "./Tael";

// Le système de cartes de Kora 0.1 (axe 2, validé par Melo le 4 novembre 2026) : une grille de
// deux colonnes sur l'iPhone, des cartes de trois tailles, une seule carte forte en laiton plein,
// une carte de contraste en ivoire, des étiquettes grises, des actions en pilules (trois au
// plus), des graphiques nus. Styles dans styles/espaces.css. Équivalent natif : une LazyVGrid
// de cartes, chaque carte une vue avec .background(.regularMaterial).

/** L'en-tête d'un espace : le grand titre, Tael à côté, une ligne dessous. */
export function EnteteEspace({ titre, sous }: { titre: ReactNode; sous?: ReactNode }) {
  return (
    <>
      <header className="espace-entete">
        <h1>{titre}</h1>
        <Orbe salut />
      </header>
      {sous && <p className="sous-salut">{sous}</p>}
    </>
  );
}

export function Grille({ children, label }: { children: ReactNode; label?: string }) {
  // Les cartes que Tael vient de toucher respirent l'une après l'autre (moteur/langage.ts).
  const ref = useCartesTouchees<HTMLDivElement>();
  return <div ref={ref} className="grille" aria-label={label}>{children}</div>;
}

export function Tuile(props: {
  children: ReactNode;
  className?: string;
  large?: boolean;
  forte?: boolean;
  contraste?: boolean;
  /** Un toucher : la carte est un bouton et s'ouvre ailleurs. */
  onClick?: () => void;
  /** L'espace où mène la carte : elle grandit jusqu'à devenir sa page (transitions.ts). */
  widget?: string;
  /** Son rang dans la grille, pour la cascade d'entrée. */
  i?: number;
  label?: string;
  role?: string;
}) {
  const classe = `tuile${props.large ? " large" : ""}${props.forte ? " forte" : ""}${props.contraste ? " contraste" : ""}${props.className ? ` ${props.className}` : ""}`;
  const style = props.i !== undefined ? ({ "--i": props.i } as CSSProperties) : undefined;
  if (props.onClick) {
    return (
      <button type="button" className={classe} style={style} onClick={props.onClick} data-widget={props.widget} aria-label={props.label}>
        {props.children}
      </button>
    );
  }
  return (
    <div className={classe} style={style} data-widget={props.widget} aria-label={props.label} role={props.role}>
      {props.children}
    </div>
  );
}

/** La coche d'une case. */
export function Coche() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

/** Une ligne à cocher dans une carte : la case, le texte, et à droite l'heure ou qui. */
export function LigneCoche(props: { coche: boolean; texte: string; fin?: string | null; finNavi?: boolean; heure?: string | null; urgent?: boolean; onClick: () => void }) {
  // Cochée, la ligne respire avant de partir : la case se remplit tout de suite.
  const { respire, lancer } = useRespiration();
  const souffle = respire("ligne");
  return (
    <button
      type="button"
      className={`li${props.urgent ? " urgent" : ""}${souffle ? " respire" : ""}`}
      role="checkbox"
      aria-checked={props.coche || souffle}
      onClick={() => (props.coche ? props.onClick() : lancer("ligne", props.onClick))}
    >
      <span className="case"><Coche /></span>
      <span className="li-texte">{props.texte}</span>
      {props.heure && <time>{props.heure}</time>}
      {props.fin && <small className={props.finNavi ? "navi" : undefined}>{props.fin}</small>}
    </button>
  );
}

/** Une ligne qui dit, sans case : le texte, à droite quand. */
export function LigneDite(props: { texte: string; fin?: string | null; heure?: string | null; urgent?: boolean; finNavi?: boolean }) {
  return (
    <div className={`li${props.urgent ? " urgent" : ""}`}>
      {props.heure && <time>{props.heure}</time>}
      <span className="li-texte">{props.texte}</span>
      {props.fin && <small className={props.finNavi ? "navi" : undefined}>{props.fin}</small>}
    </div>
  );
}

export const JOURS_COURTS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

/** Les sept jours de la semaine en cours, du lundi au dimanche. */
export function semaineDe(aujourdhui: Jour): Jour[] {
  const lundi = lundiDe(aujourdhui);
  return JOURS_COURTS.map((_, i) => decaler(lundi, { unite: "jour", tous: i }));
}

/** La bande de la semaine de l'agenda : les jours, aujourd'hui en laiton, un point sous ceux qui ont quelque chose. */
export function Jours({ aujourdhui, marques }: { aujourdhui: Jour; marques: ReadonlySet<Jour> }) {
  return (
    <div className="jours" aria-hidden>
      {semaineDe(aujourdhui).map((j, i) => (
        <div key={j} className={`${j === aujourdhui ? "auj" : ""}${marques.has(j) ? " pt" : ""}`.trim() || undefined}>
          <small>{JOURS_COURTS[i]}</small>
          <b>{Number(j.slice(8, 10))}</b>
        </div>
      ))}
    </div>
  );
}

/** Les sept soirs de la semaine du Chef : plein quand un repas est prévu. */
export function Semaine({ aujourdhui, pleins }: { aujourdhui: Jour; pleins: ReadonlySet<Jour> }) {
  return (
    <div className="semaine" aria-hidden>
      {semaineDe(aujourdhui).map((j, i) => (
        <div key={j} className={`${pleins.has(j) ? "plein" : ""}${j === aujourdhui ? " auj" : ""}`.trim() || undefined}>
          {JOURS_COURTS[i]}
          <b />
        </div>
      ))}
    </div>
  );
}

/** Une jauge nue, de 0 à 1. */
export function Jauge({ part }: { part: number }) {
  return (
    <div className="jauge" aria-hidden>
      <i style={{ "--p": `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` } as CSSProperties} />
    </div>
  );
}

/** « Mercredi 4 novembre ». */
export function dateLongue(d: Date): string {
  const t = d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « quatre », jusqu'à douze ; au-delà, le chiffre. */
export function enLettres(n: number): string {
  const mots = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];
  return mots[n] ?? String(n);
}
