import { useState } from "react";
import { aTrierDe, enviesDe, nouveauTri, nouvelleEnvie, PIECES, poserTaille, SORTS, tailleDe, totalEnvies, type ATrier, type DocVetement, type Envie, type Sort } from "../../domaine/vetements";
import { formaterMontant } from "../../domaine/budget";
import type { Foyer, Jour } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { Ligne, ListeVivante } from "../moteur/pieces";
import { LigneAjout } from "../pieces/LigneAjout";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";

// L'onglet Vêtements de Maison (idée de Sarah, 0.0.78) : pour chacun, ses tailles, ses envies
// à acheter et ce qui attend d'être trié. On passe de l'un à l'autre d'un toucher : l'autre
// voit les tailles et les envies, de quoi trouver un cadeau qui va.

const CLE_TUTO = "vetements";

export function Vetements(props: { depot: Depot; foyer: Foyer; membreId: string | null; vetements: DocVetement[]; aujourdhui: Jour }) {
  const { depot, foyer, vetements, aujourdhui } = props;
  const annoncer = useAnnoncer();
  const membres = [...foyer.membres].sort((a, b) => Number(b.id === props.membreId) - Number(a.id === props.membreId));
  const [qui, setQui] = useState(props.membreId ?? membres[0]?.id ?? null);
  const [sort, setSort] = useState<Sort>("donner");
  const [tuto, setTuto] = useState(() => lireTexte(CLES.prefixeAide + CLE_TUTO, "1") !== "1");
  const maintenant = new Date().toISOString();
  const personne = membres.find((m) => m.id === qui) ?? null;
  const moi = qui === props.membreId;
  if (!personne) return <p className="discret">Dis d'abord qui utilise ce téléphone, dans Réglages.</p>;

  const envies = enviesDe(vetements, personne.id, maintenant);
  const aTrier = aTrierDe(vetements, personne.id, maintenant);
  const total = totalEnvies(envies);
  const prenom = moi ? "toi" : personne.prenom;

  async function changerTaille(piece: (typeof PIECES)[number]["id"], valeur: string) {
    const avant = tailleDe(vetements, personne!.id, piece);
    const apres = poserTaille(personne!.id, piece, valeur, contexteReel);
    if (!apres) {
      if (avant) await depot.supprimerVetement(avant.id);
      return;
    }
    if (avant?.valeur === apres.valeur) return;
    await depot.enregistrerVetement(apres);
  }

  async function ajouterEnvie(texte: string) {
    const envie = nouvelleEnvie(texte, personne!.id, props.membreId, contexteReel);
    if (!envie) return;
    await depot.enregistrerVetement(envie);
  }

  async function acheter(e: Envie) {
    vibrer();
    await depot.enregistrerVetement({ ...e, acheteLe: e.acheteLe ? null : aujourdhui });
    if (!e.acheteLe) annoncer(`« ${e.titre} » acheté.`, () => depot.enregistrerVetement(e));
  }

  async function retirer(d: Envie | ATrier) {
    await depot.supprimerVetement(d.id);
    annoncer(`« ${d.titre} » retiré.`, () => depot.enregistrerVetement(d));
  }

  async function ajouterTri(texte: string) {
    const t = nouveauTri(texte, personne!.id, sort, contexteReel);
    if (!t) return;
    await depot.enregistrerVetement(t);
  }

  async function faireTri(t: ATrier) {
    vibrer();
    await depot.enregistrerVetement({ ...t, faitLe: t.faitLe ? null : aujourdhui });
    if (!t.faitLe) annoncer(`« ${t.titre} » : fait.`, () => depot.enregistrerVetement(t));
  }

  async function changerSort(t: ATrier) {
    const i = SORTS.findIndex((s) => s.id === t.sort);
    await depot.enregistrerVetement({ ...t, sort: SORTS[(i + 1) % SORTS.length].id });
  }

  return (
    <>
      {tuto && (
        <section className="carte vetements-tuto" aria-label="Comment ça marche">
          <p className="surtitre">Vos vêtements, à deux</p>
          <ol>
            <li><strong>Tes tailles</strong> : note-les une fois. L'autre les voit, pratique pour un cadeau.</li>
            <li><strong>Tes envies</strong> : écris « veste en laine 120 », Kora garde le prix. Coche quand c'est acheté.</li>
            <li><strong>À trier</strong> : ce qui ne sert plus, et ce qu'on en fait : donner, vendre, réparer, jeter.</li>
          </ol>
          <button
            className="lien"
            onClick={() => {
              // Stockage indisponible : le tuto se range pour cette visite.
              ecrireTexte(CLES.prefixeAide + CLE_TUTO, "1");
              setTuto(false);
            }}
          >
            Compris
          </button>
        </section>
      )}

      {membres.length > 1 && (
        <div className="puces vetements-qui" role="tablist" aria-label="De qui">
          {membres.map((m) => (
            <button key={m.id} role="tab" aria-selected={m.id === qui} className={`puce${m.id === qui ? " active" : ""}`} onClick={() => setQui(m.id)}>
              {m.id === props.membreId ? "Moi" : m.prenom}
            </button>
          ))}
        </div>
      )}

      <section>
        <p className="surtitre">{moi ? "Tes tailles" : `Les tailles de ${personne.prenom}`}</p>
        <ul className="carte groupe vetements-tailles">
          {PIECES.map((p) => {
            const t = tailleDe(vetements, personne.id, p.id);
            return (
              <li key={p.id} className="ligne">
                <span className="ligne-texte">{p.nom}</span>
                <input
                  className="vetements-taille"
                  defaultValue={t?.valeur ?? ""}
                  key={`${personne.id}-${t?.valeur ?? ""}`}
                  placeholder={p.exemple}
                  aria-label={`${p.nom} : taille de ${prenom}`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  enterKeyHint="done"
                  onBlur={(e) => void changerTaille(p.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <p className="surtitre">
          {moi ? "Tes envies" : `Les envies de ${personne.prenom}`}
          {total > 0 && <span className="discret"> · {formaterMontant(total)}</span>}
        </p>
        <ListeVivante className="carte groupe">
          {envies.map((e) => {
            const parAutre = e.ajoutePar && e.ajoutePar !== e.membreId ? foyer.membres.find((m) => m.id === e.ajoutePar)?.prenom : null;
            const details = [e.prix !== null ? formaterMontant(e.prix) : null, e.ou, parAutre ? `idée de ${parAutre}` : null, e.acheteLe ? "acheté" : null].filter(Boolean);
            return (
              <Ligne key={e.id}>
                <Glissable onSupprimer={() => void retirer(e)} libelle="Retirer" onFait={e.acheteLe ? undefined : () => void acheter(e)} libelleFait="Acheté">
                  <div className={`ligne tache${e.acheteLe ? " coche" : ""}`}>
                    <button className="case" onClick={() => void acheter(e)} aria-label={e.acheteLe ? `Remettre « ${e.titre} » dans les envies` : `« ${e.titre} » acheté`}>
                      {e.acheteLe ? "✓" : ""}
                    </button>
                    <span className="tache-texte">
                      <span className="ligne-texte">{e.titre}</span>
                      {details.length > 0 && <span className="tache-details">{details.join(" · ")}</span>}
                    </span>
                  </div>
                </Glissable>
              </Ligne>
            );
          })}
          <Ligne key="ajout">
            <LigneAjout placeholder={moi ? "Veste en laine 120" : `Une idée pour ${personne.prenom}`} ajouter={ajouterEnvie} />
          </Ligne>
        </ListeVivante>
      </section>

      <section>
        <p className="surtitre">À trier</p>
        <div className="puces vetements-sorts" role="radiogroup" aria-label="Quoi en faire">
          {SORTS.map((s) => (
            <button key={s.id} role="radio" aria-checked={s.id === sort} className={`puce petite${s.id === sort ? " active" : ""}`} onClick={() => setSort(s.id)}>
              {s.nom}
            </button>
          ))}
        </div>
        <ListeVivante className="carte groupe">
          {aTrier.map((t) => (
            <Ligne key={t.id}>
              <Glissable onSupprimer={() => void retirer(t)} libelle="Retirer" onFait={t.faitLe ? undefined : () => void faireTri(t)} libelleFait="Fait">
                <div className={`ligne tache${t.faitLe ? " coche" : ""}`}>
                  <button className="case" onClick={() => void faireTri(t)} aria-label={t.faitLe ? `Remettre « ${t.titre} » à trier` : `« ${t.titre} » : fait`}>
                    {t.faitLe ? "✓" : ""}
                  </button>
                  <span className="ligne-texte">{t.titre}</span>
                  <button className="puce petite" onClick={() => void changerSort(t)} aria-label={`${t.titre} : ${SORTS.find((s) => s.id === t.sort)?.nom}, toucher pour changer`}>
                    {SORTS.find((s) => s.id === t.sort)?.nom}
                  </button>
                </div>
              </Glissable>
            </Ligne>
          ))}
          <Ligne key="ajout">
            <LigneAjout placeholder="Pull trop petit" ajouter={ajouterTri} />
          </Ligne>
        </ListeVivante>
        {aTrier.length === 0 && (
          <p className="discret vetements-vide">
            <Icone nom="info" taille={14} /> Choisis quoi en faire, puis écris la pièce.
          </p>
        )}
      </section>
    </>
  );
}
