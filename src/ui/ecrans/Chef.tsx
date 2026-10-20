import { useState } from "react";
import { avisDuPlat, avisSurPlat, ceQuEfface, etatDesAjouts, menuDeLaSemaine, prochainPassage, reglageChef, reglerChef, retirerAjout, validerMenu, type AvisPlat, type MenuSemaine } from "../../domaine/chef";
import { Icone } from "../Icone";
import { formaterHeure, HEURE_MAX, HEURE_MIN, JOURS_SEMAINE } from "../../domaine/rappels";
import { ecartJours } from "../../domaine/taches";
import type { Element } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import type { PropsPage } from "../modules";
import { Page } from "../pieces";
import { recettesDe, soirsPrevus } from "../../domaine/recettes";
import { ficheDeLaSemaine, platsDeLaSemaine } from "../../domaine/ficheSemaine";
import { FicheSemaine } from "./FicheSemaine";
import { FicheRecette, nomDuSoir, OngletRecettes } from "./Recettes";
import { nomFee } from "../fee";
import { Ligne, ListeVivante } from "../moteur/pieces";

const HEURES = Array.from({ length: HEURE_MAX - HEURE_MIN + 1 }, (_, i) => HEURE_MIN + i);

function quand(menu: MenuSemaine, aujourdhui: string): string {
  const ecart = ecartJours(menu.semaine, aujourdhui);
  if (ecart === 0) return "Préparés aujourd'hui";
  if (ecart === 1) return "Préparés hier";
  return `Préparés il y a ${ecart} jours`;
}

