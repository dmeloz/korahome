import { useState } from "react";
import { appareilsDe, decrireAchat, etatGarantie, ID_DECHETS, modifierAppareil, nomDechet, nouvelAppareil, prochainesCollectes, reglageDechets, reglerCollecte, RYTHMES, TYPES_DECHETS, type Appareil, type Collecte, type DocMaison, type Rythme, type TypeDechet } from "../../domaine/maison";
import { NOMS_JOURS } from "../../domaine/texte";
import type { Jour } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { Glissable } from "../Glissable";
import { Ligne, ListeVivante } from "../moteur/pieces";
import { LigneAjout } from "../pieces/LigneAjout";

// La maison, sous l'onglet Entretien (0.0.79) : les jours des déchets, réglés une fois pour le
// foyer (ils changent de rue en rue : à Renens, par secteur), et nos appareils avec leur garantie.
// Kora dit « Sortir le papier » la veille au soir sur l'accueil et dans le rappel du matin.

/** Le calendrier officiel de la commune, pour lire ses jours avant de les régler. */
const CALENDRIER_RENENS = "https://www.localcities.ch/fr/calendrier-collecte-dechets/renens-vd/7101";
const JOURS_OUVRES = [1, 2, 3, 4, 5, 6, 0];
const SEMAINES: readonly { n: 1 | 2 | 3 | 4; nom: string }[] = [
  { n: 1, nom: "1er" },
  { n: 2, nom: "2e" },
  { n: 3, nom: "3e" },
  { n: 4, nom: "4e" },
];

