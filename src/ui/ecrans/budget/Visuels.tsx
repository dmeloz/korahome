import { useState } from "react";
import {
  formaterMontant,
  nommerMois,
  POTS,
  type BilanPersonne,
  type MoisDeFactures,
  type PartDuCommun,
  type PointEpargne,
  type PrixQuiMonte,
  type RythmeCourses,
} from "../../../domaine/budget";
import { Icone } from "../../Icone";
import { useDessin } from "../../mouvement";

// Les visuels du Budget : sobres, sans légende inutile, un chiffre qui compte par visuel.
// Les couleurs des pots viennent des variables --pot-* (styles/budget.css), pour les deux thèmes.

const montant = (n: number) => formaterMontant(n);
const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());
const initiale = (mois: string) => majuscule(nommerMois(mois)).slice(0, 1);
const COURTS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const court = (mois: string) => COURTS[Number(mois.slice(5, 7)) - 1] ?? mois;

/** L'anneau du mois : où part l'argent du compte commun. Toucher une part en montre le détail. */
export function AnneauDuCommun(props: { parts: PartDuCommun[]; entree: number; noms: (pot: PartDuCommun["pot"]) => string }) {
  const [choisi, setChoisi] = useState<PartDuCommun["pot"] | null>(null);
  const dessin = useDessin<HTMLElement>();
  const rayon = 52;
  const tour = 2 * Math.PI * rayon;
  let depart = 0;
  const actif = props.parts.find((x) => x.pot === choisi) ?? null;
  return (
    <section ref={dessin} className="carte budget-anneau">
      <div className="budget-anneau-dessin">
        <svg viewBox="0 0 140 140" role="img" aria-label="Répartition du compte commun" data-apparait="">
          <circle cx="70" cy="70" r={rayon} className="budget-anneau-fond" />
          {props.parts.map((x) => {
            const longueur = Math.max(0, x.part * tour - 3);
            const trait = (
              <circle
                key={x.pot}
                cx="70"
                cy="70"
                r={rayon}
                className={`budget-anneau-part pot-${x.pot}${choisi && choisi !== x.pot ? " estompe" : ""}`}
                strokeDasharray={`${longueur} ${tour - longueur}`}
                strokeDashoffset={-depart}
                onClick={() => setChoisi(choisi === x.pot ? null : x.pot)}
              />
            );
            depart += x.part * tour;
            return trait;
          })}
        </svg>
        <div className="budget-anneau-centre" aria-live="polite">
          <span className="budget-solde">{montant(actif ? actif.montant : props.entree)}</span>
          <span className="discret">{actif ? props.noms(actif.pot) : "par mois"}</span>
        </div>
      </div>
      <ul className="budget-legende">
        {props.parts.map((x) => (
          <li key={x.pot}>
            <button type="button" className={choisi === x.pot ? "actif" : ""} onClick={() => setChoisi(choisi === x.pot ? null : x.pot)} aria-pressed={choisi === x.pot}>
              <span className={`budget-pastille pot-${x.pot}`} aria-hidden />
              <span className="ligne-texte">{props.noms(x.pot)}</span>
              <span className="discret">{Math.round(x.part * 100)} %</span>
            </button>
          </li>
        ))}
      </ul>
      {actif && actif.postes.length > 0 && (
        <ul className="budget-detail">
          {actif.postes.map((poste) => (
            <li key={poste.id}>
              <span>{poste.libelle}</span>
              <span className="budget-montant">
                {montant(poste.montant)}
                {poste.frequence === "an" ? " par an" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {actif && !actif.postes.length && <p className="discret budget-detail-vide">{POTS[actif.pot].description}</p>}
    </section>
  );
}

/** La jauge de la carte courses, avec le repère de ce qu'on aurait dépensé à ce jour en suivant le budget. */
export function JaugeRythme({ rythme }: { rythme: RythmeCourses }) {
  const rempli = Math.min(1, rythme.depense / rythme.budget);
  const vite = rythme.depense > rythme.attendu * 1.1;
  return (
    <span className={`widget-jauge budget-rythme${vite ? " vite" : ""}`} aria-hidden>
      <span style={{ width: `${Math.round(rempli * 100)}%` }} />
      <i style={{ left: `${Math.round(rythme.avanceeDuMois * 100)}%` }} />
    </span>
  );
}

export function phraseRythme(r: RythmeCourses): string {
  if (r.projection === null) return `${montant(r.depense)} sur ${montant(r.budget)} ce mois`;
  const ecart = r.projection - r.budget;
  if (ecart > r.budget * 0.05) return `À ce rythme, ${montant(Math.round(r.projection))} à la fin du mois`;
  return `${montant(r.depense)} sur ${montant(r.budget)}, dans le rythme`;
}

/** Les douze mois du pot factures : une barre par mois, les mois lourds ressortent. */
export function MoisLourds({ mois, aujourdhui }: { mois: MoisDeFactures[]; aujourdhui: string }) {
  const [choisi, setChoisi] = useState<string | null>(null);
  const dessin = useDessin<HTMLElement>();
  if (!mois.length) return null;
  const max = Math.max(1, ...mois.map((m) => m.sorties));
  const moyenne = mois.reduce((t, m) => t + m.sorties, 0) / mois.length;
  const manque = mois.find((m) => m.solde < 0);
  const actif = mois.find((m) => m.mois === choisi) ?? null;
  return (
    <section ref={dessin} className="carte budget-mois-lourds">
      <div className="budget-barres" role="group" aria-label="Factures des douze mois qui viennent">
        {mois.map((m) => (
          <button
            type="button"
            key={m.mois}
            className={`budget-barre${m.sorties > moyenne * 1.4 ? " lourde" : ""}${m.solde < 0 ? " manque" : ""}${choisi === m.mois ? " actif" : ""}`}
            onClick={() => setChoisi(choisi === m.mois ? null : m.mois)}
            aria-label={`${nommerMois(m.mois, aujourdhui)} : ${montant(m.sorties)}`}
          >
            <span className="budget-barre-trait" data-cascade="" style={{ height: `${Math.max(3, Math.round((m.sorties / max) * 78))}%` }} />
            <span className="budget-barre-nom">{initiale(m.mois)}</span>
          </button>
        ))}
      </div>
      {actif ? (
        <p className="discret">
          {majuscule(nommerMois(actif.mois, aujourdhui))} : {montant(actif.sorties)}
          {actif.annuelles.length ? `, dont ${actif.annuelles.map((a) => `${a.libelle.toLowerCase()} ${montant(a.montant)}`).join(", ")}` : ""}. Pot à la fin du mois : {montant(actif.solde)}.
        </p>
      ) : manque ? (
        <p className="budget-alerte">
          En {nommerMois(manque.mois, aujourdhui)}, le pot factures manquerait de {montant(-manque.solde)}.
        </p>
      ) : (
        <p className="discret">Le pot factures tient toute l'année. Touche un mois pour le détail.</p>
      )}
    </section>
  );
}

/** Le trajet du salaire : charges, versement au commun, ce qui reste, en une barre. */
export function TrajetSalaire({ b }: { b: BilanPersonne }) {
  if (b.revenu <= 0) return null;
  const part = (n: number) => `${Math.max(0, Math.min(100, (n / b.revenu) * 100))}%`;
  return (
    <div className="budget-trajet" aria-label={`Sur ${montant(b.revenu)} : ${montant(b.charges)} de charges, ${montant(b.versement)} au commun, ${montant(b.reste)} qui reste`}>
      <div className="budget-trajet-barre" aria-hidden>
        <span className="charges" style={{ width: part(b.charges) }} />
        <span className="versement" style={{ width: part(b.versement) }} />
        <span className="reste" style={{ width: part(b.reste) }} />
      </div>
      <div className="budget-trajet-legende" aria-hidden>
        <span><i className="charges" />Charges {Math.round((b.charges / b.revenu) * 100)} %</span>
        <span><i className="versement" />Commun {Math.round((b.versement / b.revenu) * 100)} %</span>
        <span><i className="reste" />Reste {Math.round((b.reste / b.revenu) * 100)} %</span>
      </div>
    </div>
  );
}

/** La courbe de l'épargne : le trait plein pour ce qui est fait, pointillé pour la suite au rythme prévu. */
export function CourbeEpargne({ points, objectif, aujourdhui }: { points: PointEpargne[]; objectif: number | null; aujourdhui: string }) {
  const dessin = useDessin<HTMLElement>();
  if (points.length < 2) return null;
  const l = 300;
  const h = 110;
  const haut = Math.max(1, objectif ?? 0, ...points.map((p) => p.solde)) * 1.08;
  const x = (i: number) => 6 + (i / (points.length - 1)) * (l - 12);
  const y = (v: number) => h - 8 - (Math.max(0, v) / haut) * (h - 18);
  const trace = (liste: { i: number; p: PointEpargne }[]) => liste.map(({ i, p }, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(p.solde).toFixed(1)}`).join(" ");
  const indexes = points.map((p, i) => ({ i, p }));
  const faits = indexes.filter(({ p }) => !p.prevu);
  const prevus = indexes.filter(({ p }, i) => p.prevu || i === faits.length - 1);
  const dernier = faits[faits.length - 1];
  const fin = points[points.length - 1];
  return (
    <section ref={dessin} className="carte budget-courbe">
      <svg viewBox={`0 0 ${l} ${h}`} role="img" aria-label={`Épargne : ${montant(dernier.p.solde)} aujourd'hui, ${montant(fin.solde)} en ${nommerMois(fin.mois, aujourdhui)} au rythme prévu`}>
        {objectif ? <line x1="0" x2={l} y1={y(objectif)} y2={y(objectif)} className="budget-courbe-objectif" /> : null}
        <path d={`${trace(faits)} L${x(dernier.i).toFixed(1)} ${h - 8} L${x(0).toFixed(1)} ${h - 8} Z`} className="budget-courbe-aire" data-apparait="" />
        <path d={trace(faits)} className="budget-courbe-trait" pathLength={1} data-dessin="" />
        {prevus.length > 1 && <path d={trace(prevus)} className="budget-courbe-trait prevu" data-apparait="" />}
        <circle cx={x(dernier.i)} cy={y(dernier.p.solde)} r="3.5" className="budget-courbe-point" data-apparait="" />
      </svg>
      <p className="discret">
        {fin.prevu ? `Au rythme prévu : ${montant(fin.solde)} en ${nommerMois(fin.mois, aujourdhui)}.` : `${montant(dernier.p.solde)} aujourd'hui.`}
      </p>
    </section>
  );
}

/** Les courses mois par mois : des barres fines, le mois en cours en laiton. */
export function CoursesParMois({ mois, budget, aujourdhui }: { mois: { mois: string; total: number }[]; budget: number; aujourdhui: string }) {
  const dessin = useDessin<HTMLElement>();
  const max = Math.max(1, budget, ...mois.map((m) => m.total));
  return (
    <section ref={dessin} className="carte">
      <div className="budget-barres larges" role="img" aria-label={mois.map((m) => `${nommerMois(m.mois, aujourdhui)} ${montant(m.total)}`).join(", ")}>
        {budget > 0 && <span className="budget-barres-repere" style={{ bottom: `calc(${((budget / max) * 78).toFixed(1)}% + 17px)` }} />}
        {mois.map((m, i) => (
          <div key={m.mois} className={`budget-barre${i === mois.length - 1 ? " actif" : ""}${budget > 0 && m.total > budget ? " manque" : ""}`}>
            <span className="budget-barre-valeur">{m.total ? Math.round(m.total) : ""}</span>
            <span className="budget-barre-trait" data-cascade="" style={{ height: `${Math.max(2, Math.round((m.total / max) * 70))}%` }} />
            <span className="budget-barre-nom">{court(m.mois)}</span>
          </div>
        ))}
      </div>
      {budget > 0 && <p className="discret">Le trait : le budget de {montant(budget)} par mois.</p>}
    </section>
  );
}

/** La part de chaque magasin, en une barre. */
export function Magasins({ magasins }: { magasins: { magasin: string; total: number; part: number }[] }) {
  if (!magasins.length) return null;
  return (
    <section className="carte budget-magasins">
      <div className="budget-trajet-barre" aria-hidden>
        {magasins.map((m, i) => (
          <span key={m.magasin} className={`magasin-${i % 5}`} style={{ width: `${m.part * 100}%` }} />
        ))}
      </div>
      <ul className="budget-detail">
        {magasins.map((m, i) => (
          <li key={m.magasin}>
            <span>
              <i className={`budget-pastille magasin-${i % 5}`} aria-hidden />
              {m.magasin}
            </span>
            <span className="budget-montant">
              {montant(m.total)} <span className="discret">· {Math.round(m.part * 100)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrixQuiMontent({ hausses }: { hausses: PrixQuiMonte[] }) {
  if (!hausses.length) return <p className="discret budget-note">Aucun prix en hausse sur vos tickets. Kora compare chaque ligne d'un ticket à l'autre.</p>;
  return (
    <ul className="carte groupe">
      {hausses.slice(0, 8).map((h) => (
        <li key={`${h.nom}-${h.magasin}`} className="ligne">
          <span className="ligne-texte">
            {h.nom}
            <span className="tache-details">
              {" "}
              · {h.magasin ?? "ticket"} · {montant(h.avant.prix)} avant
            </span>
          </span>
          <span className="budget-montant">
            {montant(h.maintenant.prix)} <span className="budget-hausse">+{Math.round(h.hausse * 100)} %</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Le mot de Jarvis sur le mois écoulé : une ligne, discrète. */
export function MotDeJarvis({ texte }: { texte: string }) {
  return (
    <p className="budget-mot">
      <Icone nom="jarvis" taille={16} />
      <span>{texte}</span>
    </p>
  );
}
