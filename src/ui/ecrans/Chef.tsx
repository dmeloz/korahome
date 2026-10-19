import { useState } from "react";
import { avisDuPlat, avisSurPlat, etatDesAjouts, menuDeLaSemaine, prochainPassage, reglageChef, reglerChef, retirerAjout, type AvisPlat, type MenuSemaine } from "../../domaine/chef";
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
import { Onglets, Page } from "../pieces";
import { recettesDe, soirsPrevus } from "../../domaine/recettes";
import { FicheRecette, nomDuSoir, OngletRecettes } from "./Recettes";

const HEURES = Array.from({ length: HEURE_MAX - HEURE_MIN + 1 }, (_, i) => HEURE_MIN + i);

function quand(menu: MenuSemaine, aujourdhui: string): string {
  const ecart = ecartJours(menu.semaine, aujourdhui);
  if (ecart === 0) return "Préparés aujourd'hui";
  if (ecart === 1) return "Préparés hier";
  return `Préparés il y a ${ecart} jours`;
}

/** Le Chef de la semaine : ses repas, ce qu'il a mis sur la liste, quand il repasse, et les recettes du foyer. */
export function Chef(p: PropsPage) {
  const [onglet, setOnglet] = useState<"semaine" | "recettes">("semaine");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const recettes = recettesDe(p.menus);
  const fiche = recettes.find((r) => r.id === ficheId) ?? null;
  const prevus = soirsPrevus(recettes, p.aujourdhui);
  const annoncer = useAnnoncer();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const menu = menuDeLaSemaine(p.menus, p.aujourdhui);
  const reglage = reglageChef(p.menus);
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

  const regler = (changement: Parameters<typeof reglerChef>[0]) => p.depot.enregistrerMenu(reglerChef(changement, p.menus, contexteReel));

  const ajouts = menu ? etatDesAjouts(menu, p.elements) : [];
  return (
    <Page titre="Menus de la semaine" className="chef" aide={{ cle: "chef", texte: "Le Chef prépare les repas du soir avec ce qui reste au frigo et ajoute le manquant aux courses, marqué « Chef ». Chaque repas rejoint vos recettes, avec celles que tu donnes à Jarvis." }}>
      <Onglets
        libelle="Menus ou recettes"
        onglets={[{ id: "semaine", libelle: "Cette semaine" }, { id: "recettes", libelle: "Nos recettes", compte: recettes.length }]}
        actif={onglet}
        changer={(o) => {
          vibrer();
          setOnglet(o);
        }}
      />

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
                {r.recetteId && recettes.some((x) => x.id === r.recetteId) && (
                  <button type="button" className="lien chef-voir-recette" onClick={() => setFicheId(r.recetteId!)}>Voir la recette</button>
                )}
                <AvisChef avis={avisDuPlat(p.souvenirs, r.titre)?.avis ?? null} titre={r.titre} donner={(a) => void donnerAvis(r.titre, a)} />
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