export function Dechets(props: { depot: Depot; maison: DocMaison[]; aujourdhui: Jour }) {
  const { depot, aujourdhui } = props;
  const reglage = reglageDechets(props.maison);
  const [ouverte, setOuverte] = useState(false);
  const prochaines = prochainesCollectes(reglage, aujourdhui);

  async function regler(type: TypeDechet, collecte: Omit<Collecte, "type"> | null) {
    await depot.enregistrerMaison(reglerCollecte(reglage, type, collecte, contexteReel));
  }

  return (
    <section className="carte maison-dechets">
      <div className="maison-entete">
        <p className="surtitre">Déchets</p>
        <button className="lien" onClick={() => setOuverte(true)} aria-haspopup="dialog">
          {reglage?.collectes.length ? "Régler" : "Régler les jours"}
        </button>
      </div>
      {prochaines.length ? (
        <ul className="maison-prochaines">
          {prochaines.map((p) => (
            <li key={p.collecte.type}>
              <span className="ligne-texte">{nomDechet(p.collecte.type)}</span>
              <span className={`discret${p.quand === "aujourd'hui" || p.quand === "demain" ? " maison-bientot" : ""}`}>{p.quand}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discret maison-vide">Dis à Kora quels jours passent les ordures, le papier et le verre dans ta rue : elle rappellera de les sortir la veille au soir.</p>
      )}

      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre="Jours des déchets">
        <div className="formulaire maison-reglage">
          <p className="discret">
            Les jours changent selon la rue. <a href={CALENDRIER_RENENS} target="_blank" rel="noreferrer">Voir le calendrier de Renens</a>, puis règle chaque sorte.
          </p>
          {TYPES_DECHETS.map((t) => {
            const c = reglage?.collectes.find((x) => x.type === t.id) ?? null;
            return (
              <fieldset key={t.id} className="maison-sorte">
                <legend>
                  <label className="maison-interrupteur">
                    <input type="checkbox" checked={!!c} onChange={(e) => void regler(t.id, e.target.checked ? { jour: 1, rythme: "semaine" } : null)} />
                    <span>{t.nom}</span>
                  </label>
                </legend>
                {c && (
                  <>
                    <div className="puces" role="radiogroup" aria-label={`Jour : ${t.nom}`}>
                      {JOURS_OUVRES.map((j) => (
                        <button key={j} type="button" role="radio" aria-checked={c.jour === j} className={`puce petite${c.jour === j ? " active" : ""}`} onClick={() => void regler(t.id, { ...c, jour: j })}>
                          {NOMS_JOURS[j].slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <div className="puces" role="radiogroup" aria-label={`Rythme : ${t.nom}`}>
                      {RYTHMES.map((r) => (
                        <button key={r.id} type="button" role="radio" aria-checked={c.rythme === r.id} className={`puce petite${c.rythme === r.id ? " active" : ""}`} onClick={() => void regler(t.id, { ...c, rythme: r.id as Rythme })}>
                          {r.nom}
                        </button>
                      ))}
                    </div>
                    {c.rythme === "quinzaine" && (
                      <label>
                        Une date de passage connue
                        <input type="date" value={c.reference ?? ""} min="2024-01-01" onChange={(e) => void regler(t.id, { ...c, reference: e.target.value || undefined })} />
                      </label>
                    )}
                    {c.rythme === "mois" && (
                      <div className="puces" role="radiogroup" aria-label={`Quelle semaine : ${t.nom}`}>
                        {SEMAINES.map((s) => (
                          <button key={s.n} type="button" role="radio" aria-checked={(c.semaineDuMois ?? 1) === s.n} className={`puce petite${(c.semaineDuMois ?? 1) === s.n ? " active" : ""}`} onClick={() => void regler(t.id, { ...c, semaineDuMois: s.n })}>
                            {s.nom} {NOMS_JOURS[c.jour]}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </fieldset>
            );
          })}
        </div>
      </Feuille>
    </section>
  );
}

export function Appareils(props: { depot: Depot; maison: DocMaison[]; aujourdhui: Jour }) {
  const { depot, aujourdhui } = props;
  const annoncer = useAnnoncer();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const appareils = appareilsDe(props.maison);
  const a = appareils.find((x) => x.id === ouvert) ?? null;

  async function ajouter(texte: string) {
    const n = nouvelAppareil(texte, contexteReel);
    if (n) await depot.enregistrerMaison(n);
  }
  async function retirer(x: Appareil) {
    await depot.supprimerMaison(x.id);
    annoncer(`« ${x.nom} » retiré.`, () => depot.enregistrerMaison(x));
  }
  const changer = (x: Appareil, changements: Parameters<typeof modifierAppareil>[1]) => depot.enregistrerMaison(modifierAppareil(x, changements, contexteReel));
  const nombre = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <section>
      <p className="surtitre">Nos appareils</p>
      <ListeVivante className="carte groupe">
        {appareils.map((x) => {
          const g = etatGarantie(x, aujourdhui);
          const details = [decrireAchat(x), g.etat === "inconnue" ? null : g.texte].filter(Boolean);
          return (
            <Ligne key={x.id}>
              <Glissable onSupprimer={() => void retirer(x)} libelle="Retirer">
                <button className="ligne tache maison-appareil" onClick={() => setOuvert(x.id)} aria-haspopup="dialog">
                  <span className="tache-texte">
                    <span className="ligne-texte">{x.nom}</span>
                    {details.length > 0 && <span className={`tache-details${g.etat === "bientot" ? " retard" : ""}`}>{details.join(" · ")}</span>}
                  </span>
                </button>
              </Glissable>
            </Ligne>
          );
        })}
        <Ligne key="ajout">
          <LigneAjout placeholder={appareils.length ? "Un autre appareil" : "Lave-linge, frigo, aspirateur…"} ajouter={ajouter} />
        </Ligne>
      </ListeVivante>
      {appareils.length === 0 && <p className="discret maison-vide">Garde la date d'achat et la garantie de chaque appareil : Kora dit quand elle finit.</p>}

      <Feuille ouverte={!!a} onFermer={() => setOuvert(null)} titre={a?.nom}>
        {a && (
          <div className="formulaire maison-fiche" key={a.id}>
            {(() => {
              const g = etatGarantie(a, aujourdhui);
              return g.etat === "inconnue" ? null : <p className={`discret${g.etat === "bientot" ? " retard" : ""}`}>{g.texte}</p>;
            })()}
            <label>
              Nom
              <input type="text" defaultValue={a.nom} maxLength={60} onBlur={(e) => void changer(a, { nom: e.target.value })} />
            </label>
            <label>
              Acheté le
              <input type="date" value={a.acheteLe ?? ""} min="1990-01-01" onChange={(e) => void changer(a, { acheteLe: e.target.value || null })} />
            </label>
            <label>
              Garantie (mois)
              <input type="number" inputMode="numeric" min={0} max={240} defaultValue={a.garantieMois ?? ""} placeholder="24" onBlur={(e) => void changer(a, { garantieMois: nombre(e.target.value) })} />
            </label>
            <label>
              Prix (CHF)
              <input type="number" inputMode="decimal" min={0} step="0.05" defaultValue={a.prix ?? ""} onBlur={(e) => void changer(a, { prix: nombre(e.target.value) })} />
            </label>
            <label>
              Magasin
              <input type="text" defaultValue={a.magasin ?? ""} placeholder="Fust, Galaxus…" onBlur={(e) => void changer(a, { magasin: e.target.value.trim() || null })} />
            </label>
            <label>
              Note
              <textarea defaultValue={a.note ?? ""} rows={2} placeholder="Numéro de série, où est la notice…" onBlur={(e) => void changer(a, { note: e.target.value.trim() || null })} />
            </label>
            <button type="button" className="lien danger" onClick={() => { setOuvert(null); void retirer(a); }}>
              Retirer
            </button>
          </div>
        )}
      </Feuille>
    </section>
  );
}

export { ID_DECHETS };
