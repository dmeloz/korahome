import { useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { avisDuPlat, avisSurPlat, type AvisPlat } from "../../domaine/chef";
import { aConfirmer, appliquerActions, decrireFoyer, lireActions } from "../../domaine/jarvis";
import {
  cleRecette,
  decrireDisponibilite,
  disponibilite,
  ecrireIngredient,
  estDeBase,
  ingredientsPour,
  lireLigneIngredient,
  marquerCuisinee,
  modifierRecette,
  nouvelleRecette,
  ordonnerRecettes,
  PORTIONS_MAX,
  preparerCourses,
  prevoirRecette,
  produitPour,
  septProchainsJours,
  SOURCES_RECETTE,
  trouverRecette,
  type FiltreRecettes,
  type IngredientRecette,
  type Recette,
} from "../../domaine/recettes";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { annulerModifications, enregistrerModifications, pdfPourJarvis, photoPourJarvis } from "../jarvis";
import type { PieceJointe } from "../../donnees/distant";
import type { PropsPage } from "../modules";
import { useGestionnaireBarre, useInvitationBarre } from "../pieces";
import { nomFee } from "../fee";
import { Ligne, ListeVivante } from "../moteur/pieces";
import { ignorer } from "../journal";

// Les recettes du foyer, dans « Menus de la semaine » : la base qui se remplit seule (le Chef,
// les liens et photos lus par Jarvis, ce qu'on écrit), ce qu'on peut faire ce soir avec le
// stock, la fiche avec ses portions, les courses du manquant, un soir de la semaine et le
// mode cuisine. Les règles sont dans src/domaine/recettes.ts.

const FILTRES: { id: FiltreRecettes; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes" },
  { id: "ce-soir", libelle: "Ce soir avec ce qu'on a" },
  { id: "aimees", libelle: "On aime" },
];

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** « Ce soir », « Demain », « jeu. 22 ». */
export function nomDuSoir(jour: string, aujourdhui: string): string {
  const jours = septProchainsJours(aujourdhui);
  if (jour === jours[0]) return "Ce soir";
  if (jour === jours[1]) return "Demain";
  const [a, m, j] = jour.split("-").map(Number);
  return `${JOURS_COURTS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j}`;
}

/** L'onglet Recettes : les filtres, la liste, et la barre qui ajoute une recette. */
export function OngletRecettes(p: PropsPage & { recettes: Recette[]; ouvrir: (id: string) => void }) {
  const annoncer = useAnnoncer();
  const [filtre, setFiltre] = useState<FiltreRecettes>("toutes");
  const [nouvelle, setNouvelle] = useState<string | null>(null);
  const [lecture, setLecture] = useState<string | null>(null);
  const avis = (r: Recette) => avisDuPlat(p.souvenirs, r.titre)?.avis ?? null;
  const liste = ordonnerRecettes(p.recettes, p.produits, filtre, (r) => avis(r) === "aime", (r) => avis(r) === "non");

  useInvitationBarre("Une recette, ex. gratin de courge");
  useGestionnaireBarre("module:chef", async (texte) => {
    const t = texte.trim();
    // Un titre seul ouvre la fiche à remplir (ou la recette qui porte déjà ce nom) ;
    // une recette entière, collée ou dictée, part chez Jarvis qui la range.
    const entiere = t.length > 60 || /[:\n]|,.*,/.test(t);
    if (!entiere) {
      const deja = trouverRecette(p.recettes, t);
      if (deja && deja.cle === cleRecette(t)) p.ouvrir(deja.id);
      else setNouvelle(t);
      return true;
    }
    if (!p.jarvis) return false;
    await lireParJarvis(`Range cette recette dans nos recettes : ${t}`, null, "jarvis");
    return true;
  });

  async function lireParJarvis(demande: string, image: PieceJointe | null, source: Recette["source"]) {
    if (!p.jarvis) return;
    setLecture(image?.type === "application/pdf" ? `${nomFee()} lit la recette dans le PDF…` : image ? `${nomFee()} lit la recette sur la photo…` : `${nomFee()} range la recette…`);
    try {
      const r = await p.jarvis.serveur.demanderJarvis({ foyerId: p.jarvis.foyerId, demande, etat: decrireFoyer(p, p.membreId, p.aujourdhui), historique: [], ...(image ? { image } : {}) });
      const actions = lireActions(r.appels)
        .filter((a) => !aConfirmer(a))
        .map((a) => (a.outil === "enregistrer_recette" && a.recette.source !== "lien" ? { ...a, recette: { ...a.recette, source } } : a));
      const resultat = appliquerActions(actions, p, p.membreId, p.aujourdhui, contexteReel);
      await enregistrerModifications(p.depot, resultat.modifications);
      const rangee = resultat.modifications.find((m) => m.collection === "menus");
      if (!rangee) {
        annoncer(r.texte || "Je n'ai pas trouvé de recette. Essaie avec la page bien à plat et éclairée.", () => {});
        return;
      }
      vibrer();
      annoncer(resultat.faits.join(" "), () => annulerModifications(p.depot, resultat.modifications));
      p.ouvrir(rangee.apres.id);
    } catch (e) {
      annoncer(e instanceof Error && e.message ? e.message : `${nomFee()} n'a pas pu lire la recette, réessaie.`, () => {});
    } finally {
      setLecture(null);
    }
  }

  async function supprimer(r: Recette) {
    await p.depot.supprimerMenu(r.id);
    annoncer(`« ${r.titre} » retirée des recettes.`, () => p.depot.enregistrerMenu(r));
  }

  return (
    <>
      <div className="puces recettes-filtres" role="group" aria-label="Quelles recettes">
        {FILTRES.map((f) => (
          <button key={f.id} type="button" className={`puce${filtre === f.id ? " active" : ""}`} aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>
            {f.libelle}
          </button>
        ))}
      </div>

      {(p.jarvis || p.recettes.length < 3) && (
      <section className="carte recettes-ajout">
        {p.recettes.length < 3 && <p className="discret">Le Chef range ici chaque repas qu'il propose, et {nomFee()} chaque recette que tu lui donnes. Écris un titre à ta fée (appui long sur elle) pour en ajouter une à la main, ou colle une recette entière.</p>}
        {p.jarvis && (
          <PhotoRecette
            occupe={lecture !== null}
            lire={(fichier) =>
              void (fichier.type === "application/pdf"
                ? lireParJarvis("Voici une recette en PDF. Range-la dans nos recettes avec tous ses ingrédients, leurs quantités et ses étapes. S'il y en a plusieurs, range chacune.", fichier, "pdf")
                : lireParJarvis("Voici une recette en photo (page de livre, fiche ou écran). Range-la dans nos recettes avec tous ses ingrédients, leurs quantités et ses étapes.", fichier, "photo"))
            }
            erreur={(message) => annoncer(message, () => {})}
          />
        )}
        {lecture && <p className="discret recettes-lecture">{lecture}</p>}
      </section>
      )}

      {liste.length === 0 ? (
        <p className="vide">
          {p.recettes.length === 0
            ? `Pas encore de recette. Lance le Chef, colle un lien à ${nomFee()} ou photographie une page de livre.`
            : filtre === "ce-soir"
              ? "Aucune recette ne se fait avec le stock ce soir."
              : "Aucune recette aimée pour l'instant : touche le cœur sur une fiche."}
        </p>
      ) : (
        <ListeVivante className="carte groupe recettes-liste">
          {liste.map((r) => {
            const d = disponibilite(r, p.produits);
            const a = avis(r);
            return (
              <Ligne key={r.id}>
                <Glissable onSupprimer={() => void supprimer(r)} libelle="Retirer">
                  <button type="button" className="ligne recette-ligne" onClick={() => p.ouvrir(r.id)}>
                    <span className="ligne-texte">
                      <span className="recette-titre">
                        {a === "aime" && <Icone nom="coeur" taille={13} />}
                        {r.titre}
                      </span>
                      <span className="discret">
                        {decrireDisponibilite(d)}
                        {r.prevuLe && r.prevuLe >= p.aujourdhui ? ` · ${nomDuSoir(r.prevuLe, p.aujourdhui).toLowerCase()}` : ""}
                        {r.fois ? ` · faite ${r.fois} fois` : ""}
                      </span>
                    </span>
                    <span className={`recette-jauge${d.manquants.length === 0 ? " pleine" : ""}`} aria-hidden>
                      <span style={{ width: `${d.total ? Math.round((100 * d.aLaMaison) / d.total) : 100}%` }} />
                    </span>
                    <span className="chevron" aria-hidden><Icone nom="suivant" taille={16} /></span>
                  </button>
                </Glissable>
              </Ligne>
            );
          })}
        </ListeVivante>
      )}
      {liste.length > 0 && <p className="discret">Glisse une recette vers la gauche pour la retirer.</p>}

      <EditeurRecette
        ouverte={nouvelle !== null}
        titreDeDepart={nouvelle ?? ""}
        recette={null}
        fermer={() => setNouvelle(null)}
        enregistrer={async (b) => {
          const r = nouvelleRecette({ ...b, source: "main" }, contexteReel);
          await p.depot.enregistrerMenu(r);
          vibrer();
          setNouvelle(null);
          annoncer(`« ${r.titre} » ajoutée à vos recettes.`, () => p.depot.supprimerMenu(r.id));
          p.ouvrir(r.id);
        }}
      />
    </>
  );
}

function PhotoRecette(props: { occupe: boolean; lire: (fichier: PieceJointe) => void; erreur: (message: string) => void }) {
  const choix = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="bouton-secondaire recettes-photo" disabled={props.occupe} onClick={() => choix.current?.click()}>
        <Icone nom="photo" taille={18} />
        Photo ou PDF d'une recette
      </button>
      {/* L'iPhone propose alors l'appareil photo, la photothèque et « Choisir un fichier » (les PDF de Fichiers). */}
      <input
        ref={choix}
        type="file"
        accept="image/*,application/pdf,.pdf"
        hidden
        onChange={async (e) => {
          const fichier = e.target.files?.[0];
          e.target.value = "";
          if (!fichier) return;
          const pdf = fichier.type === "application/pdf" || /\.pdf$/i.test(fichier.name);
          try {
            props.lire(pdf ? await pdfPourJarvis(fichier) : await photoPourJarvis(fichier));
          } catch (err) {
            props.erreur(err instanceof Error && err.message ? err.message : "Ce fichier n'a pas pu être ouvert.");
          }
        }}
      />
    </>
  );
}

/** La fiche d'une recette : portions, ce qu'on a, les étapes, et ce qu'on en fait. */
export function FicheRecette(p: PropsPage & { recette: Recette | null; fermer: () => void }) {
  const annoncer = useAnnoncer();
  const r = p.recette;
  const [portions, setPortions] = useState(r?.portions ?? 2);
  const [cuisine, setCuisine] = useState(false);
  const [edition, setEdition] = useState(false);
  useEffect(() => setPortions(r?.portions ?? 2), [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const courses = p.listes.find((l) => l.type === "courses") ?? null;
  const ingredients = r ? ingredientsPour(r, portions) : [];
  const d = r ? disponibilite(r, p.produits) : null;
  const a = r ? (avisDuPlat(p.souvenirs, r.titre)?.avis ?? null) : null;

  async function mettreAuxCourses(recette: Recette, sansAnnonce = false) {
    if (!courses) {
      annoncer("Crée d'abord une liste de courses.", () => {});
      return [];
    }
    const ajouts = preparerCourses(recette, portions, p.produits, courses, p.elements, p.membreId, contexteReel);
    for (const e of ajouts) await p.depot.enregistrerElement(e);
    if (!sansAnnonce) {
      vibrer();
      annoncer(ajouts.length ? `${ajouts.length} article${ajouts.length > 1 ? "s" : ""} aux courses : ${ajouts.map((e) => e.texte.toLowerCase()).join(", ")}.` : "Rien à ajouter : tout est à la maison ou déjà sur la liste.", () =>
        p.depot.supprimerElements(ajouts.map((e) => e.id)),
      );
    }
    return ajouts;
  }

  async function choisirSoir(recette: Recette, jour: string) {
    if (recette.prevuLe === jour) {
      await p.depot.enregistrerMenu(prevoirRecette(recette, null, contexteReel));
      annoncer(`« ${recette.titre} » n'est plus prévue.`, () => p.depot.enregistrerMenu(recette));
      return;
    }
    await p.depot.enregistrerMenu(prevoirRecette(recette, jour, contexteReel));
    const ajouts = await mettreAuxCourses(recette, true);
    vibrer();
    const suite = ajouts.length ? ` ${ajouts.length} article${ajouts.length > 1 ? "s" : ""} aux courses.` : "";
    annoncer(`Prévue ${nomDuSoir(jour, p.aujourdhui).toLowerCase()}.${suite}`, async () => {
      await p.depot.enregistrerMenu(recette);
      await p.depot.supprimerElements(ajouts.map((e) => e.id));
    });
  }

  async function faite(recette: Recette) {
    await p.depot.enregistrerMenu(marquerCuisinee(recette, p.aujourdhui, contexteReel));
    vibrer();
    annoncer(`Bon appétit. « ${recette.titre} » compte une fois de plus.`, () => p.depot.enregistrerMenu(recette));
  }

  async function donnerAvis(titre: string, choix: AvisPlat) {
    vibrer();
    const avant = avisDuPlat(p.souvenirs, titre);
    if (avant) await p.depot.supprimerSouvenir(avant.souvenir.id);
    if (avant?.avis === choix) return;
    const souvenir = avisSurPlat(titre, choix, p.membreId, contexteReel);
    await p.depot.enregistrerSouvenir(souvenir);
    annoncer(choix === "aime" ? "Le Chef la refera de temps en temps." : "Le Chef ne la proposera plus.", async () => {
      await p.depot.supprimerSouvenir(souvenir.id);
      if (avant) await p.depot.enregistrerSouvenir(avant.souvenir);
    });
  }

  return (
    <>
      <Feuille ouverte={!!r && !cuisine && !edition} onFermer={p.fermer} titre={r?.titre} className="feuille-recette">
        {r && d && (
          <div className="recette-fiche">
            <p className="surtitre">{SOURCES_RECETTE[r.source]}{r.fois ? ` · faite ${r.fois} fois` : ""}</p>

            <div className="recette-actions-haut">
              <button type="button" className="bouton-principal" onClick={() => setCuisine(true)}>
                <Icone nom="toque" taille={18} />
                Mode cuisine
              </button>
              <div className="chef-avis" role="group" aria-label={`Ton avis sur ${r.titre}`}>
                <button className={`chef-avis-bouton${a === "aime" ? " actif aime" : ""}`} aria-pressed={a === "aime"} onClick={() => void donnerAvis(r.titre, "aime")}>
                  <Icone nom="coeur" taille={15} />
                  {a === "aime" ? "On aime" : "À refaire"}
                </button>
                <button className={`chef-avis-bouton${a === "non" ? " actif" : ""}`} aria-pressed={a === "non"} onClick={() => void donnerAvis(r.titre, "non")}>
                  <Icone nom="fermer" taille={15} />
                  {a === "non" ? "Plus jamais" : "Pas pour nous"}
                </button>
              </div>
            </div>

            <div className="recette-entete-ingredients">
              <h3>Ingrédients</h3>
              <div className="recette-portions" role="group" aria-label="Nombre de personnes">
                <button type="button" className="bouton-icone" aria-label="Une personne de moins" disabled={portions <= 1} onClick={() => setPortions(portions - 1)}>
                  <Icone nom="moins" taille={16} />
                </button>
                <span>{portions} pers.</span>
                <button type="button" className="bouton-icone" aria-label="Une personne de plus" disabled={portions >= PORTIONS_MAX} onClick={() => setPortions(portions + 1)}>
                  <Icone nom="ajouter" taille={16} />
                </button>
              </div>
            </div>
            <p className="discret recette-dispo">{decrireDisponibilite(d)}</p>
            <ul className="carte groupe recette-ingredients">
              {ingredients.map((i, n) => {
                const base = estDeBase(i.nom);
                const maison = base || !!produitPour(i.nom, p.produits);
                return (
                  <li key={n} className={`ligne${maison ? " a-la-maison" : ""}`}>
                    <span className={`recette-point${maison ? " plein" : ""}`} aria-hidden />
                    <span className="ligne-texte">{i.nom}</span>
                    {i.quantite && <span className="quantite">{i.quantite}</span>}
                    <span className="visuellement-cache">{maison ? "à la maison" : "à acheter"}</span>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="bouton-secondaire" disabled={d.manquants.length === 0} onClick={() => void mettreAuxCourses(r)}>
              <Icone nom="panier" taille={18} />
              {d.manquants.length ? `Mettre aux courses ce qui manque (${d.manquants.length})` : "Tout est à la maison"}
            </button>

            <h3>Pour quel soir ?</h3>
            <div className="puces recette-soirs" role="group" aria-label="Choisir un soir">
              {septProchainsJours(p.aujourdhui).map((jour) => (
                <button key={jour} type="button" className={`puce${r.prevuLe === jour ? " active" : ""}`} aria-pressed={r.prevuLe === jour} onClick={() => void choisirSoir(r, jour)}>
                  {nomDuSoir(jour, p.aujourdhui)}
                </button>
              ))}
            </div>
            <p className="discret">Le soir choisi rejoint les menus, et ce qui manque part aux courses.</p>

            {r.etapes.length > 0 && (
              <>
                <h3>Étapes</h3>
                <ol className="recette-etapes">
                  {r.etapes.map((e, n) => <li key={n}>{e}</li>)}
                </ol>
              </>
            )}

            <div className="recette-pied">
              <button type="button" className="bouton-secondaire" onClick={() => void faite(r)}>
                <Icone nom="coche" taille={18} />
                On l'a fait
              </button>
              <button type="button" className="lien" onClick={() => setEdition(true)}>Modifier</button>
              {r.lien && <a className="lien" href={r.lien} target="_blank" rel="noreferrer">Voir la page d'origine</a>}
            </div>
            <p className="discret chef-note">Une recette faite ne retire rien du stock : tu le fais toi-même dans Frigo et placards.</p>
          </div>
        )}
      </Feuille>

      {r && cuisine && <ModeCuisine titre={r.titre} portions={portions} ingredients={ingredients} etapes={r.etapes} fermer={() => setCuisine(false)} />}

      <EditeurRecette
        ouverte={!!r && edition}
        titreDeDepart={r?.titre ?? ""}
        recette={r}
        fermer={() => setEdition(false)}
        enregistrer={async (b) => {
          if (!r) return;
          await p.depot.enregistrerMenu(modifierRecette(r, b, contexteReel));
          vibrer();
          setEdition(false);
          annoncer(`« ${b.titre} » enregistrée.`, () => p.depot.enregistrerMenu(r));
        }}
      />
    </>
  );
}

/** Écrire ou corriger une recette : un ingrédient par ligne, une étape par ligne. */
function EditeurRecette(props: {
  ouverte: boolean;
  titreDeDepart: string;
  recette: Recette | null;
  fermer: () => void;
  enregistrer: (b: { titre: string; portions: number; ingredients: IngredientRecette[]; etapes: string[] }) => Promise<void>;
}) {
  const [titre, setTitre] = useState("");
  const [portions, setPortions] = useState(2);
  const [ingredients, setIngredients] = useState("");
  const [etapes, setEtapes] = useState("");
  useEffect(() => {
    if (!props.ouverte) return;
    const r = props.recette;
    setTitre(r?.titre ?? props.titreDeDepart);
    setPortions(r?.portions ?? 2);
    setIngredients(r ? r.ingredients.map(ecrireIngredient).join("\n") : "");
    setEtapes(r ? r.etapes.join("\n") : "");
  }, [props.ouverte]); // eslint-disable-line react-hooks/exhaustive-deps

  const lus = ingredients.split("\n").map(lireLigneIngredient).filter((i): i is IngredientRecette => !!i);
  const pret = titre.trim().length > 0 && lus.length > 0;

  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre={props.recette ? "Modifier la recette" : "Nouvelle recette"} fermer="Annuler">
      <form
        className="formulaire recette-editeur"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pret) return;
          void props.enregistrer({ titre: titre.trim().replace(/\s+/g, " "), portions, ingredients: lus, etapes: etapes.split("\n").map((t) => t.trim()).filter(Boolean) });
        }}
      >
        <label>
          Titre
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Gratin de courge" maxLength={80} />
        </label>
        <div className="recette-portions" role="group" aria-label="Pour combien de personnes">
          <span className="discret">Pour</span>
          <button type="button" className="bouton-icone" aria-label="Une personne de moins" disabled={portions <= 1} onClick={() => setPortions(portions - 1)}>
            <Icone nom="moins" taille={16} />
          </button>
          <span>{portions} pers.</span>
          <button type="button" className="bouton-icone" aria-label="Une personne de plus" disabled={portions >= PORTIONS_MAX} onClick={() => setPortions(portions + 1)}>
            <Icone nom="ajouter" taille={16} />
          </button>
        </div>
        <label>
          Ingrédients, un par ligne
          <textarea className="champ-note" rows={6} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"800 g de courge\n2 dl de crème\n50 g de gruyère"} />
        </label>
        <label>
          Étapes, une par ligne
          <textarea className="champ-note" rows={6} value={etapes} onChange={(e) => setEtapes(e.target.value)} placeholder={"Couper la courge en dés.\nCuire 40 min à 200 °C."} />
        </label>
        <button type="submit" className="bouton-principal" disabled={!pret}>Enregistrer</button>
      </form>
    </Feuille>
  );
}

/**
 * Le mode cuisine : plein écran, l'écran reste allumé, les ingrédients puis une étape à la
 * fois en grand. On avance en glissant vers la gauche, on revient vers la droite.
 */
function ModeCuisine(props: { titre: string; portions: number; ingredients: IngredientRecette[]; etapes: string[]; fermer: () => void }) {
  const [page, setPage] = useState(0);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const total = props.etapes.length + 1;

  // L'écran reste allumé tant que le mode cuisine est ouvert (iOS 18.4 et plus).
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    const demander = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((v) => {
          if (fini) void v.release();
          else verrou = v;
        })
        .catch(ignorer);
    };
    demander();
    const revenir = () => document.visibilityState === "visible" && demander();
    document.addEventListener("visibilitychange", revenir);
    document.documentElement.classList.add("feuille-ouverte");
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", revenir);
      document.documentElement.classList.remove("feuille-ouverte");
      void verrou?.release();
    };
  }, []);

  const aller = (n: number) => {
    const suivante = Math.max(0, Math.min(total - 1, n));
    if (suivante !== page) vibrer();
    setPage(suivante);
  };
  const debut = (e: TouchEvent) => (depart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const fin = (e: TouchEvent) => {
    const d = depart.current;
    depart.current = null;
    if (!d) return;
    const dx = e.changedTouches[0].clientX - d.x;
    const dy = e.changedTouches[0].clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) aller(page + (dx < 0 ? 1 : -1));
  };

  return createPortal(
    <div className="mode-cuisine" role="dialog" aria-modal aria-label={`Mode cuisine : ${props.titre}`} onTouchStart={debut} onTouchEnd={fin}>
      <header className="mode-cuisine-haut">
        <p className="surtitre">{page === 0 ? `Ingrédients · ${props.portions} pers.` : `Étape ${page} sur ${props.etapes.length}`}</p>
        <button type="button" className="lien" onClick={props.fermer}>Terminer</button>
      </header>
      <h2 className="mode-cuisine-titre">{props.titre}</h2>
      <div className="mode-cuisine-corps" aria-live="polite">
        {page === 0 ? (
          <ul className="mode-cuisine-ingredients">
            {props.ingredients.map((i, n) => (
              <li key={n}>
                <span>{i.nom}</span>
                {i.quantite && <span className="quantite">{i.quantite}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mode-cuisine-etape">{props.etapes[page - 1]}</p>
        )}
      </div>
      <div className="mode-cuisine-points" aria-hidden>
        {Array.from({ length: total }, (_, n) => <span key={n} className={n === page ? "actif" : ""} />)}
      </div>
      <footer className="mode-cuisine-bas">
        <button type="button" className="bouton-secondaire" disabled={page === 0} onClick={() => aller(page - 1)}>Précédent</button>
        {page < total - 1 ? (
          <button type="button" className="bouton-principal" onClick={() => aller(page + 1)}>{page === 0 ? "Commencer" : "Suivant"}</button>
        ) : (
          <button type="button" className="bouton-principal" onClick={props.fermer}>{props.etapes.length ? "C'est prêt" : "Fermer"}</button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