/** Le Chef de la semaine : ses repas, ce qu'il a mis sur la liste, quand il repasse, et les recettes du foyer. */
export function Chef(p: PropsPage & { recette?: string | null }) {
  // Les onglets sont ceux de l'espace Cuisine (Cette semaine, Nos recettes, Frigo).
  const onglet = p.onglet === "recettes" ? "recettes" : "semaine";
  // Une recette trouvée par la recherche s'ouvre directement.
  const [ficheId, setFicheId] = useState<string | null>(p.recette ?? null);
  const recettes = recettesDe(p.menus);
  const fiche = recettes.find((r) => r.id === ficheId) ?? null;
  const prevus = soirsPrevus(recettes, p.aujourdhui);
  const annoncer = useAnnoncer();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [aEffacer, setAEffacer] = useState(false);
  const menu = menuDeLaSemaine(p.menus, p.aujourdhui);
  const reglage = reglageChef(p.menus);
  const [ficheSemaine, setFicheSemaine] = useState(false);
  const plats = platsDeLaSemaine(recettes, menu, p.aujourdhui);
  const croisee = plats.length >= 2 ? ficheDeLaSemaine(plats, p.produits) : null;
  const passage = prochainPassage(reglage, new Date());

  /** Un cœur ou une croix sur un plat : le Chef s'en souvient les semaines suivantes. Un second toucher retire l'avis. */
  async function donnerAvis(titre: string, avis: AvisPlat) {
    vibrer();
    const avant = avisDuPlat(p.souvenirs, titre);
    if (avant) await p.depot.supprimerSouvenir(avant.souvenir.id);
    if (avant?.avis === avis) return;
    const souvenir = avisSurPlat(titre, avis, p.membreId, contexteReel);
    await p.depot.enregistrerSouvenir(souvenir);
    annoncer(avis === "aime" ? "Le Chef le refera de temps en temps." : "Le Chef ne le proposera plus.", async () => {
      await p.depot.supprimerSouvenir(souvenir.id);
      if (avant) await p.depot.enregistrerSouvenir(avant.souvenir);
    });
  }

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

  /** Valider : les recettes du menu restent dans la base, même s'il est effacé plus tard. */
  async function valider(m: MenuSemaine) {
    vibrer();
    await p.depot.enregistrerMenu(validerMenu(m, contexteReel));
    annoncer("Menu validé : ses recettes restent dans Nos recettes.", () => p.depot.enregistrerMenu(m));
  }

  /** Effacer : le menu, ses articles pas encore achetés et, s'il n'était pas validé, ses recettes jamais faites. */
  async function effacer(m: MenuSemaine) {
    setAEffacer(false);
    const efface = ceQuEfface(m, recettes, p.elements);
    const recettesParties = recettes.filter((r) => efface.recettes.includes(r.id));
    const articles = p.elements.filter((e) => efface.elements.includes(e.id));
    await p.depot.supprimerMenu(m.id);
    for (const r of recettesParties) await p.depot.supprimerMenu(r.id);
    if (articles.length) await p.depot.supprimerElements(articles.map((e) => e.id));
    vibrer();
    annoncer(articles.length ? `Menu effacé, ${articles.length} article${articles.length > 1 ? "s" : ""} retiré${articles.length > 1 ? "s" : ""} des courses.` : "Menu effacé.", async () => {
      await p.depot.enregistrerMenu(m);
      for (const r of recettesParties) await p.depot.enregistrerMenu(r);
      for (const e of articles) await p.depot.enregistrerElement(e);
    });
  }

  const regler = (changement: Parameters<typeof reglerChef>[0]) => p.depot.enregistrerMenu(reglerChef(changement, p.menus, contexteReel));

  const ajouts = menu ? etatDesAjouts(menu, p.elements) : [];
  return (
    <Page titre="Menus de la semaine" className="chef" aide={{ cle: "chef", texte: `Le Chef prépare les repas du soir avec ce qui reste au frigo et ajoute le manquant aux courses, marqué « Chef ». Chaque repas rejoint vos recettes, avec celles que tu donnes à ${nomFee()}.` }}>
      <FicheRecette {...p} recette={fiche} fermer={() => setFicheId(null)} />

      {onglet === "recettes" ? (
        <OngletRecettes {...p} recettes={recettes} ouvrir={setFicheId} />
      ) : (
        <>

        <Feuille ouverte={confirmer} onFermer={() => setConfirmer(false)} titre="Relancer le Chef ?">
          <div className="formulaire">
            <p className="discret">Il prépare de nouveaux repas. Ses articles pas encore cochés sur la liste de courses sont remplacés ; le reste de la liste ne bouge pas.</p>
            <button type="button" className="bouton-principal" onClick={() => void lancer()}>Relancer</button>
          </div>
        </Feuille>

        <Feuille ouverte={aEffacer} onFermer={() => setAEffacer(false)} titre="Effacer ce menu ?">
          <div className="formulaire">
            <p className="discret">
              Les articles du Chef pas encore cochés quittent la liste de courses.
              {menu?.valideLe ? " Le menu est validé : ses recettes restent dans Nos recettes." : " Ses recettes jamais cuisinées quittent aussi Nos recettes ; valide le menu d'abord pour les garder."}
            </p>
            <button type="button" className="bouton-principal" onClick={() => menu && void effacer(menu)}>Effacer</button>
          </div>
        </Feuille>

        {!p.jarvis ? (
          <div className="carte">
            <p className="discret">Le Chef passe par le serveur du foyer : il se réveille dès que le partage est activé.</p>
            <button className="bouton-principal" onClick={p.ouvrirPartage}>Activer le partage</button>
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
            {menu && (
              <div className="chef-actions-menu">
                {menu.valideLe ? (
                  <span className="discret chef-valide"><Icone nom="coche" taille={14} /> Validé</span>
                ) : (
                  <button type="button" className="lien" onClick={() => void valider(menu)}>Valider ce menu</button>
                )}
                <button type="button" className="lien danger" onClick={() => setAEffacer(true)}>Effacer ce menu</button>
              </div>
            )}
            {erreur && <p className="erreur">{erreur}</p>}
            {info && <p className="discret">{info}</p>}
          </section>
        )}

        {prevus.length > 0 && (
          <>
            <h2 className="rayon">Prévu ces soirs</h2>
            <ul className="carte groupe">
              {prevus.map(({ jour, recette }) => (
                <li key={recette.id}>
                  <button type="button" className="ligne recette-ligne" onClick={() => setFicheId(recette.id)}>
                    <span className="surtitre recette-soir">{nomDuSoir(jour, p.aujourdhui)}</span>
                    <span className="ligne-texte">{recette.titre}</span>
                    <span className="chevron" aria-hidden><Icone nom="suivant" taille={16} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {croisee && (
          <>
            <ul className="carte groupe fiche-semaine-entree">
              <li>
                <button type="button" className="ligne recette-ligne" onClick={() => setFicheSemaine(true)}>
                  <span className="ligne-texte">
                    <span className="recette-titre">La fiche de la semaine</span>
                    <span className="discret">
                      {croisee.plats.length} repas
                      {croisee.communs.length ? ` · ${croisee.communs.length} ingrédient${croisee.communs.length > 1 ? "s" : ""} en commun` : ""}
                      {` · ${croisee.aAcheter.length ? `${croisee.aAcheter.length} à acheter` : "tout est à la maison"}`}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden><Icone nom="suivant" taille={16} /></span>
                </button>
              </li>
            </ul>
            <FicheSemaine
              {...p}
              fiche={croisee}
              ouverte={ficheSemaine && !fiche}
              fermer={() => setFicheSemaine(false)}
              ouvrirRecette={setFicheId}
            />
          </>
        )}

        {menu && menu.alertesMitsu.length > 0 && (
          <section className="carte chef-alerte">
            {menu.alertesMitsu.map((a) => <p key={a}>{a}</p>)}
          </section>
        )}

        {menu && menu.repas.some((r) => !r.recetteId || !recettes.some((x) => x.id === r.recetteId)) && (
          <p className="discret chef-sans-recette">Ces soirs n'ont pas encore leur recette : relance le Chef pour avoir les ingrédients, les étapes et la fiche de la semaine.</p>
        )}

        {menu && (
          <ol className="chef-repas">
            {menu.repas.map((r, i) => {
              const recette = r.recetteId && recettes.some((x) => x.id === r.recetteId) ? r.recetteId : null;
              return (
              <li
                key={r.titre}
                className={`carte${recette ? " chef-repas-ouvrable" : ""}`}
                // Toute la carte ouvre la recette ; les boutons d'avis gardent leur propre geste.
                onClick={(e) => recette && !(e.target as HTMLElement).closest("button") && setFicheId(recette)}
              >
                <p className="surtitre">Soir {i + 1}</p>
                <p className="chef-plat">{r.titre}</p>
                <p className="discret">{r.description}</p>
                {r.avecLeStock.length > 0 && <p className="chef-stock">Avec {r.avecLeStock.join(", ").toLowerCase()}</p>}
                {recette && (
                  <button type="button" className="lien chef-voir-recette" onClick={() => setFicheId(recette)}>Voir la recette</button>
                )}
                <AvisChef avis={avisDuPlat(p.souvenirs, r.titre)?.avis ?? null} titre={r.titre} donner={(a) => void donnerAvis(r.titre, a)} />
              </li>
              );
            })}
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
            <ListeVivante className="carte groupe">
              {ajouts.map(({ ajout, element }) => (
                <Ligne key={ajout.elementId}>
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
                </Ligne>
              ))}
            </ListeVivante>
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
          <p className="discret chef-note">Il ne fait qu'ajouter à la liste de courses, jamais il ne touche au stock. Les croquettes et la litière de Mitsu restent sur zooplus : il prévient seulement. Sa dépense compte dans le plafond de {nomFee()}.</p>
        </section>
        </>
      )}
    </Page>
  );
}

function AvisChef(props: { titre: string; avis: AvisPlat | null; donner: (a: AvisPlat) => void }) {
  return (
    <div className="chef-avis" role="group" aria-label={`Ton avis sur ${props.titre}`}>
      <button className={`chef-avis-bouton${props.avis === "aime" ? " actif aime" : ""}`} aria-pressed={props.avis === "aime"} onClick={() => props.donner("aime")}>
        <Icone nom="coeur" taille={15} />
        {props.avis === "aime" ? "On aime" : "À refaire"}
      </button>
      <button className={`chef-avis-bouton${props.avis === "non" ? " actif" : ""}`} aria-pressed={props.avis === "non"} onClick={() => props.donner("non")}>
        <Icone nom="fermer" taille={15} />
        {props.avis === "non" ? "Plus jamais" : "Pas pour nous"}
      </button>
    </div>
  );
}
