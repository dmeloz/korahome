import { useState } from "react";
import { etatDesAjouts, menuDeLaSemaine, prochainPassage, reglageChef, reglerChef, retirerAjout, type MenuSemaine } from "../../domaine/chef";
import { formaterHeure, HEURE_MAX, HEURE_MIN, JOURS_SEMAINE } from "../../domaine/rappels";
import { ecartJours } from "../../domaine/taches";
import type { Element } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import type { PropsPage } from "../modules";

const HEURES = Array.from({ length: HEURE_MAX - HEURE_MIN + 1 }, (_, i) => HEURE_MIN + i);

function quand(menu: MenuSemaine, aujourdhui: string): string {
  const ecart = ecartJours(menu.semaine, aujourdhui);
  if (ecart === 0) return "Préparés aujourd'hui";
  if (ecart === 1) return "Préparés hier";
  return `Préparés il y a ${ecart} jours`;
}

/** Le Chef de la semaine : ses repas, ce qu'il a mis sur la liste, et quand il repasse. */
export function Chef(p: PropsPage) {
  const annoncer = useAnnoncer();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const menu = menuDeLaSemaine(p.menus, p.aujourdhui);
  const reglage = reglageChef(p.menus);
  const passage = prochainPassage(reglage, new Date());

  async function lancer() {
    if (!p.jarvis) return;
    setConfirmer(false);
    setOccupe(true);
    setErreur(null);
    setInfo(null);
    try {
      const { menu: nouveau, sansListe } = await p.jarvis.serveur.lancerChef(p.jarvis.foyerId);
      vibrer();
      setInfo(sansListe ? "Menus prêts. Crée une liste de courses pour qu'il y ajoute les ingrédients." : `Menus prêts, ${nouveau.ajouts.length} article${nouveau.ajouts.length > 1 ? "s" : ""} ajouté${nouveau.ajouts.length > 1 ? "s" : ""} aux courses.`);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  async function retirer(m: MenuSemaine, el: Element) {
    await p.depot.supprimerElements([el.id]);
    await p.depot.enregistrerMenu(retirerAjout(m, el.id));
    annoncer(`« ${el.texte} » retiré des courses.`, async () => {
      await p.depot.enregistrerElement(el);
      await p.depot.enregistrerMenu(m);
    });
  }

  const regler = (changement: Parameters<typeof reglerChef>[0]) => p.depot.enregistrerMenu(reglerChef(changement, p.menus, contexteReel));

  const ajouts = menu ? etatDesAjouts(menu, p.elements) : [];
  return (
    <main className="chef">
      <h1>Menus de la semaine</h1>

      <Feuille ouverte={confirmer} onFermer={() => setConfirmer(false)} titre="Relancer le Chef ?">
        <div className="formulaire">
          <p className="discret">Il prépare de nouveaux repas. Ses articles pas encore cochés sur la liste de courses sont remplacés ; le reste de la liste ne bouge pas.</p>
          <button type="button" className="bouton-principal" onClick={() => void lancer()}>Relancer</button>
        </div>
      </Feuille>

      {!p.jarvis ? (
        <div className="carte">
          <p className="discret">Le Chef passe par le serveur du foyer : ouvre le partage dans les Réglages pour le réveiller.</p>
        </div>
      ) : (
        <section className="carte chef-entete">
          {menu ? (
            <>
              <p className="surtitre">{quand(menu, p.aujourdhui)}</p>
              {menu.mot && <p className="chef-mot">{menu.mot}</p>}
            </>
          ) : (
            <p className="chef-mot">Le Chef lit le frigo et les placards, propose cinq repas du soir de saison et ajoute aux courses ce qui manque.</p>
          )}
          <button type="button" className="bouton-principal" disabled={occupe} onClick={() => (menu ? setConfirmer(true) : void lancer())}>
            {occupe ? "Le Chef cuisine…" : menu ? "Relancer le Chef" : "Lancer le Chef maintenant"}
          </button>
          {erreur && <p className="erreur">{erreur}</p>}
          {info && <p className="discret">{info}</p>}
        </section>
      )}

      {menu && menu.alertesMitsu.length > 0 && (
        <section className="carte chef-alerte">
          {menu.alertesMitsu.map((a) => <p key={a}>{a}</p>)}
        </section>
      )}

      {menu && (
        <ol className="chef-repas">
          {menu.repas.map((r, i) => (
            <li key={r.titre} className="carte">
              <p className="surtitre">Soir {i + 1}</p>
              <p className="chef-plat">{r.titre}</p>
              <p className="discret">{r.description}</p>
              {r.avecLeStock.length > 0 && <p className="chef-stock">Avec {r.avecLeStock.join(", ").toLowerCase()}</p>}
            </li>
          ))}
        </ol>
      )}

      {menu && menu.aFinir.length > 0 && (
        <>
          <h2 className="rayon">À finir vite</h2>
          <ul className="carte groupe">
            {menu.aFinir.map((t) => <li key={t} className="ligne"><span className="ligne-texte">{t}</span></li>)}
          </ul>
        </>
      )}

      {menu && ajouts.length > 0 && (
        <>
          <h2 className="rayon">Ajouté aux courses</h2>
          <ul className="carte groupe">
            {ajouts.map(({ ajout, element }) => (
              <li key={ajout.elementId}>
                {element && !element.coche ? (
                  <Glissable onSupprimer={() => void retirer(menu, element)} libelle="Retirer">
                    <div className="ligne">
                      <span className="ligne-texte">
                        {ajout.texte}
                        {ajout.quantite && <span className="quantite"> · {ajout.quantite}</span>}
                      </span>
                      <span className="discret">{ajout.rayon}</span>
                    </div>
                  </Glissable>
                ) : (
                  <div className="ligne coche">
                    <span className="ligne-texte">{ajout.texte}</span>
                    <span className="discret">{element ? "acheté" : "retiré"}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="discret">Glisse un article vers la gauche pour le retirer de la liste.</p>
        </>
      )}

      <h2 className="rayon">Passage automatique</h2>
      <section className="carte">
        <button type="button" className="ligne chef-interrupteur" onClick={() => void regler({ actif: !reglage.actif })} aria-pressed={reglage.actif}>
          <span className="ligne-texte">{passage ? `Prochain passage ${passage}` : "Désactivé : seulement quand tu le lances"}</span>
          <span className={`interrupteur${reglage.actif ? " actif" : ""}`} aria-hidden />
        </button>
        {reglage.actif && (
          <>
            <label className="rappels-horloge">
              <span className="rappels-heure" aria-hidden>{formaterHeure(reglage.heure)}</span>
              <span className="discret">chaque {JOURS_SEMAINE.find((j) => j.numero === reglage.jour)?.nom}</span>
              <select className="rappels-roue" aria-label="Heure du passage" value={reglage.heure} onChange={(e) => void regler({ heure: Number(e.target.value) })}>
                {HEURES.map((h) => <option key={h} value={h}>{formaterHeure(h)}</option>)}
              </select>
            </label>
            <div className="rappels-jours" role="group" aria-label="Jour du passage">
              {JOURS_SEMAINE.map((j) => (
                <button
                  key={j.numero}
                  className={`rappels-jour${reglage.jour === j.numero ? " actif" : ""}`}
                  aria-pressed={reglage.jour === j.numero}
                  aria-label={j.nom}
                  onClick={() => void regler({ jour: j.numero })}
                >
                  {j.initiale}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="discret chef-note">Il ne fait qu'ajouter à la liste de courses, jamais il ne touche au stock. Les croquettes et la litière de Mitsu restent sur zooplus : il prévient seulement. Sa dépense compte dans le plafond de Jarvis.</p>
      </section>
    </main>
  );
}
